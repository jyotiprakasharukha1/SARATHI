
const mongoose = require("mongoose");

// ========================================
// ORDER ITEM SCHEMA
// ========================================

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    productName: {
      type: String,
      required: true,
      trim: true
    },

    shopName: {
      type: String,
      default: ""
    },

    image: {
      type: String,
      default: ""
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number."
      }
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    // Merchant order decision
    merchantStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending"
    },

    merchantRejectionReason: {
      type: String,
      default: ""
    },

    merchantDecisionAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

// ========================================
// DELIVERY ADDRESS SCHEMA
// ========================================

const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    address: {
      type: String,
      required: true,
      trim: true
    },

    area: {
      type: String,
      default: ""
    },

    city: {
      type: String,
      required: true,
      trim: true
    },

    state: {
      type: String,
      default: ""
    },

    pincode: {
      type: String,
      required: true,
      trim: true
    },

    landmark: {
      type: String,
      default: ""
    },

    // Customer delivery GPS coordinates
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: undefined
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: undefined
    }
  },
  {
    _id: false
  }
);

// ========================================
// DELIVERY GPS VALIDATION
// No next() callback required.
// ========================================

deliveryAddressSchema.pre("validate", function () {
  const hasLatitude =
    this.latitude !== undefined &&
    this.latitude !== null;

  const hasLongitude =
    this.longitude !== undefined &&
    this.longitude !== null;

  if (hasLatitude !== hasLongitude) {
    this.invalidate(
      "latitude",
      "Latitude and longitude must both be provided."
    );
  }

  if (
    hasLatitude &&
    (!Number.isFinite(this.latitude) ||
      this.latitude < -90 ||
      this.latitude > 90)
  ) {
    this.invalidate(
      "latitude",
      "Invalid delivery latitude."
    );
  }

  if (
    hasLongitude &&
    (!Number.isFinite(this.longitude) ||
      this.longitude < -180 ||
      this.longitude > 180)
  ) {
    this.invalidate(
      "longitude",
      "Invalid delivery longitude."
    );
  }
});

// ========================================
// MAIN ORDER SCHEMA
// ========================================

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    items: {
      type: [orderItemSchema],
      required: true,

      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0,

        message: "An order must contain at least one item."
      }
    },

    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      default: "cod"
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },

    // Order lifecycle
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "accepted",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ],
      default: "pending"
    },

    assignedDeliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    cancellationReason: {
      type: String,
      default: ""
    },

    deliveredAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ========================================
// DATABASE INDEXES
// ========================================

// Customer order history
orderSchema.index({
  customer: 1,
  createdAt: -1
});

// Admin order filtering
orderSchema.index({
  status: 1,
  createdAt: -1
});

// Delivery partner assigned orders
orderSchema.index({
  assignedDeliveryPartner: 1,
  status: 1
});

// Merchant order history
orderSchema.index({
  "items.merchant": 1,
  createdAt: -1
});

// ========================================
// EXPORT MODEL
// ========================================

module.exports = mongoose.model("Order", orderSchema);
