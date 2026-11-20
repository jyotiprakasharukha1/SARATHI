
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Store,
  Package,
  PackagePlus,
  ClipboardList,
  Wallet,
  LayoutDashboard,
  RefreshCw,
  Plus,
  Search,
  Image as ImageIcon,
  CheckCircle2,
  Clock3,
  XCircle,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  UserRound,
  MapPin
} from "lucide-react";

import DashboardShell from "../components/DashboardShell";
import ShopLocationPicker from "./ShopLocationPicker";
import "./merchant-dashboard.css";

const API_URL = "http://localhost:5000";

const CATEGORIES = [
  "Food",
  "Grocery",
  "Local Shops",
  "Parcel",
  "Documents",
  "Gifts",
  "Electronics",
  "Fashion"
];

const EMPTY_FORM = {
  shopName: "",
  name: "",
  description: "",
  category: "Grocery",
  price: "",
  oldPrice: "",
  stock: "0",
  image: "",
  address: "",
  area: "",
  city: "",
  state: "Odisha",
  pincode: ""
};

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "Date unavailable";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const readableStatus = (status) =>
  String(status || "pending").replaceAll("_", " ");

export default function MerchantDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const EMPTY_SHOP_LOCATION = {
    shopName: "",
    address: "",
    area: "",
    city: "",
    state: "Odisha",
    pincode: "",
    latitude: null,
    longitude: null
  };

  const [shopLocation, setShopLocation] = useState(EMPTY_SHOP_LOCATION);
  const [shopLocationLoading, setShopLocationLoading] = useState(false);
  const [shopLocationSaving, setShopLocationSaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [productSearch, setProductSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");

  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const approved = user?.accountStatus === "active";
  const token = sessionStorage.getItem("sarathiToken");
  const [decisionLoading, setDecisionLoading] = useState("");

  // =========================================
  // API REQUEST HELPER
  // =========================================

  const request = useCallback(async (path, options = {}) => {
    if (!token) {
      throw new Error("Login session not found. Please log in again.");
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  }, [token]);

  // =========================================
  // LOAD PRODUCTS
  // =========================================

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setError("");

      const data = await request("/api/products/mine");
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Unable to load products.");
    } finally {
      setProductsLoading(false);
    }
  }, [request]);

  // =========================================
  // LOAD MERCHANT ORDERS
  // =========================================

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setError("");

      const data = await request("/api/orders/merchant/my-orders");
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Unable to load orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, [request]);

  // =========================================
  // ACCEPT OR REJECT MERCHANT ORDER
  // =========================================

  const handleOrderDecision = async (orderId, decision) => {
    if (!orderId || !["accepted", "rejected"].includes(decision)) {
      return;
    }

    const action = decision === "accepted" ? "accept" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this order?`)) {
      return;
    }

    try {
      setDecisionLoading(orderId);
      setError("");
      setSuccess("");

      const data = await request(`/api/orders/merchant/${orderId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          reason: decision === "rejected" ? "Rejected by merchant." : ""
        })
      });

      setSuccess(data.message || `Order ${decision} successfully.`);
      await loadOrders();
    } catch (err) {
      setError(err.message || "Unable to update order decision.");
    } finally {
      setDecisionLoading("");
    }
  };

  // =========================================
  // SHOP LOCATION
  // =========================================

  const loadShopLocation = useCallback(async () => {
    try {
      setShopLocationLoading(true);
      const data = await request("/api/merchant-locations/mine");
      setShopLocation({
        ...EMPTY_SHOP_LOCATION,
        ...(data.shopLocation || data.location || {})
      });
    } catch (err) {
      setError(err.message || "Unable to load shop location.");
    } finally {
      setShopLocationLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (activeTab === "orders" || activeTab === "earnings") {
      loadOrders();
    }
  }, [activeTab, loadOrders]);

  useEffect(() => {
    if (activeTab === "shop-location") {
      loadShopLocation();
    }
  }, [activeTab, loadShopLocation]);

  // =========================================
  // PRODUCT STATISTICS
  // =========================================

  const stats = useMemo(() => ({
    total: products.length,
    approved: products.filter((p) => p.status === "approved").length,
    pending: products.filter((p) => p.status === "pending").length,
    rejected: products.filter((p) => p.status === "rejected").length,
    outOfStock: products.filter((p) => Number(p.stock) <= 0).length
  }), [products]);

  // =========================================
  // ORDER AND EARNINGS STATISTICS
  // =========================================

  const orderStats = useMemo(() => {
    const deliveredOrders = orders.filter(
      (order) => order.status === "delivered"
    );

    const cancelledOrders = orders.filter(
      (order) => order.status === "cancelled"
    );

    const pendingOrders = orders.filter(
      (order) => !["delivered", "cancelled"].includes(order.status)
    );

    const deliveredRevenue = deliveredOrders.reduce((total, order) => {
      const merchantSubtotal = (order.items || []).reduce(
        (sum, item) => sum + Number(
          item.subtotal ??
          Number(item.price || 0) * Number(item.quantity || 0)
        ),
        0
      );

      return total + merchantSubtotal;
    }, 0);

    const totalItemsSold = deliveredOrders.reduce(
      (total, order) =>
        total + (order.items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),
      0
    );

    return {
      total: orders.length,
      delivered: deliveredOrders.length,
      cancelled: cancelledOrders.length,
      pending: pendingOrders.length,
      revenue: deliveredRevenue,
      itemsSold: totalItemsSold
    };
  }, [orders]);

  // =========================================
  // PRODUCT SEARCH
  // =========================================

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      `${product.name} ${product.shopName} ${product.category}`
        .toLowerCase()
        .includes(query)
    );
  }, [products, productSearch]);

  // =========================================
  // ORDER SEARCH AND FILTER
  // =========================================

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        orderFilter === "all" || order.status === orderFilter;

      const matchesSearch =
        !query ||
        String(order.orderNumber || "").toLowerCase().includes(query) ||
        String(order.customer?.name || "").toLowerCase().includes(query) ||
        (order.items || []).some((item) =>
          String(item.productName || "").toLowerCase().includes(query)
        );

      return matchesStatus && matchesSearch;
    });
  }, [orders, orderSearch, orderFilter]);

  // =========================================
  // PRODUCT FORM
  // =========================================

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const updateShopField = (event) => {
    const { name, value } = event.target;
    setShopLocation((current) => ({ ...current, [name]: value }));
  };

  const updateShopCoordinates = ({ latitude, longitude }) => {
    setShopLocation((current) => ({ ...current, latitude, longitude }));
  };

  const saveShopLocation = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!approved) {
      setError("Your merchant account must be approved first.");
      return;
    }

    if (
      !shopLocation.shopName.trim() ||
      !shopLocation.address.trim() ||
      !shopLocation.city.trim() ||
      !/^\d{6}$/.test(shopLocation.pincode.trim())
    ) {
      setError("Enter your shop name, address, city and valid 6-digit pincode.");
      return;
    }

    const latitude = Number(shopLocation.latitude);
    const longitude = Number(shopLocation.longitude);

    if (
      shopLocation.latitude === null ||
      shopLocation.longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      setError("Select a valid shop position on the map.");
      return;
    }

    try {
      setShopLocationSaving(true);

      const payload = {
        shopName: shopLocation.shopName.trim(),
        address: shopLocation.address.trim(),
        area: shopLocation.area.trim(),
        city: shopLocation.city.trim(),
        state: shopLocation.state.trim(),
        pincode: shopLocation.pincode.trim(),
        latitude,
        longitude
      };

      const data = await request("/api/merchant-locations/mine", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      setShopLocation({
        ...EMPTY_SHOP_LOCATION,
        ...(data.shopLocation || data.location || payload)
      });
      setSuccess(data.message || "Shop location saved successfully.");
    } catch (err) {
      setError(err.message || "Unable to save shop location.");
    } finally {
      setShopLocationSaving(false);
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!approved) {
      setError("Your merchant account must be approved first.");
      return;
    }

    if (!form.shopName.trim() || !form.name.trim()) {
      setError("Shop name and product name are required.");
      return;
    }

    if (!form.description.trim()) {
      setError("Please enter a product description.");
      return;
    }

    const price = Number(form.price);
    const stock = Number(form.stock);
    const oldPrice =
      form.oldPrice === "" ? null : Number(form.oldPrice);

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid product price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    if (
      oldPrice !== null &&
      (!Number.isFinite(oldPrice) || oldPrice < 0)
    ) {
      setError("Enter a valid previous price.");
      return;
    }

    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      setError("Pincode must contain exactly 6 digits.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        shopName: form.shopName.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        price,
        oldPrice,
        stock,
        images: form.image.trim() ? [form.image.trim()] : [],
        location: {
          address: form.address.trim(),
          area: form.area.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim()
        }
      };

      const data = await request("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSuccess(data.message || "Product submitted successfully.");
      setForm(EMPTY_FORM);

      await loadProducts();
      setActiveTab("inventory");
    } catch (err) {
      setError(err.message || "Unable to submit product.");
    } finally {
      setSubmitting(false);
    }
  };

  const refreshCurrentTab = () => {
    if (activeTab === "orders" || activeTab === "earnings") {
      loadOrders();
    } else {
      loadProducts();
    }
  };

  // =========================================
  // NAVIGATION
  // =========================================

  const navigation = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "add", label: "Add Product", icon: PackagePlus },
    { id: "inventory", label: "Product Inventory", icon: Package },
    { id: "shop-location", label: "Shop Location", icon: MapPin },
    { id: "orders", label: "Incoming Orders", icon: ClipboardList },
    { id: "earnings", label: "Earnings", icon: Wallet }
  ];

  const changeTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setSuccess("");
  };

  // =========================================
  // MAIN UI
  // =========================================

  return (
    <DashboardShell
      user={user}
      onLogout={onLogout}
      title="Merchant Portal"
      subtitle="Manage your shop, products and customer orders with SARATHI."
    >
      <div className="merchant-portal">

        {/* WELCOME */}
        <section className="merchant-welcome">
          <div>
            <span className="merchant-eyebrow">SARATHI MERCHANT</span>
            <h2>Welcome, {user?.name || "Merchant"}</h2>
            <p>Manage your local business from one place.</p>
          </div>

          <div className="merchant-account-status">
            <span className={approved ? "approved" : "pending"}>
              {approved ? "Account Approved" : "Awaiting Approval"}
            </span>
            <Store size={34} />
          </div>
        </section>

        {/* NAVIGATION */}
        <nav className="merchant-tabs">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? "active" : ""}
              onClick={() => changeTab(id)}
            >
              <Icon size={17} />
              {label}

              {id === "inventory" && <span>{stats.total}</span>}
              {id === "orders" && <span>{orderStats.total}</span>}
            </button>
          ))}
        </nav>

        {/* MESSAGES */}
        {error && (
          <div className="merchant-message error">
            <XCircle size={17} />
            {error}
          </div>
        )}

        {success && (
          <div className="merchant-message success">
            <CheckCircle2 size={17} />
            {success}
          </div>
        )}

        {!approved && (
          <div className="merchant-approval-notice">
            <Clock3 size={20} />
            Your merchant account is awaiting admin approval.
            Product submission is disabled until approval.
          </div>
        )}

        {/* ================================= */}
        {/* OVERVIEW */}
        {/* ================================= */}

        {activeTab === "overview" && (
          <>
            <div className="merchant-section-heading">
              <div>
                <h2>Business Overview</h2>
                <p>Monitor your products and business activity.</p>
              </div>

              <button
                className="merchant-secondary-btn"
                onClick={refreshCurrentTab}
                disabled={productsLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="merchant-stat-grid">
              <StatCard
                icon={Package}
                label="Total Products"
                value={stats.total}
                color="purple"
              />

              <StatCard
                icon={CheckCircle2}
                label="Approved Products"
                value={stats.approved}
                color="green"
              />

              <StatCard
                icon={Clock3}
                label="Pending Review"
                value={stats.pending}
                color="orange"
              />

              <StatCard
                icon={XCircle}
                label="Rejected Products"
                value={stats.rejected}
                color="red"
              />
            </div>

            <div className="merchant-stat-grid merchant-secondary-stats">
              <StatCard
                icon={ShoppingBag}
                label="Total Orders"
                value={orderStats.total}
                color="blue"
              />

              <StatCard
                icon={TrendingUp}
                label="Delivered Orders"
                value={orderStats.delivered}
                color="green"
              />

              <StatCard
                icon={Wallet}
                label="Delivered Sales"
                value={money(orderStats.revenue)}
                color="purple"
              />

              <StatCard
                icon={Package}
                label="Out of Stock"
                value={stats.outOfStock}
                color="red"
              />
            </div>

            <section className="merchant-panel">
              <div className="merchant-panel-heading">
                <div>
                  <h3>Recent Products</h3>
                  <p>Your latest product submissions.</p>
                </div>

                <button
                  className="merchant-text-btn"
                  onClick={() => changeTab("inventory")}
                >
                  View inventory
                </button>
              </div>

              {productsLoading ? (
                <div className="merchant-empty">Loading products...</div>
              ) : products.length === 0 ? (
                <EmptyState
                  icon={PackagePlus}
                  title="No products added yet"
                  description="Add your first product to start selling on SARATHI."
                  action={() => changeTab("add")}
                  actionLabel="Add your first product"
                />
              ) : (
                <div className="merchant-product-list">
                  {products.slice(0, 5).map((product) => (
                    <ProductRow key={product._id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ================================= */}
        {/* ADD PRODUCT */}
        {/* ================================= */}

        {activeTab === "add" && (
          <section className="merchant-panel">
            <div className="merchant-panel-heading">
              <div>
                <h2>Add New Product</h2>
                <p>Submit your product for admin approval.</p>
              </div>
            </div>

            <form className="merchant-form" onSubmit={submitProduct}>
              <div className="merchant-form-grid">

                <label>
                  Shop Name *
                  <input
                    name="shopName"
                    value={form.shopName}
                    onChange={updateField}
                    placeholder="Your shop name"
                    required
                    maxLength={120}
                  />
                </label>

                <label>
                  Product Name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="Enter product name"
                    required
                    maxLength={120}
                  />
                </label>

                <label>
                  Category *
                  <select
                    name="category"
                    value={form.category}
                    onChange={updateField}
                    required
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Price (₹) *
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateField}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Previous Price (₹)
                  <input
                    type="number"
                    name="oldPrice"
                    value={form.oldPrice}
                    onChange={updateField}
                    placeholder="Optional"
                    min="0"
                    step="0.01"
                  />
                </label>

                <label>
                  Available Stock *
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={updateField}
                    min="0"
                    step="1"
                    required
                  />
                </label>

                <label className="full-width">
                  Product Image URL
                  <input
                    type="url"
                    name="image"
                    value={form.image}
                    onChange={updateField}
                    placeholder="https://example.com/product-image.jpg"
                  />
                  <small>Paste a publicly accessible image URL.</small>
                </label>

                <label className="full-width">
                  Product Description *
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="Describe your product..."
                    rows="4"
                    required
                    maxLength={2000}
                  />
                </label>
              </div>

              <div className="merchant-form-divider">
                <h3>Shop Address</h3>
                <p>Basic address details for this product listing.</p>
              </div>

              <div className="merchant-form-grid">
                <label className="full-width">
                  Address
                  <input
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    placeholder="Shop address"
                  />
                </label>

                <label>
                  Area
                  <input
                    name="area"
                    value={form.area}
                    onChange={updateField}
                    placeholder="Area"
                  />
                </label>

                <label>
                  City
                  <input
                    name="city"
                    value={form.city}
                    onChange={updateField}
                    placeholder="City"
                  />
                </label>

                <label>
                  State
                  <input
                    name="state"
                    value={form.state}
                    onChange={updateField}
                    placeholder="State"
                  />
                </label>

                <label>
                  Pincode
                  <input
                    name="pincode"
                    value={form.pincode}
                    onChange={updateField}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </label>
              </div>

              <div className="merchant-form-actions">
                <button
                  type="button"
                  className="merchant-secondary-btn"
                  onClick={() => setForm(EMPTY_FORM)}
                >
                  Clear Form
                </button>

                <button
                  type="submit"
                  className="merchant-primary-btn"
                  disabled={submitting || !approved}
                >
                  <Plus size={17} />
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ================================= */}
        {/* PRODUCT INVENTORY */}
        {/* ================================= */}

        {activeTab === "inventory" && (
          <section className="merchant-panel">
            <div className="merchant-panel-heading">
              <div>
                <h2>Product Inventory</h2>
                <p>Manage and monitor your submitted products.</p>
              </div>

              <button
                className="merchant-primary-btn"
                onClick={() => changeTab("add")}
                disabled={!approved}
              >
                <Plus size={16} />
                Add Product
              </button>
            </div>

            <div className="merchant-search">
              <Search size={18} />
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search your products..."
              />
            </div>

            {productsLoading ? (
              <div className="merchant-empty">Loading inventory...</div>
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No matching products"
                description="Try another search or add a new product."
                action={() => changeTab("add")}
                actionLabel="Add Product"
              />
            ) : (
              <div className="merchant-product-list">
                {filteredProducts.map((product) => (
                  <ProductRow key={product._id} product={product} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================= */}
        {/* SHOP LOCATION */}
        {/* ================================= */}

        {activeTab === "shop-location" && (
          <section className="merchant-panel">
            <div className="merchant-panel-heading">
              <div>
                <h2>Shop Location</h2>
                <p>Save the physical location of your shop for the SARATHI admin map.</p>
              </div>

              <button
                type="button"
                className="merchant-secondary-btn"
                onClick={loadShopLocation}
                disabled={shopLocationLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {!approved && (
              <div className="merchant-approval-notice">
                <Clock3 size={18} />
                Your merchant account must be approved before you can save a shop location.
              </div>
            )}

            {shopLocationLoading ? (
              <div className="merchant-empty">Loading shop location...</div>
            ) : (
              <form className="merchant-form" onSubmit={saveShopLocation}>
                <div className="merchant-form-grid">
                  <label>
                    Shop Name *
                    <input
                      name="shopName"
                      value={shopLocation.shopName}
                      onChange={updateShopField}
                      placeholder="Enter your shop name"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label>
                    City *
                    <input
                      name="city"
                      value={shopLocation.city}
                      onChange={updateShopField}
                      placeholder="Enter city"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="full-width">
                    Full Shop Address *
                    <input
                      name="address"
                      value={shopLocation.address}
                      onChange={updateShopField}
                      placeholder="Building, street and shop number"
                      maxLength={300}
                      required
                    />
                  </label>

                  <label>
                    Area / Locality
                    <input
                      name="area"
                      value={shopLocation.area}
                      onChange={updateShopField}
                      placeholder="Area or locality"
                      maxLength={120}
                    />
                  </label>

                  <label>
                    State
                    <input
                      name="state"
                      value={shopLocation.state}
                      onChange={updateShopField}
                      placeholder="State"
                      maxLength={100}
                    />
                  </label>

                  <label>
                    Pincode *
                    <input
                      name="pincode"
                      value={shopLocation.pincode}
                      onChange={updateShopField}
                      placeholder="6-digit pincode"
                      maxLength={6}
                      inputMode="numeric"
                      required
                    />
                  </label>
                </div>

                <div className="merchant-form-divider">
                  <h3>Pin Your Exact Shop Location</h3>
                  <p>Click the map to place or move the marker. You can also use your device location while you are at the shop.</p>
                </div>

                <ShopLocationPicker
                  latitude={shopLocation.latitude}
                  longitude={shopLocation.longitude}
                  onChange={updateShopCoordinates}
                />

                <div className="merchant-form-actions">
                  <button
                    type="button"
                    className="merchant-secondary-btn"
                    onClick={() => {
                      setShopLocation(EMPTY_SHOP_LOCATION);
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Clear Form
                  </button>

                  <button
                    type="submit"
                    className="merchant-primary-btn"
                    disabled={shopLocationSaving || !approved}
                  >
                    <MapPin size={17} />
                    {shopLocationSaving ? "Saving Location..." : "Save Shop Location"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ================================= */}
        {/* INCOMING ORDERS */}
        {/* ================================= */}

        {activeTab === "orders" && (
          <section className="merchant-panel">
            <div className="merchant-panel-heading">
              <div>
                <h2>Incoming Orders</h2>
                <p>Customer orders containing products from your shop.</p>
              </div>

              <button
                className="merchant-secondary-btn"
                onClick={loadOrders}
                disabled={ordersLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="merchant-order-stats">
              <div>
                <small>Total</small>
                <strong>{orderStats.total}</strong>
              </div>
              <div>
                <small>In Progress</small>
                <strong>{orderStats.pending}</strong>
              </div>
              <div>
                <small>Delivered</small>
                <strong>{orderStats.delivered}</strong>
              </div>
              <div>
                <small>Cancelled</small>
                <strong>{orderStats.cancelled}</strong>
              </div>
            </div>

            <div className="merchant-order-toolbar">
              <div className="merchant-search">
                <Search size={18} />
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Search order, customer or product..."
                />
              </div>

              <select
                className="merchant-order-filter"
                value={orderFilter}
                onChange={(event) => setOrderFilter(event.target.value)}
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {ordersLoading ? (
              <div className="merchant-empty">Loading incoming orders...</div>
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No orders found"
                description="Orders containing your products will appear here."
              />
            ) : (
              <div className="merchant-orders-list">
                {filteredOrders.map((order) => (
                  <MerchantOrderCard
                    key={order._id}
                    order={order}
                    onDecision={handleOrderDecision}
                    decisionLoading={decisionLoading}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================= */}
        {/* EARNINGS */}
        {/* ================================= */}

        {activeTab === "earnings" && (
          <section className="merchant-panel">
            <div className="merchant-panel-heading">
              <div>
                <h2>Earnings Dashboard</h2>
                <p>Sales summary based on your delivered orders.</p>
              </div>

              <button
                className="merchant-secondary-btn"
                onClick={loadOrders}
                disabled={ordersLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {ordersLoading ? (
              <div className="merchant-empty">Calculating earnings...</div>
            ) : (
              <>
                <div className="merchant-earnings-banner">
                  <span><Wallet size={19} /> Delivered Sales</span>
                  <h2>{money(orderStats.revenue)}</h2>
                  <p>
                    Sum of your item subtotals in delivered orders.
                    This is sales value, not necessarily your net profit
                    or final payout.
                  </p>
                </div>

                <div className="merchant-stat-grid">
                  <StatCard
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={orderStats.total}
                    color="blue"
                  />

                  <StatCard
                    icon={CheckCircle2}
                    label="Delivered Orders"
                    value={orderStats.delivered}
                    color="green"
                  />

                  <StatCard
                    icon={Package}
                    label="Items Sold"
                    value={orderStats.itemsSold}
                    color="purple"
                  />

                  <StatCard
                    icon={Wallet}
                    label="Delivered Sales"
                    value={money(orderStats.revenue)}
                    color="orange"
                  />
                </div>

                <div className="merchant-panel merchant-earnings-history">
                  <h3>Delivered Order History</h3>

                  {orders.filter((o) => o.status === "delivered").length === 0 ? (
                    <div className="merchant-empty">
                      No delivered orders yet.
                    </div>
                  ) : (
                    orders
                      .filter((o) => o.status === "delivered")
                      .map((order) => (
                        <MerchantOrderCard
                          key={order._id}
                          order={order}
                          onDecision={handleOrderDecision}
                          decisionLoading={decisionLoading}
                        />
                      ))
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

// =========================================
// STATISTICS CARD
// =========================================

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <article className="merchant-stat-card">
      <span className={`stat-icon ${color}`}>
        <Icon size={21} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

// =========================================
// EMPTY STATE
// =========================================

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel
}) {
  return (
    <div className="merchant-empty">
      <Icon size={32} />
      <strong>{title}</strong>
      <p>{description}</p>

      {action && (
        <button className="merchant-primary-btn" onClick={action}>
          <Plus size={16} />
          {actionLabel || "Continue"}
        </button>
      )}
    </div>
  );
}

// =========================================
// PRODUCT ROW
// =========================================

function ProductRow({ product }) {
  const status = product.status || "pending";

  const statusIcon =
    status === "approved"
      ? <CheckCircle2 size={15} />
      : status === "rejected"
      ? <XCircle size={15} />
      : <Clock3 size={15} />;

  return (
    <article className="merchant-product-row">
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} />
      ) : (
        <div className="merchant-product-placeholder">
          <ImageIcon size={25} />
        </div>
      )}

      <div className="merchant-product-details">
        <strong>{product.name}</strong>
        <span>{product.shopName} · {product.category}</span>
        <small>Stock: {product.stock ?? 0}</small>

        {status === "rejected" && product.rejectionReason && (
          <small className="merchant-rejection-reason">
            Reason: {product.rejectionReason}
          </small>
        )}
      </div>

      <div className="merchant-product-right">
        <strong>{money(product.price)}</strong>
        <span className={`merchant-product-status ${status}`}>
          {statusIcon}
          {status}
        </span>
      </div>
    </article>
  );
}

// =========================================
// MERCHANT ORDER CARD
// =========================================

function MerchantOrderCard({ order, onDecision, decisionLoading }) {
  const customer = order.customer || {};
  const address = order.deliveryAddress || {};

  const merchantSubtotal = (order.items || []).reduce(
    (total, item) =>
      total +
      Number(
        item.subtotal ??
        Number(item.price || 0) * Number(item.quantity || 0)
      ),
    0
  );

  const status = order.status || "pending";
  const hasPendingItems = (order.items || []).some(
    (item) => (item.merchantStatus || "pending") === "pending"
  );
  const isProcessing = decisionLoading === order._id;

  return (
    <article className="merchant-order-card">
      <div className="merchant-order-header">
        <div>
          <strong>{order.orderNumber || "Order"}</strong>
          <small>{formatDate(order.createdAt)}</small>
        </div>

        <span className={`merchant-order-status ${status}`}>
          {readableStatus(status)}
        </span>
      </div>

      <div className="merchant-order-customer">
        <div>
          <small>Customer</small>
          <strong>
            <UserRound size={14} />
            {customer.name || "Customer"}
          </strong>
          <span>{customer.phone || "Phone unavailable"}</span>
        </div>

        <div>
          <small>Your items' value</small>
          <strong>{money(merchantSubtotal)}</strong>
        </div>
      </div>

      <div className="merchant-order-items">
        <strong>Your Products in this Order</strong>

        {(order.items || []).map((item, index) => (
          <div
            className="merchant-order-item"
            key={`${order._id}-${index}`}
          >
            <span>{item.productName}</span>
            <span>
              {item.quantity} × {money(item.price)}
            </span>
          </div>
        ))}
      </div>

      <div className="merchant-order-address">
        <strong><MapPin size={15} /> Delivery Address</strong>
        <p>
          {address.fullName || customer.name || ""}
          {address.address ? `, ${address.address}` : ""}
          {address.area ? `, ${address.area}` : ""}
          {address.city ? `, ${address.city}` : ""}
          {address.state ? `, ${address.state}` : ""}
          {address.pincode ? ` - ${address.pincode}` : ""}
        </p>
      </div>

      <div className="merchant-order-footer">
        <span>Payment: {readableStatus(order.paymentStatus)}</span>
        <span>
          Method: {String(order.paymentMethod || "cod").toUpperCase()}
        </span>
      </div>

      {hasPendingItems && status !== "cancelled" && (
        <div
          className="merchant-order-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "18px",
            paddingTop: "16px",
            borderTop: "1px solid #e8edf3"
          }}
        >
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onDecision(order._id, "accepted")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "11px 18px",
              border: "1px solid #16a34a",
              borderRadius: "9px",
              background: "#16a34a",
              color: "#fff",
              fontWeight: 700,
              cursor: isProcessing ? "not-allowed" : "pointer",
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            <CheckCircle2 size={17} />
            {isProcessing ? "Processing..." : "Accept Order"}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onDecision(order._id, "rejected")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "11px 18px",
              border: "1px solid #dc2626",
              borderRadius: "9px",
              background: "#fff",
              color: "#dc2626",
              fontWeight: 700,
              cursor: isProcessing ? "not-allowed" : "pointer",
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            <XCircle size={17} />
            {isProcessing ? "Processing..." : "Reject Order"}
          </button>
        </div>
      )}

      {!hasPendingItems && (
        <div
          className="merchant-order-decision-complete"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "16px",
            color: "#15803d",
            fontSize: "13px",
            fontWeight: 600
          }}
        >
          <CheckCircle2 size={17} />
          Your items have already been processed.
        </div>
      )}
    </article>
  );
}
