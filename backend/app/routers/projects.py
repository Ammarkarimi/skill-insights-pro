from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import ProjectReview, User
from ..security import current_user
from ..services import github, readiness
from ..services import project_review as svc
from .github import account_for

router = APIRouter(prefix="/api/projects", tags=["projects"])

MAX_REVIEWS = 50


def view(row: ProjectReview) -> dict:
    return {
        "id": row.id,
        "repo": row.repo_full_name,
        "repoUrl": row.repo_url,
        "commitSha": row.commit_sha,
        "commitUrl": f"{row.repo_url}/tree/{row.commit_sha}",
        "ownership": row.ownership,
        "meta": row.repo_meta,
        "review": row.review,
        "overallScore": row.overall_score,
        "createdAt": row.created_at.isoformat(),
    }


def _own(db: Session, user: User, review_id: int) -> ProjectReview:
    row = db.get(ProjectReview, review_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project review not found.")
    return row


class ReviewIn(BaseModel):
    repo_url: str = Field(min_length=3, max_length=300)


@router.post("/review", status_code=201)
def review(body: ReviewIn, response: Response, user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    count = len(db.scalars(select(ProjectReview.id).where(ProjectReview.user_id == user.id)).all())
    if count >= MAX_REVIEWS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"You can keep up to {MAX_REVIEWS} project reviews. Delete some to continue.")
    # Everything that can fail on GitHub's side happens before the user is charged.
    try:
        owner, repo = github.parse_repo_url(body.repo_url)
        snapshot = github.fetch_snapshot(owner, repo)
    except github.GithubError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from None

    acct = account_for(db, user.id)
    owned = github.ownership(snapshot, acct.login if acct else None)
    target = readiness.active_target(db, user.id)
    requirement_names = [r["name"] for r in target.requirements] if target else []

    with charge(db, user, "project_review", response):
        result = svc.review(snapshot, requirement_names, user.id)

    meta = {k: snapshot[k] for k in ("description", "stars", "forks", "fork", "pushed_at", "languages",
                                     "test_files", "source_files", "default_branch")}
    meta["filesReviewed"] = [f["path"] for f in snapshot["files"]]
    row = ProjectReview(user_id=user.id, repo_full_name=snapshot["full_name"], repo_url=snapshot["html_url"],
                        commit_sha=snapshot["sha"], ownership=owned, repo_meta=meta,
                        review=result.model_dump(), overall_score=result.overall_score)
    db.add(row)
    db.commit()
    for skill in result.skills:
        readiness.record_evidence(db, user.id, "project", skill.skill, skill.score, target=target,
                                  payload={"projectReviewId": row.id, "repo": row.repo_full_name,
                                           "ownership": owned["status"]}, commit=False)
    db.commit()
    return view(row)


@router.get("")
def list_reviews(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ProjectReview).where(ProjectReview.user_id == user.id)
                      .order_by(ProjectReview.created_at.desc())).all()
    return {"reviews": [{"id": r.id, "repo": r.repo_full_name, "overallScore": r.overall_score,
                         "ownership": r.ownership["status"], "createdAt": r.created_at.isoformat()}
                        for r in rows]}


@router.get("/{review_id}")
def detail(review_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return view(_own(db, user, review_id))


@router.delete("/{review_id}", status_code=204)
def delete(review_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, user, review_id))
    db.commit()
    return Response(status_code=204)
