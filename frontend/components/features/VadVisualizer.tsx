'use client';

import { useVadVisualizer, BAR_COUNT } from '@/hooks/useVadVisualizer';

interface Props {
  animating: boolean;
  speaking: boolean;
  label: string;
}

export default function VadVisualizer({ animating, speaking, label }: Props) {
  const containerRef = useVadVisualizer(animating, speaking);

  return (
    <div className="vad-section">
      <div
        ref={containerRef}
        className="vad-bar"
        aria-hidden="true"
        aria-label="Voice activity visualizer"
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div key={i} className="vad-bar-item" style={{ height: '4px' }} />
        ))}
      </div>
      <span className="vad-label">{label}</span>
    </div>
  );
}
