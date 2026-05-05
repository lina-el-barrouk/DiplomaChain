"""
DiplomaChain – Schémas Pydantic (validation des requêtes et réponses)
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────
class StudentInfo(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    national_id: str = Field(min_length=4, max_length=50)
    massar_code: str = Field(min_length=5, max_length=50)
    birth_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

class InstitutionInfo(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    country: str = Field(min_length=2, max_length=100)
    
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Literal["institution", "student"]
    student: StudentInfo | None = None
    institution: InstitutionInfo | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        errors = []
        if not any(c.isupper() for c in v): errors.append("une majuscule")
        if not any(c.islower() for c in v): errors.append("une minuscule")
        if not any(c.isdigit() for c in v): errors.append("un chiffre")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v): errors.append("un caractère spécial")
        if errors:
            raise ValueError(f"Le mot de passe doit contenir : {', '.join(errors)}")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


# ─────────────────────────────────────────────────────────────────────────────
# INSTITUTIONS
# ─────────────────────────────────────────────────────────────────────────────

class InstitutionCreate(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    country: str = Field(min_length=2, max_length=100)
    accreditation_number: str = Field(min_length=4, max_length=100)


class InstitutionOut(BaseModel):
    id: str
    name: str
    country: str
    accreditation_number: str
    is_approved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# STUDENTS
# ─────────────────────────────────────────────────────────────────────────────

class StudentBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    national_id: str = Field(min_length=5, max_length=20)
    massar_code: str = Field(min_length=5, max_length=50)
    birth_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    national_id: str = Field(min_length=5, max_length=50)
    massar_code: str = Field(min_length=5, max_length=50)
    birth_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD


class StudentOut(BaseModel):
    id: str
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# DIPLOMAS
# ─────────────────────────────────────────────────────────────────────────────

class DiplomaCreate(BaseModel):
    student_id: str | None = None
    massar_code: str | None = None
    degree_title: str = Field(min_length=3, max_length=255)
    field_of_study: str = Field(min_length=2, max_length=255)
    graduation_date: datetime
    honors: str | None = Field(default=None, max_length=100)


class DiplomaOut(BaseModel):
    id: str
    unique_code: str
    student_id: str
    institution_id: str
    degree_title: str
    field_of_study: str
    graduation_date: datetime
    honors: str | None
    status: str
    blockchain_anchored: bool
    hedera_transaction_id: str | None
    hedera_consensus_timestamp: str | None
    issued_at: datetime | None
    created_at: datetime
    # Champs enrichis (décryptés côté serveur, uniquement pour l'institution propriétaire)
    student_name: str | None = None
    student_email: str | None = None
    student_massar_code: str | None = None

    model_config = {"from_attributes": True}


class DiplomaRevoke(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)


class VerifyResponse(BaseModel):
    valid: bool
    reason: str | None = None
    diploma_id: str | None = None
    unique_code: str | None = None
    student_name: str | None = None   # Nom décrypté côté serveur, jamais l'email ni les données sensibles
    degree_title: str | None = None
    field_of_study: str | None = None
    graduation_date: datetime | None = None
    honors: str | None = None
    institution_id: str | None = None
    issued_at: datetime | None = None
    blockchain_anchored: bool | None = None
    hedera_transaction_id: str | None = None
    hedera_consensus_timestamp: str | None = None
    hedera_verified: bool | None = None
    revoked_at: datetime | None = None
    revocation_reason: str | None = None
