import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 font-mono text-xl">Esta ruta fue redirigida a /dev/null.</h1>
      <Link to="/" className="mt-6 inline-block text-sm text-accent hover:underline">
        Volver al panel
      </Link>
    </div>
  );
}
