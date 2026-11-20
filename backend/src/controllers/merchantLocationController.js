
const MerchantLocation = require("../models/MerchantLocation");
const User = require("../models/User");

const validCoordinate = (value, min, max) =>
  Number.isFinite(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;

// ========================================
// MERCHANT: GET OWN SHOP LOCATION
// ========================================

exports.getMyShopLocation = async (req, res) => {
  try {
    const location = await MerchantLocation.findOne({
      merchant: req.user.id
    }).lean();

    return res.status(200).json({
      success: true,
      shopLocation: location || null
    });
  } catch (error) {
    console.error("Get merchant shop location:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load shop location."
    });
  }
};

// ========================================
// MERCHANT: SAVE OR UPDATE SHOP LOCATION
// ========================================

exports.saveMyShopLocation = async (req, res) => {
  try {
    const {
      shopName,
      address,
      area = "",
      city,
      state = "Odisha",
      pincode,
      latitude,
      longitude
    } = req.body || {};

    if (
      !String(shopName || "").trim() ||
      !String(address || "").trim() ||
      !String(city || "").trim() ||
      !/^\d{6}$/.test(String(pincode || "").trim())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Shop name, full address, city and valid 6-digit pincode are required."
      });
    }

    if (
      !validCoordinate(latitude, -90, 90) ||
      !validCoordinate(longitude, -180, 180)
    ) {
      return res.status(400).json({
        success: false,
        message: "Select a valid shop location on the map."
      });
    }

    const merchant = await User.findOne({
      _id: req.user.id,
      role: "merchant",
      accountStatus: "active"
    }).select("_id");

    if (!merchant) {
      return res.status(403).json({
        success: false,
        message:
          "Only approved merchant accounts can save shop locations."
      });
    }

    const location = await MerchantLocation.findOneAndUpdate(
      { merchant: merchant._id },
      {
        $set: {
          shopName: String(shopName).trim(),
          address: String(address).trim(),
          area: String(area).trim(),
          city: String(city).trim(),
          state: String(state).trim(),
          pincode: String(pincode).trim(),
          latitude: Number(latitude),
          longitude: Number(longitude)
        },
        $setOnInsert: {
          merchant: merchant._id
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: "Shop location saved successfully.",
      shopLocation: location
    });
  } catch (error) {
    console.error("Save merchant shop location:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save shop location."
    });
  }
};

// ========================================
// ADMIN: GET APPROVED MERCHANT SHOP LOCATIONS
// ========================================

exports.getApprovedShopLocations = async (req, res) => {
  try {
    const activeMerchants = await User.find({
      role: "merchant",
      accountStatus: "active"
    }).select("_id");

    const activeIds = activeMerchants.map(
      (merchant) => merchant._id
    );

    const shops = await MerchantLocation.find({
      merchant: { $in: activeIds }
    })
      .select(
        "_id merchant shopName address area city state pincode latitude longitude updatedAt"
      )
      .sort({ shopName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: shops.length,
      shops: shops.map((shop) => ({
        ...shop,
        merchantId: String(shop.merchant),
        _id: String(shop._id)
      }))
    });
  } catch (error) {
    console.error("Get approved merchant locations:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load approved shop locations."
    });
  }
};
