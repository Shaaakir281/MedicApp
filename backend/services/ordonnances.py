"""Helpers to build richly formatted ordonnance contexts for PDF generation."""

from __future__ import annotations

import base64
import io
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import segno

from core.config import get_settings

_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

DEFAULT_PRACTITIONER = {
    "full_name": "Dr Ariel Benhamou",
    "specialty": "Chirurgie pediatrique & actes rituels",
    "license": "RPPS 1045 321 897",
    "adeli": "Adeli 75 1 23456 7",
    "phone": "+33 1 86 95 00 00",
    "email": "contact@cabinet-rituel.fr",
    "website": "www.cabinet-rituel.fr",
}

DEFAULT_CLINIC = {
    "name": "Cabinet Medical Saint-Antoine",
    "address_lines": [
        "12 rue des Saules",
        "75011 Paris",
        "France",
    ],
    "city": "Paris",
    "phone": "+33 1 86 95 00 00",
    "hours": "Consultations du lundi au vendredi  8h30 / 19h30",
}

DEFAULT_INSTRUCTION_LINES = [
    "Acheter l'ensemble du materiel au plus tard 48 h avant l'intervention et conserver les dispositifs steriles fermes.",
    "Realiser une toilette soigneuse avec antiseptique la veille et le matin de l'acte.",
    "Respecter la posologie des antalgiques adaptee au poids de l'enfant ; ne pas depasser 4 prises par 24 h.",
    "Surveiller la plaie : rougeur anormale, saignement continu ou fievre >= 38 C necessitent un avis medical rapide.",
    "En cas de doute ou d'effet indesirable, contacter immediatement le praticien via le numero d'astreinte communique.",
]

_DEFAULT_SECURITY_NOTICE = (
    "Document medical confidentiel. Sa diffusion est reservee au patient, a ses representants legaux et aux "
    "professionnels de sante participant a la prise en charge."
)

_SIGNATURE_FALLBACK_SVG = """
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120">
  <rect width="360" height="120" fill="white"/>
  <path d="M40 80 C 80 50, 140 110, 200 70 S 320 40, 320 85" stroke="#0d6efd" stroke-width="5" fill="none" />
  <text x="50" y="95" font-family="Brush Script MT, cursive" font-size="34" fill="#0d6efd">Dr A. Benhamou</text>
</svg>
""".strip()

_STAMP_FALLBACK_SVG = """
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
  <circle cx="90" cy="90" r="82" fill="none" stroke="#0d6efd" stroke-width="6" />
  <text x="90" y="82" font-size="18" font-family="Arial" text-anchor="middle" fill="#0d6efd">Cabinet</text>
  <text x="90" y="105" font-size="18" font-family="Arial" text-anchor="middle" fill="#0d6efd">Saint-Antoine</text>
  <text x="90" y="135" font-size="14" font-family="Arial" text-anchor="middle" fill="#0d6efd">Paris XI</text>
</svg>
""".strip()

_ACT_LINE_LIBRARY = [
    {
        "label": "Antiseptique cutane type Biseptine 250 ml",
        "dosage": "Toilette pre-operatoire + soins biquotidiens pendant 5 jours",
        "notes": "Appliquer genereusement sur compresse sterile avant tout pansement.",
    },
    {
        "label": "Compresses steriles non tissees 5x5 cm",
        "dosage": "10 paquets minimum",
        "notes": "Manipuler avec des gants propres / steriles uniquement.",
    },
    {
        "label": "Pansements compressifs 3x3 cm",
        "dosage": "Prevoir 6 a 8 pieces",
        "notes": "Permettent de maintenir l'hemostase apres les soins.",
    },
    {
        "label": "Paracetamol pediatrique (Doliprane 2,4 %)",
        "dosage": "15 mg/kg par prise (base sur {weight}), toutes les 6 h",
        "notes": "Ne pas depasser 4 prises sur 24 h. Contacter le cabinet en cas de vomissements.",
    },
    {
        "label": "Serum physiologique sterile 0,9 %",
        "dosage": "Flacons unidose x 10",
        "notes": "Nettoyage atraumatique de la zone opere avant antiseptique.",
    },
    {
        "label": "Gants steriles usage unique",
        "dosage": "1 boite de 10 paires",
        "notes": "Utiliser pour tous les soins jusqu'a cicatrisation complete.",
    },
    {
        "label": "Creme cicatrisante type Cicalfate",
        "dosage": "Application fine 2x/jour pendant 7 jours",
        "notes": "A poser apres l'antiseptique une fois la zone parfaitement seche.",
    },
]

