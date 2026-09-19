export function ChartEmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="analytics-empty-state" role="status">
    <strong>{title}</strong>
    <span>{detail}</span>
  </div>;
}
