import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import Portfolio
from app.routers.site import render_index

INDEX = ('<html><head><title>x</title><meta property="og:image" content="/herop.webp" />'
         "</head><body></body></html>")


def test_index_gets_contact_details_and_absolute_preview_image(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "app_url", "https://skillsphere.example.com/")
    monkeypatch.setattr(s, "company_name", 'Acme "Careers" Ltd')
    monkeypatch.setattr(s, "support_email", "help@skillsphere.example.com")
    page = render_index(INDEX, s)
    assert 'content="https://skillsphere.example.com/herop.webp"' in page
    assert '<meta name="ss:company" content="Acme &quot;Careers&quot; Ltd"/>' in page
    assert '<meta name="ss:support-email" content="help@skillsphere.example.com"/>' in page


def test_robots_and_sitemap(client, user, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_url", "https://skillsphere.example.com")
    robots = client.get("/robots.txt").text
    assert "Disallow: /api/" in robots and "Sitemap: https://skillsphere.example.com/sitemap.xml" in robots
    with SessionLocal() as db:
        db.add_all([Portfolio(user_id=user["id"], slug="ada-lovelace", display_name="Ada", headline="",
                              is_published=True, allow_indexing=True)])
        db.commit()
    xml = client.get("/sitemap.xml")
    assert xml.headers["content-type"].startswith("application/xml")
    assert "<loc>https://skillsphere.example.com/privacy</loc>" in xml.text
    assert "<loc>https://skillsphere.example.com/p/ada-lovelace</loc>" in xml.text


def test_unlisted_portfolios_stay_out_of_the_sitemap(client, user):
    with SessionLocal() as db:
        db.add(Portfolio(user_id=user["id"], slug="hidden-one", display_name="", headline="",
                         is_published=True, allow_indexing=False))
        db.commit()
    assert "hidden-one" not in client.get("/sitemap.xml").text


@pytest.mark.parametrize("email", ["", "support@example.com"])
def test_production_needs_a_real_support_email(monkeypatch, email):
    s = get_settings()
    monkeypatch.setattr(s, "jwt_secret", "p" * 40)
    monkeypatch.setattr(s, "app_url", "https://app.example.com")
    monkeypatch.setattr(s, "require_email_verification", False)
    monkeypatch.setattr(s, "support_email", email)
    with pytest.raises(RuntimeError, match="SUPPORT_EMAIL"):
        s.validate_for_production()


def test_error_monitoring_is_off_without_a_dsn():
    from app.main import init_error_monitoring
    assert init_error_monitoring(get_settings()) is False
