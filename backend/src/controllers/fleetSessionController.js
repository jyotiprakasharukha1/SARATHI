
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const {
  createFleetTicket,
  consumeFleetTicket
} = require("../services/fleetTicketStore");

// Issue a one-time ticket to an authenticated admin.
const issueFleetTicket = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    const ticket = createFleetTicket(req.user.id);

    return res.status(200).json({
      success: true,
      ticket,
      expiresIn: 60
    });

  } catch (error) {
    console.error("Fleet ticket error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create fleet session"
    });
  }
};

// Exchange the one-time ticket for a restricted socket token.
const exchangeFleetTicket = async (req, res) => {
  try {
    const { ticket } = req.body || {};

    if (
      typeof ticket !== "string" ||
      !/^[a-f0-9]{64}$/i.test(ticket)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid fleet ticket"
      });
    }

    const ticketData = consumeFleetTicket(ticket);

    if (!ticketData) {
      return res.status(401).json({
        success: false,
        message: "Fleet ticket is invalid, expired, or already used"
      });
    }

    const user = await User.findById(ticketData.adminId)
      .select("_id role accountStatus");

    if (
      !user ||
      user.role !== "admin" ||
      user.accountStatus !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin account is unavailable"
      });
    }

    const fleetToken = jwt.sign(
      {
        id: user._id.toString(),
        role: "admin",
        purpose: "fleet",
        scope: "fleet:read"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "5m"
      }
    );

    return res.status(200).json({
      success: true,
      token: fleetToken,
      expiresIn: 300
    });

  } catch (error) {
    console.error("Fleet exchange error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to establish fleet session"
    });
  }
};

module.exports = {
  issueFleetTicket,
  exchangeFleetTicket
};
