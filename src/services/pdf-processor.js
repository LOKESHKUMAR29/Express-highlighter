const axios = require("axios");
const { pathToFileURL } = require("url");
const { findMatchesInText, loadSkillsData } = require("./skills-matcher");

// Polyfill DOM APIs for pdfjs-dist in Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.m = [1, 0, 0, 1, 0, 0];
    }
  };
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

// Polyfill Canvas for pdfjs-dist
const { createCanvas } = require('canvas');
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return createCanvas(200, 200);
      }
      return {};
    }
  };
}

// Dynamic import for pdfjs-dist (ES Module)
let pdfjsLib = null;

async function initPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
  }
  return pdfjsLib;
}

async function extractTextFromPDF(pdfUrl) {
  try {
    const pdfjs = await initPdfJs();

    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 75 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const pdfData = new Uint8Array(response.data);
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += " " + pageText;
    }

    return fullText.trim();
  } catch (error) {
    console.error("PDF extraction error:", error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function processPDFForSkills(pdfUrl) {
  const startTime = Date.now();

  try {
    // Extract text
    const pdfText = await extractTextFromPDF(pdfUrl);

    if (!pdfText || pdfText.trim().length === 0) {
      return {
        success: true,
        matches: [],
        totalMatches: 0,
        message: "No text found in PDF",
        processingTime: `${Date.now() - startTime}ms`,
      };
    }

    await loadSkillsData();
    // Use common logic to find matches
    const matchesArray = findMatchesInText(pdfText);

    const processingTime = Date.now() - startTime;
    console.log(`[PDFProcessor] Found ${matchesArray.length} unique skills`);

    return {
      success: true,
      matches: matchesArray,
      totalMatches: matchesArray.length,
      processingTime: `${processingTime}ms`,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[PDFProcessor] Error:", error);

    return {
      success: false,
      error: error.message || "Failed to process PDF",
      processingTime: `${processingTime}ms`,
    };
  }
}

module.exports = {
  processPDFForSkills,
};
