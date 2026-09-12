import { ALL_CITY_OPTIONS, getCityStatus } from "../data/cities";
import { getNeighborhoods } from "../data/locations";

/**
 * Location search for the home screen's From and To fields.
 *
 * Two sources feed one list: Bovogo's own cities and neighbourhoods, which
 * match instantly and offline, and Mapbox Search Box suggestions for streets,
 * addresses and places such as "Hobby Airport". Without a Mapbox token the
 * built-in list is all you get, and the picker says so rather than looking
 * broken. Every result is resolved to the city the trip search runs on — trips
 * are posted and searched by city, so the area is a label for the rider.
 *
 * The Mapbox half is the documented interactive search flow: `/suggest` while
 * the rider types, then `/retrieve` on the one they pick, both carrying the same
 * session token. See https://docs.mapbox.com/api/search/search-box/.
 */

export type PlaceTarget =
  | { kind: "ok"; city: string; area: string }
  | { kind: "coming-soon"; city: string }
  | { kind: "unsupported" };

export interface PlaceResult {
  id: string;
  title: string;
  subtitle: string;
  source: "bovogo" | "mapbox";
  target: PlaceTarget;
}

/** The part of a Mapbox Search Box `/suggest` item this module reads. */
export interface SearchBoxSuggestion {
  mapbox_id: string;
  name: string;
  feature_type: string;
  place_formatted?: string;
  full_address?: string;
  context?: {
    region?: { region_code?: string };
    district?: { name?: string };
    place?: { name?: string };
    neighborhood?: { name?: string };
  };
}

const SUGGEST_URL = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_URL = "https://api.mapbox.com/search/searchbox/v1/retrieve";

/** Between Austin and Houston, so neither city's results are pushed down. */
const CORRIDOR_MIDPOINT = "-96.56,30.01";

// Counties (Mapbox "district") and towns (Mapbox "place") that belong to one of
// Bovogo's cities, keyed "<state>:<lower-case name>". A rider in Round Rock is
// travelling to or from Austin as far as a ride search is concerned.
const METRO_COUNTIES: Record<string, string> = {
  "TX:travis county": "Austin, TX",
  "TX:williamson county": "Austin, TX",
  "TX:hays county": "Austin, TX",
  "TX:bastrop county": "Austin, TX",
  "TX:caldwell county": "Austin, TX",
  "TX:harris county": "Houston, TX",
  "TX:fort bend county": "Houston, TX",
  "TX:montgomery county": "Houston, TX",
  "TX:brazoria county": "Houston, TX",
  "TX:galveston county": "Houston, TX",
  "TX:waller county": "Houston, TX",
  "TX:liberty county": "Houston, TX",
  "TX:chambers county": "Houston, TX",
  // Despite the name, Austin County is part of Greater Houston.
  "TX:austin county": "Houston, TX",
  "TX:dallas county": "Dallas, TX",
  "TX:collin county": "Dallas, TX",
  "TX:denton county": "Dallas, TX",
  "TX:rockwall county": "Dallas, TX",
  "AR:benton county": "Bentonville, AR",
};

const METRO_PLACES: Record<string, string> = Object.fromEntries([
  ...[
    "austin", "round rock", "cedar park", "pflugerville", "georgetown", "leander",
    "san marcos", "kyle", "buda", "lakeway", "bee cave", "manor", "hutto",
    "west lake hills", "rollingwood", "sunset valley", "dripping springs",
    "bastrop", "del valle", "lago vista", "liberty hill",
  ].map((p) => [`TX:${p}`, "Austin, TX"]),
  ...[
    "houston", "pasadena", "pearland", "sugar land", "katy", "the woodlands",
    "spring", "humble", "kingwood", "missouri city", "league city", "baytown",
    "conroe", "cypress", "tomball", "friendswood", "bellaire", "stafford",
    "richmond", "rosenberg", "atascocita", "la porte", "deer park", "webster",
    "seabrook", "jersey village", "west university place", "galveston",
    "fulshear", "channelview", "alvin", "manvel",
  ].map((p) => [`TX:${p}`, "Houston, TX"]),
  ...[
    "dallas", "plano", "irving", "garland", "richardson", "frisco", "mckinney",
    "carrollton", "mesquite", "addison",
  ].map((p) => [`TX:${p}`, "Dallas, TX"]),
  ...["bentonville", "rogers", "bella vista"].map((p) => [`AR:${p}`, "Bentonville, AR"]),
]);

function cityName(label: string): string {
  return label.replace(/, [A-Z]{2}$/, "");
}

/**
 * What goes under the city: a known Bovogo neighbourhood where the name matches
 * one, otherwise the spot the rider picked. The city itself means any area.
 */
function areaLabel(s: SearchBoxSuggestion, city: string): string {
  const name = s.name.trim();
  if (s.feature_type === "district" || s.feature_type === "region") return "";
  if (name.toLowerCase() === cityName(city).toLowerCase()) return "";
  const known = getNeighborhoods(city).find((n) => n.toLowerCase() === name.toLowerCase());
  return known ?? name;
}

