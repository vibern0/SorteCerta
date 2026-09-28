import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureAttribution } from "../lib/attribution";
import { submitWaitlist } from "../lib/waitlist-client";
import type { Attribution, WaitlistResponse } from "../../worker/types";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";

type SubmitInput = {
  email: string;
  invitationCode: string;
  turnstileToken: string;
  attribution?: Attribution;
};

type WaitlistFormProps = {
  submit?: (input: SubmitInput) => Promise<WaitlistResponse>;
  initialAttribution?: Attribution;
  turnstileToken?: string;
  resetTurnstile?: () => void;
};

const DEFAULT_STATUS = "Enter your approved email and invitation code.";
const SUCCESS_MESSAGES = {
  joined: "You're on the list. We'll invite you when access opens.",
  already_joined: "You're already on the list. We saved your spot.",
} as const;

export function WaitlistForm({
  submit = submitWaitlist,
  initialAttribution,
  turnstileToken,
  resetTurnstile,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [internalToken, setInternalToken] = useState<string | null>(null);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TurnstileWidgetHandle>(null);

  const attribution = useMemo(() => {
    if (initialAttribution !== undefined) {
      return initialAttribution;
    }
    if (typeof window === "undefined") {
      return {};
    }
    return captureAttribution(new URL(window.location.href), document.referrer);
  }, [initialAttribution]);

  const effectiveToken = turnstileToken ?? internalToken;
  const canSubmit = email.trim().length > 0 && invitationCode.trim().length > 0 && !!effectiveToken && !isSubmitting;

  const resetVerification = useCallback(() => {
    setInternalToken(null);
    resetTurnstile?.();
    widgetRef.current?.reset();
  }, [resetTurnstile]);

  useEffect(() => {
    if (hasCompleted) {
      statusRef.current?.focus();
    }
  }, [status, hasCompleted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveToken || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus("Joining...");
    setHasCompleted(false);

    const result = await submit({
      email,
      invitationCode,
      turnstileToken: effectiveToken,
      ...(Object.keys(attribution).length > 0 ? { attribution } : {}),
    });

    setIsSubmitting(false);
    setHasCompleted(true);

    if (result.ok) {
      setEmail("");
      setInvitationCode("");
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
        <label htmlFor="waitlist-email">Approved email</label>
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
          Use the email tied to your invitation.
        </p>
      </div>

      <div className="field">
        <label htmlFor="waitlist-code">Invitation code</label>
        <input
          id="waitlist-code"
          name="invitationCode"
          type="text"
          autoComplete="off"
          value={invitationCode}
          aria-describedby="waitlist-code-hint"
          onChange={(event) => setInvitationCode(event.currentTarget.value)}
        />
        <p className="form-hint" id="waitlist-code-hint">
          Codes are single-use and tied to one email.
        </p>
      </div>

      {turnstileToken === undefined ? (
        <TurnstileWidget
          ref={widgetRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ""}
          onToken={setInternalToken}
        />
      ) : null}

      <button className="button button-primary" type="submit" disabled={!canSubmit}>
        {isSubmitting ? "Joining..." : "Join the waitlist"}
      </button>

      <div className="form-status" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
        {status}
      </div>
    </form>
  );
}
