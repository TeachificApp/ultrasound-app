export type AiMusicMood = "calm" | "focused" | "uplifting" | "confident" | "cinematic" | "energetic";
export type AiMusicTexture = "ambient" | "lofi" | "electronic" | "minimal" | "pulse" | "rnb" | "rap" | "hiphop" | "pop" | "upbeat" | "rock";

export type AiLoopPlan = {
  title: string;
  bpm: number;
  keyRoot: number;
  scale: "major" | "minor" | "dorian";
  mood: AiMusicMood;
  texture: AiMusicTexture;
  density: 1 | 2 | 3 | 4 | 5;
  swing: number;
  kickPattern: number[];
  snarePattern: number[];
  hatPattern: number[];
  bassPattern: number[];
  leadPattern: number[];
};

const SAMPLE_RATE = 44_100;
const LOOP_SECONDS = 20;
const SEMITONE = 2 ** (1 / 12);

function frequencyForMidi(midi: number) {
  return 440 * SEMITONE ** (midi - 69);
}

function createNoiseBuffer(context: OfflineAudioContext, seconds: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const values = buffer.getChannelData(0);
  // A very short filter-friendly noise source for hats and snares. It is not
  // stored independently; it becomes part of the final original WAV render.
  for (let index = 0; index < values.length; index += 1) values[index] = Math.random() * 2 - 1;
  return buffer;
}

function addKick(context: OfflineAudioContext, destination: AudioNode, at: number, intensity: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(145, at);
  oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.15);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.32 * intensity, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  oscillator.connect(gain).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + 0.2);
}

function addNoiseHit(
  context: OfflineAudioContext,
  destination: AudioNode,
  noise: AudioBuffer,
  at: number,
  duration: number,
  frequency: number,
  level: number,
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noise;
  filter.type = "highpass";
  filter.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(at);
  source.stop(at + duration + 0.015);
}

function addNote(
  context: OfflineAudioContext,
  destination: AudioNode,
  at: number,
  duration: number,
  frequency: number,
  type: OscillatorType,
  level: number,
  cutoff: number,
) {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, at);
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + Math.min(0.025, duration * 0.18));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, duration * 0.94));
  oscillator.connect(filter).connect(gain).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

function scaleOffset(scale: AiLoopPlan["scale"], scaleDegreeOffset: number) {
  const values = scale === "major"
    ? [0, 2, 4, 5, 7, 9, 11]
    : scale === "dorian"
      ? [0, 2, 3, 5, 7, 9, 10]
      : [0, 2, 3, 5, 7, 8, 10];
  const octaves = Math.floor(Math.max(0, scaleDegreeOffset) / values.length);
  return values[scaleDegreeOffset % values.length] + octaves * 12;
}

function textureVoicing(texture: AiMusicTexture) {
  switch (texture) {
    case "rnb":
      return { bassType: "sine" as OscillatorType, bassCutoff: 380, leadType: "triangle" as OscillatorType, leadCutoff: 1_250, bassGain: 1.08, leadGain: 0.92 };
    case "rap":
    case "hiphop":
      return { bassType: "sine" as OscillatorType, bassCutoff: 240, leadType: "triangle" as OscillatorType, leadCutoff: 900, bassGain: 1.25, leadGain: 0.72 };
    case "pop":
    case "upbeat":
      return { bassType: "triangle" as OscillatorType, bassCutoff: 520, leadType: "sawtooth" as OscillatorType, leadCutoff: 2_600, bassGain: 0.95, leadGain: 1.12 };
    case "rock":
      return { bassType: "sawtooth" as OscillatorType, bassCutoff: 760, leadType: "square" as OscillatorType, leadCutoff: 2_100, bassGain: 0.93, leadGain: 1.02 };
    case "electronic":
    case "pulse":
      return { bassType: "sine" as OscillatorType, bassCutoff: 360, leadType: "sawtooth" as OscillatorType, leadCutoff: 2_200, bassGain: 1, leadGain: 1 };
    default:
      return { bassType: "sine" as OscillatorType, bassCutoff: 280, leadType: "triangle" as OscillatorType, leadCutoff: 1_000, bassGain: 1, leadGain: 1 };
  }
}

function writeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const dataLength = length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + dataLength));
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < length; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

/**
 * Renders the AI-generated musical blueprint locally. A WAV is intentionally
 * used: it previews in-browser, works with the existing repository uploader,
 * and avoids an additional codec dependency before MediaBunny encodes the MP4.
 */
export async function renderAiMusicLoop(plan: AiLoopPlan, durationSeconds = LOOP_SECONDS): Promise<Blob> {
  const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error("This browser does not support local audio rendering. Please use a current Chromium, Edge, or Safari browser.");
  const duration = Math.max(8, Math.min(30, durationSeconds));
  const context = new OfflineContext(2, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE) as OfflineAudioContext;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const ambience = context.createGain();
  master.gain.value = 0.72;
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;
  master.connect(compressor).connect(context.destination);
  ambience.gain.value = plan.texture === "ambient" ? 0.05 : 0.018;
  ambience.connect(master);

  const rootMidi = 48 + plan.keyRoot;
  const stepDuration = 60 / plan.bpm / 4;
  const patternSteps = 16;
  const noise = createNoiseBuffer(context, 0.22);
  const voicing = textureVoicing(plan.texture);
  const bassLevel = 0.10 + plan.density * 0.016;
  const leadLevel = plan.texture === "minimal" ? 0.045 : 0.055 + plan.density * 0.012;

  for (let cycleAt = 0, cycle = 0; cycleAt < duration + stepDuration; cycleAt += patternSteps * stepDuration, cycle += 1) {
    for (let step = 0; step < patternSteps; step += 1) {
      const swingOffset = step % 2 === 1 ? stepDuration * plan.swing : 0;
      const at = cycleAt + step * stepDuration + swingOffset;
      if (at >= duration) continue;
      const accent = step % 4 === 0 ? 1 : 0.78;
      if (plan.kickPattern[step]) addKick(context, master, at, accent);
      if (plan.snarePattern[step]) addNoiseHit(context, master, noise, at, Math.min(0.17, stepDuration * 0.78), 900, 0.10 * accent);
      if (plan.hatPattern[step] && plan.density >= 2) addNoiseHit(context, master, noise, at, Math.min(0.065, stepDuration * 0.5), 5_000, 0.030 * accent);
      const bassOffset = plan.bassPattern[step] ?? -1;
      if (bassOffset >= 0) addNote(context, master, at, stepDuration * 0.82, frequencyForMidi(rootMidi - 12 + bassOffset), voicing.bassType, bassLevel * voicing.bassGain * accent, voicing.bassCutoff);
      const leadOffset = plan.leadPattern[step] ?? -1;
      if (leadOffset >= 0 && plan.density >= 2) addNote(context, master, at, stepDuration * 0.65, frequencyForMidi(rootMidi + scaleOffset(plan.scale, leadOffset % 14) + 12), voicing.leadType, leadLevel * voicing.leadGain * accent, voicing.leadCutoff);
    }
    if (plan.texture === "ambient" && cycle % 2 === 0) {
      addNote(context, ambience, cycleAt, Math.min(3.4, duration - cycleAt), frequencyForMidi(rootMidi + 7), "sine", 0.06, 700);
      addNote(context, ambience, cycleAt, Math.min(3.4, duration - cycleAt), frequencyForMidi(rootMidi + 12), "sine", 0.04, 700);
    }
  }

  // A short tail prevents a hard audio click at the end of the exact 20-second
  // MP4 timeline while preserving a compact, reusable loop asset.
  master.gain.setValueAtTime(0.72, Math.max(0, duration - 0.18));
  master.gain.linearRampToValueAtTime(0.0001, duration);
  return writeWav(await context.startRendering());
}

export function aiLoopFilename(title: string) {
  const safe = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "ai-music-loop";
  return `${safe}-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
}

export const AI_MUSIC_DURATION_SECONDS = LOOP_SECONDS;
