import { Car } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./loading-states.css";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};
export function DealerFlowSpinner({ label = "Loading" }: { label?: string }) {
  return <span className="df-action-spinner" role="status" aria-label={label}>
    <span className="df-action-spinner__ring" aria-hidden="true" />
    <Car aria-hidden="true" size={12} />
  </span>;
}
export function LoadingButton({ loading = false, loadingLabel = "Working…", children, disabled, className = "primary-action", ...props }: LoadingButtonProps) {
  return <button {...props} className={className} disabled={disabled || loading} aria-busy={loading}>
    {loading ? <><DealerFlowSpinner label={loadingLabel} />{loadingLabel}</> : children}
  </button>;
}
export function DealerFlowPageLoader({ message = "Preparing your workspace" }: { message?: string }) {
  return <main className="df-page-loader" role="status" aria-live="polite">
    <div className="df-page-loader__logo"><Car aria-hidden="true" size={32} /></div>
    <strong>Dealer Flow</strong><span>{message}</span>
  </main>;
}
