import { describe, expect, it } from "vitest";
import {
  hashInvitationCode,
  normalizeEmail,
  normalizeInvitationCode,
  parseWaitlistRequest,
} from "../worker/validation";

describe("waitlist validation", () => {
  it("normalizes email and invitation separators", async () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeInvitationCode(" sc-abcd efgh-ijkl ")).toBe("SC-ABCDEFGHIJKL");
    expect(normalizeInvitationCode("abcdefghijkl")).toBe("SC-ABCDEFGHIJKL");
    expect(await hashInvitationCode("sc-abcd efgh-ijkl")).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["text/plain", "{}", "invalid_request"],
    ["application/json", "{", "invalid_request"],
    [
      "application/json",
      JSON.stringify({ email: "bad", invitationCode: "x", turnstileToken: "t" }),
      "invalid_request",
    ],
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
});
