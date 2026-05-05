"""
DiplomaChain – Modèles SQLAlchemy (MySQL)
Tables : users, institutions, students, diplomas, verification_logs, revoked_tokens
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# USERS  (admin, institution_manager, student, verifier)
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("admin", "institution", "student", name="user_role"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relations
    institution: Mapped["Institution | None"] = relationship(back_populates="manager", uselist=False)
    student_profile: Mapped["Student | None"] = relationship(back_populates="user", uselist=False , foreign_keys="Student.user_id",)
    verification_logs: Mapped[list["VerificationLog"]] = relationship(back_populates="verifier")

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


# ─────────────────────────────────────────────────────────────────────────────
# INSTITUTIONS
# ─────────────────────────────────────────────────────────────────────────────
class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    manager_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    accreditation_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    public_key_hedera: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Compte Hedera dédié
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Relations
    manager: Mapped["User"] = relationship(back_populates="institution")
    diplomas: Mapped[list["Diploma"]] = relationship(back_populates="institution")
    template: Mapped["DiplomaTemplate | None"] = relationship(back_populates="institution", uselist=False)

    def __repr__(self):
        return f"<Institution {self.name}>"

class DiplomaTemplate(Base):
    __tablename__ = "diploma_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), unique=True)
    
    # Fichier template
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # Coordonnées des champs (stockées en JSON)
    field_positions: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    
    # Dimensions du PDF
    page_width: Mapped[float] = mapped_column(nullable=False, default=842.0)   # A4 landscape
    page_height: Mapped[float] = mapped_column(nullable=False, default=595.0)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    institution: Mapped["Institution"] = relationship(back_populates="template")
# ─────────────────────────────────────────────────────────────────────────────
# STUDENTS
# ─────────────────────────────────────────────────────────────────────────────
class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    # Données personnelles chiffrées en base
    full_name_enc: Mapped[str] = mapped_column(Text, nullable=False)
    national_id_enc: Mapped[str] = mapped_column(Text, nullable=False)
    massar_code_enc: Mapped[str] = mapped_column(Text, nullable=False)
    massar_code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    birth_date_enc: Mapped[str] = mapped_column(String(255), nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="student_profile" , foreign_keys=[user_id],)
    diplomas: Mapped[list["Diploma"]] = relationship(back_populates="student")

    def __repr__(self):
        return f"<Student {self.id}>"


# ─────────────────────────────────────────────────────────────────────────────
# DIPLOMAS
# ─────────────────────────────────────────────────────────────────────────────
class Diploma(Base):
    __tablename__ = "diplomas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    unique_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"))
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id", ondelete="RESTRICT"))

    # Métadonnées du diplôme
    degree_title: Mapped[str] = mapped_column(String(255), nullable=False)
    field_of_study: Mapped[str] = mapped_column(String(255), nullable=False)
    graduation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    honors: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Intégrité
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)   # SHA-256 du contenu
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 du PDF

    # Hedera HCS (Hashgraph Consensus Service)
    hedera_topic_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hedera_sequence_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hedera_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hedera_consensus_timestamp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    blockchain_anchored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Statut
    status: Mapped[str] = mapped_column(
        Enum("pending", "issued", "revoked", name="diploma_status"),
        default="pending",
        nullable=False,
    )
    revocation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relations
    student: Mapped["Student"] = relationship(back_populates="diplomas")
    institution: Mapped["Institution"] = relationship(back_populates="diplomas")
    verification_logs: Mapped[list["VerificationLog"]] = relationship(back_populates="diploma")

    __table_args__ = (
        Index("ix_diploma_status", "status"),
        Index("ix_diploma_institution", "institution_id"),
    )

    def __repr__(self):
        return f"<Diploma {self.unique_code} [{self.status}]>"


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICATION LOGS  (audit trail immuable)
# ─────────────────────────────────────────────────────────────────────────────
class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    diploma_id: Mapped[str] = mapped_column(ForeignKey("diplomas.id", ondelete="RESTRICT"))
    verifier_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verifier_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    result: Mapped[str] = mapped_column(
        Enum("valid", "invalid", "revoked", "not_found", name="verification_result"),
        nullable=False,
    )
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relations
    diploma: Mapped["Diploma"] = relationship(back_populates="verification_logs")
    verifier: Mapped["User | None"] = relationship(back_populates="verification_logs")

    def __repr__(self):
        return f"<VerificationLog {self.diploma_id} → {self.result}>"


# ─────────────────────────────────────────────────────────────────────────────
# REVOKED TOKENS  (liste noire JWT)
# ─────────────────────────────────────────────────────────────────────────────
class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_revoked_expires", "expires_at"),
    )

    def __repr__(self):
        return f"<RevokedToken {self.jti}>"
