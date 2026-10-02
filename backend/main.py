import os
import json
from pathlib import Path
from typing import Dict, List
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
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

# 2. Clients & Settings

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

# 3. FastAPI Initialization
app = FastAPI(
    title="Aryan Portfolio Assistant API",
    version="1.0.0"
)

# CORS (Apne local frontend aur future deployed domain dono ke liye)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Deployment ke waqt apna Vercel/Netlify domain yahan add kar dena
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Models & State
class ChatRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, description="Unique conversation ID")
    message: str = Field(..., min_length=1, description="User question")

# In-memory storage with sliding window
# Format: { chat_id: [ {"role": "...", "content": "..."}, ... ] }
conversations: Dict[str, List[Dict[str, str]]] = {}
MAX_HISTORY_TURNS = 6  # Last 3 user + 3 assistant responses to preserve context window

# 5. Endpoints
@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL_NAME}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Initialize conversation if new
    if request.chat_id not in conversations:
        conversations[request.chat_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

    history = conversations[request.chat_id]

    # Append new user message
    history.append({"role": "user", "content": request.message})

    # Sliding window: keep system prompt + last N messages
    if len(history) > (MAX_HISTORY_TURNS * 2 + 1):
        # Index 0 is system prompt, then take the last MAX_HISTORY_TURNS*2 messages
        conversations[request.chat_id] = [history[0]] + history[-(MAX_HISTORY_TURNS * 2):]
        history = conversations[request.chat_id]

    async def event_stream():
        full_response = ""
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=history,
                stream=True,
                temperature=0.3  # Lower temperature = higher factual accuracy
            )

            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    full_response += content
                    yield content

            # Append complete response back to history for context
            history.append({"role": "assistant", "content": full_response})

        except Exception as e:
            error_msg = "\n[Error: Unable to fetch response from AI provider. Please try again.]"
            yield error_msg

    return StreamingResponse(event_stream(), media_type="text/plain")

@app.delete("/chat/{chat_id}")
def clear_chat(chat_id: str):
    """Allows frontend's 'New Chat' button to wipe session on backend."""
    if chat_id in conversations:
        del conversations[chat_id]
        return {"status": "cleared", "chat_id": chat_id}
    return {"status": "not_found", "chat_id": chat_id}
