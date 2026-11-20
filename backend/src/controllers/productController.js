const mongoose = require("mongoose");
const Product = require("../models/Product");

// Escape special characters in search terms.
const escapeRegex = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Distance between two GPS points in kilometres.
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRadians = degrees => (degrees * Math.PI) / 180;
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

// 1. Public marketplace: approved products and optional radius filtering.
const getProducts = async (req, res) => {
  try {
    const {
      category,
      city,
      search,
      page = 1,
      limit = 12,
      latitude,
      longitude,
      radiusKm = 10
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 12));

    const hasLatitude = latitude !== undefined && latitude !== "";
    const hasLongitude = longitude !== undefined && longitude !== "";

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be provided together."
      });
    }

    let customerLatitude = null;
    let customerLongitude = null;
    let selectedRadius = 10;

    if (hasLatitude && hasLongitude) {
      customerLatitude = Number(latitude);
      customerLongitude = Number(longitude);
      selectedRadius = Number(radiusKm);

      if (
        !Number.isFinite(customerLatitude) ||
        customerLatitude < -90 ||
        customerLatitude > 90 ||
        !Number.isFinite(customerLongitude) ||
        customerLongitude < -180 ||
        customerLongitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer coordinates."
        });
      }

      if (
        !Number.isFinite(selectedRadius) ||
        selectedRadius <= 0 ||
        selectedRadius > 20
      ) {
        return res.status(400).json({
          success: false,
          message: "Search radius must be between 1 and 20 km."
        });
      }
    }

    const filter = {
      status: "approved",
      isAvailable: true,
      stock: { $gt: 0 }
    };

    if (category && category !== "All") {
      filter.category = category;
    }

    if (city) {
      filter["location.city"] = {
        $regex: escapeRegex(String(city).trim()),
        $options: "i"
      };
    }

    if (search && String(search).trim()) {
      const searchRegex = {
        $regex: escapeRegex(String(search).trim()),
        $options: "i"
      };

      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { shopName: searchRegex }
      ];
    }

    let products = await Product.find(filter)
      .populate("merchant", "name role accountStatus shopLocation")
      .sort({ createdAt: -1 })
      .lean();

    // Only apply distance filtering when the customer has selected a location.
    if (hasLatitude && hasLongitude) {
      products = products
        .filter(product => {
          const merchant = product.merchant;
          const shopLocation = merchant?.shopLocation;

          if (
            merchant?.role !== "merchant" ||
            merchant?.accountStatus !== "active" ||
            !shopLocation?.isSet ||
            !Number.isFinite(shopLocation.latitude) ||
            !Number.isFinite(shopLocation.longitude)
          ) {
            return false;
          }

          const distance = calculateDistanceKm(
            customerLatitude,
            customerLongitude,
            shopLocation.latitude,
            shopLocation.longitude
          );

          product.distanceKm = Number(distance.toFixed(2));

          return distance <= selectedRadius;
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    const total = products.length;
    const startIndex = (currentPage - 1) * pageSize;

    products = products.slice(startIndex, startIndex + pageSize);

    return res.status(200).json({
      success: true,
      products,
      searchLocation: hasLatitude
        ? {
            latitude: customerLatitude,
            longitude: customerLongitude,
            radiusKm: selectedRadius
          }
        : null,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch marketplace products."
    });
  }
};

// 2. Merchant creates a product.
const createProduct = async (req, res) => {
  try {
    const {
      shopName,
      name,
      description,
      category,
      price,
      oldPrice,
      images,
      stock,
      location
    } = req.body;

    if (
      !shopName?.trim() ||
      !name?.trim() ||
      !description?.trim() ||
      !category ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required product details."
      });
    }

    const validCategories = [
      "Food",
      "Grocery",
      "Local Shops",
      "Parcel",
      "Documents",
      "Gifts",
      "Electronics",
      "Fashion"
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product category."
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock ?? 0);
    const previousPrice =
      oldPrice === "" || oldPrice == null ? null : Number(oldPrice);

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0 ||
      !Number.isInteger(productStock) ||
      productStock < 0 ||
      (previousPrice !== null &&
        (!Number.isFinite(previousPrice) || previousPrice < 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price or stock value."
      });
    }

    if (
      images !== undefined &&
      (!Array.isArray(images) ||
        images.length > 8 ||
        !images.every(image => typeof image === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of up to 8 image URLs."
      });
    }

    const product = await Product.create({
      merchant: req.user.id,
      shopName: shopName.trim(),
      name: name.trim(),
      description: description.trim(),
      category,
      price: productPrice,
      oldPrice: previousPrice,
      images: images || [],
      stock: productStock,
      location: location || {},
      status: "pending"
    });

    return res.status(201).json({
      success: true,
      message: "Product submitted for admin approval.",
      product
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create product."
    });
  }
};

// 3. Merchant views their own listings.
const getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({
      merchant: req.user.id
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error("My products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch your products."
    });
  }
};

// 4. Admin views pending products.
const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({
      status: "pending"
    })
      .populate("merchant", "name email")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error("Pending products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending products."
    });
  }
};

// 5. Admin approves or rejects a product.
const updateProductStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected."
      });
    }

    if (
      status === "rejected" &&
      !String(rejectionReason || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a rejection reason."
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        status,
        rejectionReason:
          status === "rejected"
            ? String(rejectionReason).trim()
            : ""
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${status} successfully.`,
      product
    });
  } catch (error) {
    console.error("Update product status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update product status."
    });
  }
};

module.exports = {
  getProducts,
  createProduct,
  getMyProducts,
  getPendingProducts,
  updateProductStatus
};