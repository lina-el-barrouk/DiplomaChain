"""
DiplomaChain – Service métier des diplômes
Création, émission, révocation, vérification
"""
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import compute_diploma_hash, compute_file_hash, encrypt_sensitive
from app.models.models import Diploma, Institution, Student, VerificationLog
from app.schemas.diploma import DiplomaCreate
from app.services.hedera_service import hedera_service


# ─────────────────────────────────────────────────────────────────────────────
# GÉNÉRATION D'UN CODE UNIQUE INFALSIFIABLE
# ─────────────────────────────────────────────────────────────────────────────

def generate_unique_code() -> str:
    """
    Génère un identifiant unique de diplôme de 16 caractères
    alphanumériques majuscules (résistant aux confusions visuelles).
    Exemple : DC-3X9K-2PLM-7QWR
    """
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    raw = "".join(secrets.choice(alphabet) for _ in range(12))
    return f"DC-{raw[:4]}-{raw[4:8]}-{raw[8:]}"


# ─────────────────────────────────────────────────────────────────────────────
# CRÉATION D'UN DIPLÔME (statut pending)
# ─────────────────────────────────────────────────────────────────────────────

def create_diploma(db: Session, data: DiplomaCreate, institution_id: str, file_bytes: bytes | None = None) -> Diploma:
    
    # Vérifier que l'étudiant est approuvé par l'admin
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise ValueError("Étudiant introuvable")
    if not student.is_approved:
        raise ValueError("Le profil de cet étudiant n'a pas encore été validé par l'admin")

    # Garder le unique_code — il est indispensable
    unique_code = generate_unique_code()

   # Normaliser la date pour le hash — supprimer le fuseau horaire
    grad_date_str = data.graduation_date.replace(tzinfo=None).isoformat()

    diploma_data = {
    "unique_code": unique_code,
    "student_id": data.student_id,
    "institution_id": institution_id,
    "degree_title": data.degree_title,
    "field_of_study": data.field_of_study,
    "graduation_date": grad_date_str,
    "honors": data.honors,
     }
    diploma = Diploma(
        unique_code=unique_code,
        student_id=data.student_id,
        institution_id=institution_id,
        degree_title=data.degree_title,
        field_of_study=data.field_of_study,
        graduation_date=data.graduation_date,
        honors=data.honors,
        content_hash=compute_diploma_hash(diploma_data),
        file_hash=compute_file_hash(file_bytes) if file_bytes else None,
        status="pending",
    )
    db.add(diploma)
    db.commit()
    db.refresh(diploma)
    return diploma


# ─────────────────────────────────────────────────────────────────────────────
# ÉMISSION OFFICIELLE + ANCRAGE HEDERA
# ─────────────────────────────────────────────────────────────────────────────

async def issue_diploma(db: Session, diploma_id: str, institution_id: str) -> Diploma:
    """
    Passe le diplôme en statut 'issued' et l'ancre sur Hedera HCS.
    Seul l'établissement propriétaire peut émettre.
    """
    diploma = (
        db.query(Diploma)
        .filter(Diploma.id == diploma_id, Diploma.institution_id == institution_id)
        .first()
    )
    if not diploma:
        raise ValueError("Diplôme introuvable ou accès refusé")
    if diploma.status != "pending":
        raise ValueError(f"Le diplôme est déjà en statut '{diploma.status}'")

    # Ancrage sur Hedera
    anchor = await hedera_service.anchor_diploma(
        diploma_id=diploma.id,
        content_hash=diploma.content_hash,
        institution_id=diploma.institution_id,
        degree_title=diploma.degree_title,
        graduation_date=diploma.graduation_date.isoformat(),
    )

    if anchor.success:
        diploma.hedera_topic_id = anchor.transaction_id and settings_topic()
        diploma.hedera_transaction_id = anchor.transaction_id
        diploma.hedera_sequence_number = anchor.sequence_number
        diploma.hedera_consensus_timestamp = anchor.consensus_timestamp
        diploma.blockchain_anchored = True
    else:
        # On émet quand même (fail-open), l'ancrage peut être retenté
        diploma.blockchain_anchored = False

    diploma.status = "issued"
    diploma.issued_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(diploma)
    return diploma


async def anchor_on_hedera(db: Session, diploma_id: str, institution_id: str) -> Diploma:
    """
    Ancre rétroactivement sur Hedera un diplôme déjà émis (blockchain_anchored=False).
    Cas typique : diplômes générés en masse avec l'ancienne version du code.
    """
    diploma = (
        db.query(Diploma)
        .filter(Diploma.id == diploma_id, Diploma.institution_id == institution_id)
        .first()
    )
    if not diploma:
        raise ValueError("Diplôme introuvable ou accès refusé")
    if diploma.status != "issued":
        raise ValueError(f"Seuls les diplômes émis peuvent être ancrés (statut actuel : '{diploma.status}')")
    if diploma.blockchain_anchored:
        raise ValueError("Ce diplôme est déjà ancré sur Hedera")

    # Ancrage sur Hedera
    anchor = await hedera_service.anchor_diploma(
        diploma_id=diploma.id,
        content_hash=diploma.content_hash,
        institution_id=diploma.institution_id,
        degree_title=diploma.degree_title,
        graduation_date=diploma.graduation_date.isoformat(),
    )

    if not anchor.success:
        raise ValueError(f"L'ancrage Hedera a échoué : {getattr(anchor, 'error', 'erreur inconnue')}")

    diploma.hedera_topic_id = settings_topic()
    diploma.hedera_transaction_id = anchor.transaction_id
    diploma.hedera_sequence_number = anchor.sequence_number
    diploma.hedera_consensus_timestamp = anchor.consensus_timestamp
    diploma.blockchain_anchored = True
    db.commit()
    db.refresh(diploma)
    return diploma


