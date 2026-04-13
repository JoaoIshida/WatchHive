"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

function bumpPendingInvites() {
  window.dispatchEvent(new CustomEvent("refreshPendingInvites"));
}

function bumpNotifications() {
  window.dispatchEvent(new CustomEvent("refreshNotifications"));
}

/**
 * Subscribes to `friends` and `notifications` for live profile UI (requires Supabase Auth session).
 */
export function useSupabaseProfileRealtime(userId) {
  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`profile-realtime:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `friend_id=eq.${userId}`,
        },
        bumpPendingInvites,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `user_id=eq.${userId}`,
        },
        bumpPendingInvites,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        bumpNotifications,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        bumpNotifications,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
