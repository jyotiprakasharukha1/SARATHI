
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    if (decoded.purpose !== "access") {
  return res.status(401).json({
    success: false,
    message: "Invalid access token"
  });
}

    const user = await User.findById(decoded.id)
      .select("_id role accountStatus");

    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable"
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token"
    });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource"
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
