"""
DiplomaChain – Module de sécurité
- Gestion des tokens JWT (access + refresh)
- Hachage des mots de passe (bcrypt)
- Hachage des diplômes (SHA-256)
- Chiffrement symétrique des données sensibles (AES-256 via Fernet)
"""
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Contexte de hachage des mots de passe ────────────────────────────────────
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# ── Chiffrement symétrique (AES-256) pour données sensibles ──────────────────
# En production : stocker cette clé dans un coffre (Vault, AWS KMS…)
_fernet = Fernet(settings.FERNET_KEY.encode() if settings.FERNET_KEY else Fernet.generate_key())   # remplacer par clé persistante chargée depuis env


# ─────────────────────────────────────────────────────────────────────────────
# MOT DE PASSE
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    # bcrypt limite à 72 bytes — on tronque proprement
    plain_bytes = plain.encode("utf-8")[:72]
    return pwd_context.hash(plain_bytes)


def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode("utf-8")[:72]
    return pwd_context.verify(plain_bytes, hashed)

# ─────────────────────────────────────────────────────────────────────────────
# JWT
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(subject: str, role: str, extra: dict | None = None) -> str:
    """
    Crée un token JWT d'accès signé.
    `subject` = user_id (str)
    `role`    = 'admin' | 'institution' | 'student' | 'verifier'
    """
    payload = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_hex(16),   # JWT ID unique → permet la révocation
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Crée un token JWT de rafraîchissement (durée de vie plus longue)."""
    payload = {
        "sub": subject,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Décode et valide un JWT.
    Lève une JWTError si le token est invalide ou expiré.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ─────────────────────────────────────────────────────────────────────────────
# HACHAGE DES DIPLÔMES (intégrité)
# ─────────────────────────────────────────────────────────────────────────────

def compute_diploma_hash(diploma_data: dict) -> str:
    """
    Calcule un hash SHA-256 déterministe d'un diplôme.
    Les clés sont triées pour garantir la reproductibilité.
    Retourne une chaîne hexadécimale de 64 caractères.
    """
    canonical = json.dumps(diploma_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_file_hash(file_bytes: bytes) -> str:
    """Hash SHA-256 d'un fichier binaire (PDF du diplôme)."""
    return hashlib.sha256(file_bytes).hexdigest()


def verify_diploma_hash(diploma_data: dict, stored_hash: str) -> bool:
    """
    Vérifie l'intégrité d'un diplôme en comparant
    son hash recalculé avec le hash stocké/ancré.
    Utilise hmac.compare_digest pour prévenir les timing attacks.
    """
    computed = compute_diploma_hash(diploma_data)
    return hmac.compare_digest(computed, stored_hash)


# ─────────────────────────────────────────────────────────────────────────────
# CHIFFREMENT DES DONNÉES SENSIBLES (Fernet = AES-128-CBC + HMAC-SHA256)
# ─────────────────────────────────────────────────────────────────────────────

def encrypt_sensitive(plain_text: str) -> str:
    """Chiffre une chaîne sensible. Retourne bytes encodé en base64."""
    return _fernet.encrypt(plain_text.encode()).decode()


def decrypt_sensitive(cipher_text: str) -> str:
    """Déchiffre une chaîne chiffrée."""
    return _fernet.decrypt(cipher_text.encode()).decode()


# ─────────────────────────────────────────────────────────────────────────────
# TOKENS DE VÉRIFICATION (email, invitations)
# ─────────────────────────────────────────────────────────────────────────────

def generate_secure_token(nbytes: int = 32) -> str:
    """Génère un token URL-safe sécurisé pour vérifications."""
    return secrets.token_urlsafe(nbytes)
