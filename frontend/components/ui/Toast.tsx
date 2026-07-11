'use client';

import { useEffect, useCallback, useRef } from 'react';

type ToastType = '' | 'error' | 'success';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

// Singleton toast — exposed via a global event bus so it can be
// triggered from anywhere without prop-drilling.
const TOAST_EVENT = 'asc:toast';

export function showToast(
  message: string,
  { type = '', duration = 2800 }: ToastOptions = {}
) {
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, { detail: { message, type, duration } })
  );
}

export default function Toast() {
  const toastRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    toastRef.current?.classList.remove('show');
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type, duration } = (e as CustomEvent).detail as {
        message: string;
        type: ToastType;
        duration: number;
      };
      const el = toastRef.current;
      if (!el) return;

      el.textContent = message;
      el.className = `toast${type ? ` ${type}` : ''}`;
      // Force reflow so animation re-triggers
      void el.offsetWidth;
      el.classList.add('show');

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(hide, duration);
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => {
      window.removeEventListener(TOAST_EVENT, handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hide]);

  return (
    <div
      ref={toastRef}
      className="toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    />
  );
}
