"use client";

import type { Recurring } from "@/lib/types";

const key = (uid: number) => `moneta_notify_${uid}`;
const stampKey = (uid: number) => `moneta_notify_day_${uid}`;

export function isNotifyEnabled(uid: number): boolean {
  try {
    return localStorage.getItem(key(uid)) === "1";
  } catch {
    return false;
  }
}

export function setNotifyEnabled(uid: number, on: boolean) {
  try {
    localStorage.setItem(key(uid), on ? "1" : "0");
  } catch {}
}

export function notifyPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function enableNotifications(uid: number): Promise<boolean> {
  if (!("Notification" in window)) return false;
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = Notification.permission;
    }
  }
  const ok = perm === "granted";
  setNotifyEnabled(uid, ok);
  return ok;
}

export function sendNotification(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    new Notification(title, { body, tag: "moneta" });
    return true;
  } catch {
    return false;
  }
}

/** Fire one bill reminder per day when enabled and something is due soon. */
export function maybeBillReminder(
  uid: number,
  recurring: Recurring[],
  fmt: (v: number) => string,
  daysInMonth: (key: string) => number,
  monthKey: string,
) {
  try {
    if (!isNotifyEnabled(uid)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(stampKey(uid)) === today) return;
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const due = recurring
      .filter((r) => r.active)
      .map((r) => {
        let d = new Date(t.getFullYear(), t.getMonth(), Math.min(r.dayOfMonth, daysInMonth(monthKey)));
        if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(r.dayOfMonth, 28));
        return { r, days: Math.round((d.getTime() - t.getTime()) / 86400000) };
      })
      .filter((b) => b.days <= 3)
      .sort((a, b) => a.days - b.days);
    if (!due.length) return;
    const first = due[0];
    const when = first.days === 0 ? "today" : first.days === 1 ? "tomorrow" : `in ${first.days} days`;
    const extra = due.length > 1 ? ` +${due.length - 1} more` : "";
    if (sendNotification(`${first.r.name} due ${when}`, `${fmt(first.r.amount)}${extra} — open Moneta to stay on track.`)) {
      localStorage.setItem(stampKey(uid), today);
    }
  } catch {}
}
