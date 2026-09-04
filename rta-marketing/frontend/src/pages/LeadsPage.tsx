import { useQuery } from "@tanstack/react-query";
import { Filter, Plus, Search, UserPlus as UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import type { Lead } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

export function LeadsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const leads = useQuery({
    queryKey: ["dealership", "leads", query, status],
    queryFn: () => { const params = new URLSearchParams({ limit: "50" }); if (query) params.set("q", query); if (status) params.set("status", status); return api<{ data: Lead[] }>(`/dealership/leads?${params}`).then((result) => result.data); },
  });
  if (leads.isLoading) return <PageSkeleton />;
  if (leads.isError) return <ErrorState message="The lead pipeline is temporarily unavailable." />;
  return <div className="page-stack"><section className="page-toolbar"><div className="search-control"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or vehicle" /></div><button className="filter-button"><Filter size={17} />Filters</button><button className="primary-action"><Plus size={17} />New lead</button></section><section className="surface data-surface"><div className="surface-head"><div><span>ACTIVE PIPELINE</span><h3>{leads.data?.length ?? 0} visible opportunities</h3></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="lost">Lost</option></select></div>{leads.data?.length ? <div className="responsive-table"><table><thead><tr><th>Customer</th><th>Interest</th><th>Contact</th><th>Status</th><th>Updated</th></tr></thead><tbody>{leads.data.map((lead) => <tr key={lead.id}><td><div className="person-cell"><span className="avatar">{lead.firstName[0]}{lead.lastName[0]}</span><div><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.externalReference ?? "Direct lead"}</small></div></div></td><td>{lead.vehicleInterest ?? "Not specified"}</td><td><div className="contact-cell"><span>{lead.email ?? "No email"}</span><small>{lead.phone ?? "No phone"}</small></div></td><td><span className={`status-chip ${lead.status}`}>{lead.status}</span></td><td>{new Date(lead.updatedAt).toLocaleDateString("en-CA")}</td></tr>)}</tbody></table></div> : <div className="empty-state"><UserRoundSearch /><strong>No leads match these filters</strong><span>Clear your filters or create a new lead.</span></div>}</section></div>;
}
