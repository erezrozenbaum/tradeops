from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    data: dict | None = None
    disclaimer: str = "AI-generated — for educational purposes only. Not financial advice."
