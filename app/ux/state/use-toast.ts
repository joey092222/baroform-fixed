"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const toastDurations = {
  short: 1800,
  normal: 2200,
  long: 2600,
  error: 5200,
} as const;

export type ToastDuration = keyof typeof toastDurations;

/** One transient status line. The UI decides where and how it appears. */
export function useToast() {
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const show = useCallback(
    (nextMessage: string, duration: ToastDuration | number = "normal") => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setMessage(nextMessage);
      const ms =
        typeof duration === "number" ? duration : toastDurations[duration];
      timerRef.current = window.setTimeout(() => setMessage(""), ms);
    },
    [],
  );

  const clear = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setMessage("");
  }, []);

  return { message, show, clear };
}

export type ToastController = ReturnType<typeof useToast>;
