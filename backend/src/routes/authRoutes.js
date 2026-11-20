
const express = require("express");
const router = express.Router();

const {
  register,
  verifyEmail,
  resendRegistrationOTP,
  login,
  requestLoginOTP,
  verifyLoginOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getProfile
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

// Registration
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendRegistrationOTP);

// Password login
router.post("/login", login);

// OTP login
router.post("/request-login-otp", requestLoginOTP);
router.post("/verify-login-otp", verifyLoginOTP);

// Forgot password
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/reset-password", resetPassword);

// Protected profile
router.get("/me", protect, getProfile);

module.exports = router;
