import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logCrash } from "@/lib/diagnostics/crashLogger";

if (typeof window !== "undefined") {
  // Réduit les mutations DOM faites par Chrome/Google Translate qui
  // provoquent des crashes "insertBefore/removeChild" sur React.
  try {
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    const meta = document.createElement("meta");
    meta.name = "google";
    meta.content = "notranslate";
    document.head.appendChild(meta);
  } catch {
    /* noop */
  }

  window.addEventListener("error", (e) => {
    logCrash({ source: "window.error", error: e.error ?? e.message });
  });
  window.addEventListener("unhandledrejection", (e) => {
    logCrash({ source: "unhandledrejection", error: e.reason });
  });

  // Détection Google Translate : il ajoute "translated-ltr" / "translated-rtl" sur <html>.
  try {
    const obs = new MutationObserver(() => {
      const cls = document.documentElement.className;
      if (cls.includes("translated-ltr") || cls.includes("translated-rtl")) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Tontine Diag] translate-detected — Chrome/Google Translate mute le DOM. " +
            "Cela peut causer des erreurs insertBefore/removeChild. htmlClass=" +
            cls,
        );
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  } catch {
    /* noop */
  }
}

createRoot(document.getElementById("root")!).render(<App />);
