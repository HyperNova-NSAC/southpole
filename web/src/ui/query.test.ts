import { describe, expect, it } from "vitest";
import { searchFromSelection, selectionFromSearch } from "./query";

describe("selection query", () => {
  it("reads a shared link", () => {
    const selection = selectionFromSearch("?site=apollo-11&date=2027-01-15&profile=long-stay");
    expect(selection).toEqual({
      siteId: "apollo-11",
      landingUtc: "2027-01-15T00:00:00Z",
      profileId: "long-stay",
    });
  });

  it("keeps a landing time that is not midnight", () => {
    const selection = selectionFromSearch("?date=2027-04-02T06:30:00Z");
    expect(selection.landingUtc).toBe("2027-04-02T06:30:00Z");
    expect(searchFromSelection(selection)).toContain("date=2027-04-02T06%3A30%3A00Z");
  });

  it("writes site, date and profile", () => {
    const search = searchFromSelection({
      siteId: "nobile-rim-1",
      landingUtc: "2027-03-03T00:00:00Z",
      profileId: "small-lander",
    });
    expect(search).toBe("?site=nobile-rim-1&date=2027-03-03&profile=small-lander");
  });

  it("round-trips a typed location as lat and lon", () => {
    const search = searchFromSelection({
      siteId: "custom",
      landingUtc: "2027-03-03T00:00:00Z",
      profileId: "small-lander",
      latDeg: -89.1,
      lonDegEast: 120.5,
    });
    expect(search).toBe("?lat=-89.1&lon=120.5&date=2027-03-03&profile=small-lander");
    expect(selectionFromSearch(search)).toMatchObject({
      siteId: "custom",
      latDeg: -89.1,
      lonDegEast: 120.5,
    });
  });
});
