"""
DiplomaChain – Celery Worker
Tâches asynchrones :
- Envoi d'emails (vérification, notification diplôme)
- Ré-ancrage Hedera en cas d'échec
- Nettoyage automatique des tokens expirés
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Celery App ────────────────────────────────────────────────────────────────
celery_app = Celery(
    "diplomachain",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,                # Acquittement après exécution (fiabilité)
    worker_prefetch_multiplier=1,       # Un seul message à la fois par worker
    task_reject_on_worker_lost=True,
    # Retry automatique avec backoff exponentiel
    task_autoretry_for=(Exception,),
    task_max_retries=3,
    task_default_retry_delay=60,
)

# ── Tâches planifiées (Celery Beat) ──────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Nettoyage des tokens révoqués expirés — tous les jours à 2h
    "cleanup-revoked-tokens": {
        "task": "app.worker.cleanup_expired_tokens",
        "schedule": crontab(hour=2, minute=0),
    },
    # Retry des ancrages Hedera en échec — toutes les heures
    "retry-failed-anchors": {
        "task": "app.worker.retry_failed_hedera_anchors",
        "schedule": crontab(minute=0),
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# EMAILS
# ─────────────────────────────────────────────────────────────────────────────

def _send_smtp(to: str, subject: str, html_body: str):
    """Envoie un email via SMTP avec TLS."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"DiplomaChain <{settings.SMTP_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to, msg.as_string())


@celery_app.task(name="app.worker.send_verification_email", bind=True, max_retries=3)
def send_verification_email(self, email: str, token: str):
    """Envoie l'email de vérification de compte."""
    verify_url = f"https://diplomachain.app/auth/verify-email/{token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Vérifiez votre adresse email</h2>
      <p>Merci de vous être inscrit sur DiplomaChain.</p>
      <p>Cliquez sur le lien ci-dessous pour activer votre compte :</p>
      <a href="{verify_url}"
         style="background:#2563eb;color:white;padding:12px 24px;
                border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
        Vérifier mon email
      </a>
      <p style="color:#6b7280;font-size:12px;">
        Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
      </p>
    </div>
    """
    try:
        _send_smtp(email, "Vérifiez votre adresse email – DiplomaChain", html)
        logger.info(f"Email de vérification envoyé à {email}")
    except Exception as exc:
        logger.error(f"Échec envoi email à {email}: {exc}")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@celery_app.task(name="app.worker.send_diploma_issued_email", bind=True, max_retries=3)
def send_diploma_issued_email(
    self,
    student_email: str,
    student_name: str,
    degree_title: str,
    institution_name: str,
    unique_code: str,
):
    """Notifie l'étudiant que son diplôme a été émis et ancré sur Hedera."""
    verify_url = f"https://diplomachain.app/verify/{unique_code}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">🎓 Votre diplôme a été émis !</h2>
      <p>Bonjour <strong>{student_name}</strong>,</p>
      <p>
        <strong>{institution_name}</strong> vient d'émettre officiellement votre diplôme
        <em>{degree_title}</em> et de l'ancrer sur la blockchain <strong>Hedera Hashgraph</strong>.
      </p>
      <p><strong>Code unique :</strong> <code>{unique_code}</code></p>
      <a href="{verify_url}"
         style="background:#16a34a;color:white;padding:12px 24px;
                border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
        Vérifier mon diplôme
      </a>
      <p style="color:#6b7280;font-size:12px;">
        Ce lien de vérification est public et peut être partagé avec des recruteurs.
      </p>
    </div>
    """
    try:
        _send_smtp(student_email, f"Votre diplôme {degree_title} a été émis – DiplomaChain", html)
        logger.info(f"Email diplôme émis envoyé à {student_email}")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=120)


# ─────────────────────────────────────────────────────────────────────────────
# RÉ-ANCRAGE HEDERA (retry en cas d'échec initial)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.worker.retry_failed_hedera_anchors")
def retry_failed_hedera_anchors():
    """
    Tâche planifiée : récupère les diplômes émis mais non ancrés sur Hedera
    et tente de les ancrer à nouveau.
    """
    from app.db.database import SessionLocal
    from app.models.models import Diploma
    from app.services.hedera_service import hedera_service

    db = SessionLocal()
    try:
        unanchored = (
            db.query(Diploma)
            .filter(Diploma.status == "issued", Diploma.blockchain_anchored == False)
            .limit(50)
            .all()
        )

        logger.info(f"[RETRY] {len(unanchored)} diplômes non ancrés trouvés")

        for diploma in unanchored:
            result = asyncio.run(
                hedera_service.anchor_diploma(
                    diploma_id=diploma.id,
                    content_hash=diploma.content_hash,
                    institution_id=diploma.institution_id,
                    degree_title=diploma.degree_title,
                    graduation_date=diploma.graduation_date.isoformat(),
                )
            )
            if result.success:
                diploma.hedera_transaction_id = result.transaction_id
                diploma.hedera_sequence_number = result.sequence_number
                diploma.hedera_consensus_timestamp = result.consensus_timestamp
                diploma.blockchain_anchored = True
                logger.info(f"[RETRY] Diplôme {diploma.id} ancré → tx:{result.transaction_id}")

        db.commit()
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# NETTOYAGE DES TOKENS EXPIRÉS
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.worker.cleanup_expired_tokens")
def cleanup_expired_tokens():
    """Supprime les tokens JWT révoqués dont la date d'expiration est passée."""
    from datetime import datetime, timezone

    from app.db.database import SessionLocal
    from app.models.models import RevokedToken

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        deleted = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
        db.commit()
        logger.info(f"[CLEANUP] {deleted} tokens expirés supprimés")
        return {"deleted": deleted}
    finally:
        db.close()
