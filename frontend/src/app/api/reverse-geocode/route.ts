import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng") || searchParams.get("lon");

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { success: false, message: "Missing lat or lng query parameters." },
        { status: 400 }
      );
    }

    const lat = Number(latStr);
    const lng = Number(lngStr);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid latitude or longitude." },
        { status: 400 }
      );
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "RoadSenseAI/1.0 (student-semester-project)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Geocoding failed with status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (!data || data.error) {
      return NextResponse.json(
        {
          success: false,
          message: data?.error || "Unable to identify this location.",
        },
        { status: 404 }
      );
    }

    /* ── Format human-readable location name ── */
    const address = data.address || {};
    const parts: string[] = [];

    // Specific local point
    const primaryPoint =
      address.road ||
      address.pedestrian ||
      address.neighbourhood ||
      address.suburb ||
      address.hamlet ||
      address.village;

    // Town / City
    const cityOrTown =
      address.town ||
      address.city ||
      address.municipality ||
      address.county ||
      address.state_district;

    // State / Country
    const state = address.state;

    if (primaryPoint) {
      parts.push(primaryPoint);
    }
    if (cityOrTown && cityOrTown !== primaryPoint) {
      parts.push(cityOrTown);
    }
    if (state && state !== cityOrTown) {
      parts.push(state);
    }

    let formattedName = parts.join(", ");

    if (!formattedName || formattedName.trim().length === 0) {
      formattedName =
        data.display_name?.split(",").slice(0, 3).join(",") ||
        `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }

    return NextResponse.json({
      success: true,
      location: {
        name: formattedName,
        latitude: lat,
        longitude: lng,
      },
    });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal error during reverse geocoding.",
      },
      { status: 500 }
    );
  }
}
