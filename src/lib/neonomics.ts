import "server-only";

const sandboxBase = "https://sandbox.neonomics.io";

function configuration() {
  const clientId = process.env.NEONOMICS_CLIENT_ID;
  const clientSecret = process.env.NEONOMICS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("NEONOMICS_NOT_CONFIGURED");
  return { clientId, clientSecret, baseUrl: process.env.NEONOMICS_ENVIRONMENT === "production" ? "https://api.neonomics.io" : sandboxBase };
}

export async function neonomicsToken() {
  const config = configuration();
  const response = await fetch(`${config.baseUrl}/auth/realms/${config.baseUrl === sandboxBase ? "sandbox" : "production"}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("NEONOMICS_AUTH_FAILED");
  const value = await response.json();
  return { accessToken: String(value.access_token), baseUrl: config.baseUrl };
}

export async function neonomicsRequest(path: string, options: { method?: string; sessionId?: string; deviceId?: string; body?: unknown; redirectUrl?: string } = {}) {
  const auth = await neonomicsToken();
  const response = await fetch(`${auth.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.sessionId ? { "x-session-id": options.sessionId } : {}),
      ...(options.deviceId ? { "x-device-id": options.deviceId } : {}),
      ...(options.redirectUrl ? { "x-redirect-url": options.redirectUrl } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const value = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, value };
}
