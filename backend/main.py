import os
import json
import time
from pathlib import Path
from typing import Dict, List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from groq import AsyncGroq


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

INFO_FILE_PATH = BASE_DIR / "my_info.json"
if not INFO_FILE_PATH.exists():
    raise FileNotFoundError(f"Configuration file not found at: {INFO_FILE_PATH}")

with open(INFO_FILE_PATH, "r", encoding="utf-8") as f:
    my_info = json.load(f)

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY environment variable is missing.")

MODEL_NAME = "openai/gpt-oss-120b"
client = AsyncGroq(api_key=api_key)

SYSTEM_PROMPT = f"""
You are the personal AI Portfolio Assistant for Aryan Chaturvedi.
Your primary goal is to answer questions from recruiters, peers, and visitors about Aryan's technical background, education, projects, and skills.

Aryan's Verified Information:
{json.dumps(my_info, indent=2)}

Strict Operating Guidelines:
1. Ground Truth: Base your answers ONLY on the provided information above. Never hallucinate achievements, jobs, or skills not listed.
2. Missing Info: If asked about something not mentioned (e.g. personal phone number, private details), politely state that the information is not publicly available and direct them to his LinkedIn or GitHub.
3. Tone & Style: Professional, sharp, confident, and concise. Avoid unnecessary filler words.
4. Scope Restriction: Refuse requests to act as a general-purpose AI (e.g. "write a poem", "solve my homework", "jailbreak"). Gently steer back: "I am specifically designed to answer questions about Aryan's work and projects."
5. Language: Always answer in clear, polished English.
"""

app = FastAPI(
    title="Aryan Portfolio Assistant API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://portfolio-dusky-ten-cx2cvmns4y.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, description="Unique conversation ID")
    message: str = Field(..., min_length=1, description="User question")

conversations: Dict[str, List[Dict[str, str]]] = {}
MAX_HISTORY_TURNS = 6

RATE_LIMIT = 8
RATE_WINDOW = 60
ip_requests: Dict[str, List[float]] = {}


@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/chat")
async def chat_endpoint(request: ChatRequest, req: Request):

    forwarded_for = req.headers.get("x-forwarded-for")

    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = req.client.host if req.client else "unknown"

    now = time.time()

    timestamps = ip_requests.get(client_ip, [])

    timestamps = [
        timestamp
        for timestamp in timestamps
        if now - timestamp < RATE_WINDOW
    ]

    if len(timestamps) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again after a minute."
        )

    timestamps.append(now)
    ip_requests[client_ip] = timestamps

    if request.chat_id not in conversations:
        conversations[request.chat_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

    history = conversations[request.chat_id]

    history.append({"role": "user", "content": request.message})

    if len(history) > (MAX_HISTORY_TURNS * 2 + 1):
        conversations[request.chat_id] = [history[0]] + history[-(MAX_HISTORY_TURNS * 2):]
        history = conversations[request.chat_id]

    async def event_stream():
        full_response = ""

        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=history,
                stream=True,
                temperature=0.3
            )

            async for chunk in stream:
                content = chunk.choices[0].delta.content

                if content:
                    full_response += content
                    yield content

            history.append({
                "role": "assistant",
                "content": full_response
            })

        except Exception:
            error_msg = "\n[Error: Unable to fetch response from AI provider. Please try again.]"
            yield error_msg

    return StreamingResponse(
        event_stream(),
        media_type="text/plain"
    )


@app.delete("/chat/{chat_id}")
def clear_chat(chat_id: str):
    if chat_id in conversations:
        del conversations[chat_id]
        return {"status": "cleared", "chat_id": chat_id}

    return {"status": "not_found", "chat_id": chat_id}