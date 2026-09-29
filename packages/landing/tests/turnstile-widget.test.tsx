import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "../src/components/TurnstileWidget";

afterEach(() => {
  cleanup();
  delete window.turnstile;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
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

  it("uses compact sizing when the smallest supported viewport cannot fit a flexible widget", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
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
      size: "compact",
    });
  });

  it("re-renders with compact sizing when the viewport becomes too narrow", async () => {
    const renderWidget = vi.fn<NonNullable<typeof window.turnstile>["render"]>(() => "widget-id");
    const removeWidget = vi.fn();
    window.turnstile = {
      render: renderWidget,
      reset: vi.fn(),
      remove: removeWidget,
    };

    render(<TurnstileWidget siteKey="site-key" onToken={vi.fn()} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    window.dispatchEvent(new Event("resize"));

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-id");
    expect(renderWidget.mock.calls[1][1]).toMatchObject({ size: "compact" });
  });
});
