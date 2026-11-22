"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; calls: number };

export function SignInPanel({ google, email }: { google: boolean; email: boolean }) {
  const [addr, setAddr] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const callbackURL = "/account";

  if (!google && !email)
    return (
      <div className="card max-w-xl p-6">
        <p className="font-semibold">Sign-in is not switched on for this deployment yet.</p>
        <p className="mt-2 text-[15px] text-[var(--color-ink-2)]">Everything else works without an account: the audit, the pair inspector, the registry and the exposure endpoint of the API. API keys arrive with sign-in.</p>
      </div>
    );
  return (
    <div className="card max-w-md space-y-6 p-6">
      {google && (
        <button type="button" className="btn btn-ghost w-full" onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.4 1 4.9L5.7 14Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.6 3.4-4.6 6.3-4.6Z"/></svg>
          Continue with Google
        </button>
      )}
      {email && (sent ? (
        <p role="status" className="rounded-xl bg-[var(--color-ok-soft)] p-4 text-[15px]">Check your inbox for a sign-in link. It expires in 10 minutes.</p>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr(null);
          const { error } = await authClient.signIn.magicLink({ email: addr.trim(), callbackURL });
          setBusy(false);
          if (error) setErr(error.message ?? "Could not send the link."); else setSent(true);
        }}>
          <label className="block"><span className="label">Email address</span>
            <input type="email" required autoComplete="email" className="field" value={addr} onChange={(e) => setAddr(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>Email me a sign-in link</button>
          {err && <p role="alert" className="text-[14.5px] text-[var(--color-leak)]">{err}</p>}
        </form>
      ))}
    </div>
  );
}

export function Dashboard({ name, email }: { name: string; email: string }) {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [newName, setNewName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => fetch("/api/keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? [])).catch(() => setKeys([]));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    const d = await r.json();
    if (!r.ok) return setErr(d.error?.message ?? "Could not create the key.");
    setFresh(d.key);
    setNewName("");
    load();
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
      <section className="card h-fit space-y-3 p-6">
        <p className="text-[22px] font-semibold">{name}</p>
        <p className="text-[var(--color-ink-2)]">{email}</p>
        <p className="text-[14.5px] text-[var(--color-ink-3)]">Free plan: 20 calls a minute and 3,000 a month per key. Up to 10 keys.</p>
        <button type="button" className="btn btn-ghost" onClick={async () => { await authClient.signOut(); location.reload(); }}>Sign out</button>
      </section>
      <section>
        <h2 className="display text-[44px]">API keys</h2>
        <p className="mt-2 text-[var(--color-ink-2)]">Send a key as <span className="kbd">Authorization: Bearer al_live_…</span>. Keys are stored hashed; you see each one only once.</p>
        {fresh && (
          <div role="status" className="mt-4 rounded-xl bg-[var(--color-leak-soft)] p-4">
            <p className="font-semibold">Copy your new key now. It won&apos;t be shown again.</p>
            <code className="mono mt-2 block break-all rounded-lg bg-white p-3 text-[13.5px]">{fresh}</code>
            <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={async () => { await navigator.clipboard.writeText(fresh); toast("Key copied"); }}>Copy</button>
          </div>
        )}
        <form className="mt-5 flex gap-2" onSubmit={create}>
          <label className="flex-1"><span className="sr-only">Key name</span>
            <input className="field" required maxLength={60} placeholder="Key name, e.g. my-dataset-pipeline" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">Create key</button>
        </form>
        {err && <p role="alert" className="mt-2 text-[14.5px] text-[var(--color-leak)]">{err}</p>}
        <ul className="mt-6 divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
          {keys === null ? <li className="py-4 text-[var(--color-ink-2)]">Loading…</li> : keys.length === 0 ? <li className="py-4 text-[var(--color-ink-2)]">No keys yet.</li> : keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{k.name}</p>
                <p className="mono text-[13px] text-[var(--color-ink-2)]">{k.prefix}…</p>
              </div>
              <p className="text-[14px] text-[var(--color-ink-2)]">This month: <span className="tnum">{k.calls}</span> calls</p>
              <button type="button" className="btn btn-sm btn-ghost" onClick={async () => { await fetch(`/api/keys/${k.id}`, { method: "DELETE" }); setFresh(null); load(); }}>Revoke</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
