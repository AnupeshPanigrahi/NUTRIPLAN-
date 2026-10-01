/**
 * NutriPlan AI endpoint - OpenAI
 * Vercel serverless function, Node 18+
 *
 * GET  /api/chat -> { ok: true, configured: boolean }
 * POST /api/chat -> { text: string }
 */

const API_URL = "https://api.openai.com/v1/chat/completions";

const MODELS = {
  quick: process.env.MODEL_QUICK || "gpt-4o-mini",
  default: process.env.MODEL_DEFAULT || "gpt-4o-mini",
};

const MAX_TOKENS = {
  quick: 700,
  default: 1200,
};

const LANGS = [
  "English",
  "Hindi",
  "Odia",
  "Kannada",
  "Telugu",
  "Tamil",
  "Bengali",
];

const AGE_TEXT = {
  kid: "a child (use very simple words and a friendly tone, and remind them to ask a grown-up)",
  teen: "a teenager (simple and respectful, and never suggest weight loss)",
  adult: "an adult",
  senior: "an older adult (clear short sentences and a gentle tone)",
};

function systemPrompt(lang, ageGroup) {
  return (
    "You are the friendly AI helper inside NutriPlan, a nutrition and patient-care app used in India. " +
    "The person is " +
    AGE_TEXT[ageGroup] +
    ". " +
    "You are not a doctor. Do not diagnose and never prescribe medicines or change doses. " +
    "For emergency warning signs such as chest pain, trouble breathing, fainting, signs of stroke, " +
    "severe bleeding, or thoughts of self-harm, tell them to call 112 or go to the nearest hospital now. " +
    "Use simple warm language, Indian foods and rupees, and respect their diet preference and budget. " +
    "Give practical steps. Write plain text only. Use short lines or dashes for lists. " +
    "Keep answers under 170 words unless asked for more. " +
    "Reply in " +
    lang +
    "."
  );
}


/* Basic rate limiting */

const hits = new Map();

const WINDOW_MS = 60 * 1000;

const MAX_HITS = Number(
  process.env.RATE_LIMIT_PER_MINUTE || 20
);

function limited(ip) {
  const now = Date.now();

  const arr = (hits.get(ip) || []).filter(
    (time) => now - time < WINDOW_MS
  );

  arr.push(now);

  hits.set(ip, arr);

  if (hits.size > 5000) {
    hits.clear();
  }

  return arr.length > MAX_HITS;
}


/* Validate incoming messages */

function validate(body) {
  if (!body || typeof body !== "object") {
    return "Invalid request.";
  }

  const { messages } = body;

  if (
    !Array.isArray(messages) ||
    messages.length < 1 ||
    messages.length > 13
  ) {
    return "Invalid messages.";
  }

  let total = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (
      !message ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      return "Invalid message.";
    }

    const expectedRole =
      i % 2 === 0 ? "user" : "assistant";

    if (message.role !== expectedRole) {
      return "Messages must alternate user and assistant.";
    }

    total += message.content.length;
  }

  if (
    messages[messages.length - 1].role !== "user"
  ) {
    return "Last message must be from the user.";
  }

  if (total > 20000) {
    return "Message too long.";
  }

  return null;
}


/* Vercel API handler */

module.exports = async function handler(req, res) {

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  const key =
    process.env.OPENAI_API_KEY;


  /* Check configuration */

  if (req.method === "GET") {

    return res.status(200).json({
      ok: true,
      configured: Boolean(key),
    });

  }


  /* Only GET and POST allowed */

  if (req.method !== "POST") {

    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res.status(405).json({
      error: "Method not allowed.",
    });

  }


  /* Check API key */

  if (!key) {

    return res.status(503).json({
      error: "AI is not configured.",
    });

  }


  /* Optional origin protection */

  const allowed =
    process.env.ALLOWED_ORIGIN;

  if (
    allowed &&
    req.headers.origin &&
    req.headers.origin !== allowed
  ) {

    return res.status(403).json({
      error: "Origin not allowed.",
    });

  }


  /* Rate limit */

  const ip = String(
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown"
  )
    .split(",")[0]
    .trim();

  if (limited(ip)) {

    return res.status(429).json({
      error:
        "Too many requests. Please wait a moment.",
    });

  }


  /* Parse request */

  let body = req.body;

  if (typeof body === "string") {

    try {

      body = JSON.parse(body);

    } catch {

      body = null;

    }

  }


  const problem = validate(body);

  if (problem) {

    return res.status(400).json({
      error: problem,
    });

  }


  const tier =
    body.tier === "default"
      ? "default"
      : "quick";


  const lang =
    LANGS.includes(body.lang)
      ? body.lang
      : "English";


  const ageGroup =
    AGE_TEXT[body.ageGroup]
      ? body.ageGroup
      : "adult";


  /* Timeout */

  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    25000
  );


  try {

    /* OpenAI message format */

    const messages = [

      {
        role: "system",
        content:
          systemPrompt(
            lang,
            ageGroup
          ),
      },

      ...body.messages.map(
        (message) => ({
          role: message.role,
          content: message.content,
        })
      ),

    ];


    /* Call OpenAI */

    const response =
      await fetch(
        API_URL,
        {

          method: "POST",

          signal:
            controller.signal,

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${key}`,

          },

          body: JSON.stringify({

            model:
              MODELS[tier],

            messages,

            max_tokens:
              MAX_TOKENS[tier],

          }),

        }
      );


    /* OpenAI returned an error */

    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        "OpenAI API error:",
        response.status,
        errorText.slice(0, 500)
      );


      if (response.status === 429) {

        return res.status(429).json({
          error:
            "OpenAI API quota or rate limit reached. Please try again.",
        });

      }


      if (response.status === 401) {

        return res.status(502).json({
          error:
            "OpenAI API authentication failed.",
        });

      }


      return res.status(502).json({
        error:
          "The AI service could not answer. Please try again.",
      });

    }


    /* Read OpenAI response */

    const data =
      await response.json();


    const text =
      data?.choices?.[0]
        ?.message?.content
        ?.trim();


    if (!text) {

      console.error(
        "OpenAI returned an empty response."
      );

      return res.status(502).json({
        error:
          "The AI returned an empty response.",
      });

    }


    return res.status(200).json({
      text,
    });


  } catch (error) {

    console.error(
      "Chat handler error:",
      error?.name,
      error?.message
    );


    return res.status(504).json({
      error:
        "The AI took too long. Please try again.",
    });


  } finally {

    clearTimeout(timer);

  }

};
