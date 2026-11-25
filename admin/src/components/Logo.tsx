/** Logo tipográfico: la barra de dev/null en color de acento. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-mono font-semibold tracking-tight ${className}`} aria-label="dev/null">
      dev<span className="text-accent">/</span>null
    </span>
  );
}
