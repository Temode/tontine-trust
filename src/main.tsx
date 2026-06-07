import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", e.message, e.error?.stack ?? e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError] unhandledrejection", e.reason);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
