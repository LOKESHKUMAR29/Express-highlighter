const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const apiRouter = require("./routes/api");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Middleware for proxy resource handling (images/css loaded by the proxied page)
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (req.path === "/proxy") return next();
  
  // Skip local static files
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

// Mount API routes
app.use("/api", apiRouter);

// Proxy Route
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

module.exports = app;
