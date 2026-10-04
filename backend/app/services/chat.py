"""Career assistant chatbot."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..llm import generate


class ChatReply(BaseModel):
    reply: str = Field(description="Markdown-formatted answer")


CHAT_SYSTEM = """You are SkillSphere's career assistant: a warm, practical career coach for \
students and tech professionals. You help with career planning, skills and learning roadmaps, \
resumes, cover letters, LinkedIn, interviews, job search strategy, salary negotiation and \
workplace growth.

Style: concise and specific (usually under 200 words), use short bullet lists or numbered steps \
when helpful, give concrete examples. Ask one clarifying question when the request is ambiguous.
If a question is unrelated to careers, learning or work, briefly say you can only help with \
career topics and suggest a related question you can help with.
Never claim to have browsed the web or to know real-time job listings."""


def reply(messages: list[dict], user_id: int) -> str:
    transcript = "\n\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}" for m in messages
    )
    prompt = (f"Conversation so far (most recent last):\n\n{transcript}\n\n"
              "Write the assistant's next reply to the user's last message.")
    return generate(ChatReply, system=CHAT_SYSTEM, prompt=prompt, fast=True,
                    user_id=user_id).reply
