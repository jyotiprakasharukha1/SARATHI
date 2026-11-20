
import { io } from "socket.io-client";
import * as Cesium from "cesium";

const API_URL = "http://localhost:5000";

const ALLOWED_PARENT_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:5174"
]);

// SARATHI reference location: Buguda, Ganjam, Odisha.
const SARATHI_REFERENCE = {
  latitude: 19.81,
  longitude: 84.79
};

// Initial camera height when focusing a shop.
const SHOP_CAMERA_HEIGHT = 7000;

export function startSarathiFleetTracking({ viewer, signal, defer }) {
  let socket = null;
  let disposed = false;

  const partnerEntities = new Map();
  const shopEntities = new Map();

  // Prevent camera movement during subsequent shop refreshes.
  let initialShopCameraApplied = false;

  const isViewerAvailable = () =>
    !disposed && !viewer.isDestroyed();

  // ========================================
  // HTML SAFETY
  // ========================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ========================================
  // COORDINATE VALIDATION
  // ========================================

  function validCoordinates(latitude, longitude) {
    if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined ||
      latitude === "" ||
      longitude === ""
    ) {
      return false;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  // ========================================
  // DISTANCE FROM BUGUDA
  // ========================================

  function calculateDistanceFromBuguda(latitude, longitude) {
    const toRadians = (degrees) =>
      degrees * (Math.PI / 180);

    const earthRadiusKm = 6371;

    const lat1 = toRadians(SARATHI_REFERENCE.latitude);
    const lat2 = toRadians(Number(latitude));

    const deltaLat = toRadians(
      Number(latitude) - SARATHI_REFERENCE.latitude
    );

    const deltaLng = toRadians(
      Number(longitude) - SARATHI_REFERENCE.longitude
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    const c = 2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

    return earthRadiusKm * c;
  }

  // ========================================
  // FIND NEAREST APPROVED SHOP
  // ========================================

  function findNearestShop(shops) {
    const validShops = shops.filter((shop) =>
      validCoordinates(shop?.latitude, shop?.longitude)
    );

    if (!validShops.length) return null;

    return validShops
      .map((shop) => ({
        shop,
        distance: calculateDistanceFromBuguda(
          shop.latitude,
          shop.longitude
        )
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  }

  // ========================================
  // INITIAL CAMERA MOVEMENT
  // ========================================

  function focusNearestShopOnce(shops) {
    if (!isViewerAvailable() || initialShopCameraApplied) {
      return;
    }

    const nearest = findNearestShop(shops);

    // If there are no shops yet, keep the Buguda fallback.
    // A later successful refresh can still focus the first shop.
    if (!nearest) return;

    const shop = nearest.shop;

    const latitude = Number(shop.latitude);
    const longitude = Number(shop.longitude);

    const shopName = shop.shopName || shop.name || "Registered Shop";

    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          SHOP_CAMERA_HEIGHT
        ),
        duration: 2
      });

      initialShopCameraApplied = true;

      console.info(
        `[SARATHI] Camera focused on nearest shop: ${shopName}.`,
        `Distance from Buguda: ${nearest.distance.toFixed(2)} km`
      );
    } catch (error) {
      console.error(
        "[SARATHI] Unable to focus nearest shop:",
        error
      );
    }
  }

  // ========================================
  // DELIVERY PARTNER VALIDATION
  // ========================================

  function isValidPartner(location) {
    return (
      location &&
      location.deliveryPartnerId &&
      validCoordinates(
        location.latitude,
        location.longitude
      )
    );
  }

  // ========================================
  // UPDATE MOVING DELIVERY PARTNER
  // ========================================

  function updatePartnerMarker(location) {
    if (!isViewerAvailable() || !isValidPartner(location)) {
      return;
    }

    const {
      deliveryPartnerId,
      deliveryPartnerName,
      orderNumber,
      latitude,
      longitude,
      updatedAt
    } = location;

    const key = String(deliveryPartnerId);
    const name = deliveryPartnerName || "Delivery Partner";

    const position = Cesium.Cartesian3.fromDegrees(
      Number(longitude),
      Number(latitude)
    );

    const description = [
      `<strong>${escapeHtml(name)}</strong>`,
      `<p>Order: ${escapeHtml(orderNumber || "N/A")}</p>`,
      `<p>Latitude: ${Number(latitude).toFixed(6)}</p>`,
      `<p>Longitude: ${Number(longitude).toFixed(6)}</p>`,
      `<p>Updated: ${escapeHtml(updatedAt || "N/A")}</p>`
    ].join("");

    let entity = partnerEntities.get(key);

    if (!entity) {
      entity = viewer.entities.add({
        id: `sarathi-partner-${key}`,
        name,
        position,

        point: {
          pixelSize: 13,
          color: Cesium.Color.DODGERBLUE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        },

        label: {
          text: name,
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },

        description
      });

      partnerEntities.set(key, entity);
    } else {
      entity.position = position;
      entity.name = name;
      entity.label.text = name;
      entity.description = description;
    }

    notifyParentStatus();
  }

  // ========================================
  // REMOVE DELIVERY PARTNER
  // ========================================

  function removePartnerMarker(deliveryPartnerId) {
    if (!deliveryPartnerId || !isViewerAvailable()) {
      return;
    }

    const key = String(deliveryPartnerId);
    const entity = partnerEntities.get(key);

    if (entity) {
      viewer.entities.remove(entity);
      partnerEntities.delete(key);
      notifyParentStatus();
    }
  }

  // ========================================
  // CREATE / REFRESH FIXED SHOP MARKERS
  // ========================================

  function replaceShopMarkers(shops) {
    if (!isViewerAvailable()) return;

    // Focus the nearest shop only on the first valid shop load.
    // Later refreshes will never reset the camera.
    focusNearestShopOnce(shops);

    // Remove only existing shop markers.
    // Delivery partner entities remain untouched.
    for (const entity of shopEntities.values()) {
      viewer.entities.remove(entity);
    }

    shopEntities.clear();

    for (const shop of shops) {
      const id =
        shop?._id ||
        shop?.id ||
        shop?.merchantId;

      if (
        !id ||
        !validCoordinates(
          shop?.latitude,
          shop?.longitude
        )
      ) {
        continue;
      }

      const latitude = Number(shop.latitude);
      const longitude = Number(shop.longitude);

      const shopName =
        shop.shopName ||
        shop.name ||
        "Registered Shop";

      const address = shop.address || "";
      const area = shop.area || "";
      const city = shop.city || "";
      const state = shop.state || "";
      const pincode = shop.pincode || "";

      const entity = viewer.entities.add({
        id: `sarathi-shop-${String(id)}`,
        name: shopName,

        position: Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude
        ),

        // Orange fixed shop marker.
        point: {
          pixelSize: 17,
          color: Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        },

        label: {
          text: shopName,
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -21),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },

        description: [
          `<h3>${escapeHtml(shopName)}</h3>`,
          `<p><strong>Address:</strong> ${escapeHtml(address || "Not provided")}</p>`,
          area
            ? `<p><strong>Area:</strong> ${escapeHtml(area)}</p>`
            : "",
          `<p><strong>City:</strong> ${escapeHtml(city || "Not provided")}</p>`,
          state
            ? `<p><strong>State:</strong> ${escapeHtml(state)}</p>`
            : "",
          pincode
            ? `<p><strong>Pincode:</strong> ${escapeHtml(pincode)}</p>`
            : "",
          `<p><strong>Coordinates:</strong> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>`
        ].join("")
      });

      shopEntities.set(String(id), entity);
    }

    // Send updated shop count to the parent React dashboard.
    for (const origin of ALLOWED_PARENT_ORIGINS) {
      window.parent.postMessage(
        {
          type: "sarathi:shop-count",
          count: shopEntities.size
        },
        origin
      );
    }

    console.info(
      `[SARATHI] Shop markers refreshed: ${shopEntities.size}`
    );
  }

  // ========================================
  // NOTIFY PARENT DASHBOARD
  // ========================================

  function notifyParentStatus(status) {
    if (!isViewerAvailable()) return;

    const payload = {
      type: "sarathi:fleet-status",

      status:
        status ||
        (socket?.connected ? "connected" : "disconnected"),

      driverCount: partnerEntities.size
    };

    for (const origin of ALLOWED_PARENT_ORIGINS) {
      window.parent.postMessage(payload, origin);
    }
  }

  // ========================================
  // EXCHANGE SECURE FLEET TICKET
  // ========================================

  async function exchangeTicket(ticket) {
    const response = await fetch(
      `${API_URL}/api/fleet-session/exchange`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({ ticket }),
        signal
      }
    );

    if (!response.ok) {
      throw new Error(
        `Fleet ticket exchange failed (${response.status})`
      );
    }

    const result = await response.json();

    if (!result.success || !result.token) {
      throw new Error(
        "Fleet ticket exchange returned an invalid response"
      );
    }

    return result.token;
  }

  // ========================================
  // CONNECT LIVE DELIVERY TRACKING
  // ========================================

  function connectFleetSocket(token) {
    if (disposed || signal?.aborted) return;

    socket?.disconnect();

    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true
    });

    socket.on("fleet-snapshot", (snapshot) => {
      const locations = Array.isArray(snapshot)
        ? snapshot
        : snapshot?.locations || [];

      locations.forEach(updatePartnerMarker);
    });

    socket.on(
      "fleet-location-updated",
      updatePartnerMarker
    );

    socket.on("fleet-location-removed", (data) => {
      const id =
        typeof data === "string"
          ? data
          : data?.deliveryPartnerId;

      removePartnerMarker(id);
    });

    socket.on("connect", () => {
      console.info(
        "[SARATHI Fleet] Live delivery tracking connected."
      );

      notifyParentStatus("connected");
    });

    socket.on("disconnect", () => {
      notifyParentStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error(
        "[SARATHI Fleet] Socket connection failed:",
        error.message
      );

      notifyParentStatus("error");
    });
  }

  // ========================================
  // RECEIVE MESSAGES FROM REACT ADMIN
  // ========================================

  async function handleMessage(event) {
    if (
      event.source !== window.parent ||
      !ALLOWED_PARENT_ORIGINS.has(event.origin)
    ) {
      return;
    }

    if (!event.data || typeof event.data !== "object") {
      return;
    }

    // Receive approved shop locations.
    if (event.data.type === "sarathi:shop-locations") {
      if (Array.isArray(event.data.shops)) {
        replaceShopMarkers(event.data.shops);
      }

      return;
    }

    // Receive secure fleet ticket.
    if (event.data.type !== "sarathi:fleet-ticket") {
      return;
    }

    const ticket = event.data.ticket;

    if (
      typeof ticket !== "string" ||
      !/^[a-f0-9]{64}$/i.test(ticket)
    ) {
      console.error("[SARATHI Fleet] Invalid fleet ticket.");
      return;
    }

    try {
      const token = await exchangeTicket(ticket);

      if (!disposed && !signal?.aborted) {
        connectFleetSocket(token);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          "[SARATHI Fleet] Authentication failed:",
          error.message
        );

        notifyParentStatus("error");
      }
    }
  }

  // ========================================
  // INITIALIZE PARENT COMMUNICATION
  // ========================================

  window.addEventListener("message", handleMessage);

  for (const origin of ALLOWED_PARENT_ORIGINS) {
    window.parent.postMessage(
      {
        type: "sarathi:fleet-ready"
      },
      origin
    );
  }

  // ========================================
  // CLEANUP
  // ========================================

  const cleanup = () => {
    if (disposed) return;

    disposed = true;

    window.removeEventListener(
      "message",
      handleMessage
    );

    socket?.disconnect();
    socket = null;

    if (!viewer.isDestroyed()) {
      for (const entity of partnerEntities.values()) {
        viewer.entities.remove(entity);
      }

      for (const entity of shopEntities.values()) {
        viewer.entities.remove(entity);
      }
    }

    partnerEntities.clear();
    shopEntities.clear();
  };

  signal?.addEventListener("abort", cleanup, {
    once: true
  });

  defer(cleanup);

  return cleanup;
}
