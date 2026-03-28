"use client";
import { useMemo, useState } from "react";

/**
 * @param {object} props
 * @param {string} props.value - IANA timezone
 * @param {(tz: string) => void} props.onChange
 * @param {{ tz: string, label: string }[]} props.rows
 */
export default function TimeZonePicker({ value, onChange, rows }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return rows;
    return rows.filter(({ tz, label }) => {
      const flat = `${tz} ${label}`.toLowerCase().replace(/_/g, " ");
      return flat.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="rounded-lg border border-charcoal-700/50 bg-charcoal-900/30 overflow-hidden">
      <label htmlFor="tz-search" className="sr-only">
        Search timezones
      </label>
      <input
        id="tz-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search PST, Tokyo, Europe/London…"
        autoComplete="off"
        spellCheck={false}
        className="w-full px-4 py-2.5 bg-charcoal-900/80 border-b border-charcoal-700/50 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:ring-inset"
      />
      <ul
        className="max-h-[7.75rem] overflow-y-auto overscroll-contain py-0.5 scroll-py-1"
        role="listbox"
        aria-label="Timezones"
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-2 text-sm text-white/50">No matches. Try another word.</li>
        ) : (
          filtered.map(({ tz, label }) => {
            const selected = tz === value;
            return (
              <li key={tz} role="option" aria-selected={selected}>
                <button
                  type="button"
                  title={label}
                  onClick={() => onChange(tz)}
                  className={`flex w-full h-10 shrink-0 items-center text-left px-4 text-sm transition-colors ${
                    selected
                      ? "bg-amber-500/20 text-amber-200 font-medium"
                      : "text-white/90 hover:bg-charcoal-800/80"
                  }`}
                >
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
