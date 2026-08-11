"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

type MapProps = {
  locations: {
    source: Location;
    destination: Location;
  } | null;
};

export default function Map({
  locations,
}: MapProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<any>(null);

  const leafletRef = useRef<any>(null);

  const routeLayerRef = useRef<any>(null);

  const markerLayerRef = useRef<any>(null);

  // --------------------------------------------------
  // 1. INITIALIZE MAP
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (
        mapRef.current ||
        !containerRef.current
      ) {
        return;
      }

      try {
        // Leaflet browser-side only
        const L = await import("leaflet");

        if (
          cancelled ||
          !containerRef.current ||
          mapRef.current
        ) {
          return;
        }

        leafletRef.current = L;

        // --------------------------------------------
        // Create map
        // --------------------------------------------

        const map = L.map(
          containerRef.current
        ).setView(
          [21.18, 75.20],
          9
        );

        mapRef.current = map;

        // --------------------------------------------
        // CARTO Light Tiles
        // --------------------------------------------

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              "&copy; OpenStreetMap contributors &copy; CARTO",

            subdomains:
              "abcd",

            maxZoom: 20,
          }
        ).addTo(map);

        console.log(
          "Leaflet map initialized"
        );

      } catch (error) {
        console.error(
          "Map initialization error:",
          error
        );
      }
    };

    initializeMap();

    // --------------------------------------------
    // Cleanup
    // --------------------------------------------

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();

        mapRef.current = null;
      }

      leafletRef.current = null;

      routeLayerRef.current = null;

      markerLayerRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // 2. UPDATE ROUTE WHEN LOCATIONS CHANGE
  // --------------------------------------------------

  useEffect(() => {
    if (!locations) {
      return;
    }

    const drawRoute = async () => {
      try {
        // Wait until Leaflet map is ready
        if (
          !mapRef.current ||
          !leafletRef.current
        ) {
          return;
        }

        const L = leafletRef.current;

        const map = mapRef.current;

        // --------------------------------------------
        // Source
        // --------------------------------------------

        const source: [
          number,
          number
        ] = [
          locations.source.latitude,
          locations.source.longitude,
        ];

        // --------------------------------------------
        // Destination
        // --------------------------------------------

        const destination: [
          number,
          number
        ] = [
          locations.destination.latitude,
          locations.destination.longitude,
        ];

        console.log(
          "New source:",
          source
        );

        console.log(
          "New destination:",
          destination
        );

        // --------------------------------------------
        // Remove old route
        // --------------------------------------------

        if (routeLayerRef.current) {
          map.removeLayer(
            routeLayerRef.current
          );

          routeLayerRef.current = null;
        }

        // --------------------------------------------
        // Remove old markers
        // --------------------------------------------

        if (markerLayerRef.current) {
          map.removeLayer(
            markerLayerRef.current
          );

          markerLayerRef.current = null;
        }

        // --------------------------------------------
        // Marker Layer
        // --------------------------------------------

        const markerLayer =
          L.layerGroup().addTo(map);

        markerLayerRef.current =
          markerLayer;

        // --------------------------------------------
        // Source Marker
        // --------------------------------------------

        L.circleMarker(source, {
          radius: 9,

          color: "#166534",

          fillColor: "#22c55e",

          fillOpacity: 1,

          weight: 3,
        })
          .addTo(markerLayer)
          .bindPopup(`
            <div style="font-size:14px">
              <strong>Starting Point</strong>
              <br/>
              ${locations.source.name}
            </div>
          `);

        // --------------------------------------------
        // Destination Marker
        // --------------------------------------------

        L.circleMarker(destination, {
          radius: 9,

          color: "#991b1b",

          fillColor: "#ef4444",

          fillOpacity: 1,

          weight: 3,
        })
          .addTo(markerLayer)
          .bindPopup(`
            <div style="font-size:14px">
              <strong>Destination</strong>
              <br/>
              ${locations.destination.name}
            </div>
          `);

        // --------------------------------------------
        // Request Route
        // --------------------------------------------

        const url =
          `/api/route?` +
          `sourceLat=${source[0]}` +
          `&sourceLng=${source[1]}` +
          `&destinationLat=${destination[0]}` +
          `&destinationLng=${destination[1]}`;

        console.log(
          "Requesting route:",
          url
        );

        const response =
          await fetch(url, {
            cache: "no-store",
          });

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(() => null);

          throw new Error(
            errorData?.message ||
              `Routing API failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        if (!data.success) {
          throw new Error(
            data.message ||
              "Route not available"
          );
        }

        // --------------------------------------------
        // Route validation
        // --------------------------------------------

        const route =
          data.route;

        if (
          !route ||
          !route.geometry ||
          !route.geometry.coordinates
        ) {
          throw new Error(
            "Route geometry is missing"
          );
        }

        // --------------------------------------------
        // OSRM → Leaflet coordinates
        //
        // OSRM:
        // [longitude, latitude]
        //
        // Leaflet:
        // [latitude, longitude]
        // --------------------------------------------

        const routeCoordinates =
          route.geometry.coordinates.map(
            (
              coordinate: [
                number,
                number
              ]
            ) => {
              const [
                longitude,
                latitude,
              ] = coordinate;

              return [
                latitude,
                longitude,
              ] as [
                number,
                number
              ];
            }
          );

        // --------------------------------------------
        // Draw actual road route
        // --------------------------------------------

        const routeLine =
          L.polyline(
            routeCoordinates,
            {
              color: "#2563eb",

              weight: 7,

              opacity: 0.85,

              lineCap: "round",

              lineJoin: "round",
            }
          ).addTo(map);

        routeLayerRef.current =
          routeLine;

        // --------------------------------------------
        // Fit map to route
        // --------------------------------------------

        map.fitBounds(
          routeLine.getBounds(),
          {
            padding: [
              50,
              50,
            ],
          }
        );

        // --------------------------------------------
        // Distance
        // --------------------------------------------

        const distanceKm =
          (
            route.distance /
            1000
          ).toFixed(1);

        // --------------------------------------------
        // Duration
        // --------------------------------------------

        const durationMinutes =
          Math.round(
            route.duration /
              60
          );

        const hours =
          Math.floor(
            durationMinutes /
              60
          );

        const minutes =
          durationMinutes %
          60;

        const timeText =
          hours > 0
            ? `${hours}h ${minutes}m`
            : `${minutes}m`;

        // --------------------------------------------
        // Route Popup
        // --------------------------------------------

        routeLine.bindPopup(`
          <div style="font-size:14px">

            <strong>
              ${locations.source.name}
              →
              ${locations.destination.name}
            </strong>

            <br/>
            <br/>

            Distance:
            <strong>
              ${distanceKm} km
            </strong>

            <br/>

            Estimated Time:
            <strong>
              ${timeText}
            </strong>

          </div>
        `);

        console.log(
          "Route distance:",
          distanceKm,
          "km"
        );

        console.log(
          "Route duration:",
          timeText
        );

        console.log(
          "Routing provider:",
          data.provider
        );

      } catch (error) {
        console.error(
          "Routing error:",
          error
        );
      }
    };

    drawRoute();

  }, [locations]);

  // --------------------------------------------------
  // 3. MAP CONTAINER
  // --------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="map-container"
    />
  );
}