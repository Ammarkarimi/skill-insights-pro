import io

import docx

from app.services.letters import LINKEDIN_LIMIT, _fit_linkedin
from tests.conftest import register
from tests.test_tailor import RESUME, create

JD = "Backend engineer with Python and Django. " * 3


def letter(body="Hi Sam,\n\nI built the payments service at Acme handling 2,000 requests per second.\n\nJane",
           subject="Backend role at Stripe"):
    return {"subject": subject, "body": body, "highlights_used": ["payments service"],
            "personalization_tips": ["Mention a recent launch"]}


def post(client, data, with_file=True):
    files = {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")} if with_file else None
    return client.post("/api/letters", data=data, files=files)


def test_cover_letter_from_upload(client, user, fake_llm):
    fake_llm.push(letter())
    r = post(client, {"kind": "cover_letter", "tone": "warm", "company": "Stripe", "job_description": JD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["subject"] == "" and body["warnings"] == []  # 2,000 is in the resume
    assert body["wordCount"] > 5 and body["tips"] == ["Mention a recent launch"]
    prompt = fake_llm.calls[0][1]["prompt"]
    assert "Message type: cover_letter" in prompt and "Tone: warm" in prompt and "<resume>" in prompt
    assert client.get("/api/auth/me").json()["credits"] == 9


def test_invented_figures_are_flagged(client, user, fake_llm):
    fake_llm.push(letter(body="I grew revenue by 300% at Acme."))
    body = post(client, {"kind": "recruiter_email"}).json()
    assert body["subject"] == "Backend role at Stripe"
    assert any("300%" in w for w in body["warnings"])


def test_linkedin_note_is_capped():
    long = "I admire your work on payments infrastructure. " * 12
    out = _fit_linkedin(long)
    assert len(out) <= LINKEDIN_LIMIT and out.endswith(".")


def test_linkedin_note_endpoint(client, user, fake_llm):
    fake_llm.push(letter(body="Hello there. " * 40, subject="ignored"))
    body = post(client, {"kind": "linkedin_note"}).json()
    assert body["charCount"] <= LINKEDIN_LIMIT and body["subject"] == ""
    assert fake_llm.calls[0][1]["fast"] is True


def test_uses_saved_tailored_resume(client, user, fake_llm):
    rid = create(client, fake_llm).json()["id"]
    fake_llm.push(letter())
    r = post(client, {"kind": "referral_request", "tailored_id": str(rid)}, with_file=False)
    assert r.status_code == 200, r.text
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "Role: Backend" in prompt and "Python, Django, PostgreSQL" in prompt  # JD taken from saved version


def test_validation_happens_before_charging(client, user, fake_llm):
    assert post(client, {"kind": "cover_letter"}, with_file=False).status_code == 400
    assert post(client, {"kind": "thank_you"}).status_code == 400  # needs interview notes
    assert post(client, {"kind": "poem"}).status_code == 422
    assert client.get("/api/auth/me").json()["credits"] == 10


def test_other_users_tailored_resume_is_rejected(client, user, fake_llm):
    rid = create(client, fake_llm).json()["id"]
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert post(client, {"kind": "cover_letter", "tailored_id": str(rid)}, with_file=False).status_code == 404


def test_export_docx(client, user):
    r = client.post("/api/letters/export", json={"subject": "Hello", "body": "Para one.\n\nPara two.",
                                                 "filename": "Cover letter Stripe"})
    assert r.status_code == 200
    assert 'filename="Cover_letter_Stripe.docx"' in r.headers["content-disposition"]
    paras = [p.text for p in docx.Document(io.BytesIO(r.content)).paragraphs]
    assert paras == ["Subject: Hello", "Para one.", "Para two."]


def test_schema_is_strict_compatible():
    from openai.lib._parsing._responses import type_to_text_format_param

    from app.services.letters import LetterLLM

    assert type_to_text_format_param(LetterLLM)["strict"] is True
