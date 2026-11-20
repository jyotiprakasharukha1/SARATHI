
import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import CustomerDashboard from "./pages/CustomerDashboard";
import MerchantDashboard from "./pages/MerchantDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AuthModal from "./AuthModal";

import {
  Search,
  MapPin,
  ShoppingCart,
  UserRound,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Utensils,
  ShoppingBasket,
  Store,
  Package,
  FileText,
  Gift,
  Smartphone,
  Shirt,
  Bike,
  Clock,
  ShieldCheck,
  Truck,
  Star,
  Plus,
  Minus,
  Heart,
  Navigation,
  Sparkles,
  LogOut,
  CheckCircle,
  CreditCard
} from "lucide-react";

import "./App.css";

const API_URL = "http://10.46.94.173:5000";
const AUTH_API = `${API_URL}/api/auth`;
const PRODUCT_API = `${API_URL}/api/products`;
const ORDER_API = `${API_URL}/api/orders`;


// Customer location selector. Kept in this file so the homepage is self-contained.
function LocationPicker({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectCurrentLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async position => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        let label = "My current location";

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};
            label = [
              address.suburb || address.neighbourhood || address.village ||
                address.town || address.city,
              address.state_district || address.state
            ].filter(Boolean).join(", ") || data.display_name?.split(",").slice(0, 2).join(", ") || label;
          }
        } catch (lookupError) {
          console.warn("Reverse geocoding failed:", lookupError);
        }

        onSelect({ label, latitude, longitude });
        setOpen(false);
        setLoading(false);
      },
      geoError => {
        setLoading(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("Location permission was denied. Allow location access in your browser.");
        } else if (geoError.code === geoError.TIMEOUT) {
          setError("GPS request timed out. Please try again.");
        } else {
          setError("Unable to determine your location. Check your GPS or network.");
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  };

  const searchAddress = async event => {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter an area, city or address.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&q=${encodeURIComponent(query.trim())}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Address search is temporarily unavailable.");
      const results = await response.json();
      if (!results.length) throw new Error("No matching location found. Try a nearby area or city.");

      const result = results[0];
      onSelect({
        label: result.display_name.split(",").slice(0, 3).join(", "),
        latitude: Number(result.lat),
        longitude: Number(result.lon)
      });
      setOpen(false);
    } catch (searchError) {
      setError(searchError.message || "Unable to search this address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="delivery-location location-picker-trigger"
        onClick={() => { setOpen(true); setError(""); }}
        aria-label="Choose delivery location"
      >
        <MapPin size={19} />
        <span className="location-picker-label">
          <small>DELIVERING TO</small>
          <strong>{value?.label || "Select your location"}</strong>
        </span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div
          className="location-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <section
            className="location-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="location-modal-heading">
              <div>
                <span>DELIVERY LOCATION</span>
                <h2 id="location-modal-title">Where should we deliver?</h2>
                <p>Choose your location to discover nearby shops and products.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close location picker">
                <X size={21} />
              </button>
            </div>

            <button
              type="button"
              className="location-gps-action"
              onClick={selectCurrentLocation}
              disabled={loading}
            >
              <Navigation size={18} />
              {loading ? "Finding location..." : "Use my current location"}
            </button>

            <div className="location-or">OR SEARCH MANUALLY</div>

            <form className="location-search-form" onSubmit={searchAddress}>
              <MapPin size={18} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Enter area, city or pincode"
                autoFocus
              />
              <button type="submit" disabled={loading}>
                Search
              </button>
            </form>

            {error && <p className="location-picker-error" role="alert">{error}</p>}
            <p className="location-picker-note">
              Location access works on HTTPS websites or localhost. Address search uses OpenStreetMap.
            </p>
          </section>
        </div>
      )}
    </>
  );
}

// ========================================
// SERVICE CATEGORIES
// ========================================

const services = [
  { name: "Food", icon: Utensils, color: "orange" },
  { name: "Grocery", icon: ShoppingBasket, color: "green" },
  { name: "Local Shops", icon: Store, color: "purple" },
  { name: "Parcel", icon: Package, color: "blue" },
  { name: "Documents", icon: FileText, color: "pink" },
  { name: "Gifts", icon: Gift, color: "red" },
  { name: "Electronics", icon: Smartphone, color: "yellow" },
  { name: "Fashion", icon: Shirt, color: "purple" },
  { name: "Bike Ride", icon: Bike, color: "green" }
];

// Temporary shop cards.
// These can be connected to your merchant API later.
const shops = [
  {
    name: "Fresh Mart",
    type: "Groceries & Vegetables",
    time: "15–25 min",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600"
  },
  {
    name: "Food Junction",
    type: "Restaurant & Fast Food",
    time: "20–30 min",
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600"
  },
  {
    name: "Daily Needs",
    type: "Supermarket",
    time: "15–20 min",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=600"
  }
];

// ========================================
// APP
// ========================================

