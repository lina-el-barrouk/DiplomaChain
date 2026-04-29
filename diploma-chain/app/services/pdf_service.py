"""
DiplomaChain – Service de génération PDF
Système de placeholders : l'institution crée son design avec des zones
de texte nommées que le backend remplace automatiquement.

Placeholders supportés :
    {{NOM_ETUDIANT}}    → Nom complet de l'étudiant
    {{TITRE_DIPLOME}}   → Titre du diplôme
    {{DOMAINE}}         → Domaine d'études
    {{INSTITUTION}}     → Nom de l'institution
    {{DATE}}            → Date de graduation
    {{MENTION}}         → Mention obtenue
    {{CODE}}            → Code unique du diplôme
    {{QR_CODE}}         → QR code (inséré automatiquement à cet emplacement)
"""
import io
import os
from pathlib import Path
from datetime import datetime

import fitz  # pymupdf
from PIL import Image

from app.services.qr_service import generate_qr_code_bytes

STORAGE_DIR = Path("storage")
TEMPLATES_DIR = STORAGE_DIR / "templates"
GENERATED_DIR = STORAGE_DIR / "generated"

TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

# Mapping placeholder → valeur
PLACEHOLDERS = {
    "{{NOM_ETUDIANT}}":  "student_name",
    "{{TITRE_DIPLOME}}": "degree_title",
    "{{DOMAINE}}":       "field_of_study",
    "{{INSTITUTION}}":   "institution_name",
    "{{DATE}}":          "graduation_date",
    "{{MENTION}}":       "honors",
    "{{CODE}}":          "unique_code",
}


def generate_diploma_pdf(
    diploma_data: dict,
    student_name: str,
    institution_name: str,
    template_path: str | None = None,
    **kwargs,
) -> bytes:
    """
    Génère le PDF final du diplôme.
    - Avec template : remplace les placeholders dans le PDF de l'institution
    - Sans template : génère un diplôme élégant par défaut
    """
    # Préparer les valeurs de remplacement
    grad_date = diploma_data.get("graduation_date")
    if grad_date:
        if hasattr(grad_date, "strftime"):
            date_str = grad_date.strftime("%d/%m/%Y")
        else:
            date_str = str(grad_date)[:10]
    else:
        date_str = ""

    values = {
        "student_name":  student_name,
        "degree_title":  diploma_data.get("degree_title", ""),
        "field_of_study": diploma_data.get("field_of_study", ""),
        "institution_name": institution_name,
        "graduation_date": date_str,
        "honors":        diploma_data.get("honors", ""),
        "unique_code":   diploma_data.get("unique_code", ""),
    }

    unique_code = diploma_data.get("unique_code", "")

    if template_path and os.path.exists(template_path):
        return _fill_template(template_path, values, unique_code)
    else:
        return _generate_default_pdf(values, unique_code)


def _fill_template(template_path: str, values: dict, unique_code: str) -> bytes:
    doc = fitz.open(template_path)

    for page in doc:
        blocks = page.get_text("dict")["blocks"]

        for placeholder, key in PLACEHOLDERS.items():
            value = values.get(key, "")
            if not value:
                value = ""

            instances = page.search_for(placeholder)
            if not instances:
                continue

            for inst in instances:
                color, font_size, font_name = _get_text_properties(blocks, inst)

                # Détecter la couleur de fond à cet endroit
                bg_color = _get_background_color(page, inst)

                # Couvrir avec la couleur de fond exacte
                page.draw_rect(inst, color=bg_color, fill=bg_color)

                # Écrire la valeur
                page.insert_text(
                    (inst.x0, inst.y1 - 2),
                    value,
                    fontsize=font_size,
                    color=color,
                )

        # QR Code
        qr_instances = page.search_for("{{QR_CODE}}")
        if qr_instances and unique_code:
            for inst in qr_instances:
                bg_color = _get_background_color(page, inst)
                page.draw_rect(inst, color=bg_color, fill=bg_color)
                _insert_qr_on_page(page, unique_code, inst.x0, inst.y0, size=80)
        elif unique_code:
            rect = page.rect
            _insert_qr_on_page(page, unique_code, rect.width - 100, 20, size=80)

    buffer = io.BytesIO()
    doc.save(buffer)
    doc.close()
    buffer.seek(0)
    return buffer.getvalue()


