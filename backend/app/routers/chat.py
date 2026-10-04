from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..credits import charge
from ..db import get_db
from ..models import User
from ..security import current_user
from ..services import chat as svc

router = APIRouter(prefix="/api", tags=["chat"])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatIn(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)


@router.post("/chat")
def chat(body: ChatIn, response: Response, user: User = Depends(current_user),
         db: Session = Depends(get_db)):
    # Only the recent context is sent, bounding cost per message.
    history = [m.model_dump() for m in body.messages[-12:]]
    with charge(db, user, "chat_message", response):
        return {"reply": svc.reply(history, user.id)}
