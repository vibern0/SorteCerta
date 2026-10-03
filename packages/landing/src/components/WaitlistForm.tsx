import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureAttribution } from "../lib/attribution";
import { submitWaitlist } from "../lib/waitlist-client";
import type { Attribution, WaitlistResponse } from "../../worker/types";

type SubmitInput = {
  email: string;
  attribution?: Attribution;
};

type WaitlistFormProps = {
  submit?: (input: SubmitInput) => Promise<WaitlistResponse>;
  initialAttribution?: Attribution;
  resetTurnstile?: () => void;
};

const DEFAULT_STATUS = "Enter your email to join the waitlist.";
const SUCCESS_MESSAGES = {
  joined: "You're on the list. We'll let you know when your access opens.",
  already_joined: "You're already on the list. We saved your spot.",
} as const;

export function WaitlistForm({
  submit = submitWaitlist,
  initialAttribution,
  resetTurnstile,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const attribution = useMemo(() => {
    if (initialAttribution !== undefined) {
      return initialAttribution;
    }
    if (typeof window === "undefined") {
      return {};
    }
    return captureAttribution(new URL(window.location.href), document.referrer);
  }, [initialAttribution]);

  const canSubmit = email.trim().length > 0 && !isSubmitting;

  const resetVerification = useCallback(() => {
    resetTurnstile?.();
  }, [resetTurnstile]);

  useEffect(() => {
    if (hasCompleted) {
      statusRef.current?.focus();
    }
  }, [status, hasCompleted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setStatus("Joining...");
    setHasCompleted(false);

    const result = await submit({
      email,
      ...(Object.keys(attribution).length > 0 ? { attribution } : {}),
    });

    setIsSubmitting(false);
    setHasCompleted(true);

    if (result.ok) {
      setEmail("");
      setStatus(SUCCESS_MESSAGES[result.status]);
      resetVerification();
      return;
    }

    setStatus(result.message);
    resetVerification();
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="waitlist-email">Email</label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-describedby="waitlist-email-hint"
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <p className="form-hint" id="waitlist-email-hint">
          Use the same email when you open SorteCerta.
        </p>
      </div>

      <button className="button button-primary" type="submit" disabled={!canSubmit}>
        {isSubmitting ? "Joining..." : "Join the waitlist"}
      </button>

      <div className="form-status" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
        {status}
      </div>
    </form>
  );
}
