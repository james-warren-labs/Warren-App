import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Support both server/.env and the repository-root .env during local development.
// Production deployments should configure secrets in the hosting dashboard.
dotenv.config();
dotenv.config({ path: "../.env" });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

const allowedOrigins = (process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost,http://localhost")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Native Android clients and command-line tools may omit Origin.
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600,
}));
app.use(express.json({ limit: "64kb", strict: true }));

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT || 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a little before trying again." },
});
app.use("/api/chat", chatLimiter);

function hasKey(provider) {
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

function configuredProviders() {
  return ["groq", "gemini"].filter(hasKey);
}

function providerOrder() {
  const requested = (process.env.AI_PROVIDER || "auto").trim().toLowerCase();
  if (requested === "groq" || requested === "gemini") {
    return hasKey(requested) ? [requested] : [];
  }
  if (requested !== "auto") return [];
  // Auto mode tries Groq first, then Gemini if both keys are available.
  return ["groq", "gemini"].filter(hasKey);
}

function validateMessages(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_MESSAGES) {
    throw Object.assign(new Error(`Send between 1 and ${MAX_MESSAGES} messages.`), { status: 400 });
  }

  let totalChars = 0;
  const messages = input.map((message) => {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      throw Object.assign(new Error("Each message must have a valid role and text content."), { status: 400 });
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      throw Object.assign(new Error(`Each message must contain 1–${MAX_MESSAGE_CHARS} characters.`), { status: 400 });
    }
    totalChars += content.length;
    return { role: message.role, content };
  });

  if (totalChars > MAX_TOTAL_CHARS) {
    throw Object.assign(new Error("This conversation is too long. Start a new chat or shorten your messages."), { status: 413 });
  }
  if (messages[messages.length - 1].role !== "user") {
    throw Object.assign(new Error("The last message must be from the user."), { status: 400 });
  }
  return messages;
}

const SYSTEM_INSTRUCTION = [
  "You are Warren, a helpful, clear, and friendly AI assistant.",
  "Answer the user's actual question directly and accurately.",
  "Use Markdown when it improves readability, including fenced code blocks for code.",
  "If you are uncertain, say so rather than inventing facts.",
  "For high-stakes topics, be careful and encourage checking reliable sources.",
].join(" ");

async function requestGroq(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq is not configured.");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, ...messages],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Groq returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Groq returned an empty response.");
  return { answer: answer.trim(), provider: "groq", model };
}

async function requestGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const answer = data?.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();
  if (!answer) throw new Error("Gemini returned an empty response. The request may have been blocked by a safety filter.");
  return { answer, provider: "gemini", model };
}

app.get("/api/health", (_req, res) => {
  const providers = providerOrder();
  res.json({
    ok: true,
    service: "warren-ai-api",
    configured: providers.length > 0,
    provider: providers[0] || null,
    availableProviders: configuredProviders(),
  });
});

app.post("/api/chat", async (req, res) => {
  let messages;
  try {
    messages = validateMessages(req.body?.messages);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message });
  }

  const providers = providerOrder();
  if (!providers.length) {
    const requested = (process.env.AI_PROVIDER || "auto").trim().toLowerCase();
    const detail = requested === "groq" || requested === "gemini"
      ? `The selected provider (${requested}) has no API key configured.`
      : "Add GEMINI_API_KEY or GROQ_API_KEY to the server environment.";
    return res.status(503).json({ error: `AI is not configured. ${detail}` });
  }

  const failures = [];
  for (const provider of providers) {
    try {
      const result = provider === "gemini"
        ? await requestGemini(messages)
        : await requestGroq(messages);
      return res.json(result);
    } catch (error) {
      // Log only provider and status. Never log keys, headers, or conversation text.
      console.error(`[${provider}] AI request failed:`, error.status || error.name || "unknown");
      failures.push({ provider, error });
    }
  }

  const lastFailure = failures[failures.length - 1]?.error;
  if (failures.some(({ error }) => error?.name === "TimeoutError" || error?.name === "AbortError")) {
    return res.status(504).json({ error: "The AI took too long to respond. Please try again." });
  }
  if (failures.length === 1 && lastFailure?.status === 429) {
    return res.status(429).json({ error: "The AI provider is rate-limited or its quota is exhausted. Try again later." });
  }
  if (failures.length === 1 && [401, 403].includes(lastFailure?.status)) {
    return res.status(502).json({ error: "The configured AI provider rejected its API key. Check the server environment settings." });
  }
  return res.status(502).json({
    error: "Warren could not get a response from the configured AI providers. Check the server logs and provider quota, then try again.",
  });
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  if (error?.message === "Origin is not allowed by CORS.") return res.status(403).json({ error: error.message });
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Request body must be valid JSON." });
  console.error("API error:", error?.message || "unknown");
  return res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, HOST, () => {
  console.log(`Warren AI API listening on http://${HOST}:${PORT}`);
  const providers = configuredProviders();
  console.log(providers.length ? `Configured AI providers: ${providers.join(", ")}` : "No AI provider keys configured yet.");
});
