
const mongoose = require("mongoose");

const merchantLocationSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },

    area: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    state: {
      type: String,
      default: "Odisha",
      trim: true,
      maxlength: 100
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{6}$/
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  {
    timestamps: true
  }
);

merchantLocationSchema.index({
  latitude: 1,
  longitude: 1
});

module.exports = mongoose.model(
  "MerchantLocation",
  merchantLocationSchema
);
