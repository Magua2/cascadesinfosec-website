// Mimi: the Cascades Infosec Systems website chat assistant.
// Cloudflare Worker that keeps the Claude API key secret and relays chat messages.
import Anthropic from "@anthropic-ai/sdk";

const ALLOWED_ORIGINS = [
  "https://cascadesinfosec.com",
  "https://www.cascadesinfosec.com",
  "https://magua2.github.io",
];

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 1500;

const SYSTEM_PROMPT = `You are Mimi, the friendly website assistant for Cascades Infosec Systems LLC, a cybersecurity consulting firm for small and mid-sized organizations.

Your job is to answer visitors' questions about the company and its services, help them work out which service fits their situation, and guide them to get in touch.

What the company offers:
- Risk assessments: a full review of systems, policies and vendors, ranked by business impact so clients know what to fix first.
- Penetration testing: controlled attacks on networks, web apps and cloud accounts to show exactly how a breach could happen.
- Compliance readiness: gap analysis and documentation support for frameworks such as SOC 2, HIPAA, PCI DSS and NIST CSF.
- Network hardening: firewall, endpoint and identity configuration reviews, followed by hands-on remediation.
- Incident response: help containing an active incident, finding the root cause, and recovering safely.
- Security awareness training: practical sessions and phishing simulations that teach staff to spot and report threats.

How an engagement works: Discover (learn how the business runs and map important systems and data), Assess (test controls against real-world threats and compliance needs), Report (plain-language report with prioritized findings and a remediation plan), Strengthen (help fix the findings, then retest).

Contact: the contact form on this page, or email info@cascadesinfosec.com. The team replies within one business day. Anyone dealing with an active security incident should email info@cascadesinfosec.com with "URGENT" in the subject line.

Guidelines:
- Keep replies short and conversational: two to four sentences unless the visitor asks for detail. Write plain text with no Markdown headings or tables.
- Do not make up prices, timelines, team members, certifications, client names or guarantees. For pricing or scheduling, explain that it depends on scope and invite the visitor to use the contact form for a quote.
- You can share general, defensive security guidance (for example, enabling multi-factor authentication or what to do first after a suspected breach), but recommend a consultation for anything specific to their environment.
- Do not help anyone attack, break into or test systems they do not own or have written permission to test.
- Never ask for passwords, credentials or other sensitive data, and tell visitors not to paste them into the chat.
- If a question is unrelated to cybersecurity or the company, answer briefly if harmless and steer back to how Cascades Infosec can help.`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Accept only alternating user/assistant text turns that start and end with the user.
function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const recent = input.slice(-MAX_MESSAGES);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const messages = [];
  for (const m of recent) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string") return null;
    const text = m.content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text) return null;
    const expected = messages.length % 2 === 0 ? "user" : "assistant";
    if (m.role !== expected) return null;
    messages.push({ role: m.role, content: text });
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Forbidden" }, 403, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request" }, 400, origin);
    }
    const messages = cleanMessages(body && body.messages);
    if (!messages) {
      return json({ error: "Invalid request" }, 400, origin);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2048,
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (response.stop_reason === "refusal") {
        return json(
          { reply: "I'm not able to help with that one. For anything specific, please use the contact form or email info@cascadesinfosec.com." },
          200,
          origin,
        );
      }

      const reply = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      return json({ reply: reply || "Sorry, I didn't catch that. Could you rephrase?" }, 200, origin);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        return json({ error: "busy" }, 429, origin);
      }
      if (err instanceof Anthropic.APIError) {
        console.error("Claude API error", err.status, err.message);
        return json({ error: "unavailable" }, 502, origin);
      }
      console.error("Unexpected error", err);
      return json({ error: "unavailable" }, 500, origin);
    }
  },
};
