import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "../lib/useDialogFocus";

interface WorkflowModalProps {
  open: boolean;
  eyebrow: string;
  title: string;
  description?: string;
  busy?: boolean;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusRef?: RefObject<HTMLElement>;
  role?: "dialog" | "alertdialog";
  className?: string;
  onClose(): void;
  children: ReactNode;
}

export function WorkflowModal({
  open,
  eyebrow,
  title,
  description,
  busy = false,
  dismissible = true,
  initialFocusRef,
  returnFocusRef,
  role = "dialog",
  className = "",
  onClose,
  children,
}: WorkflowModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogFocus(dialogRef, open, { onClose, dismissible: dismissible && !busy, initialFocusRef, returnFocusRef });

  if (!open) return null;

  return createPortal(
    <div className="modal-layer" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        disabled={busy || !dismissible}
        onClick={onClose}
        tabIndex={-1}
      />
      <section
        ref={dialogRef}
        className={`workflow-modal ${className}`.trim()}
        role={role}
        aria-busy={busy}
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
          {dismissible && <button
            type="button"
            className="modal-close"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>}
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
