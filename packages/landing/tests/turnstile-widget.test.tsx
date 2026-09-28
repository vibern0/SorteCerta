import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "../src/components/TurnstileWidget";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("TurnstileWidget", () => {
  it("uses flexible sizing for narrow mobile layouts", async () => {
    const renderWidget = vi.fn<NonNullable<typeof window.turnstile>["render"]>(() => "widget-id");
    window.turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove: vi.fn(),
    };

    render(<TurnstileWidget siteKey="site-key" onToken={vi.fn()} />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    expect(renderWidget.mock.calls[0][1]).toMatchObject({
      sitekey: "site-key",
      size: "flexible",
    });
  });
});
