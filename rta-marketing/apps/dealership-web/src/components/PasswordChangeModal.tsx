import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

export function PasswordChangeModal() {
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user?.mustChangePassword) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
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
      toast.error(error instanceof Error ? error.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="password-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
    <section className="password-modal">
      <span className="eyebrow">SECURITY CHECK</span>
      <h2 id="password-modal-title">Set your private password</h2>
      <p>This temporary access password must be replaced before you can use the workspace.</p>
      <form onSubmit={submit}>
        <label>Temporary password<input type="password" autoComplete="current-password" minLength={8} maxLength={200} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<input type="password" autoComplete="new-password" minLength={14} maxLength={200} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={14} maxLength={200} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <button className="submit-button" disabled={submitting}>{submitting ? "Saving…" : "Change password"}</button>
      </form>
      <small>Use at least 14 characters. The temporary password expires with the approved access window.</small>
    </section>
  </div>;
}
