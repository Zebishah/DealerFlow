import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Landmark, Link2, Plus, ScrollText, ToggleLeft, ToggleRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { AuditEvent, BootstrapData, NamedResource } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";
import { WorkflowModal } from "../components/WorkflowModal";

type ResourceKind = "lead-sources" | "finance-providers";

function ResourcePanel({ kind, title, description, icon: Icon }: {
  kind: ResourceKind;
  title: string;
  description: string;
  icon: typeof Link2;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const resource = useQuery({
    queryKey: ["dealership", "admin", kind],
    queryFn: () => api<{ data: NamedResource[] }>(`/dealership/admin/${kind}`).then((result) => result.data),
  });
  const create = useMutation({
    mutationFn: (resourceName: string) => api(`/dealership/admin/${kind}`, { method: "POST", body: JSON.stringify({ name: resourceName }) }),
    onSuccess: async () => {
      setName("");
      toast.success(title.slice(0, -1) + " created");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "admin", kind] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "bootstrap"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: (item: NamedResource) => api(`/dealership/admin/${kind}/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !item.isActive }) }),
    onSuccess: async () => {
      toast.success("Configuration updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "admin", kind] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "bootstrap"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (value.length >= 2) create.mutate(value);
  }

  return <article className="surface resource-panel">
    <div className="resource-heading"><span><Icon /></span><div><h3>{title}</h3><p>{description}</p></div></div>
    <form className="inline-create" onSubmit={submit}><input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={`New ${title.toLowerCase().slice(0, -1)} name`} /><button className="primary-action" disabled={create.isPending}><Plus size={16} />Add</button></form>
    {resource.isLoading ? <div className="mini-loading">Loading configuration…</div> : resource.isError ? <p className="inline-error">Configuration could not be loaded.</p> : <div className="resource-list">{resource.data?.map((item) => <div key={item.id}><div><strong>{item.name}</strong><small>{item.isActive ? "Available in operational forms" : "Inactive and hidden from new records"}</small></div><button disabled={toggle.isPending} onClick={() => toggle.mutate(item)} aria-label={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}`}>{item.isActive ? <ToggleRight /> : <ToggleLeft />}<span>{item.isActive ? "Active" : "Inactive"}</span></button></div>)}</div>}
  </article>;
}

export function ConfigurationPage() {
  const { user } = useAuth();
  const bootstrap = useQuery({ queryKey: ["dealership", "bootstrap"], queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data), enabled: user?.role === "recruiter" });
  if (user?.role === "recruiter") return <div className="page-stack"><section className="page-intro"><div><span>WORKSPACE CONFIGURATION</span><h2>Reference data visibility.</h2><p>Recruiter demo access can inspect the values used by operational workflows. Changes require approved access.</p></div></section><section className="configuration-grid"><article className="surface resource-panel"><div className="resource-heading"><span><Link2 /></span><div><h3>Lead sources</h3><p>Channels used to attribute incoming opportunities.</p></div></div><div className="resource-list">{bootstrap.data?.leadSources.map((item) => <div key={item.id}><div><strong>{item.name}</strong><small>Available in operational forms</small></div><span className="status-chip completed">Active</span></div>)}</div></article><article className="surface resource-panel"><div className="resource-heading"><span><Landmark /></span><div><h3>Finance providers</h3><p>Reference partners available on deal entry.</p></div></div><div className="resource-list">{bootstrap.data?.financeProviders.map((item) => <div key={item.id}><div><strong>{item.name}</strong><small>Available in operational forms</small></div><span className="status-chip completed">Active</span></div>)}</div></article></section></div>;
  return <div className="page-stack">
    <section className="page-intro"><div><span>WORKSPACE CONFIGURATION</span><h2>Controlled reference data.</h2><p>Deactivate values instead of deleting historical references, preserving reporting integrity across existing leads and sales.</p></div></section>
    <section className="configuration-grid"><ResourcePanel kind="lead-sources" title="Lead sources" description="Channels used to attribute incoming opportunities." icon={Link2} /><ResourcePanel kind="finance-providers" title="Finance providers" description="Approved funding partners available on deal entry." icon={Landmark} /></section>
  </div>;
}

export function AuditPage() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const events = useQuery({
    queryKey: ["dealership", "admin", "audit-events"],
    queryFn: () => api<{ data: AuditEvent[] }>(`${user?.role === "recruiter" ? "/dealership/audit-events" : "/dealership/admin/audit-events"}?limit=100`).then((result) => result.data),
    refetchInterval: 30_000,
  });
  if (events.isLoading) return <PageSkeleton />;
  if (events.isError) return <ErrorState message="Audit history is unavailable." />;
  return <div className="page-stack">
    <section className="page-intro"><div><span>ACCOUNTABILITY</span><h2>Operational audit history.</h2><p>Security-sensitive and business-critical mutations are recorded with actor, entity, and server timestamp.</p></div></section>
    <section className="surface audit-surface">
      <div className="surface-head"><div><span>RECENT EVENTS</span><h3>{events.data?.length ?? 0} recorded changes</h3></div></div>
      {events.data?.length ? <div className="audit-list">{events.data.map((event) => <article key={event.id}><span><ScrollText /></span><div><strong>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong><p>{event.entityType.replaceAll("_", " ")} · {event.entityId.slice(0, 12)}</p></div><div className="audit-event-meta"><strong>{[event.actorFirstName, event.actorLastName].filter(Boolean).join(" ") || event.actorEmail || "System"}</strong><time>{new Date(event.createdAt).toLocaleString("en-CA")}</time><button type="button" className="audit-view-button" onClick={() => setSelectedEvent(event)}><Eye size={12} />View details</button></div></article>)}</div> : <div className="empty-state"><ScrollText /><strong>No audit events yet</strong><span>Changes will appear after an operational mutation.</span></div>}
    </section>
    <WorkflowModal open={Boolean(selectedEvent)} eyebrow="AUDIT EVENT" title="Recorded operation" description="This is the security record for the selected workspace change." onClose={() => setSelectedEvent(null)}>
      {selectedEvent && <div className="audit-detail"><div><span>Action</span><strong>{selectedEvent.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong></div><div><span>Entity</span><strong>{selectedEvent.entityType.replaceAll("_", " ")}</strong><small>{selectedEvent.entityId}</small></div><div><span>Actor</span><strong>{[selectedEvent.actorFirstName, selectedEvent.actorLastName].filter(Boolean).join(" ") || selectedEvent.actorEmail || "System"}</strong><small>{new Date(selectedEvent.createdAt).toLocaleString("en-CA")}</small></div>{Object.keys(selectedEvent.metadata).length > 0 && <div><span>Recorded details</span><dl>{Object.entries(selectedEvent.metadata).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></div>}<footer className="modal-actions"><button type="button" className="primary-action" onClick={() => setSelectedEvent(null)}>Close</button></footer></div>}
    </WorkflowModal>
  </div>;
}
