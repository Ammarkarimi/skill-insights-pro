from datetime import date, datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import ReviewCard
from app.services import learning
from app.services.readiness import next_actions
from tests.test_readiness import _target, create_target


def mcq(i, answer="B"):
    options = [{"key": k, "text": f"q{i} opt {k}"} for k in "ABCD"]
    return {"question": f"Question {i}?", "code": "", "options": options,
            "answer": answer, "explanation": f"Because {i}.", "topic": f"topic {i}", "skill": "Python"}


def right(q):
    return next(k for k, v in q["options"].items() if v.endswith("opt B"))


def wrong(q):
    return next(k for k, v in q["options"].items() if not v.endswith("opt B"))


def take_assessment(client, fake_llm, n_right=3, skills=("Python",), difficulty="beginner"):
    fake_llm.push({"questions": [mcq(i) for i in range(5)]})
    body = client.post("/api/assessment/questions",
                       json={"skills": list(skills), "difficulty": difficulty, "count": 5}).json()
    qs = body["questions"]
    answers = {q["id"]: right(q) if i < n_right else wrong(q) for i, q in enumerate(qs)}
    r = client.post(f"/api/assessment/{body['sessionId']}/submit", json={"answers": answers})
    assert r.status_code == 200, r.text
    return body["sessionId"]


PATH = {"title": "Python Path", "summary": "s", "strengths": [], "focus_areas": [],
        "resources": [{"title": "Docs", "type": "documentation", "provider": "Python", "link": "https://docs.python.org/3/",
                       "description": "d", "focus_area": "basics", "estimated_hours": 3, "free": True}],
        "weekly_plan": [{"week": 1, "goal": "Basics", "activities": ["Read"]},
                        {"week": 2, "goal": "Generators", "activities": ["Build"]}],
        "capstone_project": "CLI tool"}


def make_plan(client, fake_llm):
    sid = take_assessment(client, fake_llm, n_right=2)
    fake_llm.push(PATH)
    r = client.post("/api/assessment/learning-path", json={"session_id": sid})
    assert r.status_code == 200, r.text
    return r.json()


def test_learning_path_is_saved_and_tracked(client, user, fake_llm):
    path = make_plan(client, fake_llm)
    assert path["id"] and path["title"] == "Python Path"  # same body as before, plus the id
    plans = client.get("/api/learning/plans").json()["plans"]
    assert plans[0]["baselineScore"] == 40 and plans[0]["progressPct"] == 0 and plans[0]["nextWeek"] == 1
    url = f"/api/learning/plans/{path['id']}/progress"
    assert client.patch(url, json={"week": 9, "done": True}).status_code == 400
    assert client.patch(url, json={"resource": "https://evil.example", "done": True}).status_code == 400
    p = client.patch(url, json={"week": 1, "done": True}).json()
    assert p["progressPct"] == 50 and p["nextWeek"] == 2 and p["status"] == "active"
    p = client.patch(url, json={"resource": "https://docs.python.org/3/", "done": True}).json()
    assert p["progress"]["resources"] == ["https://docs.python.org/3/"]
    p = client.patch(url, json={"week": 2, "done": True}).json()
    assert p["status"] == "completed" and p["progressPct"] == 100
    p = client.patch(url, json={"week": 2, "done": False}).json()
    assert p["status"] == "active"
    assert "plan=" in p["retestHref"] and "difficulty=beginner" in p["retestHref"]


def test_retest_shows_improvement(client, user, fake_llm):
    path = make_plan(client, fake_llm)
    url = f"/api/learning/plans/{path['id']}/retest"
    first = client.get("/api/learning/plans").json()["plans"][0]
    with SessionLocal() as db:
        from app.models import LearningPlan
        original = db.get(LearningPlan, path["id"]).assessment_session_id
    assert client.post(url, json={"session_id": original}).status_code == 400  # the baseline itself
    retest = take_assessment(client, fake_llm, n_right=5)
    p = client.post(url, json={"session_id": retest}).json()
    assert (first["baselineScore"], p["retestScore"]) == (40, 100)


