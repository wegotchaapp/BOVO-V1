/**
 * Location search resolution. The suggestion shapes are trimmed copies of real
 * Mapbox Search Box responses for these queries (2026-09-11).
 */
import {
  mergePlaceResults,
  newSearchSessionToken,
  resolveSuggestion,
  retrieveMapboxPlace,
  searchLocalPlaces,
  searchMapboxPlaces,
  type SearchBoxSuggestion,
} from "../places";

function suggestion(partial: Partial<SearchBoxSuggestion>): SearchBoxSuggestion {
  return { mapbox_id: "id", name: "", feature_type: "poi", ...partial };
}

describe("resolveSuggestion", () => {
  it("puts a place of interest in its city, named as the area", () => {
    const r = resolveSuggestion(
      suggestion({
        name: "William P. Hobby Airport",
        feature_type: "poi",
        place_formatted: "Houston, Texas 77061, United States",
        context: { place: { name: "Houston" }, region: { region_code: "TX" } },
      }),
    );
    expect(r.target).toEqual({
      kind: "ok",
      city: "Houston, TX",
      area: "William P. Hobby Airport",
    });
    expect(r.subtitle).toBe("Houston, Texas 77061, United States");
  });

  it("counts a suburb as its metro, keeping the suburb as the area", () => {
    const r = resolveSuggestion(
      suggestion({
        name: "Round Rock",
        feature_type: "place",
        context: { district: { name: "Williamson County" }, region: { region_code: "TX" } },
      }),
    );
    expect(r.target).toEqual({ kind: "ok", city: "Austin, TX", area: "Round Rock" });
  });

  it("treats the city itself as any area", () => {
    const r = resolveSuggestion(
      suggestion({
        name: "Austin",
        feature_type: "place",
        context: { region: { region_code: "TX" } },
      }),
    );
    expect(r.target).toEqual({ kind: "ok", city: "Austin, TX", area: "" });
  });

  it("falls back to the county when the town is not listed", () => {
    const r = resolveSuggestion(
      suggestion({
        name: "Bellville",
        feature_type: "place",
        // Austin County is Greater Houston, not Austin.
        context: { district: { name: "Austin County" }, region: { region_code: "TX" } },
      }),
    );
    expect(r.target).toEqual({ kind: "ok", city: "Houston, TX", area: "Bellville" });
  });

  it("marks coming-soon cities rather than dropping them", () => {
    const r = resolveSuggestion(
      suggestion({
        name: "Plano",
        feature_type: "place",
        context: { region: { region_code: "TX" } },
      }),
    );
    expect(r.target).toEqual({ kind: "coming-soon", city: "Dallas, TX" });
  });

  it("refuses places outside the network, including same-named counties elsewhere", () => {
    const sanAntonio = resolveSuggestion(
      suggestion({
        name: "San Antonio",
        feature_type: "place",
        context: { district: { name: "Bexar County" }, region: { region_code: "TX" } },
      }),
    );
    const bentonWa = resolveSuggestion(
      suggestion({
        name: "Kennewick",
        feature_type: "place",
        context: { district: { name: "Benton County" }, region: { region_code: "WA" } },
      }),
    );
    expect(sanAntonio.target).toEqual({ kind: "unsupported" });
    expect(bentonWa.target).toEqual({ kind: "unsupported" });
  });
});

describe("searchLocalPlaces", () => {
  it("returns nothing for an empty query", () => {
    expect(searchLocalPlaces("   ")).toEqual([]);
  });

  it("lists a matching city first, as any area", () => {
    const [first] = searchLocalPlaces("aus");
    expect(first.target).toEqual({ kind: "ok", city: "Austin, TX", area: "" });
  });

  it("finds a neighbourhood by part of its name", () => {
    const hit = searchLocalPlaces("allan").find((r) => r.title === "Allandale");
    expect(hit?.target).toEqual({ kind: "ok", city: "Austin, TX", area: "Allandale" });
  });

  it("offers coming-soon cities as such", () => {
    const hit = searchLocalPlaces("dallas").find((r) => r.title === "Dallas, TX");
    expect(hit?.target).toEqual({ kind: "coming-soon", city: "Dallas, TX" });
  });
});

describe("mergePlaceResults", () => {
  it("drops a Mapbox result that lands on an area Bovogo already listed", () => {
    const local = searchLocalPlaces("allandale");
    const remote = [
      resolveSuggestion(
        suggestion({
          mapbox_id: "m1",
          name: "Allandale",
          feature_type: "neighborhood",
          context: { place: { name: "Austin" }, region: { region_code: "TX" } },
        }),
      ),
      resolveSuggestion(
        suggestion({
          mapbox_id: "m2",
          name: "Allandale Park",
          feature_type: "poi",
          context: { place: { name: "Austin" }, region: { region_code: "TX" } },
        }),
      ),
    ];
    const titles = mergePlaceResults(local, remote).map((r) => `${r.source}:${r.title}`);
    expect(titles).toEqual(["bovogo:Allandale", "mapbox:Allandale Park"]);
  });
});

describe("the Mapbox session", () => {
  const TOKEN = "pk.test-token";
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  function respond(body: unknown, ok = true, status = 200) {
    fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
  }

  /** A trimmed copy of a real `/retrieve` response for a Houston address. */
  const RETRIEVED = {
    features: [
      {
        properties: {
          mapbox_id: "dXJuOm1ieHBvaTo",
          name: "7800 Airport Blvd",
          feature_type: "address",
          place_formatted: "Houston, Texas 77061, United States",
          context: { place: { name: "Houston" }, region: { region_code: "TX" } },
        },
      },
    ],
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("bills one session: suggest and retrieve carry the same token", async () => {
    const session = newSearchSessionToken();
    respond({ suggestions: [] });
    respond(RETRIEVED);

    await searchMapboxPlaces("airport blvd", session, undefined, TOKEN);
    await retrieveMapboxPlace("mapbox:dXJuOm1ieHBvaTo", session, undefined, TOKEN);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toContain("/searchbox/v1/suggest?");
    expect(urls[1]).toContain("/searchbox/v1/retrieve/dXJuOm1ieHBvaTo?");
    // Mapbox bills the session, not the requests, so the token must be shared.
    for (const url of urls) expect(url).toContain(`session_token=${session}`);
  });

  it("resolves the retrieved feature and drops the id prefix from the path", async () => {
    respond(RETRIEVED);

    const result = await retrieveMapboxPlace("mapbox:dXJuOm1ieHBvaTo", "s1", undefined, TOKEN);

    expect(result?.target).toEqual({
      kind: "ok",
      city: "Houston, TX",
      area: "7800 Airport Blvd",
    });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("mapbox%3A");
  });

  it("returns null on an empty feature list, so the caller keeps the suggestion", async () => {
    respond({ features: [] });
    const result = await retrieveMapboxPlace("mapbox:x", "s1", undefined, TOKEN);
    expect(result).toBeNull();
  });

  it("never calls Mapbox without a real public token", async () => {
    const result = await retrieveMapboxPlace("mapbox:x", "s1", undefined, "");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a failed lookup rather than returning a wrong place", async () => {
    respond({}, false, 422);
    const lookup = retrieveMapboxPlace("mapbox:x", "s1", undefined, TOKEN);
    await expect(lookup).rejects.toThrow("Place lookup failed (422)");
  });
});
