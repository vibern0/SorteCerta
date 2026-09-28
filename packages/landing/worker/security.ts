const DOCUMENT_SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

export function withSecurityHeaders(response: Response, kind: "api" | "document"): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");

  if (kind === "document") {
    for (const [name, value] of Object.entries(DOCUMENT_SECURITY_HEADERS)) {
      headers.set(name, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
