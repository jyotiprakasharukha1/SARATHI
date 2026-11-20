
const express = require("express");
const router = express.Router();

const {
  getNearbyShops,
  getShopDetails,
  getShopProducts
} = require("../controllers/shopController");

// Public shop discovery
router.get("/", getNearbyShops);

// Public individual shop details
router.get("/:merchantId", getShopDetails);

// Public products belonging to one merchant
router.get("/:merchantId/products", getShopProducts);

module.exports = router;

