
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OTP = require("../models/OTP");
const { sendOTPEmail } = require("../config/mailer");

// OTP configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// Generate a cryptographically secure six-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Generate, hash, store and email OTP
const sendOTP = async (email, purpose, userId = null) => {
  try {
    email = email.trim().toLowerCase();

    const allowedPurposes = [
      "registration",
      "login",
      "password-reset"
    ];

    if (!allowedPurposes.includes(purpose)) {
      throw new Error("Invalid OTP purpose");
    }

    // Check resend cooldown
    const recentOTP = await OTP.findOne({
      email,
      purpose,
      createdAt: {
        $gte: new Date(
          Date.now() - RESEND_COOLDOWN_SECONDS * 1000
        )
      }
    }).sort({ createdAt: -1 });

    if (recentOTP) {
      const remainingTime = Math.ceil(
        RESEND_COOLDOWN_SECONDS -
        (Date.now() - recentOTP.createdAt.getTime()) / 1000
      );

      throw new Error(
        `Please wait ${remainingTime} seconds before requesting another OTP`
      );
    }

    // Invalidate previous OTPs for this purpose
    await OTP.deleteMany({
      email,
      purpose
    });

    // Generate and hash OTP
    const otp = generateOTP();

    const otpHash = await bcrypt.hash(otp, 10);

    // Save OTP in MongoDB
    const otpRecord = await OTP.create({
      email,
      userId,
      otpHash,
      purpose,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
      )
    });

    try {
      // Send OTP to Gmail
      await sendOTPEmail(email, otp, purpose);

    } catch (emailError) {
      // Remove OTP if email delivery fails
      await OTP.deleteOne({ _id: otpRecord._id });

      throw new Error("Unable to send OTP email. Please try again.");
    }

    return {
      success: true,
      message: "OTP sent successfully",
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      resendAfter: RESEND_COOLDOWN_SECONDS
    };

  } catch (error) {
    throw error;
  }
};

// Verify OTP
const verifyOTP = async (email, otp, purpose) => {
  try {
    email = email.trim().toLowerCase();

    const otpRecord = await OTP.findOne({
      email,
      purpose,
      consumedAt: null
    })
      .select("+otpHash")
      .sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new Error("OTP not found or already used");
    }

    // Check expiry
    if (otpRecord.expiresAt.getTime() <= Date.now()) {
      await OTP.deleteOne({ _id: otpRecord._id });

      throw new Error("OTP has expired. Request a new OTP.");
    }

    // Check attempt limit
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await OTP.deleteOne({ _id: otpRecord._id });

      throw new Error("Maximum OTP attempts exceeded. Request a new OTP.");
    }

    // Compare entered OTP with stored hash
    const isValid = await bcrypt.compare(
      String(otp),
      otpRecord.otpHash
    );

    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      const remainingAttempts =
        otpRecord.maxAttempts - otpRecord.attempts;

      throw new Error(
        `Incorrect OTP. ${remainingAttempts} attempts remaining.`
      );
    }

    // Mark OTP as consumed
    otpRecord.consumedAt = new Date();
    await otpRecord.save();

    return {
      success: true,
      message: "OTP verified successfully",
      userId: otpRecord.userId
    };

  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOTP
};
