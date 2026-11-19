type Status = string;
const labels: Record<string, string> = {
  pending: "Pending", verified: "Verified", rejected: "Rejected", active: "Active",
  suspended: "Suspended", under_review: "Under Review", approved: "Approved",
  disbursed: "Disbursed", info: "Info", warning: "Warning", critical: "Critical",
};
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status.replaceAll("_", " ")}</span>;
}
