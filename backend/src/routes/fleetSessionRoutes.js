
const express = require("express");

const {
  protect,
  authorize
} = require("../middleware/authMiddleware");

const {
  issueFleetTicket,
  exchangeFleetTicket
} = require("../controllers/fleetSessionController");

const router = express.Router();

// Only authenticated admins can issue tickets.
router.post(
  "/issue",
  protect,
  authorize("admin"),
  issueFleetTicket
);

// God's Eye exchanges its one-time ticket here.
router.post(
  "/exchange",
  exchangeFleetTicket
);

module.exports = router;
