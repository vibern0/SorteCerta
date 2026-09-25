import { describe, expect, it } from "vitest";
import { captureAttribution } from "../src/lib/attribution";

describe("attribution capture", () => {
  it("captures only approved attribution and only a referrer hostname", () => {
    expect(
      captureAttribution(
        new URL("https://sortecerta.com/?utm_source=zama&utm_medium=post&utm_campaign=launch&ref=friend&secret=drop"),
        "https://community.example/path?email=hidden",
      ),
    ).toEqual({
      source: "zama",
      medium: "post",
      campaign: "launch",
      referralCode: "friend",
      referrerHost: "community.example",
    });
  });

  it("drops malformed and oversized attribution values", () => {
    expect(captureAttribution(new URL(`https://sortecerta.com/?utm_source=${"x".repeat(129)}`), "not a url")).toEqual({});
  });
});
