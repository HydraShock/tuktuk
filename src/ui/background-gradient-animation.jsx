import React from 'react';
import './background-gradient-animation.css';

const autonomousParticles = [
  { top: '12%', left: '8%', size: '180px', driftX: '76px', driftY: '46px', driftX2: '-58px', driftY2: '68px', duration: '16s', delay: '-6s', opacity: 0.62 },
  { top: '8%', left: '66%', size: '200px', driftX: '-82px', driftY: '50px', driftX2: '62px', driftY2: '-70px', duration: '18s', delay: '-12s', opacity: 0.56 },
  { top: '34%', left: '40%', size: '160px', driftX: '66px', driftY: '-58px', driftX2: '-70px', driftY2: '62px', duration: '15s', delay: '-9s', opacity: 0.64 },
  { top: '58%', left: '14%', size: '190px', driftX: '72px', driftY: '-40px', driftX2: '-58px', driftY2: '-64px', duration: '17s', delay: '-4s', opacity: 0.55 },
  { top: '64%', left: '56%', size: '190px', driftX: '-70px', driftY: '-42px', driftX2: '76px', driftY2: '58px', duration: '19s', delay: '-15s', opacity: 0.58 },
  { top: '72%', left: '82%', size: '170px', driftX: '-64px', driftY: '-56px', driftX2: '54px', driftY2: '62px', duration: '17s', delay: '-3s', opacity: 0.52 },
  { top: '45%', left: '78%', size: '140px', driftX: '-44px', driftY: '36px', driftX2: '42px', driftY2: '-44px', duration: '14s', delay: '-7s', opacity: 0.48 },
  { top: '26%', left: '22%', size: '130px', driftX: '40px', driftY: '-34px', driftX2: '-38px', driftY2: '30px', duration: '13s', delay: '-2s', opacity: 0.46 },
];

export function BackgroundGradientAnimation({ children, className = '' }) {
  return (
    <div
      className={`bg-grad-anim ${className}`.trim()}
      onMouseMove={(event) => {
        const el = event.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        el.style.setProperty('--mouse-x', `${x}px`);
        el.style.setProperty('--mouse-y', `${y}px`);
        el.style.setProperty('--pointer-alpha', '1');
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.setProperty('--pointer-alpha', '0.76');
      }}
    >
      <div className="bg-grad-layer bg-grad-base" />
      <div className="bg-grad-layer bg-grad-first" />
      <div className="bg-grad-layer bg-grad-second" />
      <div className="bg-grad-layer bg-grad-third" />
      <div className="bg-grad-layer bg-grad-fourth" />
      <div className="bg-grad-layer bg-grad-fifth" />
      <div className="bg-grad-layer bg-grad-core" aria-hidden="true" />
      <div className="bg-grad-layer bg-grad-pointer" aria-hidden="true" />
      <div className="bg-grad-layer bg-grad-particles" aria-hidden="true">
        {autonomousParticles.map((particle, index) => (
          <span
            key={`particle-${index + 1}`}
            className="bg-grad-particle"
            style={{
              '--particle-top': particle.top,
              '--particle-left': particle.left,
              '--particle-size': particle.size,
              '--particle-drift-x': particle.driftX,
              '--particle-drift-y': particle.driftY,
              '--particle-drift-x-2': particle.driftX2,
              '--particle-drift-y-2': particle.driftY2,
              '--particle-duration': particle.duration,
              '--particle-delay': particle.delay,
              '--particle-opacity': particle.opacity,
            }}
          />
        ))}
      </div>
      <div className="bg-grad-content">{children}</div>
    </div>
  );
}
