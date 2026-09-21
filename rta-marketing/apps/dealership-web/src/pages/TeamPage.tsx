import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { LoadingButton } from "../components/LoadingButton";
import { api } from "../lib/api";
import type { AdminUser, BootstrapData, UserRole } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type WorkspaceRole = Exclude<UserRole, "operator">;
type MemberForm = {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
  isActive: boolean;
  password: string;
};

const emptyMember: MemberForm = {
  email: "",
  firstName: "",
  lastName: "",
  role: "employee",
  isActive: true,
  password: "",
};

export function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyMember);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | WorkspaceRole>("all");

  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data),
    staleTime: 5 * 60_000,
  });
  const adminUsers = useQuery({
    queryKey: ["dealership", "admin", "users"],
    queryFn: () => api<{ data: AdminUser[] }>("/dealership/admin/users").then((result) => result.data),
    enabled: isAdmin,
  });

  const saveMember = useMutation({
    mutationFn: ({ member, value }: { member: AdminUser | null; value: MemberForm }) => {
      if (member) {
        return api<{ data: AdminUser }>(`/dealership/admin/users/${member.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            role: value.role,
            isActive: value.isActive,
            ...(value.password ? { password: value.password } : {}),
          }),
        });
      }
      return api<{ data: AdminUser }>("/dealership/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: value.email.trim(),
          password: value.password,
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          role: value.role,
        }),
      });
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.member ? "Team member updated" : "Team member created");
      setModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "bootstrap"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyMember);
    setModalOpen(true);
  }

  function openEdit(member: AdminUser) {
    setEditing(member);
    setForm({
      email: member.email,
      firstName: member.firstName ?? "",
      lastName: member.lastName ?? "",
      role: member.role === "operator" ? "viewer" : member.role,
      isActive: member.isActive,
      password: "",
    });
    setModalOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && form.password.length < 14) {
      toast.error("A password of at least 14 characters is required");
      return;
    }
    saveMember.mutate({ member: editing, value: form });
  }

  const loading = bootstrap.isLoading || (isAdmin && adminUsers.isLoading);
  const error = bootstrap.isError || (isAdmin && adminUsers.isError);
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message="Team data is unavailable." />;

  const members: AdminUser[] = isAdmin
    ? adminUsers.data ?? []
    : (bootstrap.data?.team ?? []).map((member) => ({
        ...member,
        createdAt: "",
        updatedAt: "",
      }));
  const filteredMembers = members.filter((member) => {
    const normalized = search.trim().toLowerCase();
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const matchesSearch = !normalized || [member.firstName, member.lastName, member.email].filter(Boolean).join(" ").toLowerCase().includes(normalized);
    return matchesRole && matchesSearch;
  });
  const activeMembers = members.filter((member) => member.isActive).length;
  const activeSalespeople = members.filter((member) => member.isActive && member.role === "employee").length;
  const supportMembers = members.filter((member) => member.isActive && member.role === "virtual_assistant").length;

  return (
    <div className="page-stack">
      <section className="page-intro admin-intro">
        <div>
          <span>PEOPLE & ACCESS</span>
          <h2>One team, clear responsibilities.</h2>
          <p>{user?.role === "recruiter" ? "Review team coverage, active capacity, and role readiness without access to administrative controls." : "Workspace-scoped roles restrict sensitive operations while account changes remain visible and auditable."}</p>
        </div>
        {isAdmin && <button className="light-action" onClick={openCreate}><Plus size={17} />Add team member</button>}
      </section>

      <section className="feature-metrics team-metrics">
        <article><span>Active people</span><strong>{activeMembers}</strong></article>
        <article><span>Sales capacity</span><strong>{activeSalespeople}</strong></article>
        <article><span>Lead support</span><strong>{supportMembers}</strong></article>
      </section>

      <section className="surface team-directory-controls">
        <div><span>TEAM DIRECTORY</span><h3>Find the right person quickly</h3></div>
        <div className="team-filter-row"><label className="team-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" /></label><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="all">All roles</option><option value="admin">Administrators</option><option value="employee">Salespeople</option><option value="virtual_assistant">Virtual assistants</option><option value="recruiter">Recruiters</option><option value="viewer">Viewers</option></select></div>
      </section>

      <section className="team-grid">
        {filteredMembers.map((member) => (
          <article className="team-card" key={member.id}>
            <span className="avatar large">{member.firstName?.[0] ?? member.email[0]}{member.lastName?.[0] ?? ""}</span>
            <div>
              <h3>{[member.firstName, member.lastName].filter(Boolean).join(" ") || "Team member"}</h3>
              <p>{member.email}</p>
              <span className="role-chip">{member.role.replace("_", " ")}</span>
            </div>
            <i className={member.isActive ? "active" : ""} title={member.isActive ? "Active" : "Inactive"} />
            {isAdmin && <button className="card-action" onClick={() => openEdit(member)}><Pencil size={14} />Manage</button>}
          </article>
        ))}
      </section>

      {!filteredMembers.length && <div className="surface empty-state"><Users /><strong>{members.length ? "No matching team members" : "No team members"}</strong><span>{members.length ? "Try a different role or search term." : "Add the first workspace member."}</span></div>}

      <section className="architecture-note">
        <ShieldCheck />
        <div><strong>Server-enforced access</strong><p>Navigation visibility improves UX, while every sensitive API route independently verifies the session, workspace, role, and CSRF token.</p></div>
      </section>

      <WorkflowModal
        open={modalOpen}
        eyebrow={editing ? "ACCOUNT MANAGEMENT" : "TEAM ONBOARDING"}
        title={editing ? "Manage team member" : "Add team member"}
        description={editing ? "Update role, access status, profile, or issue a password reset." : "Create a workspace-scoped account with least-privilege access."}
        busy={saveMember.isPending}
        onClose={() => { if (!saveMember.isPending) setModalOpen(false); }}
      >
        <form className="workflow-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-span">Email<input required type="email" maxLength={254} disabled={Boolean(editing)} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>First name<input required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label>Last name<input required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
            <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as WorkspaceRole })}><option value="admin">Administrator</option><option value="employee">Employee / salesperson</option><option value="virtual_assistant">Virtual assistant</option><option value="recruiter">Recruiter reviewer</option><option value="viewer">Read-only viewer</option></select></label>
            {editing && <label>Access status<select value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm({ ...form, isActive: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
            <label className="form-span">{editing ? "New password (optional)" : "Temporary password"}<input required={!editing} type="password" minLength={14} maxLength={200} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><small>{editing ? "Leave blank to keep the current password. Resetting it revokes existing sessions." : "Use at least 14 characters and share it securely."}</small></label>
          </div>
          <footer className="modal-actions"><button type="button" className="filter-button" disabled={saveMember.isPending} onClick={() => setModalOpen(false)}>Cancel</button><LoadingButton type="submit" loading={saveMember.isPending} loadingLabel="Saving…">{editing ? "Save changes" : "Create account"}</LoadingButton></footer>
        </form>
      </WorkflowModal>
    </div>
  );
}
