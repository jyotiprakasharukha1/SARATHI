
const express = require("express");
const router = express.Router();

const {
  getProducts,
  createProduct,
  getMyProducts,
  getPendingProducts,
  updateProductStatus
} = require("../controllers/productController");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

// Public marketplace
router.get("/", getProducts);

// Merchant routes
router.get(
  "/mine",
  protect,
  authorize("merchant"),
  getMyProducts
);

router.post(
  "/",
  protect,
  authorize("merchant"),
  createProduct
);

// Admin routes
router.get(
  "/admin/pending",
  protect,
  authorize("admin"),
  getPendingProducts
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateProductStatus
);

module.exports = router;