def test_wrong_answers_become_review_cards(client, user, fake_llm):
    take_assessment(client, fake_llm, n_right=3)  # 2 wrong
    data = client.get("/api/learning/review").json()
    assert data["dueCount"] == 2
    card = data["cards"][0]
    assert "answer" not in card and "explanation" not in card and card["skill"] == "Python"
    letter = right(card)
    r = client.post(f"/api/learning/review/{card['id']}", json={"answer": letter}).json()
    assert r["correct"] and r["box"] == 2 and r["explanation"].startswith("Because")
    again = client.post(f"/api/learning/review/{card['id']}", json={"answer": letter})
    assert again.status_code == 409  # not due yet
    other = data["cards"][1]
    r = client.post(f"/api/learning/review/{other['id']}", json={"answer": wrong(other)}).json()
    assert not r["correct"] and r["box"] == 1
    assert client.get("/api/learning/review").json()["dueCount"] == 0
    s = client.get("/api/learning/summary").json()
    assert s["practicedToday"] and s["streak"] == 1 and s["totalCards"] == 2


def test_missing_a_question_again_resets_its_card(client, user, fake_llm):
    take_assessment(client, fake_llm, n_right=4)
    card = client.get("/api/learning/review").json()["cards"][0]
    client.post(f"/api/learning/review/{card['id']}", json={"answer": right(card)})
    take_assessment(client, fake_llm, n_right=4)  # the same question is wrong again
    with SessionLocal() as db:
        cards = db.query(ReviewCard).all()
    assert len(cards) == 1 and cards[0].box == 1


def test_leitner_intervals():
    card = ReviewCard(question={"answer": "B"}, box=1, reviews=0)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for expected_box, days in [(2, 3), (3, 7), (4, 14), (5, 30), (5, 30)]:
        learning.grade_card(card, "B", now)
        assert card.box == expected_box and card.due_at == now + timedelta(days=days)
    learning.grade_card(card, "A", now)
    assert card.box == 1 and card.due_at == now + timedelta(days=1)


def test_streak_counts_back_from_today_or_yesterday():
    today = date(2026, 3, 10)
    days = {"2026-03-10", "2026-03-09", "2026-03-08", "2026-03-05"}
    assert learning.streak(days, today) == 3
    assert learning.streak(days - {"2026-03-10"}, today) == 2  # today not done yet: streak survives
    assert learning.streak({"2026-03-07"}, today) == 0


def test_other_features_feed_the_loop(client, user, fake_llm):
    test = client.post("/api/aptitude/start", json={"section": "quant"}).json()
    with SessionLocal() as db:
        from app.models import AptitudeTest
        key = {q["id"]: q["answer"] for q in db.get(AptitudeTest, test["id"]).questions}
    wrong_letter = next(k for k in "ABCD" if k != key[1])
    client.post(f"/api/aptitude/{test['id']}/answer", json={"question_id": 1, "answer": wrong_letter})
    client.post(f"/api/aptitude/{test['id']}/submit")
    cards = client.get("/api/learning/review").json()["cards"]
    assert len(cards) == 1 and cards[0]["skill"] == "Quantitative"  # unanswered questions are not cards
    client.post("/api/coding/attempts", json={"slug": "two-sum", "language": "python", "code": "x",
                                              "passed": 1, "total": 6})
    with SessionLocal() as db:
        from app.models import PracticeLog
        kinds = {log.kind for log in db.query(PracticeLog).all()}
    assert {"aptitude", "coding"} <= kinds


def test_next_actions_include_review_and_plan():
    target = _target()
    computed = {"requirements": [], "score": 0, "coverage": 0, "trend": []}
    plan = {"title": "Python Path", "nextWeek": 2, "progressPct": 50}
    actions = next_actions(target, computed, [], learning={"dueCards": 3, "plan": plan})
    assert actions[0]["type"] == "review" and "3 past mistakes" in actions[0]["title"]
    assert any(a["type"] == "plan" and "week 2" in a["title"] for a in actions)
    assert not any(a["type"] in ("review", "plan") for a in next_actions(target, computed, []))


def test_readiness_endpoint_suggests_review(client, user, fake_llm):
    create_target(client, fake_llm)
    take_assessment(client, fake_llm, n_right=4)
    actions = client.get("/api/readiness").json()["actions"]
    assert actions[0]["type"] == "review" and actions[0]["href"] == "/learning"


def test_plans_are_private(client, user, fake_llm):
    from tests.conftest import register
    path = make_plan(client, fake_llm)
    client.post("/api/auth/logout")
    register(client, email="eve@example.com")
    assert client.get(f"/api/learning/plans/{path['id']}").status_code == 404
    assert client.get("/api/learning/review").json()["dueCount"] == 0
