
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Search,
  Store,
  Truck,
  Route,
  Layers3
} from "lucide-react";
import "./fleet-map.css";

const API_URL = "http://localhost:5000";
const GODS_EYE_ORIGIN = "http://localhost:4173";
const GODS_EYE_URL = `${GODS_EYE_ORIGIN}/?embed=1`;
const REFRESH_INTERVAL = 60000;

export default function FleetMap() {
  const iframeRef = useRef(null);
  const activeRef = useRef(false);
  const iframeReadyRef = useRef(false);
  const refreshTimerRef = useRef(null);
  const refreshInProgressRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [driverCount, setDriverCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const getAdminToken = () => sessionStorage.getItem("sarathiToken");

  const sendToMap = useCallback((message) => {
    if (!iframeReadyRef.current) return;

    iframeRef.current?.contentWindow?.postMessage(
      message,
      GODS_EYE_ORIGIN
    );
  }, []);

  const loadMapData = useCallback(async () => {
    if (
      !activeRef.current ||
      !iframeReadyRef.current ||
      refreshInProgressRef.current
    ) {
      return;
    }

    refreshInProgressRef.current = true;
    setRefreshing(true);
    setError("");

    try {
      const token = getAdminToken();

      if (!token) {
        throw new Error("Admin login token not found. Please log in again.");
      }

      const headers = {
        Authorization: `Bearer ${token}`
      };

      const [shopResponse, trackingResponse] = await Promise.all([
        fetch(`${API_URL}/api/merchant-locations/admin/shops`, {
          method: "GET",
          headers,
          cache: "no-store"
        }),
        fetch(`${API_URL}/api/admin/tracking/live`, {
          method: "GET",
          headers,
          cache: "no-store"
        })
      ]);

      const [shopResult, trackingResult] = await Promise.all([
        shopResponse.json().catch(() => ({})),
        trackingResponse.json().catch(() => ({}))
      ]);

      if (!shopResponse.ok) {
        throw new Error(
          shopResult.message || "Unable to load approved shops."
        );
      }

      if (!trackingResponse.ok) {
        throw new Error(
          trackingResult.message || "Unable to load active deliveries."
        );
      }

      const nextShops = Array.isArray(shopResult.shops)
        ? shopResult.shops
        : [];

      const routes = Array.isArray(trackingResult.routes)
        ? trackingResult.routes
        : [];

      if (!activeRef.current) return;

      setShops(nextShops);
      setShopCount(nextShops.length);
      setDeliveryCount(
        Number(trackingResult.activeDeliveries) || 0
      );

      sendToMap({
        type: "sarathi:shop-locations",
        shops: nextShops
      });

      sendToMap({
        type: "sarathi:tracking-data",
        routes
      });
    } catch (err) {
      if (activeRef.current) {
        setError(err.message || "Unable to refresh map data.");
      }
    } finally {
      refreshInProgressRef.current = false;

      if (activeRef.current) {
        setRefreshing(false);
      }
    }
  }, [sendToMap]);

  const issueFleetTicket = useCallback(async () => {
    try {
      const token = getAdminToken();

      if (!token) {
        throw new Error("Admin login token not found. Please log in again.");
      }

      setStatus("connecting");
      setError("");

      const response = await fetch(
        `${API_URL}/api/fleet-session/issue`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success || !result.ticket) {
        throw new Error(
          result.message || "Fleet authorization failed."
        );
      }

      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "sarathi:fleet-ticket",
          ticket: result.ticket
        },
        GODS_EYE_ORIGIN
      );

      setStatus("ticket-sent");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Unable to connect fleet tracking.");
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;

    const clearTimer = () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      refreshTimerRef.current = null;
    };

    const handleIframeLoad = () => {
      iframeReadyRef.current = false;
      setStatus("waiting");
      setDriverCount(0);
      clearTimer();
    };

    const handleMessage = (event) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        event.origin !== GODS_EYE_ORIGIN
      ) {
        return;
      }

      const message = event.data;

      if (!message || typeof message !== "object") return;

      if (message.type === "sarathi:fleet-ready") {
        iframeReadyRef.current = true;

        issueFleetTicket();
        loadMapData();

        clearTimer();

        refreshTimerRef.current = setInterval(
          loadMapData,
          REFRESH_INTERVAL
        );
      }

      if (message.type === "sarathi:fleet-status") {
        if (message.status === "connected") {
          setStatus("connected");
          setError("");
        } else if (message.status === "disconnected") {
          setStatus("disconnected");
        } else if (message.status === "error") {
          setStatus("error");
          setError(
            message.message || "God's Eye fleet connection failed."
          );
        }

        if (Number.isInteger(message.driverCount)) {
          setDriverCount(message.driverCount);
        }
      }

      if (
        message.type === "sarathi:shop-count" &&
        Number.isInteger(message.count)
      ) {
        setShopCount(message.count);
      }
    };

    const iframe = iframeRef.current;

    window.addEventListener("message", handleMessage);
    iframe?.addEventListener("load", handleIframeLoad);

    return () => {
      activeRef.current = false;
      iframeReadyRef.current = false;

      clearTimer();

      window.removeEventListener("message", handleMessage);
      iframe?.removeEventListener("load", handleIframeLoad);
    };
  }, [issueFleetTicket, loadMapData]);

  useEffect(() => {
    sendToMap({
      type: "sarathi:map-filter",
      filter
    });
  }, [filter, sendToMap]);

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return shops;

    return shops.filter((shop) =>
      [
        shop.shopName,
        shop.address,
        shop.area,
        shop.city,
        shop.pincode
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [shops, search]);

  const focusShop = (shop) => {
  setFilter("shops");

  sendToMap({
    type: "sarathi:focus-shop",
    shopId: String(shop._id || shop.id || shop.merchantId)
  });
};

  const statusLabels = {
    loading: "Loading map",
    waiting: "Waiting for map",
    connecting: "Connecting",
    "ticket-sent": "Connecting",
    connected: "Live",
    disconnected: "Disconnected",
    error: "Connection error"
  };

  const isConnected = status === "connected";

  return (
    <section className="fleet-panel">
      <div className="fleet-heading">
        <div>
          <span className="fleet-eyebrow">LIVE OPERATIONS</span>
          <h2>Delivery Fleet Tracking</h2>
          <p>
            Monitor registered shops, delivery partners and active orders.
          </p>
        </div>

        <span
          className={`fleet-connection ${
            isConnected ? "online" : "offline"
          }`}
        >
          <span />
          {statusLabels[status] || "Connecting"}
        </span>
      </div>

      {error && <div className="fleet-error">{error}</div>}

      <div className="fleet-summary">
        <div>
          <Store size={18} />
          <strong>{shopCount}</strong>
          <span>Approved shops</span>
        </div>

        <div>
          <Truck size={18} />
          <strong>{driverCount}</strong>
          <span>Active tracked partners</span>
        </div>

        <div>
          <Route size={18} />
          <strong>{deliveryCount}</strong>
          <span>Ongoing deliveries</span>
        </div>
      </div>

      <div className="fleet-toolbar">
        <div className="fleet-search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shop, area or city..."
          />
        </div>

        <button
          type="button"
          className="fleet-refresh-button"
          onClick={loadMapData}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "spinning" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh map data"}
        </button>
      </div>

      <div className="fleet-filter-row">
        <span><Layers3 size={16} /> Map layers</span>

        {[
          ["all", "All"],
          ["shops", "Shops"],
          ["partners", "Delivery partners"],
          ["routes", "Delivery routes"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="fleet-content">
        <iframe
          ref={iframeRef}
          className="fleet-gods-eye"
          src={GODS_EYE_URL}
          title="SARATHI God's Eye Fleet Tracking"
          allow="fullscreen; geolocation"
          loading="eager"
        />

        <aside className="fleet-shop-list">
          <h3><Store size={17} /> Registered shops</h3>

          {filteredShops.length === 0 ? (
            <p className="fleet-empty">
              {shops.length
                ? "No shops match your search."
                : "No approved shop locations found."}
            </p>
          ) : (
            filteredShops.map((shop) => {
              const id = shop._id || shop.id || shop.merchantId;

              return (
                <button
                  type="button"
                  className="fleet-shop-item"
                  key={id}
                  onClick={() => focusShop(shop)}
                >
                  <strong>{shop.shopName || "Registered Shop"}</strong>
                  <span>{shop.address || "Address not provided"}</span>
                  <small>
                    {[shop.area, shop.city, shop.state]
                      .filter(Boolean)
                      .join(", ")}
                  </small>
                  <small className="fleet-shop-action">
                    Zoom to shop
                  </small>
                </button>
              );
            })
          )}

          <div className="fleet-map-legend">
            <span><i className="shop-dot" /> Registered shop</span>
            <span><i className="partner-dot" /> Delivery partner</span>
            <span><i className="route-line" /> Active delivery route</span>
          </div>
        </aside>
      </div>

      <p className="fleet-note">
        Shop and route data refresh every 60 seconds. GPS tracking uses its
        separate live connection and is not restarted when map data refreshes.
      </p>
    </section>
  );
}
