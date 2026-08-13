"use client";

/*
 * Map.tsx — Leaflet / react-leaflet map component for RoadSense AI
 * Supports:
 *  - Route polylines & selection
 *  - Custom SVG markers (Source, Destination, Current Location)
 *  - Map click destination selection mode
 *  - Map controls for "Select Destination" and "My Location"
 */

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* =====================================================
   LEAFLET ICON FIX FOR NEXT.JS / WEBPACK
===================================================== */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* =====================================================
   CUSTOM SVG MARKER ICONS
===================================================== */
function makePin(color: string, label: string = ""): L.DivIcon {
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="40"
      viewBox="0 0 28 40"
    >
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.268 21.732 0 14 0z"
        fill="${color}"
        stroke="white"
        stroke-width="2"
      />
      <circle cx="14" cy="14" r="5" fill="white" />
    </svg>
  `;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -42],
  });
}

function makeCurrentLocationIcon(): L.DivIcon {
  const svg = `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.25);
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: absolute;
        top: 4px;
        left: 4px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #2563eb;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    </div>
  `;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

const SOURCE_ICON = makePin("#16a34a"); // green pin
const CURRENT_LOC_ICON = makeCurrentLocationIcon(); // blue pulsing dot
const DEST_ICON = makePin("#ef4444");   // red pin

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
    coordinates: [number, number][]; // [longitude, latitude]
  };
  potholeCount?: number;
  riskScore?: number;
  safetyScore?: number;
};

type MapProps = {
  locations: { source: Location; destination: Location } | null;
  routes: Route[];
  selectedRouteId: number | null;
  onRouteSelect: (id: number) => void;
  destinationSelectionMode: boolean;
  setDestinationSelectionMode: (active: boolean) => void;
  onMapDestinationSelect: (lat: number, lng: number) => void;
  onUseCurrentLocation: () => void;
  isGeolocating?: boolean;
};

/* =====================================================
   MAP EVENT HANDLER COMPONENT
===================================================== */
function MapEventsHandler({
  destinationSelectionMode,
  onMapDestinationSelect,
  setDestinationSelectionMode,
}: {
  destinationSelectionMode: boolean;
  onMapDestinationSelect: (lat: number, lng: number) => void;
  setDestinationSelectionMode: (active: boolean) => void;
}) {
  const map = useMap();

  /* Toggle cursor class on map container when mode changes */
  useEffect(() => {
    const container = map.getContainer();
    if (destinationSelectionMode) {
      container.classList.add("selecting-destination-cursor");
    } else {
      container.classList.remove("selecting-destination-cursor");
    }
  }, [map, destinationSelectionMode]);

  useMapEvents({
    click(e) {
      if (!destinationSelectionMode) return;
      const { lat, lng } = e.latlng;
      console.log("RoadSense Map clicked at:", lat, lng);
      onMapDestinationSelect(lat, lng);
      setDestinationSelectionMode(false);
    },
  });

  return null;
}

/* =====================================================
   MAP VIEWPORT UPDATER
===================================================== */
function MapUpdater({
  locations,
  routes,
  selectedRouteId,
}: Pick<MapProps, "locations" | "routes" | "selectedRouteId">) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    /* ── Case 1: Routes exist → fit to selected route ── */
    const selected =
      routes.find((r) => r.id === selectedRouteId) ?? routes[0];

    if (selected?.geometry?.coordinates?.length) {
      const leafletPositions: [number, number][] =
        selected.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      const bounds = L.latLngBounds(leafletPositions);

      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
        animate: true,
        duration: 1,
      });
      return;
    }

    /* ── Case 2: Source + destination locations exist ── */
    if (locations?.source && locations?.destination) {
      const bounds = L.latLngBounds([
        [locations.source.latitude, locations.source.longitude],
        [locations.destination.latitude, locations.destination.longitude],
      ]);

      map.fitBounds(bounds, {
        padding: [100, 100],
        maxZoom: 13,
        animate: true,
        duration: 0.8,
      });
      return;
    }

    /* ── Case 3: Only source location exists (e.g. current location) ── */
    if (locations?.source) {
      map.flyTo(
        [locations.source.latitude, locations.source.longitude],
        13,
        { animate: true, duration: 1 }
      );
    }
  }, [map, locations, routes, selectedRouteId]);

  return null;
}

/* =====================================================
   MAP CONTROLS OVERLAY
===================================================== */
function MapControls({
  destinationSelectionMode,
  setDestinationSelectionMode,
  onUseCurrentLocation,
  isGeolocating,
}: {
  destinationSelectionMode: boolean;
  setDestinationSelectionMode: (active: boolean) => void;
  onUseCurrentLocation: () => void;
  isGeolocating?: boolean;
}) {
  return (
    <div className="map-custom-controls">
      {/* 📌 Select Destination Button */}
      <button
        type="button"
        id="map-select-dest-btn"
        className={`map-control-btn ${
          destinationSelectionMode ? "active-dest-mode" : ""
        }`}
        onClick={() => setDestinationSelectionMode(!destinationSelectionMode)}
        title="Click on map to select destination"
      >
        {destinationSelectionMode ? (
          <>
            <span className="pulse-dot-red" />
            📌 Click map to set destination
            <span className="cancel-badge">✕ Cancel</span>
          </>
        ) : (
          <>📌 Select Destination</>
        )}
      </button>

      {/* ◎ My Location Button */}
      <button
        type="button"
        id="map-my-location-btn"
        className="map-control-btn"
        onClick={onUseCurrentLocation}
        disabled={isGeolocating}
        title="Center map on your current location"
      >
        {isGeolocating ? (
          <>
            <span className="spinner-sm" />
            Locating…
          </>
        ) : (
          <>◎ My Location</>
        )}
      </button>
    </div>
  );
}

/* =====================================================
   MAIN MAP COMPONENT
===================================================== */
export default function Map({
  locations,
  routes,
  selectedRouteId,
  onRouteSelect,
  destinationSelectionMode,
  setDestinationSelectionMode,
  onMapDestinationSelect,
  onUseCurrentLocation,
  isGeolocating,
}: MapProps) {
  const unselected = routes.filter((r) => r.id !== selectedRouteId);
  const selected = routes.filter((r) => r.id === selectedRouteId);

  return (
    <div className="map-container-inner" style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapContainer
        center={[21.15, 75.2]}
        zoom={9}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        {/* OSM tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Viewport manager */}
        <MapUpdater
          locations={locations}
          routes={routes}
          selectedRouteId={selectedRouteId}
        />

        {/* Map Click Listener */}
        <MapEventsHandler
          destinationSelectionMode={destinationSelectionMode}
          onMapDestinationSelect={onMapDestinationSelect}
          setDestinationSelectionMode={setDestinationSelectionMode}
        />

        {/* Source Marker */}
        {locations?.source && (
          <Marker
            position={[
              locations.source.latitude,
              locations.source.longitude,
            ]}
            icon={
              locations.source.isCurrentLocation
                ? CURRENT_LOC_ICON
                : SOURCE_ICON
            }
          >
            <Popup>
              <strong>
                {locations.source.isCurrentLocation
                  ? "🔵 You Are Here"
                  : "Starting Point"}
              </strong>
              <br />
              <span>{locations.source.name}</span>
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {locations?.destination && (
          <Marker
            position={[
              locations.destination.latitude,
              locations.destination.longitude,
            ]}
            icon={DEST_ICON}
          >
            <Popup>
              <strong>Destination</strong>
              <br />
              <span>{locations.destination.name}</span>
            </Popup>
          </Marker>
        )}

        {/* Unselected routes (rendered first = behind) */}
        {unselected.map((route) => {
          const positions: [number, number][] =
            route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

          return (
            <Polyline
              key={route.id}
              positions={positions}
              pathOptions={{
                color: "#64748b",
                weight: 5,
                opacity: 0.55,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () => onRouteSelect(route.id),
              }}
            />
          );
        })}

        {/* Selected route (rendered last = on top) */}
        {selected.map((route) => {
          const positions: [number, number][] =
            route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

          return (
            <Polyline
              key={`sel-${route.id}`}
              positions={positions}
              pathOptions={{
                color: "#2563eb",
                weight: 8,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () => onRouteSelect(route.id),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Floating map controls */}
      <MapControls
        destinationSelectionMode={destinationSelectionMode}
        setDestinationSelectionMode={setDestinationSelectionMode}
        onUseCurrentLocation={onUseCurrentLocation}
        isGeolocating={isGeolocating}
      />
    </div>
  );
}