import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(() => {
  cleanup();
});

describe("landing shell", () => {
  it("renders one main region and the waitlist target", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(document.querySelector("#waitlist")).not.toBeNull();
  });

  it("opens and closes the accessible mobile navigation", async () => {
    render(<App />);

    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(mobileNavigation).toBeInTheDocument();

    await userEvent.click(within(mobileNavigation).getByRole("link", { name: "The idea" }));
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
