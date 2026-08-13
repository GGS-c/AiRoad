import { NextResponse } from "next/server";

/* =====================================================
   TYPES
===================================================== */

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;

  county?: string;
  district?: string;
  state_district?: string;

  state?: string;
  postcode?: string;

  country?: string;
  country_code?: string;
};

type SearchResult = {
  name: string;

  latitude: number;
  longitude: number;

  type: string | null;
  category: string | null;

  importance: number;

  address: NominatimAddress;
};

/* =====================================================
   HELPERS
===================================================== */

function normalizeQuery(
  value: string
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[-]+$/g, "")
    .trim();
}

function getSettlementType(
  item: SearchResult
): boolean {
  const type =
    item.type?.toLowerCase() || "";

  return [
    "city",
    "town",
    "village",
    "municipality",
    "suburb",
  ].includes(type);
}

/* =====================================================
   GET
===================================================== */

export async function GET(
  request: Request
) {
  try {
    /* =================================================
       1. GET QUERY
    ================================================= */

    const { searchParams } =
      new URL(request.url);

    const rawQuery =
      searchParams.get("q");

    if (
      !rawQuery ||
      !rawQuery.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Search query is required.",
          results: [],
        },
        {
          status: 400,
        }
      );
    }

    /* =================================================
       2. CLEAN QUERY
    ================================================= */

    const cleanQuery =
      normalizeQuery(rawQuery);

    console.log(
      `🔎 Searching location: ${cleanQuery}`
    );

    /*
     * For this RoadSense project we are
     * mainly working with Maharashtra.
     *
     * If the user already mentions Maharashtra,
     * don't add it twice.
     */

    const lowerQuery =
      cleanQuery.toLowerCase();

    const searchQuery =
      lowerQuery.includes(
        "maharashtra"
      )
        ? cleanQuery
        : `${cleanQuery}, Maharashtra, India`;

    /* =================================================
       3. NOMINATIM URL
    ================================================= */

    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2` +
      `&q=${encodeURIComponent(
        searchQuery
      )}` +
      `&limit=10` +
      `&countrycodes=in` +
      `&addressdetails=1` +
      `&dedupe=1`;

    console.log(
      "Nominatim query:",
      searchQuery
    );

    /* =================================================
       4. CALL NOMINATIM
    ================================================= */

    const response =
      await fetch(url, {
        cache: "no-store",

        signal:
          AbortSignal.timeout(
            10000
          ),

        headers: {
          /*
           * Identify your application.
           */
          "User-Agent":
            "RoadSenseAI/1.0 (student-semester-project)",

          Accept:
            "application/json",

          "Accept-Language":
            "en",
        },
      });

    if (!response.ok) {
      throw new Error(
        `Nominatim HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    /* =================================================
       5. NO RESULTS
    ================================================= */

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      console.log(
        `❌ No location found: ${cleanQuery}`
      );

      return NextResponse.json({
        success: true,

        query: cleanQuery,

        results: [],

        message:
          `No location found for "${cleanQuery}".`,
      });
    }

    /* =================================================
       6. CONVERT RESULTS
    ================================================= */

    const results: SearchResult[] =
      data
        .map((item: any) => ({
          name:
            String(
              item.display_name || ""
            ),

          latitude:
            Number(item.lat),

          longitude:
            Number(item.lon),

          type:
            item.type
              ? String(item.type)
              : null,

          category:
            item.category
              ? String(item.category)
              : null,

          importance:
            Number(
              item.importance || 0
            ),

          address:
            item.address || {},
        }))
        .filter(
          (item: SearchResult) =>
            Number.isFinite(
              item.latitude
            ) &&
            Number.isFinite(
              item.longitude
            )
        );

    /* =================================================
       7. RANK RESULTS
    ================================================= */

    const queryLower =
      cleanQuery.toLowerCase();

    const rankedResults =
      results.sort(
        (a, b) => {
          const calculateScore =
            (
              item: SearchResult
            ) => {
              let score = 0;

              /* -----------------------------------------
                 BASE IMPORTANCE
              ----------------------------------------- */

              score +=
                item.importance * 20;

              /* -----------------------------------------
                 ADDRESS
              ----------------------------------------- */

              const address =
                item.address;

              const state =
                (
                  address.state ||
                  ""
                ).toLowerCase();

              const stateDistrict =
                (
                  address.state_district ||
                  ""
                ).toLowerCase();

              const district =
                (
                  address.district ||
                  ""
                ).toLowerCase();

              const county =
                (
                  address.county ||
                  ""
                ).toLowerCase();

              const city =
                (
                  address.city ||
                  ""
                ).toLowerCase();

              const town =
                (
                  address.town ||
                  ""
                ).toLowerCase();

              const village =
                (
                  address.village ||
                  ""
                ).toLowerCase();

              const name =
                item.name.toLowerCase();

              const type =
                (
                  item.type || ""
                ).toLowerCase();

              const category =
                (
                  item.category || ""
                ).toLowerCase();

              /* -----------------------------------------
                 MAHARASHTRA
              ----------------------------------------- */

              if (
                state ===
                "maharashtra"
              ) {
                score += 40;
              }

              /* -----------------------------------------
                 DHULE
                 
                 Nominatim may return Dhule as:
                 state_district
                 district
                 county
              ----------------------------------------- */

              if (
                stateDistrict.includes(
                  "dhule"
                )
              ) {
                score += 35;
              }

              if (
                district.includes(
                  "dhule"
                )
              ) {
                score += 35;
              }

              if (
                county.includes(
                  "dhule"
                )
              ) {
                score += 30;
              }

              /* -----------------------------------------
                 JALGAON
              ----------------------------------------- */

              if (
                stateDistrict.includes(
                  "jalgaon"
                )
              ) {
                score += 25;
              }

              if (
                district.includes(
                  "jalgaon"
                )
              ) {
                score += 25;
              }

              if (
                county.includes(
                  "jalgaon"
                )
              ) {
                score += 20;
              }

              /* -----------------------------------------
                 CITY / TOWN / VILLAGE
              ----------------------------------------- */

              if (
                getSettlementType(
                  item
                )
              ) {
                score += 25;
              }

              /* -----------------------------------------
                 PLACE CATEGORY
              ----------------------------------------- */

              if (
                category ===
                "place"
              ) {
                score += 15;
              }

              /* -----------------------------------------
                 EXACT NAME MATCH
              ----------------------------------------- */

              if (
                name.includes(
                  queryLower
                )
              ) {
                score += 20;
              }

              /* -----------------------------------------
                 CITY MATCH
              ----------------------------------------- */

              if (
                city &&
                queryLower.includes(
                  city
                )
              ) {
                score += 15;
              }

              /* -----------------------------------------
                 TOWN MATCH
              ----------------------------------------- */

              if (
                town &&
                queryLower.includes(
                  town
                )
              ) {
                score += 15;
              }

              /* -----------------------------------------
                 VILLAGE MATCH
              ----------------------------------------- */

              if (
                village &&
                queryLower.includes(
                  village
                )
              ) {
                score += 10;
              }

              /* -----------------------------------------
                 ADMINISTRATIVE PENALTY
                 
                 We prefer actual places over
                 large administrative boundaries.
              ----------------------------------------- */

              if (
                type ===
                "administrative"
              ) {
                score -= 15;
              }

              return score;
            };

          return (
            calculateScore(b) -
            calculateScore(a)
          );
        }
      );

    /* =================================================
       8. FINAL RESULTS
    ================================================= */

    const finalResults =
      rankedResults
        .slice(0, 5)
        .map(
          (item) => ({
            name:
              item.name,

            latitude:
              item.latitude,

            longitude:
              item.longitude,

            type:
              item.type,

            category:
              item.category,

            address:
              item.address,
          })
        );

    /* =================================================
       9. LOG BEST RESULT
    ================================================= */

    if (
      finalResults.length > 0
    ) {
      console.log(
        "✅ Best search result:",
        finalResults[0]
      );
    }

    /* =================================================
       10. RETURN
    ================================================= */

    return NextResponse.json({
      success: true,

      query: cleanQuery,

      results:
        finalResults,

      count:
        finalResults.length,
    });
  } catch (error) {
    /* =================================================
       ERROR
    ================================================= */

    console.error(
      "❌ Location search error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Location search service is temporarily unavailable.",

        results: [],
      },
      {
        status: 503,
      }
    );
  }
}