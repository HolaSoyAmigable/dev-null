/** Logo tipográfico: la barra de dev/null en color de acento. */
export function Logo({ name = "dev/null", className = "" }: { name?: string; className?: string }) {
  const [before, ...rest] = name.split("/");
  return (
    <span className={`font-mono font-semibold tracking-tight ${className}`}>
      {rest.length ? (
        <>
          {before}
          <span className="text-accent">/</span>
          {rest.join("/")}
        </>
      ) : (
        name
      )}
    </span>
  );
}
