"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { checkAccess, claimAccess, joinWaitlist } from "@/lib/access";
import { useWallet } from "@/lib/wallet-context";
import { ConnectButton } from "./ConnectButton";

type GateState = "checking" | "approved" | "email" | "ready" | "pending" | "claimed" | "error";

export function AccessGate({ children }: { children: ReactNode }) {
  const { session, ready } = useWallet();
  const [email, setEmail] = useState("");
  const [approvedEmail, setApprovedEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Enter your email to check whether your access is ready.");
  const [submitting, setSubmitting] = useState(false);
  const [gateState, setGateState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!ready) {
        setGateState("checking");
        return;
      }
      if (!session) {
        setGateState((current) => (current === "ready" ? "ready" : "email"));
        return;
      }
      if (!session.email) {
        setGateState("error");
        setStatus("This login did not include an email.");
        return;
      }
      if (approvedEmail && session.email.toLowerCase() !== approvedEmail) {
        setGateState("error");
        setStatus("Please sign in with the same email you checked for access.");
        return;
      }

      setGateState("checking");
      try {
        const access = await checkAccess(session.email);
        if (cancelled) return;
        if (!access.ok) {
          setGateState("pending");
          setStatus("You're on the list. We'll let you know when your access opens.");
          return;
        }
        setApprovedEmail(session.email.toLowerCase());
        const signature = await session.signJoinedMessage();
        const result = await claimAccess({
          email: session.email,
          walletAddress: session.address,
          signature,
        });
        if (cancelled) return;
        if (result.ok) {
          setGateState("approved");
          return;
        }
        setGateState(result.status === "claimed" ? "claimed" : "pending");
        setStatus(
          result.status === "claimed"
            ? "That email is already linked to another account."
            : "You're on the list. We'll let you know when your access opens.",
        );
      } catch {
        if (!cancelled) {
          setGateState("error");
          setStatus("We could not check your access right now.");
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [approvedEmail, ready, session]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim() === "" || submitting) return;
    setSubmitting(true);
    setStatus("Checking access...");
    try {
      const access = await checkAccess(email);
      if (access.ok) {
        setApprovedEmail(email.trim().toLowerCase());
        setGateState("ready");
        setStatus("Access is ready. Sign in with this same email to continue.");
        return;
      }

      const result = await joinWaitlist(email);
      if (result.ok) {
        setApprovedEmail(null);
        setGateState("pending");
        setStatus("You're on the list. We'll let you know when your access opens.");
        return;
      }
      setGateState("error");
      setStatus("We could not join the waitlist right now. Please try again.");
    } catch {
      setGateState("error");
      setStatus("We could not check your access right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (gateState === "approved") {
    return <>{children}</>;
  }

  return (
    <main className="relative mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col justify-start overflow-hidden px-5 pb-8 pt-7 md:min-h-[calc(100vh-48px)] md:justify-center md:px-8 md:py-8">
      <div className="pointer-events-none absolute right-[-5rem] top-10 h-52 w-52 rounded-full border-[30px] border-[var(--peach)] opacity-70" />
      <div className="pointer-events-none absolute bottom-8 left-[-4rem] h-44 w-44 rotate-[-12deg] rounded-[42%_58%_52%_48%] bg-[var(--lilac)] opacity-60" />

      <div className="relative grid gap-6 md:grid-cols-[1.05fr_0.95fr] md:items-center">
        <section className="space-y-5">
          <div className="inline-flex rounded-full border border-[var(--cobalt-dark)] bg-[var(--citron)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
            Early access
          </div>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl">
              Your savings, with a chance to win.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted md:text-lg">
              SorteCerta is opening gradually. Check your email first, then sign in with that same email when your
              access is ready.
            </p>
          </div>
        </section>

        <section className="glass-surface space-y-5 rounded-[28px] p-5 md:p-6">
          <div className="space-y-1">
            <p className="label">Access check</p>
            <h2 className="font-display text-2xl font-bold tracking-tight">Enter your email</h2>
          </div>

          <form className="space-y-3" onSubmit={submitEmail}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
            </label>
            <button className="btn-primary w-full" type="submit" disabled={email.trim() === "" || submitting}>
              {submitting ? "Checking..." : "Continue"}
            </button>
          </form>

          {(gateState === "ready" || session) && (
            <div className="space-y-3 rounded-[22px] border border-[var(--cobalt-dark)] bg-white/35 p-4">
              <p className="label">Sign in</p>
              <ConnectButton fullWidth />
            </div>
          )}

          <p className="text-sm leading-relaxed text-muted" role="status" aria-live="polite">
            {gateState === "checking" ? "Checking your session..." : status}
          </p>
        </section>
      </div>
    </main>
  );
}
