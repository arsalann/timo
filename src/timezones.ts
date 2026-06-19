import { Temporal } from "@js-temporal/polyfill";

export type ZoneType = "iana" | "fixedOffset";

export type TimezoneOption = {
  id: string;
  label: string;
  type: ZoneType;
};

export type ConvertedTime = {
  zone: TimezoneOption;
  dateLabel: string;
  timeLabel: string;
  weekdayLabel: string;
  offsetLabel: string;
  dayDifference: number;
  meetingStatus: "good" | "edge" | "outside";
  meetingStatusLabel: string;
  sortInstant: string;
};

export type MeetingInput = {
  date: string;
  time: string;
  baseZoneId: string;
  selectedZones: TimezoneOption[];
  durationMinutes: number;
};

export type ScheduleColumn = {
  index: number;
  instant: string;
  baseLabel: string;
};

export type ScheduleCell = {
  instant: string;
  timeLabel: string;
  dateLabel: string;
  dayDifference: number;
  offsetLabel: string;
  isWorkHour: boolean;
};

export type ScheduleRow = {
  zone: TimezoneOption;
  cells: ScheduleCell[];
};

export type ScheduleGrid = {
  columns: ScheduleColumn[];
  rows: ScheduleRow[];
};

export type ScheduleInput = {
  date: string;
  baseZoneId: string;
  selectedZones: TimezoneOption[];
};

const DEFAULT_IANA_ZONES = [
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Karachi",
  "Europe/Istanbul",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney"
];

const WORKDAY_START_MINUTES = 9 * 60;
const WORKDAY_END_MINUTES = 17 * 60;

export const UTC_ZONE: TimezoneOption = {
  id: "UTC",
  label: "UTC",
  type: "iana"
};

export const UTC_PLUS_THREE_ZONE: TimezoneOption = {
  id: "UTC+03:00",
  label: "UTC+3",
  type: "fixedOffset"
};

export const DEFAULT_SELECTED_ZONE_IDS = [
  "UTC",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles"
];

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getTimezoneOptions(): TimezoneOption[] {
  const supportedZones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : DEFAULT_IANA_ZONES;

  const ianaZones = Array.from(new Set(["UTC", ...supportedZones])).map((id) => ({
    id,
    label: labelForIanaZone(id),
    type: "iana" as const
  }));

  return [UTC_PLUS_THREE_ZONE, ...ianaZones].sort((a, b) => {
    if (a.id === "UTC+03:00") return -1;
    if (b.id === "UTC+03:00") return 1;
    if (a.id === "UTC") return -1;
    if (b.id === "UTC") return 1;
    return a.label.localeCompare(b.label);
  });
}

export function findZoneOption(options: TimezoneOption[], id: string): TimezoneOption {
  return options.find((zone) => zone.id === id) ?? {
    id,
    label: id,
    type: id.startsWith("UTC+") || id.startsWith("UTC-") ? "fixedOffset" : "iana"
  };
}

export function convertMeetingTime(input: MeetingInput): ConvertedTime[] {
  const baseDateTime = Temporal.PlainDateTime.from(`${input.date}T${input.time}`);
  const baseZone = toTemporalZoneId(input.baseZoneId);
  const baseZonedTime = baseDateTime.toZonedDateTime(baseZone);
  const instant = baseZonedTime.toInstant();
  const baseDate = Temporal.PlainDate.from(input.date);

  return input.selectedZones.map((zone) => {
    const zonedTime = instant.toZonedDateTimeISO(toTemporalZoneId(zone.id));
    const status = getMeetingStatus(zonedTime, input.durationMinutes);
    const localDate = zonedTime.toPlainDate();

    return {
      zone,
      dateLabel: formatDate(localDate),
      timeLabel: formatTime12Hour(zonedTime),
      weekdayLabel: formatWeekday(zonedTime),
      offsetLabel: formatOffset(zonedTime.offset),
      dayDifference: compareDates(localDate, baseDate),
      meetingStatus: status,
      meetingStatusLabel: getMeetingStatusLabel(status),
      sortInstant: instant.toString()
    };
  });
}

