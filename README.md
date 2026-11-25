PortfolioGPT | AI Portfolio Assistant

An AI-powered portfolio assistant that allows recruiters and visitors to interactively explore my technical background, projects, skills, education, and experience through a conversational interface.

Built using React, FastAPI, and Groq API, the application integrates the GPT-OSS-120B model to generate context-aware responses based on structured portfolio information.

Features

- AI-Powered Conversations: Ask questions about my technical skills, projects, education, experience, and achievements.
- LLM Integration: Uses Groq API with the GPT-OSS-120B model to generate portfolio-specific responses.
- Context-Grounded Responses: Uses structured JSON data and custom system instructions to guide the LLM and restrict responses to documented portfolio information.
- Real-Time Streaming: Streams AI responses as they are generated instead of waiting for the complete response.
- Conversation Management: Create, switch between, and delete multiple chat sessions.
- Chat Persistence: Saves conversation history in browser "localStorage".
- Job Description Analysis: Submit a job description to receive an AI-generated estimate of profile compatibility, relevant strengths, and potential skill gaps.
- Markdown Rendering: Displays formatted AI responses, including lists and other Markdown elements.
- API Protection: Includes request validation, CORS configuration, and basic IP-based rate limiting.

Tech Stack

Category| Technologies
Frontend| React 19, JavaScript, HTML, CSS
Build Tool| Vite
Backend| Python, FastAPI
AI / LLM| Groq API, GPT-OSS-120B
LLM Integration| Prompt Engineering, Context Injection
Validation| Pydantic
Streaming| FastAPI StreamingResponse, Fetch ReadableStream
Storage| JSON, Browser localStorage
Other Tools| Uvicorn, python-dotenv, Git

Architecture

             User / Recruiter
                    |
                    v
          React Chat Interface
                    |
                    v
             FastAPI Backend
                    |
          +---------+---------+
          |                   |
          v                   v
    my_info.json         Conversation
    Portfolio Data         History
          |                   |
          +---------+---------+
                    |
                    v
             System Prompt
                    |
                    v
             Groq API
                    |
                    v
             GPT-OSS-120B
                    |
                    v
          Streaming Response
                    |
                    v
          React Chat Interface

Project Structure

PortfolioGPT/
│
├── backend/
│   ├── main.py
│   ├── my_info.json
│   ├── pyproject.toml
│   ├── uv.lock
│   └── .env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md

Getting Started

Prerequisites

- Python 3.11 or later
- Node.js and npm
- Groq API key

1. Clone the Repository

git clone <your-repository-url>
cd PortfolioGPT

2. Backend Setup

Navigate to the backend directory:

cd backend

Install dependencies using "uv" (https://docs.astral.sh/uv/):

uv sync

Create a ".env" file inside the "backend" directory:

GROQ_API_KEY=your_groq_api_key

Start the FastAPI server:

uv run uvicorn main:app --reload --port 8000

Backend API will be available at:

http://localhost:8000

API documentation:

http://localhost:8000/docs

3. Frontend Setup

Open another terminal and navigate to the frontend directory:

cd frontend

Install dependencies:

npm install

Create a ".env" file inside the "frontend" directory:

VITE_API_URL=http://localhost:8000

Start the development server:

npm run dev

Open the URL displayed by Vite, usually:

http://localhost:5173

API Endpoints

Method| Endpoint| Description
GET| "/health"| Checks backend status and configured model
POST| "/chat"| Sends a message and receives a streamed AI response
DELETE| "/chat/{chat_id}"| Clears a conversation from backend memory

Chat Request

"POST /chat"

{
  "chat_id": "unique-conversation-id",
  "message": "What projects has Aryan worked on?"
}

The backend returns a streamed plain-text response.

How It Works

1. A visitor submits a question through the React chat interface.
2. The frontend sends the message and conversation ID to the FastAPI backend.
3. The backend retrieves the conversation history and combines it with the portfolio context stored in "my_info.json".
4. A custom system prompt guides the LLM to answer using the available portfolio information.
5. The Groq API processes the request using GPT-OSS-120B.
6. FastAPI streams the generated response to the frontend.
7. React displays the response incrementally as it arrives.

Job Description Analysis

Recruiters can paste a job description using the Match Aryan with JD feature.

The application sends the job description to the LLM along with the portfolio context and requests:

- Estimated profile-match percentage
- Relevant technical skills and projects
- Areas of alignment with the job requirements
- Potential skill gaps

Note: The compatibility percentage is an LLM-generated estimate, not a score calculated by a deterministic evaluation algorithm.

Configuration & Limitations

- Portfolio information is maintained in "backend/my_info.json".
- The Groq API key is loaded through an environment variable and should never be committed to the repository.
- Conversation history on the backend is maintained in memory and is lost when the server restarts.
- The backend retains up to six conversation turns as context.
- Browser chat history is stored locally using "localStorage".
- IP-based rate limiting is maintained in application memory and is not a distributed rate-limiting solution.

Future Improvements

- Add persistent conversation storage using a database.
- Implement authentication and session management.
- Improve rate limiting for production deployment.
- Add better error handling and API monitoring.
- Expand portfolio knowledge and improve response evaluation.

Author

Aryan Chaturvedi

B.Tech, Computer Science and Engineering
Indian Institute of Information Technology, Sonepat

- GitHub: "aryancodesdaily" (https://github.com/aryancodesdaily)
- LinkedIn: "Aryan Chaturvedi" (https://linkedin.com/in/aryan-chaturvedi-66a142374)

---

Built to make exploring a developer's portfolio more interactive through Generative AI and Large Language Models.
