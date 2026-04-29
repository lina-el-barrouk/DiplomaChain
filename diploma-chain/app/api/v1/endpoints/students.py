from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_admin, require_role
from app.core.security import decrypt_sensitive, encrypt_sensitive
from app.db.database import get_db
from app.models.models import Student, User
from app.schemas.diploma import StudentCreate, StudentOut

router = APIRouter(prefix="/students", tags=["Students"])


class StudentFullOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    birth_date: str
    is_approved: bool
    rejection_reason: str | None = None


class StudentPendingOut(BaseModel):
    id: str
    user_id: str
    full_name: str
    national_id: str
    birth_date: str
    is_approved: bool
    created_at: datetime
    model_config = {"from_attributes": False}


# ── Étudiant crée son propre profil ──────────────────────────────────────────
@router.post("/me", response_model=StudentOut, status_code=201)
def create_profile(
    data: StudentCreate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """L'étudiant crée son profil. En attente de validation admin."""
    if db.query(Student).filter(Student.user_id == current_user.id).first():
        raise HTTPException(409, "Profil étudiant déjà existant")

    student = Student(
        user_id=current_user.id,
        full_name_enc=encrypt_sensitive(data.full_name),
        national_id_enc=encrypt_sensitive(data.national_id),
        birth_date_enc=encrypt_sensitive(data.birth_date),
        is_approved=False,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


# ── Étudiant voit son propre profil ──────────────────────────────────────────
@router.get("/me", response_model=StudentFullOut)
def get_my_profile(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(404, "Profil étudiant introuvable")
    return StudentFullOut(
        id=student.id,
        user_id=student.user_id,
        full_name=decrypt_sensitive(student.full_name_enc),
        birth_date=decrypt_sensitive(student.birth_date_enc),
        is_approved=student.is_approved,
        rejection_reason=student.rejection_reason,
    )


# ── Admin liste les profils en attente de validation ─────────────────────────
@router.get("/pending", response_model=list[StudentPendingOut])
def list_pending_students(
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin voit tous les étudiants en attente de validation."""
    students = db.query(Student).filter(Student.is_approved == False).all()
    result = []
    for s in students:
        result.append(StudentPendingOut(
            id=s.id,
            user_id=s.user_id,
            full_name=decrypt_sensitive(s.full_name_enc),
            national_id=decrypt_sensitive(s.national_id_enc),
            birth_date=decrypt_sensitive(s.birth_date_enc),
            is_approved=s.is_approved,
            created_at=s.created_at,
        ))
    return result


# ── Admin approuve un profil étudiant ────────────────────────────────────────
@router.post("/{student_id}/approve")
def approve_student(
    student_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin approuve le profil étudiant après vérification CIN."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Étudiant introuvable")
    if student.is_approved:
        raise HTTPException(400, "Profil déjà approuvé")

    student.is_approved = True
    student.approved_at = datetime.now(timezone.utc)
    student.approved_by = current_user.id
    db.commit()
    return {"message": "Profil étudiant approuvé", "student_id": student_id}


# ── Admin rejette un profil étudiant ─────────────────────────────────────────
@router.post("/{student_id}/reject")
def reject_student(
    student_id: str,
    reason: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin rejette le profil avec un motif."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Étudiant introuvable")

    student.is_approved = False
    student.rejection_reason = reason
    db.commit()
    return {"message": "Profil étudiant rejeté", "reason": reason}