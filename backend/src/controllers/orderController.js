
const mongoose = require("mongoose");
const crypto = require("crypto");

const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUserId = (req) => req.user?._id || req.user?.id;

const generateOrderNumber = () => {
  return `SAR-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};

const validateDeliveryAddress = (address) => {
  if (!address || typeof address !== "object") return false;

  const requiredFields = [
    "fullName",
    "phone",
    "address",
    "city",
    "pincode"
  ];

  return requiredFields.every(
    (field) =>
      typeof address[field] === "string" &&
      address[field].trim().length > 0
  );
};

const isValidCoordinates = (latitude, longitude) => {
  return (
    Number.isFinite(Number(latitude)) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number.isFinite(Number(longitude)) &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180
  );
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Restore stock for every item in an order.
// Call this only when the order is changing to cancelled.
const restoreOrderStock = async (order, session) => {
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: Number(item.quantity) } },
      { session }
    );
  }
};

// --------------------------------------------------
// CUSTOMER: CREATE ORDER
// POST /api/orders
// --------------------------------------------------

exports.createOrder = async (req, res) => {
  let session;

  try {
    const customerId = getUserId(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Please log in again."
      });
    }

    const {
      items,
      deliveryAddress,
      paymentMethod = "cod"
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty."
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Too many different products in one order."
      });
    }

    if (!validateDeliveryAddress(deliveryAddress)) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required delivery address details."
      });
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method."
      });
    }

    // Combine duplicate products and validate quantities.
    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        !Number.isSafeInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity."
        });
      }

      const productId = String(item.productId);
      const quantity = Number(item.quantity);
      const totalQuantity = (quantities.get(productId) || 0) + quantity;

      if (!Number.isSafeInteger(totalQuantity) || totalQuantity > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid total product quantity."
        });
      }

      quantities.set(productId, totalQuantity);
    }

    // Whitelist delivery address fields.
    const safeAddress = {
      fullName: deliveryAddress.fullName.trim(),
      phone: deliveryAddress.phone.trim(),
      address: deliveryAddress.address.trim(),
      area: String(deliveryAddress.area || "").trim(),
      city: deliveryAddress.city.trim(),
      state: String(deliveryAddress.state || "").trim(),
      pincode: deliveryAddress.pincode.trim(),
      landmark: String(deliveryAddress.landmark || "").trim()
    };

    const hasLatitude =
      deliveryAddress.latitude !== undefined &&
      deliveryAddress.latitude !== null &&
      String(deliveryAddress.latitude).trim() !== "";

    const hasLongitude =
      deliveryAddress.longitude !== undefined &&
      deliveryAddress.longitude !== null &&
      String(deliveryAddress.longitude).trim() !== "";

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        success: false,
        message: "Both delivery latitude and longitude must be provided together."
      });
    }

    if (hasLatitude && hasLongitude) {
      if (
        !isValidCoordinates(
          deliveryAddress.latitude,
          deliveryAddress.longitude
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Delivery GPS coordinates are invalid."
        });
      }

      safeAddress.latitude = Number(deliveryAddress.latitude);
      safeAddress.longitude = Number(deliveryAddress.longitude);
    }

    session = await mongoose.startSession();

    let createdOrderId;

    await session.withTransaction(async () => {
      const orderItems = [];
      let subtotal = 0;

      for (const [productId, quantity] of quantities.entries()) {
        // Reserve stock atomically.
        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            status: "approved",
            isAvailable: true,
            stock: { $gte: quantity }
          },
          {
            $inc: { stock: -quantity }
          },
          {
            new: true,
            session
          }
        );

        if (!product) {
          throw new Error(
            `Product ${productId} is unavailable or has insufficient stock.`
          );
        }

        const price = Number(product.price);

        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Invalid product price.");
        }

        const itemSubtotal = price * quantity;

        if (!Number.isFinite(itemSubtotal)) {
          throw new Error("Invalid order amount.");
        }

        subtotal += itemSubtotal;

        if (!Number.isFinite(subtotal)) {
          throw new Error("Invalid order total.");
        }

        orderItems.push({
          product: product._id,
          merchant: product.merchant,
          productName: product.name,
          shopName: product.shopName || "",
          image: Array.isArray(product.images)
            ? product.images[0] || ""
            : "",
          quantity,
          price,
          subtotal: itemSubtotal,

          // These fields must exist in the Order item schema.
          merchantStatus: "pending",
          merchantRejectionReason: "",
          merchantDecisionAt: null
        });
      }

      const deliveryFee = 0;

      const [createdOrder] = await Order.create(
        [
          {
            orderNumber: generateOrderNumber(),
            customer: customerId,
            items: orderItems,
            deliveryAddress: safeAddress,
            subtotal,
            deliveryFee,
            totalAmount: subtotal + deliveryFee,
            paymentMethod,
            paymentStatus: "pending",
            status: "pending"
          }
        ],
        { session }
      );

      createdOrderId = createdOrder._id;
    });

    const order = await Order.findById(createdOrderId)
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .populate("assignedDeliveryPartner", "name phone");

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to place your order. Please try again."
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// --------------------------------------------------
// CUSTOMER: GET MY ORDERS
// GET /api/orders/my-orders
// --------------------------------------------------

exports.getMyOrders = async (req, res) => {
  try {
    const customerId = getUserId(req);

    const orders = await Order.find({ customer: customerId })
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .populate("assignedDeliveryPartner", "name phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch your orders."
    });
  }
};

// --------------------------------------------------
// MERCHANT: GET MY ORDERS
// GET /api/orders/merchant/my-orders
// --------------------------------------------------

exports.getMyMerchantOrders = async (req, res) => {
  try {
    const merchantId = getUserId(req);

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Please log in again."
      });
    }

    const orders = await Order.find({
      "items.merchant": merchantId
    })
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("assignedDeliveryPartner", "name phone")
      .sort({ createdAt: -1 });

    // Return only the products belonging to this merchant.
    const merchantOrders = orders.map((order) => {
      const orderObject = order.toObject();

      orderObject.items = orderObject.items.filter(
        (item) =>
          item.merchant &&
          String(item.merchant._id || item.merchant) === String(merchantId)
      );

      return orderObject;
    });

    return res.status(200).json({
      success: true,
      count: merchantOrders.length,
      orders: merchantOrders
    });
  } catch (error) {
    console.error("Get merchant orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch merchant orders."
    });
  }
};

// --------------------------------------------------
// MERCHANT: ACCEPT OR REJECT ORDER ITEMS
// PATCH /api/orders/merchant/:id/decision
// --------------------------------------------------

exports.updateMerchantOrderDecision = async (req, res) => {
  let session;

  try {
    const merchantId = getUserId(req);
    const { decision, reason = "" } = req.body;
    const orderId = req.params.id;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: "Please log in again."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    if (!["accepted", "rejected"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be accepted or rejected."
      });
    }

    if (
      decision === "rejected" &&
      typeof reason !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid rejection reason."
      });
    }

    session = await mongoose.startSession();

    let updatedOrderId;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw new Error("Order not found.");
      }

      if (order.status === "cancelled") {
        throw new Error("This order has already been cancelled.");
      }

      if (order.status !== "pending") {
        throw new Error("This order can no longer be changed by the merchant.");
      }

      const merchantItems = order.items.filter(
        (item) =>
          String(item.merchant) === String(merchantId)
      );

      if (merchantItems.length === 0) {
        throw new Error("You do not have items in this order.");
      }

      if (
        merchantItems.some(
          (item) => item.merchantStatus !== "pending"
        )
      ) {
        throw new Error("You have already made a decision for this order.");
      }

      for (const item of merchantItems) {
        item.merchantStatus = decision;
        item.merchantRejectionReason =
          decision === "rejected" ? reason.trim() : "";
        item.merchantDecisionAt = new Date();
      }

      if (decision === "rejected") {
        // One merchant rejection cancels the complete order.
        // Restore stock for every item because the whole order is cancelled.
        await restoreOrderStock(order, session);

        order.status = "cancelled";
        order.cancellationReason =
          reason.trim() || "A merchant rejected an item in this order.";
      } else {
        const allAccepted = order.items.every(
          (item) => item.merchantStatus === "accepted"
        );

        if (allAccepted) {
          order.status = "confirmed";
        }
      }

      await order.save({ session });
      updatedOrderId = order._id;
    });

    const updatedOrder = await Order.findById(updatedOrderId)
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .populate("assignedDeliveryPartner", "name phone");

    return res.status(200).json({
      success: true,
      message:
        decision === "accepted"
          ? "Your order items have been accepted."
          : "Your order has been rejected and cancelled.",
      order: updatedOrder
    });
  } catch (error) {
    console.error("Merchant decision error:", error);

    const clientErrorMessages = [
      "Order not found.",
      "This order has already been cancelled.",
      "This order can no longer be changed by the merchant.",
      "You do not have items in this order.",
      "You have already made a decision for this order."
    ];

    const isClientError =
      clientErrorMessages.includes(error.message);

    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: error.message || "Unable to update order decision."
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// --------------------------------------------------
// ADMIN: GET ALL ORDERS
// GET /api/orders
// --------------------------------------------------

exports.getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "accepted",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled"
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status."
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);

      filter.orderNumber = {
        $regex: escapeRegex(search),
        $options: "i"
      };
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("customer", "name email phone")
        .populate("items.product", "name images")
        .populate("items.merchant", "name phone")
        .populate("assignedDeliveryPartner", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page,
      orders
    });
  } catch (error) {
    console.error("Get all orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders."
    });
  }
};

// --------------------------------------------------
// ADMIN: UPDATE ORDER STATUS
// PATCH /api/orders/:id/status
// --------------------------------------------------

exports.updateOrderStatus = async (req, res) => {
  let session;

  try {
    const { status, cancellationReason } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    const transitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready_for_pickup", "cancelled"],
      ready_for_pickup: ["cancelled"],
      accepted: [],
      picked_up: [],
      out_for_delivery: [],
      delivered: [],
      cancelled: []
    };

    if (!Object.prototype.hasOwnProperty.call(transitions, status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status."
      });
    }

    if (
      status === "cancelled" &&
      (
        typeof cancellationReason !== "string" ||
        !cancellationReason.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a cancellation reason."
      });
    }

    session = await mongoose.startSession();

    let updatedOrderId;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);

      if (!order) {
        throw new Error("Order not found.");
      }

      const allowedNextStatuses = transitions[order.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        throw new Error(
          `Cannot change order from ${order.status} to ${status}.`
        );
      }

      if (status === "cancelled") {
        await restoreOrderStock(order, session);
        order.cancellationReason = cancellationReason.trim();
      }

      order.status = status;

      if (status === "delivered") {
        order.deliveredAt = new Date();
      }

      await order.save({ session });
      updatedOrderId = order._id;
    });

    const updatedOrder = await Order.findById(updatedOrderId)
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .populate("assignedDeliveryPartner", "name email phone");

    return res.status(200).json({
      success: true,
      message: `Order ${status.replace(/_/g, " ")} successfully.`,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Update order status error:", error);

    const isNotFound = error.message === "Order not found.";

    return res.status(isNotFound ? 404 : 400).json({
      success: false,
      message: error.message || "Unable to update order status."
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// --------------------------------------------------
// ADMIN: ASSIGN DELIVERY PARTNER
// PATCH /api/orders/:id/assign-delivery
// --------------------------------------------------

exports.assignDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPartnerId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(deliveryPartnerId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order or delivery partner ID."
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    if (
      !["confirmed", "preparing", "ready_for_pickup"].includes(order.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "A delivery partner can only be assigned to a confirmed order that is not yet out for delivery."
      });
    }

    const deliveryPartner = await User.findOne({
      _id: deliveryPartnerId,
      role: "delivery",
      accountStatus: "active"
    }).select("name email phone role accountStatus");

    if (!deliveryPartner) {
      return res.status(404).json({
        success: false,
        message: "Active delivery partner not found."
      });
    }

    order.assignedDeliveryPartner = deliveryPartner._id;
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name email phone")
      .populate("assignedDeliveryPartner", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone");

    return res.status(200).json({
      success: true,
      message: "Delivery partner assigned successfully.",
      order: updatedOrder
    });
  } catch (error) {
    console.error("Assign delivery partner error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign delivery partner."
    });
  }
};

// --------------------------------------------------
// DELIVERY: GET ASSIGNED ORDERS
// GET /api/orders/delivery/assigned
// --------------------------------------------------

exports.getMyAssignedOrders = async (req, res) => {
  try {
    const partnerId = getUserId(req);

    if (!partnerId) {
      return res.status(401).json({
        success: false,
        message: "Please log in again."
      });
    }

    const orders = await Order.find({
      assignedDeliveryPartner: partnerId,
      status: { $nin: ["delivered", "cancelled"] }
    })
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .sort({ createdAt: -1 });

    const merchantIds = [
      ...new Set(
        orders.flatMap((order) =>
          order.items
            .map((item) =>
              String(item.merchant?._id || item.merchant || "")
            )
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
      )
    ];

    const merchants = merchantIds.length
      ? await User.find({
          _id: { $in: merchantIds }
        }).select("name shopLocation location")
      : [];

    const merchantMap = new Map(
      merchants.map((merchant) => [
        String(merchant._id),
        merchant
      ])
    );

    const enrichedOrders = orders.map((order) => {
      const pickupMap = new Map();

      for (const item of order.items) {
        const merchantId = String(
          item.merchant?._id || item.merchant || ""
        );

        if (!merchantId) continue;

        const merchant = merchantMap.get(merchantId);
        const saved =
          merchant?.shopLocation ||
          merchant?.location ||
          {};

        const latitude = saved.latitude ?? saved.lat ?? null;
        const longitude = saved.longitude ?? saved.lng ?? null;

        if (!pickupMap.has(merchantId)) {
          pickupMap.set(merchantId, {
            merchantId,
            shopName:
              saved.shopName ||
              item.shopName ||
              merchant?.name ||
              "Merchant pickup",
            address: saved.address || "",
            area: saved.area || "",
            city: saved.city || "",
            latitude,
            longitude
          });
        }
      }

      const plainOrder = order.toObject();

      plainOrder.pickupLocations = [...pickupMap.values()];

      return plainOrder;
    });

    return res.status(200).json({
      success: true,
      count: enrichedOrders.length,
      orders: enrichedOrders
    });
  } catch (error) {
    console.error("Get assigned delivery orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch assigned delivery orders."
    });
  }
};

// --------------------------------------------------
// DELIVERY: UPDATE ASSIGNED ORDER STATUS
// PATCH /api/orders/delivery/:id/status
// --------------------------------------------------

exports.updateDeliveryOrderStatus = async (req, res) => {
  try {
    const partnerId = getUserId(req);
    const { status: requestedStatus } = req.body;

    if (!partnerId) {
      return res.status(401).json({
        success: false,
        message: "Please log in again."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID."
      });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      assignedDeliveryPartner: partnerId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found."
      });
    }

    const transitions = {
      confirmed: "accepted",
      preparing: "accepted",
      ready_for_pickup: "accepted",
      accepted: "picked_up",
      picked_up: "out_for_delivery",
      out_for_delivery: "delivered"
    };

    const nextStatus = transitions[order.status];

    if (!nextStatus || requestedStatus !== nextStatus) {
      return res.status(400).json({
        success: false,
        message: nextStatus
          ? `The next valid status is ${nextStatus.replace(/_/g, " ")}.`
          : "This order cannot be updated by the delivery partner."
      });
    }

    order.status = nextStatus;

    if (nextStatus === "delivered") {
      order.deliveredAt = new Date();
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name email phone")
      .populate("items.product", "name images")
      .populate("items.merchant", "name phone")
      .populate("assignedDeliveryPartner", "name phone");

    return res.status(200).json({
      success: true,
      message: `Order marked as ${nextStatus.replace(/_/g, " ")}.`,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Delivery status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update delivery status."
    });
  }
};
