"""Atomic credit reservation with automatic refunds on failure.

Usage inside an endpoint:

    with charge(db, user, "resume_analysis", response):
        result = run_llm(...)

Credits are reserved *before* the expensive call with a conditional UPDATE (so concurrent
requests can never overdraw a balance) and refunded if the block raises.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager

from fastapi import HTTPException, Response, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from .config import get_settings
from .models import UsageEvent, User
from .ratelimit import limiter

log = logging.getLogger(__name__)


class InsufficientCredits(HTTPException):
    def __init__(self, needed: int, balance: int) -> None:
        super().__init__(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": f"This action needs {needed} credits but you have {balance}. "
                "Top up to continue.",
                "code": "insufficient_credits",
                "needed": needed,
                "balance": balance,
            },
        )


def _reserve(db: Session, user: User, amount: int) -> None:
    result = db.execute(
        update(User)
        .where(User.id == user.id, User.credits >= amount)
        .values(credits=User.credits - amount)
    )
    db.commit()
    db.refresh(user)
    if result.rowcount == 0:
        raise InsufficientCredits(amount, user.credits)


def refund(db: Session, user: User, amount: int) -> None:
    if amount <= 0:
        return
    db.execute(update(User).where(User.id == user.id).values(credits=User.credits + amount))
    db.commit()
    db.refresh(user)


@contextmanager
def charge(db: Session, user: User, action: str, response: Response | None = None,
           quantity: int = 1):
    """Reserve credits for `quantity` units of `action`; yields a ChargeHandle.

    Call `handle.refund_units(n)` inside the block to refund units that turned out not to be
    needed (e.g. one resume in a batch failed to parse).
    """
    settings = get_settings()
    limiter.hit(f"ai:{user.id}", settings.ai_requests_per_minute)
    unit_cost = settings.cost(action)
    handle = _ChargeHandle(unit_cost, quantity)
    _reserve(db, user, unit_cost * quantity)
    try:
        yield handle
    except BaseException:
        refund(db, user, unit_cost * quantity)
        raise
    refund(db, user, unit_cost * handle.refunded_units)
    charged = unit_cost * (quantity - handle.refunded_units)
    if charged > 0:
        db.add(UsageEvent(user_id=user.id, action=action, credits=charged))
        db.commit()
    if response is not None:
        response.headers["X-Credits-Remaining"] = str(user.credits)


class _ChargeHandle:
    def __init__(self, unit_cost: int, quantity: int) -> None:
        self.unit_cost = unit_cost
        self.quantity = quantity
        self.refunded_units = 0

    def refund_units(self, n: int) -> None:
        self.refunded_units = min(self.quantity, self.refunded_units + n)
