"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/AuthContext";
import { Settings, Check } from "lucide-react";
import {
  notificationTypeLabel,
  formatNotificationDate,
} from "../../utils/notificationDisplay";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
      const data = res.ok ? await res.json() : { notifications: [] };
      setItems(data.notifications || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notificationId: id, read: true }),
    });
    load();
  };

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  };

  if (authLoading) {
    return <p className="text-white/70">Loading…</p>;
  }
  if (!user) {
    return (
      <div className="futuristic-card p-8 text-center text-white">
        Sign in to see notifications.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-amber-500">Notifications</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/profile/settings/notifications"
            className="futuristic-button flex items-center gap-2 text-sm"
          >
            <Settings className="w-4 h-4" />
            Notification settings
          </Link>
          {items.some((n) => !n.read) && (
            <button
              type="button"
              onClick={markAll}
              className="futuristic-button-yellow flex items-center gap-2 text-sm px-4 py-2"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-white/70">Loading notifications…</p>
      ) : items.length === 0 ? (
        <div className="futuristic-card p-8 text-center text-white/80">
          Nothing here yet. When we have release reminders or episode updates for shows you follow,
          they will show up here.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`futuristic-card p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 ${
                !n.read ? "border-amber-500/40" : ""
              }`}
            >
              <div>
                <p className="font-semibold text-white">{n.title}</p>
                <p className="text-white/80 text-sm mt-1">{n.message}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {n.type ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-charcoal-800 text-amber-500/90 border border-amber-500/25">
                      {notificationTypeLabel(n.type)}
                    </span>
                  ) : null}
                  {n.created_at ? (
                    <span className="text-xs text-white/50">
                      {formatNotificationDate(n.created_at)}
                    </span>
                  ) : null}
                </div>
                {n.link && (
                  <Link
                    href={n.link}
                    className="text-amber-500 text-sm mt-2 inline-block hover:underline"
                  >
                    Open
                  </Link>
                )}
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="futuristic-button text-sm self-start"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
