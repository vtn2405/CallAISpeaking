import { useEffect, useRef } from 'react';

const BAR_COUNT = 18;

/**
 * useVadVisualizer — drives the bar heights using requestAnimationFrame.
 * animating: true while listening or AI is speaking.
 * speaking: true specifically while the user mic is hot (red bars vs. blue).
 *
 * Cleanup: cancels the rAF and empties heights on unmount, preventing
 * the memory leak that existed in the original setInterval-based approach.
 */
export function useVadVisualizer(animating: boolean, speaking: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bars = Array.from(container.querySelectorAll<HTMLElement>('.vad-bar-item'));

    if (!animating) {
      bars.forEach((b) => {
        b.style.height = '4px';
        b.classList.remove('active', 'speaking');
      });
      return;
    }

    const tick = () => {
      bars.forEach((bar) => {
        const h = speaking
          ? 6 + Math.random() * 30
          : 4 + Math.random() * 10;
        bar.style.height = `${h}px`;
        bar.classList.toggle('speaking', speaking);
        bar.classList.toggle('active', !speaking);
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      bars.forEach((b) => {
        b.style.height = '4px';
        b.classList.remove('active', 'speaking');
      });
    };
  }, [animating, speaking]);

  return containerRef;
}

export { BAR_COUNT };
