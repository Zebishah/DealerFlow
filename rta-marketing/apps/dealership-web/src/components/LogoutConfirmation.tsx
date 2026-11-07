import { LogOut } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "../router/Navigation";
import { WorkflowModal } from "./WorkflowModal";
import { LoadingButton } from "./LoadingButton";

export function LogoutConfirmation({ onClose, returnFocusRef }: { onClose(): void; returnFocusRef: RefObject<HTMLElement> }) {
  const { logout } = useAuth();
  const { navigate } = useNavigation();
  const cancel = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await logout();
      navigate("/login", { replace: true });
      toast.success("You’ve been signed out.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
      setBusy(false);
    } finally {
      inFlight.current = false;
    }
  }

  return <WorkflowModal open role="alertdialog" className="confirmation-modal" eyebrow="ACCOUNT" title="Sign out of Dealer Flow?" description="You’ll return to the sign-in page. Any unsaved changes on this page will be lost." busy={busy} onClose={onClose} initialFocusRef={cancel} returnFocusRef={returnFocusRef}>
    <div className="confirmation-content">
      {error && <p className="form-error" role="alert">{error} Please try again to finish signing out.</p>}
      <footer className="modal-actions">
        <button ref={cancel} type="button" className="filter-button" disabled={busy} onClick={onClose}>Stay signed in</button>
        <LoadingButton type="button" loading={busy} loadingLabel="Signing out…" onClick={() => void signOut()}><LogOut size={16} aria-hidden="true" />Sign out</LoadingButton>
      </footer>
    </div>
  </WorkflowModal>;
}
