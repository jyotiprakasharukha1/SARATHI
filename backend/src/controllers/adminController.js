
const User = require("../models/User");

// Get pending delivery partners
const getPendingDeliveryPartners = async (req, res) => {
  try {
    const partners = await User.find({
      role: "delivery",
      accountStatus: "pending"
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: partners.length,
      partners
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to load delivery applications"
    });
  }
};

// Review delivery partner
const reviewDeliveryPartner = async (req, res) => {
  return reviewAccount(req, res, "delivery");
};

// Get pending merchants
const getPendingMerchants = async (req, res) => {
  try {
    const merchants = await User.find({
      role: "merchant",
      accountStatus: "pending"
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: merchants.length,
      merchants
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to load merchant applications"
    });
  }
};

// Review merchant
const reviewMerchant = async (req, res) => {
  return reviewAccount(req, res, "merchant");
};

// Shared approval/rejection logic
const reviewAccount = async (req, res, role) => {
  try {
    const { status, reason = "" } = req.body;
    const { id } = req.params;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected"
      });
    }

    if (status === "rejected" && !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required"
      });
    }

    const account = await User.findOne({
      _id: id,
      role
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `${role} account not found`
      });
    }

    if (account.accountStatus !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This application has already been reviewed"
      });
    }

    account.accountStatus =
      status === "approved" ? "active" : "suspended";

    account.accountReviewReason =
      status === "rejected" ? reason.trim() : "";

    account.accountReviewedAt = new Date();
    account.accountReviewedBy = req.user.id;

    await account.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? `${role} approved successfully`
          : `${role} application rejected`,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        accountStatus: account.accountStatus,
        accountReviewReason: account.accountReviewReason,
        accountReviewedAt: account.accountReviewedAt
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to review account"
    });
  }
};

// Get all customer accounts
const getCustomers = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();

    const filter = {
      role: "customer"
    };

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(safeSearch, "i");

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const customers = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    console.error("Get customers:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load customers"
    });
  }
};

// Suspend or reactivate a customer
const updateCustomerStatus = async (req, res) => {
  try {
    const { status, reason = "" } = req.body;
    const { id } = req.params;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or suspended"
      });
    }

    const customer = await User.findOne({
      _id: id,
      role: "customer"
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (customer.accountStatus === "pending") {
      return res.status(409).json({
        success: false,
        message: "This customer has not completed account verification"
      });
    }

    if (customer.accountStatus === status) {
      return res.status(400).json({
        success: false,
        message: `Customer is already ${status}`
      });
    }

    customer.accountStatus = status;
    customer.accountReviewReason =
      status === "suspended" ? reason.trim() : "";

    customer.accountReviewedAt = new Date();
    customer.accountReviewedBy = req.user.id;

    await customer.save();

    return res.status(200).json({
      success: true,
      message:
        status === "suspended"
          ? "Customer suspended successfully"
          : "Customer reactivated successfully",
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        accountStatus: customer.accountStatus,
        accountReviewReason: customer.accountReviewReason
      }
    });
  } catch (error) {
    console.error("Update customer status:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update customer status"
    });
  }
};
// Get approved and active delivery partners for order assignment
const getApprovedDeliveryPartners = async (req, res) => {
  try {
    const partners = await User.find({
      role: "delivery",
      accountStatus: "active"
    })
      .select("name email phone role accountStatus")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: partners.length,
      partners
    });
  } catch (error) {
    console.error("Get approved delivery partners:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load approved delivery partners"
    });
  }
};

module.exports = {
  getPendingDeliveryPartners,
  getApprovedDeliveryPartners,
  reviewDeliveryPartner,
  getPendingMerchants,
  reviewMerchant,
  getCustomers,
  updateCustomerStatus
};
