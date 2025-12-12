const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { loadSkillsData, processPDFForSkills} = require("./pdf-matcher");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (req.path === "/proxy") return next();
  if (req.path === "/highlight.js" || req.path === "/skills-output.json") return next();

  const referer = req.get("referer");
  if (!referer?.includes("/proxy?url=")) return next();

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

app.get("/proxy", async (req, res) => {
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

loadSkillsData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("Available endpoints:");
      console.log("  POST /api/process-pdf");
      console.log("  GET  /proxy?url=TARGET_URL");
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
