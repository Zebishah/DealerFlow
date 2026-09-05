import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, UserPlus as UserRoundSearch } from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { api, idempotentJson } from "../lib/api";
import type { BootstrapData, Lead, UserRole } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type LeadStatus = Lead["status"];
type LeadForm = {
  sourceId: string;
  assignedToUserId: string;
  externalReference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleInterest: string;
  status: LeadStatus;
  notes: string;
};

const writableRoles: UserRole[] = ["admin", "operator", "employee", "virtual_assistant"];
const emptyForm: LeadForm = {
  sourceId: "",
  assignedToUserId: "",
  externalReference: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  vehicleInterest: "",
  status: "new",
  notes: "",
};

function toForm(lead: Lead): LeadForm {
  return {
    sourceId: lead.sourceId ?? "",
    assignedToUserId: lead.assignedToUserId ?? "",
    externalReference: lead.externalReference ?? "",
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    vehicleInterest: lead.vehicleInterest ?? "",
    status: lead.status,
    notes: lead.notes ?? "",
  };
}

function leadPayload(form: LeadForm) {
  return {
    sourceId: form.sourceId || null,
    assignedToUserId: form.assignedToUserId || null,
    externalReference: form.externalReference.trim() || undefined,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    vehicleInterest: form.vehicleInterest.trim() || null,
    status: form.status,
    notes: form.notes.trim() || null,
  };
}

export function LeadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const canWrite = Boolean(user && writableRoles.includes(user.role));

  const leadsQuery = useQuery({
    queryKey: ["dealership", "leads", deferredQuery, status],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (deferredQuery) params.set("q", deferredQuery);
      if (status) params.set("status", status);
      return api<{ data: Lead[] }>(`/dealership/leads?${params}`).then((result) => result.data);
    },
  });

  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data),
    staleTime: 5 * 60_000,
  });

  const saveLead = useMutation({
    mutationFn: async (submission: { form: LeadForm; lead: Lead | null; idempotencyKey: string }) => {
      const payload = leadPayload(submission.form);
      if (submission.lead) {
        return api<{ data: Lead }>(`/dealership/leads/${submission.lead.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, version: submission.lead.version }),
        });
      }
      return api<{ data: { id: string; version: number } }>(
        "/dealership/leads",
        idempotentJson("POST", payload, submission.idempotencyKey),
      );
    },
    onSuccess: async (_, submission) => {
      toast.success(submission.lead ? "Lead updated" : "Lead created");
      setModalOpen(false);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "summary"] }),
      ]);
    },
    onError: async (error: Error) => {
      toast.error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["dealership", "leads"] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm(toForm(lead));
    setModalOpen(true);
  }

  function closeModal() {
    if (!saveLead.isPending) setModalOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    saveLead.mutate({ form, lead: editing, idempotencyKey: crypto.randomUUID() });
  }

  if (leadsQuery.isLoading) return <PageSkeleton />;
  if (leadsQuery.isError) return <ErrorState message="The lead pipeline is temporarily unavailable." />;

  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div className="search-control">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or vehicle"
            aria-label="Search leads"
          />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        {(query || status) && (
          <button className="filter-button" onClick={() => { setQuery(""); setStatus(""); }}>
            Clear filters
          </button>
        )}
        {canWrite && (
          <button className="primary-action" onClick={openCreate}>
            <Plus size={17} />New lead
          </button>
        )}
      </section>

      <section className="surface data-surface">
        <div className="surface-head">
          <div><span>ACTIVE PIPELINE</span><h3>{leadsQuery.data?.length ?? 0} visible opportunities</h3></div>
        </div>
        {leadsQuery.data?.length ? (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Customer</th><th>Interest</th><th>Contact</th><th>Status</th><th>Updated</th>{canWrite && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {leadsQuery.data.map((lead) => (
                  <tr key={lead.id}>
                    <td><div className="person-cell"><span className="avatar">{lead.firstName[0]}{lead.lastName[0]}</span><div><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.externalReference ?? "Direct lead"}</small></div></div></td>
                    <td>{lead.vehicleInterest ?? "Not specified"}</td>
                    <td><div className="contact-cell"><span>{lead.email ?? "No email"}</span><small>{lead.phone ?? "No phone"}</small></div></td>
                    <td><span className={`status-chip ${lead.status}`}>{lead.status}</span></td>
                    <td>{new Date(lead.updatedAt).toLocaleDateString("en-CA")}</td>
                    {canWrite && <td className="row-actions"><button onClick={() => openEdit(lead)} aria-label={`Edit ${lead.firstName} ${lead.lastName}`}><Pencil size={15} />Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><UserRoundSearch /><strong>No leads match these filters</strong><span>Clear your filters or create a new lead.</span></div>
        )}
      </section>

      <WorkflowModal
        open={modalOpen}
        eyebrow={editing ? "PIPELINE UPDATE" : "NEW OPPORTUNITY"}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : "Create lead"}
        description="Keep contact, ownership, and status information reliable for the whole team."
        busy={saveLead.isPending}
        onClose={closeModal}
      >
        <form className="workflow-form" onSubmit={submit}>
          <div className="form-grid">
            <label>First name<input required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label>Last name<input required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
            <label>Email<input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<input type="tel" minLength={7} maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Lead source<select value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })}><option value="">Not specified</option>{bootstrap.data?.leadSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
            <label>Assigned team member<select value={form.assignedToUserId} onChange={(event) => setForm({ ...form, assignedToUserId: event.target.value })}><option value="">Unassigned</option>{bootstrap.data?.team.filter((member) => member.isActive).map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>
            <label>Pipeline status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeadStatus })}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="lost">Lost</option></select></label>
            <label>External reference<input maxLength={100} value={form.externalReference} onChange={(event) => setForm({ ...form, externalReference: event.target.value })} /></label>
            <label className="form-span">Vehicle interest<input maxLength={200} value={form.vehicleInterest} onChange={(event) => setForm({ ...form, vehicleInterest: event.target.value })} placeholder="Year, make, model, or stock preference" /></label>
            <label className="form-span">Notes<textarea maxLength={4000} rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          </div>
          <footer className="modal-actions">
            <button type="button" className="filter-button" disabled={saveLead.isPending} onClick={closeModal}>Cancel</button>
            <button type="submit" className="primary-action" disabled={saveLead.isPending}>{saveLead.isPending ? "Saving…" : editing ? "Save changes" : "Create lead"}</button>
          </footer>
        </form>
      </WorkflowModal>
    </div>
  );
}
