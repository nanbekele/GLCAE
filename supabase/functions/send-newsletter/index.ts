// @ts-nocheck
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "http://localhost:8080";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { subject, html, articleId } = await req.json().catch(() => ({ }));

    let emailSubject = subject || "GCAE Vision Hub — Latest News";
    let emailHtml = html || "";

    if (!emailHtml) {
      // If no HTML was provided, attempt to build from latest article
      let articleTitle = "Latest Update";
      let articleExcerpt = "Stay tuned for the latest news from Vision Hub.";
      let articleLink = `${PUBLIC_SITE_URL}/news`;

      if (supabase) {
        const { data } = await supabase
          .from("news")
          .select("id,title,excerpt")
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const a = data[0];
          articleTitle = a.title || articleTitle;
          articleExcerpt = a.excerpt || articleExcerpt;
          articleLink = `${PUBLIC_SITE_URL}/news/${a.id}`;
          emailSubject = `Vision Hub — ${articleTitle}`;
        }
      }

      emailHtml = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto;">
          <h1 style="color: #111827; font-size: 20px;">${articleTitle}</h1>
          <p style="color: #374151; font-size: 14px;">${articleExcerpt}</p>
          <a href="${articleLink}" style="background: #2563eb; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Read more</a>
        </div>
      `;
    }

    // If no API key, perform a dry run
    if (!resend) {
      return new Response(
        JSON.stringify({ sent: false, mode: "dry-run", subject: emailSubject }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // In real usage, provide a list of recipients or fetch from DB.
    // For safety, send to a single test recipient when running locally.
    const to = Deno.env.get("NEWSLETTER_TEST_RECIPIENT") || "test@example.com";

    const result = await resend.emails.send({
      from: "Vision Hub <no-reply@visionhub.example>",
      to,
      subject: emailSubject,
      html: emailHtml,
    });

    return new Response(JSON.stringify({ sent: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);