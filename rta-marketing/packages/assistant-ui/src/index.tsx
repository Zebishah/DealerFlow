import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import "./styles.css";

export type AssistantHistoryMessage = { role: "user" | "assistant"; content: string };
export type AssistantRequest = {
  message: string;
  history: AssistantHistoryMessage[];
  context: { route: string; entityType: "none" | "lead" | "sale" | "vehicle" | "scrape_run" | "source" };
};
export type AssistantAnswer = {
  answer: string;
  provider?: "gemini" | "groq" | "openrouter" | "openai-compatible" | "deterministic";
  sources: Array<{ label: string; kind: string }>;
  suggestions: string[];
  navigation: Array<{ label: string; path: string }>;
};

export function openRtaAssistant(prompt?: string): void {
  window.dispatchEvent(new CustomEvent("rta-assistant:open", { detail: { prompt } }));
}

export interface RtaAssistantProps {
  authenticated: boolean;
  path: string;
  request(input: AssistantRequest): Promise<AssistantAnswer>;
  navigate?(path: string): void;
  productLabel?: string;
}

const maxHistory = 8;

function markdownAsPlainText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, (_match, code: string) => code.trimEnd())
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "• ")
    .replace(/^\s*(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})\s*$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g, "$1");
}

export function formatAssistantAnswer(value: string): string {
  let answer = value;
  try {
    const parsed = JSON.parse(value) as { answer?: unknown };
    if (typeof parsed.answer === "string" && parsed.answer.trim()) answer = parsed.answer;
  } catch { /* Model responses are normally plain text, not JSON. */ }
  return markdownAsPlainText(answer);
}

function entityType(path: string): AssistantRequest["context"]["entityType"] {
  if (path.includes("leads")) return "lead";
  if (path.includes("sales") || path.includes("analytics")) return "sale";
  if (path.includes("inventory") || path.includes("vehicles")) return "vehicle";
  if (path.includes("scrape") || path.includes("acquisition") || path.includes("source")) return "scrape_run";
  return "none";
}

function initialSuggestions(authenticated: boolean): string[] {
  return authenticated
    ? ["Summarize my dashboard", "Find vehicles in inventory", "How does lead visibility work?"]
    : ["What does RTA do?", "How does the recruiter demo work?", "How is the platform secured?"];
}

type AssistantIconName = "sparkles" | "arrow" | "close" | "reset" | "shield" | "grid" | "play" | "chart" | "search" | "book";

