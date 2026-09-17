import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await requireUser();
    const parsed = z.object({ query: z.string().trim().min(3).max(200) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Skriv minst tre tegn i hotellnavnet." }, { status: 400 });
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return NextResponse.json({ error: "Google Maps-nøkkel mangler. Du kan fortsatt skrive hotelladressen manuelt." }, { status: 503 });
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress" },
      body: JSON.stringify({ textQuery: parsed.data.query, includedType: "hotel", languageCode: "nb", regionCode: "NO", pageSize: 5 }),
    });
    if (!response.ok) return NextResponse.json({ error: "Hotellsøk er ikke tilgjengelig. Kontroller at Places API (New) er aktivert og tillatt for Google-nøkkelen. Du kan skrive adressen manuelt." }, { status: 502 });
    const data = await response.json() as { places?: Array<{ id: string; displayName?: { text: string }; formattedAddress?: string }> };
    return NextResponse.json({ hotels: (data.places ?? []).filter((place) => place.formattedAddress).map((place) => ({ id: place.id, name: place.displayName?.text ?? "Hotell", address: place.formattedAddress! })) });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "Ikke innlogget." : "Kunne ikke søke etter hotell. Prøv igjen eller skriv adressen manuelt." }, { status: unauthorized ? 401 : 502 });
  }
}
