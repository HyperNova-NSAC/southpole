import { describe, expect, it } from "vitest";
import { searchFromSelection, selectionFromSearch } from "./query";

describe("selection query", () => {
  it("reads a shared link", () => {
    const selection = selectionFromSearch("?site=apollo-11&date=2027-01-15&days=30");
    expect(selection).toEqual({
      siteId: "apollo-11",
      landingUtc: "2027-01-15T00:00:00Z",
      durationHours: 720,
      maxNightHours: 50,
    });
  });

  it("reads an older profile link as a window length", () => {
    expect(selectionFromSearch("?profile=long-stay").durationHours).toBe(2400);
    expect(selectionFromSearch("?profile=small-lander").durationHours).toBe(336);
  });

  it("clamps a window onto the half-hour step and 180-day limit", () => {
    expect(selectionFromSearch("?days=0").durationHours).toBe(0.5);
    expect(selectionFromSearch("?minutes=10").durationHours).toBe(0.5);
    expect(selectionFromSearch("?minutes=45").durationHours).toBe(1);
    expect(selectionFromSearch("?days=400").durationHours).toBe(180 * 24);
  });

  it("reads hours and minutes", () => {
    expect(selectionFromSearch("?hours=6").durationHours).toBe(6);
    expect(selectionFromSearch("?minutes=90").durationHours).toBe(1.5);
  });

  it("keeps a landing time that is not midnight", () => {
    const selection = selectionFromSearch("?date=2027-04-02T06:30:00Z");
    expect(selection.landingUtc).toBe("2027-04-02T06:30:00Z");
    expect(searchFromSelection(selection)).toContain("date=2027-04-02T06%3A30%3A00Z");
  });

  it("writes site, date and window", () => {
    const search = searchFromSelection({
      siteId: "nobile-rim-1",
      landingUtc: "2027-03-03T00:00:00Z",
      durationHours: 336,
      maxNightHours: 50,
    });
    expect(search).toBe("?site=nobile-rim-1&date=2027-03-03&days=14");
  });

  it("writes hours and minutes when the length is not a whole number of days", () => {
    expect(
      searchFromSelection({
        siteId: "shackleton-rim",
        landingUtc: "2027-03-03T00:00:00Z",
        durationHours: 6,
        maxNightHours: 50,
      }),
    ).toBe("?site=shackleton-rim&date=2027-03-03&hours=6");
    expect(
      searchFromSelection({
        siteId: "shackleton-rim",
        landingUtc: "2027-03-03T00:00:00Z",
        durationHours: 1.5,
        maxNightHours: 50,
      }),
    ).toBe("?site=shackleton-rim&date=2027-03-03&minutes=90");
  });

  it("reads and writes a night limit in hours, days, or minutes", () => {
    expect(selectionFromSearch("?nightHours=10").maxNightHours).toBe(10);
    expect(selectionFromSearch("?nightDays=2").maxNightHours).toBe(48);
    expect(selectionFromSearch("?nightMinutes=90").maxNightHours).toBe(1.5);
    expect(selectionFromSearch("").maxNightHours).toBe(50);
    expect(selectionFromSearch("?nightHours=0").maxNightHours).toBe(0.5);
    const search = searchFromSelection({
      siteId: "apollo-11",
      landingUtc: "2027-01-15T00:00:00Z",
      durationHours: 336,
      maxNightHours: 10,
    });
    expect(search).toBe("?site=apollo-11&date=2027-01-15&days=14&nightHours=10");
    expect(
      searchFromSelection({
        siteId: "apollo-11",
        landingUtc: "2027-01-15T00:00:00Z",
        durationHours: 336,
        maxNightHours: 48,
      }),
    ).toContain("nightDays=2");
    expect(
      searchFromSelection({
        siteId: "apollo-11",
        landingUtc: "2027-01-15T00:00:00Z",
        durationHours: 336,
        maxNightHours: 1.5,
      }),
    ).toContain("nightMinutes=90");
  });

  it("round-trips a typed location as lat and lon", () => {
    const search = searchFromSelection({
      siteId: "custom",
      landingUtc: "2027-03-03T00:00:00Z",
      durationHours: 336,
      maxNightHours: 50,
      latDeg: -89.1,
      lonDegEast: 120.5,
    });
    expect(search).toBe("?lat=-89.1&lon=120.5&date=2027-03-03&days=14");
    expect(selectionFromSearch(search)).toMatchObject({
      siteId: "custom",
      latDeg: -89.1,
      lonDegEast: 120.5,
    });
  });
});
