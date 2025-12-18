import 'dotenv/config';
import app from "./src/app.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Available endpoints:");
    console.log("  POST /api/process-pdf");
    console.log("  GET  /api/html-proxy?url=TARGET_URL");
});

// Graceful Shutdown
const shutdown = () => {
    console.log("SIGTERM/SIGINT received. Shutting down gracefully...");
    server.close(() => {
        console.log("Process terminated.");
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Error Handling
process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
    process.exit(1);
});