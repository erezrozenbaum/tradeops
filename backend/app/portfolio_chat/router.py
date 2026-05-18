import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai_usage.logger import log_ai_call
from app.core.config import settings
from app.db.session import get_db
from app.portfolio_chat import session as chat_session
from app.portfolio_chat import engine
from app.portfolio_chat.schemas import ChatRequest, ChatResponse

router = APIRouter()


@router.post("", response_model=ChatResponse)
def portfolio_chat(
    investor_id: uuid.UUID,
    body: ChatRequest,
    db: Session = Depends(get_db),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI chat is not configured on this server")

    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    history = chat_session.get_history(investor_id)
    reply, data, in_tok, out_tok = engine.chat(
        db=db,
        investor_id=investor_id,
        message=body.message,
        history=history,
        api_key=settings.ANTHROPIC_API_KEY,
    )

    if in_tok > 0:
        log_ai_call(
            db=db,
            feature_name="portfolio_chat",
            model="claude-haiku-4-5-20251001",
            input_tokens=in_tok,
            output_tokens=out_tok,
            investor_id=investor_id,
        )
        db.commit()

    chat_session.append(investor_id, "user", body.message)
    chat_session.append(investor_id, "assistant", reply)

    return ChatResponse(reply=reply, data=data)


@router.delete("")
def clear_chat_history(investor_id: uuid.UUID):
    """Clear conversation history for this investor session."""
    chat_session.clear(investor_id)
    return {"cleared": True}
