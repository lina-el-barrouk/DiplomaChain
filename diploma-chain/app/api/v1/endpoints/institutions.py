"""
DiplomaChain – Endpoints des institutions
POST /institutions/              → créer profil institution (manager)
GET  /institutions/              → lister toutes les institutions (admin)
GET  /institutions/me            → mon profil institution
PUT  /institutions/me            → mettre à jour mon profil
POST /institutions/{id}/approve  → approuver une institution (admin)
POST /institutions/{id}/reject   → rejeter une institution (admin)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_admin, require_role
from app.db.database import get_db
from app.models.models import Institution, User
from app.schemas.diploma import InstitutionCreate, InstitutionOut

router = APIRouter(prefix="/institutions", tags=["Institutions"])


# ─────────────────────────────────────────────────────────────────────────────
# CRÉER MON PROFIL INSTITUTION
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=InstitutionOut, status_code=status.HTTP_201_CREATED)
def create_institution_profile(
    data: InstitutionCreate,
    current_user: User = Depends(require_role("institution")),
    db: Session = Depends(get_db),
):
    """Crée le profil d'un établissement. En attente d'approbation admin."""
    existing = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vous avez déjà un profil d'institution",
        )

    accr_conflict = db.query(Institution).filter(
        Institution.accreditation_number == data.accreditation_number
    ).first()
    if accr_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce numéro d'accréditation est déjà utilisé",
        )

    institution = Institution(
        manager_id=current_user.id,
        name=data.name,
        country=data.country,
        accreditation_number=data.accreditation_number,
        is_approved=False,
    )
    db.add(institution)
    db.commit()
    db.refresh(institution)
    return institution


# ─────────────────────────────────────────────────────────────────────────────
# MON PROFIL
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=InstitutionOut)
def get_my_institution(
    current_user: User = Depends(require_role("institution")),
    db: Session = Depends(get_db),
):
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Profil institution introuvable")
    return institution


@router.put("/me", response_model=InstitutionOut)
def update_my_institution(
    data: InstitutionCreate,
    current_user: User = Depends(require_role("institution")),
    db: Session = Depends(get_db),
):
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Profil institution introuvable")

    institution.name = data.name
    institution.country = data.country
    db.commit()
    db.refresh(institution)
    return institution


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN : LISTE + APPROBATION
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[InstitutionOut])
def list_institutions(
    approved: bool | None = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Liste toutes les institutions (admin uniquement)."""
    query = db.query(Institution)
    if approved is not None:
        query = query.filter(Institution.is_approved == approved)
    return query.offset(skip).limit(limit).all()


@router.post("/{institution_id}/approve", response_model=InstitutionOut)
def approve_institution(
    institution_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution introuvable")
    institution.is_approved = True
    db.commit()
    db.refresh(institution)
    return institution


@router.post("/{institution_id}/reject", response_model=InstitutionOut)
def reject_institution(
    institution_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution introuvable")
    institution.is_approved = False
    db.commit()
    db.refresh(institution)
    return institution
