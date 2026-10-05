"""Email over SMTP (any provider), with a shared HTML layout and one-click unsubscribe headers.

Without SMTP settings outside production, emails are logged instead of sent (and kept in OUTBOX),
so password reset and reminders can be tried locally.
"""

from __future__ import annotations

import html
import logging
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr

from ..config import get_settings

log = logging.getLogger(__name__)
OUTBOX: list[dict] = []  # local development and tests only
OUTBOX_LIMIT = 100


@dataclass
class Email:
    to: str
    subject: str
    heading: str
    paragraphs: list[str] = field(default_factory=list)  # plain text; escaped when rendered
    bullets: list[str] = field(default_factory=list)
    cta_label: str = ""
    cta_url: str = ""
    footer: str = ""
    unsubscribe_url: str = ""  # page a person opens from the footer link
    one_click_url: str = ""  # API URL mail clients POST to (List-Unsubscribe-Post)

    def text(self) -> str:
        parts = [self.heading, "", *self.paragraphs]
        if self.bullets:
            parts += ["", *(f"- {b}" for b in self.bullets)]
        if self.cta_url:
            parts += ["", f"{self.cta_label}: {self.cta_url}"]
        if self.footer:
            parts += ["", self.footer]
        if self.unsubscribe_url:
            parts += ["", f"Unsubscribe: {self.unsubscribe_url}"]
        return "\n".join(parts)

    def html(self) -> str:
        e = html.escape
        name = e(get_settings().app_name)
        body = "".join(f'<p style="margin:0 0 14px">{e(p)}</p>' for p in self.paragraphs)
        if self.bullets:
            body += '<ul style="margin:0 0 14px;padding-left:20px">' + "".join(
                f'<li style="margin:0 0 6px">{e(b)}</li>' for b in self.bullets) + "</ul>"
        if self.cta_url:
            body += (f'<p style="margin:22px 0"><a href="{e(self.cta_url, quote=True)}" '
                     'style="background:#6d5ae6;color:#fff;text-decoration:none;padding:11px 18px;'
                     f'border-radius:8px;display:inline-block;font-weight:600">{e(self.cta_label)}</a></p>')
        foot = f'<p style="margin:0 0 6px">{e(self.footer)}</p>' if self.footer else ""
        if self.unsubscribe_url:
            foot += (f'<p style="margin:0"><a href="{e(self.unsubscribe_url, quote=True)}" '
                     'style="color:#6b7280">Unsubscribe from these emails</a></p>')
        return (
            '<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,'
            'Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">'
            '<div style="max-width:560px;margin:0 auto;padding:24px">'
            f'<div style="font-weight:700;color:#6d5ae6;font-size:18px;margin-bottom:16px">{name}</div>'
            '<div style="background:#fff;border-radius:12px;padding:24px;line-height:1.55;font-size:15px">'
            f'<h1 style="font-size:20px;margin:0 0 16px">{e(self.heading)}</h1>{body}</div>'
            f'<div style="font-size:12px;color:#6b7280;padding:16px 4px">{foot}</div>'
            "</div></body></html>"
        )


def build_message(mail: Email) -> EmailMessage:
    settings = get_settings()
    msg = EmailMessage()
    from_name, from_addr = parseaddr(settings.smtp_from or f"{settings.app_name} <no-reply@localhost>")
    msg["From"] = formataddr((from_name or settings.app_name, from_addr))
    msg["To"] = mail.to
    msg["Subject"] = mail.subject
    msg["Message-ID"] = make_msgid(domain=from_addr.split("@")[-1] or None)
    if mail.one_click_url:
        # RFC 8058 one-click unsubscribe, honoured by Gmail and Yahoo for bulk senders.
        msg["List-Unsubscribe"] = f"<{mail.one_click_url}>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(mail.text())
    msg.add_alternative(mail.html(), subtype="html")
    return msg


def send(mail: Email) -> bool:
    """Send one email. Returns False if it could not be sent; never raises."""
    settings = get_settings()
    if not settings.email_enabled:
        if settings.is_production:
            log.warning("Email not configured; dropped '%s' to user", mail.subject)
            return False
        OUTBOX.append({"to": mail.to, "subject": mail.subject, "text": mail.text()})
        del OUTBOX[:-OUTBOX_LIMIT]
        log.info("Email (not sent, SMTP not configured) to %s: %s\n%s", mail.to, mail.subject, mail.text())
        return True
    msg = build_message(mail)
    try:
        if settings.smtp_security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20,
                                                    context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
        with server:
            if settings.smtp_security == "starttls":
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        log.error("Could not send email '%s': %s", mail.subject, exc)
        return False
