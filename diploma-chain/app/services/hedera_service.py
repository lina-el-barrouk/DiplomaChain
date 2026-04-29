"""
DiplomaChain – Service Hedera Hashgraph
Ancrage des diplômes via Hedera Consensus Service (HCS)

Flux :
  1. L'établissement émet un diplôme → compute_diploma_hash()
  2. On soumet le hash + métadonnées au Topic HCS → anchor_diploma()
  3. On stocke le sequence_number + transaction_id en DB
  4. Pour vérifier → verify_on_hedera() récupère le message HCS et compare
"""
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class HederaAnchorResult:
    success: bool
    transaction_id: str | None = None
    sequence_number: int | None = None
    consensus_timestamp: str | None = None
    error: str | None = None


@dataclass
class HederaVerifyResult:
    found: bool
    content_hash: str | None = None
    diploma_id: str | None = None
    consensus_timestamp: str | None = None
    valid: bool = False
    error: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# CLIENT HEDERA REST MIRROR (sans SDK Python natif complet)
# L'API Mirror Hedera est publique et stable ; pour soumettre des messages
# on utilise l'API REST officielle via httpx.
# ─────────────────────────────────────────────────────────────────────────────

HEDERA_MIRROR_URLS = {
    "testnet": "https://testnet.mirrornode.hedera.com/api/v1",
    "mainnet": "https://mainnode.hedera.com/api/v1",
}

# URL de l'API REST de soumission de transactions Hedera
HEDERA_REST_URLS = {
    "testnet": "https://testnet.mirrornode.hedera.com",
    "mainnet": "https://mainnet.mirrornode.hedera.com",
}


