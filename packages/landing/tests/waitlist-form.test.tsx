import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaitlistForm } from "../src/components/WaitlistForm";

afterEach(() => {
  cleanup();
});

describe("waitlist form", () => {
  it("submits once, announces success, and clears sensitive form state", async () => {
    const reset = vi.fn();
    const submit = vi.fn(async () => ({ ok: true, status: "joined" as const }) as const);
    render(
      <WaitlistForm
        submit={submit}
        initialAttribution={{ source: "zama" }}
        resetTurnstile={reset}
        turnstileToken="verified-token"
      />,
    );

    await userEvent.type(screen.getByLabelText(/approved email/i), "person@example.com");
    await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-ABCD-EFGH-IJKL-MNOP");
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));

    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith({
      email: "person@example.com",
      invitationCode: "SC-ABCD-EFGH-IJKL-MNOP",
      turnstileToken: "verified-token",
      attribution: { source: "zama" },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/you.re on the list/i);
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.queryByDisplayValue("SC-ABCD-EFGH-IJKL-MNOP")).toBeNull();
  });

  it("preserves fields but resets verification after a temporary failure", async () => {
    const reset = vi.fn();
    render(
      <WaitlistForm
        submit={async () => ({ ok: false, code: "temporarily_unavailable", message: "Please try again." })}
        resetTurnstile={reset}
        turnstileToken="verified-token"
      />,
    );

    await userEvent.type(screen.getByLabelText(/approved email/i), "person@example.com");
    await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-ABCD-EFGH-IJKL-MNOP");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/approved email/i)).toHaveValue("person@example.com");
    expect(screen.getByLabelText(/invitation code/i)).toHaveValue("SC-ABCD-EFGH-IJKL-MNOP");
  });

  it("keeps submit disabled without verification and while pending", async () => {
    let resolveSubmit: (value: { ok: true; status: "joined" }) => void = () => undefined;
    const submit = vi.fn(
      () =>
        new Promise<{ ok: true; status: "joined" }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { rerender } = render(<WaitlistForm submit={submit} />);

    await userEvent.type(screen.getByLabelText(/approved email/i), "person@example.com");
    await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-ABCD-EFGH-IJKL-MNOP");
    expect(screen.getByRole("button", { name: /join the waitlist/i })).toBeDisabled();

    rerender(<WaitlistForm submit={submit} turnstileToken="verified-token" />);
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));
    expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled();

    resolveSubmit({ ok: true, status: "joined" });
    expect(await screen.findByRole("status")).toHaveTextContent(/you.re on the list/i);
  });

  it("keeps invitation errors generic and moves focus to status", async () => {
    render(
      <WaitlistForm
        submit={async () => ({
          ok: false,
          code: "invalid_invitation",
          message: "This invitation could not be accepted.",
        })}
        turnstileToken="verified-token"
      />,
    );

    await userEvent.type(screen.getByLabelText(/approved email/i), "other@example.com");
    await userEvent.type(screen.getByLabelText(/invitation code/i), "SC-RANDOM-CODE-VALUE");
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("This invitation could not be accepted.");
    expect(status).not.toHaveTextContent(/email|code/i);
    expect(document.activeElement).toBe(status);
  });
});
