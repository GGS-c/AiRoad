import { NextResponse } from "next/server";

type SearchResult = {
  name: string;
  latitude: number;
  longitude: number;
  type: string | null;
  category: string | null;
  importance: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    district?: string;
    state?: string;
    country?: string;
  };
};

export async function GET(request: Request) {
  try {
    // --------------------------------------------
    // 1. Get search query
    // --------------------------------------------

    const { searchParams } =
      new URL(request.url);

    const query = searchParams.get("q");

    if (!query || !query.trim()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Search query is required.",
          results: [],
        },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim();

    console.log(
      `Searching location: ${cleanQuery}`
    );

    // --------------------------------------------
    // 2. Improve query
    //
    // For Indian locations, adding Maharashtra
    // helps when user enters only "Shirpur".
    // --------------------------------------------

    const searchQuery =
      `${cleanQuery}, Maharashtra, India`;

    // --------------------------------------------
    // 3. Nominatim URL
    // --------------------------------------------

    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2` +
      `&q=${encodeURIComponent(searchQuery)}` +
      `&limit=10` +
      `&countrycodes=in` +
      `&addressdetails=1`;

    // --------------------------------------------
    // 4. Call Nominatim
    // --------------------------------------------

    const response = await fetch(url, {
      cache: "no-store",

      headers: {
        "User-Agent":
          "RoadSenseAI/1.0 (student-semester-project)",
        Accept:
          "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Nominatim HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      return NextResponse.json({
        success: true,
        results: [],
        message:
          `No location found for "${cleanQuery}".`,
      });
    }

    // --------------------------------------------
    // 5. Convert Nominatim results
    // --------------------------------------------

    const results: SearchResult[] =
      data.map((item: any) => ({
        name:
          item.display_name,

        latitude:
          Number(item.lat),

        longitude:
          Number(item.lon),

        type:
          item.type || null,

        category:
          item.category || null,

        importance:
          Number(item.importance || 0),

        address:
          item.address || {},
      }));

    // --------------------------------------------
    // 6. Filter valid coordinates
    // --------------------------------------------

    const validResults =
      results.filter(
        (item) =>
          Number.isFinite(
            item.latitude
          ) &&
          Number.isFinite(
            item.longitude
          )
      );

    // --------------------------------------------
    // 7. Ranking
    //
    // Prefer:
    // - Maharashtra
    // - Dhule district
    // - Town / city / village
    // - Higher importance
    // --------------------------------------------

    const rankedResults =
      validResults.sort(
        (a, b) => {
          const score = (
            item: SearchResult
          ) => {
            let value =
              item.importance * 10;

            const state =
              item.address?.state
                ?.toLowerCase() || "";

            const district =
              item.address?.district
                ?.toLowerCase() || "";

            const type =
              item.type
                ?.toLowerCase() || "";

            const category =
              item.category
                ?.toLowerCase() || "";

            const name =
              item.name
                ?.toLowerCase() || "";

            // Maharashtra preference
            if (
              state.includes(
                "maharashtra"
              )
            ) {
              value += 20;
            }

            // Dhule preference
            if (
              district.includes("dhule")
            ) {
              value += 30;
            }

            // Settlement preference
            if (
              [
                "city",
                "town",
                "village",
                "municipality",
                "suburb",
              ].includes(type)
            ) {
              value += 15;
            }

            // Place category
            if (
              category === "place"
            ) {
              value += 10;
            }

            // Exact query match
            if (
              name.includes(
                cleanQuery.toLowerCase()
              )
            ) {
              value += 5;
            }

            return value;
          };

          return score(b) - score(a);
        }
      );

    // --------------------------------------------
    // 8. Return top results
    // --------------------------------------------

    const finalResults =
      rankedResults
        .slice(0, 5)
        .map((item) => ({
          name: item.name,

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
        }));

    console.log(
      "Best search result:",
      finalResults[0]
    );

    return NextResponse.json({
      success: true,

      query: cleanQuery,

      results: finalResults,
    });

  } catch (error) {
    console.error(
      "Location search error:",
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