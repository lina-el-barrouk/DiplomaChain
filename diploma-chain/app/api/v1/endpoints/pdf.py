"""
DiplomaChain – Endpoints PDF
POST /pdf/templates/upload     → institution uploade son template
POST /pdf/templates/positions  → configurer les positions des champs
GET  /pdf/diplomas/{id}/generate → générer le PDF d'un diplôme
GET  /pdf/templates/preview    → prévisualiser le template
"""
import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_approved_institution
from app.db.database import get_db
from app.models.models import Diploma, DiplomaTemplate, Institution, Student, User
# APRÈS
from app.services.pdf_service import (
    generate_diploma_pdf,
    save_generated_pdf,
    save_template_file,
)
from app.core.security import decrypt_sensitive

router = APIRouter(prefix="/pdf", tags=["PDF Diplômes"])

MAX_TEMPLATE_SIZE = 20 * 1024 * 1024  # 20 Mo


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class FieldPosition(BaseModel):
    x: float
    y: float
    font: str = "Helvetica"
    font_size: float = 12
    color: str = "#000000"
    align: str = "center"


class QRPosition(BaseModel):
    x: float
    y: float
    width: float = 90
    height: float = 90


class TemplatePositions(BaseModel):
    student_name: FieldPosition | None = None
    degree_title: FieldPosition | None = None
    field_of_study: FieldPosition | None = None
    institution_name: FieldPosition | None = None
    graduation_date: FieldPosition | None = None
    honors: FieldPosition | None = None
    unique_code: FieldPosition | None = None
    qr_code: QRPosition | None = None


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD DU TEMPLATE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/templates/upload")
async def upload_template(
    file: UploadFile = File(..., description="Template PDF du diplôme (max 20 Mo)"),
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """
    L'institution uploade son design de diplôme vierge en PDF.
    Le backend stocke le fichier et crée/met à jour le template.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(400, "Seuls les fichiers PDF sont acceptés")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_TEMPLATE_SIZE:
        raise HTTPException(413, "Fichier trop volumineux (max 20 Mo)")

    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    # Sauvegarder le fichier
    file_path = save_template_file(file_bytes, institution.id, file.filename)

    # Créer ou mettre à jour le template en base
    template = db.query(DiplomaTemplate).filter(
        DiplomaTemplate.institution_id == institution.id
    ).first()

    if template:
        template.file_name = file.filename
        template.file_path = file_path
        template.is_active = True
    else:
        template = DiplomaTemplate(
            institution_id=institution.id,
            file_name=file.filename,
            file_path=file_path,
            field_positions="{}",
        )
        db.add(template)

    db.commit()
    db.refresh(template)

    return {
        "message": "Template uploadé avec succès",
        "template_id": template.id,
        "file_name": template.file_name,
        "positions": json.loads(template.field_positions),
    }


# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURER LES POSITIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/templates/positions")
def update_positions(
    positions: TemplatePositions,
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """
    L'institution configure les coordonnées X/Y de chaque champ sur son template.
    """
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    template = db.query(DiplomaTemplate).filter(
        DiplomaTemplate.institution_id == institution.id
    ).first()

    if not template:
        raise HTTPException(404, "Aucun template trouvé — uploadez d'abord un template")

    # Fusionner avec les positions existantes
    existing = json.loads(template.field_positions)
    new_positions = positions.model_dump(exclude_none=True)

    for field, pos in new_positions.items():
        existing[field] = pos

    template.field_positions = json.dumps(existing)
    db.commit()

    return {
        "message": "Positions mises à jour",
        "positions": existing,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GÉNÉRER LE PDF D'UN DIPLÔME
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/diplomas/{diploma_id}/generate")
def generate_diploma(
    diploma_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Génère le PDF final du diplôme avec :
    - Le template de l'institution (ou fond par défaut)
    - Les infos de l'étudiant
    - Le QR code inséré automatiquement
    Retourne le PDF en téléchargement.
    """
    # Récupérer le diplôme
    diploma = db.query(Diploma).filter(Diploma.id == diploma_id).first()
    if not diploma:
        raise HTTPException(404, "Diplôme introuvable")

    if diploma.status != "issued":
        raise HTTPException(400, "Le diplôme doit être émis avant de générer le PDF")

    # Contrôle d'accès
    if current_user.role == "institution":
        institution = db.query(Institution).filter(
            Institution.manager_id == current_user.id
        ).first()
        if not institution or diploma.institution_id != institution.id:
            raise HTTPException(403, "Accès refusé")
    elif current_user.role == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or diploma.student_id != student.id:
            raise HTTPException(403, "Accès refusé")
    elif current_user.role != "admin":
        raise HTTPException(403, "Accès refusé")

    # Récupérer les infos de l'étudiant (déchiffrement)
    student = db.query(Student).filter(Student.id == diploma.student_id).first()
    student_name = decrypt_sensitive(student.full_name_enc) if student else "Étudiant"

    # Récupérer l'institution
    institution = db.query(Institution).filter(
        Institution.id == diploma.institution_id
    ).first()
    institution_name = institution.name if institution else "Institution"

    # Récupérer le template de l'institution
    template = db.query(DiplomaTemplate).filter(
        DiplomaTemplate.institution_id == diploma.institution_id,
        DiplomaTemplate.is_active == True,
    ).first()

    template_path = template.file_path if template else None
    field_positions = json.loads(template.field_positions) if template else None

    # Générer le PDF
    diploma_data = {
        "degree_title": diploma.degree_title,
        "field_of_study": diploma.field_of_study,
        "graduation_date": diploma.graduation_date,
        "honors": diploma.honors,
        "unique_code": diploma.unique_code,
    }

    pdf_bytes = generate_diploma_pdf(
        diploma_data=diploma_data,
        student_name=student_name,
        institution_name=institution_name,
        template_path=template_path,
        field_positions=field_positions,
    )

    # Sauvegarder une copie
    save_generated_pdf(pdf_bytes, diploma.id)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=diplome-{diploma.unique_code}.pdf",
            "Cache-Control": "no-store",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# VOIR MON TEMPLATE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/templates/me")
def get_my_template(
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Retourne les infos du template de l'institution."""
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    template = db.query(DiplomaTemplate).filter(
        DiplomaTemplate.institution_id == institution.id
    ).first()

    if not template:
        return {
            "has_template": False,
            "message": "Aucun template configuré — un fond par défaut sera utilisé",
            "message": "Aucun template — un fond élégant par défaut sera utilisé avec placeholders",
        }

    return {
        "has_template": True,
        "template_id": template.id,
        "file_name": template.file_name,
        "is_active": template.is_active,
        "positions": json.loads(template.field_positions),
        "created_at": template.created_at,
    }
