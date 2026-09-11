import { useMemo, useState, type FormEvent } from "react";
import "./styles.css";

export type AssistantHistoryMessage = { role: "user" | "assistant"; content: string };
export type AssistantRequest = {
  message: string;
  history: AssistantHistoryMessage[];
  context: { route: string; entityType: "none" | "lead" | "sale" | "vehicle" | "scrape_run" | "source" };
};
export type AssistantAnswer = {
  answer: string;
  sources: Array<{ label: string; kind: string }>;
  suggestions: string[];
  navigation: Array<{ label: string; path: string }>;
};

export interface RtaAssistantProps {
  authenticated: boolean;
  path: string;
  request(input: AssistantRequest): Promise<AssistantAnswer>;
  navigate?(path: string): void;
  productLabel?: string;
}

const maxHistory = 8;

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

export function RtaAssistant({ authenticated, path, request, navigate, productLabel = "RTA Assistant" }: RtaAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantHistoryMessage[]>([]);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const suggestions = useMemo(() => initialSuggestions(authenticated), [authenticated]);

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
      setMessages((current) => [...current, { role: "assistant" as const, content: next.answer }].slice(-maxHistory));
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
  }

  return (
    <div className={`rta-assistant ${open ? "is-open" : ""}`}>
      {open && (
        <section className="rta-assistant-panel" aria-label={productLabel}>
          <header className="rta-assistant-header">
            <div>
              <span className="rta-assistant-kicker">RTA INTELLIGENCE</span>
              <h2>{productLabel}</h2>
              <p>{authenticated ? "Grounded in your authorized workspace data." : "Ask about the product, demo, or architecture."}</p>
            </div>
            <div className="rta-assistant-header-actions">
              <button type="button" onClick={reset} aria-label="Clear conversation">Clear</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
            </div>
          </header>
          <div className="rta-assistant-body" aria-live="polite">
            {!messages.length && !answer && (
              <div className="rta-assistant-welcome">
                <span className="rta-assistant-orb">✦</span>
                <strong>{authenticated ? "What should we inspect?" : "How can I help?"}</strong>
                <p>I use verified product knowledge and read-only tools. I will say when data is unavailable.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={`rta-assistant-message ${message.role}`} key={`${message.role}-${index}`}>
                {message.content}
              </div>
            ))}
            {loading && <div className="rta-assistant-message assistant">Checking authorized sources…</div>}
            {answer && !loading && (answer.sources.length > 0 || answer.navigation.length > 0) && (
              <div className="rta-assistant-result">
                {answer.sources.length > 0 && <small>Sources: {answer.sources.map((source) => source.label).join(" · ")}</small>}
                {answer.navigation.length > 0 && navigate && (
                  <div className="rta-assistant-links">
                    {answer.navigation.map((item) => <button type="button" key={item.path} onClick={() => { navigate(item.path); setOpen(false); }}>{item.label} →</button>)}
                  </div>
                )}
              </div>
            )}
            {error && <div className="rta-assistant-error" role="alert">{error}</div>}
          </div>
          <div className="rta-assistant-suggestions">
            {(answer?.suggestions.length ? answer.suggestions : suggestions).map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => void submit(suggestion)} disabled={loading}>{suggestion}</button>
            ))}
          </div>
          <form className="rta-assistant-form" onSubmit={onSubmit}>
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={2_000} placeholder="Ask a question…" aria-label="Ask the RTA assistant" disabled={loading} />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send question">↑</button>
          </form>
          <footer className="rta-assistant-footer">Read-only assistance · Verify decisions before acting</footer>
        </section>
      )}
      <button className="rta-assistant-launcher" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close RTA Assistant" : "Open RTA Assistant"}>
        <span>✦</span><b>{open ? "Close" : "Ask RTA"}</b>
      </button>
    </div>
  );
}
