"""Utility helpers for sending transactional e-mails."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from core.config import SMTPSettings, get_settings

logger = logging.getLogger(__name__)


def _smtp_settings() -> SMTPSettings:
    return get_settings().smtp_settings()


def _app_name() -> str:
    return get_settings().app_name


def send_email(subject: str, recipient: str, text_body: str, html_body: str | None = None) -> None:
    """Send an email using the SMTP credentials configured in the environment.

    If SMTP is not configured, the email content is logged instead so that
    developers can still inspect the output in local environments.
    """
    smtp = _smtp_settings()
    if not smtp.is_configured:
        logger.warning("SMTP configuration missing; email to %s was not sent.", recipient)
        logger.info("Subject: %s\nRecipient: %s\n\n%s", subject, recipient, text_body)
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp.sender
    msg["To"] = recipient
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    host = smtp.host
    port = smtp.port
    username = smtp.username
    password = smtp.password
    use_ssl = smtp.use_ssl
    use_tls = smtp.use_tls

    context = ssl.create_default_context()

    def _login(server: smtplib.SMTP) -> None:
        if username and password:
            server.login(username, password)

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            _login(server)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            if use_tls:
                server.starttls(context=context)
            _login(server)
            server.send_message(msg)

    logger.info("Sent email to %s", recipient)


def send_verification_email(recipient: str, verification_link: str) -> None:
    """Send the verification e-mail after registration."""
    app_name = _app_name()
    subject = f"[{app_name}] Vérifiez votre adresse e-mail"
    text_body = (
        f"Bonjour,\n\n"
        f"Merci de vous être inscrit sur {app_name}.\n"
        f"Veuillez confirmer votre adresse e-mail en cliquant sur le lien suivant :\n"
        f"{verification_link}\n\n"
        f"Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Merci de vous être inscrit sur <strong>{app_name}</strong>.</p>
    <p>Veuillez confirmer votre adresse e-mail en cliquant sur le lien suivant :</p>
    <p><a href="{verification_link}">{verification_link}</a></p>
    <p>Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_appointment_confirmation_email(
    recipient: str,
    appointment_date: str,
    appointment_time: str,
) -> None:
    """Send a confirmation email after a patient books an appointment."""
    app_name = _app_name()
    subject = f"[{app_name}] Confirmation de votre rendez-vous"
    text_body = (
        f"Bonjour,\n\n"
        f"Votre rendez-vous a bien été confirmé le {appointment_date} à {appointment_time}.\n"
        f"Nous vous remercions pour votre confiance.\n\n"
        f"L'équipe {app_name}"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Votre rendez-vous a bien été confirmé le <strong>{appointment_date}</strong> à <strong>{appointment_time}</strong>.</p>
    <p>Nous vous remercions pour votre confiance.</p>
    <p>L'équipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_consent_download_email(
    recipient: str,
    child_name: str,
    download_url: str,
) -> None:
    """Send the consent download link for a procedure case."""
    app_name = _app_name()
    subject = f"[{app_name}] Lien de consentement pour {child_name}"
    text_body = (
        f"Bonjour,\n\n"
        f"Le consentement pre-rempli pour {child_name} est disponible au lien suivant :\n"
        f"{download_url}\n\n"
        f"Pensez a le signer avant la procedure.\n"
        f"L'equipe {app_name}\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Le consentement pre-rempli pour <strong>{child_name}</strong> est disponible au lien suivant :</p>
    <p><a href="{download_url}">{download_url}</a></p>
    <p>Pensez a le signer avant la procedure.</p>
    <p>L'equipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_legal_document_download_email(
    recipient: str,
    *,
    child_name: str,
    document_title: str,
    download_url: str,
    is_final: bool = False,
) -> None:
    """Send a legal document download link (base or final)."""
    app_name = _app_name()
    status_label = "document signe" if is_final else "document"
    subject = f"[{app_name}] Lien de telechargement - {document_title}"
    text_body = (
        f"Bonjour,\n\n"
        f"Le {status_label} pour {child_name} est disponible :\n"
        f"{document_title}\n"
        f"{download_url}\n\n"
        f"L'equipe {app_name}\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Le {status_label} pour <strong>{child_name}</strong> est disponible :</p>
    <p><strong>{document_title}</strong></p>
    <p><a href="{download_url}">{download_url}</a></p>
    <p>L'equipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_signature_request_email(
    recipient: str,
    *,
    doc_label: str,
    signature_link: str,
    reference: str | None = None,
) -> None:
    """Send a neutral signature request email without PHI."""
    app_name = _app_name()
    subject = f"[{app_name}] Document medical a signer"
    reference_line = f"Reference : {reference}\n" if reference else ""
    text_body = (
        f"Bonjour,\n\n"
        f"Vous avez un document medical a signer : {doc_label}.\n"
        f"{reference_line}"
        f"Lien de signature securise : {signature_link}\n\n"
        f"L'equipe {app_name}\n"
    )
    reference_html = f"<p><strong>Reference :</strong> {reference}</p>" if reference else ""
    html_body = f"""
    <p>Bonjour,</p>
    <p>Vous avez un document medical a signer : <strong>{doc_label}</strong>.</p>
    {reference_html}
    <p><a href="{signature_link}">{signature_link}</a></p>
    <p>L'equipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_prescription_email(recipient: str, download_url: str, appointment_type: str) -> None:
    """Send an ordonnance download link to the patient."""
    app_name = _app_name()
    is_act = appointment_type == "act"
    subject = f"[{app_name}] Ordonnance pour votre {'acte' if is_act else 'consultation'}"
    reminder = (
        "Merci de vérifier que le consentement signé des deux parents est prêt pour le jour de l'acte."
        if is_act
        else "Merci d'apporter l'ordonnance lors de votre rendez-vous."
    )
    text_body = (
        f"Bonjour,\n\n"
        f"Votre ordonnance est disponible au lien suivant :\n"
        f"{download_url}\n\n"
        f"{reminder}\n"
        f"L'équipe {app_name}\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Votre ordonnance est disponible au lien suivant :</p>
    <p><a href="{download_url}">{download_url}</a></p>
    <p>{reminder}</p>
    <p>L'équipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_prescription_signed_email(
    recipient: str,
    *,
    portal_url: str,
    download_url: str,
    pharmacy_url: str,
) -> None:
    """Send the notification email issued right after the practitioner signs the ordonnance."""
    app_name = _app_name()
    subject = f"[{app_name}] Votre ordonnance signée est disponible"
    text_body = (
        "Bonjour,\n\n"
        "Votre ordonnance vient d'être signée et archivée dans votre dossier patient.\n"
        f"- Consulter / télécharger : {download_url}\n"
        f"- Envoyer à votre pharmacie : {pharmacy_url}\n\n"
        f"Vous pouvez également accéder à votre espace patient : {portal_url}\n\n"
        f"L'équipe {app_name}\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Votre ordonnance vient d'être signée et archivée dans votre dossier patient.</p>
    <ul>
      <li><strong>Consulter / télécharger :</strong> <a href="{download_url}">{download_url}</a></li>
      <li><strong>Envoyer à votre pharmacie :</strong> <a href="{pharmacy_url}">{pharmacy_url}</a></li>
    </ul>
    <p>Accédez à votre espace patient : <a href="{portal_url}">{portal_url}</a></p>
    <p>L'équipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_appointment_reminder_email(
    recipient: str,
    appointment_date: str,
    appointment_type: str,
    reminder_link: str,
) -> None:
    """Send a reminder email ahead of the appointment."""
    app_name = _app_name()
    is_act = appointment_type == "act"
    subject = f"[{app_name}] Rappel rendez-vous du {appointment_date}"
    consent_line = (
        "Merci de vérifier que le consentement signé des deux parents est prêt pour le jour de l'acte."
        if is_act
        else "Pensez à préparer vos documents et venir quelques minutes en avance."
    )
    text_body = (
        f"Bonjour,\n\n"
        f"Votre rendez-vous est prévu le {appointment_date}. {consent_line}\n"
        f"Vous pouvez finaliser les informations manquantes ou consulter les consignes ici :\n{reminder_link}\n\n"
        f"L'équipe {app_name}\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Votre rendez-vous est prévu le <strong>{appointment_date}</strong>.</p>
    <p>{consent_line}</p>
    <p>Complétez vos informations ou relisez les consignes en cliquant sur le lien ci-dessous :</p>
    <p><a href="{reminder_link}">{reminder_link}</a></p>
    <p>L'équipe {app_name}</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_password_reset_email(recipient: str, reset_link: str) -> None:
    """Send a password reset link with spam folder notice."""
    app_name = _app_name()
    subject = f"[{app_name}] Reinitialisation de votre mot de passe"
    spam_hint = "Si vous ne voyez pas l'e-mail, pensez a verifier votre dossier spam."
    text_body = (
        f"Bonjour,\n\n"
        f"Un lien de reinitialisation de mot de passe a ete genere pour votre compte {app_name} :\n"
        f"{reset_link}\n\n"
        f"Ce lien expire dans 60 minutes. {spam_hint}\n"
        f"Si vous n'etes pas a l'origine de cette demande, ignorez simplement ce message.\n"
    )
    html_body = f"""
    <p>Bonjour,</p>
    <p>Un lien de r&eacute;initialisation de mot de passe a &eacute;t&eacute; g&eacute;n&eacute;r&eacute; pour votre compte <strong>{app_name}</strong> :</p>
    <p><a href="{reset_link}">{reset_link}</a></p>
    <p>Ce lien expire dans 60 minutes. {spam_hint}</p>
    <p>Si vous n'&ecirc;tes pas &agrave; l'origine de cette demande, ignorez ce message.</p>
    """
    send_email(subject, recipient, text_body, html_body=html_body)


def send_guardian_verification_email(
    to_email: str,
    guardian_name: str,
    child_name: str,
    verification_link: str,
) -> None:
    """Send email verification link to guardian for dossier completion."""
    app_name = _app_name()
    subject = f"[{app_name}] Vérifiez votre adresse e-mail"
    text_body = (
        f"Bonjour {guardian_name},\n\n"
        f"Dans le cadre du dossier médical de {child_name}, nous avons besoin de vérifier votre adresse e-mail.\n\n"
        f"Veuillez confirmer votre adresse e-mail en cliquant sur le lien suivant :\n"
        f"{verification_link}\n\n"
        f"Ce lien est valide pendant 24 heures.\n\n"
        f"La vérification de votre email permet d'activer la signature électronique à distance.\n\n"
        f"Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.\n\n"
        f"L'équipe {app_name}"
    )
    html_body = f"""
    <p>Bonjour <strong>{guardian_name}</strong>,</p>
    <p>Dans le cadre du dossier médical de <strong>{child_name}</strong>, nous avons besoin de vérifier votre adresse e-mail.</p>
    <p>Veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="{verification_link}"
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Vérifier mon adresse e-mail
        </a>
    </p>
    <p style="font-size: 12px; color: #666;">
        Ou copiez ce lien dans votre navigateur :<br>
        <a href="{verification_link}">{verification_link}</a>
    </p>
    <p><small>Ce lien est valide pendant 24 heures.</small></p>
    <p><small>✅ La vérification de votre email permet d'activer la signature électronique à distance.</small></p>
    <p style="margin-top: 30px; color: #666; font-size: 12px;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.
    </p>
    <p>L'équipe {app_name}</p>
    """
    send_email(subject, to_email, text_body, html_body=html_body)
