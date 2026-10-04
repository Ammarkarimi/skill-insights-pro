"""Safe text extraction from uploaded resumes (PDF, DOCX, TXT). Files never touch disk."""

from __future__ import annotations

import io
import re

from fastapi import HTTPException, UploadFile, status

from .config import get_settings

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
# Long enough for any real resume / job description, short enough to bound LLM cost.
MAX_TEXT_CHARS = 24_000


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, message)


def clean_text(text: str) -> str:
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def _extension(filename: str) -> str:
    return ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""


def read_upload(file: UploadFile) -> bytes:
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise _bad_request(f"'{file.filename}' is larger than {get_settings().max_upload_mb} MB.")
    if not data:
        raise _bad_request(f"'{file.filename}' is empty.")
    return data


def extract_text(filename: str, data: bytes) -> str:
    ext = _extension(filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise _bad_request("Unsupported file type. Please upload a PDF, DOCX or TXT file.")
    try:
        if ext == ".pdf":
            if not data.startswith(b"%PDF"):
                raise _bad_request(f"'{filename}' is not a valid PDF.")
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise _bad_request(f"'{filename}' is password protected.")
            text = "\n".join((page.extract_text() or "") for page in reader.pages[:10])
        elif ext == ".docx":
            import docx

            document = docx.Document(io.BytesIO(data))
            parts = [p.text for p in document.paragraphs]
            for table in document.tables:
                for row in table.rows:
                    parts.append(" | ".join(cell.text for cell in row.cells))
            text = "\n".join(parts)
        else:
            text = data.decode("utf-8", errors="ignore")
    except HTTPException:
        raise
    except Exception as exc:  # corrupt files from the wild raise all kinds of errors
        raise _bad_request(f"Could not read '{filename}'. Is the file corrupted?") from exc

    text = clean_text(text)
    if len(text) < 80:
        raise _bad_request(
            f"Could not find enough text in '{filename}'. If it is a scanned image, "
            "please upload a text-based PDF or DOCX."
        )
    return text[:MAX_TEXT_CHARS]


def resume_text_from_upload(file: UploadFile) -> str:
    return extract_text(file.filename or "", read_upload(file))
