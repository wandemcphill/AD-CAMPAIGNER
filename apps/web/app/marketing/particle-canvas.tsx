"use client";

import { useEffect, useRef } from "react";

type Particle = {
  hue: number;
  phase: number;
  route: number;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type ParticleCanvasProps = {
  pulseKey: number;
  reducedMotion: boolean;
};

function createParticle(width: number, height: number, index: number): Particle {
  const route = (index / 96) * Math.PI * 2;

  return {
    hue: [32, 244, 156, 12][index % 4] ?? 32,
    phase: Math.random() * Math.PI * 2,
    route,
    size: 0.7 + Math.random() * 1.9,
    vx: 0,
    vy: 0,
    x: Math.random() * width,
    y: Math.random() * height
  };
}

export function ParticleCanvas({ pulseKey, reducedMotion }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    pulseRef.current = 1;
  }, [pulseKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    let animationFrame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const pointer = { active: false, x: 0, y: 0 };
    const reducedByMedia = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedByMedia) {
      return undefined;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: width < 720 ? 90 : 170 }, (_, index) =>
        createParticle(width, height, index)
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.active = true;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });

    // The field is deterministic: particles orbit campaign routes, then converge during command assembly.
    const draw = () => {
      if (visible) {
        context.clearRect(0, 0, width, height);
        context.globalCompositeOperation = "lighter";

        const pulse = pulseRef.current;
        pulseRef.current = Math.max(0, pulse - 0.012);

        for (const particle of particles) {
          particle.phase += 0.008 + particle.size * 0.001;
          const routeRadiusX = width * (0.23 + (particle.route % 0.4));
          const routeRadiusY = height * 0.16;
          const orbitX = width * 0.5 + Math.cos(particle.route + particle.phase * 0.25) * routeRadiusX;
          const orbitY = height * 0.48 + Math.sin(particle.route * 1.4 + particle.phase) * routeRadiusY;
          const assembleX = width * 0.5 + Math.cos(particle.route * 3) * width * 0.055;
          const assembleY = height * 0.42 + Math.sin(particle.route * 2) * height * 0.055;
          const targetX = orbitX * (1 - pulse) + assembleX * pulse;
          const targetY = orbitY * (1 - pulse) + assembleY * pulse;

          particle.vx += (targetX - particle.x) * 0.0038;
          particle.vy += (targetY - particle.y) * 0.0038;

          if (pointer.active) {
            const dx = pointer.x - particle.x;
            const dy = pointer.y - particle.y;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < 190) {
              const pull = (1 - distance / 190) * 0.038;
              particle.vx += dx * pull * 0.02;
              particle.vy += dy * pull * 0.02;
            }
          }

          particle.vx *= 0.93;
          particle.vy *= 0.93;
          particle.x += particle.vx;
          particle.y += particle.vy;

          const alpha = 0.22 + pulse * 0.45;
          context.beginPath();
          context.fillStyle = `hsla(${particle.hue}, 94%, 62%, ${alpha})`;
          context.arc(particle.x, particle.y, particle.size + pulse * 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    observer.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      observer.disconnect();
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,138,0,0.16),transparent_34%),radial-gradient(circle_at_70%_54%,rgba(94,92,230,0.14),transparent_30%)]"
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />;
}
