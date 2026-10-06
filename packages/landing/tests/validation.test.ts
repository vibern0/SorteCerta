import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  parseWaitlistRequest,
} from "../worker/validation";

describe("waitlist validation", () => {
  it("normalizes email", async () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it.each([
    ["text/plain", "{}", "invalid_request"],
    ["application/json", "{", "invalid_request"],
    ["application/json", JSON.stringify({ email: "bad" }), "invalid_request"],
  ])("rejects invalid request data", async (contentType, body, code) => {
    const request = new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    await expect(parseWaitlistRequest(request)).rejects.toMatchObject({ code });
  });

  it("rejects a declared body larger than 8 KiB", async () => {
    const request = new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "8193" },
      body: "{}",
    });
    await expect(parseWaitlistRequest(request)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("accepts an email-only waitlist request", async () => {
    const request = new Request("https://sortecerta.com/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " Person@Example.COM " }),
    });

    await expect(parseWaitlistRequest(request)).resolves.toEqual({ email: "person@example.com" });
  });
});
