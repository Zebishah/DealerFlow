import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export function LoadingButton({ loading = false, loadingLabel = "Working…", children, disabled, className = "primary-action", ...props }: LoadingButtonProps) {
  return <button {...props} className={className} disabled={disabled || loading} aria-busy={loading}>
    {loading ? <><Loader2 className="button-loader" size={14} aria-hidden="true" />{loadingLabel}</> : children}
  </button>;
}
