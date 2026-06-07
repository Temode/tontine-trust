import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined") {
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