def _get_text_properties(blocks: list, rect) -> tuple:
    """
    Cherche dans les blocs de texte les propriétés (couleur, taille, police)
    du texte qui se trouve dans le rectangle donné.
    Retourne (color, font_size, font_name).
    """
    default_color = (0.3, 0.3, 0.5)  # Bleu-gris par défaut
    default_size = 12.0
    default_font = "Helvetica"

    for block in blocks:
        if block.get("type") != 0:  # 0 = bloc texte
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                span_rect = fitz.Rect(span["bbox"])
                if span_rect.intersects(fitz.Rect(rect)):
                    # Convertir la couleur de int vers tuple RGB (0-1)
                    color_int = span.get("color", 0)
                    r = ((color_int >> 16) & 0xFF) / 255
                    g = ((color_int >> 8) & 0xFF) / 255
                    b = (color_int & 0xFF) / 255
                    return (r, g, b), span.get("size", default_size), span.get("font", default_font)

    return default_color, default_size, default_font

def _get_font_size_for_placeholder(placeholder: str) -> float:
    """Taille de police selon le type de champ."""
    sizes = {
        "{{NOM_ETUDIANT}}":  22,
        "{{TITRE_DIPLOME}}": 16,
        "{{DOMAINE}}":       14,
        "{{INSTITUTION}}":   12,
        "{{DATE}}":          12,
        "{{MENTION}}":       13,
        "{{CODE}}":          9,
        "{{QR_CODE}}":       10,
    }
    return sizes.get(placeholder, 12)


def _insert_qr_on_page(page, unique_code: str, x: float, y: float, size: int = 80):
    """Insère le QR code sur la page PDF."""
    qr_bytes = generate_qr_code_bytes(unique_code)
    qr_image = Image.open(io.BytesIO(qr_bytes))

    # Convertir en bytes PNG pour PyMuPDF
    img_buffer = io.BytesIO()
    qr_image.save(img_buffer, format="PNG")
    img_buffer.seek(0)

    rect = fitz.Rect(x, y, x + size, y + size)
    page.insert_image(rect, stream=img_buffer.getvalue())


