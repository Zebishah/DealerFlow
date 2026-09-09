import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Download, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { WorkflowModal } from "../components/WorkflowModal";
import { api, idempotentJson } from "../lib/api";
import type { BootstrapData, Sale, UserRole } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

type SaleForm = {
  salespersonId: string;
  financeProviderId: string;
  externalSaleId: string;
  type: "retail" | "wholesale";
  status: "draft" | "submitted" | "approved" | "rejected" | "funded" | "cancelled";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleVin: string;
  vehicleDescription: string;
  salePrice: string;
  grossProfit: string;
  commissionRate: string;
  soldAt: string;
  notes: string;
};

const writableRoles: UserRole[] = ["admin", "operator", "employee"];
const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
const today = () => new Date().toISOString().slice(0, 10);

function newSaleForm(): SaleForm {
  return {
    salespersonId: "",
    financeProviderId: "",
    externalSaleId: `RTA-${Date.now().toString().slice(-8)}`,
    type: "retail",
    status: "submitted",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    vehicleVin: "",
    vehicleDescription: "",
    salePrice: "",
    grossProfit: "",
    commissionRate: "25",
    soldAt: today(),
    notes: "",
  };
}

function formFromSale(sale: Sale): SaleForm {
  return {
    salespersonId: sale.salespersonId,
    financeProviderId: sale.financeProviderId ?? "",
    externalSaleId: sale.externalSaleId,
    type: sale.type,
    status: sale.status,
    customerName: sale.customerName,
    customerEmail: sale.customerEmail ?? "",
    customerPhone: sale.customerPhone ?? "",
    vehicleVin: sale.vehicleVin ?? "",
    vehicleDescription: sale.vehicleDescription,
    salePrice: (sale.salePriceCents / 100).toFixed(2),
    grossProfit: (sale.grossProfitCents / 100).toFixed(2),
    commissionRate: (sale.commissionRateBasisPoints / 100).toFixed(2),
    soldAt: sale.soldAt.slice(0, 10),
    notes: sale.notes ?? "",
  };
}

function salePayload(value: SaleForm) {
  return {
    salespersonId: value.salespersonId || undefined,
    financeProviderId: value.financeProviderId || null,
    externalSaleId: value.externalSaleId.trim(),
    type: value.type,
    status: value.status,
    customerName: value.customerName.trim(),
    customerEmail: value.customerEmail.trim() || null,
    customerPhone: value.customerPhone.trim() || null,
    vehicleVin: value.vehicleVin.trim().toUpperCase() || null,
    vehicleDescription: value.vehicleDescription.trim(),
    salePriceCents: cents(value.salePrice),
    grossProfitCents: cents(value.grossProfit),
    commissionRateBasisPoints: Math.round(Number(value.commissionRate) * 100),
    soldAt: new Date(`${value.soldAt}T12:00:00`).toISOString(),
    notes: value.notes.trim() || null,
  };
}