def settings_topic():
    from app.core.config import settings
    return settings.HEDERA_TOPIC_ID


# ─────────────────────────────────────────────────────────────────────────────
# RÉVOCATION
# ─────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
# RÉVOCATION
# ─────────────────────────────────────────────────────────────────────────────

def revoke_diploma(
    db: Session,
    diploma_id: str,
    institution_id: str,
    reason: str,
) -> Diploma:
    """Révoque un diplôme. La révocation est consignée et irréversible."""
    diploma = (
        db.query(Diploma)
        .filter(Diploma.id == diploma_id, Diploma.institution_id == institution_id)
        .first()
    )
    if not diploma:
        raise ValueError("Diplôme introuvable ou accès refusé")
    if diploma.status == "revoked":
        raise ValueError("Ce diplôme est déjà révoqué")

    diploma.status = "revoked"
    diploma.revocation_reason = reason
    diploma.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(diploma)
    return diploma


# ─────────────────────────────────────────────────────────────────────────────
# VÉRIFICATION PUBLIQUE
# ─────────────────────────────────────────────────────────────────────────────

async def verify_diploma(
    db: Session,
    unique_code: str,
    verifier_id: str | None = None,
    verifier_ip: str | None = None,
) -> dict:
    """
    Vérifie l'authenticité d'un diplôme :
    1. Cherche en base par code unique
    2. Vérifie le hash d'intégrité
    3. Vérifie l'ancrage Hedera (si disponible)
    4. Journalise le résultat
    """
    diploma = db.query(Diploma).filter(Diploma.unique_code == unique_code).first()

    if not diploma:
        _log_verification(db, None, verifier_id, verifier_ip, "not_found")
        return {"valid": False, "reason": "Diplôme introuvable"}

    if diploma.status == "revoked":
        _log_verification(db, diploma.id, verifier_id, verifier_ip, "revoked")
        return {
            "valid": False,
            "reason": "Ce diplôme a été révoqué",
            "revoked_at": diploma.revoked_at,
            "revocation_reason": diploma.revocation_reason,
        }

    if diploma.status != "issued":
        _log_verification(db, diploma.id, verifier_id, verifier_ip, "invalid")
        return {"valid": False, "reason": "Diplôme non encore émis"}

    # Vérification du hash local
    diploma_data = {
        "unique_code": diploma.unique_code,
        "student_id": diploma.student_id,
        "institution_id": diploma.institution_id,
        "degree_title": diploma.degree_title,
        "field_of_study": diploma.field_of_study,
        "graduation_date": diploma.graduation_date.isoformat(),
        "honors": diploma.honors,
    }
    from app.core.security import verify_diploma_hash
    integrity_ok = verify_diploma_hash(diploma_data, diploma.content_hash)

    # Vérification Hedera (si ancré)
    hedera_result = None
    if diploma.blockchain_anchored and diploma.hedera_sequence_number:
        hedera_result = await hedera_service.verify_on_hedera(
            diploma_id=diploma.id,
            expected_hash=diploma.content_hash,
            sequence_number=diploma.hedera_sequence_number,
        )

    result = "valid" if integrity_ok else "invalid"
    _log_verification(db, diploma.id, verifier_id, verifier_ip, result)

    # Déchiffrer le nom de l'étudiant côté serveur — seul le nom affiché est exposé
    student_name = None
    student = db.query(Student).filter(Student.id == diploma.student_id).first()
    if student:
        try:
            from app.core.security import decrypt_sensitive
            student_name = decrypt_sensitive(student.full_name_enc)
        except Exception:
            student_name = None  # Échec silencieux — ne pas bloquer la vérification

    return {
        "valid": integrity_ok,
        "diploma_id": diploma.id,
        "unique_code": diploma.unique_code,
        "student_name": student_name,   # Nom uniquement — pas d'email ni d'ID sensible
        "degree_title": diploma.degree_title,
        "field_of_study": diploma.field_of_study,
        "graduation_date": diploma.graduation_date,
        "honors": diploma.honors,
        "institution_id": diploma.institution_id,
        "issued_at": diploma.issued_at,
        "blockchain_anchored": diploma.blockchain_anchored,
        "hedera_transaction_id": diploma.hedera_transaction_id,
        "hedera_consensus_timestamp": diploma.hedera_consensus_timestamp,
        "hedera_verified": hedera_result.valid if hedera_result else None,
    }


def _log_verification(
    db: Session,
    diploma_id: str | None,
    verifier_id: str | None,
    verifier_ip: str | None,
    result: str,
):
    if diploma_id:
        log = VerificationLog(
            diploma_id=diploma_id,
            verifier_id=verifier_id,
            verifier_ip=verifier_ip,
            result=result,
        )
        db.add(log)
        db.commit()
