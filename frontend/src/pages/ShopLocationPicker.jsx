
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  CircleMarker,
  Popup
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./merchant-dashboard.css";

const DEFAULT_CENTER = [20.2961, 85.8245];

function MapClickHandler({ onChange }) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng
      });
    }
  });

  return null;
}

function MapCenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(
        [position.latitude, position.longitude],
        16,
        { duration: 1 }
      );
    }
  }, [position?.latitude, position?.longitude, map]);

  return null;
}

export default function ShopLocationPicker({
  latitude,
  longitude,
  onChange
}) {
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const validCoordinates =
    latitude !== null &&
    latitude !== "" &&
    longitude !== null &&
    longitude !== "" &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;

  const position = validCoordinates
    ? {
        latitude: Number(latitude),
        longitude: Number(longitude)
      }
    : null;

  const center = position
    ? [position.latitude, position.longitude]
    : DEFAULT_CENTER;

  const getCurrentLocation = () => {
    setLocationMessage("");

    if (!window.isSecureContext) {
      setLocationMessage(
        "Location access requires HTTPS or localhost. Open SARATHI using http://localhost:5173."
      );
      setMessageType("error");
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage(
        "Your browser does not support location services."
      );
      setMessageType("error");
      return;
    }

    setLocating(true);
    setLocationMessage("Finding your current location...");
    setMessageType("info");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const lat = result.coords.latitude;
        const lng = result.coords.longitude;

        onChange({
          latitude: lat,
          longitude: lng
        });

        setLocationMessage(
          `Location found successfully. Accuracy: approximately ${Math.round(result.coords.accuracy)} metres.`
        );
        setMessageType("success");
        setLocating(false);
      },
      (error) => {
        let message = "Could not get your location.";

        if (error.code === 1) {
          message =
            "Location permission denied. Allow location access for localhost in Chrome site settings.";
        } else if (error.code === 2) {
          message =
            "Your device could not determine its location. Enable Windows Location Services and check your internet connection.";
        } else if (error.code === 3) {
          message =
            "Location request timed out. Try again, or select your shop manually on the map.";
        }

        setLocationMessage(message);
        setMessageType("error");
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000
      }
    );
  };

  return (
    <div className="shop-location-picker">
      <div className="shop-map-toolbar">
        <div>
          <strong>Select Your Shop Location</strong>
          <p>
            Click the map to place the marker, or use your
            current device location.
          </p>
        </div>

        <button
          type="button"
          className="shop-current-location-btn"
          onClick={getCurrentLocation}
          disabled={locating}
        >
          {locating ? "Finding Location..." : "Use My Current Location"}
        </button>
      </div>

      {locationMessage && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            margin: "10px 0",
            borderRadius: "8px",
            background:
              messageType === "success"
                ? "#e8f7ed"
                : messageType === "info"
                ? "#eaf2ff"
                : "#fff0f0",
            color:
              messageType === "success"
                ? "#176b35"
                : messageType === "info"
                ? "#174b8b"
                : "#b42318",
            fontSize: "13px"
          }}
        >
          {locationMessage}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={position ? 16 : 7}
        scrollWheelZoom
        className="shop-location-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onChange={onChange} />
        <MapCenter position={position} />

        {position && (
          <CircleMarker
            center={[position.latitude, position.longitude]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#ed812b",
              fillOpacity: 1
            }}
          >
            <Popup>
              <strong>Shop Location</strong>
              <br />
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      <div className="shop-coordinate-display">
        {position ? (
          <>
            <span>
              Latitude: <strong>{position.latitude.toFixed(6)}</strong>
            </span>
            <span>
              Longitude: <strong>{position.longitude.toFixed(6)}</strong>
            </span>
          </>
        ) : (
          <span>
            No location selected. Click the map or use your current location.
          </span>
        )}
      </div>
    </div>
  );
}
