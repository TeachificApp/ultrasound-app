/**
 * LessonEffectPlayer
 * Renders the learner-facing lesson effect: banner overlay, sound, and confetti cannon.
 * Mount this component inside CoursePlayer and pass the current lesson's effect data.
 *
 * Bugs fixed:
 * - Canvas was conditionally rendered so canvasRef.current was null when fire() ran → always render canvas
 * - Confetti ran on hidden canvas before state update → use imperative canvas ref, never hide it
 * - firedRef prevented re-fire when effect data arrived late (async getLesson) → track readiness properly
 * - Banner duration is now configurable via effectBannerDuration (seconds, default 5)
 * - Sound autoplay: for lesson_start (no user gesture), we attempt play and silently ignore block
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { X } from "lucide-react";

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
  const count = Math.min(250, Math.floor((canvas.width * canvas.height) / 3500));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 5,
      vy: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 9,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1,
    });
  }
  return particles;
}

function createCannonParticles(canvas: HTMLCanvasElement, colors: string[]): Particle[] {
  const particles: Particle[] = [];
  const count = 180;
  // Left cannon (bottom-left corner)
  for (let i = 0; i < count / 2; i++) {
    const angle = -Math.PI / 4 + (Math.random() - 0.5) * (Math.PI / 3); // ~-45deg ± 30deg
    const speed = 8 + Math.random() * 12;
    particles.push({
      x: 0,
      y: canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 7 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1,
    });
  }
  // Right cannon (bottom-right corner)
  for (let i = 0; i < count / 2; i++) {
    const angle = -Math.PI * 3 / 4 + (Math.random() - 0.5) * (Math.PI / 3); // ~-135deg ± 30deg
    const speed = 8 + Math.random() * 12;
    particles.push({
      x: canvas.width,
      y: canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 7 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1,
    });
  }
  return particles;
}

function runConfetti(canvas: HTMLCanvasElement, colors: string[], onDone: () => void, mode: "fall" | "cannon" = "fall") {
  const ctx = canvas.getContext("2d");
  if (!ctx) { onDone(); return; }
  const particles = mode === "cannon" ? createCannonParticles(canvas, colors) : createParticles(canvas, colors);
  let frame = 0;
  const maxFrames = 200;
  let rafId: number;

  function tick() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07; // gravity
      p.rotation += p.rotationSpeed;
      if (frame > maxFrames - 60) p.alpha = Math.max(0, p.alpha - 0.018);
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
      rafId = requestAnimationFrame(tick);
    } else {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      onDone();
    }
  }
  rafId = requestAnimationFrame(tick);
  // Return cancel function
  return () => { cancelAnimationFrame(rafId); ctx.clearRect(0, 0, canvas.width, canvas.height); };
}

// ─── Default colors ────────────────────────────────────────────────────────────
const DEFAULT_COLORS = ["#ff0000","#ff7700","#ffff00","#00cc00","#0000ff","#8b00ff","#ff69b4"];

function parseColors(colorsStr: string | null | undefined): string[] {
  if (!colorsStr) return DEFAULT_COLORS;
  const parsed = colorsStr.split(",").map(c => c.trim()).filter(c => /^#[0-9a-fA-F]{3,6}$/.test(c));
  return parsed.length > 0 ? parsed : DEFAULT_COLORS;
}

// ─── Sound presets (must match LessonEffectEditor.tsx) ───────────────────────
const SOUND_PRESET_URLS: Record<string, string> = {
  applause: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
  cheer: "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3",
  ding: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
  fanfare: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
  success: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
  levelup: "https://assets.mixkit.co/active_storage/sfx/1997/1997-preview.mp3",
  notification: "https://assets.mixkit.co/active_storage/sfx/2355/2355-preview.mp3",
};

// ─── Sound player ──────────────────────────────────────────────────────────────
function playSound(url: string) {
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.65;
    // Browsers may block autoplay without a user gesture — we catch and ignore silently
    const promise = audio.play();
    if (promise) promise.catch(() => {});
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  effectConfettiMode?: string | null;
  effectBannerDuration?: number | null;
}

interface LessonEffectPlayerProps {
  effect: LessonEffect | null | undefined;
  trigger: "lesson_start" | "lesson_complete";
  /** Optional learner name — replaces {{name}} merge tag in banner text */
  userName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LessonEffectPlayer({ effect, trigger, userName }: LessonEffectPlayerProps) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  // Always render the canvas so canvasRef.current is always available
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Track whether we've already fired for this lesson+trigger combination
  const firedRef = useRef(false);
  // Track the effect identity so we can re-fire if the lesson changes
  const effectIdRef = useRef<string>("");
  const cancelConfettiRef = useRef<(() => void) | undefined>(undefined);

  const fire = useCallback(() => {
    if (!effect?.effectEnabled) return;
    if (effect.effectTrigger !== trigger) return;

    // Play sound — resolve preset URL if effectSoundUrl is not explicitly stored
    const soundUrl = effect.effectSoundUrl
      || (effect.effectSound && effect.effectSound !== "none" && effect.effectSound !== "custom"
          ? SOUND_PRESET_URLS[effect.effectSound] ?? ""
          : "");
    if (soundUrl) playSound(soundUrl);

    // Show banner
    if (effect.effectBannerText) {
      setBannerVisible(true);
      const duration = (effect.effectBannerDuration ?? 5) * 1000;
      setTimeout(() => setBannerVisible(false), duration);
    }

    // Fire confetti — always use the canvas ref directly (it's always mounted)
    if (effect.effectConfetti) {
      const canvas = canvasRef.current;
      if (canvas) {
        // Cancel any previous confetti run
        cancelConfettiRef.current?.();
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        setConfettiActive(true);
        const colors = parseColors(effect.effectConfettiColors);
        const confettiMode = (effect.effectConfettiMode === "cannon" ? "cannon" : "fall") as "fall" | "cannon";
        const cancel = runConfetti(canvas, colors, () => {
          setConfettiActive(false);
          cancelConfettiRef.current = undefined;
        }, confettiMode);
        cancelConfettiRef.current = cancel;
      }
    }
  }, [effect, trigger]);

  // Auto-fire on mount for lesson_start; also re-fire if the lesson changes
  useEffect(() => {
    const effectKey = `${effect?.effectEnabled}-${effect?.effectTrigger}-${trigger}`;
    if (firedRef.current && effectIdRef.current === effectKey) return;
    firedRef.current = true;
    effectIdRef.current = effectKey;

    // Only auto-fire for lesson_start on mount; lesson_complete is fired via event
    if (trigger !== "lesson_start") return;

    const t = setTimeout(fire, 500);
    return () => clearTimeout(t);
  }, [fire, effect, trigger]);

  // Listen for lesson_complete event dispatched by CoursePlayer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trigger: string };
      if (detail?.trigger === trigger) fire();
    };
    window.addEventListener("lesson-effect-fire", handler);
    return () => window.removeEventListener("lesson-effect-fire", handler);
  }, [fire, trigger]);

  // Cleanup confetti on unmount
  useEffect(() => {
    return () => {
      cancelConfettiRef.current?.();
    };
  }, []);

  const isActive = effect?.effectEnabled && effect?.effectTrigger === trigger;

  return (
    <>
      {/* Confetti canvas — always in DOM so canvasRef.current is always available.
          Visible only when confetti is active; pointer-events none so it doesn't block clicks. */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 9999,
          width: "100vw",
          height: "100vh",
          display: confettiActive ? "block" : "none",
        }}
      />

      {/* Banner — only render when active and visible */}
      {isActive && bannerVisible && effect?.effectBannerText && (
        <div
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-between px-6 py-4 shadow-lg animate-in slide-in-from-top duration-300"
          style={{
            backgroundColor: effect.effectBannerBgColor ?? "#179ca3",
            color: effect.effectBannerTextColor ?? "#ffffff",
          }}
        >
          <p className="text-base font-semibold flex-1 text-center">
            {effect.effectBannerText?.replace(/\{\{name\}\}/gi, userName?.split(" ")[0] ?? "there")}
          </p>
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
 * Call this after marking a lesson as complete (it IS a user gesture, so sound will play).
 */
export function fireLessonCompleteEffect() {
  window.dispatchEvent(new CustomEvent("lesson-effect-fire", { detail: { trigger: "lesson_complete" } }));
}