export function buildScheduleGrid(input: ScheduleInput): ScheduleGrid {
  const baseZone = toTemporalZoneId(input.baseZoneId);
  const baseDate = Temporal.PlainDate.from(input.date);

  const columns = Array.from({ length: 24 }, (_, hour) => {
    const baseDateTime = Temporal.PlainDateTime.from(
      `${input.date}T${String(hour).padStart(2, "0")}:00`
    );
    const instant = baseDateTime.toZonedDateTime(baseZone).toInstant();

    return {
      index: hour,
      instant: instant.toString(),
      baseLabel: formatTime24Hour(hour)
    };
  });

  const rows = input.selectedZones.map((zone) => ({
    zone,
    cells: columns.map((column) => {
      const zonedTime = Temporal.Instant.from(column.instant).toZonedDateTimeISO(
        toTemporalZoneId(zone.id)
      );
      const localDate = zonedTime.toPlainDate();

      return {
        instant: column.instant,
        timeLabel: formatTime24Hour(zonedTime.hour),
        dateLabel: formatShortDate(localDate),
        dayDifference: compareDates(localDate, baseDate),
        offsetLabel: formatOffset(zonedTime.offset),
        isWorkHour: isWorkHour(zonedTime)
      };
    })
  }));

  return {
    columns,
    rows
  };
}

export function getZoneOffsetForInstant(zoneId: string, isoInstant: string): string {
  return Temporal.Instant.from(isoInstant).toZonedDateTimeISO(toTemporalZoneId(zoneId)).offset;
}

export function toTemporalZoneId(zoneId: string): string {
  if (zoneId === "UTC+03:00") {
    return "+03:00";
  }

  if (zoneId.startsWith("UTC+") || zoneId.startsWith("UTC-")) {
    return zoneId.replace("UTC", "");
  }

  return zoneId;
}

export function labelForIanaZone(id: string): string {
  if (id === "UTC") {
    return "UTC";
  }

  const parts = id.split("/");
  const city = parts[parts.length - 1].replaceAll("_", " ");
  const region = parts.length > 1 ? parts[0].replaceAll("_", " ") : "";

  return region ? `${city} (${region})` : city;
}

function formatDate(date: Temporal.PlainDate): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day))
  );

  return `${month} ${date.day}, ${date.year}`;
}

function formatTime12Hour(dateTime: Temporal.ZonedDateTime): string {
  const period = dateTime.hour >= 12 ? "PM" : "AM";
  const hour = dateTime.hour % 12 || 12;
  const minute = String(dateTime.minute).padStart(2, "0");

  return `${hour}:${minute} ${period}`;
}

function formatTime24Hour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatShortDate(date: Temporal.PlainDate): string {
  return `${String(date.month).padStart(2, "0")}/${String(date.day).padStart(2, "0")}`;
}

function formatWeekday(dateTime: Temporal.ZonedDateTime): string {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return weekdays[dateTime.dayOfWeek - 1];
}

function formatOffset(offset: string): string {
  if (offset === "+00:00") {
    return "UTC";
  }

  const sign = offset.startsWith("-") ? "-" : "+";
  const [hours, minutes] = offset.slice(1).split(":");
  const normalizedHours = String(Number(hours));

  return minutes === "00" ? `UTC${sign}${normalizedHours}` : `UTC${sign}${normalizedHours}:${minutes}`;
}

function getMeetingStatus(
  start: Temporal.ZonedDateTime,
  durationMinutes: number
): ConvertedTime["meetingStatus"] {
  const startMinutes = start.hour * 60 + start.minute;
  const end = start.add({ minutes: durationMinutes });
  const endMinutes = end.hour * 60 + end.minute;
  const sameLocalDate = Temporal.PlainDate.compare(start.toPlainDate(), end.toPlainDate()) === 0;

  if (
    sameLocalDate &&
    startMinutes >= WORKDAY_START_MINUTES &&
    endMinutes <= WORKDAY_END_MINUTES
  ) {
    return "good";
  }

  if (startMinutes >= 7 * 60 && startMinutes < 20 * 60) {
    return "edge";
  }

  return "outside";
}

function isWorkHour(dateTime: Temporal.ZonedDateTime): boolean {
  const startMinutes = dateTime.hour * 60 + dateTime.minute;

  return startMinutes >= WORKDAY_START_MINUTES && startMinutes < WORKDAY_END_MINUTES;
}

function getMeetingStatusLabel(status: ConvertedTime["meetingStatus"]): string {
  if (status === "good") {
    return "Meeting hours";
  }

  if (status === "edge") {
    return "Early or late";
  }

  return "Outside hours";
}

function compareDates(date: Temporal.PlainDate, baseDate: Temporal.PlainDate): number {
  return date.since(baseDate, { largestUnit: "days" }).days;
}
