// Supabase Edge Function: username-login
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Deploy with JWT verification disabled because this endpoint performs password auth itself.
// Keep responses generic to avoid revealing whether a username exists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" ||
        username.length < 3 || username.length > 254 || password.length < 1 || password.length > 1024) {
      return Response.json({ error: "Invalid username or password." }, { status: 400, headers: corsHeaders });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Email addresses are never sent back to the browser.
    const { data: match, error: lookupError } = await admin
      .from("auth_username_lookup")
      .select("email")
      .ilike("username", username.replace(/[\\%_]/g, (c) => "\\" + c))
      .maybeSingle();

    if (lookupError || !match?.email) {
      return Response.json({ error: "Invalid username/email or password." }, { status: 401, headers: corsHeaders });
    }

    // Let Supabase Auth verify the password and enforce email confirmation/rate limits.
    const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: match.email, password }),
    });
    const payload = await authResponse.json();
    if (!authResponse.ok) {
      return Response.json({ error: "Invalid username/email or password, or email not confirmed." }, { status: 401, headers: corsHeaders });
    }

    return Response.json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    }, { status: 200, headers: corsHeaders });
  } catch {
    return Response.json({ error: "Unable to sign in right now. Please try again." }, { status: 500, headers: corsHeaders });
  }
});
