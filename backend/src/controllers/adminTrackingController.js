
const Order = require("../models/Order");
const MerchantLocation = require("../models/MerchantLocation");

const validCoordinates = (latitude, longitude) => {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180
  );
};

// GET /api/admin/tracking/live
exports.getLiveTrackingData = async (req, res) => {
  try {
    const orders = await Order.find({
      status: "out_for_delivery",
      assignedDeliveryPartner: { $ne: null }
    })
      .select(
        "orderNumber status customer deliveryAddress assignedDeliveryPartner items createdAt"
      )
      .populate("customer", "name phone")
      .populate("assignedDeliveryPartner", "name phone")
      .lean();

    const merchantIds = [
      ...new Set(
        orders.flatMap((order) =>
          (order.items || []).map((item) =>
            String(item.merchant)
          )
        )
      )
    ];

    const locations = await MerchantLocation.find({
      merchant: { $in: merchantIds }
    })
      .select(
        "merchant shopName address area city state latitude longitude"
      )
      .lean();

    const locationByMerchant = new Map(
      locations.map((location) => [
        String(location.merchant),
        location
      ])
    );

    const routes = [];

    for (const order of orders) {
      const customerAddress = order.deliveryAddress || {};

      const customerHasCoordinates = validCoordinates(
        customerAddress.latitude,
        customerAddress.longitude
      );

      if (!customerHasCoordinates) continue;

      const uniqueMerchantIds = [
        ...new Set(
          (order.items || []).map((item) =>
            String(item.merchant)
          )
        )
      ];

      for (const merchantId of uniqueMerchantIds) {
        const shop = locationByMerchant.get(merchantId);

        if (
          !shop ||
          !validCoordinates(shop.latitude, shop.longitude)
        ) {
          continue;
        }

        const merchantItems = (order.items || []).filter(
          (item) => String(item.merchant) === merchantId
        );

        routes.push({
          id: `${order._id}-${merchantId}`,
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          status: order.status,

          shop: {
            name: shop.shopName || "Registered Shop",
            address: shop.address || "",
            area: shop.area || "",
            city: shop.city || "",
            latitude: Number(shop.latitude),
            longitude: Number(shop.longitude)
          },

          customer: {
            name: order.customer?.name || "Customer",
            address: customerAddress.address || "",
            area: customerAddress.area || "",
            city: customerAddress.city || "",
            latitude: Number(customerAddress.latitude),
            longitude: Number(customerAddress.longitude)
          },

          deliveryPartner: {
            id: order.assignedDeliveryPartner?._id
              ? String(order.assignedDeliveryPartner._id)
              : "",
            name: order.assignedDeliveryPartner?.name || "Delivery Partner"
          },

          products: merchantItems.map((item) => ({
            name: item.productName,
            quantity: item.quantity
          }))
        });
      }
    }

    return res.status(200).json({
      success: true,
      activeDeliveries: orders.length,
      routeCount: routes.length,
      routes
    });
  } catch (error) {
    console.error("Admin live tracking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load live delivery tracking data."
    });
  }
};

