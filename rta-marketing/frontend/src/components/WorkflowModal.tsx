import { useEffect, useId, useRef, type ReactNode } from "react";
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

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function WorkflowModal({
  open,
  eyebrow,
  title,
  description,
  busy = false,
  onClose,
  children,
}: WorkflowModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;

    document.body.style.overflow = "hidden";
    const initialFocus = window.setTimeout(() => {
      const firstControl = dialog?.querySelector<HTMLElement>(focusableSelector);
      (firstControl ?? dialog)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0);

      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(initialFocus);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-layer" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        disabled={busy}
        onClick={onClose}
        tabIndex={-1}
      />
      <section
        ref={dialogRef}
        className="workflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <span>{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
