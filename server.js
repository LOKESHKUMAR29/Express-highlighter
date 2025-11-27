const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;
let browser;

app.use(express.static("public"));

async function initBrowser() {
  if (!browser) {
    const puppeteer = require("puppeteer");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ],
    });
  }
  return browser;
}

app.use(async (req, res, next) => {
  if (req.path === "/proxy") return next();
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
    const b = await initBrowser();
    const page = await b.newPage();
    await page.goto(target, { waitUntil: "networkidle2", timeout: 60000 });
    let html = await page.evaluate(() => document.documentElement.outerHTML);
    html = html.replace(
      "</head>",
      `<script>sessionStorage.setItem("tl", "1");</script></head>`
    );
    html = html.replace(
      "</body>",
      `<script src="/highlight.js"></script></body>`
    );
    await page.close();
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("❌ PROXY ERROR:", err);
    res.status(500).send("Proxy failed: " + err.message);
  }
});

app.listen(PORT, () =>
  console.log(`Proxy running on port ${PORT}`)
);