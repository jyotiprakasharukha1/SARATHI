
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  sendOTP,
  verifyOTP
} = require("../services/otpService");

const allowedRoles = ["customer", "merchant", "delivery"];

const normalizeEmail = (email) =>
  email.trim().toLowerCase();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      purpose: "access"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ======================================
// 1. REGISTER USER
// ======================================

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const selectedRole = role || "customer";

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number"
      });
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 100 characters"
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters"
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phone }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create an unverified account first
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: selectedRole,
      emailVerified: false,
      accountStatus: "pending"
    });

    try {
      await sendOTP(
        normalizedEmail,
        "registration",
        user._id
      );
    } catch (emailError) {
      // Do not leave an unusable account if email delivery fails
      await User.deleteOne({ _id: user._id });
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: "Registration started. Check your Gmail for the verification OTP.",
      email: normalizedEmail
    });

  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed"
    });
  }
};


// ======================================
// 2. VERIFY REGISTRATION EMAIL
// ======================================

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "Valid email and six-digit OTP are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    const verification = await verifyOTP(
      normalizedEmail,
      String(otp),
      "registration"
    );

    if (
      verification.userId &&
      verification.userId.toString() !== user._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP does not belong to this account"
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();

    // Merchants and delivery partners require admin approval
    user.accountStatus =
      user.role === "customer" ? "active" : "pending";

    await user.save();

    const token =
      user.accountStatus === "active"
        ? generateToken(user)
        : null;

    return res.status(200).json({
      success: true,
      message:
        user.accountStatus === "active"
          ? "Email verified. Registration successful."
          : "Email verified. Your account is awaiting approval.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error("Email verification error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Email verification failed"
    });
  }
};


// ======================================
// 3. RESEND REGISTRATION OTP
// ======================================

exports.resendRegistrationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user || user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "If registration is eligible, a verification email will be sent."
      });
    }

    const result = await sendOTP(
      normalizedEmail,
      "registration",
      user._id
    );

    return res.status(200).json(result);

  } catch (error) {
    return res.status(429).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================
// 4. EMAIL + PASSWORD LOGIN
// ======================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: normalizeEmail(email)
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your Gmail address first"
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is awaiting approval or is unavailable"
      });
    }

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};


// ======================================
// 5. REQUEST OTP LOGIN
// ======================================

exports.requestLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
      emailVerified: true,
      accountStatus: "active"
    });

    // Generic response avoids revealing account existence
    if (user) {
      await sendOTP(
        normalizedEmail,
        "login",
        user._id
      );
    }

    return res.status(200).json({
      success: true,
      message: "If the account is eligible, a login OTP will be sent."
    });

  } catch (error) {
    console.error("Login OTP error:", error.message);

    return res.status(429).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================
// 6. VERIFY OTP LOGIN
// ======================================

exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "Email and valid six-digit OTP are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const verification = await verifyOTP(
      normalizedEmail,
      String(otp),
      "login"
    );

    const user = await User.findOne({
      _id: verification.userId,
      email: normalizedEmail,
      emailVerified: true,
      accountStatus: "active"
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable"
      });
    }

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP login successful",
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("OTP login error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "OTP login failed"
    });
  }
};


// ======================================
// 7. FORGOT PASSWORD - REQUEST OTP
// ======================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
      emailVerified: true,
      accountStatus: "active"
    });

    if (user) {
      await sendOTP(
        normalizedEmail,
        "password-reset",
        user._id
      );
    }

    return res.status(200).json({
      success: true,
      message: "If the account is eligible, a password reset OTP will be sent."
    });

  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(429).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================
// 8. VERIFY PASSWORD RESET OTP
// ======================================

exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "Email and valid six-digit OTP are required"
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const verification = await verifyOTP(
      normalizedEmail,
      String(otp),
      "password-reset"
    );

    if (!verification.userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid password reset verification"
      });
    }

    const user = await User.findOne({
      _id: verification.userId,
      email: normalizedEmail,
      emailVerified: true,
      accountStatus: "active"
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Account is unavailable"
      });
    }

    // Short-lived, purpose-specific reset token
    const resetToken = jwt.sign(
      {
        id: user._id,
        purpose: "password-reset"
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password.",
      resetToken
    });

  } catch (error) {
    console.error("Reset OTP error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "OTP verification failed"
    });
  }
};


// ======================================
// 9. RESET PASSWORD
// ======================================

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required"
      });
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters"
      });
    }

    const decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET
    );

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({
        success: false,
        message: "Invalid password reset token"
      });
    }

    const user = await User.findOne({
      _id: decoded.id,
      emailVerified: true,
      accountStatus: "active"
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found or unavailable"
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please log in again."
    });

  } catch (error) {
    console.error("Password reset error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired reset token"
    });
  }
};


// ======================================
// 10. GET USER PROFILE
// ======================================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch profile"
    });
  }
};
