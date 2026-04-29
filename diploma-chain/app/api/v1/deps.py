"""
DiplomaChain – Dépendances FastAPI
Authentification JWT, contrôle d'accès par rôle, anti-brute-force
"""
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import get_db
from app.models.models import RevokedToken, User

bearer_scheme = HTTPBearer(auto_error=True)


# ─────────────────────────────────────────────────────────────────────────────
# EXTRACTION ET VALIDATION DU JWT
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Valide le Bearer Token JWT et retourne l'utilisateur correspondant.
    Vérifie : signature, expiration, type, révocation, statut du compte.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise credentials_exception

    # Vérifier que c'est bien un access token
    if payload.get("type") != "access":
        raise credentials_exception

    user_id: str = payload.get("sub")
    jti: str = payload.get("jti")

    if not user_id or not jti:
        raise credentials_exception

    # Vérifier la liste noire des tokens révoqués
    revoked = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token révoqué (déconnexion effectuée)",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Veuillez vérifier votre adresse email",
        )

    # Vérifier verrouillage temporaire (anti-brute-force)
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Compte temporairement verrouillé jusqu'à {user.locked_until.isoformat()}",
        )

    return user


# ─────────────────────────────────────────────────────────────────────────────
# CONTRÔLE D'ACCÈS PAR RÔLE
# ─────────────────────────────────────────────────────────────────────────────

def require_role(*roles: str):
    """Factory de dépendance pour restreindre l'accès par rôle."""

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès réservé aux rôles : {', '.join(roles)}",
            )
        return current_user

    return _check


# Raccourcis pratiques
require_admin = require_role("admin")
require_institution = require_role("admin", "institution")
require_verified_institution = require_role("institution")
require_any = require_role("admin", "institution", "student")


# ─────────────────────────────────────────────────────────────────────────────
# VÉRIFICATION QUE L'INSTITUTION EST APPROUVÉE
# ─────────────────────────────────────────────────────────────────────────────

async def require_approved_institution(
    current_user: User = Depends(require_role("institution")),
    db: Session = Depends(get_db),
) -> User:
    from app.models.models import Institution
    institution = db.query(Institution).filter(
        Institution.manager_id == current_user.id
    ).first()

    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil d'établissement introuvable",
        )
    if not institution.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre établissement n'a pas encore été approuvé par un administrateur",
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# IP CLIENT (pour logs de vérification)
# ─────────────────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
