/**
 * NutriPlan AI endpoint (Vercel serverless function, Node 18+).
 *
 *   GET  /api/chat  -> { ok: true, configured: boolean }
 *   POST /api/chat  -> { text: string }
 *
 * The Anthropic API key stays on the server (ANTHROPIC_API_KEY env var).
 * The system prompt also lives here, so visitors cannot replace the safety rules.
 */

const API_URL = "https://api.openai.com/v1/chat/completions";
const MODELS = {
  quick: process.env.MODEL_QUICK || "gpt-5.6-luna",
  default: process.env.MODEL_DEFAULT || "gpt-5.6-luna",
};
const MAX_TOKENS = { quick: 700, default: 1200 };

const LANGS = ["English", "Hindi", "Odia", "Kannada", "Telugu", "Tamil", "Bengali"];
const AGE_TEXT = {
  kid: "a child (use very simple words and a friendly tone, and remind them to ask a grown-up)",
  teen: "a teenager (simple and respectful, and never suggest weight loss)",
  adult: "an adult",
  senior: "an older adult (clear short sentences and a gentle tone)",
};

function systemPrompt(lang, ageGroup) {
  return (
    "You are the friendly AI helper inside NutriPlan, a nutrition and patient-care app used in India. " +
    "The person is " + AGE_TEXT[ageGroup] + ". " +
    "Rules: You are not a doctor. Do not diagnose, and never prescribe medicines or change doses. " +
    "For warning signs (chest pain, trouble breathing, fainting, signs of stroke, very high or very low blood pressure or blood sugar, severe bleeding, thoughts of self-harm) " +
    "tell them to call 112 or go to the nearest hospital now. " +
    "Use simple warm language, Indian foods and rupees, and respect their diet preference and budget. " +
    "Give practical steps. Write plain text only: no markdown symbols such as asterisks or hash signs; use short lines or a dash for lists. " +
    "Keep answers under 170 words unless asked for more. Reply in " + lang + "."
  );
}

/* Very small in-memory rate limit (per server instance). For production use Upstash/Vercel KV. */
const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_HITS = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_HITS;
}

function validate(body) {
  if (!body || typeof body !== "object") return "Invalid request.";
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 13) return "Invalid messages.";
  let total = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m.content !== "string" || !m.content.trim()) return "Invalid message.";
    if (m.role !== (i % 2 === 0 ? "user" : "assistant")) return "Messages must alternate user and assistant.";
    total += m.content.length;
  }
  if (messages[messages.length - 1].role !== "user") return "Last message must be from the user.";
  if (total > 20000) return "Message too long.";
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.OPENAI_API_KEY;

  if (req.method === "GET") return res.status(200).json({ ok: true, configured: Boolean(key) });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!key) return res.status(503).json({ error: "AI is not configured." });

  const allowed = process.env.ALLOWED_ORIGIN; // e.g. https://nutriplan.vercel.app
  if (allowed && req.headers.origin && req.headers.origin !== allowed) {
    return res.status(403).json({ error: "Origin not allowed." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ error: "Too many requests. Please wait a moment." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const problem = validate(body);
  if (problem) return res.status(400).json({ error: problem });

  const tier = body.tier === "default" ? "default" : "quick";
  const lang = LANGS.includes(body.lang) ? body.lang : "English";
  const ageGroup = AGE_TEXT[body.ageGroup] ? body.ageGroup : "adult";

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELS[tier],
        max_tokens: MAX_TOKENS[tier],
        system: systemPrompt(lang, ageGroup),
        messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!r.ok) {
      console.error("Anthropic API error", r.status, (await r.text()).slice(0, 300));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "The AI service could not answer. Please try again." });
    }
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.status(200).json({ text });
  } catch (e) {
    console.error("chat handler error", e && e.name);
    return res.status(504).json({ error: "The AI took too long. Please try again." });
  } finally {
    clearTimeout(timer);
  }
};
