// @ts-nocheck -- Deno edge runtime
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gcae-auth, X-Gcae-Auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("EDGE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("EDGE_JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      return new Response(JSON.stringify({ error: "Missing server configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseClient.rpc("auth_login", {
      p_email: email,
      p_password: password,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data?.is_active === false || data?.is_activated === false) {
      return new Response(JSON.stringify({ error: "Account is inactive. Please contact an administrator." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const issuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;

    const subject = data?.user_id ?? data?.id;

    if (!subject) {
      return new Response(JSON.stringify({ error: "Profile is missing user identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appRole = (data?.role ?? "client") as string;

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      {
        sub: subject,
        role: "authenticated",
        app_role: appRole,
        email: data.email,
        full_name: data.full_name,
        aud: "authenticated",
        iss: issuer,
        iat: getNumericDate(0),
        exp: getNumericDate(60 * 60),
      },
      key,
    );

    return new Response(JSON.stringify({ token, profile: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
