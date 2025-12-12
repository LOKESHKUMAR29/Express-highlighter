const fs = require('fs');
const path = require('path');

// Path to the pdf.mjs file in pdfjs-dist
const pdfJsPath = path.join(
  __dirname,
  'node_modules/pdfjs-dist/legacy/build/pdf.mjs'
);

try {
  // Read the file
  let content = fs.readFileSync(pdfJsPath, 'utf-8');
  
  // Replace the worker path references
  // This makes the worker path absolute instead of relative
  content = content.replace(
    /new URL\("pdf\.worker\.min\.mjs",import\.meta\.url\)\.href/g,
    '__dirname + "/pdf.worker.min.mjs"'
  );
  
  content = content.replace(
    /new URL\("pdf\.worker\.mjs",import\.meta\.url\)\.href/g,
    '__dirname + "/pdf.worker.mjs"'
  );
  
  // Write back
  fs.writeFileSync(pdfJsPath, content);
  
  console.log('Successfully patched pdfjs-dist for Vercel deployment');
} catch (error) {
  console.error('Failed to patch pdfjs-dist:', error.message);
  process.exit(1);
}