import { NextResponse } from "next/server";

/* =====================================================
   TYPES
===================================================== */

type Coordinate = [number, number]; 
// Internal format: [latitude, longitude]

type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type OSRMRoute = {
  distance: number;
  duration: number;
  weight?: number;

  geometry?: RouteGeometry;
};

type OSRMResponse = {
  code: string;

  message?: string;

  routes?: OSRMRoute[];

  waypoints?: unknown[];
};

/* =====================================================
   ROUTING SERVERS
===================================================== */

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

/* =====================================================
   HELPER - VALIDATE COORDINATES
===================================================== */

function isValidCoordinate(
  latitude: number,
  longitude: number
) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/* =====================================================
   HELPER - FETCH WITH TIMEOUT
===================================================== */

async function fetchWithTimeout(
  url: string,
  timeoutMs = 15000
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",

      signal: controller.signal,

      headers: {
        "User-Agent":
          "RoadSenseAI/1.0 (student-semester-project)",

        Accept: "application/json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/* =====================================================
   GET ROUTE
===================================================== */

export async function GET(
  request: Request
) {
  try {
    /* =================================================
       1. READ QUERY PARAMETERS
    ================================================= */

    const { searchParams } =
      new URL(request.url);

    const sourceLat = Number(
      searchParams.get("sourceLat")
    );

    const sourceLng = Number(
      searchParams.get("sourceLng")
    );

    const destinationLat =
      Number(
        searchParams.get(
          "destinationLat"
        )
      );

    const destinationLng =
      Number(
        searchParams.get(
          "destinationLng"
        )
      );

    console.log(
      "Route request:",
      {
        sourceLat,
        sourceLng,
        destinationLat,
        destinationLng,
      }
    );

    /* =================================================
       2. VALIDATE COORDINATES
    ================================================= */

    if (
      !isValidCoordinate(
        sourceLat,
        sourceLng
      ) ||
      !isValidCoordinate(
        destinationLat,
        destinationLng
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Invalid source or destination coordinates.",
        },
        {
          status: 400,
        }
      );
    }

    /* =================================================
       3. CREATE OSRM PATH
       
       OSRM requires:
       
       longitude,latitude
       
       NOT:
       
       latitude,longitude
    ================================================= */

    const source: Coordinate = [
      sourceLat,
      sourceLng,
    ];

    const destination: Coordinate = [
      destinationLat,
      destinationLng,
    ];

    const routePath =
      `/route/v1/driving/` +
      `${sourceLng},${sourceLat};` +
      `${destinationLng},${destinationLat}` +
      `?alternatives=true` +
      `&overview=full` +
      `&geometries=geojson`;

    console.log(
      "OSRM route path:",
      routePath
    );

    /* =================================================
       4. TRY ROUTING SERVERS
    ================================================= */

    let lastError =
      "Unknown routing error";

    for (
      const server of routingServers
    ) {
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

        /* =============================================
           REQUEST
        ============================================= */

        const response =
          await fetchWithTimeout(
            url,
            15000
          );

        /* =============================================
           HTTP ERROR
        ============================================= */

        if (!response.ok) {
          lastError =
            `${server.name}: HTTP ${response.status}`;

          console.error(
            lastError
          );

          continue;
        }

        /* =============================================
           JSON
        ============================================= */

        const data =
          (await response.json()) as OSRMResponse;

        /* =============================================
           OSRM ERROR
        ============================================= */

        if (data.code !== "Ok") {
          lastError =
            `${server.name}: ${
              data.code ||
              "Unknown OSRM error"
            }`;

          console.error(
            lastError
          );

          continue;
        }

        /* =============================================
           CHECK ROUTES
        ============================================= */

        if (
          !Array.isArray(
            data.routes
          ) ||
          data.routes.length === 0
        ) {
          lastError =
            `${server.name}: No routes found`;

          console.error(
            lastError
          );

          continue;
        }

        console.log(
          `${data.routes.length} route(s) received from ${server.name}`
        );

        /* =============================================
           VALIDATE + FORMAT ROUTES
        ============================================= */

        const routes = data.routes
          .filter((route) => {
            return (
              Number.isFinite(
                route.distance
              ) &&
              Number.isFinite(
                route.duration
              ) &&
              route.geometry &&
              Array.isArray(
                route.geometry
                  .coordinates
              ) &&
              route.geometry
                .coordinates.length >= 2
            );
          })
          .map(
            (
              route,
              index
            ) => {
              /* ---------------------------------------
                 Safety values are TEMPORARY.
                 
                 Later these will come from:
                 YOLO + pothole model + road analysis.
              --------------------------------------- */

              const potholeCount = 0;

              const riskScore = 0;

              const safetyScore = 100;

              return {
                id: index + 1,

                distance:
                  route.distance,

                duration:
                  route.duration,

                weight:
                  route.weight ??
                  route.duration,

                geometry:
                  route.geometry,

                potholeCount,

                riskScore,

                safetyScore,
              };
            }
          );

        /* =============================================
           NO VALID ROUTES
        ============================================= */

        if (routes.length === 0) {
          lastError =
            `${server.name}: Route geometry missing`;

          console.error(
            lastError
          );

          continue;
        }

        /* =============================================
           LOG ROUTES
        ============================================= */

        routes.forEach(
          (route) => {
            console.log(
              `Route ${route.id}:`,
              {
                distanceKm:
                  (
                    route.distance /
                    1000
                  ).toFixed(2),

                durationMin:
                  Math.round(
                    route.duration /
                      60
                  ),

                points:
                  route.geometry
                    ?.coordinates
                    .length,
              }
            );
          }
        );

        /* =============================================
           SUCCESS RESPONSE
        ============================================= */

        return NextResponse.json({
          success: true,

          provider: server.name,

          source: {
            name: "Source",

            latitude:
              sourceLat,

            longitude:
              sourceLng,
          },

          destination: {
            name: "Destination",

            latitude:
              destinationLat,

            longitude:
              destinationLng,
          },

          routes,

          routeCount:
            routes.length,
        });
      } catch (error) {
        /* =============================================
           SERVER FAILURE
        ============================================= */

        if (
          error instanceof Error
        ) {
          if (
            error.name ===
            "AbortError"
          ) {
            lastError =
              `${server.name}: Request timed out`;
          } else {
            lastError =
              `${server.name}: ${error.message}`;
          }
        } else {
          lastError =
            `${server.name}: Unknown error`;
        }

        console.error(
          `${server.name} failed:`,
          error
        );

        /* ---------------------------------------------
           Try next server
        --------------------------------------------- */

        continue;
      }
    }

    /* =================================================
       ALL SERVERS FAILED
    ================================================= */

    console.error(
      "All routing servers failed:",
      lastError
    );

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
    /* =================================================
       UNEXPECTED ERROR
    ================================================= */

    console.error(
      "Route API unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Invalid routing request.",

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}