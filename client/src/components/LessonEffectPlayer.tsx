/**
 * LessonEffectPlayer
 * Renders the learner-facing lesson effect: banner overlay, sound, and confetti cannon.
 * Mount this component inside CoursePlayer and pass the current lesson's effect data.
 * Call `fire()` to trigger the effect manually (e.g., on lesson start or lesson complete).
 */
import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useState } from "react";

// ─── Confetti engine (canvas-based, no external deps) ─────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
  alpha: number;
}

function createParticles(canvas: HTMLCanvasElement, colors: string[]): Particle[] {
  const particles: Particle[] = [];
  const count = Math.min(220, Math.floor((canvas.width * canvas.height) / 4000));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1,
    });
  }
  return particles;
}

function runConfetti(canvas: HTMLCanvasElement, colors: string[], onDone: () => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const particles = createParticles(canvas, colors);
  let frame = 0;
  const maxFrames = 180;

  function tick() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.rotation += p.rotationSpeed;
      if (frame > maxFrames - 60) p.alpha = Math.max(0, p.alpha - 0.02);
      if (p.y < canvas.height + 20 && p.alpha > 0) alive = true;

      ctx!.save();
      ctx!.globalAlpha = p.alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotation);
      ctx!.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }
    frame++;
    if (alive && frame < maxFrames + 60) {
      requestAnimationFrame(tick);
    } else {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      onDone();
    }
  }
  requestAnimationFrame(tick);
}

// ─── Default colors ────────────────────────────────────────────────────────────
const DEFAULT_COLORS = ["#ff0000","#ff7700","#ffff00","#00cc00","#0000ff","#8b00ff","#ff69b4"];

function parseColors(colorsStr: string | null | undefined): string[] {
  if (!colorsStr) return DEFAULT_COLORS;
  const parsed = colorsStr.split(",").map(c => c.trim()).filter(c => /^#[0-9a-fA-F]{3,6}$/.test(c));
  return parsed.length > 0 ? parsed : DEFAULT_COLORS;
}

// ─── Sound player ──────────────────────────────────────────────────────────────
function playSound(url: string) {
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface LessonEffect {
  effectEnabled?: boolean | null;
  effectTrigger?: string | null;
  effectBannerText?: string | null;
  effectBannerBgColor?: string | null;
  effectBannerTextColor?: string | null;
  effectSound?: string | null;
  effectSoundUrl?: string | null;
  effectConfetti?: boolean | null;
  effectConfettiColors?: string | null;
}

interface LessonEffectPlayerProps {
  effect: LessonEffect | null | undefined;
  trigger: "lesson_start" | "lesson_complete";
}

export default function LessonEffectPlayer({ effect, trigger }: LessonEffectPlayerProps) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firedRef = useRef(false);

  const fire = useCallback(() => {
    if (!effect?.effectEnabled) return;
    if (effect.effectTrigger !== trigger) return;

    // Play sound
    const soundUrl = effect.effectSoundUrl ?? "";
    if (soundUrl) playSound(soundUrl);

    // Show banner
    if (effect.effectBannerText) {
      setBannerVisible(true);
      setTimeout(() => setBannerVisible(false), 5000);
    }

    // Fire confetti
    if (effect.effectConfetti && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      setConfettiActive(true);
      const colors = parseColors(effect.effectConfettiColors);
      runConfetti(canvas, colors, () => setConfettiActive(false));
    }
  }, [effect, trigger]);

  // Auto-fire when mounted (trigger === lesson_start fires on mount)
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    // Small delay to let the player render first
    const t = setTimeout(fire, 400);
    return () => clearTimeout(t);
  }, [fire]);

  // Expose fire function via a custom event so CoursePlayer can call it on lesson_complete
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trigger: string };
      if (detail?.trigger === trigger) fire();
    };
    window.addEventListener("lesson-effect-fire", handler);
    return () => window.removeEventListener("lesson-effect-fire", handler);
  }, [fire, trigger]);

  if (!effect?.effectEnabled) return null;
  if (effect.effectTrigger !== trigger) return null;

  return (
    <>
      {/* Confetti canvas — full-screen overlay, pointer-events none */}
      {confettiActive && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ width: "100vw", height: "100vh" }}
        />
      )}
      {!confettiActive && <canvas ref={canvasRef} className="hidden" />}

      {/* Banner */}
      {bannerVisible && effect.effectBannerText && (
        <div
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-between px-6 py-4 shadow-lg animate-in slide-in-from-top duration-300"
          style={{
            backgroundColor: effect.effectBannerBgColor ?? "#179ca3",
            color: effect.effectBannerTextColor ?? "#ffffff",
          }}
        >
          <p className="text-base font-semibold flex-1 text-center">{effect.effectBannerText}</p>
          <button
            onClick={() => setBannerVisible(false)}
            className="ml-4 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Helper to fire the lesson_complete effect from anywhere in CoursePlayer.
 * Call this after marking a lesson as complete.
 */
export function fireLessonCompleteEffect() {
  window.dispatchEvent(new CustomEvent("lesson-effect-fire", { detail: { trigger: "lesson_complete" } }));
}
