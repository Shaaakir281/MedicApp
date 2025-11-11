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
