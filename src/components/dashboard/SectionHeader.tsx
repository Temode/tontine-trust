interface SectionHeaderProps {
  title: string;
  action?: { label: string; onClick?: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-foreground md:text-lg">{title}</h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs font-semibold text-primary-700 transition hover:text-primary-800"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
