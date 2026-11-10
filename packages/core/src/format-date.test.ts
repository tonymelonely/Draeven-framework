/* Draeven Core: tests for formatDate() */

import { expect, test } from "vitest";
import {
  countries,
  formatDate,
  Japan,
  Netherlands,
  UnitedKingdom,
  UnitedStates,
  type Country,
} from "./format-date.js";

const date = new Date(Date.UTC(2020, 2, 5));

test("Netherlands writes the day first", () => {
  expect(formatDate(date, Netherlands)).toBe("05-03-2020");
});

test("the United States writes the month first", () => {
  expect(formatDate(date, UnitedStates)).toBe("03/05/2020");
});

test("the United Kingdom writes the day first", () => {
  expect(formatDate(date, UnitedKingdom)).toBe("05/03/2020");
});

test("Japan writes the year first", () => {
  expect(formatDate(date, Japan)).toBe("2020/03/05");
});

test("every country can format a date", () => {
  for (const country of Object.values(countries)) {
    expect(formatDate(date, country).length).toBeGreaterThan(0);
  }
});

test("an invalid date is rejected", () => {
  expect(() => formatDate(new Date(Number.NaN), Netherlands)).toThrow(
    "A date is required."
  );
});

test("an unknown country is rejected", () => {
  expect(() => formatDate(date, "ZZ" as Country)).toThrow("Unknown country.");
});
