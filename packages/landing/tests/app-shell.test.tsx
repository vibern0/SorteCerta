import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("landing shell", () => {
  it("renders one main region and the waitlist target", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(document.querySelector("#waitlist")).not.toBeNull();
  });
});
