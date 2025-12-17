const app = require("./src/app");

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Available endpoints:");
    console.log("  POST /api/process-pdf");
    console.log("  GET  /proxy?url=TARGET_URL");
});

module.exports = app;