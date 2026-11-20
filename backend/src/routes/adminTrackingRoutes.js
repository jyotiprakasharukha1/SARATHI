
const express = require("express");
const router = express.Router();

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const {
  getLiveTrackingData
} = require("../controllers/adminTrackingController");

router.get(
  "/live",
  protect,
  authorize("admin"),
  getLiveTrackingData
);

module.exports = router;