class HederaService:
    """
    Service d'ancrage blockchain via Hedera Consensus Service (HCS).

    En production, utiliser le SDK Hedera Python officiel (hedera-sdk-py)
    ou appeler un microservice Node.js utilisant @hashgraph/sdk.
    Cette implémentation utilise l'API Mirror REST pour la lecture
    et un endpoint de soumission pour l'écriture.
    """

    def __init__(self):
        self.network = settings.HEDERA_NETWORK
        self.operator_id = settings.HEDERA_OPERATOR_ID
        self.operator_key = settings.HEDERA_OPERATOR_PRIVATE_KEY
        self.topic_id = settings.HEDERA_TOPIC_ID
        self.mirror_url = HEDERA_MIRROR_URLS[self.network]

    # ── ANCRAGE ───────────────────────────────────────────────────────────────

    async def anchor_diploma(
        self,
        diploma_id: str,
        content_hash: str,
        institution_id: str,
        degree_title: str,
        graduation_date: str,
    ) -> HederaAnchorResult:
        """
        Soumet un message HCS contenant le hash du diplôme.
        Le message est immuable une fois validé par le réseau.

        Structure du message HCS :
        {
            "type": "DIPLOMA_ISSUANCE",
            "diploma_id": "<uuid>",
            "content_hash": "<sha256>",
            "institution_id": "<uuid>",
            "degree_title": "<titre>",
            "graduation_date": "<ISO-8601>",
            "issued_at": "<ISO-8601 UTC>"
        }
        """
        message_payload = {
            "type": "DIPLOMA_ISSUANCE",
            "diploma_id": diploma_id,
            "content_hash": content_hash,
            "institution_id": institution_id,
            "degree_title": degree_title,
            "graduation_date": graduation_date,
            "issued_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            # ── Utilisation du SDK Hedera via sous-processus Node.js ──────────
            # Dans un déploiement réel, remplacer par :
            #   from hedera import Client, TopicMessageSubmitTransaction, ...
            # Pour la démonstration, on simule l'appel et structure le résultat

            result = await self._submit_hcs_message(json.dumps(message_payload))
            return result

        except Exception as exc:
            logger.error(f"Hedera anchor error for diploma {diploma_id}: {exc}")
            return HederaAnchorResult(success=False, error=str(exc))

    async def _submit_hcs_message(self, message: str) -> HederaAnchorResult:
        """
        Soumet un message au Topic HCS.

        IMPORTANT : La soumission nécessite une signature de la clé opérateur.
        En production, intégrer le SDK Hedera Python :
            pip install hedera-sdk-py   (ou wrapper Node.js)

        Structure de l'appel SDK (pseudocode) :
        ─────────────────────────────────────────
        client = Client.for_testnet()
        client.set_operator(AccountId.from_string(operator_id), PrivateKey.from_string(operator_key))

        receipt = (
            TopicMessageSubmitTransaction()
            .set_topic_id(TopicId.from_string(topic_id))
            .set_message(message)
            .execute(client)
            .get_receipt(client)
        )
        ─────────────────────────────────────────
        """
        # Simulation pour développement/test
        # Remplacer par l'appel SDK réel en production
        import secrets
        import time

        mock_tx_id = f"{self.operator_id}@{int(time.time())}.{secrets.randbelow(1000000)}"
        mock_seq = secrets.randbelow(100000) + 1
        mock_timestamp = f"{int(time.time())}.{secrets.randbelow(1000000000):09d}"

        logger.info(f"[HEDERA] Message soumis au topic {self.topic_id} → tx:{mock_tx_id}")

        return HederaAnchorResult(
            success=True,
            transaction_id=mock_tx_id,
            sequence_number=mock_seq,
            consensus_timestamp=mock_timestamp,
        )

    # ── VÉRIFICATION ──────────────────────────────────────────────────────────

    async def verify_on_hedera(
        self,
        diploma_id: str,
        expected_hash: str,
        sequence_number: int,
    ) -> HederaVerifyResult:
        """
        Récupère le message HCS depuis le Mirror Node et vérifie l'intégrité.
        Le Mirror Node Hedera est public et accessible sans clé API.
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = (
                    f"{self.mirror_url}/topics/{self.topic_id}"
                    f"/messages/{sequence_number}"
                )
                response = await client.get(url)

                if response.status_code == 404:
                    return HederaVerifyResult(found=False, error="Message non trouvé sur Hedera")

                response.raise_for_status()
                data = response.json()

                # Décoder le message base64
                import base64
                raw_message = base64.b64decode(data["message"]).decode("utf-8")
                message_obj = json.loads(raw_message)

                # Vérification du hash
                stored_hash = message_obj.get("content_hash", "")
                import hmac as _hmac
                hash_valid = _hmac.compare_digest(stored_hash, expected_hash)
                id_valid = message_obj.get("diploma_id") == diploma_id

                return HederaVerifyResult(
                    found=True,
                    content_hash=stored_hash,
                    diploma_id=message_obj.get("diploma_id"),
                    consensus_timestamp=data.get("consensus_timestamp"),
                    valid=hash_valid and id_valid,
                )

        except httpx.HTTPError as exc:
            logger.error(f"Hedera mirror query error: {exc}")
            return HederaVerifyResult(found=False, error=str(exc))

    # ── CRÉATION DU TOPIC HCS (setup initial) ─────────────────────────────────

    async def create_topic(self, memo: str = "DiplomaChain Degrees") -> str | None:
        """
        Crée un nouveau Topic HCS pour l'application.
        À exécuter une seule fois lors du déploiement initial.
        Retourne le TopicId créé.
        """
        try:
            logger.info(f"Création du Topic HCS sur {self.network} avec memo: {memo}")
            # Pseudocode SDK :
            # topic_id = (
            #     TopicCreateTransaction()
            #     .set_topic_memo(memo)
            #     .execute(client)
            #     .get_receipt(client)
            #     .topic_id
            # )
            # return str(topic_id)
            return "0.0.NOUVEAU_TOPIC_ID"
        except Exception as exc:
            logger.error(f"Erreur création Topic HCS: {exc}")
            return None


# Singleton
hedera_service = HederaService()
