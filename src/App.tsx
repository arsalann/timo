import { CalendarDays, Globe2, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildScheduleGrid,
  DEFAULT_SELECTED_ZONE_IDS,
  findZoneOption,
  getBrowserTimeZone,
  getTimezoneOptions
} from "./timezones";

export function App() {
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const browserZone = useMemo(() => getBrowserTimeZone(), []);
  const [date, setDate] = useState(getTodayDate());
  const [baseZoneId, setBaseZoneId] = useState(
    timezoneOptions.some((zone) => zone.id === browserZone) ? browserZone : "UTC"
  );
  const [selectedZoneIds, setSelectedZoneIds] = useState(() =>
    Array.from(new Set([browserZone, ...DEFAULT_SELECTED_ZONE_IDS])).filter((id) =>
      timezoneOptions.some((zone) => zone.id === id)
    )
  );
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSearchingZones, setIsSearchingZones] = useState(false);

  const selectedZones = useMemo(
    () => selectedZoneIds.map((id) => findZoneOption(timezoneOptions, id)),
    [selectedZoneIds, timezoneOptions]
  );

  const schedule = useMemo(
    () =>
      buildScheduleGrid({
        date,
        baseZoneId,
        selectedZones
      }),
    [baseZoneId, date, selectedZones]
  );

  const addableZones = useMemo(
    () => timezoneOptions.filter((zone) => !selectedZoneIds.includes(zone.id)),
    [selectedZoneIds, timezoneOptions]
  );
  const filteredAddableZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    const zones = query
      ? addableZones.filter((zone) => `${zone.label} ${zone.id}`.toLowerCase().includes(query))
      : addableZones;

    return zones.slice(0, 7);
  }, [addableZones, zoneSearch]);

  const selectedColumn = schedule.columns[selectedHour];
  const selectedSummary = selectedColumn
    ? schedule.rows.map((row) => ({
        zone: row.zone,
        cell: row.cells[selectedHour]
      }))
    : [];

  function addTimezone(zoneId = zoneSearch.trim() ? filteredAddableZones[0]?.id : "") {
    if (!zoneId) {
      return;
    }

    setSelectedZoneIds((ids) => (ids.includes(zoneId) ? ids : [...ids, zoneId]));
    setZoneSearch("");
    setIsSearchingZones(false);
  }

  function removeTimezone(zoneId: string) {
    setSelectedZoneIds((ids) => ids.filter((id) => id !== zoneId));
    if (baseZoneId === zoneId) {
      setBaseZoneId(browserZone);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Timezone scheduler</p>
          <h1>24-hour meeting view</h1>
        </div>
        <div className="toolbar">
          <label className="field">
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              Date
            </span>
            <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
          </label>

          <label className="field base-zone">
            <span>
              <Globe2 size={15} aria-hidden="true" />
              Frame timezone
            </span>
            <select value={baseZoneId} onChange={(event) => setBaseZoneId(event.target.value)}>
              {timezoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label} - {zone.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="selected-strip" aria-label="Selected hour">
        <strong>{selectedColumn?.baseLabel ?? "00:00"} in frame timezone</strong>
        <span>
          Click any hour column. Work hours are shaded automatically for each timezone.
        </span>
      </section>

      <section className="schedule-shell" aria-label="24-hour timezone schedule">
        <div className="schedule-scroll">
          <div className="schedule-grid">
            <div className="zone-heading">Timezone</div>
            {schedule.columns.map((column) => (
              <button
                className={`hour-heading ${selectedHour === column.index ? "selected" : ""}`}
                key={column.index}
                type="button"
                onClick={() => setSelectedHour(column.index)}
              >
                {column.baseLabel}
              </button>
            ))}

            {schedule.rows.map((row) => (
              <div className="schedule-row" key={row.zone.id}>
                <div className="zone-cell">
                  <div>
                    <strong>{row.zone.label}</strong>
                    <span>{row.zone.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTimezone(row.zone.id)}
                    aria-label={`Remove ${row.zone.label}`}
                    title={`Remove ${row.zone.label}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>

                {row.cells.map((cell, index) => (
                  <button
                    className={[
                      "hour-cell",
                      cell.isWorkHour ? "work-hour" : "",
                      selectedHour === index ? "selected" : ""
                    ].join(" ")}
                    key={`${row.zone.id}-${cell.instant}`}
                    type="button"
                    onClick={() => setSelectedHour(index)}
                    title={`${row.zone.label}: ${cell.timeLabel}, ${cell.dateLabel}, ${cell.offsetLabel}`}
                  >
                    <span>{cell.timeLabel}</span>
                    <small>{formatDayShift(cell.dayDifference)}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="summary-bar" aria-label="Selected hour conversions">
          {selectedSummary.map(({ zone, cell }) => (
            <span key={zone.id}>
              <strong>{zone.label}</strong>
              {cell.timeLabel} {formatDayShift(cell.dayDifference)}
            </span>
          ))}
        </div>

        <div className="add-zone-panel">
          <div className="timezone-search">
            <label className="field add-zone">
              <span>Add timezone to bottom</span>
              <div className="search-input">
                <Search size={15} aria-hidden="true" />
                <input
                  value={zoneSearch}
                  onChange={(event) => {
                    setZoneSearch(event.target.value);
                    setIsSearchingZones(true);
                  }}
                  onFocus={() => setIsSearchingZones(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTimezone();
                    }

                    if (event.key === "Escape") {
                      setIsSearchingZones(false);
                    }
                  }}
                  placeholder="Search city or timezone"
                  aria-label="Search city or timezone"
                />
              </div>
            </label>

            {isSearchingZones && filteredAddableZones.length > 0 ? (
              <div className="timezone-results" role="listbox" aria-label="Timezone results">
                {filteredAddableZones.map((zone) => (
                  <button key={zone.id} type="button" onMouseDown={() => addTimezone(zone.id)}>
                    <span>{zone.label}</span>
                    <small>{zone.id}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            className="add-button"
            type="button"
            onClick={() => addTimezone()}
            disabled={!zoneSearch.trim() || filteredAddableZones.length === 0}
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
      </section>
    </main>
  );
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDayShift(dayDifference: number): string {
  if (dayDifference === 0) {
    return "";
  }

  return dayDifference > 0 ? `+${dayDifference}d` : `${dayDifference}d`;
}
