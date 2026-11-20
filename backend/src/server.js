require("dotenv").config();

const http = require("http");
const app = require("./app");
const connectDB = require("./config/database");
const createTrackingSocket = require("./socket/trackingSocket");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    // Attach the live tracking service to the HTTP server.
    const io = createTrackingSocket(server);

    // Make Socket.IO available to other backend modules if needed.
    app.set("io", io);

    server.listen(PORT, () => {
      console.log(`SARATHI API running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
      console.log("SARATHI live tracking is ready.");
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();