def _generate_default_pdf(values: dict, unique_code: str) -> bytes:
    """
    Génère un diplôme élégant par défaut avec ReportLab
    quand l'institution n'a pas de template.
    """
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    width, height = 842.0, 595.0  # A4 paysage
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(width, height))

    # ── Fond blanc ────────────────────────────────────────────
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(0, 0, width, height, fill=True, stroke=False)

    # ── Bordures dorées ───────────────────────────────────────
    c.setStrokeColor(HexColor("#C9A84C"))
    c.setLineWidth(4)
    c.rect(15, 15, width - 30, height - 30, fill=False, stroke=True)
    c.setLineWidth(1.5)
    c.rect(22, 22, width - 44, height - 44, fill=False, stroke=True)

    # ── Bandeau supérieur ─────────────────────────────────────
    c.setFillColor(HexColor("#1a1a2e"))
    c.rect(15, height - 80, width - 30, 65, fill=True, stroke=False)
    c.setFillColor(HexColor("#C9A84C"))
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width / 2, height - 52, "DIPLÔME")

    # ── Nom institution ───────────────────────────────────────
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#AAAAAA"))
    c.drawCentredString(width / 2, height - 68, values.get("institution_name", ""))

    # ── Ligne décorative ─────────────────────────────────────
    c.setStrokeColor(HexColor("#C9A84C"))
    c.setLineWidth(0.8)
    c.line(100, height - 88, width - 100, height - 88)

    # ── Texte introductif ────────────────────────────────────
    c.setFont("Helvetica", 12)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(width / 2, 370, "Nous certifions que")

    # ── Nom étudiant ─────────────────────────────────────────
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(HexColor("#1a1a2e"))
    c.drawCentredString(width / 2, 320, values.get("student_name", ""))

    # ── Ligne sous le nom ────────────────────────────────────
    c.setStrokeColor(HexColor("#C9A84C"))
    c.setLineWidth(0.8)
    c.line(200, 308, width - 200, 308)

    # ── Texte intermédiaire ──────────────────────────────────
    c.setFont("Helvetica", 12)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(width / 2, 288, "a obtenu le diplôme de")

    # ── Titre diplôme ────────────────────────────────────────
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(HexColor("#2c3e50"))
    c.drawCentredString(width / 2, 258, values.get("degree_title", ""))

    # ── Domaine ──────────────────────────────────────────────
    c.setFont("Helvetica", 15)
    c.setFillColor(HexColor("#2c3e50"))
    c.drawCentredString(width / 2, 230, values.get("field_of_study", ""))

    # ── Mention ──────────────────────────────────────────────
    mention = values.get("honors", "")
    if mention:
        c.setFont("Helvetica-Oblique", 14)
        c.setFillColor(HexColor("#c0392b"))
        c.drawCentredString(width / 2, 200, f"Mention : {mention}")

    # ── Date ─────────────────────────────────────────────────
    c.setFont("Helvetica", 12)
    c.setFillColor(HexColor("#777777"))
    c.drawCentredString(width / 2, 170, f"Délivré le {values.get('graduation_date', '')}")

    # ── Bandeau inférieur ────────────────────────────────────
    c.setFillColor(HexColor("#f8f9fa"))
    c.rect(15, 15, width - 30, 60, fill=True, stroke=False)

    # ── Code unique ──────────────────────────────────────────
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#999999"))
    c.drawCentredString(width / 2, 45, f"Code de vérification : {values.get('unique_code', '')}")
    c.drawCentredString(width / 2, 30, "Vérifiez l'authenticité sur : http://localhost:8000/api/v1/diplomas/verify/")

    # ── QR Code ──────────────────────────────────────────────
    if unique_code:
        qr_bytes = generate_qr_code_bytes(unique_code)
        qr_image = Image.open(io.BytesIO(qr_bytes))
        qr_reader = ImageReader(qr_image)
        c.drawImage(qr_reader, width - 120, 20, width=85, height=85)

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


def save_template_file(file_bytes: bytes, institution_id: str, filename: str) -> str:
    safe_name = f"{institution_id}_{filename}"
    file_path = TEMPLATES_DIR / safe_name
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    return str(file_path)

def save_generated_pdf(pdf_bytes: bytes, diploma_id: str) -> str:
    file_path = GENERATED_DIR / f"{diploma_id}.pdf"
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
    return str(file_path)

def _get_background_color(page, rect) -> tuple:
    """
    Détecte la couleur de fond à l'endroit du rectangle.
    Retourne un tuple RGB (0-1).
    """
    try:
        # Convertir la page en image pixmap et lire la couleur du pixel central
        clip = fitz.Rect(rect)
        mat = fitz.Matrix(1, 1)
        pix = page.get_pixmap(matrix=mat, clip=clip, colorspace=fitz.csRGB)

        # Lire le pixel au centre
        cx = pix.width // 2
        cy = pix.height // 2

        if pix.width > 0 and pix.height > 0:
            # get_pixel retourne (r, g, b) en 0-255
            pixel = pix.pixel(min(cx, pix.width - 1), min(cy, pix.height - 1))
            return (pixel[0] / 255, pixel[1] / 255, pixel[2] / 255)
    except Exception:
        pass

    # Blanc par défaut
    return (1, 1, 1) 



