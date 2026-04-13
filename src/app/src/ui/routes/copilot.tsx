import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, Bot, AlertCircle, ChevronDown } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/copilot")({
  component: CopilotPage,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODELS = [
  { id: "databricks-claude-sonnet-4-6", label: "Claude Sonnet 4.6", vendor: "Anthropic" },
  { id: "databricks-claude-opus-4-6", label: "Claude Opus 4.6", vendor: "Anthropic" },
  { id: "databricks-claude-haiku-4-5", label: "Claude Haiku 4.5", vendor: "Anthropic" },
  { id: "databricks-gpt-5-4", label: "GPT-5", vendor: "OpenAI" },
  { id: "databricks-gpt-5-mini", label: "GPT-5 Mini", vendor: "OpenAI" },
  { id: "databricks-gpt-5-nano", label: "GPT-5 Nano", vendor: "OpenAI" },
  { id: "databricks-gemini-2-5-pro", label: "Gemini 2.5 Pro", vendor: "Google" },
];

const DEFAULT_MODEL = MODELS[0].id;

const SUGGESTIONS = [
  "What's our current exposure to Denver?",
  "Show me properties with occupancy below 85%",
  "What's the average cash yield across the portfolio?",
  "Run a 5-year forecast for a $10M, 80-unit multifamily in Austin",
];

function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useCallback(
    async (text?: string) => {
      const message = text ?? input.trim();
      if (!message || isStreaming) return;

      const userMessage: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, model: selectedModel }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response body");

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.content,
                    };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: `Error: ${parsed.error}`,
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    },
    [input, isStreaming, selectedModel]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header — z-20 + relative so the dropdown can escape the glass stacking context */}
      <div className="mb-6 flex items-start justify-between relative z-20" style={{ animation: "fade-in-up 0.5s ease-out both" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent)]">
            <Sparkles size={20} className="text-[var(--db-orange)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Investment Copilot
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Databricks Foundation Model Endpoints
            </p>
          </div>
        </div>

        {/* Model selector */}
        <ModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isStreaming}
        />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-1">
        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ animation: "fade-in-up 0.5s ease-out 100ms both" }}
          >
            <div className="p-4 rounded-2xl glass-subtle mb-6">
              <Sparkles size={32} className="text-[var(--db-orange)] opacity-60" />
            </div>
            <p className="text-lg font-semibold mb-2">Ask about your portfolio</p>
            <p className="text-sm text-[var(--muted-foreground)] mb-8 text-center max-w-md">
              Query real-time data, run forecasts, and get AI-powered investment insights.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-left px-4 py-3 rounded-xl glass hover:bg-[var(--card-hover)] text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all duration-200"
                  style={{ animation: `fade-in-up 0.4s ease-out ${200 + i * 80}ms both` }}
                >
                  "{s}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isLast={i === messages.length - 1}
            isStreaming={isStreaming}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="glass rounded-xl p-1.5 flex items-center gap-2"
        style={{ animation: "fade-in-up 0.5s ease-out 150ms both" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about your portfolio..."
          disabled={isStreaming}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={isStreaming || !input.trim()}
          className="p-3 bg-[var(--db-orange)] text-white rounded-lg disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all shrink-0"
        >
          {isStreaming ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isLast,
  isStreaming,
}: {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("Error:");
  const isEmpty = !message.content && isLast && isStreaming;

  return (
    <div
      className={`flex gap-3 py-3 ${isUser ? "flex-row-reverse" : ""}`}
      style={{ animation: "fade-in-up 0.3s ease-out both" }}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-[var(--db-blue)]/15 text-[var(--db-blue)]"
            : "bg-[var(--accent)] text-[var(--db-orange)]"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] min-w-0 ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-3 rounded-xl text-sm leading-relaxed ${
            isUser
              ? "glass text-[var(--foreground)] whitespace-pre-wrap"
              : isError
                ? "bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]/20 rounded-xl whitespace-pre-wrap"
                : "text-[var(--foreground)]"
          }`}
        >
          {isError && (
            <span className="inline-flex items-center gap-1.5 mb-1">
              <AlertCircle size={14} />
              <span className="font-medium text-xs uppercase tracking-wider">Error</span>
            </span>
          )}
          {isEmpty ? (
            <span className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-orange)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-orange)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--db-orange)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </span>
          ) : isError ? (
            message.content.replace("Error: ", "")
          ) : isUser ? (
            message.content
          ) : (
            <div className="copilot-markdown">
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Model Selector                                                             */
/* -------------------------------------------------------------------------- */

const VENDOR_COLORS: Record<string, string> = {
  Anthropic: "var(--db-orange)",
  OpenAI: "var(--db-green)",
  Google: "var(--db-blue)",
};

function ModelSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = MODELS.find((m) => m.id === value) ?? MODELS[0];
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside — document listener avoids the onBlur/focus race condition
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Group by vendor
  const grouped = MODELS.reduce<Record<string, typeof MODELS>>((acc, m) => {
    (acc[m.vendor] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-lg glass hover:bg-[var(--card-hover)] transition-all text-sm disabled:opacity-50"
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: VENDOR_COLORS[selected.vendor] ?? "var(--muted-foreground)" }}
        />
        <span className="text-[var(--foreground)] font-medium">{selected.label}</span>
        <ChevronDown size={14} className={`text-[var(--muted-foreground)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-64 rounded-xl shadow-xl border border-[var(--border-bright)] overflow-hidden"
          style={{
            animation: "fade-in-up 0.15s ease-out both",
            background: "rgba(15, 23, 30, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {Object.entries(grouped).map(([vendor, models]) => (
            <div key={vendor}>
              <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: VENDOR_COLORS[vendor] ?? "var(--muted-foreground)" }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {vendor}
                </span>
              </div>
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                    m.id === value
                      ? "text-[var(--foreground)] bg-[var(--accent)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <span className="font-medium">{m.label}</span>
                  {m.id === value && (
                    <span className="ml-2 text-[10px] text-[var(--db-orange)] font-semibold uppercase tracking-wider">Active</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          <div className="px-3 py-2 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              All models served via Databricks Foundation Model APIs
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
