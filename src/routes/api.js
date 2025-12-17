const express = require("express");
const axios = require("axios");
const { findMatchesInTextBatch, loadSkillsData } = require("../services/skills-matcher");
const { processPDFForSkills } = require("../services/pdf-processor");

const router = express.Router();

router.use(async (req, res, next) => {
  if (req.path === "/proxy") return next();
  if (req.path.startsWith("/skill-match-batch")) return next();
  if (req.path.startsWith("/process-pdf")) return next();
  next();
});

router.post("/skill-match-batch", async (req, res) => {
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

router.post("/process-pdf", async (req, res) => {
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

module.exports = router;
