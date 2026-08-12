import { logoutAction } from "@/lib/auth-actions";

export default function LogoutPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-bold">Sign out</h1>
      <form action={logoutAction} className="card mt-6">
        <p className="text-sm text-slate-600">Click the button below to sign out.</p>
        <button className="btn mt-4">Sign out</button>
      </form>
    </main>
  );
}
