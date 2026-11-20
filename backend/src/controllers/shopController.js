
const mongoose = require("mongoose");

const MerchantLocation = require("../models/MerchantLocation");
const User = require("../models/User");
const Product = require("../models/Product");

const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 50;

const isValidCoordinate = (value, min, max) =>
  Number.isFinite(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRadians = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
};

const getShopProductSummary = async merchantId => {
  const [productCount, categories] = await Promise.all([
    Product.countDocuments({
      merchant: merchantId,
      status: "approved",
      isAvailable: true,
      stock: { $gt: 0 }
    }),
    Product.distinct("category", {
      merchant: merchantId,
      status: "approved",
      isAvailable: true,
      stock: { $gt: 0 }
    })
  ]);

  return { productCount, categories };
};

// ========================================
// PUBLIC: GET NEARBY SHOPS
// GET /api/shops
// ========================================

exports.getNearbyShops = async (req, res) => {
  try {
    const hasLatitude = req.query.latitude !== undefined;
    const hasLongitude = req.query.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        success: false,
        message: "Both latitude and longitude are required together."
      });
    }

    if (
      hasLatitude &&
      (!isValidCoordinate(req.query.latitude, -90, 90) ||
        !isValidCoordinate(req.query.longitude, -180, 180))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer coordinates."
      });
    }

    const radiusKm = Math.min(
      MAX_RADIUS_KM,
      Math.max(
        1,
        Number(req.query.radiusKm) || DEFAULT_RADIUS_KM
      )
    );

    const hasCustomerLocation = hasLatitude && hasLongitude;
    const customerLat = hasCustomerLocation
      ? Number(req.query.latitude)
      : null;
    const customerLon = hasCustomerLocation
      ? Number(req.query.longitude)
      : null;

    const activeMerchants = await User.find({
      role: "merchant",
      accountStatus: "active"
    })
      .select("_id name")
      .lean();

    if (!activeMerchants.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        radiusKm,
        shops: []
      });
    }

    const merchantMap = new Map(
      activeMerchants.map(merchant => [
        String(merchant._id),
        merchant
      ])
    );

    const locations = await MerchantLocation.find({
      merchant: {
        $in: activeMerchants.map(merchant => merchant._id)
      }
    })
      .select(
        "_id merchant shopName address area city state pincode latitude longitude"
      )
      .lean();

    const eligibleShops = [];

    for (const location of locations) {
      const merchantId = String(location.merchant);
      const merchant = merchantMap.get(merchantId);

      if (!merchant) continue;

      if (
        !isValidCoordinate(location.latitude, -90, 90) ||
        !isValidCoordinate(location.longitude, -180, 180)
      ) {
        continue;
      }

      const distanceKm = hasCustomerLocation
        ? calculateDistanceKm(
            customerLat,
            customerLon,
            Number(location.latitude),
            Number(location.longitude)
          )
        : null;

      if (
        hasCustomerLocation &&
        distanceKm > radiusKm
      ) {
        continue;
      }

      eligibleShops.push({
        ...location,
        _id: String(location._id),
        merchantId,
        merchantName: merchant.name,
        distanceKm:
          distanceKm === null
            ? null
            : Number(distanceKm.toFixed(2))
      });
    }

    const shopsWithProducts = await Promise.all(
      eligibleShops.map(async shop => {
        const summary = await getShopProductSummary(
          shop.merchantId
        );

        return {
          ...shop,
          productCount: summary.productCount,
          categories: summary.categories,
          isAvailable: summary.productCount > 0
        };
      })
    );

    const shops = shopsWithProducts
      .filter(shop => shop.productCount > 0)
      .sort((a, b) => {
        if (a.distanceKm === null) {
          return a.shopName.localeCompare(b.shopName);
        }

        return a.distanceKm - b.distanceKm;
      });

    return res.status(200).json({
      success: true,
      count: shops.length,
      radiusKm,
      shops
    });
  } catch (error) {
    console.error("Nearby shops error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load nearby shops."
    });
  }
};

// ========================================
// PUBLIC: GET ONE SHOP
// GET /api/shops/:merchantId
// ========================================

exports.getShopDetails = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.isValidObjectId(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID."
      });
    }

    const merchant = await User.findOne({
      _id: merchantId,
      role: "merchant",
      accountStatus: "active"
    })
      .select("_id name")
      .lean();

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or currently unavailable."
      });
    }

    const location = await MerchantLocation.findOne({
      merchant: merchant._id
    })
      .select(
        "_id merchant shopName address area city state pincode latitude longitude"
      )
      .lean();

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "This merchant has not configured a shop location."
      });
    }

    const summary = await getShopProductSummary(merchant._id);

    return res.status(200).json({
      success: true,
      shop: {
        ...location,
        _id: String(location._id),
        merchantId: String(merchant._id),
        merchantName: merchant.name,
        productCount: summary.productCount,
        categories: summary.categories,
        isAvailable: summary.productCount > 0
      }
    });
  } catch (error) {
    console.error("Shop details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load shop details."
    });
  }
};

// ========================================
// PUBLIC: GET PRODUCTS FROM ONE SHOP
// GET /api/shops/:merchantId/products
// ========================================

exports.getShopProducts = async (req, res) => {
  try {
    const { merchantId } = req.params;

    if (!mongoose.isValidObjectId(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID."
      });
    }

    const merchant = await User.findOne({
      _id: merchantId,
      role: "merchant",
      accountStatus: "active"
    }).select("_id");

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or currently unavailable."
      });
    }

    const shopLocation = await MerchantLocation.findOne({
      merchant: merchant._id
    }).lean();

    if (!shopLocation) {
      return res.status(404).json({
        success: false,
        message: "Shop location is not configured."
      });
    }

    const filter = {
      merchant: merchant._id,
      status: "approved",
      isAvailable: true,
      stock: { $gt: 0 }
    };

    if (req.query.category) {
      filter.category = String(req.query.category).trim();
    }

    if (req.query.search) {
      const search = String(req.query.search)
        .trim()
        .slice(0, 80);

      if (search) {
        const escaped = search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        filter.$or = [
          { name: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } }
        ];
      }
    }

    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit, 10) || 30)
    );

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(
          "_id merchant shopName name description category price oldPrice images stock location status isAvailable createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      shop: {
        merchantId: String(merchant._id),
        shopName: shopLocation.shopName
      },
      count: products.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      products
    });
  } catch (error) {
    console.error("Shop products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load products for this shop."
    });
  }
};
