"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">$</span> echo $?
        <br />
        500
      </p>
      <h1 className="mt-6 font-mono text-2xl font-bold sm:text-3xl">Algo salió mal.</h1>
      <p className="mt-3 text-muted">El error no se descartó: ya está en los logs. Inténtalo de nuevo.</p>
      <div className="mt-8 flex justify-center gap-4 font-mono text-sm">
        <button type="button" onClick={reset} className="cursor-pointer text-accent hover:underline">
          reintentar
        </button>
        <Link href="/" className="text-accent hover:underline">
          cd ~
        </Link>
      </div>
    </div>
  );
}
