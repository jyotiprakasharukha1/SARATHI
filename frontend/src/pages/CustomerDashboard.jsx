
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  MapPin,
  ShoppingBag,
  Headset,
  ArrowRight,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Plus,
  Trash2,
  Star,
  UserRound,
  CreditCard,
  ChevronRight,
  X,
  Home,
  Briefcase,
  Copy,
  Phone,
  Mail
} from "lucide-react";
import DashboardShell from "../components/DashboardShell";
import "./CustomerDashboard.css";

const API_URL = "http://localhost:5000";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled"
];

const statusLabel = (status) =>
  String(status || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(amount || 0));

const formatDate = (date) => {
  if (!date) return "Date unavailable";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const getAddressKey = (user) =>
  `sarathiAddresses_${user?._id || user?.id || user?.email || "customer"}`;

const initialAddress = {
  label: "Home",
  fullName: "",
  phone: "",
  address: "",
  area: "",
  city: "",
  state: "Odisha",
  pincode: "",
  landmark: "",
  isDefault: false
};

export default function CustomerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [addresses, setAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState(initialAddress);
  const [addressMessage, setAddressMessage] = useState("");

  const [copiedOrder, setCopiedOrder] = useState(false);

  const token = sessionStorage.getItem("sarathiToken");

  // -----------------------------------------
  // API REQUEST
  // -----------------------------------------

  const request = useCallback(async (path, options = {}) => {
    if (!token) {
      throw new Error("Your login session has expired. Please log in again.");
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
      throw new Error(data.message || "Unable to complete the request.");
    }

    return data;
  }, [token]);

  // -----------------------------------------
  // LOAD CUSTOMER ORDERS
  // -----------------------------------------

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      const data = await request("/api/orders/my-orders");

      setOrders(data.orders || []);
    } catch (error) {
      setOrdersError(error.message || "Unable to load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // -----------------------------------------
  // SAVED ADDRESSES
  // Browser-local storage for now
  // -----------------------------------------

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(getAddressKey(user)) || "[]"
      );

      setAddresses(Array.isArray(saved) ? saved : []);
    } catch {
      setAddresses([]);
    }
  }, [user]);

  const saveAddresses = (updated) => {
    setAddresses(updated);

    localStorage.setItem(
      getAddressKey(user),
      JSON.stringify(updated)
    );
  };

  const openNewAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      ...initialAddress,
      fullName: user?.name || "",
      phone: user?.phone || "",
      isDefault: addresses.length === 0
    });
    setAddressMessage("");
    setShowAddressForm(true);
  };

  const openEditAddress = (address) => {
    setEditingAddressId(address.id);
    setAddressForm({ ...address });
    setAddressMessage("");
    setShowAddressForm(true);
  };

  const handleAddressSubmit = (event) => {
    event.preventDefault();

    if (!/^\d{10}$/.test(addressForm.phone)) {
      setAddressMessage("Enter a valid 10-digit phone number.");
      return;
    }

    if (!/^\d{6}$/.test(addressForm.pincode)) {
      setAddressMessage("Enter a valid 6-digit PIN code.");
      return;
    }

    const address = {
      ...addressForm,
      id: editingAddressId || crypto.randomUUID()
    };

    let updated;

    if (editingAddressId) {
      updated = addresses.map((item) =>
        item.id === editingAddressId ? address : item
      );
    } else {
      updated = [...addresses, address];
    }

    if (address.isDefault) {
      updated = updated.map((item) => ({
        ...item,
        isDefault: item.id === address.id
      }));
    }

    if (!updated.some((item) => item.isDefault) && updated.length > 0) {
      updated[0].isDefault = true;
    }

    saveAddresses(updated);
    setShowAddressForm(false);
    setAddressMessage("Address saved successfully.");
  };

  const deleteAddress = (id) => {
    if (!window.confirm("Delete this saved address?")) return;

    let updated = addresses.filter((item) => item.id !== id);

    if (updated.length && !updated.some((item) => item.isDefault)) {
      updated[0].isDefault = true;
    }

    saveAddresses(updated);
  };

  const setDefaultAddress = (id) => {
    const updated = addresses.map((item) => ({
      ...item,
      isDefault: item.id === id
    }));

    saveAddresses(updated);
  };

  // -----------------------------------------
  // ORDER STATISTICS
  // -----------------------------------------

  const stats = useMemo(() => {
    const delivered = orders.filter(
      (order) => order.status === "delivered"
    );

    const active = orders.filter(
      (order) =>
        !["delivered", "cancelled"].includes(order.status)
    );

    const spending = delivered.reduce(
      (total, order) => total + Number(order.totalAmount || 0),
      0
    );

    return {
      total: orders.length,
      active: active.length,
      delivered: delivered.length,
      spending
    };
  }, [orders]);

  // -----------------------------------------
  // ORDER SEARCH AND FILTER
  // -----------------------------------------

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        filter === "all" || order.status === filter;

      const query = search.toLowerCase();

      const matchesSearch =
        String(order.orderNumber || "").toLowerCase().includes(query) ||
        (order.items || []).some((item) =>
          String(item.productName || item.product?.name || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;
    });
  }, [orders, filter, search]);

  const recentOrders = orders.slice(0, 3);

  // -----------------------------------------
  // ORDER DETAILS
  // -----------------------------------------

  const copyOrderNumber = async (orderNumber) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 1800);
    } catch {
      window.alert("Unable to copy order number.");
    }
  };

  const getProgress = (status) => {
    const steps = [
      "pending",
      "confirmed",
      "preparing",
      "ready_for_pickup",
      "out_for_delivery",
      "delivered"
    ];

    if (status === "cancelled") return -1;

    return steps.indexOf(status);
  };

  const getStatusIcon = (status) => {
    if (status === "delivered") return CheckCircle;
    if (status === "cancelled") return XCircle;
    if (status === "out_for_delivery") return Truck;
    return Clock;
  };

  const StatusIcon = ({ status }) => {
    const Icon = getStatusIcon(status);
    return <Icon size={16} />;
  };

  // -----------------------------------------
  // SUPPORT
  // -----------------------------------------

  const supportSubject = encodeURIComponent("SARATHI Customer Support");
  const supportBody = encodeURIComponent(
    `Hello SARATHI Support,\n\nI need assistance with my account.\n\nCustomer: ${user?.name || ""}\nEmail: ${user?.email || ""}\n\nIssue: `
  );

  // -----------------------------------------
  // NAVIGATION
  // -----------------------------------------

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "orders", label: "My Orders", icon: Package },
    { id: "addresses", label: "Saved Addresses", icon: MapPin },
    { id: "profile", label: "My Profile", icon: UserRound },
    { id: "support", label: "Help & Support", icon: Headset }
  ];

  return (
    <DashboardShell
      user={user}
      onLogout={onLogout}
      title={`Welcome, ${user?.name?.split(" ")[0] || "Customer"}`}
      subtitle="Manage your SARATHI account and local shopping."
    >
      <div className="customer-dashboard">

        {/* DASHBOARD NAVIGATION */}
        <nav className="customer-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={17} />
              {label}
              {id === "orders" && stats.active > 0 && (
                <span className="customer-tab-count">{stats.active}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ACCOUNT PROFILE */}
        <section className="customer-profile-card">
          <div className="customer-profile-avatar">
            {(user?.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="customer-profile-info">
            <h2>{user?.name || "Customer"}</h2>
            <p><Mail size={14} /> {user?.email || "Email unavailable"}</p>
            <p><Phone size={14} /> {user?.phone || "Phone unavailable"}</p>
          </div>

          <span className={user?.emailVerified ? "verified-badge" : "unverified-badge"}>
            {user?.emailVerified ? "Email Verified" : "Email Not Verified"}
          </span>
        </section>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <div className="customer-stats-grid">
              <div className="customer-stat-card">
                <span>Total Orders</span>
                <strong>{stats.total}</strong>
                <Package size={21} />
              </div>

              <div className="customer-stat-card">
                <span>Active Orders</span>
                <strong>{stats.active}</strong>
                <Clock size={21} />
              </div>

              <div className="customer-stat-card">
                <span>Delivered</span>
                <strong>{stats.delivered}</strong>
                <CheckCircle size={21} />
              </div>

              <div className="customer-stat-card">
                <span>Completed Spending</span>
                <strong>{money(stats.spending)}</strong>
                <CreditCard size={21} />
              </div>
            </div>

            <section className="customer-section">
              <div className="customer-section-heading">
                <div>
                  <h2>Recent Orders</h2>
                  <p>Your latest purchases on SARATHI.</p>
                </div>

                <button
                  type="button"
                  className="customer-text-button"
                  onClick={() => setActiveTab("orders")}
                >
                  View All <ArrowRight size={15} />
                </button>
              </div>

              {ordersLoading ? (
                <p className="customer-empty">Loading your orders...</p>
              ) : ordersError ? (
                <div className="customer-error">
                  {ordersError}
                  <button type="button" onClick={loadOrders}>Try Again</button>
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="customer-empty">
                  <ShoppingBag size={35} />
                  <h3>No orders yet</h3>
                  <p>Your purchases will appear here after you place an order.</p>
                  <Link to="/" className="customer-primary-button">
                    Start Shopping <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <div className="customer-order-list">
                  {recentOrders.map((order) => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="customer-shortcuts">
              <button onClick={() => setActiveTab("orders")}>
                <Package size={21} />
                <span>
                  <strong>My Orders</strong>
                  <small>Track and review purchases</small>
                </span>
                <ChevronRight size={18} />
              </button>

              <button onClick={() => setActiveTab("addresses")}>
                <MapPin size={21} />
                <span>
                  <strong>Saved Addresses</strong>
                  <small>Manage delivery locations</small>
                </span>
                <ChevronRight size={18} />
              </button>

              <Link to="/">
                <ShoppingBag size={21} />
                <span>
                  <strong>Continue Shopping</strong>
                  <small>Explore local products</small>
                </span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </>
        )}

        {/* MY ORDERS */}
        {activeTab === "orders" && (
          <section className="customer-section">
            <div className="customer-section-heading">
              <div>
                <h2>My Orders</h2>
                <p>View your purchases and track order progress.</p>
              </div>

              <button
                type="button"
                className="customer-refresh-button"
                onClick={loadOrders}
                disabled={ordersLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="customer-order-filters">
              <div className="customer-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order number or product..."
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Orders</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {ordersLoading ? (
              <p className="customer-empty">Loading orders...</p>
            ) : ordersError ? (
              <div className="customer-error">
                {ordersError}
                <button type="button" onClick={loadOrders}>Retry</button>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="customer-empty">
                <Package size={36} />
                <h3>No matching orders</h3>
                <p>Try changing your search or order filter.</p>
              </div>
            ) : (
              <div className="customer-order-list">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onClick={() => setSelectedOrder(order)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SAVED ADDRESSES */}
        {activeTab === "addresses" && (
          <section className="customer-section">
            <div className="customer-section-heading">
              <div>
                <h2>Saved Addresses</h2>
                <p>Save your frequently used delivery locations.</p>
              </div>

              <button
                type="button"
                className="customer-primary-button"
                onClick={openNewAddress}
              >
                <Plus size={17} /> Add Address
              </button>
            </div>

            {addressMessage && (
              <p className="customer-success-message">{addressMessage}</p>
            )}

            {addresses.length === 0 ? (
              <div className="customer-empty">
                <MapPin size={36} />
                <h3>No saved addresses</h3>
                <p>Add your home or work address for easier checkout.</p>
                <button
                  type="button"
                  className="customer-primary-button"
                  onClick={openNewAddress}
                >
                  <Plus size={16} /> Add Your First Address
                </button>
              </div>
            ) : (
              <div className="customer-address-grid">
                {addresses.map((address) => (
                  <article className="customer-address-card" key={address.id}>
                    <div className="customer-address-heading">
                      <span className="customer-address-icon">
                        {address.label === "Work" ? (
                          <Briefcase size={19} />
                        ) : (
                          <Home size={19} />
                        )}
                      </span>
                      <strong>{address.label}</strong>
                      {address.isDefault && (
                        <span className="customer-default-badge">Default</span>
                      )}
                    </div>

                    <h3>{address.fullName}</h3>
                    <p>{address.phone}</p>
                    <p>
                      {address.address}, {address.area && `${address.area}, `}
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                    {address.landmark && <small>Landmark: {address.landmark}</small>}

                    <div className="customer-address-actions">
                      <button onClick={() => openEditAddress(address)}>
                        Edit
                      </button>

                      {!address.isDefault && (
                        <button onClick={() => setDefaultAddress(address.id)}>
                          Set Default
                        </button>
                      )}

                      <button
                        className="customer-delete-button"
                        onClick={() => deleteAddress(address.id)}
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* PROFILE */}
        {activeTab === "profile" && (
          <section className="customer-section">
            <div className="customer-section-heading">
              <div>
                <h2>My Profile</h2>
                <p>Your registered SARATHI account information.</p>
              </div>
            </div>

            <div className="customer-profile-details">
              <div><span>Full Name</span><strong>{user?.name || "Not available"}</strong></div>
              <div><span>Email Address</span><strong>{user?.email || "Not available"}</strong></div>
              <div><span>Phone Number</span><strong>{user?.phone || "Not available"}</strong></div>
              <div><span>Account Role</span><strong>{user?.role || "Customer"}</strong></div>
              <div><span>Email Verification</span><strong>{user?.emailVerified ? "Verified" : "Not verified"}</strong></div>
              <div><span>Account Status</span><strong>{user?.accountStatus || "Active"}</strong></div>
            </div>

            <p className="customer-info-note">
              Profile editing is not connected yet. Your account information is
              currently read from the authenticated user profile.
            </p>
          </section>
        )}

        {/* SUPPORT */}
        {activeTab === "support" && (
          <section className="customer-section">
            <div className="customer-section-heading">
              <div>
                <h2>Help & Support</h2>
                <p>Find answers to common questions about SARATHI.</p>
              </div>
            </div>

            <div className="customer-faq-list">
              <details>
                <summary>How can I track my order?</summary>
                <p>Open My Orders, select an order and view its latest status and progress.</p>
              </details>

              <details>
                <summary>How can I add a delivery address?</summary>
                <p>Open Saved Addresses and select Add Address. You can save multiple locations.</p>
              </details>

              <details>
                <summary>What does Pending mean?</summary>
                <p>Your order has been created and is waiting for the next processing step.</p>
              </details>

              <details>
                <summary>Can I pay by cash?</summary>
                <p>Cash on Delivery is available for orders where it is enabled during checkout.</p>
              </details>
            </div>

            <div className="customer-support-card">
              <Headset size={27} />
              <div>
                <h3>Still need help?</h3>
                <p>Contact the SARATHI support team through your email application.</p>
                <a href={`mailto:?subject=${supportSubject}&body=${supportBody}`}>
                  Contact Support <ArrowRight size={15} />
                </a>
                <small>
                  No support email address has been configured in the application yet.
                </small>
              </div>
            </div>
          </section>
        )}

        {/* ADDRESS FORM MODAL */}
        {showAddressForm && (
          <div className="customer-modal-backdrop">
            <form className="customer-modal" onSubmit={handleAddressSubmit}>
              <div className="customer-modal-heading">
                <div>
                  <h2>{editingAddressId ? "Edit Address" : "Add New Address"}</h2>
                  <p>Enter your delivery details.</p>
                </div>
                <button type="button" onClick={() => setShowAddressForm(false)}>
                  <X size={20} />
                </button>
              </div>

              <label>Address Label</label>
              <select
                value={addressForm.label}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  label: e.target.value
                })}
              >
                <option>Home</option>
                <option>Work</option>
                <option>Other</option>
              </select>

              <label>Full Name</label>
              <input
                required
                value={addressForm.fullName}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  fullName: e.target.value
                })}
              />

              <label>Phone Number</label>
              <input
                required
                maxLength={10}
                inputMode="numeric"
                value={addressForm.phone}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  phone: e.target.value.replace(/\D/g, "")
                })}
              />

              <label>House / Street Address</label>
              <input
                required
                value={addressForm.address}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  address: e.target.value
                })}
              />

              <label>Area / Locality</label>
              <input
                value={addressForm.area}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  area: e.target.value
                })}
              />

              <div className="customer-form-row">
                <div>
                  <label>City</label>
                  <input
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({
                      ...addressForm,
                      city: e.target.value
                    })}
                  />
                </div>

                <div>
                  <label>State</label>
                  <input
                    required
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({
                      ...addressForm,
                      state: e.target.value
                    })}
                  />
                </div>
              </div>

              <label>PIN Code</label>
              <input
                required
                maxLength={6}
                inputMode="numeric"
                value={addressForm.pincode}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  pincode: e.target.value.replace(/\D/g, "")
                })}
              />

              <label>Landmark (Optional)</label>
              <input
                value={addressForm.landmark}
                onChange={(e) => setAddressForm({
                  ...addressForm,
                  landmark: e.target.value
                })}
              />

              <label className="customer-default-checkbox">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({
                    ...addressForm,
                    isDefault: e.target.checked
                  })}
                />
                Set as default address
              </label>

              {addressMessage && (
                <p className="customer-error-text">{addressMessage}</p>
              )}

              <button type="submit" className="customer-primary-button">
                Save Address
              </button>
            </form>
          </div>
        )}

        {/* ORDER DETAIL MODAL */}
        {selectedOrder && (
          <div className="customer-modal-backdrop">
            <div className="customer-modal customer-order-modal">
              <div className="customer-modal-heading">
                <div>
                  <h2>Order Details</h2>
                  <p>{selectedOrder.orderNumber}</p>
                </div>

                <button onClick={() => setSelectedOrder(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="customer-order-number">
                <strong>{selectedOrder.orderNumber}</strong>
                <button
                  type="button"
                  onClick={() => copyOrderNumber(selectedOrder.orderNumber)}
                >
                  <Copy size={15} />
                  {copiedOrder ? "Copied" : "Copy"}
                </button>
              </div>

              <p className="customer-order-date">
                Placed on {formatDate(selectedOrder.createdAt)}
              </p>

              <div className="customer-order-status">
                <span>Status</span>
                <strong className={`status-${selectedOrder.status}`}>
                  {statusLabel(selectedOrder.status)}
                </strong>
              </div>

              <h3>Order Progress</h3>

              {selectedOrder.status === "cancelled" ? (
                <p className="customer-cancelled-message">
                  This order has been cancelled.
                  {selectedOrder.cancellationReason
                    ? ` Reason: ${selectedOrder.cancellationReason}`
                    : ""}
                </p>
              ) : (
                <div className="customer-timeline">
                  {[
                    "pending",
                    "confirmed",
                    "preparing",
                    "ready_for_pickup",
                    "out_for_delivery",
                    "delivered"
                  ].map((step, index) => {
                    const current = getProgress(selectedOrder.status);

                    return (
                      <div
                        className={`customer-timeline-step ${index <= current ? "completed" : ""}`}
                        key={step}
                      >
                        <span>{index <= current ? <CheckCircle size={17} /> : index + 1}</span>
                        <p>{statusLabel(step)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <h3>Items</h3>

              <div className="customer-detail-items">
                {(selectedOrder.items || []).map((item, index) => (
                  <div key={`${item.product?._id || item.product || index}-${index}`}>
                    <div>
                      <strong>{item.productName || item.product?.name || "Product"}</strong>
                      <small>{item.shopName || "Local Shop"}</small>
                    </div>
                    <span>{item.quantity} × {money(item.price)}</span>
                  </div>
                ))}
              </div>

              <h3>Delivery Address</h3>
              <p className="customer-detail-address">
                {selectedOrder.deliveryAddress?.fullName},{" "}
                {selectedOrder.deliveryAddress?.phone},{" "}
                {selectedOrder.deliveryAddress?.address},{" "}
                {selectedOrder.deliveryAddress?.area},{" "}
                {selectedOrder.deliveryAddress?.city},{" "}
                {selectedOrder.deliveryAddress?.state} -{" "}
                {selectedOrder.deliveryAddress?.pincode}
              </p>

              <div className="customer-total-row">
                <span>Subtotal</span>
                <strong>{money(selectedOrder.subtotal)}</strong>
              </div>
              <div className="customer-total-row">
                <span>Delivery Fee</span>
                <strong>{money(selectedOrder.deliveryFee)}</strong>
              </div>
              <div className="customer-total-row customer-grand-total">
                <span>Total Amount</span>
                <strong>{money(selectedOrder.totalAmount)}</strong>
              </div>

              <div className="customer-total-row">
                <span>Payment Method</span>
                <strong>{String(selectedOrder.paymentMethod || "cod").toUpperCase()}</strong>
              </div>
              <div className="customer-total-row">
                <span>Payment Status</span>
                <strong>{statusLabel(selectedOrder.paymentStatus)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// -----------------------------------------
// ORDER CARD
// -----------------------------------------

function OrderCard({ order, onClick }) {
  return (
    <article className="customer-order-card">
      <div className="customer-order-card-top">
        <div>
          <strong>{order.orderNumber}</strong>
          <small>{formatDate(order.createdAt)}</small>
        </div>

        <span className={`customer-order-badge status-${order.status}`}>
          <StatusIconForCard status={order.status} />
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="customer-order-card-middle">
        <div>
          {(order.items || []).slice(0, 2).map((item, index) => (
            <p key={index}>
              {item.productName || item.product?.name || "Product"} × {item.quantity}
            </p>
          ))}
          {(order.items || []).length > 2 && (
            <small>+{order.items.length - 2} more items</small>
          )}
        </div>

        <strong>{money(order.totalAmount)}</strong>
      </div>

      <div className="customer-order-card-bottom">
        <span>
          {String(order.paymentMethod || "cod").toUpperCase()} · {statusLabel(order.paymentStatus)}
        </span>

        <button type="button" onClick={onClick}>
          View Details <ChevronRight size={15} />
        </button>
      </div>
    </article>
  );
}

function StatusIconForCard({ status }) {
  if (status === "delivered") return <CheckCircle size={14} />;
  if (status === "cancelled") return <XCircle size={14} />;
  if (status === "out_for_delivery") return <Truck size={14} />;
  return <Clock size={14} />;
}