function AssistantIcon({ name, className = "" }: { name: AssistantIconName; className?: string }) {
  const paths: Record<AssistantIconName, ReactNode> = {
    sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" /></>,
    shield: <><path d="m12 3 8 3v6c0 4-4.5 7.5-8 9-3.5-1.5-8-5-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
    play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></>,
    chart: <><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    book: <><path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2V4Z" /></>,
  };
  return <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function RtaAssistant({ authenticated, path, request, navigate, productLabel = "RTA Assistant" }: RtaAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantHistoryMessage[]>([]);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const suggestions = useMemo(() => initialSuggestions(authenticated), [authenticated]);
  const panelId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const empty = !messages.length && !answer;
  const starterIcons: AssistantIconName[] = authenticated ? ["chart", "search", "shield"] : ["grid", "play", "shield"];
  const starterLabels = authenticated ? ["Workspace overview", "Vehicle intelligence", "Access & permissions"] : ["Explore the platform", "See it in action", "Security & architecture"];

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      setOpen(true);
      if (prompt) setInput(prompt);
      inputRef.current?.focus();
    };
    window.addEventListener("rta-assistant:open", handleOpen);
    return () => window.removeEventListener("rta-assistant:open", handleOpen);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, loading]);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = messages.length ? bodyRef.current.scrollHeight : 0;
  }, [open, messages, loading, error]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [input, open]);

  function close(): void {
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function submit(message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    const history = messages.slice(-maxHistory);
    setInput("");
    setError("");
    setMessages((current) => [...current, { role: "user" as const, content: trimmed }].slice(-maxHistory));
    setLoading(true);
    try {
      const next = await request({ message: trimmed, history, context: { route: path, entityType: entityType(path) } });
      setAnswer(next);
      setMessages((current) => [...current, { role: "assistant" as const, content: formatAssistantAnswer(next.answer) }].slice(-maxHistory));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit(input);
  }

  function reset(): void {
    setMessages([]);
    setAnswer(null);
    setError("");
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className={`rta-assistant ${open ? "is-open" : ""}`} onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); } }}>
      {open && (
        <section id={panelId} className="rta-assistant-panel" role="region" aria-label={productLabel}>
          <header className="rta-assistant-header">
            <span className="rta-assistant-brand-icon"><AssistantIcon name="sparkles" /></span>
            <div className="rta-assistant-heading">
              <span className="rta-assistant-kicker">RTA INTELLIGENCE</span>
              <h2>{productLabel}<span className="rta-assistant-ai-badge">AI</span></h2>
            </div>
            <div className="rta-assistant-header-actions">
              <button type="button" onClick={reset} disabled={loading || (empty && !input && !error)} aria-label="Clear conversation" title="New conversation"><AssistantIcon name="reset" /></button>
              <button type="button" onClick={close} aria-label="Close assistant" title="Close assistant"><AssistantIcon name="close" /></button>
            </div>
          </header>
          <div className="rta-assistant-context"><span className="rta-assistant-context-dot" />{authenticated ? "Connected to your workspace" : "Your guide to everything RTA"}<span className="rta-assistant-readonly"><AssistantIcon name="shield" />Read-only</span></div>
          <div className="rta-assistant-body" ref={bodyRef}>
            {empty && (
              <div className="rta-assistant-welcome">
                <div className="rta-assistant-orbit" aria-hidden="true"><span className="rta-assistant-orbit-dot" /><span className="rta-assistant-orb"><AssistantIcon name="sparkles" /></span><span className="rta-assistant-orbit-star">+</span></div>
                <span className="rta-assistant-welcome-eyebrow">A LITTLE INTELLIGENCE. A LOT OF CLARITY.</span>
                <h3>{authenticated ? <>Your workspace.<br /><span>A clearer perspective.</span></> : <>Big questions.<br /><span>Clearer answers.</span></>}</h3>
                <p>{authenticated ? "Make sense of your leads, inventory and performance with insights from your authorized data." : "Explore the platform, discover the demo, or get into the details. Start with a question."}</p>
                <div className="rta-assistant-starters">
                  <span className="rta-assistant-section-label">{authenticated ? "WHERE SHOULD WE START?" : "CURIOUS? START HERE"}</span>
                  {suggestions.map((suggestion, index) => (
                    <button type="button" className="rta-assistant-starter" key={suggestion} onClick={() => void submit(suggestion)} disabled={loading}>
                      <span className={`rta-assistant-starter-icon tone-${index}`}><AssistantIcon name={starterIcons[index] ?? "book"} /></span>
                      <span><small>{starterLabels[index]}</small><strong>{suggestion}</strong></span>
                      <AssistantIcon name="arrow" className="rta-assistant-starter-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rta-assistant-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
              {messages.map((message, index) => (
                <div className={`rta-assistant-message ${message.role}`} key={`${message.role}-${index}`}>
                  <div className="rta-assistant-message-label">{message.role === "assistant" && <AssistantIcon name="sparkles" />}<span>{message.role === "user" ? "You" : productLabel}</span></div>
                  <div className="rta-assistant-message-content">{message.content}</div>
                </div>
              ))}
              {loading && <div className="rta-assistant-thinking" role="status"><span className="rta-assistant-thinking-dots" aria-hidden="true"><i /><i /><i /></span>Checking authorized sources…</div>}
            </div>
            {answer && !loading && (answer.sources.length > 0 || answer.navigation.length > 0) && (
              <div className="rta-assistant-result">
                {answer.sources.length > 0 && <><span className="rta-assistant-section-label"><AssistantIcon name="book" />ANSWER SOURCES</span><div className="rta-assistant-sources">{answer.sources.map((source, index) => <span key={`${source.label}-${index}`}>{source.label}</span>)}</div></>}
                {answer.navigation.length > 0 && navigate && (
                  <div className="rta-assistant-links">
                    {answer.navigation.map((item) => <button type="button" key={item.path} onClick={() => { navigate(item.path); close(); }}>{item.label}<AssistantIcon name="arrow" /></button>)}
                  </div>
                )}
              </div>
            )}
            {error && <div className="rta-assistant-error" role="alert">{error}</div>}
          </div>
          {!empty && <div className="rta-assistant-suggestions" aria-label="Suggested questions">
            {(answer?.suggestions.length ? answer.suggestions : suggestions).map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => void submit(suggestion)} disabled={loading}>{suggestion}<AssistantIcon name="arrow" /></button>
            ))}
          </div>}
          <div className="rta-assistant-composer">
            <form className="rta-assistant-form" onSubmit={onSubmit}>
              <label className="rta-assistant-sr-only" htmlFor={`${panelId}-input`}>Ask the RTA assistant</label>
              <textarea id={`${panelId}-input`} ref={inputRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(input); } }} maxLength={2_000} placeholder={messages.length ? "Ask a follow-up…" : "Ask anything about RTA…"} disabled={loading} />
              <div className="rta-assistant-composer-actions"><span><AssistantIcon name="sparkles" />{authenticated ? "Workspace intelligence" : "Powered by RTA intelligence"}</span><button type="submit" disabled={!input.trim() || loading} aria-label="Send question"><AssistantIcon name="arrow" /></button></div>
            </form>
            <footer className="rta-assistant-footer"><AssistantIcon name="shield" />Read-only assistance<span>·</span>Verify important details</footer>
          </div>
        </section>
      )}
      <button ref={launcherRef} className="rta-assistant-launcher" type="button" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={open ? "Close RTA Assistant" : "Open RTA Assistant"}>
        <span className="rta-assistant-launcher-icon"><AssistantIcon name={open ? "close" : "sparkles"} /></span><b>{open ? "Close assistant" : "Ask RTA"}</b>{!open && <span className="rta-assistant-launcher-badge">AI</span>}
      </button>
    </div>
  );
}
