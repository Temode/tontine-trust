import { useEffect, useState } from "react";

/**
 * Détecte un nouveau déploiement en comparant le HTML servi par /
 * (Vite injecte un hash dans le nom du bundle JS principal).
 * Si le hash change, l'utilisateur est invité à recharger.
 */
async function fetchBundleHash(): Promise<string | null> {
  try {
    const res = await fetch("/", {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Vite genere <script type="module" src="/assets/index-XXXX.js"></script>
    const m = html.match(/\/assets\/index-[\w-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export function useAppVersion(): {
  outdated: boolean;
  initialHash: string | null;
  latestHash: string | null;
  refresh: () => void;
} {
  const [initialHash, setInitialHash] = useState<string | null>(null);
  const [latestHash, setLatestHash] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const check = async () => {
      const hash = await fetchBundleHash();
      if (cancelled || !hash) return;
      setLatestHash(hash);
      setInitialHash((prev) => {
        if (!prev) return hash;
        if (prev !== hash) setOutdated(true);
        return prev;
      });
    };

    void check();
    timer = window.setInterval(check, 5 * 60 * 1000); // toutes les 5 min
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return {
    outdated,
    initialHash,
    latestHash,
    refresh: () => window.location.reload(),
  };
}