import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">$</span> cd {"<ruta>"}
        <br />
        bash: cd: No such file or directory
      </p>
      <h1 className="mt-6 font-mono text-2xl font-bold sm:text-3xl">Esta ruta fue redirigida a /dev/null.</h1>
      <p className="mt-3 text-muted">Error 404 · la página no existe o fue movida.</p>
      <div className="mt-8 flex justify-center gap-4 font-mono text-sm">
        <Link href="/" className="text-accent hover:underline">
          cd ~
        </Link>
        <Link href="/search" className="text-accent hover:underline">
          grep
        </Link>
      </div>
    </div>
  );
}
