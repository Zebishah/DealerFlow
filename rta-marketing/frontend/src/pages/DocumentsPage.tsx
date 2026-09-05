import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Download, FileText, Trash2, Upload, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { api } from "../lib/api";
import type { BootstrapData, EmployeeDocument } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type DocumentKind = EmployeeDocument["kind"];
type UploadIntent = {
  storageKey: string;
  url: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
};

const kindLabels: Record<DocumentKind, string> = {
  insurance: "Insurance policy",
  drivers_license: "Driver’s licence",
  omvic: "OMVIC certification",
  employment: "Employment document",
  other: "Other document",
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DocumentKind>("insurance");
  const [userId, setUserId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const documents = useQuery({
    queryKey: ["dealership", "documents"],
    queryFn: () => api<{ data: EmployeeDocument[] }>("/dealership/documents").then((value) => value.data),
  });
  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((value) => value.data),
    staleTime: 5 * 60_000,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a document");
      const targetUserId = isAdmin ? userId : undefined;
      if (isAdmin && !targetUserId) throw new Error("Select an employee");
      const metadata = {
        userId: targetUserId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      const intent = await api<{ data: UploadIntent }>("/dealership/documents/upload-intents", {
        method: "POST",
        body: JSON.stringify(metadata),
      });
      const put = await fetch(intent.data.url, {
        method: "PUT",
        headers: intent.data.headers,
        body: file,
      });
      if (!put.ok) throw new Error("The private document upload failed");
      return api("/dealership/documents/complete", {
        method: "POST",
        body: JSON.stringify({
          ...metadata,
          storageKey: intent.data.storageKey,
          kind,
          expiresAt: expiresAt ? new Date(`${expiresAt}T12:00:00`).toISOString() : null,
          checksumSha256: await sha256(file),
        }),
      });
    },
    onSuccess: async () => {
      toast.success("Document uploaded for review");
      setModalOpen(false);
      setFile(null);
      setExpiresAt("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "documents"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "admin", "audit-events"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "verified" | "rejected" }) =>
      api(`/dealership/documents/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (_data, input) => {
      toast.success(input.status === "verified" ? "Document verified" : "Document rejected");
      await queryClient.invalidateQueries({ queryKey: ["dealership", "documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/dealership/documents/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Document deleted");
      await queryClient.invalidateQueries({ queryKey: ["dealership", "documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function download(document: EmployeeDocument) {
    try {
      const result = await api<{ data: { url: string } }>(`/dealership/documents/${document.id}/download`);
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document could not be opened");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upload.mutate();
  }

  if (documents.isLoading) return <PageSkeleton />;
  if (documents.isError) return <ErrorState message="Employee documents could not be loaded." />;

  const expiring = documents.data?.filter((document) => document.expiresAt && new Date(document.expiresAt).getTime() < Date.now() + 30 * 86_400_000).length ?? 0;

  return <div className="page-stack">
    <section className="page-intro"><div><span>PRIVATE COMPLIANCE VAULT</span><h2>Employee documents.</h2><p>Private S3 storage, short-lived access links, expiry tracking and recorded administrator review.</p></div><button className="primary-action" onClick={() => setModalOpen(true)}><Upload size={16} />Upload document</button></section>
    <section className="inline-metrics"><div><span>Total records</span><strong>{documents.data?.length ?? 0}</strong></div><div><span>Awaiting review</span><strong>{documents.data?.filter((item) => item.status === "pending").length ?? 0}</strong></div><div><span>Expiring within 30 days</span><strong>{expiring}</strong></div></section>
    <section className="surface data-surface">
      <div className="surface-head"><div><span>COMPLIANCE REGISTER</span><h3>Uploaded credentials and policies</h3></div></div>
      {documents.data?.length ? <div className="responsive-table"><table><thead><tr><th>Employee</th><th>Document</th><th>Uploaded</th><th>Expiry</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{documents.data.map((document) => <tr key={document.id}><td><strong>{[document.firstName, document.lastName].filter(Boolean).join(" ") || document.email}</strong><small>{document.email}</small></td><td><strong>{kindLabels[document.kind]}</strong><small>{document.fileName} · {(document.sizeBytes / 1_000_000).toFixed(2)} MB</small></td><td>{new Date(document.createdAt).toLocaleDateString("en-CA")}</td><td>{document.expiresAt ? new Date(document.expiresAt).toLocaleDateString("en-CA") : "Not specified"}</td><td><span className={`status-chip ${document.status}`}>{document.status}</span></td><td><div className="document-actions"><button onClick={() => void download(document)} title="Open private document" aria-label="Open private document"><Download size={15} /></button>{isAdmin && document.status === "pending" && <><button className="approve" disabled={review.isPending} onClick={() => review.mutate({ id: document.id, status: "verified" })} title="Verify"><CheckCircle size={15} /></button><button className="reject" disabled={review.isPending} onClick={() => review.mutate({ id: document.id, status: "rejected" })} title="Reject"><XCircle size={15} /></button></>}{(isAdmin || document.status === "pending") && <button className="reject" disabled={remove.isPending} onClick={() => remove.mutate(document.id)} title="Delete"><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div> : <div className="empty-state"><FileText /><strong>No compliance documents</strong><span>Upload an insurance policy, licence or certification to begin.</span></div>}
    </section>
    <WorkflowModal open={modalOpen} eyebrow="SECURE UPLOAD" title="Upload employee document" description="PDF, JPEG or PNG only. The browser uploads directly to encrypted private S3 storage using a five-minute URL." busy={upload.isPending} onClose={() => !upload.isPending && setModalOpen(false)}>
      <form className="workflow-form" onSubmit={submit}><div className="form-grid">{isAdmin && <label className="form-span">Employee<select required value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Select employee</option>{bootstrap.data?.team.filter((member) => member.isActive && member.role === "employee").map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>}<label>Document type<select value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Expiry date<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><label className="form-span upload-drop">File<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? `${file.name} · ${(file.size / 1_000_000).toFixed(2)} MB` : "Choose a PDF, JPEG or PNG document"}</span></label></div><footer className="modal-actions"><button type="button" className="filter-button" disabled={upload.isPending} onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-action" disabled={upload.isPending}>{upload.isPending ? "Encrypting and uploading…" : "Upload securely"}</button></footer></form>
    </WorkflowModal>
  </div>;
}