_PRECONSULT_LINE_LIBRARY = [
    {
        "label": "Carnet de sante de l'enfant",
        "dosage": "A presenter le jour de la consultation",
        "notes": "Permet de confirmer les vaccinations et les antecedents.",
    },
    {
        "label": "Compte-rendu du pediatre ou medecin traitant",
        "dosage": "Moins de 6 mois",
        "notes": "Aide a evaluer l'aptitude a l'acte et le contexte medical.",
    },
    {
        "label": "Thermometre electronique",
        "dosage": "Verifier l'absence de fievre la veille et le matin meme",
        "notes": "Reporter toute temperature >= 38 C avant de vous deplacer.",
    },
    {
        "label": "Paracetamol pediatrique (Doliprane 2,4 %)",
        "dosage": "15 mg/kg par prise (base sur {weight})",
        "notes": "Uniquement apres avis medical. Ne pas administrer a jeun.",
    },
]


def _format_date(value: Optional[date | datetime | str]) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return value.strftime("%d/%m/%Y")


def _calculate_age(birthdate: Optional[date | datetime]) -> Optional[str]:
    if not birthdate:
        return None
    today = date.today()
    if isinstance(birthdate, datetime):
        birthdate = birthdate.date()
    years = today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))
    months = today.month - birthdate.month - (1 if today.day < birthdate.day else 0)
    if months < 0:
        months += 12
    if years <= 0 and months <= 0:
        return None
    if years == 0:
        return f"{months} mois"
    if months == 0:
        return f"{years} an{'s' if years > 1 else ''}"
    return f"{years} an{'s' if years > 1 else ''} {months} mois"


def _weight_text(weight: Optional[float | int | str]) -> tuple[str, Optional[float]]:
    if isinstance(weight, (int, float)):
        return f"{weight:.1f} kg", float(weight)
    if isinstance(weight, str) and weight.strip():
        return weight.strip(), None
    return "", None


def _render_line_library(kind: Optional[str], weight: Optional[float]) -> List[Dict[str, str]]:
    library = _ACT_LINE_LIBRARY if kind == "act" else _PRECONSULT_LINE_LIBRARY
    rendered: List[Dict[str, str]] = []
    for row in library:
        dosage = row["dosage"]
        if "{weight}" in dosage:
            formatted = f"{weight:.1f} kg" if weight is not None else "le poids actualise de l'enfant"
            dosage = dosage.replace("{weight}", formatted)
        summary = f"{row['label']}  {dosage}"
        rendered.append(
            {
                "label": row["label"],
                "dosage": dosage,
                "notes": row.get("notes") or "",
                "summary": summary,
            }
        )
    return rendered


def _line_items_from_strings(prescriptions: Sequence[str]) -> List[Dict[str, str]]:
    line_items: List[Dict[str, str]] = []
    for line in prescriptions:
        normalized = line.replace(" - ", "  ")
        parts = [part.strip() for part in re.split(r"\s{2,}", normalized) if part.strip()]
        if not parts:
            continue
        label = parts[0]
        dosage = parts[1] if len(parts) > 1 else ""
        notes = parts[2] if len(parts) > 2 else ""
        line_items.append({"label": label, "dosage": dosage, "notes": notes})
    return line_items


