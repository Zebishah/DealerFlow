import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { WorkflowModal } from "./WorkflowModal";
import { LoadingButton } from "./LoadingButton";

export function PasswordChangeModal({ suspended = false, onSignOut }: { suspended?: boolean; onSignOut(): void }) {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user?.mustChangePassword) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await refresh();
      toast.success("Password changed. Your workspace is unlocked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  return <WorkflowModal open={!suspended} dismissible={false} className="confirmation-modal" eyebrow="SECURITY CHECK" title="Set your private password" description="Replace your temporary password before using the workspace. Use at least 14 characters for your new password." busy={submitting} onClose={() => undefined}>
    <form className="workflow-form" onSubmit={submit} aria-busy={submitting}>
      <div className="form-grid">
        <label className="form-span">Temporary password<input type="password" autoComplete="current-password" minLength={8} maxLength={200} required disabled={submitting} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label className="form-span">New password<input type="password" autoComplete="new-password" minLength={14} maxLength={200} required disabled={submitting} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label className="form-span">Confirm new password<input type="password" autoComplete="new-password" minLength={14} maxLength={200} required disabled={submitting} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions">
        <button type="button" className="filter-button" disabled={submitting} onClick={onSignOut}>Sign out instead</button>
        <LoadingButton type="submit" loading={submitting} loadingLabel="Saving…">Change password</LoadingButton>
      </footer>
    </form>
  </WorkflowModal>;
}
