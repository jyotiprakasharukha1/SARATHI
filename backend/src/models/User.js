
const mongoose = require("mongoose");

const shopLocationSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ""
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    },
    area: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ""
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    state: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },
    pincode: {
      type: String,
      trim: true,
      maxlength: 10,
      default: ""
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null
    },
    isSet: {
      type: Boolean,
      default: false
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{10}$/
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    role: {
      type: String,
      enum: ["customer", "merchant", "delivery", "admin"],
      default: "customer",
      required: true
    },

    // Merchant shop details and fixed map location
    shopLocation: {
      type: shopLocationSchema,
      default: () => ({})
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerifiedAt: {
      type: Date,
      default: null
    },

    accountStatus: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending"
    },

    accountReviewReason: {
      type: String,
      default: ""
    },

    accountReviewedAt: {
      type: Date,
      default: null
    },

    accountReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ role: 1, accountStatus: 1 });
userSchema.index({
  "shopLocation.latitude": 1,
  "shopLocation.longitude": 1
});

const User = mongoose.model("User", userSchema);

module.exports = User;
