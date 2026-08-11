"use client";

import { useState } from "react";
import Map from "./components/Map";

type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

type RouteData = {
  distance: number;
  duration: number;
};

export default function Home() {
  const [from, setFrom] = useState("Shirpur");
  const [to, setTo] = useState("Jalgaon");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [route, setRoute] =
    useState<RouteData | null>(null);

  const [mapLocations, setMapLocations] =
    useState<{
      source: Location;
      destination: Location;
    } | null>(null);

  // --------------------------------------------------
  // Search location using our /api/search endpoint
  // --------------------------------------------------

  const searchLocation = async (
    query: string
  ): Promise<Location | null> => {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return null;
    }

    const response = await fetch(
      `/api/search?q=${encodeURIComponent(
        cleanQuery
      )}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Location search failed (${response.status})`
      );
    }

    const data = await response.json();

    if (
      !data.success ||
      !data.results ||
      data.results.length === 0
    ) {
      return null;
    }

    return data.results[0];
  };

  // --------------------------------------------------
  // Find Route
  // --------------------------------------------------

  const findRoute = async () => {
    setError("");
    setRoute(null);

    const sourceText = from.trim();
    const destinationText = to.trim();

    if (!sourceText || !destinationText) {
      setError(
        "Please enter both starting point and destination."
      );
      return;
    }

    if (
      sourceText.toLowerCase() ===
      destinationText.toLowerCase()
    ) {
      setError(
        "Starting point and destination cannot be the same."
      );
      return;
    }

    setLoading(true);

    try {
      // ----------------------------------------------
      // 1. Find source
      // ----------------------------------------------

      const source =
        await searchLocation(sourceText);

      if (!source) {
        setError(
          `Could not find "${sourceText}". Try a more specific location.`
        );
        return;
      }

      // ----------------------------------------------
      // 2. Find destination
      // ----------------------------------------------

      const destination =
        await searchLocation(destinationText);

      if (!destination) {
        setError(
          `Could not find "${destinationText}". Try a more specific location.`
        );
        return;
      }

      // ----------------------------------------------
      // 3. Request route from OSRM
      // ----------------------------------------------

      const routeUrl =
        `/api/route?` +
        `sourceLat=${source.latitude}` +
        `&sourceLng=${source.longitude}` +
        `&destinationLat=${destination.latitude}` +
        `&destinationLng=${destination.longitude}`;

      const response =
        await fetch(routeUrl, {
          cache: "no-store",
        });

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          errorData?.message ||
            `Routing failed (${response.status})`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to calculate route."
        );
      }

      if (!data.route) {
        throw new Error(
          "Route information is missing."
        );
      }

      // ----------------------------------------------
      // 4. Update map
      // ----------------------------------------------

      setMapLocations({
        source,
        destination,
      });

      // ----------------------------------------------
      // 5. Update route information
      // ----------------------------------------------

      setRoute({
        distance: data.route.distance,
        duration: data.route.duration,
      });

    } catch (error) {
      console.error(
        "Route search error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to find route."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Swap From / To
  // --------------------------------------------------

  const swapLocations = () => {
    const oldFrom = from;

    setFrom(to);
    setTo(oldFrom);

    // Clear previous route because locations changed
    setRoute(null);
    setMapLocations(null);
    setError("");
  };

  // --------------------------------------------------
  // Enter key support
  // --------------------------------------------------

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" && !loading) {
      findRoute();
    }
  };

  // --------------------------------------------------
  // Route calculations
  // --------------------------------------------------

  const distance = route
    ? (route.distance / 1000).toFixed(1)
    : "--";

  const totalMinutes = route
    ? Math.round(route.duration / 60)
    : 0;

  const hours = Math.floor(
    totalMinutes / 60
  );

  const minutes = totalMinutes % 60;

  const duration = route
    ? hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m`
    : "--";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="app">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="header">

        <div className="logo">

          <div className="logo-icon">
            🚗
          </div>

          <div>
            <h1>RoadSense AI</h1>

            <p>
              AI-powered road safety
            </p>
          </div>

        </div>

        <div className="live">
          <span />
          Live
        </div>

      </header>

      {/* ==================================================
          SEARCH PANEL
      ================================================== */}

      <section className="search-panel">

        {/* FROM */}

        <div className="location">

          <span className="dot green" />

          <div className="input-container">

            <small>
              FROM
            </small>

            <input
              type="text"
              value={from}
              onChange={(event) =>
                setFrom(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Starting location"
              autoComplete="off"
            />

          </div>

        </div>


        {/* SWAP BUTTON */}

        <button
          type="button"
          className="swap-btn"
          onClick={swapLocations}
          disabled={loading}
          aria-label="Swap locations"
          title="Swap locations"
        >
          ⇅
        </button>


        {/* TO */}

        <div className="location">

          <span className="dot red" />

          <div className="input-container">

            <small>
              TO
            </small>

            <input
              type="text"
              value={to}
              onChange={(event) =>
                setTo(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Destination"
              autoComplete="off"
            />

          </div>

        </div>


        {/* FIND ROUTE */}

        <button
          type="button"
          className="search-btn"
          onClick={findRoute}
          disabled={loading}
        >

          {loading ? (
            <>
              <span className="spinner" />
              Finding Route...
            </>
          ) : (
            <>
              Find Route
            </>
          )}

        </button>


        {/* ERROR */}

        {error && (
          <div className="error-message">
            <span>⚠️</span>

            <span>
              {error}
            </span>
          </div>
        )}

      </section>


      {/* ==================================================
          MAP
      ================================================== */}

      <section className="map-wrapper">

        <Map
          locations={mapLocations}
        />


        {/* ==================================================
            ROUTE INFORMATION CARD
        ================================================== */}

        <div className="route-card">

          <span className="recommended">
            ⭐ RECOMMENDED ROUTE
          </span>

          <h2>
            {from} → {to}
          </h2>


          <div className="route-stats">

            {/* DISTANCE */}

            <div className="stat">

              <small>
                DISTANCE
              </small>

              <strong>
                {distance}
                <span className="unit">
                  km
                </span>
              </strong>

            </div>


            {/* TIME */}

            <div className="stat">

              <small>
                EST. TIME
              </small>

              <strong>
                {duration}
              </strong>

            </div>


            {/* ROAD QUALITY */}

            <div className="stat">

              <small>
                ROAD QUALITY
              </small>

              <strong className="quality">
                --
              </strong>

            </div>

          </div>


          {/* ROAD INFORMATION */}

          <div className="road-info">

            <span>
              🕳️ Potholes detected
            </span>

            <strong>
              --
            </strong>

          </div>


          {/* FUTURE AI MESSAGE */}

          <div className="ai-status">

            <span className="ai-dot" />

            <span>
              AI road analysis will appear here
            </span>

          </div>

        </div>

      </section>

    </main>
  );
}