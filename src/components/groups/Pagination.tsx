import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: PaginationProps) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination des groupes"
      className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-card px-4 py-3 sm:flex-row sm:justify-between"
    >
      <p className="text-[12px] text-muted-foreground">
        <span className="num font-medium text-foreground">{from}</span>–
        <span className="num font-medium text-foreground">{to}</span> sur{" "}
        <span className="num font-medium text-foreground">{totalItems}</span>
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && pageSizeOptions && (
          <label className="hidden items-center gap-2 text-[12px] text-muted-foreground sm:flex">
            <span>Par page</span>
            <select
              aria-label="Éléments par page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-hairline bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Page précédente"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition",
              page <= 1 ? "opacity-40" : "hover:bg-secondary hover:text-foreground",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-[12px] text-foreground num">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            aria-label="Page suivante"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-muted-foreground transition",
              page >= pageCount ? "opacity-40" : "hover:bg-secondary hover:text-foreground",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}