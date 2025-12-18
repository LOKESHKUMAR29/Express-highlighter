import express from "express";
import cors from "cors";
import path from "path";
import axios from "axios";
import { findMatchesInTextBatch, loadSkillsData } from "./services/skills-matcher.js";
import { processPDFForSkills } from "./services/pdf-processor.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Middleware for proxy resource handling (images/css loaded by the proxied page)
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  
  // Skip local static files
  if (req.path === "/highlight.js" || req.path === "/skills-output.json") return next();

  const referer = req.get("referer");
  if (!referer?.includes("/api/html-proxy?url=")) return next();

  const urlParam = referer.match(/url=([^&]+)/)?.[1];
  if (!urlParam) return next();

  const origin = new URL(decodeURIComponent(urlParam)).origin;
  const target = origin + req.url;

  try {
    const r = await axios.get(target, { responseType: "arraybuffer" });
    if (r.headers["content-type"]) {
      res.setHeader("Content-Type", r.headers["content-type"]);
    }
    return res.send(r.data);
  } catch {
    return next();
  }
});

// Proxy Route
app.get("/api/html-proxy", async (req, res) => {
  try {
    const target = req.query.url;
    if (!target) return res.status(400).send("Missing ?url=");

    console.log("Loading page:", target);

    const response = await axios.get(target);
    let html = response.data;

    html = html.replace(
      "</head>",
      `<script>sessionStorage.setItem("tl", "1");</script></head>`
    );

    html = html.replace(
      "</body>",
      `<script src="/highlight.js"></script></body>`
    );

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("PROXY ERROR:", err);
    res.status(500).send("Proxy failed: " + err.message);
  }
});

app.post("/api/skill-match-batch", async (req, res) => {
    try {
        await loadSkillsData();
        const { texts } = req.body;
        if (!texts || !Array.isArray(texts)) {
             return res.status(400).json({ error: "Invalid 'texts' array" });
        }
        const results = findMatchesInTextBatch(texts);
        res.json({ results });
    } catch (err) {
        console.error("Batch match error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/process-pdf", async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing pdfUrl in request body",
      });
    }

    console.log("PDF URL:", pdfUrl);

    const result = await processPDFForSkills(pdfUrl);
    res.json(result);
  } catch (error) {
    console.error("PDF processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process PDF",
    });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: err.message
  });
});

export default app;
