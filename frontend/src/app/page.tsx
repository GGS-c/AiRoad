"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

/* =====================================================
   TYPES
===================================================== */

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
};

type Route = {
  id: number;
  distance: number;
  duration: number;

  geometry: {
    type?: "LineString";
    coordinates: [number, number][]; // [longitude, latitude] — OSRM format
  };

  potholeCount?: number;
  riskScore?: number;
  safetyScore?: number;
};

/* =====================================================
   DYNAMIC MAP IMPORT (ssr: false)
===================================================== */

const MapComponent = dynamic(() => import("./components/Map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f4f8",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div className="loading-spinner" />
      <span style={{ color: "#6b7280", fontSize: "14px" }}>
        Loading RoadSense map…
      </span>
    </div>
  ),
});

/* =====================================================
   PAGE COMPONENT
===================================================== */

export default function Home() {
  /* ── Search input text ───────────────────────────── */
  const [from, setFrom] = useState("Shirpur Dhule");
  const [to, setTo] = useState("Jalgaon");

  /* ── Explicit coordinate states ─────────────────── */
  const [sourceLocation, setSourceLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);

  /* ── Map click selection mode ────────────────────── */
  const [destinationSelectionMode, setDestinationSelectionMode] = useState(false);

  /* ── App state ──────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mapLocations, setMapLocations] = useState<{
    source: Location;
    destination: Location;
  } | null>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  /* ===================================================
     HELPER: SEARCH LOCATION BY TEXT
  =================================================== */

  async function searchLocation(query: string): Promise<Location | null> {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query.trim())}`
    );
    const data = await res.json();

    if (
      !data.success ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      return null;
    }

    const r = data.results[0];
    return {
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
    };
  }

  /* ===================================================
     HELPER: REVERSE GEOCODE COORDINATES
  =================================================== */

  async function reverseGeocode(
    lat: number,
    lng: number
  ): Promise<Location | null> {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (data.success && data.location) {
        return {
          name: data.location.name,
          latitude: lat,
          longitude: lng,
        };
      }
    } catch (err) {
      console.error("Reverse geocode failed:", err);
    }

    return {
      name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      latitude: lat,
      longitude: lng,
    };
  }

  /* ===================================================
     FEATURE: USE CURRENT LOCATION
  =================================================== */

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsGeolocating(true);
    setStatusMessage("Getting your location…");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log("Current location acquired:", latitude, longitude);

        setStatusMessage("Identifying your location…");

        // Reverse geocode
        const loc = await reverseGeocode(latitude, longitude);
        const userLoc: Location = {
          name: loc ? loc.name : "Current location",
          latitude,
          longitude,
          isCurrentLocation: true,
        };

        setSourceLocation(userLoc);
        setFrom(userLoc.name);

        // Update map source marker
        setMapLocations((prev) =>
          prev
            ? { ...prev, source: userLoc }
            : {
                source: userLoc,
                destination: {
                  name: "Target Location",
                  latitude,
                  longitude,
                },
              }
        );

        // Clear existing routes if source changed
        setRoutes([]);
        setIsGeolocating(false);
        setStatusMessage(null);
      },
      (geoErr) => {
        setIsGeolocating(false);
        setStatusMessage(null);
        console.error("Geolocation error:", geoErr);

        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            setError(
              "Location permission denied. Please allow location access in your browser."
            );
            break;
          case geoErr.POSITION_UNAVAILABLE:
            setError("Your current location could not be determined.");
            break;
          case geoErr.TIMEOUT:
            setError("Location request timed out. Please try again.");
            break;
          default:
            setError("Unable to retrieve your current location.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }, []);

  /* ===================================================
     FEATURE: MAP CLICK DESTINATION SELECTION
  =================================================== */

  const handleMapDestinationSelect = useCallback(
    async (lat: number, lng: number) => {
      console.log("Map destination clicked:", lat, lng);
      setError(null);

      // Temporary location while geocoding
      const tempDest: Location = {
        name: "Identifying location…",
        latitude: lat,
        longitude: lng,
      };

      setDestinationLocation(tempDest);
      setTo("Identifying location…");

      // Update map destination marker immediately
      setMapLocations((prev) =>
        prev
          ? { ...prev, destination: tempDest }
          : {
              source: sourceLocation || {
                name: "Starting point",
                latitude: lat,
                longitude: lng,
              },
              destination: tempDest,
            }
      );

      // Clear previous routes since destination changed
      setRoutes([]);

      // Reverse geocode
      const resolved = await reverseGeocode(lat, lng);
      const finalDest: Location = {
        name: resolved ? resolved.name : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        latitude: lat,
        longitude: lng,
      };

      setDestinationLocation(finalDest);
      setTo(finalDest.name);

      setMapLocations((prev) =>
        prev ? { ...prev, destination: finalDest } : null
      );
    },
    [sourceLocation]
  );

  /* ===================================================
     FEATURE: FIND ROUTE (ROUTING HANDLER)
  =================================================== */

  const handleSearch = useCallback(async () => {
    const fromQ = from.trim();
    const toQ = to.trim();

    if (!fromQ || !toQ) {
      setError("Please enter both From and To locations.");
      return;
    }

    setLoading(true);
    setStatusMessage("Finding safest route…");
    setError(null);
    setRoutes([]);
    setSelectedRouteId(null);

    try {
      /* 1. Resolve Source Location */
      let src: Location | null = null;
      if (sourceLocation && (fromQ === sourceLocation.name || fromQ === "Current location")) {
        src = sourceLocation;
      } else {
        src = await searchLocation(fromQ);
      }

      /* 2. Resolve Destination Location */
      let dst: Location | null = null;
      if (
        destinationLocation &&
        (toQ === destinationLocation.name || toQ === "Identifying location…")
      ) {
        dst = destinationLocation;
      } else {
        dst = await searchLocation(toQ);
      }

      if (!src) {
        setError(`Location not found: "${fromQ}"`);
        return;
      }
      if (!dst) {
        setError(`Location not found: "${toQ}"`);
        return;
      }

      // Sync state & map markers
      setSourceLocation(src);
      setDestinationLocation(dst);
      setMapLocations({ source: src, destination: dst });

      console.log("RoadSense routing source:", src);
      console.log("RoadSense routing destination:", dst);

      /* 3. Call Routing API with exact coordinates */
      const routeRes = await fetch(
        `/api/route` +
          `?sourceLat=${src.latitude}` +
          `&sourceLng=${src.longitude}` +
          `&destinationLat=${dst.latitude}` +
          `&destinationLng=${dst.longitude}`
      );

      const routeData = await routeRes.json();
      console.log("RoadSense route API response:", routeData);

      if (!routeData.success || !Array.isArray(routeData.routes)) {
        setError(
          routeData.message || "No route found between these locations."
        );
        return;
      }

      const receivedRoutes: Route[] = routeData.routes.filter(
        (r: Route) =>
          r.geometry &&
          Array.isArray(r.geometry.coordinates) &&
          r.geometry.coordinates.length >= 2
      );

      console.log("RoadSense routes received:", receivedRoutes.length);

      if (receivedRoutes.length === 0) {
        setError("No drivable route found. Try different locations.");
        return;
      }

      setRoutes(receivedRoutes);
      setSelectedRouteId(receivedRoutes[0].id);
    } catch (err) {
      console.error("RoadSense search error:", err);
      setError("Something went wrong calculating the route. Please try again.");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  }, [from, to, sourceLocation, destinationLocation]);

  /* ── Swap handler ───────────────────────────────── */
  const handleSwap = useCallback(() => {
    setFrom(to);
    setTo(from);

    const tempLoc = sourceLocation;
    setSourceLocation(destinationLocation);
    setDestinationLocation(tempLoc);

    if (mapLocations) {
      setMapLocations({
        source: mapLocations.destination,
        destination: mapLocations.source,
      });
    }
  }, [from, to, sourceLocation, destinationLocation, mapLocations]);

  /* ── Derived values ─────────────────────────────── */
  const selectedRoute =
    routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

  /* ====================================================
     RENDER
  ==================================================== */
  return (
    <div className="app">
      {/* ─── Header ─────────────────────────────────── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🛣️</div>
          <div>
            <h1>RoadSense AI</h1>
            <p>AI-powered road safety routing</p>
          </div>
        </div>
        <div className="live">
          <span />
          Live Analysis
        </div>
      </header>

      {/* ─── Map Wrapper ────────────────────────────── */}
      <main className="map-wrapper">
        <MapComponent
          locations={mapLocations}
          routes={routes}
          selectedRouteId={selectedRouteId}
          onRouteSelect={setSelectedRouteId}
          destinationSelectionMode={destinationSelectionMode}
          setDestinationSelectionMode={setDestinationSelectionMode}
          onMapDestinationSelect={handleMapDestinationSelect}
          onUseCurrentLocation={handleUseCurrentLocation}
          isGeolocating={isGeolocating}
        />

        {/* ─ Search Panel ─ */}
        <div className="search-panel">
          {/* FROM Input */}
          <div className="location">
            <span className="dot green" />
            <div className="input-container">
              <div className="input-header-row">
                <small>FROM</small>
                <button
                  type="button"
                  id="use-my-location-btn"
                  className="inline-my-location-btn"
                  onClick={handleUseCurrentLocation}
                  disabled={isGeolocating}
                  title="Use your current GPS location"
                >
                  {isGeolocating ? "Locating…" : "📍 My Location"}
                </button>
              </div>
              <input
                id="from-input"
                type="text"
                value={from}
                placeholder="Starting location…"
                onChange={(e) => {
                  setFrom(e.target.value);
                  setSourceLocation(null); // Reset explicit source location on manual edit
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>

          {/* SWAP Button */}
          <button
            id="swap-btn"
            className="swap-btn"
            onClick={handleSwap}
            title="Swap locations"
            type="button"
          >
            ⇄
          </button>

          {/* TO Input */}
          <div className="location">
            <span className="dot red" />
            <div className="input-container">
              <small>TO</small>
              <input
                id="to-input"
                type="text"
                value={to}
                placeholder="Destination or click map…"
                onChange={(e) => {
                  setTo(e.target.value);
                  setDestinationLocation(null); // Reset explicit destination location on manual edit
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>

          {/* FIND ROUTE Button */}
          <button
            id="search-btn"
            className="search-btn"
            onClick={handleSearch}
            disabled={loading || isGeolocating}
            type="button"
          >
            {loading ? (
              <>
                <span className="spinner" />
                Routing…
              </>
            ) : (
              <>🔍 Find Route</>
            )}
          </button>
        </div>

        {/* ─ Error Alert ─ */}
        {error && (
          <div className="error-message" role="alert">
            ⚠️ {error}
            <button onClick={() => setError(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {/* ─ Loading Overlay ─ */}
        {(loading || isGeolocating || statusMessage) && (
          <div className="map-loading" aria-live="polite">
            <div className="loading-card">
              <div className="loading-spinner" />
              <strong>{statusMessage || "Processing request…"}</strong>
              <span>Analyzing road safety and traffic</span>
            </div>
          </div>
        )}

        {/* ─ Hint (No routes yet) ─ */}
        {!loading && !isGeolocating && routes.length === 0 && !error && (
          <div className="map-hint">
            <div className="map-hint-icon">🗺️</div>
            <strong>Choose starting point &amp; destination</strong>
            <span>
              Enter text above, use 📍 <strong>My Location</strong>, or click 📌 <strong>Select Destination</strong> on the map.
            </span>
          </div>
        )}

        {/* ─ Route List ─ */}
        {routes.length > 0 && (
          <div className="route-list">
            <div className="route-list-header">
              <div>
                <h3>Available Routes</h3>
                <p>Click a route to highlight it</p>
              </div>
              <span className="route-count">{routes.length}</span>
            </div>
            <div className="route-options">
              {routes.map((route) => {
                const isActive = route.id === selectedRouteId;
                const km = (route.distance / 1000).toFixed(1);
                const min = Math.round(route.duration / 60);
                return (
                  <button
                    key={route.id}
                    id={`route-option-${route.id}`}
                    className={`route-option${isActive ? " active" : ""}`}
                    onClick={() => setSelectedRouteId(route.id)}
                    type="button"
                  >
                    <div className="route-option-top">
                      <div className="route-name">
                        <span className="route-number">{route.id}</span>
                        <span>
                          {isActive ? "Selected Route" : `Route ${route.id}`}
                        </span>
                      </div>
                      {isActive && (
                        <span className="selected-label">✓ Active</span>
                      )}
                    </div>
                    <div className="route-option-bottom">
                      <span>📏 {km} km</span>
                      <span>⏱ {min} min</span>
                      <span>
                        🛡️{" "}
                        {route.safetyScore != null
                          ? `${route.safetyScore}% safe`
                          : "AI pending"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─ Selected Route Details Card ─ */}
        {selectedRoute && mapLocations && (
          <div className="route-card">
            <div className="route-card-header">
              <div>
                <span className="recommended">RECOMMENDED ROUTE</span>
                <h2>
                  {mapLocations.source.name.split(",")[0]} →{" "}
                  {mapLocations.destination.name.split(",")[0]}
                </h2>
              </div>
              <div className="safe-badge">
                🛡️{" "}
                {selectedRoute.safetyScore != null
                  ? `${selectedRoute.safetyScore}% Safe`
                  : "AI Pending"}
              </div>
            </div>
            <div className="route-stats">
              <div className="stat">
                <small>DISTANCE</small>
                <strong>
                  {(selectedRoute.distance / 1000).toFixed(1)}
                  <span className="unit"> km</span>
                </strong>
              </div>
              <div className="stat">
                <small>ETA</small>
                <strong>
                  {Math.round(selectedRoute.duration / 60)}
                  <span className="unit"> min</span>
                </strong>
              </div>
              <div className="stat">
                <small>POTHOLES</small>
                <strong>
                  {selectedRoute.potholeCount ?? "—"}
                  {selectedRoute.potholeCount != null && (
                    <span className="unit quality"> low</span>
                  )}
                </strong>
              </div>
            </div>
            <div className="road-info">
              <span>Via state highways &amp; national roads</span>
              <strong>Road quality: Good</strong>
            </div>
            <div className="ai-status">
              <span className="ai-dot" />
              AI road analysis active • OSRM routing
            </div>
          </div>
        )}
      </main>
    </div>
  );
}