import { useState } from "react";
import { MapPin, Navigation, Search, X } from "lucide-react";

export default function LocationPicker({ value, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const useCurrentLocation = () => {
    setError("");

    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        let label = "Current location";

        try {
          const url = new URL(
            "https://nominatim.openstreetmap.org/reverse"
          );

          url.search = new URLSearchParams({
            format: "jsonv2",
            lat: latitude,
            lon: longitude
          }).toString();

          const response = await fetch(url);
          const data = await response.json();

          if (data.display_name) {
            label = data.display_name.split(",").slice(0, 3).join(",");
          }
        } catch (geocodeError) {
          console.error("Reverse geocoding error:", geocodeError);
        }

        onSelect({ label, latitude, longitude });
        setLoading(false);
        setIsOpen(false);
      },
      locationError => {
        setLoading(false);

        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError("Location permission denied. Allow GPS access in your browser.");
        } else if (locationError.code === locationError.TIMEOUT) {
          setError("Location request timed out. Try again.");
        } else {
          setError("Unable to detect your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  };

  const searchAddress = async event => {
    event.preventDefault();
    setError("");

    if (!query.trim()) {
      setError("Enter an area, city or address.");
      return;
    }

    try {
      setLoading(true);

      const url = new URL("https://nominatim.openstreetmap.org/search");

      url.search = new URLSearchParams({
        format: "jsonv2",
        q: `${query.trim()}, India`,
        countrycodes: "in",
        limit: "1"
      }).toString();

      const response = await fetch(url);
      const results = await response.json();

      if (!results.length) {
        throw new Error("No matching address found. Try another search.");
      }

      const result = results[0];

      onSelect({
        label: result.display_name.split(",").slice(0, 3).join(","),
        latitude: Number(result.lat),
        longitude: Number(result.lon)
      });

      setQuery("");
      setIsOpen(false);
    } catch (searchError) {
      setError(searchError.message || "Address search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="delivery-location location-picker-trigger"
        onClick={() => setIsOpen(true)}
      >
        <MapPin size={19} />

        <span className="location-picker-label">
          <small>DELIVERING TO</small>
          <strong>{value?.label || "Select your location"}</strong>
        </span>

        <span className="location-picker-arrow">⌄</span>
      </button>

      {isOpen && (
        <div
          className="location-picker-overlay"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="location-picker-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="location-picker-heading">
              <div>
                <span className="section-eyebrow">SARATHI DELIVERY</span>
                <h2>Choose your location</h2>
                <p>Find local shops and products near you.</p>
              </div>

              <button
                type="button"
                className="location-picker-close"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <button
              type="button"
              className="location-gps-button"
              onClick={useCurrentLocation}
              disabled={loading}
            >
              <Navigation size={19} />
              {loading ? "Finding location..." : "Use my current location"}
            </button>

            <div className="location-picker-divider">
              <span>OR SEARCH MANUALLY</span>
            </div>

            <form onSubmit={searchAddress}>
              <div className="location-search-field">
                <Search size={18} />

                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Enter area, city or address"
                />
              </div>

              <button
                type="submit"
                className="location-search-submit"
                disabled={loading}
              >
                {loading ? "Searching..." : "Search location"}
              </button>
            </form>

            {error && (
              <p className="location-picker-error">{error}</p>
            )}

            {value?.label && (
              <div className="location-current-selection">
                <MapPin size={17} />
                <div>
                  <small>SELECTED LOCATION</small>
                  <strong>{value.label}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}