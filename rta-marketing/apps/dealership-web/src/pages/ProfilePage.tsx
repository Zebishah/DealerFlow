import { useMutation } from "@tanstack/react-query";
import { KeyRound, Save, ShieldCheck, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profile = useMutation({
    mutationFn: () => api("/auth/profile", { method: "PATCH", body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }) }),
    onSuccess: async () => {
      await refresh();
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const password = useMutation({
    mutationFn: () => api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed and other sessions were signed out");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    profile.mutate();
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password confirmation does not match");
      return;
    }
    password.mutate();
  }

  return <div className="page-stack">
    <section className="page-intro"><div><span>ACCOUNT SECURITY</span><h2>Your profile and credentials.</h2><p>Update identity information and rotate your password without exposing authentication secrets to the browser.</p></div></section>
    <section className="settings-grid">
      <form className="surface settings-card" onSubmit={saveProfile}>
        <header><span><User /></span><div><h3>Profile information</h3><p>Your role and email are controlled by an administrator.</p></div></header>
        <div className="settings-fields"><label>Email<input value={user?.email ?? ""} disabled /></label><label>Role<input className="capitalize" value={user?.role.replace("_", " ") ?? ""} disabled /></label><label>First name<input required minLength={1} maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Last name<input required minLength={1} maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
        <footer><button className="primary-action" disabled={profile.isPending}><Save size={16} />{profile.isPending ? "Saving…" : "Save profile"}</button></footer>
      </form>
      <form className="surface settings-card" onSubmit={changePassword}>
        <header><span><KeyRound /></span><div><h3>Change password</h3><p>Changing your password revokes every other active session.</p></div></header>
        <div className="settings-fields single"><label>Current password<input required type="password" minLength={8} maxLength={200} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input required type="password" minLength={14} maxLength={200} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input required type="password" minLength={14} maxLength={200} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div>
        <footer><button className="primary-action" disabled={password.isPending}><ShieldCheck size={16} />{password.isPending ? "Updating…" : "Update password"}</button></footer>
      </form>
    </section>
  </div>;
}
