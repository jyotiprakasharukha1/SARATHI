
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from "react-leaflet";
import L from "leaflet";

import {
  Bike,
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Play,
  Square,
  RefreshCw,
  ShieldCheck,
  Clock,
  Route,
  Store,
  Home,
  ExternalLink
} from "lucide-react";

import DashboardShell from "../components/DashboardShell";
import "leaflet/dist/leaflet.css";

const API_URL = "http://localhost:5000";
const DEFAULT_CENTER = [20.2961, 85.8245];

const styles = {
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20
  },
  button: {
    padding: "11px 16px",
    border: 0,
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  muted: {
    color: "#64748b",
    fontSize: 14
  }
};

const makeIcon = (emoji, color) =>
  L.divIcon({
    className: "sarathi-map-marker",
    html: `
      <div style="
        width:38px;
        height:38px;
        border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 2px 8px #0005;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:19px;
      ">${emoji}</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });

const partnerIcon = makeIcon("🏍️", "#2563eb");
const shopIcon = makeIcon("🏪", "#f97316");
const customerIcon = makeIcon("🏠", "#16a34a");

function MapRecenter({ center }) {
  const map = useMap();

  useEffect(() => {
    if (
      center &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1])
    ) {
      map.setView(center, 14);
    }

    // Leaflet sometimes initializes before the dashboard panel has its final
    // dimensions. Recalculate the map size after the panel is rendered.
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => window.clearTimeout(resizeTimer);
  }, [center, map]);

  return null;
}

function validCoordinates(latitude, longitude) {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180
  );
}

function openGoogleMaps(order, currentLocation) {
  const destination = order?.deliveryAddress;

  if (
    !validCoordinates(
      destination?.latitude,
      destination?.longitude
    )
  ) {
    alert("Customer location coordinates are not available.");
    return;
  }

  const destinationText =
    `${destination.latitude},${destination.longitude}`;

  const originText = currentLocation
    ? `${currentLocation.latitude},${currentLocation.longitude}`
    : "";

  const url = originText
    ? `https://www.google.com/maps/dir/?api=1&origin=${originText}&destination=${destinationText}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destinationText}&travelmode=driving`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function DeliveryMap({ order, location, routeData }) {
  const customer = order?.deliveryAddress;

  const customerValid = validCoordinates(
    customer?.latitude,
    customer?.longitude
  );

  const shops = (order?.pickupLocations || []).filter(shop =>
    validCoordinates(shop.latitude, shop.longitude)
  );

  const partnerPosition = location
    ? [location.latitude, location.longitude]
    : null;

  const customerPosition = customerValid
    ? [
        Number(customer.latitude),
        Number(customer.longitude)
      ]
    : null;

  const firstShop = shops[0];

  const center = partnerPosition ||
    (firstShop
      ? [Number(firstShop.latitude), Number(firstShop.longitude)]
      : customerPosition || DEFAULT_CENTER);

  return (
    <div style={{ height: 430, width: "100%", borderRadius: 12, overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter center={center} />

        {partnerPosition && (
          <Marker position={partnerPosition} icon={partnerIcon}>
            <Popup>Your current GPS location</Popup>
          </Marker>
        )}

        {shops.map((shop, index) => (
          <Marker
            key={shop.merchantId || index}
            position={[
              Number(shop.latitude),
              Number(shop.longitude)
            ]}
            icon={shopIcon}
          >
            <Popup>
              <strong>{shop.shopName}</strong>
              <br />
              {shop.address}, {shop.city}
              <br />
              Pickup location
            </Popup>
          </Marker>
        ))}

        {customerPosition && (
          <Marker position={customerPosition} icon={customerIcon}>
            <Popup>
              <strong>Customer destination</strong>
              <br />
              {customer.address}, {customer.city}
            </Popup>
          </Marker>
        )}

        {routeData?.coordinates?.length > 1 && (
          <Polyline
            positions={routeData.coordinates}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.85
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

export default function DeliveryDashboard({ user, onLogout }) {
  const approved = user?.accountStatus === "active";

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const routeRequestRef = useRef(0);

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [connected, setConnected] = useState(false);

  const [location, setLocation] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedOrderData = useMemo(
    () => orders.find(order => order._id === selectedOrder),
    [orders, selectedOrder]
  );

  // Load assigned orders and connect Socket.IO.
  useEffect(() => {
    if (!approved) {
      setLoading(false);
      return;
    }

    const token = sessionStorage.getItem("sarathiToken");

    if (!token) {
      setError("Please log in again.");
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadOrders = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/orders/delivery/assigned`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load orders.");
        }

        if (mounted) {
          const fetchedOrders = data.orders || [];
          setOrders(fetchedOrders);

          // Automatically select the first order that is still in progress.
          // This makes Delivery navigation visible immediately after loading.
          setSelectedOrder(current => {
            const currentStillAvailable = fetchedOrders.some(
              order => order._id === current &&
                !["delivered", "cancelled"].includes(order.status)
            );

            if (currentStillAvailable) return current;

            const firstActiveOrder = fetchedOrders.find(
              order => !["delivered", "cancelled"].includes(order.status)
            );

            return firstActiveOrder?._id || "";
          });
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (mounted) {
        setConnected(true);
        setError("");
      }
    });

    socket.on("disconnect", () => {
      if (mounted) setConnected(false);
    });

    socket.on("connect_error", err => {
      if (mounted) {
        setConnected(false);
        setError(`Tracking connection failed: ${err.message}`);
      }
    });

    socket.on("location-update-confirmed", () => {
      if (mounted) {
        setMessage("Your latest GPS location was shared.");
      }
    });

    socket.on("tracking-error", data => {
      if (mounted) {
        setError(data.message || "Location update failed.");
      }
    });

    loadOrders();

    return () => {
      mounted = false;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [approved]);

  // Calculate a road route using OSRM. If partner GPS is not sharing yet,
  // calculate the route from the first merchant pickup to the customer.
  useEffect(() => {
    const customer = selectedOrderData?.deliveryAddress;

    if (
      !selectedOrderData ||
      !validCoordinates(customer?.latitude, customer?.longitude)
    ) {
      setRouteData(null);
      setRouteLoading(false);
      return;
    }

    const shops = (selectedOrderData.pickupLocations || []).filter(shop =>
      validCoordinates(shop.latitude, shop.longitude)
    );

    const points = [];
    if (location && validCoordinates(location.latitude, location.longitude)) {
      points.push([Number(location.longitude), Number(location.latitude)]);
    } else if (shops.length > 0) {
      points.push([Number(shops[0].longitude), Number(shops[0].latitude)]);
    }

    // Include all merchant pickup locations in order, then the customer.
    for (const shop of shops) {
      const point = [Number(shop.longitude), Number(shop.latitude)];
      if (!points.some(existing => existing[0] === point[0] && existing[1] === point[1])) {
        points.push(point);
      }
    }
    points.push([Number(customer.longitude), Number(customer.latitude)]);

    if (points.length < 2) {
      setRouteData(null);
      setRouteLoading(false);
      return;
    }

    const coordinates = points.map(point => point.join(',')).join(';');
    const requestId = ++routeRequestRef.current;
    const controller = new AbortController();

    const loadRoute = async () => {
      setRouteLoading(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Routing service is unavailable.');
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes?.length) {
          throw new Error('No driving route was found.');
        }
        if (requestId !== routeRequestRef.current) return;
        const route = data.routes[0];
        setRouteData({
          coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
          distance: route.distance,
          duration: route.duration
        });
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError' && requestId === routeRequestRef.current) {
          setRouteData(null);
          setError(`${err.message} You can still use Google Maps navigation.`);
        }
      } finally {
        if (requestId === routeRequestRef.current) setRouteLoading(false);
      }
    };

    loadRoute();
    return () => controller.abort();
  }, [location?.latitude, location?.longitude, selectedOrderData]);

  const handleDeliveryAction = async (order) => {
    if (!order?._id || actionLoading) return;

    const nextStatusByCurrentStatus = {
      confirmed: "accepted",
      preparing: "accepted",
      ready_for_pickup: "accepted",
      accepted: "picked_up",
      picked_up: "out_for_delivery",
      out_for_delivery: "delivered"
    };
    const nextStatus = nextStatusByCurrentStatus[order.status];
    if (!nextStatus) return;

    const actionLabels = {
      accepted: "accept this delivery",
      picked_up: "mark this order as picked up",
      out_for_delivery: "start delivery for this order",
      delivered: "mark this order as delivered"
    };
    if (!window.confirm(`Are you sure you want to ${actionLabels[nextStatus]}?`)) return;

    const token = sessionStorage.getItem("sarathiToken");
    if (!token) {
      setError("Please log in again.");
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/orders/delivery/${order._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update this delivery.");

      setOrders(current => current.map(item =>
        item._id === order._id ? { ...item, ...(data.order || {}), status: nextStatus } : item
      ));
      setMessage(data.message || `Order status updated to ${nextStatus.replaceAll("_", " ")}.`);
      if (nextStatus === "delivered") {
        if (selectedOrder === order._id) setSelectedOrder("");
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setSharing(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const startSharing = () => {
    setError("");
    setMessage("");

    if (!selectedOrder) {
      setError("Select an active delivery order first.");
      return;
    }

    if (!connected || !socketRef.current) {
      setError("Tracking server is not connected. Please wait.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    const order = orders.find(item => item._id === selectedOrder);

    if (!order || order.status !== "out_for_delivery") {
      setError("GPS sharing is available only for orders out for delivery.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setSharing(true);
    setMessage("Waiting for GPS location permission...");

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setLocation({
          latitude,
          longitude,
          accuracy: position.coords.accuracy,
          updatedAt: new Date().toLocaleTimeString()
        });

        if (socketRef.current?.connected) {
          socketRef.current.emit("delivery-location-update", {
            orderId: selectedOrder,
            latitude,
            longitude
          });

          setMessage("GPS location captured. Sending tracking update...");
        } else {
          setError("Socket disconnected. GPS is available but not being shared.");
        }
      },
      err => {
        setSharing(false);

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        const messages = {
          1: "Location permission denied. Allow location access in your browser.",
          2: "Your device could not determine its location.",
          3: "GPS request timed out. Please try again."
        };

        setError(messages[err.code] || "Unable to access GPS.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );

    watchIdRef.current = watchId;
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setSharing(false);
    setMessage("Location sharing stopped.");
  };

  const refreshOrders = async () => {
    const token = sessionStorage.getItem("sarathiToken");

    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/orders/delivery/assigned`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to refresh orders.");
      }

      const refreshedOrders = data.orders || [];
      setOrders(refreshedOrders);

      setSelectedOrder(current => {
        const currentStillAvailable = refreshedOrders.some(
          order => order._id === current &&
            !["delivered", "cancelled"].includes(order.status)
        );

        if (currentStillAvailable) return current;

        const firstActiveOrder = refreshedOrders.find(
          order => !["delivered", "cancelled"].includes(order.status)
        );

        return firstActiveOrder?._id || "";
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeOrders = orders.filter(
    order => order.status === "out_for_delivery"
  );

  const customer = selectedOrderData?.deliveryAddress;

  const customerHasCoordinates = validCoordinates(
    customer?.latitude,
    customer?.longitude
  );

  const formattedDistance = routeData
    ? routeData.distance >= 1000
      ? `${(routeData.distance / 1000).toFixed(1)} km`
      : `${Math.round(routeData.distance)} m`
    : "Calculating...";

  const formattedDuration = routeData
    ? `${Math.max(1, Math.round(routeData.duration / 60))} min`
    : "Calculating...";

  return (
    <DashboardShell
      user={user}
      onLogout={onLogout}
      title="Delivery Partner Dashboard"
      subtitle="Manage deliveries, navigate to customers and share your live GPS location."
    >
      <section className="dashboard-profile-card">
        <div className="dashboard-avatar">
          <Bike size={26} />
        </div>

        <div>
          <h2>{user?.name || "Delivery Partner"}</h2>
          <p>{user?.email}</p>
          <p>Delivery Partner Account</p>
        </div>

        <span className="dashboard-status">
          <ShieldCheck size={15} />
          Approved
        </span>
      </section>

      <div style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Tracking connection</h2>

        <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connected ? (
            <Wifi color="green" size={20} />
          ) : (
            <WifiOff color="red" size={20} />
          )}

          <strong>
            {connected ? "Connected to SARATHI server" : "Not connected"}
          </strong>
        </p>

        <p style={styles.muted}>
          Your location can be shared only when an assigned order is out for delivery.
        </p>
      </div>

      <div style={styles.panel}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap"
        }}>
          <h2 style={{ margin: 0 }}>My assigned deliveries</h2>

          <button
            style={{
              ...styles.button,
              background: "#f1f5f9",
              color: "#172033"
            }}
            onClick={refreshOrders}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading assigned orders...</p>
        ) : orders.length === 0 ? (
          <p>No assigned deliveries found.</p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {orders.map(order => (
              <label
                key={order._id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  border: selectedOrder === order._id
                    ? "2px solid #f97316"
                    : "1px solid #e5e7eb",
                  padding: 14,
                  borderRadius: 10,
                  cursor: ["delivered", "cancelled"].includes(order.status)
                    ? "not-allowed"
                    : "pointer",
                  opacity: ["delivered", "cancelled"].includes(order.status) ? 0.65 : 1
                }}
              >
                <input
                  type="radio"
                  name="deliveryOrder"
                  value={order._id}
                  checked={selectedOrder === order._id}
                  disabled={["delivered", "cancelled"].includes(order.status) || sharing}
                  onChange={() => {
                    setSelectedOrder(order._id);
                    setRouteData(null);
                  }}
                />

                <div>
                  <strong>{order.orderNumber}</strong>

                  <p style={{ margin: "5px 0" }}>
                    Customer: {order.customer?.name || "Customer"}
                  </p>

                  <p style={{ margin: "5px 0" }}>
                    Delivery: {order.deliveryAddress?.address},{" "}
                    {order.deliveryAddress?.city}
                  </p>

                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: ["out_for_delivery", "delivered"].includes(order.status)
                      ? "#15803d"
                      : "#64748b"
                  }}>
                    {order.status.replaceAll("_", " ").toUpperCase()}
                  </span>

                  {! ["delivered", "cancelled"].includes(order.status) && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleDeliveryAction(order);
                        }}
                        style={{
                          ...styles.button,
                          background: actionLoading ? "#94a3b8" : "#15803d",
                          color: "#fff",
                          cursor: actionLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {actionLoading ? "Updating..." : ({
                          confirmed: "Accept Delivery",
                          preparing: "Accept Delivery",
                          ready_for_pickup: "Accept Delivery",
                          accepted: "Mark Picked Up",
                          picked_up: "Start Delivery",
                          out_for_delivery: "Mark Delivered"
                        })[order.status]}
                      </button>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>
          <Navigation size={21} style={{ verticalAlign: "middle" }} /> Delivery navigation
        </h2>

        {!selectedOrderData ? (
          <p style={styles.muted}>
            Select an active delivery order to view its pickup and destination locations.
          </p>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
              gap: 12,
              marginBottom: 16
            }}>
              <div style={{
                background: "#eff6ff",
                padding: 14,
                borderRadius: 10
              }}>
                <Route size={20} color="#2563eb" />
                <p style={{ margin: "6px 0", fontSize: 13, color: "#475569" }}>
                  Route distance
                </p>
                <strong>{formattedDistance}</strong>
              </div>

              <div style={{
                background: "#f0fdf4",
                padding: 14,
                borderRadius: 10
              }}>
                <Clock size={20} color="#15803d" />
                <p style={{ margin: "6px 0", fontSize: 13, color: "#475569" }}>
                  Estimated travel time
                </p>
                <strong>{formattedDuration}</strong>
              </div>

              <div style={{
                background: "#fff7ed",
                padding: 14,
                borderRadius: 10
              }}>
                <Store size={20} color="#ea580c" />
                <p style={{ margin: "6px 0", fontSize: 13, color: "#475569" }}>
                  Pickup locations
                </p>
                <strong>
                  {selectedOrderData.pickupLocations?.length || 0}
                </strong>
              </div>
            </div>

            <DeliveryMap
              order={selectedOrderData}
              location={location}
              routeData={routeData}
            />

            {routeLoading && (
              <p style={styles.muted}>Calculating the road route...</p>
            )}

            {!customerHasCoordinates && (
              <p style={{ color: "#b45309", fontSize: 14 }}>
                Customer GPS coordinates are missing. Ask the customer to select their house location on the checkout map.
              </p>
            )}

            {selectedOrderData.pickupLocations?.length === 0 && (
              <p style={{ color: "#b45309", fontSize: 14 }}>
                No merchant coordinates found. Ask the merchant to save their shop location.
              </p>
            )}

            <div style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 16
            }}>
              <button
                style={{
                  ...styles.button,
                  background: "#2563eb",
                  color: "#fff"
                }}
                onClick={() => openGoogleMaps(selectedOrderData, location)}
                disabled={!customerHasCoordinates}
              >
                <ExternalLink size={17} />
                Navigate with Google Maps
              </button>

              <button
                style={{
                  ...styles.button,
                  background: "#f1f5f9",
                  color: "#172033"
                }}
                onClick={() => {
                  if (location) {
                    window.open(
                      `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  } else {
                    setError("Start GPS sharing to find your current location.");
                  }
                }}
              >
                <MapPin size={17} />
                My location
              </button>
            </div>
          </>
        )}
      </div>

      <div style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>
          <Navigation size={21} style={{ verticalAlign: "middle" }} /> Live GPS sharing
        </h2>

        <p style={styles.muted}>
          Accept an assigned order, mark it picked up, and start delivery before sharing GPS.
          Keep this dashboard open during delivery.
        </p>

        <button
          onClick={startSharing}
          disabled={sharing || !connected || !selectedOrder}
          style={{
            ...styles.button,
            background: sharing || !connected || !selectedOrder
              ? "#94a3b8"
              : "#15803d",
            color: "#fff",
            marginRight: 8
          }}
        >
          <Play size={17} />
          Start GPS sharing
        </button>

        <button
          onClick={stopSharing}
          disabled={!sharing}
          style={{
            ...styles.button,
            background: sharing ? "#dc2626" : "#94a3b8",
            color: "#fff"
          }}
        >
          <Square size={16} />
          Stop sharing
        </button>

        {sharing && (
          <p style={{ color: "#15803d", fontWeight: 600 }}>
            GPS sharing is active.
          </p>
        )}

        {location && (
          <div style={{
            background: "#f8fafc",
            padding: 14,
            borderRadius: 10,
            marginTop: 18
          }}>
            <h3>Latest GPS coordinates</h3>
            <p>Latitude: {location.latitude}</p>
            <p>Longitude: {location.longitude}</p>
            <p>Accuracy: ±{Math.round(location.accuracy)} metres</p>
            <p>Last captured: {location.updatedAt}</p>
          </div>
        )}

        {message && (
          <p style={{ color: "#15803d", marginTop: 14 }}>
            {message}
          </p>
        )}

        {error && (
          <p style={{ color: "#dc2626", marginTop: 14 }}>
            {error}
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
