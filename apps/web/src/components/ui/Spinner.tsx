export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className ?? ""}`}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
