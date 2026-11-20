
const express = require("express");
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  assignDeliveryPartner,
  getMyAssignedOrders,
  updateDeliveryOrderStatus,
  getMyMerchantOrders,
  updateMerchantOrderDecision
} = require("../controllers/orderController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// ========================================
// CUSTOMER ROUTES
// ========================================

router.post(
  "/",
  protect,
  authorize("customer"),
  createOrder
);

router.get(
  "/my-orders",
  protect,
  authorize("customer"),
  getMyOrders
);

// ========================================
// MERCHANT ROUTES
// ========================================

router.get(
  "/merchant/my-orders",
  protect,
  authorize("merchant"),
  getMyMerchantOrders
);

router.patch(
  "/merchant/:id/decision",
  protect,
  authorize("merchant"),
  updateMerchantOrderDecision
);

// ========================================
// DELIVERY PARTNER ROUTES
// ========================================

router.get(
  "/delivery/assigned",
  protect,
  authorize("delivery"),
  getMyAssignedOrders
);

router.patch(
  "/delivery/:id/status",
  protect,
  authorize("delivery"),
  updateDeliveryOrderStatus
);

// ========================================
// ADMIN ROUTES
// ========================================

router.get(
  "/",
  protect,
  authorize("admin"),
  getAllOrders
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateOrderStatus
);

router.patch(
  "/:id/assign-delivery",
  protect,
  authorize("admin"),
  assignDeliveryPartner
);

module.exports = router;
