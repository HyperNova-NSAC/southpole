import { describe, expect, it } from "vitest";
import { addScenario, differentSiteId, MAX_SCENARIOS, removeScenario, updateScenario, type Scenario } from "./scenarios";

const first: Scenario = {
  id: "case-1",
  siteId: "shackleton-rim",
  landingUtc: "2027-01-15T00:00:00Z",
  durationHours: 336,
  maxNightHours: 50,
};

describe("scenarios", () => {
  it("adds a different landing until three, then stops", () => {
    const two = addScenario([first], { ...first, siteId: "nobile-rim-1" });
    const three = addScenario(two, { ...first, siteId: "apollo-11" });
    const four = addScenario(three, { ...first, siteId: "haworth" });
    expect(two).toHaveLength(2);
    expect(three).toHaveLength(MAX_SCENARIOS);
    expect(four).toBe(three);
  });

  it("keeps the last landing when one is removed", () => {
    const two = addScenario([first], { ...first, siteId: "apollo-11" });
    expect(removeScenario(two, "case-1")).toEqual([two[1]]);
    expect(removeScenario([first], "case-1")).toEqual([first]);
  });

  it("drops custom coordinates when the landing switches to a catalog site", () => {
    const custom: Scenario = {
      ...first,
      siteId: "custom",
      latDeg: -89.5,
      lonDegEast: 1,
    };
    const [next] = updateScenario([custom], "case-1", { siteId: "apollo-11" });
    expect(next?.siteId).toBe("apollo-11");
    expect(next?.latDeg).toBeUndefined();
  });

  it("picks a catalog site that is not already being compared", () => {
    expect(differentSiteId([{ id: "a" }, { id: "b" }], ["a"])).toBe("b");
    expect(differentSiteId([{ id: "a" }], ["a"])).toBe("a");
  });
});
