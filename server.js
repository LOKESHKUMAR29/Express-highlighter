const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.use(async (req, res, next) => {
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

app.listen(PORT, () =>
  console.log(`Proxy running → http://localhost:${PORT}/proxy?url=TARGET_URL`)
);
