'use client';

import { memo } from 'react';

type Particle = {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
};

// Evenly distributed via golden-ratio offsets — avoids clustering bugs from modulo patterns.
const PARTICLES: Particle[] = Array.from({ length: 18 }, (_, index) => {
  const golden = 0.618033988749895;
  return {
    x: ((index * golden * 100) % 96) + 2,
    y: ((index * golden * 157) % 92) + 4,
    size: index % 4 === 0 ? 3 : 2,
    delay: (index * 0.41) % 3.8,
    duration: 3.4 + (index % 5) * 0.55,
  };
});

function GlitterField() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden" aria-hidden>
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="qc-glitter-particle absolute rounded-full bg-primary/50"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default memo(GlitterField);