/** Maps one Mapbox suggestion onto a Bovogo city, or says why it can't be used. */
export function resolveSuggestion(s: SearchBoxSuggestion): PlaceResult {
  const base = {
    id: `mapbox:${s.mapbox_id}`,
    title: s.name.trim(),
    subtitle: (s.place_formatted ?? s.full_address ?? "").trim(),
    source: "mapbox" as const,
  };

  const state = (s.context?.region?.region_code ?? "").toUpperCase();
  const key = (name?: string) => (name ? `${state}:${name.trim().toLowerCase()}` : "");
  // A town or county result has no town or county in its context — it is one.
  const place = s.context?.place?.name ?? (s.feature_type === "place" ? s.name : undefined);
  const county = s.context?.district?.name ?? (s.feature_type === "district" ? s.name : undefined);
  const city = METRO_PLACES[key(place)] ?? METRO_COUNTIES[key(county)];

  if (!city) return { ...base, target: { kind: "unsupported" } };
  const status = getCityStatus(city);
  if (status === "coming-soon") return { ...base, target: { kind: "coming-soon", city } };
  if (status !== "mvp") return { ...base, target: { kind: "unsupported" } };
  return { ...base, target: { kind: "ok", city, area: areaLabel(s, city) } };
}

/** Bovogo's own cities and neighbourhoods matching what's typed, best first. */
export function searchLocalPlaces(query: string, limit = 8): PlaceResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const cities = ALL_CITY_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)).map(
    (o): PlaceResult => ({
      id: `city:${o.label}`,
      title: o.label,
      subtitle: o.status === "mvp" ? "Any area" : "Coming soon",
      source: "bovogo",
      target:
        o.status === "mvp"
          ? { kind: "ok", city: o.label, area: "" }
          : { kind: "coming-soon", city: o.label },
    }),
  );

  const areas: PlaceResult[] = [];
  for (const o of ALL_CITY_OPTIONS) {
    if (o.status !== "mvp") continue;
    for (const n of getNeighborhoods(o.label)) {
      if (!n.toLowerCase().includes(q)) continue;
      areas.push({
        id: `area:${o.label}:${n}`,
        title: n,
        subtitle: o.label,
        source: "bovogo",
        target: { kind: "ok", city: o.label, area: n },
      });
    }
  }
  // Names that start with what's typed before names that merely contain it.
  const rank = (r: PlaceResult) => (r.title.toLowerCase().startsWith(q) ? 0 : 1);
  areas.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));

  return [...cities, ...areas].slice(0, limit);
}

/** Bovogo's results first; a Mapbox result for the same city and area is dropped. */
export function mergePlaceResults(local: PlaceResult[], remote: PlaceResult[]): PlaceResult[] {
  const keyOf = (r: PlaceResult) =>
    r.target.kind === "ok" ? `${r.target.city}|${r.target.area.toLowerCase()}` : r.id;
  const seen = new Set(local.map(keyOf));
  const merged = [...local];
  for (const r of remote) {
    const k = keyOf(r);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(r);
  }
  return merged;
}

/**
 * Mapbox bills Search Box by session, not by request. One opening of the picker
 * is one session: every `/suggest` while typing plus the `/retrieve` for the
 * suggestion the rider taps share this token.
 */
export function newSearchSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Whether address search can run at all. It needs a real public Mapbox token in
 * EXPO_PUBLIC_MAPBOX_TOKEN; without one the picker falls back to Bovogo's own
 * cities and areas.
 */
export function isPlaceSearchConfigured(token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN): boolean {
  return !!token && token.startsWith("pk.");
}

/**
 * Addresses and places from Mapbox, resolved to Bovogo cities. `token` is the
 * env read by default, passed in only so tests do not depend on how the bundler
 * substitutes `EXPO_PUBLIC_*`.
 */
export async function searchMapboxPlaces(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
  token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!isPlaceSearchConfigured(token) || q.length < 2) return [];

  const params: Record<string, string> = {
    q,
    access_token: token,
    session_token: sessionToken,
    country: "us",
    language: "en",
    limit: "8",
    proximity: CORRIDOR_MIDPOINT,
    types: "poi,address,street,neighborhood,locality,place,postcode",
  };
  // Built by hand: React Native's URLSearchParams does not accept an init object.
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(`${SUGGEST_URL}?${qs}`, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as { suggestions?: SearchBoxSuggestion[] };
  return (data.suggestions ?? []).map(resolveSuggestion);
}

/**
 * Completes the Search Box session for the suggestion the rider picked, and
 * resolves it from the retrieved feature, whose context is the authoritative
 * one. Returns `null` when there is no token or the feature came back empty, so
 * the caller can fall back to the suggestion it already has.
 */
export async function retrieveMapboxPlace(
  resultId: string,
  sessionToken: string,
  signal?: AbortSignal,
  token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "",
): Promise<PlaceResult | null> {
  // `searchMapboxPlaces` prefixes the ids it returns; `/retrieve` wants the raw one.
  const mapboxId = resultId.replace(/^mapbox:/, "");
  if (!isPlaceSearchConfigured(token) || !mapboxId) return null;

  const qs = [
    `access_token=${encodeURIComponent(token)}`,
    `session_token=${encodeURIComponent(sessionToken)}`,
  ].join("&");

  const res = await fetch(`${RETRIEVE_URL}/${encodeURIComponent(mapboxId)}?${qs}`, { signal });
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const data = (await res.json()) as {
    features?: { properties?: Partial<SearchBoxSuggestion> }[];
  };
  const props = data.features?.[0]?.properties;
  if (!props?.name) return null;
  return resolveSuggestion({
    mapbox_id: props.mapbox_id ?? mapboxId,
    name: props.name,
    feature_type: props.feature_type ?? "",
    place_formatted: props.place_formatted,
    full_address: props.full_address,
    context: props.context,
  });
}
