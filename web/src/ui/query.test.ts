import { describe, expect, it } from "vitest";
import { searchFromSelection, selectionFromSearch } from "./query";

describe("selection query", () => {
  it("reads a shared link", () => {
    const selection = selectionFromSearch(
      "?site=apollo-11&date=2027-01-15&compare=shackleton-rim&profile=long-stay",
    );
    expect(selection).toEqual({
      siteId: "apollo-11",
      landingUtc: "2027-01-15T00:00:00Z",
      compareSiteId: "shackleton-rim",
      profileId: "long-stay",
    });
  });

  it("keeps a landing time that is not midnight", () => {
    const selection = selectionFromSearch("?date=2027-04-02T06:30:00Z");
    expect(selection.landingUtc).toBe("2027-04-02T06:30:00Z");
    expect(searchFromSelection(selection)).toContain("date=2027-04-02T06%3A30%3A00Z");
  });

  it("writes the four fields", () => {
    const search = searchFromSelection({
      siteId: "nobile-rim-1",
      landingUtc: "2027-03-03T00:00:00Z",
      profileId: "small-lander",
      compareSiteId: "shackleton-floor",
    });
    expect(search).toBe(
      "?site=nobile-rim-1&date=2027-03-03&compare=shackleton-floor&profile=small-lander",
    );
  });
});
