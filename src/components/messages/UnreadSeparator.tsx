export function UnreadSeparator({ count }: { count: number }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-primary/30" />
      <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
        {count} message{count > 1 ? "s" : ""} non lu{count > 1 ? "s" : ""}
      </span>
      <span className="h-px flex-1 bg-primary/30" />
    </div>
  );
}