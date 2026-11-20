
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Package,
  Store,
  Users,
  RefreshCw,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bike,
  Search,
  UserRound,
  Ban,
  UserCheck,
  ClipboardList,
  MapPin,
  Phone,
  CalendarDays,
  IndianRupee
} from "lucide-react";

import FleetMap from "../components/FleetMap";
import "./admin-dashboard.css";

const API = "http://localhost:5000/api";

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("delivery");

  const [pendingDelivery, setPendingDelivery] = useState([]);
  const [pendingMerchants, setPendingMerchants] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");

  const [orders, setOrders] = useState([]);
  const [approvedPartners, setApprovedPartners] = useState([]);
  const [selectedPartners, setSelectedPartners] = useState({});

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const getHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem("sarathiToken")}`
  });

  const getJson = async (response, fallbackMessage) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || fallbackMessage);
    }

    return data;
  };

  // LOAD ADMIN APPROVAL DATA
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const headers = getHeaders();

      const [deliveryRes, merchantRes, productRes] =
        await Promise.all([
          fetch(`${API}/admin/delivery-partners/pending`, { headers }),
          fetch(`${API}/admin/merchants/pending`, { headers }),
          fetch(`${API}/products/admin/pending`, { headers })
        ]);

      const deliveryData = await getJson(
        deliveryRes,
        "Delivery partner loading failed."
      );

      const merchantData = await getJson(
        merchantRes,
        "Merchant loading failed."
      );

      const productData = await getJson(
        productRes,
        "Product loading failed."
      );

      setPendingDelivery(deliveryData.partners || []);
      setPendingMerchants(merchantData.merchants || []);

      const products =
        productData.products ||
        productData.data?.products ||
        productData.data ||
        [];

      setPendingProducts(Array.isArray(products) ? products : []);
    } catch (err) {
      setError(err.message || "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // LOAD CUSTOMERS
  const loadCustomers = useCallback(async (search = "") => {
    setCustomerLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/admin/customers?search=${encodeURIComponent(search)}`,
        { headers: getHeaders() }
      );

      const data = await getJson(response, "Unable to load customers.");
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message || "Customer loading failed.");
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  // LOAD ORDERS AND APPROVED PARTNERS
  const loadOrderManagement = useCallback(async () => {
    setOrderLoading(true);
    setError("");

    try {
      const headers = getHeaders();

      const [ordersRes, partnersRes] = await Promise.all([
        fetch(`${API}/orders`, { headers }),
        fetch(`${API}/admin/delivery-partners/approved`, { headers })
      ]);

      const ordersData = await getJson(
        ordersRes,
        "Unable to load orders."
      );

      const partnersData = await getJson(
        partnersRes,
        "Unable to load approved delivery partners."
      );

      setOrders(ordersData.orders || []);
      setApprovedPartners(partnersData.partners || []);
    } catch (err) {
      setError(err.message || "Unable to load order management data.");
    } finally {
      setOrderLoading(false);
    }
  }, []);

  // INITIAL LOAD
  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // CUSTOMER SEARCH
  useEffect(() => {
    if (activeTab !== "customers") return;

    const timer = setTimeout(() => {
      loadCustomers(customerSearch);
    }, 350);

    return () => clearTimeout(timer);
  }, [activeTab, customerSearch, loadCustomers]);

  // ORDER TAB LOAD
  useEffect(() => {
    if (activeTab === "orders") {
      loadOrderManagement();
    }
  }, [activeTab, loadOrderManagement]);

  // APPROVE OR REJECT ACCOUNTS
  const reviewAccount = async (id, role, status) => {
    let reason = "";

    if (status === "rejected") {
      reason = window.prompt("Enter rejection reason:") || "";
      if (!reason.trim()) return;
    }

    setBusyId(id);
    setError("");

    const endpoint =
      role === "delivery"
        ? `${API}/admin/delivery-partners/${id}/review`
        : `${API}/admin/merchants/${id}/review`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status, reason })
      });

      await getJson(response, "Account review failed.");

      if (role === "delivery") {
        setPendingDelivery(items =>
          items.filter(item => item._id !== id)
        );
      } else {
        setPendingMerchants(items =>
          items.filter(item => item._id !== id)
        );
      }
    } catch (err) {
      setError(err.message || "Account review failed.");
    } finally {
      setBusyId("");
    }
  };

  // APPROVE OR REJECT PRODUCTS
  const reviewProduct = async (id, status) => {
    let rejectionReason = "";

    if (status === "rejected") {
      rejectionReason =
        window.prompt("Enter product rejection reason:") || "";

      if (!rejectionReason.trim()) return;
    }

    setBusyId(id);
    setError("");

    try {
      const response = await fetch(`${API}/products/${id}/status`, {
        method: "PATCH",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status, rejectionReason })
      });

      await getJson(response, "Product review failed.");

      setPendingProducts(items =>
        items.filter(item => item._id !== id)
      );
    } catch (err) {
      setError(err.message || "Product review failed.");
    } finally {
      setBusyId("");
    }
  };

  // SUSPEND OR REACTIVATE CUSTOMERS
  const updateCustomerStatus = async customer => {
    const newStatus =
      customer.accountStatus === "active" ? "suspended" : "active";

    let reason = "";

    if (newStatus === "suspended") {
      reason =
        window.prompt(
          `Why are you suspending ${customer.name}?`
        ) || "";

      if (!reason.trim()) return;
    } else {
      const confirmed = window.confirm(
        `Reactivate ${customer.name}'s account?`
      );

      if (!confirmed) return;
    }

    setBusyId(customer._id);
    setError("");

    try {
      const response = await fetch(
        `${API}/admin/customers/${customer._id}/status`,
        {
          method: "PATCH",
          headers: {
            ...getHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: newStatus,
            reason
          })
        }
      );

      await getJson(response, "Unable to update customer.");

      setCustomers(items =>
        items.map(item =>
          item._id === customer._id
            ? {
                ...item,
                accountStatus: newStatus,
                accountReviewReason:
                  newStatus === "suspended" ? reason : ""
              }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Customer update failed.");
    } finally {
      setBusyId("");
    }
  };

  // ASSIGN DELIVERY PARTNER
  const assignOrder = async order => {
    const partnerId = selectedPartners[order._id];

    if (!partnerId) {
      setError("Please select a delivery partner first.");
      return;
    }

    setBusyId(order._id);
    setError("");

    try {
      const response = await fetch(
        `${API}/orders/${order._id}/assign-delivery`,
        {
          method: "PATCH",
          headers: {
            ...getHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deliveryPartnerId: partnerId
          })
        }
      );

      await getJson(response, "Unable to assign delivery partner.");

      await loadOrderManagement();
    } catch (err) {
      setError(err.message || "Delivery partner assignment failed.");
    } finally {
      setBusyId("");
    }
  };

  // REFRESH
  const refreshDashboard = () => {
    loadAdminData();

    if (activeTab === "customers") {
      loadCustomers(customerSearch);
    }

    if (activeTab === "orders") {
      loadOrderManagement();
    }
  };

  // HELPERS
  const formatDate = date => {
    if (!date) return "Unavailable";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const formatStatus = status => {
    if (!status) return "Unknown";

    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  };

  const canAssignOrder = status =>
    ["confirmed", "preparing", "ready_for_pickup"].includes(status);

  // ORDER FILTERING
  const filteredOrders = orders.filter(order => {
    const search = orderSearch.trim().toLowerCase();

    const matchesSearch =
      !search ||
      [
        order.orderNumber,
        order.customer?.name,
        order.customer?.email,
        order.customer?.phone,
        order.deliveryAddress?.phone,
        order.deliveryAddress?.address,
        order.deliveryAddress?.area,
        order.deliveryAddress?.city
      ].some(value =>
        String(value || "").toLowerCase().includes(search)
      );

    const matchesStatus =
      orderStatusFilter === "all" ||
      order.status === orderStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // ORDER STATISTICS
  const orderStats = {
    total: orders.length,
    confirmed: orders.filter(o => o.status === "confirmed").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    active: orders.filter(o =>
      ["accepted", "picked_up", "out_for_delivery"].includes(o.status)
    ).length,
    delivered: orders.filter(o => o.status === "delivered").length
  };

  const tabs = [
    {
      id: "delivery",
      label: "Delivery partners",
      icon: Bike,
      count: pendingDelivery.length
    },
    {
      id: "merchants",
      label: "Merchants",
      icon: Store,
      count: pendingMerchants.length
    },
    {
      id: "products",
      label: "Products",
      icon: Package,
      count: pendingProducts.length
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      count: customers.length
    },
    {
      id: "orders",
      label: "Order Management",
      icon: ClipboardList,
      count: orders.length
    }
  ];

  const totalPending =
    pendingDelivery.length +
    pendingMerchants.length +
    pendingProducts.length;

  // ACCOUNT CARD
  const renderAccountCard = (account, role) => (
    <article className="admin-product" key={account._id}>
      <div className="admin-product-placeholder">
        {role === "delivery" ? <Bike /> : <Store />}
      </div>

      <div className="admin-product-info">
        <strong>{account.name}</strong>
        <span>{account.email}</span>
        <span>Phone: {account.phone || "Not provided"}</span>
        <span>Registered: {formatDate(account.createdAt)}</span>
        <p>Account status: <b>Pending approval</b></p>
      </div>

      <div className="admin-product-actions">
        <button
          disabled={busyId === account._id}
          onClick={() => reviewAccount(account._id, role, "approved")}
          className="approve"
        >
          <CheckCircle2 size={16} />
          Approve
        </button>

        <button
          disabled={busyId === account._id}
          onClick={() => reviewAccount(account._id, role, "rejected")}
          className="reject"
        >
          <XCircle size={16} />
          Reject
        </button>
      </div>
    </article>
  );

  // STRUCTURED ORDER CARD
  const renderOrderCard = order => {
    const assignedPartner = order.assignedDeliveryPartner;
    const assignable = canAssignOrder(order.status);
    const address = order.deliveryAddress || {};

    return (
      <article className="admin-order-card" key={order._id}>
        <div className="admin-order-heading">
          <div>
            <span className="admin-order-label">ORDER NUMBER</span>
            <h3>{order.orderNumber || "Order"}</h3>
            <small>
              <CalendarDays size={13} />
              {formatDate(order.createdAt)}
            </small>
          </div>

          <span className={`admin-order-status ${order.status || "unknown"}`}>
            {formatStatus(order.status)}
          </span>
        </div>

        <div className="admin-order-grid">
          <section className="admin-order-section">
            <h4><UserRound size={16} /> Customer information</h4>
            <strong>{order.customer?.name || "Customer"}</strong>
            <span>{order.customer?.email || "Email unavailable"}</span>
            <span>
              <Phone size={14} />
              {address.phone || order.customer?.phone || "Phone unavailable"}
            </span>
          </section>

          <section className="admin-order-section">
            <h4><MapPin size={16} /> Delivery address</h4>
            <strong>{address.fullName || order.customer?.name || "Recipient"}</strong>
            <span>{address.address || "Address unavailable"}</span>
            <span>
              {[
                address.area,
                address.city,
                address.state,
                address.pincode
              ].filter(Boolean).join(", ") || "Location unavailable"}
            </span>
          </section>

          <section className="admin-order-section">
            <h4><IndianRupee size={16} /> Payment summary</h4>
            <strong className="admin-order-total">
              ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
            </strong>
            <span>
              Method: {(order.paymentMethod || "N/A").toUpperCase()}
            </span>
            <span>Payment: {formatStatus(order.paymentStatus)}</span>
          </section>
        </div>

        <div className="admin-order-items">
          <div className="admin-order-section-title">
            <h4><Package size={16} /> Order items</h4>
            <span>{order.items?.length || 0} item type(s)</span>
          </div>

          {order.items?.length ? (
            <div className="admin-order-item-list">
              {order.items.map((item, index) => (
                <div
                  className="admin-order-item"
                  key={item._id || `${order._id}-${index}`}
                >
                  <div className="admin-order-item-name">
                    <strong>
                      {item.productName || item.product?.name || "Product"}
                    </strong>
                    <small>
                      {formatStatus(item.merchantStatus || "pending")}
                    </small>
                  </div>

                  <span>
                    {item.quantity} × ₹
                    {Number(item.price || 0).toLocaleString("en-IN")}
                  </span>

                  <strong>
                    ₹{Number(
                      item.subtotal ?? (item.quantity * item.price) ?? 0
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <span className="admin-muted">No item details available.</span>
          )}
        </div>

        <div className="admin-order-assignment">
          <div className="admin-assigned-info">
            <h4><Bike size={16} /> Delivery partner</h4>

            {assignedPartner?._id ? (
              <span className="admin-assigned-partner">
                {assignedPartner.name || "Assigned partner"}
                {assignedPartner.phone
                  ? ` · ${assignedPartner.phone}`
                  : ""}
              </span>
            ) : (
              <span className="admin-unassigned">
                No delivery partner assigned
              </span>
            )}
          </div>

          {assignable ? (
            <div className="admin-assignment-controls">
              <select
                value={selectedPartners[order._id] || ""}
                onChange={event =>
                  setSelectedPartners(previous => ({
                    ...previous,
                    [order._id]: event.target.value
                  }))
                }
                disabled={busyId === order._id}
              >
                <option value="">Select approved partner</option>

                {approvedPartners.map(partner => (
                  <option key={partner._id} value={partner._id}>
                    {partner.name}
                    {partner.phone ? ` — ${partner.phone}` : ""}
                  </option>
                ))}
              </select>

              <button
                className="admin-assign-btn"
                disabled={
                  busyId === order._id ||
                  !selectedPartners[order._id]
                }
                onClick={() => assignOrder(order)}
              >
                <Bike size={15} />
                {busyId === order._id
                  ? "Assigning..."
                  : assignedPartner?._id
                    ? "Change partner"
                    : "Assign partner"}
              </button>
            </div>
          ) : (
            <span className="admin-assignment-note">
              {order.status === "delivered"
                ? "This order has been delivered."
                : order.status === "cancelled"
                  ? "This order has been cancelled."
                  : "Partner assignment is available after merchant confirmation."}
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          SARATHI<span>.</span>
        </Link>

        <div className="admin-side-label">ADMINISTRATION</div>

        {tabs.map(tab => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              className={`admin-side-link ${
                activeTab === tab.id ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              {tab.id === "delivery"
                ? "Overview & approvals"
                : tab.label}

              {tab.id === "orders" && (
                <span className="admin-side-count">{orders.length}</span>
              )}
            </button>
          );
        })}

        <div className="admin-sidebar-bottom">
          <div className="admin-user">
            <div className="admin-avatar">
              {(user?.name || "A").charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{user?.name || "Administrator"}</strong>
              <small>Administrator</small>
            </div>
          </div>

          <button className="admin-logout" onClick={onLogout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">SARATHI CONTROL CENTER</span>
            <h1>Admin Dashboard</h1>
          </div>

          <button
            className="admin-refresh"
            onClick={refreshDashboard}
            disabled={loading || customerLoading || orderLoading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <section className="admin-welcome">
          <div>
            <h2>Welcome, {user?.name || "Administrator"}</h2>
            <p>
              Manage users, partners, orders and the SARATHI marketplace.
            </p>
          </div>
          <ShieldCheck size={42} />
        </section>

        <FleetMap />

        {error && (
          <div className="admin-error">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className="admin-stats">
          <article className="admin-stat-card">
            <span className="admin-stat-icon orange"><Bike /></span>
            <div>
              <small>Pending delivery partners</small>
              <strong>{loading ? "—" : pendingDelivery.length}</strong>
            </div>
          </article>

          <article className="admin-stat-card">
            <span className="admin-stat-icon green"><Store /></span>
            <div>
              <small>Pending merchants</small>
              <strong>{loading ? "—" : pendingMerchants.length}</strong>
            </div>
          </article>

          <article className="admin-stat-card">
            <span className="admin-stat-icon blue"><Package /></span>
            <div>
              <small>Pending products</small>
              <strong>{loading ? "—" : pendingProducts.length}</strong>
            </div>
          </article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">MANAGEMENT CENTER</span>
              <h2>{tabs.find(tab => tab.id === activeTab)?.label}</h2>
            </div>

            <span className="admin-count">
              {activeTab === "customers"
                ? `${customers.length} customers`
                : activeTab === "orders"
                  ? `${orders.length} orders`
                  : `${totalPending} pending`}
            </span>
          </div>

          {activeTab === "customers" && (
            <div className="admin-customer-search">
              <Search size={19} />
              <input
                type="text"
                value={customerSearch}
                onChange={event => setCustomerSearch(event.target.value)}
                placeholder="Search by customer name, email or phone..."
              />
              {customerSearch && (
                <button onClick={() => setCustomerSearch("")}>Clear</button>
              )}
            </div>
          )}

          <div className="admin-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  className={`admin-tab ${
                    activeTab === tab.id ? "active" : ""
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={17} />
                  {tab.label}
                  <span>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {(loading &&
            ["delivery", "merchants", "products"].includes(activeTab)) ||
          (customerLoading && activeTab === "customers") ||
          (orderLoading && activeTab === "orders") ? (
            <div className="admin-empty">
              <RefreshCw size={25} className="admin-loading-icon" />
              <strong>Loading SARATHI data...</strong>
            </div>
          ) : (
            <>
              {activeTab === "delivery" && (
                pendingDelivery.length === 0 ? (
                  <div className="admin-empty">
                    <CheckCircle2 size={30} />
                    <strong>No pending delivery partners</strong>
                    <span>New applications will appear here.</span>
                  </div>
                ) : (
                  <div className="admin-product-list">
                    {pendingDelivery.map(account =>
                      renderAccountCard(account, "delivery")
                    )}
                  </div>
                )
              )}

              {activeTab === "merchants" && (
                pendingMerchants.length === 0 ? (
                  <div className="admin-empty">
                    <CheckCircle2 size={30} />
                    <strong>No pending merchants</strong>
                    <span>New merchant applications will appear here.</span>
                  </div>
                ) : (
                  <div className="admin-product-list">
                    {pendingMerchants.map(account =>
                      renderAccountCard(account, "merchant")
                    )}
                  </div>
                )
              )}

              {activeTab === "products" && (
                pendingProducts.length === 0 ? (
                  <div className="admin-empty">
                    <CheckCircle2 size={30} />
                    <strong>No pending products</strong>
                    <span>New product submissions will appear here.</span>
                  </div>
                ) : (
                  <div className="admin-product-list">
                    {pendingProducts.map(product => (
                      <article className="admin-product" key={product._id}>
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} />
                        ) : (
                          <div className="admin-product-placeholder">
                            <Package />
                          </div>
                        )}

                        <div className="admin-product-info">
                          <strong>{product.name}</strong>
                          <span>
                            {product.shopName} · {product.category}
                          </span>
                          <span>
                            {product.location?.city || "Location unavailable"}
                            {" · "}₹{product.price}
                          </span>
                          <p>{product.description}</p>
                        </div>

                        <div className="admin-product-actions">
                          <button
                            disabled={busyId === product._id}
                            onClick={() =>
                              reviewProduct(product._id, "approved")
                            }
                            className="approve"
                          >
                            <CheckCircle2 size={16} />
                            Approve
                          </button>

                          <button
                            disabled={busyId === product._id}
                            onClick={() =>
                              reviewProduct(product._id, "rejected")
                            }
                            className="reject"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {activeTab === "customers" && (
                customers.length === 0 ? (
                  <div className="admin-empty">
                    <Users size={30} />
                    <strong>No customers found</strong>
                    <span>Registered customers will appear here.</span>
                  </div>
                ) : (
                  <div className="admin-customer-list">
                    {customers.map(customer => (
                      <article
                        className="admin-customer-card"
                        key={customer._id}
                      >
                        <div className="admin-customer-avatar">
                          <UserRound size={23} />
                        </div>

                        <div className="admin-customer-info">
                          <strong>{customer.name}</strong>
                          <span>{customer.email}</span>
                          <span>
                            Phone: {customer.phone || "Not provided"}
                          </span>
                          <span>Joined: {formatDate(customer.createdAt)}</span>
                        </div>

                        <div className="admin-customer-actions">
                          <span className={`admin-status ${customer.accountStatus}`}>
                            {customer.accountStatus}
                          </span>

                          {customer.accountStatus === "active" && (
                            <button
                              className="admin-suspend-btn"
                              disabled={busyId === customer._id}
                              onClick={() => updateCustomerStatus(customer)}
                            >
                              <Ban size={15} />
                              Suspend
                            </button>
                          )}

                          {customer.accountStatus === "suspended" && (
                            <button
                              className="admin-reactivate-btn"
                              disabled={busyId === customer._id}
                              onClick={() => updateCustomerStatus(customer)}
                            >
                              <UserCheck size={15} />
                              Reactivate
                            </button>
                          )}

                          {customer.accountStatus === "pending" && (
                            <span className="admin-status pending">
                              Verification pending
                            </span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}

              {/* STRUCTURED ORDER MANAGEMENT */}
              {activeTab === "orders" && (
                <div className="admin-orders-workspace">
                  <div className="admin-order-summary">
                    <article>
                      <span>Total orders</span>
                      <strong>{orderStats.total}</strong>
                    </article>
                    <article>
                      <span>Confirmed</span>
                      <strong>{orderStats.confirmed}</strong>
                    </article>
                    <article>
                      <span>Preparing</span>
                      <strong>{orderStats.preparing}</strong>
                    </article>
                    <article>
                      <span>Active deliveries</span>
                      <strong>{orderStats.active}</strong>
                    </article>
                    <article>
                      <span>Delivered</span>
                      <strong>{orderStats.delivered}</strong>
                    </article>
                  </div>

                  <div className="admin-order-toolbar">
                    <div className="admin-order-search">
                      <Search size={18} />
                      <input
                        value={orderSearch}
                        onChange={event => setOrderSearch(event.target.value)}
                        placeholder="Search order number, customer, phone or address..."
                      />
                      {orderSearch && (
                        <button onClick={() => setOrderSearch("")}>
                          Clear
                        </button>
                      )}
                    </div>

                    <select
                      className="admin-order-filter"
                      value={orderStatusFilter}
                      onChange={event =>
                        setOrderStatusFilter(event.target.value)
                      }
                    >
                      <option value="all">All statuses</option>
                      {[
                        "pending",
                        "confirmed",
                        "preparing",
                        "ready_for_pickup",
                        "accepted",
                        "picked_up",
                        "out_for_delivery",
                        "delivered",
                        "cancelled"
                      ].map(status => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-order-results-heading">
                    <strong>Orders</strong>
                    <span>
                      Showing {filteredOrders.length} of {orders.length}
                    </span>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="admin-empty">
                      <ClipboardList size={30} />
                      <strong>No matching orders</strong>
                      <span>Try another search term or status filter.</span>
                    </div>
                  ) : (
                    <div className="admin-order-list">
                      {filteredOrders.map(renderOrderCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="admin-footer">
          © 2026 SARATHI · More Than Just Delivery
        </footer>
      </main>
    </div>
  );
}
