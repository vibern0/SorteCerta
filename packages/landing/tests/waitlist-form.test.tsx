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
    render(<WaitlistForm submit={submit} initialAttribution={{ source: "zama" }} resetTurnstile={reset} />);

    await userEvent.type(screen.getByLabelText(/^email$/i), "person@example.com");
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));

    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith({
      email: "person@example.com",
      attribution: { source: "zama" },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/you.re on the list/i);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("preserves fields but resets verification after a temporary failure", async () => {
    const reset = vi.fn();
    render(
      <WaitlistForm
        submit={async () => ({ ok: false, code: "temporarily_unavailable", message: "Please try again." })}
        resetTurnstile={reset}
      />,
    );

    await userEvent.type(screen.getByLabelText(/^email$/i), "person@example.com");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/^email$/i)).toHaveValue("person@example.com");
  });

  it("keeps submit disabled without an email and while pending", async () => {
    let resolveSubmit: (value: { ok: true; status: "joined" }) => void = () => undefined;
    const submit = vi.fn(
      () =>
        new Promise<{ ok: true; status: "joined" }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { rerender } = render(<WaitlistForm submit={submit} />);

    expect(screen.getByRole("button", { name: /join the waitlist/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^email$/i), "person@example.com");
    expect(screen.getByRole("button", { name: /join the waitlist/i })).toBeEnabled();

    rerender(<WaitlistForm submit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));
    expect(screen.getByRole("button", { name: /joining/i })).toBeDisabled();

    resolveSubmit({ ok: true, status: "joined" });
    expect(await screen.findByRole("status")).toHaveTextContent(/you.re on the list/i);
  });

  it("moves focus to status after a submission error", async () => {
    render(
      <WaitlistForm
        submit={async () => ({
          ok: false,
          code: "temporarily_unavailable",
          message: "Please try again.",
        })}
      />,
    );

    await userEvent.type(screen.getByLabelText(/^email$/i), "other@example.com");
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Please try again.");
    expect(document.activeElement).toBe(status);
  });
});
