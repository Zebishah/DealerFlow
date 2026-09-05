import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Link2, Plus, ScrollText, ToggleLeft, ToggleRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { AuditEvent, NamedResource } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

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
  return <div className="page-stack">
    <section className="page-intro"><div><span>WORKSPACE CONFIGURATION</span><h2>Controlled reference data.</h2><p>Deactivate values instead of deleting historical references, preserving reporting integrity across existing leads and sales.</p></div></section>
    <section className="configuration-grid"><ResourcePanel kind="lead-sources" title="Lead sources" description="Channels used to attribute incoming opportunities." icon={Link2} /><ResourcePanel kind="finance-providers" title="Finance providers" description="Approved funding partners available on deal entry." icon={Landmark} /></section>
  </div>;
}

export function AuditPage() {
  const events = useQuery({
    queryKey: ["dealership", "admin", "audit-events"],
    queryFn: () => api<{ data: AuditEvent[] }>("/dealership/admin/audit-events?limit=100").then((result) => result.data),
    refetchInterval: 30_000,
  });
  if (events.isLoading) return <PageSkeleton />;
  if (events.isError) return <ErrorState message="Audit history is unavailable." />;
  return <div className="page-stack">
    <section className="page-intro"><div><span>ACCOUNTABILITY</span><h2>Operational audit history.</h2><p>Security-sensitive and business-critical mutations are recorded with actor, entity, and server timestamp.</p></div></section>
    <section className="surface audit-surface">
      <div className="surface-head"><div><span>RECENT EVENTS</span><h3>{events.data?.length ?? 0} recorded changes</h3></div></div>
      {events.data?.length ? <div className="audit-list">{events.data.map((event) => <article key={event.id}><span><ScrollText /></span><div><strong>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong><p>{event.entityType.replaceAll("_", " ")} · {event.entityId.slice(0, 12)}</p></div><div><strong>{[event.actorFirstName, event.actorLastName].filter(Boolean).join(" ") || event.actorEmail || "System"}</strong><time>{new Date(event.createdAt).toLocaleString("en-CA")}</time></div></article>)}</div> : <div className="empty-state"><ScrollText /><strong>No audit events yet</strong><span>Changes will appear after an operational mutation.</span></div>}
    </section>
  </div>;
}
