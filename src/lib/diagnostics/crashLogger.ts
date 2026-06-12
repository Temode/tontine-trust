/**
 * Journalisation centralisée des crashs Tontine.
 * Tout passe ici : ErrorBoundary, window.error, unhandledrejection, react-query.
 */

export type CrashSource =
  | "ErrorBoundary"
  | "window.error"
  | "unhandledrejection"
  | "react-query"
  | "manual";

interface AuthSnapshot {
  userId: string | null;
  roles: string[];
}

let authSnapshot: AuthSnapshot = { userId: null, roles: [] };
let crashCounter = 0;

export function setAuthSnapshot(snap: AuthSnapshot) {
  authSnapshot = snap;
}

export interface CrashReport {
  index: number;
  timestamp: string;
  source: CrashSource;
  route: string;
  user: string;
  roles: string[];
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  lang: string;
  htmlClass: string;
  extra?: Record<string, unknown>;
  likelyCause?: string;
}

function detectLikelyCause(message: string): string | undefined {
  const m = (message || "").toLowerCase();
  if (
    (m.includes("insertbefore") || m.includes("removechild")) &&
    m.includes("not a child")
  ) {
    return "DOM externe (Google Translate / extension Chrome qui mute le DOM)";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Réseau / API indisponible";
  }
  if (m.includes("refresh token")) {
    return "Session Supabase expirée";
  }
  return undefined;
}

export function logCrash(input: {
  source: CrashSource;
  error: unknown;
  componentStack?: string;
  extra?: Record<string, unknown>;
}): CrashReport {
  crashCounter += 1;
  const err = input.error;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  const report: CrashReport = {
    index: crashCounter,
    timestamp: new Date().toISOString(),
    source: input.source,
    route:
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "(ssr)",
    user: authSnapshot.userId ?? "anon",
    roles: authSnapshot.roles,
    message,
    stack,
    componentStack: input.componentStack,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    lang:
      typeof document !== "undefined" ? document.documentElement.lang || "" : "",
    htmlClass:
      typeof document !== "undefined" ? document.documentElement.className : "",
    extra: input.extra,
    likelyCause: detectLikelyCause(message),
  };

  if (typeof window !== "undefined") {
    const w = window as unknown as { __tontineCrashes?: CrashReport[] };
    if (!w.__tontineCrashes) w.__tontineCrashes = [];
    w.__tontineCrashes.push(report);
    if (w.__tontineCrashes.length > 20) w.__tontineCrashes.shift();
  }

  // eslint-disable-next-line no-console
  console.error(
    `[Tontine Crash #${report.index}] ${report.timestamp}\n` +
      `  source        : ${report.source}\n` +
      `  route         : ${report.route}\n` +
      `  user          : ${report.user}  roles: [${report.roles.join(", ")}]\n` +
      `  message       : ${report.message}\n` +
      (report.likelyCause ? `  likelyCause   : ${report.likelyCause}\n` : "") +
      `  htmlClass     : ${report.htmlClass}\n` +
      `  lang          : ${report.lang}\n` +
      (report.componentStack
        ? `  componentStack:${report.componentStack}\n`
        : "") +
      (report.stack ? `  stack         :\n${report.stack}\n` : "") +
      (report.extra ? `  extra         : ${JSON.stringify(report.extra)}\n` : ""),
  );

  return report;
}

export function getLastCrash(): CrashReport | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __tontineCrashes?: CrashReport[] };
  const list = w.__tontineCrashes;
  return list && list.length ? list[list.length - 1] : null;
}

export function formatCrashForClipboard(report: CrashReport): string {
  return [
    `Tontine Crash #${report.index} — ${report.timestamp}`,
    `route: ${report.route}`,
    `user : ${report.user}  roles: [${report.roles.join(", ")}]`,
    `source: ${report.source}`,
    report.likelyCause ? `likelyCause: ${report.likelyCause}` : "",
    `message: ${report.message}`,
    report.componentStack ? `componentStack:${report.componentStack}` : "",
    report.stack ? `stack:\n${report.stack}` : "",
    `userAgent: ${report.userAgent}`,
    `htmlClass: ${report.htmlClass}`,
    report.extra ? `extra: ${JSON.stringify(report.extra)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}