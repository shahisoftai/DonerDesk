import type { ReactNode } from "react";

export function DataTable({
  columns,
  rows,
  caption,
  empty,
}: {
  columns: Array<{ key: string; label: string; className?: string }>;
  rows: Array<{ key: string; cells: ReactNode[] }>;
  caption?: string;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="thead">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-3 py-2 text-left ${column.className ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                {empty ?? "No records."}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.key} className="trow">
              {row.cells.map((cell, index) => (
                <td key={index} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
