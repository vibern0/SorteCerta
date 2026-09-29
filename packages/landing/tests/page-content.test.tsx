import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(() => {
  cleanup();
});

describe("marketing page", () => {
  it("uses the approved quiet-invitation hierarchy and working CTA targets", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Good saving habits. A little more upside." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The idea" })).toHaveAttribute("href", "#the-idea");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "Invitation access" })).toHaveAttribute("href", "#waitlist");
    expect(
      screen
        .getAllByRole("link", { name: /join the waitlist/i })
        .every((anchor) => (anchor as HTMLAnchorElement).hash === "#waitlist"),
    ).toBe(true);
    expect(screen.getByText("Built with Zama")).toBeInTheDocument();
    expect(screen.getByText("Yield powered by Morpho")).toBeInTheDocument();
    expect(screen.getByText("Add USDC. Withdraw when you need it.")).toBeInTheDocument();
    expect(screen.getByText("After each draw, check for a prize to claim.")).toBeInTheDocument();
    expect(document.querySelector("#how-it-works")).not.toBeNull();
    expect(document.querySelector("#the-idea")).not.toBeNull();
  });

  it("does not publish fabricated or guaranteed claims", () => {
    render(<App />);
    const copy = document.body.textContent ?? "";
    expect(copy).not.toMatch(/APY|TVL|guaranteed|you won|current prize/i);
    expect(copy).not.toMatch(/testnet|Sepolia|prototype|faucet|mock|encrypted|decrypted|leakage/i);
  });
});
