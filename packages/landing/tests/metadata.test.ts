import { describe, expect, it } from "vitest";
import { renderLandingHtmlMetadata, resolveSiteUrl } from "../vite.config";

describe("landing metadata", () => {
  it("defaults to absolute production metadata", () => {
    const html = renderLandingHtmlMetadata(
      '<link rel="canonical" href="%SITE_URL%" /><meta property="og:image" content="%OG_IMAGE_URL%" />',
      undefined,
    );

    expect(html).toContain('href="https://sortecerta.com"');
    expect(html).toContain('content="https://sortecerta.com/og-image.png"');
  });

  it("normalizes configured preview URLs before HTML transform", () => {
    expect(resolveSiteUrl(" https://preview.example/ ")).toBe("https://preview.example");
  });
});
