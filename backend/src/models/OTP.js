
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    otpHash: {
      type: String,
      required: true,
      select: false
    },

    purpose: {
      type: String,
      enum: [
        "registration",
        "login",
        "password-reset"
      ],
      required: true
    },

    attempts: {
      type: Number,
      default: 0
    },

    maxAttempts: {
      type: Number,
      default: 5
    },

    expiresAt: {
      type: Date,
      required: true
    },

    consumedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Automatically delete expired OTP records
otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Efficiently find OTPs by email and purpose
otpSchema.index({
  email: 1,
  purpose: 1,
  createdAt: -1
});

const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
