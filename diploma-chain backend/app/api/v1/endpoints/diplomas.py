"""
DiplomaChain – Endpoints des diplômes
POST   /diplomas/          → créer un diplôme (institution)
POST   /diplomas/{id}/issue → émettre + ancrer sur Hedera (institution)
POST   /diplomas/{id}/revoke → révoquer (institution)
GET    /diplomas/{id}      → détails d'un diplôme (propriétaire ou admin)
GET    /diplomas/verify/{code} → vérification publique
GET    /diplomas/          → liste des diplômes de l'institution
"""
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.deps import (
    get_client_ip,
    get_current_user,
    require_admin,
    require_approved_institution,
)
from app.db.database import get_db
from app.models.models import Diploma, Institution, User
from app.schemas.diploma import (
    DiplomaCreate,
    DiplomaOut,
    DiplomaRevoke,
    VerifyResponse,
)
from app.services.diploma_service import (
    create_diploma,
    issue_diploma,
    revoke_diploma,
    verify_diploma,
)

router = APIRouter(prefix="/diplomas", tags=["Diplomas"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo


# ─────────────────────────────────────────────────────────────────────────────
# CRÉER UN DIPLÔME (pending)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=DiplomaOut, status_code=status.HTTP_201_CREATED)
async def create_diploma_endpoint(
    data: DiplomaCreate,
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Crée un diplôme en statut 'pending'. Réservé aux établissements approuvés."""
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Profil institution introuvable")

    diploma = create_diploma(db=db, data=data, institution_id=institution.id)
    return diploma


@router.post("/with-file", response_model=DiplomaOut, status_code=status.HTTP_201_CREATED)
async def create_diploma_with_file(
    data: DiplomaCreate = Depends(),
    file: UploadFile = File(..., description="PDF du diplôme (max 10 Mo)"),
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Crée un diplôme avec un fichier PDF (le hash du fichier est aussi stocké)."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")

    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    diploma = create_diploma(db=db, data=data, institution_id=institution.id, file_bytes=file_bytes)
    return diploma


# ─────────────────────────────────────────────────────────────────────────────
# ÉMETTRE UN DIPLÔME (issue + ancrage Hedera)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{diploma_id}/issue", response_model=DiplomaOut)
async def issue_diploma_endpoint(
    diploma_id: str,
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Émet officiellement un diplôme et l'ancre sur Hedera HCS."""
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    if not institution:
        raise HTTPException(status_code=404, detail="Profil institution introuvable")

    try:
        diploma = await issue_diploma(
            db=db,
            diploma_id=diploma_id,
            institution_id=institution.id,
        )
        return diploma
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ANCRER SUR HEDERA (rétroactivement pour les diplômes émis sans ancrage)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{diploma_id}/anchor", response_model=DiplomaOut)
async def anchor_diploma_endpoint(
    diploma_id: str,
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Ancre rétroactivement sur Hedera un diplôme déjà émis mais non ancré."""
    try:
        from app.services.diploma_service import anchor_on_hedera

        institution = db.query(Institution).filter(
            Institution.manager_id == current_user.id
        ).first()

        if not institution:
            raise HTTPException(status_code=404, detail="Profil institution introuvable")

        diploma = await anchor_on_hedera(
            db=db,
            diploma_id=diploma_id,
            institution_id=institution.id,
        )
        return diploma
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        error_msg = f"Erreur interne: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=400, detail=error_msg)


# ─────────────────────────────────────────────────────────────────────────────
# RÉVOQUER UN DIPLÔME
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{diploma_id}/revoke", response_model=DiplomaOut)
def revoke_diploma_endpoint(
    diploma_id: str,
    body: DiplomaRevoke,
    current_user: User = Depends(require_approved_institution),
    db: Session = Depends(get_db),
):
    """Révoque un diplôme avec un motif obligatoire."""
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    try:
        diploma = revoke_diploma(
            db=db,
            diploma_id=diploma_id,
            institution_id=institution.id,
            reason=body.reason,
        )
        return diploma
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# VÉRIFICATION PUBLIQUE (sans authentification)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/verify/{unique_code}", response_model=VerifyResponse)
async def verify_diploma_public(
    unique_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Vérification publique d'un diplôme par son code unique.
    Accessible sans authentification — journalise la vérification.
    """
    client_ip = get_client_ip(request)
    result = await verify_diploma(
        db=db,
        unique_code=unique_code.upper(),
        verifier_ip=client_ip,
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# LISTE DES DIPLÔMES (institution ou admin)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[DiplomaOut])
def list_diplomas(
    status: str | None = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste les diplômes de l'institution courante ou tous (admin)."""
    from app.core.security import decrypt_sensitive
    from app.models.models import Student

    query = db.query(Diploma)

    if current_user.role == "institution":
        institution = db.query(Institution).filter(
            Institution.manager_id == current_user.id
        ).first()
        if not institution:
            return []
        query = query.filter(Diploma.institution_id == institution.id)
    elif current_user.role == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student:
            return []
        query = query.filter(Diploma.student_id == student.id)
    elif current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    if status:
        query = query.filter(Diploma.status == status)

    diplomas = query.offset(skip).limit(min(limit, 200)).all()

    # Enrichir avec le nom et l'email de l'étudiant (seulement pour institution / admin)
    if current_user.role in ("institution", "admin"):
        results = []
        for d in diplomas:
            try:
                out = DiplomaOut.model_validate(d)
                student = db.query(Student).filter(Student.id == d.student_id).first()
                if student:
                    try:
                        out.student_name = decrypt_sensitive(student.full_name_enc)
                        if hasattr(student, 'massar_code_enc') and student.massar_code_enc:
                            out.student_massar_code = decrypt_sensitive(student.massar_code_enc)
                    except Exception:
                        out.student_name = None
                        out.student_massar_code = None
                    user_obj = db.query(User).filter(User.id == student.user_id).first()
                    out.student_email = user_obj.email if user_obj else None
                results.append(out)
            except Exception as e:
                # En cas d'erreur sur un diplôme, on l'ajoute quand même avec les champs de base
                import logging
                logging.getLogger("diplomachain").warning(f"Enrichissement échoué pour diplôme {d.id}: {e}")
                try:
                    out = DiplomaOut.model_validate(d)
                    results.append(out)
                except Exception:
                    pass  # Ignorer les diplômes vraiment corrompus
        return results

    return diplomas


# ─────────────────────────────────────────────────────────────────────────────
# DÉTAILS D'UN DIPLÔME
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{diploma_id}", response_model=DiplomaOut)
def get_diploma(
    diploma_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    diploma = db.query(Diploma).filter(Diploma.id == diploma_id).first()
    if not diploma:
        raise HTTPException(status_code=404, detail="Diplôme introuvable")

    # Contrôle d'accès : admin voit tout, institution voit les siens, étudiant voit les siens
    if current_user.role == "admin":
        return diploma

    if current_user.role == "institution":
        institution = db.query(Institution).filter(
            Institution.manager_id == current_user.id
        ).first()
        if not institution or diploma.institution_id != institution.id:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return diploma

    if current_user.role == "student":
        from app.models.models import Student
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or diploma.student_id != student.id:
            raise HTTPException(status_code=403, detail="Accès refusé")
        return diploma

    raise HTTPException(status_code=403, detail="Accès refusé")


@router.get("/verify/{unique_code}/history")
def get_verification_history(
    unique_code: str,
    db: Session = Depends(get_db),
):
    """
    Historique public des vérifications d'un diplôme.
    Accessible sans authentification.
    """
    diploma = db.query(Diploma).filter(Diploma.unique_code == unique_code).first()
    if not diploma:
        raise HTTPException(status_code=404, detail="Diplôme introuvable")

    logs = (
        db.query(VerificationLog)
        .filter(VerificationLog.diploma_id == diploma.id)
        .order_by(VerificationLog.checked_at.desc())
        .limit(50)
        .all()
    )

    return {
        "unique_code": unique_code,
        "diploma_id": diploma.id,
        "total_verifications": len(logs),
        "history": [
            {
                "result": log.result,
                "checked_at": log.checked_at,
                "verifier_ip": log.verifier_ip,
            }
            for log in logs
        ],
    }
