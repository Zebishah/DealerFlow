import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface WorkflowModalProps {
  open: boolean;
  eyebrow: string;
  title: string;
  description?: string;
  busy?: boolean;
  onClose(): void;
  children: ReactNode;
}

export function WorkflowModal({
  open,
  eyebrow,
  title,
  description,
  busy = false,
  onClose,
  children,
}: WorkflowModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-layer" role="presentation">
      <button
        className="modal-backdrop"
        aria-label="Close dialog"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="workflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-modal-title"
      >
        <header className="modal-header">
          <div>
            <span>{eyebrow}</span>
            <h2 id="workflow-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
