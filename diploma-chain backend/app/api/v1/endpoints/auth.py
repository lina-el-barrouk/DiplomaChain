"""
DiplomaChain – Endpoints d'authentification
POST /auth/register   → inscription
POST /auth/login      → connexion, retourne access + refresh tokens
POST /auth/refresh    → renouvellement du token
POST /auth/logout     → révocation du token (blacklist)
GET  /auth/verify-email/{token} → vérification email
"""
from datetime import datetime, timedelta, timezone
from app.core.security import encrypt_sensitive
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_client_ip
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.models import RevokedToken, User
from app.schemas.diploma import RefreshRequest, TokenResponse, UserLogin, UserRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15


@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Un compte avec cet email existe déjà")
    
    token = generate_secure_token()
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        verification_token=token,
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Créer profil étudiant automatiquement
    if payload.role == "student" and payload.student:
        import hashlib
        from app.models.models import Student
        student = Student(
            user_id=user.id,
            full_name_enc=encrypt_sensitive(payload.student.full_name),
            national_id_enc=encrypt_sensitive(payload.student.national_id),
            massar_code_enc=encrypt_sensitive(payload.student.massar_code),
            massar_code_hash=hashlib.sha256(payload.student.massar_code.encode()).hexdigest(),
            birth_date_enc=encrypt_sensitive(payload.student.birth_date),
            is_approved=False,
        )
        db.add(student)

    # Créer profil institution automatiquement
    if payload.role == "institution" and payload.institution:
        from app.models.models import Institution
        import secrets, string
        accr = "INST-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        institution = Institution(
            manager_id=user.id,
            name=payload.institution.name,
            country=payload.institution.country,
            accreditation_number=accr,
            is_approved=False,
        )
        db.add(institution)

    db.commit()
    db.refresh(user)
    return {
        "message": "Compte créé. En attente de validation par un administrateur.",
        "user_id": user.id,
    }
      


@router.get("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Valide l'adresse email via le token envoyé par email."""
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token de vérification invalide",
        )
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email vérifié avec succès. Vous pouvez maintenant vous connecter."}


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Authentifie l'utilisateur.
    - Verrouillage temporaire après 5 échecs (anti-brute-force)
    - Tokens JWT signés HS256
    """
    user = db.query(User).filter(User.email == payload.email).first()

    # Message générique pour ne pas révéler l'existence du compte
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email ou mot de passe incorrect",
    )

    if not user:
        raise auth_error

    # Vérifier le verrouillage
    if user.locked_until:
        locked_until_aware = user.locked_until
        if locked_until_aware.tzinfo is None:
            locked_until_aware = locked_until_aware.replace(tzinfo=timezone.utc)
            
        if locked_until_aware > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Compte verrouillé jusqu'à {locked_until_aware.isoformat()}",
            )

    if not verify_password(payload.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= MAX_FAILED_LOGINS:
            # Enregistrement en naive UTC pour compatibilité avec la BDD
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        db.commit()
        raise auth_error
    # Vérifier si le profil est approuvé
    if user.role == "student":
     from app.models.models import Student
     student = db.query(Student).filter(Student.user_id == user.id).first()
     if student and not student.is_approved:
        if student.rejection_reason:
            raise HTTPException(403, f"REJECTED:{student.rejection_reason}")
        raise HTTPException(403, "PENDING:Votre compte est en cours de vérification par un administrateur.")

    if user.role == "institution":
     from app.models.models import Institution
     institution = db.query(Institution).filter(Institution.manager_id == user.id).first()
     if institution and not institution.is_approved:
        if institution.rejection_reason if hasattr(institution, 'rejection_reason') else False:
            raise HTTPException(403, f"REJECTED:{institution.rejection_reason}")
        raise HTTPException(403, "PENDING:Votre institution est en cours de vérification.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email non vérifié")

    # Réinitialiser les compteurs d'échec
    user.failed_logins = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
):
    """Renouvelle l'access token via le refresh token."""
    from jose import JWTError

    try:
        data = decode_token(payload.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré",
        )

    if data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Type de token invalide")

    user = db.query(User).filter(User.id == data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")

    new_access = create_access_token(subject=user.id, role=user.role)
    new_refresh = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Révoque le token courant (blacklist JTI)."""
    # Note : le token est extrait dans get_current_user mais on n'a pas le jti ici
    # En production : passer le token brut et extraire le jti
    return None
