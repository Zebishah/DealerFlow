import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, ExternalLink, Mail, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { AccessRequest } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const grantOptions = [
  ["dealership.leads.write", "Create and edit leads"],
  ["dealership.sales.write", "Create and edit sales"],
  ["dealership.documents.read", "View document metadata"],
  ["dealership.documents.upload", "Upload documents"],
  ["scraping.jobs.trigger", "Run approved scraping"],
  ["scraping.jobs.live", "Run live scraping"],
] as const;

function label(value: string): string { return value.replaceAll("_", " ").replaceAll(".", " · "); }

export function AccessRequestsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [grants, setGrants] = useState<string[]>([]);
  const requests = useQuery({ queryKey: ["dealership", "access-requests"], queryFn: () => api<{ data: AccessRequest[] }>("/dealership/admin/access-requests").then((result) => result.data) });
  const review = useMutation({
    mutationFn: ({ request, action }: { request: AccessRequest; action: "approve" | "reject" | "revoke" | "extend" }) => api<{ data: { invitationSent?: boolean; notificationFailed?: boolean } }>(`/dealership/admin/access-requests/${request.id}`, { method: "PATCH", body: JSON.stringify(action === "approve" ? { action, grantedPermissions: grants, duration: request.requestedDuration === "7_days" ? "7_days" : request.requestedDuration === "3_days" ? "3_days" : "24_hours" } : action === "extend" ? { action, duration: "7_days" } : { action }) }),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["dealership", "access-requests"] });
      if (variables.action === "approve") toast.success(result.data.notificationFailed ? "Approved, but the invitation email failed. Use resend notification." : "Approved. A secure invitation was emailed.");
      else toast.success(variables.action === "extend" ? "Access extended" : `Request ${variables.action}d`);
      setSelected(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (requests.isLoading) return <PageSkeleton />;
  if (requests.isError) return <ErrorState message="Access requests are unavailable." />;
  const pending = requests.data?.filter((request) => request.status === "pending") ?? [];
  return <div className="page-stack"><section className="page-intro"><div><span>CONTROLLED EVALUATION ACCESS</span><h2>Review recruiter requests.</h2><p>Approve narrowly scoped, expiring access without turning an external reviewer into an administrator.</p></div><span className="status-chip approved">{pending.length} pending</span></section><section className="surface access-request-list">{requests.data?.length ? requests.data.map((request) => <article key={request.id}><div className="access-request-person"><span>{request.fullName.slice(0, 2).toUpperCase()}</span><div><strong>{request.fullName}</strong><small>{request.jobTitle} · {request.company}</small><small>{request.email}</small></div></div><div><span className={`status-chip ${request.status}`}>{request.status}</span><small>{new Date(request.createdAt).toLocaleDateString("en-CA")}</small></div><div className="access-request-scope"><strong>{request.platformScope.join(" + ")}</strong><small>{request.requestedPermissions.map(label).join(", ")}</small></div><div className="access-request-actions">{request.linkedInUrl && <a href={request.linkedInUrl} target="_blank" rel="noreferrer" aria-label="Open LinkedIn profile"><ExternalLink size={14} /></a>}{request.status === "pending" && <><button className="small-action" onClick={() => { setSelected(request); setGrants(["dealership.documents.read"]); }}><Check size={14} />Review</button><button className="icon-danger" onClick={() => review.mutate({ request, action: "reject" })} aria-label="Reject request"><X size={14} /></button></>}{request.status === "approved" && <><button className="small-action" onClick={() => review.mutate({ request, action: "extend" })}><Clock3 size={14} />Extend</button><button className="small-action" onClick={() => void api(`/dealership/admin/access-requests/${request.id}/resend-notification`, { method: "POST" }).then(() => toast.success("Notification resent")).catch((error: Error) => toast.error(error.message))}><Mail size={14} />Resend</button><button className="small-action" onClick={() => review.mutate({ request, action: "revoke" })}><ShieldAlert size={14} />Revoke</button></>}</div></article>) : <div className="empty-state"><Clock3 /><strong>No access requests yet</strong><span>New recruiter requests will appear here.</span></div>}</section>{selected && <div className="access-modal-backdrop" role="presentation"><section className="access-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow">ADMIN REVIEW</span><h2>Approve scoped access</h2><p>{selected.fullName} · {selected.company} · {selected.email}</p></div><button type="button" className="modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button></header><div className="request-review-detail"><p><strong>Reason:</strong> {selected.reason}</p><p><strong>Requested:</strong> {selected.requestedPermissions.map(label).join(", ")}</p><fieldset><legend>Granted permissions</legend>{grantOptions.map(([value, text]) => <label key={value} className="permission-row"><input type="checkbox" checked={grants.includes(value)} onChange={() => setGrants((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />{text}</label>)}</fieldset><p className="review-warning"><ShieldAlert size={16} />User management, role changes, deletion, production settings and unrestricted scraping are never granted here.</p></div><footer className="modal-actions"><button type="button" className="filter-button" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="primary-action" disabled={review.isPending || !grants.length} onClick={() => review.mutate({ request: selected, action: "approve" })}>{review.isPending ? "Approving…" : "Approve and send secure invitation"}</button></footer></section></div>}</div>;
}
