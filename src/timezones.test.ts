import { describe, expect, it } from "vitest";
import {
  buildScheduleGrid,
  convertMeetingTime,
  getZoneOffsetForInstant,
  TimezoneOption,
  UTC_PLUS_THREE_ZONE
} from "./timezones";

const berlin: TimezoneOption = {
  id: "Europe/Berlin",
  label: "Berlin",
  type: "iana"
};

const newYork: TimezoneOption = {
  id: "America/New_York",
  label: "New York",
  type: "iana"
};

const sanFrancisco: TimezoneOption = {
  id: "America/Los_Angeles",
  label: "San Francisco",
  type: "iana"
};

describe("timezone conversion", () => {
  it("converts one local wall-clock time into the same instant across zones", () => {
    const [utcPlusThree, berlinTime, newYorkTime] = convertMeetingTime({
      date: "2026-06-19",
      time: "12:00",
      baseZoneId: "UTC+03:00",
      selectedZones: [UTC_PLUS_THREE_ZONE, berlin, newYork],
      durationMinutes: 30
    });

    expect(utcPlusThree.timeLabel).toBe("12:00 PM");
    expect(utcPlusThree.offsetLabel).toBe("UTC+3");
    expect(berlinTime.timeLabel).toBe("11:00 AM");
    expect(berlinTime.offsetLabel).toBe("UTC+2");
    expect(newYorkTime.timeLabel).toBe("5:00 AM");
    expect(newYorkTime.offsetLabel).toBe("UTC-4");
  });

  it("uses date-specific daylight saving offsets for Berlin and New York", () => {
    expect(getZoneOffsetForInstant("Europe/Berlin", "2026-01-15T12:00:00Z")).toBe("+01:00");
    expect(getZoneOffsetForInstant("Europe/Berlin", "2026-07-15T12:00:00Z")).toBe("+02:00");
    expect(getZoneOffsetForInstant("America/New_York", "2026-01-15T12:00:00Z")).toBe("-05:00");
    expect(getZoneOffsetForInstant("America/New_York", "2026-07-15T12:00:00Z")).toBe("-04:00");
  });

  it("keeps UTC+3 fixed across seasons", () => {
    expect(getZoneOffsetForInstant("UTC+03:00", "2026-01-15T12:00:00Z")).toBe("+03:00");
    expect(getZoneOffsetForInstant("UTC+03:00", "2026-07-15T12:00:00Z")).toBe("+03:00");
  });

  it("classifies meeting hours using the full duration in each local timezone", () => {
    const rows = convertMeetingTime({
      date: "2026-06-19",
      time: "09:00",
      baseZoneId: "America/New_York",
      selectedZones: [newYork, sanFrancisco, berlin],
      durationMinutes: 60
    });

    expect(rows.find((row) => row.zone.id === "America/New_York")?.meetingStatus).toBe("good");
    expect(rows.find((row) => row.zone.id === "America/Los_Angeles")?.meetingStatus).toBe("outside");
    expect(rows.find((row) => row.zone.id === "Europe/Berlin")?.meetingStatus).toBe("good");
  });

  it("builds a 24-hour schedule where every row shares the same selected instant", () => {
    const grid = buildScheduleGrid({
      date: "2026-06-19",
      baseZoneId: "UTC+03:00",
      selectedZones: [UTC_PLUS_THREE_ZONE, berlin, newYork]
    });

    expect(grid.columns).toHaveLength(24);
    expect(grid.rows).toHaveLength(3);
    expect(grid.rows.every((row) => row.cells.length === 24)).toBe(true);
    expect(grid.rows[0].cells[12].instant).toBe(grid.rows[1].cells[12].instant);
    expect(grid.rows[0].cells[12].timeLabel).toBe("12:00");
    expect(grid.rows[1].cells[12].timeLabel).toBe("11:00");
    expect(grid.rows[2].cells[12].timeLabel).toBe("05:00");
  });

  it("marks local work-hour cells independently for each timezone", () => {
    const grid = buildScheduleGrid({
      date: "2026-06-19",
      baseZoneId: "America/New_York",
      selectedZones: [newYork, sanFrancisco, berlin]
    });

    const newYorkNine = grid.rows[0].cells[9];
    const sanFranciscoSix = grid.rows[1].cells[9];
    const berlinThree = grid.rows[2].cells[9];

    expect(newYorkNine.timeLabel).toBe("09:00");
    expect(newYorkNine.isWorkHour).toBe(true);
    expect(sanFranciscoSix.timeLabel).toBe("06:00");
    expect(sanFranciscoSix.isWorkHour).toBe(false);
    expect(berlinThree.timeLabel).toBe("15:00");
    expect(berlinThree.isWorkHour).toBe(true);
  });
});
