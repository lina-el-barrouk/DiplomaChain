"""
DiplomaChain – Endpoints Admin
GET  /admin/stats            → tableau de bord statistiques
GET  /admin/users            → liste des utilisateurs
PUT  /admin/users/{id}/activate   → activer/désactiver un compte
GET  /admin/audit-logs       → journaux de vérification
DELETE /admin/tokens/cleanup → purger les tokens expirés de la blacklist
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import require_admin
from app.db.database import get_db
from app.models.models import Diploma, Institution, RevokedToken, User, VerificationLog

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS ADMIN
# ─────────────────────────────────────────────────────────────────────────────

class UserAdminOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime | None
    last_login: datetime | None

    model_config = {"from_attributes": True}

    @field_validator("created_at", "last_login", mode="before")
    @classmethod
    def sanitize_zero_date(cls, v):
        """MySQL stocke parfois '0000-00-00 00:00:00' comme date invalide.
        Pydantic ne peut pas parser cette valeur → on la remplace par None."""
        if v is None:
            return None
        if isinstance(v, str) and v.startswith("0000"):
            return None
        return v


class StatsOut(BaseModel):
    total_users: int
    total_institutions: int
    approved_institutions: int
    pending_institutions: int
    total_diplomas: int
    issued_diplomas: int
    pending_diplomas: int
    revoked_diplomas: int
    blockchain_anchored: int
    total_verifications: int
    verifications_today: int


class AuditLogOut(BaseModel):
    id: str
    diploma_id: str
    verifier_ip: str | None
    result: str
    checked_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# TABLEAU DE BORD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def get_stats(
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Statistiques globales du système."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    return StatsOut(
        total_users=db.query(func.count(User.id)).scalar(),
        total_institutions=db.query(func.count(Institution.id)).scalar(),
        approved_institutions=db.query(func.count(Institution.id)).filter(Institution.is_approved == True).scalar(),
        pending_institutions=db.query(func.count(Institution.id)).filter(Institution.is_approved == False).scalar(),
        total_diplomas=db.query(func.count(Diploma.id)).scalar(),
        issued_diplomas=db.query(func.count(Diploma.id)).filter(Diploma.status == "issued").scalar(),
        pending_diplomas=db.query(func.count(Diploma.id)).filter(Diploma.status == "pending").scalar(),
        revoked_diplomas=db.query(func.count(Diploma.id)).filter(Diploma.status == "revoked").scalar(),
        blockchain_anchored=db.query(func.count(Diploma.id)).filter(Diploma.blockchain_anchored == True).scalar(),
        total_verifications=db.query(func.count(VerificationLog.id)).scalar(),
        verifications_today=db.query(func.count(VerificationLog.id)).filter(
            VerificationLog.checked_at >= today_start
        ).scalar(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GESTION DES UTILISATEURS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserAdminOut])
def list_users(
    role: str | None = None,
    is_active: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/users/{user_id}/activate")
def toggle_user_activation(
    user_id: str,
    active: bool = Query(..., description="True pour activer, False pour désactiver"),
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Impossible de modifier un admin")
    user.is_active = active
    db.commit()
    return {"message": f"Compte {'activé' if active else 'désactivé'}", "user_id": user_id}


@router.put("/users/{user_id}/unlock")
def unlock_user(
    user_id: str,
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Déverrouille manuellement un compte bloqué (anti-brute-force)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    return {"message": "Compte déverrouillé", "user_id": user_id}


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    diploma_id: str | None = None,
    result: str | None = None,
    skip: int = 0,
    limit: int = 200,
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Journaux complets de toutes les vérifications."""
    query = db.query(VerificationLog)
    if diploma_id:
        query = query.filter(VerificationLog.diploma_id == diploma_id)
    if result:
        query = query.filter(VerificationLog.result == result)
    return query.order_by(VerificationLog.checked_at.desc()).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/tokens/cleanup")
def cleanup_revoked_tokens(
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Purge les tokens révoqués expirés de la blacklist."""
    now = datetime.now(timezone.utc)
    deleted = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()
    return {"deleted_tokens": deleted, "message": f"{deleted} token(s) expirés supprimés"}
