
const express = require("express");
const router = express.Router();

const {
  getMyShopLocation,
  saveMyShopLocation,
  getApprovedShopLocations
} = require("../controllers/merchantLocationController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// Merchant endpoints
router.get(
  "/mine",
  protect,
  authorize("merchant"),
  getMyShopLocation
);

router.put(
  "/mine",
  protect,
  authorize("merchant"),
  saveMyShopLocation
);

// Admin endpoint
router.get(
  "/admin/shops",
  protect,
  authorize("admin"),
  getApprovedShopLocations
);

module.exports = router;
