import { del, get, set } from "idb-keyval";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

const KEY = "td-offline-cache";

export const offlinePersister = createAsyncStoragePersister({
  key: KEY,
  storage: { getItem: get, setItem: set, removeItem: del },
  throttleTime: 2000,
});

export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Seules les données de consultation sont gardées pour le hors ligne. */
const ALLOWED = /group|turn|contribution|receipt|recu|balance|solde|wallet|message|chat|ledger|my-|dashboard|notification/i;

export function shouldPersistQuery(q: Query): boolean {
  if (q.state.status !== "success") return false;
  const root = String(q.queryKey[0] ?? "");
  if (root === "assistant" || root === "entitlements") return false;
  return ALLOWED.test(root);
}

export async function clearOfflineCache() {
  await del(KEY).catch(() => {});
}
