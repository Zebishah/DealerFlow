import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Download, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Sale } from "../types/domain";
import { ErrorState, PageSkeleton } from "./OverviewPage";

const currency = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
export function SalesPage() {
  const sales = useQuery({ queryKey: ["dealership", "sales"], queryFn: () => api<{ data: Sale[] }>("/dealership/sales?limit=100").then((result) => result.data) });
  if (sales.isLoading) return <PageSkeleton />;
  if (sales.isError) return <ErrorState message="Sales could not be loaded." />;
  const total = sales.data?.reduce((sum, sale) => sum + (sale.status === "funded" ? sale.salePriceCents : 0), 0) ?? 0;
  const profit = sales.data?.reduce((sum, sale) => sum + (sale.status === "funded" ? sale.grossProfitCents : 0), 0) ?? 0;
  return <div className="page-stack"><section className="inline-metrics"><div><span>Funded volume</span><strong>{currency(total)}</strong></div><div><span>Gross profit</span><strong>{currency(profit)}</strong></div><div><span>Recorded deals</span><strong>{sales.data?.length ?? 0}</strong></div><div className="toolbar-actions"><button className="filter-button"><Download size={17} />Export</button><button className="primary-action"><Plus size={17} />Record sale</button></div></section><section className="surface data-surface"><div className="surface-head"><div><span>DEAL LEDGER</span><h3>Sales and funding status</h3></div></div>{sales.data?.length ? <div className="responsive-table"><table><thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Type</th><th>Value</th><th>Gross</th><th>Status</th></tr></thead><tbody>{sales.data.map((sale) => <tr key={sale.id}><td><strong>{sale.externalSaleId}</strong><small>{new Date(sale.soldAt).toLocaleDateString("en-CA")}</small></td><td>{sale.customerName}</td><td>{sale.vehicleDescription}</td><td className="capitalize">{sale.type}</td><td><strong>{currency(sale.salePriceCents)}</strong></td><td>{currency(sale.grossProfitCents)}</td><td><span className={`status-chip ${sale.status}`}>{sale.status}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><CircleDollarSign /><strong>No sales recorded</strong><span>Record the first deal to begin performance tracking.</span></div>}</section></div>;
}
