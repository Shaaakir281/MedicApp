#!/usr/bin/env python3
"""Script de vérification quotidienne des documents signés.

Usage:
    poetry run python scripts/verify_document_signatures.py

Configuration (.env):
    DOCUMENT_VERIFICATION_RECIPIENT_EMAIL=practitioner@medicapp.fr
    DOCUMENT_VERIFICATION_ENABLED=true
"""
import logging
import sys
from datetime import date

from database import SessionLocal
from core.config import get_settings
from services import email as email_service
from services import storage
from services.document_verification import (
    check_missing_identifiers,
    check_missing_storage_files,
    check_orphaned_yousign_procedures,
    check_stuck_partial_signatures,
    check_artifact_integrity,
)
import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main() -> int:
    """Point d'entrée principal."""
    settings = get_settings()

    # Vérifier si activé
    if not getattr(settings, 'document_verification_enabled', True):
        logger.info("Vérification documents désactivée via config.")
        return 0

    # Récupérer destinataire email
    recipient = getattr(settings, 'document_verification_recipient_email', None)
    if not recipient:
        logger.error("DOCUMENT_VERIFICATION_RECIPIENT_EMAIL non configuré.")
        return 1

    db = SessionLocal()
    storage_backend = storage.get_storage_backend()

    try:
        logger.info("Démarrage vérification quotidienne documents signés...")

        # Exécuter les 5 vérifications
        anomalies = {
            "missing_identifiers": check_missing_identifiers(db),
            "missing_files": check_missing_storage_files(db, storage_backend),
            "orphaned_yousign": check_orphaned_yousign_procedures(db),
            "stuck_partial": check_stuck_partial_signatures(db),
            "corrupted_files": check_artifact_integrity(db, storage_backend),
        }

        total_anomalies = sum(len(v) for v in anomalies.values())

        # Statistiques globales
        total_completed = db.query(models.DocumentSignature).filter(
            models.DocumentSignature.overall_status == models.DocumentSignatureStatus.completed
        ).count()

        total_pending = db.query(models.DocumentSignature).filter(
            models.DocumentSignature.overall_status.in_([
                models.DocumentSignatureStatus.sent,
                models.DocumentSignatureStatus.partially_signed
            ])
        ).count()

        summary = {
            "total_completed": total_completed,
            "total_pending": total_pending,
        }

        # Logger résultats
        logger.info(f"Vérification terminée: {total_anomalies} anomalies détectées")
        logger.info(f"Documents complétés: {total_completed}, En attente: {total_pending}")

        # Envoyer email (même si 0 anomalies - confirme que script a tourné)
        send_daily_report_email(
            recipient=recipient,
            report_date=date.today().strftime("%d/%m/%Y"),
            total_anomalies=total_anomalies,
            anomalies_by_check=anomalies,
            summary=summary,
        )

        logger.info(f"Email de rapport envoyé à {recipient}")
        return 0

    except Exception:
        logger.exception("Erreur lors de la vérification quotidienne")
        return 1
    finally:
        db.close()


def send_daily_report_email(
    recipient: str,
    report_date: str,
    total_anomalies: int,
    anomalies_by_check: dict,
    summary: dict,
):
    """Générer et envoyer le rapport quotidien par email."""
    settings = get_settings()
    app_name = getattr(settings, 'app_name', 'MedicApp')

    subject = f"[{app_name}] Rapport quotidien - Vérification documents signés ({report_date})"

    # Version texte
    text_body = f"""
Bonjour,

Voici le rapport quotidien de vérification des documents signés pour le {report_date}.

RÉSUMÉ
======
Total anomalies détectées : {total_anomalies}
Documents complétés vérifiés : {summary['total_completed']}
Documents en attente : {summary['total_pending']}

ANOMALIES PAR TYPE
==================
1. Identifiants manquants (NULL en DB) : {len(anomalies_by_check['missing_identifiers'])}
2. Fichiers manquants (stockage) : {len(anomalies_by_check['missing_files'])}
3. Procédures Yousign non purgées : {len(anomalies_by_check['orphaned_yousign'])}
4. Signatures partielles bloquées : {len(anomalies_by_check['stuck_partial'])}
5. Intégrité fichiers (PDFs corrompus) : {len(anomalies_by_check['corrupted_files'])}

"""

    if total_anomalies > 0:
        text_body += "\nDÉTAILS DES ANOMALIES\n" + "=" * 50 + "\n\n"

        for check_name, items in anomalies_by_check.items():
            if items:
                text_body += f"\n{check_name.upper()}\n" + "-" * 30 + "\n"
                for item in items[:10]:
                    text_body += f"  - Case #{item['case_id']} | Doc: {item['document_type']} | Sévérité: {item['severity']}\n"
                if len(items) > 10:
                    text_body += f"  ... et {len(items) - 10} autres\n"
    else:
        text_body += "\n✅ Aucune anomalie détectée. Tous les documents sont conformes.\n"

    text_body += f"\n\nL'équipe {app_name}\n"

    # Version HTML
    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">Rapport quotidien - Vérification documents signés</h2>
        <p style="color: #e0e7ff; margin: 5px 0 0 0;"><strong>Date :</strong> {report_date}</p>
    </div>

    <div style="background-color: {'#fee2e2' if total_anomalies > 0 else '#d1fae5'}; padding: 20px; border-left: 4px solid {'#dc2626' if total_anomalies > 0 else '#059669'};">
        <h3 style="margin-top: 0; color: {'#991b1b' if total_anomalies > 0 else '#065f46'};">Résumé</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0;"><strong>Total anomalies :</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 18px; font-weight: bold; color: {'#dc2626' if total_anomalies > 0 else '#059669'};">{total_anomalies}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>Documents complétés vérifiés :</strong></td>
                <td style="padding: 8px 0; text-align: right;">{summary['total_completed']}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>Documents en attente :</strong></td>
                <td style="padding: 8px 0; text-align: right;">{summary['total_pending']}</td>
            </tr>
        </table>
    </div>

    <div style="padding: 20px; background-color: white;">
        <h3 style="color: #1e40af;">Anomalies par type</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #cbd5e1;">Type de vérification</th>
                    <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; width: 100px;">Anomalies</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;">1. Identifiants manquants (NULL en DB)</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">{len(anomalies_by_check['missing_identifiers'])}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;">2. Fichiers manquants (stockage)</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">{len(anomalies_by_check['missing_files'])}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;">3. Procédures Yousign non purgées</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">{len(anomalies_by_check['orphaned_yousign'])}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;">4. Signatures partielles bloquées (&gt;30j)</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">{len(anomalies_by_check['stuck_partial'])}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;">5. Intégrité fichiers (PDFs corrompus)</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">{len(anomalies_by_check['corrupted_files'])}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #64748b; font-size: 12px;">L'équipe {app_name}</p>
    </div>
</body>
</html>
"""

    # Utiliser le service email existant
    email_service.send_email(
        subject=subject,
        to_email=recipient,
        body=text_body,
        html_body=html_body
    )


if __name__ == "__main__":
    sys.exit(main())
