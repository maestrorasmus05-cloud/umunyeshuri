// Supabase Edge Function: username-login
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Deploy with JWT verification disabled because this endpoint performs password auth itself.
// Keep responses generic to avoid revealing whether a username exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://maestrorasmus05-cloud.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function headersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://maestrorasmus05-cloud.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  const headers = headersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { username, password } = body ?? {};
    if (typeof username !== "string" ||
        !/^[a-zA-Z0-9_.]{3,24}$/.test(username) ||
        typeof password !== "string" ||
        password.length < 1 || password.length > 1024) {
      return Response.json({ error: "Invalid username/email or password." }, { status: 400, headers });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) {
      return Response.json({ error: "Sign-in service is not configured." }, { status: 500, headers });
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // The SQL trigger stores usernames in lowercase, so exact equality is safe:
    // no LIKE wildcards and no email address is returned to the browser.
    const { data: match, error: lookupError } = await admin
      .from("auth_username_lookup")
      .select("email")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (lookupError || !match?.email) {
      return Response.json({ error: "Invalid username/email or password." }, { status: 401, headers });
    }

    // Supabase Auth verifies the password and enforces email confirmation and auth rate limits.
    const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: match.email, password }),
    });

    if (!authResponse.ok) {
      return Response.json({
        error: "Invalid username/email or password, or email not confirmed.",
      }, { status: 401, headers });
    }

    const payload = await authResponse.json();
    if (typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string") {
      return Response.json({ error: "Unable to sign in right now. Please try again." }, { status: 502, headers });
    }

    return Response.json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    }, { status: 200, headers });
  } catch {
    return Response.json({ error: "Unable to sign in right now. Please try again." }, { status: 500, headers });
  }
});
