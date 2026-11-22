import type { Metadata } from "next";
import { Dashboard, SignInPanel } from "@/components/Account";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

async function providers() {
  try {
    const { authProviders } = await import("@/lib/server/auth");
    return authProviders;
  } catch {
    return { google: false, email: false };
  }
}

export default async function AccountPage() {
  const session = await getSession();
  const p = await providers();
  return (
    <div className="wrap">
      <PageHeader kicker="Account" title={session ? "Your account" : "Sign in for API keys"}>
        {!session && <p>The audit needs no account. Sign in only if you want keys for the API.</p>}
      </PageHeader>
      {session ? <Dashboard name={session.user.name} email={session.user.email} /> : <SignInPanel google={p.google} email={p.email} />}
    </div>
  );
}
