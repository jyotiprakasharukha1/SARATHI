
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const Order = require("../models/Order");

const createTrackingSocket = (httpServer) => {
  // Latest GPS location for each delivery partner.
  // Stored temporarily in server memory.
  const latestLocations = new Map();

  // Prevent older asynchronous updates from replacing newer ones.
  const latestUpdateTimes = new Map();

  const io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173"
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // ========================================
  // 1. SOCKET.IO AUTHENTICATION
  // ========================================

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const isNormalAccess =
        decoded.purpose === "access" &&
        Boolean(decoded.id);

      const isFleetAccess =
        decoded.purpose === "fleet" &&
        decoded.scope === "fleet:read" &&
        decoded.role === "admin" &&
        Boolean(decoded.id);

      if (!isNormalAccess && !isFleetAccess) {
        return next(new Error("Invalid access token"));
      }

      const user = await User.findById(decoded.id)
        .select("_id name role accountStatus");

      if (!user || user.accountStatus !== "active") {
        return next(new Error("Account is unavailable"));
      }

      if (isFleetAccess && user.role !== "admin") {
        return next(new Error("Admin access required"));
      }

      socket.user = {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        fleetOnly: isFleetAccess
      };

      next();

    } catch (error) {
      console.error("Socket authentication failed:", error.message);
      next(new Error("Invalid or expired authentication token"));
    }
  });

  // ========================================
  // 2. SOCKET CONNECTION
  // ========================================

  io.on("connection", (socket) => {
    console.log(
      `SARATHI tracking connected: ${socket.user.role} (${socket.user.id})`
    );

    // ========================================
    // 3. ADMIN FLEET ACCESS
    // ========================================

    if (socket.user.role === "admin") {
      socket.join("admin:fleet");

      // Send all currently known delivery-partner locations.
      socket.emit(
        "fleet-snapshot",
        Array.from(latestLocations.values())
      );

      console.log(
        `Admin fleet connected: ${socket.user.id}`
      );
    }

    // Restricted fleet tokens are read-only.
    // They must not be able to invoke customer or delivery actions.
    if (socket.user.fleetOnly) {
      socket.on("disconnect", (reason) => {
        console.log(
          `God's Eye fleet viewer disconnected: ${socket.user.id}`,
          reason
        );
      });

      return;
    }

    // ========================================
    // 4. CUSTOMER ORDER TRACKING
    // ========================================

    socket.on("join-order-tracking", async (orderId) => {
      try {
        if (
          socket.user.role !== "customer" ||
          !mongoose.Types.ObjectId.isValid(orderId)
        ) {
          return socket.emit("tracking-error", {
            message: "Invalid tracking request"
          });
        }

        const order = await Order.findOne({
          _id: orderId,
          customer: socket.user.id,
          status: "out_for_delivery"
        }).select("_id assignedDeliveryPartner");

        if (!order) {
          return socket.emit("tracking-error", {
            message: "This order is not available for live tracking"
          });
        }

        const room = `order:${order._id}`;

        socket.join(room);

        // Send the latest location immediately if available.
        if (order.assignedDeliveryPartner) {
          const latest = latestLocations.get(
            order.assignedDeliveryPartner.toString()
          );

          if (latest && latest.orderId === order._id.toString()) {
            socket.emit("order-location-updated", latest);
          }
        }

        socket.emit("tracking-joined", {
          orderId: order._id.toString()
        });

      } catch (error) {
        console.error("Customer tracking error:", error.message);

        socket.emit("tracking-error", {
          message: "Unable to join order tracking"
        });
      }
    });

    // ========================================
    // 5. DELIVERY PARTNER GPS UPDATES
    // ========================================

    socket.on("delivery-location-update", async (data) => {
      try {
        if (socket.user.role !== "delivery") {
          return socket.emit("tracking-error", {
            message: "Only delivery partners can share locations"
          });
        }

        // Limit updates to approximately one per second.
        const now = Date.now();

        if (
          socket.lastLocationUpdate &&
          now - socket.lastLocationUpdate < 1000
        ) {
          return;
        }

        const {
          orderId,
          latitude,
          longitude
        } = data || {};

        if (
          typeof orderId !== "string" ||
          !mongoose.Types.ObjectId.isValid(orderId)
        ) {
          return socket.emit("tracking-error", {
            message: "Invalid order ID"
          });
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          return socket.emit("tracking-error", {
            message: "Invalid GPS coordinates"
          });
        }

        // Verify that the delivery partner is assigned to this order.
        const order = await Order.findOne({
          _id: orderId,
          assignedDeliveryPartner: socket.user.id,
          status: "out_for_delivery"
        }).select("_id orderNumber");

        if (!order) {
          return socket.emit("tracking-error", {
            message: "You are not assigned to this active delivery"
          });
        }

        // Protect against out-of-order asynchronous updates.
        const previousUpdate =
          latestUpdateTimes.get(socket.user.id) || 0;

        if (now <= previousUpdate) {
          return;
        }

        socket.lastLocationUpdate = now;
        latestUpdateTimes.set(socket.user.id, now);

        const location = {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          deliveryPartnerId: socket.user.id,
          deliveryPartnerName: socket.user.name,
          latitude: lat,
          longitude: lng,
          updatedAt: new Date().toISOString()
        };

        // Update the latest known partner location.
        latestLocations.set(socket.user.id, location);

        // Send location to the customer tracking this order.
        io.to(`order:${order._id}`).emit(
          "order-location-updated",
          location
        );

        // Send location to all connected admin fleet viewers.
        io.to("admin:fleet").emit(
          "fleet-location-updated",
          location
        );

        // Confirm successful processing.
        socket.emit("location-update-confirmed", {
          orderId: order._id.toString(),
          updatedAt: location.updatedAt
        });

      } catch (error) {
        console.error(
          "Delivery location error:",
          error.message
        );

        socket.emit("tracking-error", {
          message: "Unable to process location update"
        });
      }
    });

    // ========================================
    // 6. DISCONNECTION
    // ========================================

    socket.on("disconnect", (reason) => {
      console.log(
        `SARATHI tracking disconnected: ${socket.user.id}`,
        reason
      );

      // Keep the last known location for the admin fleet map.
    });
  });

  // ========================================
  // 7. REMOVE COMPLETED OR CANCELLED ORDERS
  // ========================================

  io.removeOrderTracking = (orderId, deliveryPartnerId) => {
    const normalizedOrderId = orderId.toString();

    if (deliveryPartnerId) {
      const partnerId = deliveryPartnerId.toString();
      const latest = latestLocations.get(partnerId);

      if (latest && latest.orderId === normalizedOrderId) {
        latestLocations.delete(partnerId);
        latestUpdateTimes.delete(partnerId);

        // Notify admins that this partner no longer has
        // an active tracked delivery.
        io.to("admin:fleet").emit("fleet-location-removed", {
          orderId: normalizedOrderId,
          deliveryPartnerId: partnerId
        });
      }
    }

    io.to(`order:${normalizedOrderId}`).emit(
      "tracking-stopped",
      {
        orderId: normalizedOrderId,
        message: "Delivery tracking has ended"
      }
    );
  };

  // ========================================
  // 8. FLEET SERVICE UTILITIES
  // ========================================

  // Return a copy of the current fleet snapshot when needed.
  io.getFleetSnapshot = () => {
    return Array.from(latestLocations.values());
  };

  console.log("SARATHI live tracking service initialized");

  return io;
};

module.exports = createTrackingSocket;
