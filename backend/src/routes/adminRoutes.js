
const express = require("express");
const router = express.Router();

const {
  // Delivery partner management
  getPendingDeliveryPartners,
  getApprovedDeliveryPartners,
  reviewDeliveryPartner,

  // Merchant management
  getPendingMerchants,
  reviewMerchant,

  // Customer management
  getCustomers,
  updateCustomerStatus
} = require("../controllers/adminController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// ======================================
// SECURE ALL ADMIN ROUTES
// ======================================
router.use(protect, authorize("admin"));

// ======================================
// DELIVERY PARTNER MANAGEMENT
// ======================================

// Get pending delivery partners
router.get(
  "/delivery-partners/pending",
  getPendingDeliveryPartners
);

// Get approved delivery partners for order assignment
router.get(
  "/delivery-partners/approved",
  getApprovedDeliveryPartners
);

// Approve or reject delivery partner
router.patch(
  "/delivery-partners/:id/review",
  reviewDeliveryPartner
);

// ======================================
// MERCHANT MANAGEMENT
// ======================================

// Get pending merchants
router.get(
  "/merchants/pending",
  getPendingMerchants
);

// Approve or reject merchant
router.patch(
  "/merchants/:id/review",
  reviewMerchant
);

// ======================================
// CUSTOMER MANAGEMENT
// ======================================

// Get all customers and search customers
router.get(
  "/customers",
  getCustomers
);

// Suspend or reactivate customer
router.patch(
  "/customers/:id/status",
  updateCustomerStatus
);

module.exports = router;
