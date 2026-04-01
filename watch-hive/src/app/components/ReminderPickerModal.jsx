"use client";
import { useState, useEffect } from "react";

const KIND_OPTIONS = [
  { value: "release_day", label: "On release day" },
  { value: "one_day_before", label: "1 day before" },
  { value: "one_week_before", label: "1 week before" },
  { value: "custom", label: "Custom (days before)" },
];

export default function ReminderPickerModal({
  open,
  onClose,
  contentId,
  mediaType,
  variant,
  title = "Reminder for releases",
  flowKey, // e.g. "watching" or "wishlist" for per-flow suppression
}) {
  const [useGlobal, setUseGlobal] = useState(true);
  const [kind, setKind] = useState("release_day");
  const [customDays, setCustomDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Reset local checkbox state whenever modal opens
    if (open) {
      setDontShowAgain(false);
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    try {
      const path =
        variant === "watching"
          ? "/api/user/watching-reminder"
          : "/api/user/wishlist-reminder";
      const body =
        variant === "watching"
          ? {
              content_id: contentId,
              media_type: "tv",
              use_global_default: useGlobal,
              reminder_kind: useGlobal ? undefined : kind,
              custom_days_before:
                !useGlobal && kind === "custom" ? customDays : undefined,
            }
          : {
              content_id: contentId,
              media_type: mediaType,
              use_global_default: useGlobal,
              reminder_kind: useGlobal ? undefined : kind,
              custom_days_before:
                !useGlobal && kind === "custom" ? customDays : undefined,
            };
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save");
        return;
      }
      // Persist per-flow "don't show again" flag in localStorage when requested
      if (dontShowAgain && typeof window !== "undefined" && flowKey) {
        window.localStorage.setItem(
          `watchhive_suppress_${flowKey}_reminder_picker`,
          "1",
        );
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
      <div className="futuristic-card max-w-md w-full p-6 space-y-4">
        <h3 className="text-xl font-bold text-amber-500">{title}</h3>
        <p className="text-white/80 text-sm">
          Choose when to get in-app (and push) reminders for Canadian release / air dates.
        </p>
        <label className="flex items-center gap-2 text-white cursor-pointer">
          <input
            type="checkbox"
            checked={useGlobal}
            onChange={(e) => setUseGlobal(e.target.checked)}
          />
          Use my global default (Settings → Notifications)
        </label>
        {flowKey && (
          <label className="flex items-center gap-2 text-white/80 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don't show this picker again for this action
          </label>
        )}
        {!useGlobal && (
          <div className="space-y-2 pl-2 border-l-2 border-amber-500/40">
            {KIND_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 text-white text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="remkind"
                  value={o.value}
                  checked={kind === o.value}
                  onChange={() => setKind(o.value)}
                />
                {o.label}
              </label>
            ))}
            {kind === "custom" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-white text-sm">Days before (1–30):</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customDays}
                  onChange={(e) =>
                    setCustomDays(
                      Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)),
                    )
                  }
                  className="w-20 px-2 py-1 bg-charcoal-900 border border-charcoal-600 rounded text-white"
                />
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="futuristic-button px-4 py-2"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
