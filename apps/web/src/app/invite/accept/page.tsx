import Link from "next/link";
import { AuthService } from "@/features/auth/application/auth-service";
import { ROLE_LABEL } from "@/lib/labels";
import InviteAcceptForm from "./InviteAcceptForm";

export const dynamic = "force-dynamic";

const service = new AuthService();

export default async function InviteAcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const preview = token.length >= 10 ? await service.invitationPreview(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Join your workspace</h1>
        {!preview ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              This invitation link is invalid, has expired, or has already been used. Ask a workspace admin to
              send a new invitation.
            </p>
            <Link href="/login" className="text-sm font-medium underline">Go to sign in</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You were invited to join a DonorDesk workspace as{" "}
              <strong>{preview.role in ROLE_LABEL ? ROLE_LABEL[preview.role as keyof typeof ROLE_LABEL] : preview.role}</strong>{" "}
              with <strong>{preview.email}</strong>. Accept below to create your account.
            </p>
            <InviteAcceptForm token={token} role={preview.role} />
          </>
        )}
      </div>
    </div>
  );
}
