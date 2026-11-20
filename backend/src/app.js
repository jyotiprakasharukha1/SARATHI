
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// ========================================
// 1. ROUTE IMPORTS
// ========================================

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const shopRoutes = require("./routes/shopRoutes");
const adminRoutes = require("./routes/adminRoutes");
const orderRoutes = require("./routes/orderRoutes");
const fleetSessionRoutes = require("./routes/fleetSessionRoutes");
const merchantLocationRoutes = require("./routes/merchantLocationRoutes");
const adminTrackingRoutes = require("./routes/adminTrackingRoutes");

// ========================================
// 2. INITIALIZE EXPRESS APP
// ========================================

const app = express();

// ========================================
// 3. SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

// ========================================
// 4. CORS CONFIGURATION
// ========================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://10.46.94.173:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// ========================================
// 5. REQUEST BODY PARSING
// ========================================

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

// ========================================
// 6. API RATE LIMITING
// ========================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

// ========================================
// 7. ROOT ROUTE
// ========================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Welcome to SARATHI API",
    tagline: "More Than Just Delivery"
  });
});

// ========================================
// 8. HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "SARATHI backend is running",
    timestamp: new Date().toISOString()
  });
});

// ========================================
// 9. AUTHENTICATION ROUTES
// ========================================

app.use("/api/auth", authRoutes);

// ========================================
// 10. PRODUCT MARKETPLACE ROUTES
// ========================================

app.use("/api/products", productRoutes);

// ========================================
// 11. SHOP DISCOVERY AND STOREFRONT ROUTES
// ========================================

app.use("/api/shops", shopRoutes);

// ========================================
// 12. ADMIN MANAGEMENT ROUTES
// ========================================

app.use("/api/admin", adminRoutes);

// ========================================
// 13. ORDER MANAGEMENT ROUTES
// ========================================

app.use("/api/orders", orderRoutes);

// ========================================
// 14. FLEET SESSION ROUTES
// ========================================

app.use("/api/fleet-session", fleetSessionRoutes);

// ========================================
// 15. MERCHANT SHOP LOCATION ROUTES
// ========================================

app.use(
  "/api/merchant-locations",
  merchantLocationRoutes
);

// ========================================
// 16. ADMIN TRACKING ROUTES
// ========================================

app.use("/api/admin/tracking", adminTrackingRoutes);

// ========================================
// 17. API NOT FOUND HANDLER
// ========================================

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found"
    });
  }

  next();
});

// ========================================
// 18. GLOBAL ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
  console.error("SARATHI API Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message || "Internal server error"
  });
});

// ========================================
// 19. EXPORT APP
// ========================================

module.exports = app;