def _load_asset_data_uri(filename: str, fallback_svg: str) -> str:
    path = _ASSETS_DIR / filename
    if path.exists():
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        mime = "image/svg+xml" if path.suffix.lower() == ".svg" else "image/png"
        return f"data:{mime};base64,{encoded}"
    encoded = base64.b64encode(fallback_svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def _build_qr_data_uri(payload: str) -> str:
    qr = segno.make(payload, error="h", micro=False)
    buffer = io.BytesIO()
    qr.save(buffer, kind="png", scale=4, border=2)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _split_instructions(text: str) -> List[str]:
    cleaned = text.replace("\r", "\n")
    parts = []
    for raw in cleaned.split("\n"):
        snippet = raw.strip("-• \t")
        if snippet:
            parts.append(snippet)
    return parts


def default_items_for_type(kind: str, weight: Optional[float] = None) -> List[str]:
    """Return the default textual prescription lines for the given appointment type."""
    lines = _render_line_library(kind, weight)
    return [entry["summary"] for entry in lines]


def build_ordonnance_context(
    *,
    patient_name: str,
    patient_birthdate: Optional[date | datetime | str],
    patient_weight: Optional[float | int | str],
    intervention_date: Optional[date | datetime | str],
    prescriptions: Optional[Sequence[str]] = None,
    instructions: Optional[str] = None,
    appointment_type: Optional[str] = None,
    reference: str,
    verification_url: Optional[str] = None,
    guardian_name: Optional[str] = None,
    guardian_email: Optional[str] = None,
    issued_at: Optional[datetime] = None,
    qr_caption: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Assemble the context required by the ordonnance template."""
    issued = issued_at or datetime.utcnow()
    weight_text, weight_value = _weight_text(patient_weight)
    practitioner = DEFAULT_PRACTITIONER
    clinic = DEFAULT_CLINIC

    if prescriptions:
        line_items = _line_items_from_strings(prescriptions)
    else:
        rendered = _render_line_library(appointment_type, weight_value)
        line_items = rendered
        prescriptions = [entry["summary"] for entry in rendered]

    instructions_text = instructions or "\n".join(DEFAULT_INSTRUCTION_LINES)
    instructions_list = _split_instructions(instructions_text) or DEFAULT_INSTRUCTION_LINES

    settings = get_settings()
    verification_target = verification_url or f"{settings.app_base_url.rstrip('/')}/ordonnances/{reference}"
    qr_data_uri = _build_qr_data_uri(verification_target)

    age_label = _calculate_age(patient_birthdate if isinstance(patient_birthdate, (date, datetime)) else None)
    guardian = None
    if guardian_name or guardian_email:
        guardian = {
          "name": guardian_name or "",
          "email": guardian_email or "",
        }

    return {
        "practitioner": {
            "full_name": practitioner["full_name"],
            "specialty": practitioner["specialty"],
            "license": practitioner["license"],
            "adeli": practitioner["adeli"],
            "phone": practitioner["phone"],
            "email": practitioner["email"],
            "website": practitioner["website"],
            "signature_line": practitioner["full_name"],
        },
        "clinic": {
            "name": clinic["name"],
            "address_lines": clinic["address_lines"],
            "city": clinic["city"],
            "phone": clinic["phone"],
            "hours": clinic["hours"],
            "logo_letter": "".join(word[0] for word in clinic["name"].split()[:2]).upper(),
        },
        "patient": {
            "name": patient_name,
            "birthdate": _format_date(patient_birthdate),
            "age": age_label,
            "weight": weight_text,
            "guardian": guardian,
        },
        "appointment": {
            "date": _format_date(intervention_date),
        },
        "ordonnance": {
            "reference": reference,
            "issued_at": issued.strftime("%d/%m/%Y %Hh%M"),
            "valid_until": (issued + timedelta(days=90)).strftime("%d/%m/%Y"),
            "verification_code": reference.replace("ORD-", "")[-6:],
            "page_label": "Page 1 / 1",
        },
        "line_items": line_items,
        "prescriptions": list(prescriptions),
        "instructions": instructions_text,
        "instructions_list": instructions_list,
        "signature_data_uri": _load_asset_data_uri("signature.png", _SIGNATURE_FALLBACK_SVG),
        "stamp_data_uri": _load_asset_data_uri("stamp.png", _STAMP_FALLBACK_SVG),
        "qr_code_data_uri": qr_data_uri,
        "qr_caption": qr_caption or "Scanner pour verifier l'authenticite de ce document.",
        "notes": notes or _DEFAULT_SECURITY_NOTICE,
    }

