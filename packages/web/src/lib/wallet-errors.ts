const GENERIC_SIGN_IN_ERROR = "Could not sign you in.";
const GOOGLE_FETCH_ERROR =
  "Could not reach Google sign-in. Check your connection or content blocker, then try again.";

function collectMessages(error: unknown, messages: string[] = []): string[] {
  if (!error) return messages;

  if (error instanceof Error) {
    messages.push(error.message);
    collectMessages(error.cause, messages);
    return messages;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeCause = (error as { cause?: unknown }).cause;
    if (typeof maybeMessage === "string") messages.push(maybeMessage);
    collectMessages(maybeCause, messages);
    return messages;
  }

  messages.push(String(error));
  return messages;
}

export function getWalletErrorMessage(error: unknown): string {
  const text = collectMessages(error).join(" ");

  if (text.includes("Failed to fetch") && text.includes("www.googleapis.com")) {
    return GOOGLE_FETCH_ERROR;
  }

  return GENERIC_SIGN_IN_ERROR;
}
