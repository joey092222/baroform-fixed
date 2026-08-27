"use client";

import { useEffect } from "react";

type StandaloneNavigator = Navigator & { standalone?: boolean };

export function PwaRegister() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as StandaloneNavigator).standalone === true;

    if (standalone) {
      document.documentElement.dataset.displayMode = "standalone";
    }

    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);

  return null;
}
