import { logoutAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LogoutPage() {
  return (
    <main className="mx-auto max-w-md animate-fade-in px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Sign out</h1>
        <ThemeToggle />
      </div>
      <form action={logoutAction} className="card mt-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">Click the button below to sign out.</p>
        <button className="btn mt-4">Sign out</button>
      </form>
    </main>
  );
}
