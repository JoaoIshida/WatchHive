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

function prefsPayload(
  timezone,
  reminderKinds,
  customDays,
  pushEnabled,
  pushFriends,
  pushCatchup,
  pushReleases,
) {
  const hasCustom = reminderKinds.includes("custom");
  return {
    timezone,
    default_reminder_kinds: reminderKinds,
    custom_days_before: hasCustom ? customDays : null,
    push_enabled: pushEnabled,
    push_friends: pushFriends,
    push_catchup: pushCatchup,
    push_releases: pushReleases,
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
  const [pushFriends, setPushFriends] = useState(true);
  const [pushCatchup, setPushCatchup] = useState(true);
  const [pushReleases, setPushReleases] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);
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
    setPushFriends(preferences.push_friends !== false);
    setPushCatchup(preferences.push_catchup !== false);
    setPushReleases(preferences.push_releases !== false);
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
        body: JSON.stringify(
          prefsPayload(
            timezone,
            reminderKinds,
            customDays,
            pushEnabled,
            pushFriends,
            pushCatchup,
            pushReleases,
          ),
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.error || "Save failed");
        return;
      }
      setMsg("Saved.");
      window.dispatchEvent(new CustomEvent("watchhive-timezone-updated"));
    } finally {
      setSaving(false);
    }
  };

  const saveTimezone = async () => {
    setSavingTimezone(true);
    setMsg("");
    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.error || "Could not save timezone");
        return;
      }
      setMsg("Timezone saved.");
      window.dispatchEvent(new CustomEvent("watchhive-timezone-updated"));
    } finally {
      setSavingTimezone(false);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("This browser does not support push notifications.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        setMsg("Push notifications are not available on this server right now.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg(
          "Browser notifications are blocked — allow them in your browser or OS settings to receive push.",
        );
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
        setMsg(err.error || "Could not turn on push notifications.");
        return;
      }
      const prefRes = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...prefsPayload(
            timezone,
            reminderKinds,
            customDays,
            true,
            pushFriends,
            pushCatchup,
            pushReleases,
          ),
          push_enabled: true,
        }),
      });
      if (!prefRes.ok) {
        setMsg("Push is on, but we could not save your settings. Try Save reminder settings.");
        return;
      }
      setPushEnabled(true);
      setMsg("Push notifications are on for this device.");
    } catch (e) {
      console.error(e);
      setMsg("Something went wrong turning on push. Try again in a moment.");
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
      setMsg("Push notifications are off for this device.");
    } catch (e) {
      console.error(e);
      setMsg("Could not turn off push completely. Check your device settings.");
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
      <h2 className="text-2xl font-bold text-amber-500">Timezone</h2>
      <p className="text-white/70 text-sm max-w-2xl">
        This is the zone used for <strong className="text-white/90 font-medium">episode air times</strong> on
        series pages (when we have a schedule from TVMaze) and for anything else that shows local dates and
        times. Reminder &quot;today&quot; also uses this zone.
      </p>

      <div className="futuristic-card p-6 space-y-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block text-white font-semibold" id="tz-heading">
              Your saved timezone
            </span>
            <p className="text-white/50 text-xs">
              Search or scroll by name or abbreviation (e.g. EST, GMT+1). This can differ from your device if
              you travel or use a VPN.
            </p>
            <div aria-labelledby="tz-heading">
              <TimeZonePicker value={timezone} onChange={setTimezone} rows={timeZoneRows} />
            </div>
          </div>
          <div className="shrink-0 w-full max-w-lg flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
            <div className="min-w-0 flex-1 flex items-center">
              <p className="text-white/80 text-sm leading-snug">
                <span className="text-white/50 block text-xs font-medium uppercase tracking-wide mb-1">
                  Selected timezone
                </span>
                <span className="font-mono text-white text-base break-all">
                  {timezone || "—"}
                </span>
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={savingTimezone}
          onClick={saveTimezone}
          className="futuristic-button-yellow px-6 py-2 disabled:opacity-50"
        >
          {savingTimezone ? "Saving…" : "Save timezone"}
        </button>
      </div>

      <h2 className="text-2xl font-bold text-amber-500 pt-2">Notifications</h2>
      <p className="text-white/60 text-sm max-w-2xl">
        Reminder timing uses your saved timezone above.{" "}
        <strong className="text-white/80 font-medium">Push</strong> is optional and only for this device — see
        the Push card below.
      </p>

      {!standalone && (
        <p className="text-amber-500/90 text-sm border border-amber-500/30 rounded-lg p-3">
          On iPhone or iPad, add WatchHive to your Home Screen for the most reliable push notifications
          (Safari).
        </p>
      )}

      <div className="futuristic-card p-6 space-y-4">
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
          {saving ? "Saving…" : "Save reminder settings"}
        </button>
      </div>

      <div className="futuristic-card p-6 space-y-4">
        <h3 className="text-lg font-bold text-amber-500">Push notifications</h3>
        <p className="text-white/60 text-xs uppercase tracking-wide">Phone, tablet, and computer</p>
        <p className="text-white/70 text-sm">
          Use the buttons here to allow or block push for <strong className="text-white/90 font-semibold">this device only</strong>.
          You can turn push off anytime; release timing above still applies when we create in-app items.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pushBusy}
            onClick={enablePush}
            className="futuristic-button-yellow px-4 py-2 disabled:opacity-50"
          >
            {pushBusy ? "Working…" : "Turn on push"}
          </button>
          <button
            type="button"
            disabled={pushBusy}
            onClick={disablePush}
            className="futuristic-button px-4 py-2 disabled:opacity-50"
          >
            Turn off push
          </button>
        </div>
        <div className="space-y-2 pt-2 border-t border-white/10">
          <span className="block text-white font-semibold text-sm">Categories</span>
          <p className="text-white/50 text-xs">
            Choose which kinds of updates may <strong className="text-white/70">send push</strong> to this
            device and which appear in your <strong className="text-white/70">in-app Notifications</strong>{" "}
            list. Friend requests still use a one-hour limit per sender.
          </p>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={pushFriends}
              onChange={(e) => setPushFriends(e.target.checked)}
            />
            Friend requests
          </label>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={pushCatchup}
              onChange={(e) => setPushCatchup(e.target.checked)}
            />
            Weekly catch-up <span className="text-white/50 text-xs">
            (shows you&apos;re behind on episodes)
            </span>
          </label>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={pushReleases}
              onChange={(e) => setPushReleases(e.target.checked)}
            />
            Releases &amp; guide <span className="text-white/50 text-xs">(premieres, new episodes on the calendar, TMDB guide updates)</span>
          </label>
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
