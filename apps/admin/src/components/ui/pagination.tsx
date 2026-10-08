"use client";

import { cn } from "@presensia/utils";
import { Icon } from "./icon";

export function Pagination({
  from,
  to,
  total,
  unit,
  page,
  pageCount,
  onPage,
  prevLabel = "Halaman sebelumnya",
  nextLabel = "Halaman berikutnya",
  withPrev = true,
  perPage,
  onPerPage,
}: {
  from: number;
  to: number;
  total: number;
  unit: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  withPrev?: boolean;
  perPage?: number;
  onPerPage?: (perPage: number) => void;
}) {
  const pages: Array<number | "gap-start" | "gap-end"> = (() => {
    if (pageCount <= 5) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const window = new Set<number>([1, 2, page - 1, page, page + 1, pageCount]);
    const sorted = [...window].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const out: Array<number | "gap-start" | "gap-end"> = [];
    let prev = 0;
    for (const p of sorted) {
      if (prev && p - prev > 1) out.push(prev === 1 ? "gap-start" : "gap-end");
      out.push(p);
      prev = p;
    }
    return out.slice(0, 7);
  })();

  return (
    <div className="pagination">
      <span>
        Menampilkan {from}–{to} dari {total.toLocaleString("id-ID")} {unit}
      </span>
      {perPage !== undefined && onPerPage ? (
        <label
          className="table-secondary"
          style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
        >
          Per halaman
          <select
            className="select-ui compact-select"
            aria-label="Jumlah baris per halaman"
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
          >
            {[20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="pagination-actions" role="navigation" aria-label="Pagination">
        {withPrev ? (
          <button
            type="button"
            className="page-btn"
            aria-label={prevLabel}
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <Icon name="chevronLeft" />
          </button>
        ) : null}
        {pages.map((p) =>
          typeof p !== "number" ? (
            <span
              key={p}
              className="table-secondary"
              style={{ padding: "0 4px", alignSelf: "center" }}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cn("page-btn", p === page && "is-current")}
              aria-label={`Halaman ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="page-btn"
          aria-label={nextLabel}
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
