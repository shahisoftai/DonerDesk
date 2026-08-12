import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The page you are looking for does not exist or you do not have access to it.
        </p>
        <Link className="btn mt-6" href="/dashboard">Back to dashboard</Link>
      </div>
    </div>
  );
}
