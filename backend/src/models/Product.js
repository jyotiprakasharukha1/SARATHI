
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    shopName: {
      type: String,
      required: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Food",
        "Grocery",
        "Local Shops",
        "Parcel",
        "Documents",
        "Gifts",
        "Electronics",
        "Fashion"
      ]
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    oldPrice: {
      type: Number,
      default: null,
      min: 0
    },

    images: {
      type: [String],
      default: []
    },

    stock: {
      type: Number,
      default: 0,
      min: 0
    },

    location: {
      address: { type: String, trim: true },
      area: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },

    rejectionReason: {
      type: String,
      default: ""
    },

    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Useful for public marketplace searches
productSchema.index({
  status: 1,
  category: 1,
  "location.city": 1
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
