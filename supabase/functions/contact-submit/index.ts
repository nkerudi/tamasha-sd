const allowedTopics = new Set(["competing", "sponsorship", "tickets", "press", "other"]);
const localOrigins = ["http://localhost:8000", "http://127.0.0.1:8000"];

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  topic?: unknown;
  message?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

function getAllowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([...localOrigins, ...configured]);
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" }
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getKeyMap(variable: string): Record<string, string> {
  try {
    return JSON.parse(Deno.env.get(variable) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function getAdminCredentials(): { key: string; legacy: boolean } {
  const secretKey = getKeyMap("SUPABASE_SECRET_KEYS").default;
  if (secretKey) return { key: secretKey, legacy: false };

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return { key: legacyKey, legacy: true };
}

function adminHeaders(credentials: { key: string; legacy: boolean }): Record<string, string> {
  return {
    "apikey": credentials.key,
    ...(credentials.legacy ? { "Authorization": `Bearer ${credentials.key}` } : {}),
    "Content-Type": "application/json"
  };
}

async function hashFingerprint(value: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${secret}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request) => {
  const requestOrigin = request.headers.get("Origin");
  const normalizedOrigin = requestOrigin?.replace(/\/$/, "") || null;
  const originAllowed = !normalizedOrigin || getAllowedOrigins().has(normalizedOrigin);

  if (request.method === "OPTIONS") {
    return originAllowed
      ? new Response(null, { status: 204, headers: corsHeaders(normalizedOrigin) })
      : new Response(null, { status: 403 });
  }

  if (!originAllowed) return jsonResponse({ error: "Origin not allowed." }, 403, null);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, normalizedOrigin);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Content-Type must be application/json." }, 415, normalizedOrigin);
  }

  const publishableKey = getKeyMap("SUPABASE_PUBLISHABLE_KEYS").default;
  if (!publishableKey || request.headers.get("apikey") !== publishableKey) {
    return jsonResponse({ error: "Unauthorized." }, 401, normalizedOrigin);
  }

  let payload: ContactPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400, normalizedOrigin);
  }

  const name = cleanString(payload.name);
  const email = cleanString(payload.email).toLowerCase();
  const topic = cleanString(payload.topic);
  const message = cleanString(payload.message);
  const honeypot = cleanString(payload.website);
  const startedAt = typeof payload.startedAt === "string" ? Date.parse(payload.startedAt) : NaN;

  if (honeypot) return jsonResponse({ ok: true }, 200, normalizedOrigin);
  if (name.length < 1 || name.length > 100) return jsonResponse({ error: "Please enter your name." }, 400, normalizedOrigin);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400, normalizedOrigin);
  }
  if (!allowedTopics.has(topic)) return jsonResponse({ error: "Please select a valid topic." }, 400, normalizedOrigin);
  if (message.length < 1 || message.length > 5000) {
    return jsonResponse({ error: "Please enter a message under 5,000 characters." }, 400, normalizedOrigin);
  }
  if (!Number.isFinite(startedAt) || startedAt > Date.now() || Date.now() - startedAt < 1000) {
    return jsonResponse({ error: "Please wait a moment and try again." }, 400, normalizedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const credentials = getAdminCredentials();
  if (!supabaseUrl || !credentials.key) {
    console.error("Missing Supabase function credentials.");
    return jsonResponse({ error: "The contact service is not configured." }, 500, normalizedOrigin);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwardedFor || request.headers.get("cf-connecting-ip") || "unknown";
  const fingerprint = await hashFingerprint(clientAddress, credentials.key);
  const tenMinutes = 10 * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / tenMinutes) * tenMinutes).toISOString();

  const rateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/check_contact_rate_limit`, {
    method: "POST",
    headers: adminHeaders(credentials),
    body: JSON.stringify({
      p_fingerprint: fingerprint,
      p_window_start: windowStart,
      p_max_requests: 5
    })
  });

  if (!rateResponse.ok) {
    console.error("Contact rate-limit check failed:", rateResponse.status);
    return jsonResponse({ error: "We couldn't send your message. Please try again." }, 500, normalizedOrigin);
  }

  if (!(await rateResponse.json())) {
    return jsonResponse({ error: "Too many messages were sent. Please try again in a few minutes." }, 429, normalizedOrigin);
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/contact_submissions`, {
    method: "POST",
    headers: { ...adminHeaders(credentials), "Prefer": "return=minimal" },
    body: JSON.stringify({ name, email, topic, message })
  });

  if (!insertResponse.ok) {
    console.error("Contact submission insert failed:", insertResponse.status);
    return jsonResponse({ error: "We couldn't send your message. Please try again." }, 500, normalizedOrigin);
  }

  return jsonResponse({ ok: true }, 201, normalizedOrigin);
});
