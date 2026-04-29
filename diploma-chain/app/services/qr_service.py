"""
DiplomaChain – Service QR Code
Génère un QR code pointant vers l'URL de vérification publique.
Le QR code peut être encodé en base64 (pour les API) ou retourné en bytes PNG.
"""
import io
import base64

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask


VERIFICATION_BASE_URL = "http://localhost:8000/api/v1/diplomas/verify"


def generate_qr_code_bytes(unique_code: str) -> bytes:
    """
    Génère un QR code PNG stylisé pour un diplôme.
    Retourne les bytes du fichier PNG.
    """
    url = f"{VERIFICATION_BASE_URL}/{unique_code}"

    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # 30% correction
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(
            front_color=(15, 23, 42),    # Bleu très foncé (slate-900)
            back_color=(255, 255, 255),
        ),
    )

    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_qr_code_base64(unique_code: str) -> str:
    """Retourne le QR code en base64 (pour intégration dans les réponses JSON ou HTML)."""
    png_bytes = generate_qr_code_bytes(unique_code)
    return base64.b64encode(png_bytes).decode("utf-8")


def get_verification_url(unique_code: str) -> str:
    return f"{VERIFICATION_BASE_URL}/{unique_code}"
