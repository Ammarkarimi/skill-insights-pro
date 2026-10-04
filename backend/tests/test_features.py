import io

from tests.conftest import register

RESUME = (
    "Jane Doe\njane@example.com\n\nEXPERIENCE\nSoftware Engineer, Acme\n"
    "- Worked on   the payments   service using Python and Django.\n"
    "- Responsible for code reviews.\n\nSKILLS\nPython, Django, PostgreSQL, Docker\n"
)


def _score(s=70):
    return {"score": s, "justification": "ok"}


def analysis_payload(suggestions):
    return {
        "overall_score": 140, "headline": "Solid", "summary": "Good.", "strengths": ["Python"],
        "scores": {k: _score() for k in
                   ("word_choice", "grammar", "structure", "content_relevance", "ats_compatibility")},
        "missing_sections": [], "keywords_to_add": ["AWS"], "suggestions": suggestions,
    }


def suggestion(original, sev="high"):
    return {"original": original, "suggestion": "Built X", "reason": "Stronger verb",
            "category": "impact", "severity": sev}


def test_resume_analysis_maps_quotes_to_offsets(client, user, fake_llm):
    fake_llm.push(analysis_payload([
        suggestion("Responsible for code reviews."),
        suggestion("Worked on the payments service"),  # whitespace differs from the resume
        suggestion("Invented sentence that is not there"),
    ]))
    files = {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")}
    r = client.post("/api/resume/analyze", files=files, data={"target_role": "Backend Engineer"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["overall_score"] == 100  # clamped
    text = body["text"]
    located = [s for s in body["suggestions"] if s["startIndex"] >= 0]
    assert len(located) == 2
    for s in located:
        assert text[s["startIndex"]:s["endIndex"]] == s["original"]
    assert located[0]["startIndex"] < located[1]["startIndex"]
    assert body["suggestions"][-1]["startIndex"] == -1
    assert r.headers["X-Credits-Remaining"] == "7"


def test_resume_rejects_bad_files_without_charging(client, user, fake_llm):
    exe = {"resume": ("cv.exe", b"MZ" * 100, "application/octet-stream")}
    r = client.post("/api/resume/analyze", files=exe)
    assert r.status_code == 400
    r = client.post("/api/resume/analyze", files={"resume": ("cv.pdf", b"not a pdf" * 20, "application/pdf")})
    assert r.status_code == 400
    r = client.post("/api/resume/analyze", files={"resume": ("cv.txt", b"too short", "text/plain")})
    assert r.status_code == 400
    assert client.get("/api/auth/me").json()["credits"] == 10
    assert fake_llm.calls == []


def test_skill_extraction_dedupes(client, user, fake_llm):
    fake_llm.push({"skills": ["Python", "python ", "Django"], "category": "Technology",
                   "primary_role": "Backend Engineer", "seniority": "mid"})
    files = {"resume": ("cv.txt", io.BytesIO(RESUME.encode()), "text/plain")}
    r = client.post("/api/resume/skills", files=files)
    assert r.json()["techStack"] == ["Python", "Django"]


def mcq(answer="B", dup=False):
    opts = [{"key": k, "text": f"opt {k}"} for k in "ABCD"]
    if dup:
        opts[1]["text"] = "opt A"
    return {"question": "Q?", "code": "", "options": opts, "answer": answer,
            "explanation": "because", "topic": "t", "skill": "Python"}


def _start_assessment(client, fake_llm, n=6):
    fake_llm.push({"questions": [mcq("B") for _ in range(n)] + [mcq("A", dup=True)]})
    r = client.post("/api/assessment/questions",
                    json={"skills": ["Python"], "difficulty": "beginner", "count": 5})
    assert r.status_code == 200, r.text
    return r.json()


def test_questions_hide_answer_key(client, user, fake_llm):
    body = _start_assessment(client, fake_llm)
    assert len(body["questions"]) == 5
    for q in body["questions"]:
        assert "answer" not in q and "explanation" not in q
        assert q["code"] is None


def test_submit_grades_server_side_and_is_idempotent(client, user, fake_llm):
    body = _start_assessment(client, fake_llm)
    qs = body["questions"]
    # The correct option is the one whose text is "opt B" after shuffling.
    right = lambda q: next(k for k, v in q["options"].items() if v == "opt B")  # noqa: E731
    wrong = lambda q: next(k for k, v in q["options"].items() if v != "opt B")  # noqa: E731
    answers = {q["id"]: right(q) for q in qs[:3]}
    answers[qs[3]["id"]] = wrong(qs[3])
    r = client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": answers})
    assert r.status_code == 200, r.text
    result = r.json()
    assert (result["correct"], result["total"], result["score"]) == (3, 5, 60)
    assert result["perSkill"]["Python"] == {"correct": 3, "total": 5, "score": 60}
    assert all("explanation" in q for q in result["questions"])
    # A second submission (e.g. with better answers) cannot change the grade.
    all_right = {q["id"]: right(q) for q in qs}
    again = client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": all_right}).json()
    assert again["score"] == 60


def test_assessment_sessions_are_private(client, user, fake_llm):
    body = _start_assessment(client, fake_llm)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    r = client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": {}})
    assert r.status_code == 404


def test_learning_path_requires_submission_and_replaces_dead_links(client, user, fake_llm):
    body = _start_assessment(client, fake_llm)
    sid = body["sessionId"]
    assert client.post("/api/assessment/learning-path", json={"session_id": sid}).status_code == 409
    client.post(f"/api/assessment/{sid}/submit", json={"answers": {}})
    res = lambda link: {"title": "Django docs", "type": "documentation", "provider": "Django",  # noqa: E731
                        "link": link, "description": "d", "focus_area": "ORM",
                        "estimated_hours": 3, "free": True}
    fake_llm.push({"title": "Path", "summary": "s", "strengths": [], "focus_areas": [],
                   "resources": [res("https://docs.djangoproject.com/"), res("https://dead.example.org/x")],
                   "weekly_plan": [], "capstone_project": "Build it"})
    r = client.post("/api/assessment/learning-path", json={"session_id": sid})
    assert r.status_code == 200, r.text
    links = r.json()["learningPath"]
    assert links[0]["link"] == "https://docs.djangoproject.com/" and links[0]["link_verified"]
    assert links[1]["link"].startswith("https://www.google.com/search?q=") and not links[1]["link_verified"]
    prompt = fake_llm.calls[-1][1]["prompt"]
    assert "Score: 0%" in prompt and "WRONG" in prompt


def match_payload(pct):
    return {"candidate_name": "Jane", "match_percentage": pct, "verdict": "good_fit", "summary": "s",
            "requirements": [], "strengths": [], "weaknesses": [], "missing_keywords": [],
            "interview_questions": [],
            "learning_path": {"title": "t", "description": "d", "resources": []}}


def test_job_match_ranks_and_refunds_failures(client, user, fake_llm):
    from app.llm import LLMError

    order = {}

    def fake(schema, **kw):
        # Map by resume content so the result is deterministic across threads.
        key = "B" if "Resume B" in kw["prompt"] else "C" if "Resume C" in kw["prompt"] else "A"
        if key not in order:
            order[key] = {"A": match_payload(60), "B": LLMError(), "C": match_payload(90)}[key]
        value = order[key]
        if isinstance(value, Exception):
            raise value
        return schema.model_validate(value)

    from app.services import job_match
    job_match.generate = fake
    try:
        files = [("resumes", (f"{n}.txt", (f"Resume {n}\n" + RESUME).encode(), "text/plain")) for n in "ABC"]
        jd = {"job_description": "Backend engineer " * 10}
        r = client.post("/api/job-match/analyze", files=files, data=jd)
    finally:
        job_match.generate = fake_llm
    assert r.status_code == 200, r.text
    body = r.json()
    assert [x["match_percentage"] for x in body["results"]] == [90, 60]
    assert body["results"][0]["email"] == "jane@example.com"
    assert body["failed"] == ["B.txt"]
    assert client.get("/api/auth/me").json()["credits"] == 10 - 2 * 2


def test_interview_evaluation_saved_and_private(client, user, fake_llm):
    fb = {"score": 12, "verdict": "good", "strengths": ["clear"], "improvements": [], "model_answer": "m"}
    fake_llm.push({"answers": [fb], "overall": {"overall_score": 75, "readiness": "almost_ready",
                                                "summary": "s", "communication": "c",
                                                "top_strengths": [], "focus_next": []}})
    r = client.post("/api/interview/evaluate", json={
        "topic": "Backend", "difficulty": "beginner",
        "answers": [{"question": "What is REST?", "answer": "Resources over HTTP"}]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["answers"][0]["score"] == 10
    interview_id = body["id"]
    assert client.get("/api/interview/history").json()["interviews"][0]["overallScore"] == 75
    assert client.get(f"/api/interview/{interview_id}").status_code == 200

    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/interview/{interview_id}").status_code == 404


def test_market_insights_cached_for_free(client, user, fake_llm):
    payload = {"summary": "s", "demandLevel": "High", "outlook": "o",
               "salaryBands": {"entry": "$1", "mid": "$2", "senior": "$3"}, "hiringHubs": [],
               "industries": [], "relatedSkills": [], "topRoles": [], "tips": []}
    fake_llm.push(payload)
    r1 = client.get("/api/market/insights", params={"skill": "Rust", "country": "us"})
    assert r1.status_code == 200, r1.text
    assert r1.json()["live"] is None
    r2 = client.get("/api/market/insights", params={"skill": "rust", "country": "us"})
    assert r2.status_code == 200
    assert client.get("/api/auth/me").json()["credits"] == 8
    assert client.get("/api/market/insights", params={"skill": "Rust", "country": "zz"}).status_code == 400
