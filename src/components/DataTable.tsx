import type { ReactNode } from "react";

export type Column<T> = { header: string; render: (row: T) => ReactNode; className?: string };
export function DataTable<T extends { id: string }>({ rows, columns, onRowClick }: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void;
}) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.header} className={c.className}>{c.header}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row)} className={onRowClick ? "clickable-row" : ""}>
      {columns.map((c) => <td key={c.header} className={c.className}>{c.render(row)}</td>)}
    </tr>)}</tbody></table></div>;
}
