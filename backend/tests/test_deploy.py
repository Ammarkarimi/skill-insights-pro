from datetime import datetime, timezone

from app.config import Settings
from app.scheduler import seconds_until_next_run


def test_app_url_falls_back_to_the_render_url(monkeypatch):
    monkeypatch.delenv("APP_URL", raising=False)
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://skillsphere.onrender.com")
    assert Settings(_env_file=None).app_url == "https://skillsphere.onrender.com"
    monkeypatch.setenv("APP_URL", "https://skillsphere.app")  # an explicit APP_URL (custom domain) wins
    assert Settings(_env_file=None).app_url == "https://skillsphere.app"
    assert Settings(_env_file=None, app_url="https://x.example.com").app_url == "https://x.example.com"


def test_scheduler_runs_a_few_minutes_past_each_hour():
    at = datetime(2026, 10, 12, 9, 0, 0, tzinfo=timezone.utc)
    assert seconds_until_next_run(at) == 7 * 60
    assert seconds_until_next_run(at.replace(minute=7)) == 3600  # just ran: wait a full hour
    assert seconds_until_next_run(at.replace(minute=50)) == 17 * 60
