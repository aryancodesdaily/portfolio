import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Comprehensive Pool of Verified Questions
const ALL_SUGGESTIONS = [
  "Can you give me a quick overview of Aryan?",
  "How does Aryan's LLM Resume Matcher actually work?",
  "What makes Aryan a good fit for a software engineering internship?",
  "How strong is Aryan at DSA and competitive programming?",
  "What technologies and backend tools does Aryan work with?",
  "What did Aryan build during his 24-hour offline hackathon?",
  "What is Aryan working on and learning right now?",
  "What does Aryan like to do outside of coding?",
  "How does Aryan combine C++ and problem-solving with Python backend development?",
  "How did Aryan build this AI portfolio assistant?",
];

// Helper to pick 4 random distinct suggestions
const getRandomSuggestions = () => {
  const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 4);
};

export default function App() {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("aryan_portfolio_chats");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chats from localStorage", e);
      }
    }
    const initialId = crypto.randomUUID();
    return [{ id: initialId, title: "New Conversation", messages: [] }];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem("aryan_portfolio_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0].id;
      } catch (e) {}
    }
    return crypto.randomUUID();
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] =
    useState(getRandomSuggestions);

  // Job Match Modal State
  const [isJobMatchModalOpen, setIsJobMatchModalOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("aryan_portfolio_chats", JSON.stringify(chats));
  }, [chats]);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = activeChat ? activeChat.messages : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  // 1. New Chat: Resets state and re-rolls suggestions
  const handleNewChat = () => {
    if (isLoading) return;
    const newId = crypto.randomUUID();
    const newChatObj = {
      id: newId,
      title: "New Conversation",
      messages: [],
    };
    setChats((prev) => [newChatObj, ...prev]);
    setActiveChatId(newId);
    setInputMessage("");
    setCurrentSuggestions(getRandomSuggestions()); // New random questions
  };

  // 2. Delete Chat
  const handleDeleteChat = (e, idToDelete) => {
    e.stopPropagation();
    if (chats.length <= 1) {
      const freshId = crypto.randomUUID();
      setChats([{ id: freshId, title: "New Conversation", messages: [] }]);
      setActiveChatId(freshId);
      setCurrentSuggestions(getRandomSuggestions());
      return;
    }

    const filtered = chats.filter((c) => c.id !== idToDelete);
    setChats(filtered);
    if (activeChatId === idToDelete) {
      setActiveChatId(filtered[0].id);
    }

    fetch(`${API_BASE_URL}/chat/${idToDelete}`, { method: "DELETE" }).catch(
      () => {},
    );
  };

  // 3. Streaming Chat Engine
  const sendStreamingQuery = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    const userText = queryText.trim();
    setInputMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let updatedTitle = activeChat.title;
    if (activeChat.messages.length === 0) {
      updatedTitle =
        userText.length > 25 ? userText.substring(0, 25) + "..." : userText;
    }

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            title: updatedTitle,
            messages: [
              ...chat.messages,
              { role: "user", content: userText },
              { role: "assistant", content: "" },
            ],
          };
        }
        return chat;
      }),
    );

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: activeChatId,
          message: userText,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === activeChatId) {
              const msgs = [...chat.messages];
              msgs[msgs.length - 1] = {
                role: "assistant",
                content: accumulated,
              };
              return { ...chat, messages: msgs };
            }
            return chat;
          }),
        );
      }
    } catch (err) {
      console.error(err);
      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id === activeChatId) {
            const msgs = [...chat.messages];
            msgs[msgs.length - 1] = {
              role: "assistant",
              content:
                "Connection error: Unable to communicate with the backend.",
            };
            return { ...chat, messages: msgs };
          }
          return chat;
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobMatchSubmit = () => {
    if (!jobDescription.trim()) return;
    const prompt = `Please evaluate how well Aryan's skills, projects, and academic background match this Job Description. Provide a match percentage estimation, relevant technical highlights, and any missing areas:\n\n"""\n${jobDescription.trim()}\n"""`;
    setIsJobMatchModalOpen(false);
    setJobDescription("");
    sendStreamingQuery(prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendStreamingQuery(inputMessage);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-dot"></div>
            <span className="brand-name">Aryan AI</span>
          </div>
          <button className="btn-new-chat" onClick={handleNewChat}>
            <span className="plus-icon">+</span>
            <span>New Chat</span>
          </button>
        </div>

        <div className="history-section">
          <p className="section-label">Recent Sessions</p>
          <div className="chat-list">
            {chats.map((c) => (
              <div
                key={c.id}
                className={`chat-item ${c.id === activeChatId ? "active" : ""}`}
                onClick={() => setActiveChatId(c.id)}
              >
                <span className="chat-title">{c.title}</span>
                <button
                  className="btn-delete"
                  title="Delete Chat"
                  onClick={(e) => handleDeleteChat(e, c.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            className="btn-job-match"
            onClick={() => setIsJobMatchModalOpen(true)}
          >
            <div className="badge-icon">⚡</div>
            <div className="job-match-text">
              <strong>Match Aryan with JD</strong>
              <small>Evaluate profile fit for your role</small>
            </div>
          </button>
        </div>
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <aside
            className="mobile-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-sidebar-header">
              <div className="brand">
                <div className="brand-dot"></div>
                <span className="brand-name">Aryan AI</span>
              </div>

              <button
                className="mobile-sidebar-close"
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                ×
              </button>
            </div>

            <button className="btn-new-chat" onClick={handleNewChat}>
              <span className="plus-icon">+</span>
              <span>New Chat</span>
            </button>

            <div className="history-section">
              <p className="section-label">Recent Sessions</p>

              <div className="chat-list">
                {chats.map((c) => (
                  <div
                    key={c.id}
                    className={`chat-item ${
                      c.id === activeChatId ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveChatId(c.id);
                      setIsMobileSidebarOpen(false);
                    }}
                  >
                    <span className="chat-title">{c.title}</span>

                    <button
                      className="btn-delete"
                      title="Delete Chat"
                      onClick={(e) => handleDeleteChat(e, c.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-footer">
              <button
                className="btn-job-match"
                onClick={() => {
                  setIsJobMatchModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
              >
                <div className="badge-icon">⚡</div>

                <div className="job-match-text">
                  <strong>Match Aryan with JD</strong>
                  <small>Evaluate profile fit for your role</small>
                </div>
              </button>
            </div>
          </aside>
        </div>
      )}
      {/* Main Viewport */}
      <main className="chat-viewport">
        <header className="topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="header-info">
            <div className="title-row">
              <h2>Aryan's Portfolio Assistant</h2>
              <span className="status-badge">
                <span className="status-indicator"></span>
                Online
              </span>
            </div>
            <p className="header-subtitle">
              IIIT Sonepat (CSE) • Competitive Programming • Backend & Applied
              AI[cite: 3]
            </p>
          </div>
          <div className="social-links">
            <a
              href="https://github.com/aryancodesdaily"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
            <a
              href="https://linkedin.com/in/aryan-chaturvedi-66a142374"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn ↗
            </a>
          </div>
        </header>

        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="avatar-large">AC</div>
              <h1>Explore Aryan's Work & Skills</h1>
              <p className="welcome-tagline">
                Ask anything about my projects, algorithmic background,
                hackathons, or tech stack.
              </p>

              <div className="suggestions-grid">
                {currentSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-tile"
                    onClick={() => sendStreamingQuery(suggestion)}
                  >
                    <span>{suggestion}</span>
                    <span className="arrow-icon">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-feed">
              {messages.map((msg, index) => (
                <div key={index} className={`message-row ${msg.role}`}>
                  <div className="avatar-chip">
                    {msg.role === "user" ? "You" : "AI"}
                  </div>
                  <div className="message-bubble">
                    {msg.content ? (
                      <div className="markdown-body">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Dock */}
          <div className="input-dock">
            <div className="input-card">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about projects, hackathons, LeetCode stats..."
                rows={1}
                disabled={isLoading}
              />
              <button
                className="btn-send"
                onClick={() => sendStreamingQuery(inputMessage)}
                disabled={isLoading || !inputMessage.trim()}
              >
                ↑
              </button>
            </div>
            <p className="dock-note">
              Grounded strictly in Aryan's verified achievements. No
              hallucinations.
            </p>
          </div>
        </div>
      </main>

      {/* Job Match Modal */}
      {isJobMatchModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsJobMatchModalOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚡ Match Aryan with a Job Description</h3>
              <button
                className="btn-close"
                onClick={() => setIsJobMatchModalOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="modal-desc">
              Paste the requirements or description for an internship or
              software role below. The AI will evaluate how well Aryan's skills
              and projects align with your opening.
            </p>
            <textarea
              className="modal-textarea"
              rows={6}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste Job Description / Requirements here..."
            />
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setIsJobMatchModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn-submit"
                onClick={handleJobMatchSubmit}
                disabled={!jobDescription.trim()}
              >
                Analyze Compatibility
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