function App() {
  // Homepage
  const [location, setLocation] = useState("");
  const [customerCoordinates, setCustomerCoordinates] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Cart
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  // Checkout
  const [showCheckout, setShowCheckout] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState(null);

  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    area: "",
    city: "",
    state: "Odisha",
    pincode: "",
    landmark: "",
    latitude: null,
    longitude: null,
    paymentMethod: "cod"
  });

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationError, setLocationError] = useState("");

  // Authentication
  const [showAccount, setShowAccount] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [authMode, setAuthMode] = useState("register");

  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Products
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  // ========================================
  // AUTHENTICATION
  // ========================================

  const loadProfile = async () => {
    const token = sessionStorage.getItem("sarathiToken");

    if (!token) {
      setCurrentUser(null);
      setAuthChecking(false);
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem("sarathiToken");
          localStorage.removeItem("sarathiUser");
          setCurrentUser(null);
        }

        return;
      }

      const user =
        data.user ||
        data.data?.user ||
        data.profile ||
        null;

      if (user) {
        setCurrentUser(user);

        // This is only a profile cache, not the authentication token.
        localStorage.setItem("sarathiUser", JSON.stringify(user));
      }
    } catch (error) {
      console.error("Unable to restore SARATHI session:", error);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("sarathiToken");
    localStorage.removeItem("sarathiUser");

    setCurrentUser(null);
    setShowAccount(false);
    setShowCart(false);
    setShowCheckout(false);
    setMobileMenu(false);
  };

  const handleAuthModalClose = () => {
    setShowAccount(false);
    loadProfile();
  };

  // ========================================
  // FETCH PRODUCTS
  // ========================================

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      setProductsError("");

      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        radiusKm: String(radiusKm)
      });

      if (customerCoordinates) {
        params.set("latitude", String(customerCoordinates.latitude));
        params.set("longitude", String(customerCoordinates.longitude));
      }

      const response = await fetch(`${PRODUCT_API}?${params.toString()}`);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load marketplace products."
        );
      }

      const formattedProducts = (data.products || []).map(product => ({
        id: product._id,
        productId: product._id,
        name: product.name || "Unnamed Product",
        shop:
          product.shopName ||
          product.merchant?.name ||
          "Local Shop",
        price: Number(product.price || 0),
        oldPrice: product.oldPrice,
        category: product.category || "Local Shops",
        image: product.images?.[0] || "",
        rating: product.rating || null,
        stock: Number(product.stock || 0),
        distanceKm: Number.isFinite(Number(product.distanceKm))
          ? Number(product.distanceKm)
          : null
      }));

      setProducts(formattedProducts);
    } catch (error) {
      console.error("Product loading error:", error);
      setProducts([]);
      setProductsError(error.message);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // Reload the marketplace when the selected location or radius changes.
  }, [customerCoordinates, radiusKm]);

  // ========================================
  // PRODUCT SEARCH AND FILTERING
  // ========================================

  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return products.filter(product => {
      const matchesCategory =
        activeCategory === "All" ||
        product.category === activeCategory;

      const matchesSearch =
        product.name.toLowerCase().includes(searchText) ||
        product.shop.toLowerCase().includes(searchText);

      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  // ========================================
  // CART FUNCTIONS
  // ========================================

  const addToCart = product => {
    setCart(current => {
      const existing = current.find(
        item => item.id === product.id
      );

      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Only ${product.stock} units are available.`);
          return current;
        }

        return current.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        );
      }

      if (product.stock <= 0) {
        alert("This product is currently out of stock.");
        return current;
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1
        }
      ];
    });
  };

  const updateQuantity = (id, amount) => {
    setCart(current =>
      current
        .map(item => {
          if (item.id !== id) return item;

          const newQuantity = item.quantity + amount;

          if (newQuantity > item.stock) {
            alert(`Only ${item.stock} units are available.`);
            return item;
          }

          return {
            ...item,
            quantity: newQuantity
          };
        })
        .filter(item => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // ========================================
  // CHECKOUT FORM
  // ========================================

  const updateCheckoutField = event => {
    const { name, value } = event.target;

    setCheckoutForm(previous => ({
      ...previous,
      [name]: value
    }));
  };

  const getCustomerCurrentLocation = () => {
    setLocationError("");
    setLocationMessage("");

    if (!navigator.geolocation) {
      setLocationError("This browser does not support location access.");
      return;
    }

    setLocationLoading(true);
    setLocationMessage("Requesting your current location...");

    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = Number(position.coords.latitude.toFixed(7));
        const longitude = Number(position.coords.longitude.toFixed(7));

        setCheckoutForm(previous => ({
          ...previous,
          latitude,
          longitude
        }));

        setLocationLoading(false);
        setLocationMessage("Your delivery GPS location has been captured.");
      },
      error => {
        let message = "Unable to get your location. Please allow location access and try again.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission was denied. Allow location access in your browser settings and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your current location is unavailable. Check your device GPS or network and try again.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Please try again.";
        }

        setLocationLoading(false);
        setLocationMessage("");
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const openCheckout = () => {
    setCheckoutError("");
    setLocationError("");
    setLocationMessage("");
    setOrderConfirmation(null);

    if (!currentUser) {
      setShowCart(false);
      setAuthMode("login");
      setShowAccount(true);
      return;
    }

    if (currentUser.role !== "customer") {
      alert("Please log in with a customer account to place an order.");
      return;
    }

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    setShowCheckout(true);
  };

  // ========================================
  // PLACE ORDER
  // ========================================

  const handlePlaceOrder = async event => {
    event.preventDefault();

    setCheckoutError("");

    if (!checkoutForm.fullName.trim()) {
      setCheckoutError("Please enter your full name.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(checkoutForm.phone)) {
      setCheckoutError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!checkoutForm.address.trim()) {
      setCheckoutError("Please enter your complete address.");
      return;
    }

    if (!checkoutForm.city.trim()) {
      setCheckoutError("Please enter your city.");
      return;
    }

    if (!/^\d{6}$/.test(checkoutForm.pincode)) {
      setCheckoutError("Enter a valid 6-digit pincode.");
      return;
    }

    if (
      !Number.isFinite(checkoutForm.latitude) ||
      !Number.isFinite(checkoutForm.longitude) ||
      checkoutForm.latitude < -90 || checkoutForm.latitude > 90 ||
      checkoutForm.longitude < -180 || checkoutForm.longitude > 180
    ) {
      setCheckoutError("Please capture your delivery location using the Use my current location button.");
      return;
    }

    if (cart.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    if (checkoutForm.paymentMethod !== "cod") {
      setCheckoutError(
        "Online payment is not available yet. Please select Cash on Delivery."
      );
      return;
    }

    const token = sessionStorage.getItem("sarathiToken");

    if (!token) {
      setCheckoutError("Your login session has expired. Please log in again.");
      return;
    }

    try {
      setPlacingOrder(true);

      const response = await fetch(ORDER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({
              productId: item.productId || item.id,
              quantity: Number(item.quantity)
            })),
          deliveryAddress: {
            fullName: checkoutForm.fullName.trim(),
            phone: checkoutForm.phone,
            address: checkoutForm.address.trim(),
            area: checkoutForm.area.trim(),
            city: checkoutForm.city.trim(),
            state: checkoutForm.state.trim(),
            pincode: checkoutForm.pincode,
            landmark: checkoutForm.landmark.trim(),
            latitude: checkoutForm.latitude,
            longitude: checkoutForm.longitude
          },
          paymentMethod: "cod"
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to place your order."
        );
      }

      if (!data.order) {
        throw new Error(
          "The server did not return the created order."
        );
      }

      setOrderConfirmation(data.order);
      setCart([]);
      setCheckoutForm({
        fullName: "",
        phone: "",
        address: "",
        area: "",
        city: "",
        state: "Odisha",
        pincode: "",
        landmark: "",
        latitude: null,
        longitude: null,
        paymentMethod: "cod"
      });
      setLocationMessage("");
      setLocationError("");

      // Refresh product stock after successful order.
      fetchProducts();
    } catch (error) {
      console.error("Checkout error:", error);
      setCheckoutError(error.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const closeCheckout = () => {
    if (placingOrder) return;

    setShowCheckout(false);
    setCheckoutError("");
    setOrderConfirmation(null);
  };

  // ========================================
  // NAVIGATION HELPERS
  // ========================================

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });

    setMobileMenu(false);
  };

  const selectCategory = category => {
    setActiveCategory(category);
    setSearch("");
    scrollTo("products");
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="sarathi">
            <style>{`
              .location-picker-trigger {
                border: 0;
                background: transparent;
                color: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                text-align: left;
                min-width: 0;
              }
              .location-picker-label {
                display: flex;
                flex-direction: column;
                min-width: 0;
              }
              .location-picker-label strong {
                max-width: 190px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .location-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 10000;
                background: rgba(15, 23, 42, .58);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
              }
              .location-modal {
                width: min(100%, 520px);
                background: #fff;
                color: #172033;
                border-radius: 20px;
                padding: 26px;
                box-shadow: 0 24px 80px rgba(0,0,0,.25);
              }
              .location-modal-heading {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 22px;
              }
              .location-modal-heading span {
                color: #16a36a;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.2px;
              }
              .location-modal-heading h2 {
                margin: 7px 0;
                font-size: 23px;
              }
              .location-modal-heading p, .location-picker-note {
                color: #64748b;
                font-size: 13px;
                line-height: 1.5;
                margin: 0;
              }
              .location-modal-heading > button {
                border: 0;
                background: #f1f5f9;
                border-radius: 10px;
                width: 38px;
                height: 38px;
                flex: 0 0 38px;
                cursor: pointer;
              }
              .location-gps-action {
                width: 100%;
                border: 0;
                border-radius: 12px;
                padding: 14px;
                background: #087f56;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 9px;
                font-weight: 700;
                cursor: pointer;
              }
              .location-gps-action:disabled, .location-search-form button:disabled {
                opacity: .6;
                cursor: wait;
              }
              .location-or {
                text-align: center;
                color: #94a3b8;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                margin: 20px 0 12px;
              }
              .location-search-form {
                display: flex;
                align-items: center;
                gap: 9px;
                border: 1px solid #dbe3ec;
                border-radius: 12px;
                padding: 6px 7px 6px 12px;
              }
              .location-search-form input {
                border: 0;
                outline: 0;
                min-width: 0;
                flex: 1;
                padding: 10px 0;
                color: #172033;
              }
              .location-search-form button {
                border: 0;
                border-radius: 9px;
                background: #172033;
                color: white;
                padding: 10px 15px;
                cursor: pointer;
                font-weight: 700;
              }
              .location-picker-error {
                color: #dc2626;
                font-size: 13px;
                margin: 12px 0;
              }
              .location-picker-note { margin-top: 15px; }
              .sarathi-radius-control {
                display: flex;
                align-items: center;
                gap: 9px;
                white-space: nowrap;
              }
              .sarathi-radius-control label {
                color: #64748b;
                font-size: 13px;
                font-weight: 600;
              }
              .sarathi-radius-control select {
                border: 1px solid #dbe3ec;
                border-radius: 9px;
                padding: 10px 12px;
                background: white;
                color: #172033;
              }
              .sarathi-product-distance {
                display: flex;
                align-items: center;
                gap: 4px;
                color: #0b8a5b;
                font-size: 12px;
                font-weight: 700;
                margin-top: 5px;
              }
              @media (max-width: 850px) {
                .topbar .location-picker-trigger {
                  display: flex !important;
                  max-width: 42vw;
                }
                .location-picker-label strong { max-width: 27vw; }
              }
              @media (max-width: 560px) {
                .location-modal { padding: 20px; }
                .location-modal-heading h2 { font-size: 19px; }
                .sarathi-radius-control { width: 100%; }
              }
            `}</style>

            {/* =================================
                NAVBAR
            ================================= */}

            <header className="topbar">
              <a className="brand" href="#home">
                SARATHI<span>.</span>
                <small>MORE THAN JUST DELIVERY</small>
              </a>

              <LocationPicker
                value={{ label: location }}
                onSelect={selected => {
                  setLocation(selected.label);
                  setCustomerCoordinates({
                    latitude: selected.latitude,
                    longitude: selected.longitude
                  });
                }}
              />

              <div className="desktop-nav">
                <a href="#home">Home</a>
                <a href="#services">Services</a>
                <a href="#shops">Explore Shops</a>
                <a href="#partner">Partner with us</a>
              </div>

              <div className="nav-buttons">
                <button
                  className="icon-button cart-button"
                  onClick={() => setShowCart(true)}
                >
                  <ShoppingCart size={19} />
                  <span>Cart</span>

                  {cartCount > 0 && (
                    <b>{cartCount}</b>
                  )}
                </button>

                {currentUser ? (
                  <div className="sarathi-user-session">
                    <span className="sarathi-user-greeting">
                      <UserRound size={17} />
                      Hi,{" "}
                      {currentUser.name ||
                        currentUser.fullName ||
                        "User"}
                    </span>

                    <Link
                      className="login-button"
                      to={
                        currentUser.role === "merchant"
                          ? "/merchant/dashboard"
                          : currentUser.role === "delivery"
                          ? "/delivery/dashboard"
                          : currentUser.role === "admin"
                          ? "/admin/dashboard"
                          : "/customer/dashboard"
                      }
                    >
                      Dashboard
                    </Link>

                    <button
                      className="login-button"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="login-button"
                      onClick={() => {
                        setAuthMode("login");
                        setShowAccount(true);
                      }}
                      disabled={authChecking}
                    >
                      Login
                    </button>

                    <button
                      className="register-button"
                      onClick={() => {
                        setAuthMode("register");
                        setShowAccount(true);
                      }}
                      disabled={authChecking}
                    >
                      Register <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </div>

              <button
                className="mobile-toggle"
                onClick={() => setMobileMenu(!mobileMenu)}
                aria-label="Toggle navigation"
              >
                {mobileMenu ? <X /> : <Menu />}
              </button>
            </header>

            {/* MOBILE NAVIGATION */}

            {mobileMenu && (
              <div className="mobile-nav">
                <a href="#home" onClick={() => setMobileMenu(false)}>
                  Home
                </a>

                <a href="#services" onClick={() => setMobileMenu(false)}>
                  Services
                </a>

                <a href="#shops" onClick={() => setMobileMenu(false)}>
                  Explore Shops
                </a>

                <a href="#partner" onClick={() => setMobileMenu(false)}>
                  Partner with us
                </a>

                {currentUser ? (
                  <button onClick={handleLogout}>
                    <LogOut size={16} />
                    Logout ({currentUser.name || "User"})
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setShowAccount(true);
                      setMobileMenu(false);
                    }}
                  >
                    Login / Register
                  </button>
                )}
              </div>
            )}

            {/* =================================
                HERO SECTION
            ================================= */}

            <main id="home">
              <section className="hero-section">
                <div className="hero-content">
                  <div className="hero-label">
                    <Sparkles size={15} />
                    YOUR NEIGHBOURHOOD, ONE PLATFORM
                  </div>

                  <h1>
                    Your City.
                    <br />
                    Your Shops.
                    <br />
                    <span>At Your Doorstep.</span>
                  </h1>

                  <p>
                    From delicious food to daily essentials,
                    local shopping and parcel delivery.
                    Everything you need, delivered closer.
                  </p>

                  <div className="hero-search">
                    <MapPin size={21} />

                    <input
                      value={location}
                      onChange={event =>
                        setLocation(event.target.value)
                      }
                      placeholder="Enter your city or area..."
                    />

                    <button onClick={() => scrollTo("shops")}>
                      Explore <ArrowRight size={17} />
                    </button>
                  </div>

                  <div className="hero-benefits">
                    <span>
                      <ShieldCheck size={16} />
                      Trusted local shops
                    </span>

                    <span>
                      <Truck size={16} />
                      Convenient delivery
                    </span>
                  </div>
                </div>

                <div className="hero-image-area">
                  <div className="hero-decoration"></div>

                  <img
                    className="hero-image"
                    src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1000"
                    alt="Fresh local groceries"
                  />

                  <div className="floating-delivery">
                    <div className="floating-icon">
                      <Truck size={24} />
                    </div>

                    <div>
                      <strong>Local delivery</strong>
                      <small>Your neighbourhood, closer.</small>
                    </div>
                  </div>

                  <div className="floating-rating">
                    <Star
                      size={17}
                      fill="#f4b400"
                      color="#f4b400"
                    />
                    <strong>Local favourites</strong>
                  </div>
                </div>
              </section>

              {/* =================================
                  SERVICE CATEGORIES
              ================================= */}

              <section
                className="content-section"
                id="services"
              >
                <div className="section-title">
                  <div>
                    <span className="section-eyebrow">
                      EXPLORE SARATHI
                    </span>

                    <h2>What do you need today?</h2>

                    <p>
                      Everything you need from your neighbourhood.
                    </p>
                  </div>

                  <button
                    className="text-link"
                    onClick={() => selectCategory("All")}
                  >
                    View all <ArrowRight size={17} />
                  </button>
                </div>

                <div className="category-grid">
                  {services.map(service => {
                    const Icon = service.icon;

                    const selected =
                      activeCategory === service.name;

                    return (
                      <button
                        className={`category-card ${
                          selected ? "selected" : ""
                        }`}
                        key={service.name}
                        onClick={() => {
                          if (service.name === "Bike Ride") {
                            scrollTo("partner");
                          } else {
                            selectCategory(
                              selected ? "All" : service.name
                            );
                          }
                        }}
                      >
                        <div
                          className={`category-icon ${service.color}`}
                        >
                          <Icon size={27} />
                        </div>

                        <strong>{service.name}</strong>

                        <ArrowRight
                          size={15}
                          className="category-arrow"
                        />
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* =================================
                  LOCAL SHOPS
              ================================= */}

              <section
                className="content-section shops-section"
                id="shops"
              >
                <div className="section-title">
                  <div>
                    <span className="section-eyebrow">
                      DISCOVER NEAR YOU
                    </span>

                    <h2>Explore local favourites.</h2>

                    <p>
                      Discover businesses around your neighbourhood.
                    </p>
                  </div>

                  <span className="location-chip">
                    <Navigation size={15} />
                    {location || "Your area"}
                  </span>
                </div>

                <div className="shop-grid">
                  {shops.map(shop => (
                    <article
                      className="shop-card"
                      key={shop.name}
                    >
                      <img
                        src={shop.image}
                        alt={shop.name}
                      />

                      <div className="shop-info">
                        <div className="shop-name-row">
                          <h3>{shop.name}</h3>

                          <span className="rating">
                            <Star
                              size={13}
                              fill="currentColor"
                            />
                            {shop.rating}
                          </span>
                        </div>

                        <p>{shop.type}</p>

                        <div className="shop-meta">
                          <span>
                            <Clock size={14} />
                            {shop.time}
                          </span>

                          <span>Local business</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* =================================
                  REAL DATABASE PRODUCTS
              ================================= */}

              <section
                className="content-section product-section"
                id="products"
              >
                <div className="section-title">
                  <div>
                    <span className="section-eyebrow">
                      HANDPICKED FOR YOU
                    </span>

                    <h2>Popular around you.</h2>

                    <p>
                      Explore products from approved local businesses.
                    </p>
                  </div>
                </div>

                <div className="product-controls">
                  <div className="product-search">
                    <Search size={19} />

                    <input
                      value={search}
                      onChange={event =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search products or shops..."
                    />

                    {search && (
                      <button onClick={() => setSearch("")}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div className="sarathi-radius-control">
                    <label htmlFor="sarathi-radius">Nearby radius</label>
                    <select
                      id="sarathi-radius"
                      value={radiusKm}
                      onChange={event => setRadiusKm(Number(event.target.value))}
                    >
                      <option value={5}>5 km</option>
                      <option value={10}>10 km</option>
                      <option value={15}>15 km</option>
                      <option value={20}>20 km</option>
                    </select>
                  </div>

                  <div className="filter-tabs">
                    {[
                      "All",
                      "Food",
                      "Grocery",
                      "Local Shops",
                      "Parcel",
                      "Documents",
                      "Electronics",
                      "Gifts",
                      "Fashion"
                    ].map(category => (
                      <button
                        key={category}
                        className={
                          activeCategory === category
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setActiveCategory(category)
                        }
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {productsLoading ? (
                  <div className="empty-products">
                    <p>
                      Loading products from local shops...
                    </p>
                  </div>
                ) : productsError ? (
                  <div className="empty-products">
                    <Package size={35} />

                    <h3>Unable to load products</h3>

                    <p>{productsError}</p>

                    <button onClick={fetchProducts}>
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="product-grid">
                      {filteredProducts.map(product => (
                        <article
                          className="product-card"
                          key={product.id}
                        >
                          <div className="product-image">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                loading="lazy"
                              />
                            ) : (
                              <div className="product-image-placeholder">
                                <Package size={40} />
                              </div>
                            )}

                            <button
                              className="wishlist"
                              aria-label="Add to wishlist"
                              onClick={event =>
                                event.currentTarget.classList.toggle(
                                  "liked"
                                )
                              }
                            >
                              <Heart size={18} />
                            </button>

                            <span className="product-category">
                              {product.category}
                            </span>
                          </div>

                          <div className="product-info">
                            <div className="product-shop">
                              {product.shop}
                            </div>

                            {product.distanceKm !== null && (
                              <div className="sarathi-product-distance">
                                <MapPin size={13} />
                                {product.distanceKm.toFixed(1)} km away
                              </div>
                            )}

                            <h3>{product.name}</h3>

                            <div className="product-bottom">
                              <div>
                                <strong>
                                  ₹{product.price}
                                </strong>

                                {product.oldPrice != null &&
                                  Number(product.oldPrice) >
                                    product.price && (
                                    <del>
                                      ₹{product.oldPrice}
                                    </del>
                                  )}
                              </div>

                              <span className="rating">
                                {product.rating ? (
                                  <>
                                    <Star
                                      size={13}
                                      fill="currentColor"
                                    />
                                    {product.rating}
                                  </>
                                ) : (
                                  "New"
                                )}
                              </span>
                            </div>

                            <button
                              className="add-button"
                              onClick={() => addToCart(product)}
                              disabled={product.stock <= 0}
                            >
                              <Plus size={17} />
                              {product.stock <= 0
                                ? "Out of stock"
                                : "Add to cart"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>

                    {filteredProducts.length === 0 && (
                      <div className="empty-products">
                        <Search size={35} />

                        <h3>
                          {products.length === 0
                            ? "No approved products available yet"
                            : "No matching products found"}
                        </h3>

                        <p>
                          {products.length === 0
                            ? "Approved merchant products will appear here."
                            : "Try a different search or category."}
                        </p>

                        <button
                          onClick={() => {
                            setSearch("");
                            setActiveCategory("All");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* =================================
                  MERCHANT PROMOTION
              ================================= */}

              <section className="promo-section">
                <div>
                  <span className="section-eyebrow">
                    GROW WITH SARATHI
                  </span>

                  <h2>
                    Your local business deserves a bigger audience.
                  </h2>

                  <p>
                    Bring your store online. Connect with nearby
                    customers and grow your business with SARATHI.
                  </p>

                  <button
                    onClick={() => {
                      setAuthMode("register");
                      setShowAccount(true);
                    }}
                  >
                    Become a Merchant <ArrowRight size={17} />
                  </button>
                </div>

                <div className="promo-art">
                  <Store size={105} />
                </div>
              </section>

              {/* =================================
                  DELIVERY PARTNER
              ================================= */}

              <section
                className="delivery-banner"
                id="partner"
              >
                <div className="delivery-banner-icon">
                  <Bike size={48} />
                </div>

                <div>
                  <span className="section-eyebrow">
                    JOIN OUR TEAM
                  </span>

                  <h2>Ride with SARATHI.</h2>

                  <p>
                    Earn on your schedule. Become a delivery partner.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setAuthMode("register");
                    setShowAccount(true);
                  }}
                >
                  Join as Partner <ArrowRight size={17} />
                </button>
              </section>
            </main>

            {/* =================================
                FOOTER
            ================================= */}

            <footer className="footer">
              <div className="footer-main">
                <div className="footer-brand">
                  <a className="brand" href="#home">
                    SARATHI<span>.</span>
                  </a>

                  <p>MORE THAN JUST DELIVERY.</p>

                  <small>
                    Connecting local businesses with their communities.
                  </small>
                </div>

                <div>
                  <h4>Explore</h4>
                  <a href="#services">Our Services</a>
                  <a href="#shops">Local Shops</a>
                  <a href="#products">Popular Products</a>
                </div>

                <div>
                  <h4>Partner with us</h4>
                  <a href="#partner">Become a Merchant</a>
                  <a href="#partner">Become a Rider</a>
                </div>

                <div>
                  <h4>Support</h4>
                  <a href="#about">About SARATHI</a>
                  <a href="#about">Contact Us</a>
                </div>
              </div>

              
                    <div className="footer-bottom" id="about">
                      <span>© 2026 SARATHI. All rights reserved.</span>

                      <div className="footer-creator">
                        <span>Made for local communities.</span>
                        <span>
                          Founded, Designed & Developed by{" "}
                          <strong>Jyoti Prakash Arukha</strong>
                        </span>
                        <span className="creator-role">
                          Founder & Developer of SARATHI
                        </span>
                      </div>
                    </div>

            </footer>

            {/* =================================
                CART DRAWER
            ================================= */}

            {showCart && (
              <div
                className="overlay"
                onClick={() => setShowCart(false)}
              >
                <div
                  className="side-drawer"
                  onClick={event => event.stopPropagation()}
                >
                  <div className="drawer-heading">
                    <h2>Your Cart ({cartCount})</h2>

                    <button
                      onClick={() => setShowCart(false)}
                      aria-label="Close cart"
                    >
                      <X />
                    </button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="empty-cart">
                      <ShoppingCart size={45} />

                      <h3>Your cart is empty</h3>

                      <p>
                        Explore local products and add something you like.
                      </p>

                      <button
                        onClick={() => setShowCart(false)}
                      >
                        Explore products
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="cart-items">
                        {cart.map(item => (
                          <div
                            className="cart-item"
                            key={item.id}
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                              />
                            ) : (
                              <div className="cart-item-placeholder">
                                <Package size={25} />
                              </div>
                            )}

                            <div className="cart-item-info">
                              <strong>{item.name}</strong>

                              <span>₹{item.price}</span>

                              <div className="quantity">
                                <button
                                  onClick={() =>
                                    updateQuantity(item.id, -1)
                                  }
                                  aria-label="Decrease quantity"
                                >
                                  <Minus size={13} />
                                </button>

                                {item.quantity}

                                <button
                                  onClick={() =>
                                    updateQuantity(item.id, 1)
                                  }
                                  aria-label="Increase quantity"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="cart-total">
                        <div>
                          <span>Subtotal</span>
                          <strong>₹{cartTotal}</strong>
                        </div>

                        <small>
                          Delivery charges calculated at checkout.
                        </small>

                        <button
                          onClick={openCheckout}
                          disabled={cart.length === 0}
                        >
                          Proceed to checkout
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* =================================
                CHECKOUT MODAL
            ================================= */}

            {showCheckout && (
              <div
                className="overlay checkout-overlay"
                onClick={closeCheckout}
              >
                <div
                  className="checkout-modal"
                  onClick={event => event.stopPropagation()}
                >
                  {orderConfirmation ? (
                    <div className="checkout-success">
                      <CheckCircle
                        size={60}
                        color="#16a34a"
                      />

                      <h2>Order placed successfully!</h2>

                      <p>
                        Thank you for ordering with SARATHI.
                      </p>

                      <div className="checkout-order-number">
                        <span>Order number</span>
                        <strong>
                          {orderConfirmation.orderNumber}
                        </strong>
                      </div>

                      <div className="checkout-order-number">
                        <span>Total amount</span>
                        <strong>
                          ₹{orderConfirmation.totalAmount}
                        </strong>
                      </div>

                      <div className="checkout-order-number">
                        <span>Payment method</span>
                        <strong>Cash on Delivery</strong>
                      </div>

                      <div className="checkout-order-number">
                        <span>Order status</span>
                        <strong>
                          {orderConfirmation.status || "pending"}
                        </strong>
                      </div>

                      <button
                        className="checkout-submit"
                        onClick={() => {
                          setOrderConfirmation(null);
                          setShowCheckout(false);
                          setShowCart(false);
                        }}
                      >
                        Continue shopping
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="checkout-heading">
                        <div>
                          <span className="section-eyebrow">
                            SARATHI DELIVERY
                          </span>

                          <h2>Complete your order</h2>

                          <p>
                            Enter the address where you want your order
                            delivered.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="checkout-close"
                          onClick={closeCheckout}
                          disabled={placingOrder}
                          aria-label="Close checkout"
                        >
                          <X />
                        </button>
                      </div>

                      {/* ORDER SUMMARY */}

                      <div className="checkout-summary">
                        <div className="checkout-summary-title">
                          <ShoppingCart size={19} />
                          <strong>
                            Order summary ({cart.length} products)
                          </strong>
                        </div>

                        {cart.map(item => (
                          <div
                            className="checkout-summary-row"
                            key={item.id}
                          >
                            <div>
                              <strong>{item.name}</strong>
                              <small>
                                Quantity: {item.quantity}
                              </small>
                            </div>

                            <strong>
                              ₹{item.price * item.quantity}
                            </strong>
                          </div>
                        ))}

                        <div className="checkout-summary-total">
                          <span>Subtotal</span>
                          <strong>₹{cartTotal}</strong>
                        </div>

                        <div className="checkout-summary-total">
                          <span>Delivery fee</span>
                          <strong>₹0</strong>
                        </div>

                        <div className="checkout-grand-total">
                          <span>Total payable</span>
                          <strong>₹{cartTotal}</strong>
                        </div>

                        <small className="checkout-note">
                          Delivery fee is currently free in this development
                          version.
                        </small>
                      </div>

                      {/* DELIVERY FORM */}

                      <form onSubmit={handlePlaceOrder}>
                        <h3>
                          <MapPin size={19} />
                          Delivery address
                        </h3>

                        <div className="checkout-fields">
                          <input
                            name="fullName"
                            placeholder="Full name"
                            value={checkoutForm.fullName}
                            onChange={updateCheckoutField}
                            required
                          />

                          <input
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            placeholder="10-digit mobile number"
                            value={checkoutForm.phone}
                            onChange={event =>
                              setCheckoutForm(previous => ({
                                ...previous,
                                phone: event.target.value.replace(/\D/g, "")
                              }))
                            }
                            required
                          />

                          <textarea
                            name="address"
                            placeholder="House number, street and full address"
                            value={checkoutForm.address}
                            onChange={updateCheckoutField}
                            required
                          />

                          <input
                            name="area"
                            placeholder="Area / locality"
                            value={checkoutForm.area}
                            onChange={updateCheckoutField}
                          />

                          <input
                            name="city"
                            placeholder="City"
                            value={checkoutForm.city}
                            onChange={updateCheckoutField}
                            required
                          />

                          <input
                            name="state"
                            placeholder="State"
                            value={checkoutForm.state}
                            onChange={updateCheckoutField}
                          />

                          <input
                            name="pincode"
                            placeholder="6-digit pincode"
                            inputMode="numeric"
                            maxLength={6}
                            value={checkoutForm.pincode}
                            onChange={event =>
                              setCheckoutForm(previous => ({
                                ...previous,
                                pincode: event.target.value.replace(/\D/g, "")
                              }))
                            }
                            required
                          />

                          <input
                            name="landmark"
                            placeholder="Landmark (optional)"
                            value={checkoutForm.landmark}
                            onChange={updateCheckoutField}
                          />
                        </div>

                        {/* CUSTOMER DELIVERY GPS LOCATION */}

                        <div className="checkout-location-picker">
                          <h3>
                            <Navigation size={19} />
                            Delivery GPS location
                          </h3>

                          <p>
                            Capture your current location so the delivery partner
                            can find your delivery address accurately.
                          </p>

                          <button
                            type="button"
                            className="checkout-location-button"
                            onClick={getCustomerCurrentLocation}
                            disabled={locationLoading}
                          >
                            <MapPin size={17} />
                            {locationLoading
                              ? "Getting your location..."
                              : checkoutForm.latitude !== null && checkoutForm.longitude !== null
                              ? "Update my location"
                              : "Use my current location"}
                          </button>

                          {locationMessage && (
                            <p className="checkout-location-success" role="status">
                              <CheckCircle size={16} />
                              {locationMessage}
                            </p>
                          )}

                          {locationError && (
                            <p className="checkout-location-error" role="alert">
                              {locationError}
                            </p>
                          )}

                          {checkoutForm.latitude !== null && checkoutForm.longitude !== null && (
                            <div className="checkout-coordinates">
                              <span>Latitude: {checkoutForm.latitude}</span>
                              <span>Longitude: {checkoutForm.longitude}</span>
                            </div>
                          )}
                        </div>

                        {/* PAYMENT */}

                        <h3>
                          <CreditCard size={19} />
                          Payment method
                        </h3>

                        <div className="checkout-payment">
                          <label>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="cod"
                              checked={
                                checkoutForm.paymentMethod === "cod"
                              }
                              onChange={updateCheckoutField}
                            />
                            Cash on Delivery
                          </label>

                          <label className="checkout-disabled-payment">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="online"
                              checked={
                                checkoutForm.paymentMethod === "online"
                              }
                              onChange={updateCheckoutField}
                            />
                            Online Payment
                            <span>Coming soon</span>
                          </label>

                          <p>
                            Online payment will be enabled after payment
                            gateway integration.
                          </p>
                        </div>

                        {checkoutError && (
                          <div
                            className="checkout-error"
                            role="alert"
                          >
                            {checkoutError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="checkout-submit"
                          disabled={
                            placingOrder ||
                            cart.length === 0 ||
                            checkoutForm.paymentMethod !== "cod"
                          }
                        >
                          {placingOrder
                            ? "Placing your order..."
                            : `Place order · ₹${cartTotal}`}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* =================================
                AUTHENTICATION MODAL
            ================================= */}

            {showAccount && (
              <AuthModal
                initialMode={authMode}
                onClose={handleAuthModalClose}
              />
            )}
          </div>
        }
      />

      {/* =================================
          ROLE-BASED DASHBOARDS
      ================================= */}

      <Route
        element={
          <ProtectedRoute
            user={currentUser}
            loading={authChecking}
          />
        }
      >
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute
              user={currentUser}
              loading={authChecking}
              allowedRole="customer"
            >
              <CustomerDashboard
                user={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/merchant/dashboard"
          element={
            <ProtectedRoute
              user={currentUser}
              loading={authChecking}
              allowedRole="merchant"
            >
              <MerchantDashboard
                user={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/delivery/dashboard"
          element={
            <ProtectedRoute
              user={currentUser}
              loading={authChecking}
              allowedRole="delivery"
            >
              <DeliveryDashboard
                user={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute
              user={currentUser}
              loading={authChecking}
              allowedRole="admin"
            >
              <AdminDashboard
                user={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* =================================
          PAGE NOT FOUND
      ================================= */}

      <Route
        path="*"
        element={
          <div className="dashboard-page">
            <h2>Page not found</h2>
            <Link to="/">Return to SARATHI</Link>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