function cents(value: string): number {
  return Math.round(Number(value) * 100);
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function SalesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [form, setForm] = useState<SaleForm>(newSaleForm);
  const canWrite = Boolean(user && writableRoles.includes(user.role));

  const salesQuery = useQuery({
    queryKey: ["dealership", "sales"],
    queryFn: () => api<{ data: Sale[] }>("/dealership/sales?limit=100").then((result) => result.data),
  });

  const bootstrap = useQuery({
    queryKey: ["dealership", "bootstrap"],
    queryFn: () => api<{ data: BootstrapData }>("/dealership/bootstrap").then((result) => result.data),
    staleTime: 5 * 60_000,
  });

  const createSale = useMutation({
    mutationFn: (submission: { form: SaleForm; idempotencyKey: string }) => {
      return api<{ data: { id: string; version: number } }>(
        "/dealership/sales",
        idempotentJson("POST", salePayload(submission.form), submission.idempotencyKey),
      );
    },
    onSuccess: async () => {
      toast.success("Sale recorded");
      setModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "sales"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "summary"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSale = useMutation({
    mutationFn: (submission: { sale: Sale; form: SaleForm }) =>
      api<{ data: Sale }>(`/dealership/sales/${submission.sale.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...salePayload(submission.form), version: submission.sale.version }),
      }),
    onSuccess: async () => {
      toast.success("Sale updated");
      setModalOpen(false);
      setEditingSale(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dealership", "sales"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["dealership", "audit-events"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saving = createSale.isPending || updateSale.isPending;

  function openCreate() {
    setEditingSale(null);
    setForm(newSaleForm());
    setModalOpen(true);
  }

  function openEdit(sale: Sale) {
    setEditingSale(sale);
    setForm(formFromSale(sale));
    setModalOpen(true);
  }

  function closeModal() {
    if (!saving) {
      setModalOpen(false);
      setEditingSale(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (user.role !== "employee" && !form.salespersonId) {
      toast.error("Select a salesperson");
      return;
    }
    if (![form.salePrice, form.grossProfit, form.commissionRate].every((value) => Number.isFinite(Number(value)))) {
      toast.error("Enter valid financial amounts");
      return;
    }
    if (editingSale) {
      updateSale.mutate({ sale: editingSale, form });
    } else {
      createSale.mutate({ form, idempotencyKey: crypto.randomUUID() });
    }
  }

  function exportCsv() {
    const rows = salesQuery.data ?? [];
    if (!rows.length) {
      toast.error("There are no sales to export");
      return;
    }
    const header = ["Deal", "Customer", "Vehicle", "Type", "Status", "Sale price", "Gross profit", "Commission", "Sold at"];
    const lines = rows.map((sale) => [
      sale.externalSaleId,
      sale.customerName,
      sale.vehicleDescription,
      sale.type,
      sale.status,
      (sale.salePriceCents / 100).toFixed(2),
      (sale.grossProfitCents / 100).toFixed(2),
      (sale.commissionAmountCents / 100).toFixed(2),
      sale.soldAt,
    ].map(csvCell).join(","));
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rta-sales-${today()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Sales export downloaded");
  }

  if (salesQuery.isLoading) return <PageSkeleton />;
  if (salesQuery.isError) return <ErrorState message="Sales could not be loaded." />;

  const total = salesQuery.data?.reduce((sum, sale) => sum + (sale.status === "funded" ? sale.salePriceCents : 0), 0) ?? 0;
  const profit = salesQuery.data?.reduce((sum, sale) => sum + (sale.status === "funded" ? sale.grossProfitCents : 0), 0) ?? 0;

  return (
    <div className="page-stack">
      <section className="inline-metrics">
        <div><span>Funded volume</span><strong>{currency(total)}</strong></div>
        <div><span>Gross profit</span><strong>{currency(profit)}</strong></div>
        <div><span>Recorded deals</span><strong>{salesQuery.data?.length ?? 0}</strong></div>
        <div className="toolbar-actions">
          <button className="filter-button" onClick={exportCsv} disabled={!salesQuery.data?.length}><Download size={17} />Export</button>
          {canWrite && <button className="primary-action" onClick={openCreate}><Plus size={17} />Record sale</button>}
        </div>
      </section>

      <section className="surface data-surface">
        <div className="surface-head"><div><span>DEAL LEDGER</span><h3>Sales and funding status</h3></div></div>
        {salesQuery.data?.length ? (
          <div className="responsive-table">
            <table>
              <thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Type</th><th>Value</th><th>Gross</th><th>Status</th>{canWrite && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {salesQuery.data.map((sale) => (
                  <tr key={sale.id}>
                    <td><strong>{sale.externalSaleId}</strong><small>{new Date(sale.soldAt).toLocaleDateString("en-CA")}</small></td>
                    <td>{sale.customerName}</td>
                    <td>{sale.vehicleDescription}</td>
                    <td className="capitalize">{sale.type}</td>
                    <td><strong>{currency(sale.salePriceCents)}</strong></td>
                    <td>{currency(sale.grossProfitCents)}</td>
                    <td><span className={`status-chip ${sale.status}`}>{sale.status}</span></td>
                    {canWrite && <td className="row-actions"><button className="icon-button" type="button" onClick={() => openEdit(sale)} aria-label={`Edit sale ${sale.externalSaleId}`} title="Edit sale"><Pencil size={16} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><CircleDollarSign /><strong>No sales recorded</strong><span>Record the first deal to begin performance tracking.</span></div>}
      </section>

      <WorkflowModal
        open={modalOpen}
        eyebrow={editingSale ? "DEAL UPDATE" : "DEAL ENTRY"}
        title={editingSale ? `Edit ${editingSale.externalSaleId}` : "Record sale"}
        description="Financial values are stored as integer cents and commission rates as basis points. Updates use optimistic concurrency control."
        busy={saving}
        onClose={closeModal}
      >
        <form className="workflow-form" onSubmit={submit}>
          <div className="form-grid">
            {user?.role !== "employee" && <label>Salesperson<select required value={form.salespersonId} onChange={(event) => setForm({ ...form, salespersonId: event.target.value })}><option value="">Select salesperson</option>{bootstrap.data?.team.filter((member) => member.isActive && member.role === "employee").map((member) => <option key={member.id} value={member.id}>{[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}</option>)}</select></label>}
            <label>Finance provider<select value={form.financeProviderId} onChange={(event) => setForm({ ...form, financeProviderId: event.target.value })}><option value="">Cash / not specified</option>{bootstrap.data?.financeProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
            <label>Deal reference<input required maxLength={100} value={form.externalSaleId} onChange={(event) => setForm({ ...form, externalSaleId: event.target.value })} /></label>
            <label>Sale type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SaleForm["type"] })}><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select></label>
            <label>Funding status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SaleForm["status"] })}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="funded">Funded</option><option value="cancelled">Cancelled</option></select></label>
            <label>Sale date<input required type="date" value={form.soldAt} onChange={(event) => setForm({ ...form, soldAt: event.target.value })} /></label>
            <label className="form-span">Customer name<input required minLength={2} maxLength={160} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
            <label>Email<input type="email" maxLength={254} value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} /></label>
            <label>Phone<input type="tel" minLength={7} maxLength={40} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} /></label>
            <label>Vehicle VIN<input minLength={11} maxLength={17} value={form.vehicleVin} onChange={(event) => setForm({ ...form, vehicleVin: event.target.value })} /></label>
            <label>Vehicle description<input required minLength={2} maxLength={240} value={form.vehicleDescription} onChange={(event) => setForm({ ...form, vehicleDescription: event.target.value })} placeholder="Year, make, model, trim" /></label>
            <label>Sale price (CAD)<input required type="number" min="0" max="2000000" step="0.01" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></label>
            <label>Gross profit (CAD)<input required type="number" min="-200000" max="1000000" step="0.01" value={form.grossProfit} onChange={(event) => setForm({ ...form, grossProfit: event.target.value })} /></label>
            <label>Commission rate (%)<input required type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} /></label>
            <label className="form-span">Notes<textarea maxLength={4000} rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          </div>
          <footer className="modal-actions">
            <button type="button" className="filter-button" disabled={saving} onClick={closeModal}>Cancel</button>
            <button type="submit" className="primary-action" disabled={saving}>{saving ? "Saving…" : editingSale ? "Save changes" : "Record sale"}</button>
          </footer>
        </form>
      </WorkflowModal>
    </div>
  );
}
