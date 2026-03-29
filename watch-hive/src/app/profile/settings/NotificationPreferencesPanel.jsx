"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { getSortedTimeZones, timezoneOptionLabel } from "./notifications/timeZones";
import TimeZonePicker from "./notifications/TimeZonePicker";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const KINDS = [
  { value: "release_day", label: "On release / air day" },
  { value: "one_day_before", label: "1 day before" },
  { value: "one_week_before", label: "1 week before" },
  { value: "custom", label: "Custom — X days before" },
];

function prefsPayload(timezone, reminderKinds, customDays, pushEnabled) {
  const hasCustom = reminderKinds.includes("custom");
  return {
    timezone,
    default_reminder_kinds: reminderKinds,
    custom_days_before: hasCustom ? customDays : null,
    push_enabled: pushEnabled,
  };
}

/**
 * @param {{ showNavLinks?: boolean }} props
 * showNavLinks — back link + feed link (standalone /profile/settings/notifications page)
 */
export default function NotificationPreferencesPanel({ showNavLinks = false }) {
  const { user, loading: authLoading } = useAuth();
  const timeZoneOptions = useMemo(() => getSortedTimeZones(), []);
  const [timezone, setTimezone] = useState("America/Toronto");
  const [reminderKinds, setReminderKinds] = useState(["release_day"]);
  const [customDays, setCustomDays] = useState(3);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [msg, setMsg] = useState("");
  const [timeLabelTick, setTimeLabelTick] = useState(0);
  const [timeLabelsReady, setTimeLabelsReady] = useState(false);

  const selectTimeZones = useMemo(() => {
    if (timezone && !timeZoneOptions.includes(timezone)) {
      return [timezone, ...timeZoneOptions];
    }
    return timeZoneOptions;
  }, [timezone, timeZoneOptions]);

  const timeZoneRows = useMemo(() => {
    const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
    return selectTimeZones.map((tz) => ({
      tz,
      label:
        timeLabelsReady && timeLabelTick
          ? timezoneOptionLabel(tz, locale, new Date(timeLabelTick))
          : tz.replace(/_/g, " "),
    }));
  }, [selectTimeZones, timeLabelTick, timeLabelsReady]);

  useEffect(() => {
    setTimeLabelTick(Date.now());
    setTimeLabelsReady(true);
    const id = setInterval(() => setTimeLabelTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const toggleKind = (value) => {
    setReminderKinds((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size <= 1) return prev;
        next.delete(value);
      } else {
        next.add(value);
      }
      return [...next];
    });
  };

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/user/notification-preferences", {
      credentials: "include",
    });
    if (!res.ok) return;
    const { preferences } = await res.json();
    if (preferences.timezone) setTimezone(preferences.timezone);
    if (Array.isArray(preferences.default_reminder_kinds) && preferences.default_reminder_kinds.length) {
      setReminderKinds(preferences.default_reminder_kinds);
    } else if (preferences.default_reminder_kind) {
      setReminderKinds([preferences.default_reminder_kind]);
    }
    if (preferences.custom_days_before != null) {
      setCustomDays(preferences.custom_days_before);
    }
    setPushEnabled(!!preferences.push_enabled);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  const savePrefs = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prefsPayload(timezone, reminderKinds, customDays, pushEnabled)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.error || "Save failed");
        return;
      }
      setMsg("Saved.");
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("This browser does not support push alerts.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        setMsg("Push alerts are not available on this server right now.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Notifications are turned off — allow them in your browser settings to continue.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sub.toJSON()),
      });
      if (!subRes.ok) {
        const err = await subRes.json().catch(() => ({}));
        setMsg(err.error || "Could not turn on alerts.");
        return;
      }
      const prefRes = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...prefsPayload(timezone, reminderKinds, customDays, true),
          push_enabled: true,
        }),
      });
      if (!prefRes.ok) {
        setMsg("Alerts are on, but we could not save your settings. Try Save preferences.");
        return;
      }
      setPushEnabled(true);
      setMsg("Push alerts are on.");
    } catch (e) {
      console.error(e);
      setMsg("Something went wrong turning on alerts. Try again in a moment.");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint }),
      });
      setPushEnabled(false);
      await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ push_enabled: false }),
      });
      setMsg("Push alerts are off.");
    } catch (e) {
      console.error(e);
      setMsg("Could not turn off alerts completely. Check your device settings.");
    } finally {
      setPushBusy(false);
    }
  };

  if (authLoading) {
    return <p className="text-white/70">Loading…</p>;
  }
  if (!user) {
    return (
      <div className="futuristic-card p-8 text-center text-white">
        Sign in to manage notification settings.
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${showNavLinks ? "max-w-xl" : "max-w-none"}`} id={showNavLinks ? undefined : "notification-preferences"}>
      {showNavLinks && (
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 text-amber-500 hover:underline text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to settings
        </Link>
      )}
      <h2 className="text-2xl font-bold text-amber-500">Notification preferences</h2>
      <p className="text-white/70 text-sm">
        Release dates follow the Canadian TV schedule when we have them. Your timezone decides what
        counts as &quot;today&quot; for reminders.
      </p>

      {!standalone && (
        <p className="text-amber-500/90 text-sm border border-amber-500/30 rounded-lg p-3">
          On iPhone or iPad, add WatchHive to your Home Screen for the most reliable alerts (Safari).
        </p>
      )}

      <div className="futuristic-card p-6 space-y-4">
        <div>
          <span className="block text-white font-semibold mb-2" id="tz-heading">
            Your timezone
          </span>
          <p className="text-white/50 text-xs mb-2">
            Search or scroll by name or abbreviation (e.g. EST, GMT+1)
          </p>
          <div aria-labelledby="tz-heading">
            <TimeZonePicker value={timezone} onChange={setTimezone} rows={timeZoneRows} />
          </div>
        </div>

        <div>
          <span className="block text-white font-semibold mb-2">Remind me</span>
          <p className="text-white/60 text-xs mb-2">You can pick more than one.</p>
          <div className="space-y-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="flex items-center gap-2 text-white text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={reminderKinds.includes(k.value)}
                  onChange={() => toggleKind(k.value)}
                />
                {k.label}
              </label>
            ))}
          </div>
          {reminderKinds.includes("custom") && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
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

        <button
          type="button"
          disabled={saving}
          onClick={savePrefs}
          className="futuristic-button-yellow px-6 py-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>

      <div className="futuristic-card p-6 space-y-4">
        <h3 className="text-lg font-bold text-amber-500">Phone &amp; computer alerts</h3>
        <p className="text-white/70 text-sm">
          Get a heads-up on your device when something you follow has news or a release coming up.
          You can turn this off anytime.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pushBusy}
            onClick={enablePush}
            className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
          >
            {pushBusy ? "Working…" : "Turn on alerts"}
          </button>
          <button
            type="button"
            disabled={pushBusy}
            onClick={disablePush}
            className="futuristic-button px-4 py-2 disabled:opacity-50"
          >
            Turn off alerts
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-amber-400">{msg}</p>}

      {showNavLinks && (
        <Link href="/profile/notifications" className="text-amber-500 hover:underline text-sm">
          View your notification feed
        </Link>
      )}
    </div>
  );
}
