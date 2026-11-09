import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { captureInviteFromUrl } from "@/lib/referrals";

captureInviteFromUrl();

if (
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  /^https?:$/.test(window.location.protocol)
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* install stays optional */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
