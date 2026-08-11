import { NextResponse } from "next/server";

type Coordinates = [number, number]; // [latitude, longitude]

const routingServers = [
  {
    name: "OSRM Project",
    url: "https://router.project-osrm.org",
  },
  {
    name: "OSM Germany",
    url: "https://routing.openstreetmap.de/routed-car",
  },
];

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Read coordinates from URL
    // --------------------------------------------------

    const { searchParams } = new URL(request.url);

    const sourceLat = searchParams.get("sourceLat");
    const sourceLng = searchParams.get("sourceLng");

    const destinationLat =
      searchParams.get("destinationLat");

    const destinationLng =
      searchParams.get("destinationLng");

    // --------------------------------------------------
    // 2. Validate coordinates
    // --------------------------------------------------

    if (
      !sourceLat ||
      !sourceLng ||
      !destinationLat ||
      !destinationLng
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Source and destination coordinates are required.",
        },
        {
          status: 400,
        }
      );
    }

    const source: Coordinates = [
      Number(sourceLat),
      Number(sourceLng),
    ];

    const destination: Coordinates = [
      Number(destinationLat),
      Number(destinationLng),
    ];

    // Check if coordinates are valid numbers

    if (
      source.some((value) => !Number.isFinite(value)) ||
      destination.some((value) =>
        !Number.isFinite(value)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid coordinates.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 3. Validate latitude / longitude ranges
    // --------------------------------------------------

    if (
      source[0] < -90 ||
      source[0] > 90 ||
      destination[0] < -90 ||
      destination[0] > 90 ||
      source[1] < -180 ||
      source[1] > 180 ||
      destination[1] < -180 ||
      destination[1] > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Coordinates are outside valid range.",
        },
        {
          status: 400,
        }
      );
    }

    console.log("Source:", source);
    console.log("Destination:", destination);

    // --------------------------------------------------
    // 4. Create OSRM route path
    //
    // OSRM requires:
    // longitude,latitude
    // --------------------------------------------------

    const routePath =
      `/route/v1/driving/` +
      `${source[1]},${source[0]};` +
      `${destination[1]},${destination[0]}` +
      `?overview=full&geometries=geojson`;

    let lastError =
      "Unknown routing error";

    // --------------------------------------------------
    // 5. Try routing servers
    // --------------------------------------------------

    for (const server of routingServers) {
      try {
        console.log(
          `Trying routing server: ${server.name}`
        );

        const url =
          `${server.url}${routePath}`;

        console.log(
          "Routing URL:",
          url
        );

        // ----------------------------------------------
        // Request routing server
        // ----------------------------------------------

        const response = await fetch(url, {
          cache: "no-store",

          signal: AbortSignal.timeout(
            15000
          ),

          headers: {
            "User-Agent":
              "RoadSenseAI/1.0",
            Accept:
              "application/json",
          },
        });

        // ----------------------------------------------
        // HTTP error
        // ----------------------------------------------

        if (!response.ok) {
          lastError =
            `${server.name}: HTTP ${response.status}`;

          console.error(lastError);

          continue;
        }

        // ----------------------------------------------
        // Parse response
        // ----------------------------------------------

        const data =
          await response.json();

        // ----------------------------------------------
        // OSRM error
        // ----------------------------------------------

        if (data.code !== "Ok") {
          lastError =
            `${server.name}: ${data.code}`;

          console.error(lastError);

          continue;
        }

        // ----------------------------------------------
        // Get first route
        // ----------------------------------------------

        const route =
          data.routes?.[0];

        if (!route) {
          lastError =
            `${server.name}: No route found`;

          console.error(lastError);

          continue;
        }

        // ----------------------------------------------
        // Route successfully received
        // ----------------------------------------------

        console.log(
          `Route successfully received from ${server.name}`
        );

        // ----------------------------------------------
        // Calculate basic information
        // ----------------------------------------------

        const distanceKm =
          route.distance / 1000;

        const durationMinutes =
          route.duration / 60;

        // ----------------------------------------------
        // Return response
        // ----------------------------------------------

        return NextResponse.json({
          success: true,

          provider: server.name,

          source: {
            latitude: source[0],
            longitude: source[1],
          },

          destination: {
            latitude: destination[0],
            longitude: destination[1],
          },

          route: {
            distance: route.distance,

            distanceKm:
              Number(
                distanceKm.toFixed(2)
              ),

            duration:
              route.duration,

            durationMinutes:
              Number(
                durationMinutes.toFixed(1)
              ),

            geometry:
              route.geometry,
          },
        });
      } catch (error) {
        lastError =
          error instanceof Error
            ? error.message
            : "Unknown routing error";

        console.error(
          `${server.name} failed:`,
          error
        );

        // Try next server
        continue;
      }
    }

    // --------------------------------------------------
    // 6. All routing servers failed
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,

        message:
          "All routing services are temporarily unavailable.",

        error: lastError,
      },
      {
        status: 503,
      }
    );
  } catch (error) {
    // --------------------------------------------------
    // 7. Unexpected API error
    // --------------------------------------------------

    console.error(
      "Route API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unexpected routing API error.",
      },
      {
        status: 500,
      }
    );
  }
}