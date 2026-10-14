import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const port = Number(process.env.PORT || 3000);
const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
const maxMessageLength = 8000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "64kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT || 12),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many messages in a short time. Please wait a minute and try again." },
});

function getProviderConfig() {
  if (provider === "groq") {
    return {
      name: "Groq",
      key: process.env.GROQ_API_KEY,
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      url: "https://api.groq.com/openai/v1/chat/completions",
    };
  }
  if (provider === "openai") {
    return {
      name: "OpenAI",
      key: process.env.OPENAI_API_KEY,
      model: process.env.AI_MODEL || "gpt-4o-mini",
      url: "https://api.openai.com/v1/chat/completions",
    };
  }
  return null;
}

app.get("/api/health", (_req, res) => {
  const config = getProviderConfig();
  res.json({
    ok: true,
    service: "warren-ai-api",
    provider: config?.name || "unsupported",
    configured: Boolean(config?.key),
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: "Send between 1 and 20 messages." });
  }

  const safeMessages = [];
  for (const item of messages) {
    if (!item || !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !item.content.trim() ||
        item.content.length > maxMessageLength) {
      return res.status(400).json({ error: "Each message must have a valid role and contain 1–8000 characters." });
    }
    safeMessages.push({ role: item.role, content: item.content.trim() });
  }
  if (safeMessages[safeMessages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user." });
  }

  const config = getProviderConfig();
  if (!config) {
    return res.status(500).json({ error: "AI_PROVIDER must be set to groq or openai." });
  }
  if (!config.key) {
    return res.status(503).json({
      error: `AI is not configured yet. Add ${provider === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"} to the server environment.`,
    });
  }

  try {
    const upstream = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "You are Warren, a helpful, honest, and clear AI assistant. Explain concepts accessibly, ask clarifying questions when useful, and do not claim to have performed actions you have not performed." },
          ...safeMessages,
        ],
        temperature: 0.7,
        max_tokens: 1600,
      }),
      signal: AbortSignal.timeout(45000),
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI provider request failed:", upstream.status, payload?.error?.type || payload?.error?.code || "unknown");
      if (upstream.status === 401 || upstream.status === 403) {
        return res.status(502).json({ error: "The AI provider rejected the server key. Check your provider credentials." });
      }
      if (upstream.status === 429) {
        return res.status(429).json({ error: "The AI provider is busy or its usage limit was reached. Please try again later." });
      }
      return res.status(502).json({ error: "The AI provider could not complete this request. Please try again." });
    }

    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({ error: "The AI provider returned an empty response. Please try again." });
    }
    res.json({ answer: answer.trim(), provider: config.name, model: config.model });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error("AI request error:", timedOut ? "timeout" : error?.message || "unknown");
    res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "The AI request timed out. Please try again." : "Could not reach the AI provider. Check the server connection and try again.",
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  if (error?.message === "Origin is not allowed by CORS.") return res.status(403).json({ error: error.message });
  console.error("API error:", error?.message || "unknown");
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Warren AI API listening on port ${port}`);
  if (!getProviderConfig()?.key) {
    console.log("AI provider key is not configured. Add it to the server environment to enable responses.");
  }
});