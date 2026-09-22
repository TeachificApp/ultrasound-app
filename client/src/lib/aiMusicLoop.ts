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

type TextureVoicing = {
  bassType: OscillatorType;
  bassCutoff: number;
  leadType: OscillatorType;
  leadCutoff: number;
  bassGain: number;
  leadGain: number;
  chordGain: number;
  chordCutoff: number;
  reverbMix: number;
  clap: boolean;
  openHat: boolean;
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
  let low = 0;
  for (let index = 0; index < values.length; index += 1) {
    const white = Math.random() * 2 - 1;
    low = low * 0.94 + white * 0.06;
    values[index] = white * 0.68 + low * 0.32;
  }
  return buffer;
}

function createImpulseResponse(context: OfflineAudioContext, seconds: number, decay: number) {
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const tail = (1 - index / data.length) ** decay;
      data[index] = (Math.random() * 2 - 1) * tail;
    }
  }
  return buffer;
}

function createDrive(context: OfflineAudioContext, amount = 1.7) {
  const drive = context.createWaveShaper();
  const curve = new Float32Array(512);
  for (let index = 0; index < curve.length; index += 1) {
    const x = index * 2 / (curve.length - 1) - 1;
    curve[index] = Math.tanh(x * amount);
  }
  drive.curve = curve;
  drive.oversample = "2x";
  return drive;
}

function addModernKick(context: OfflineAudioContext, destination: AudioNode, at: number, intensity: number) {
  const body = context.createOscillator();
  const sub = context.createOscillator();
  const click = context.createOscillator();
  const bodyGain = context.createGain();
  const subGain = context.createGain();
  const clickGain = context.createGain();
  const drive = createDrive(context, 1.45);
  const filter = context.createBiquadFilter();

  body.type = "sine";
  body.frequency.setValueAtTime(168, at);
  body.frequency.exponentialRampToValueAtTime(47, at + 0.15);
  bodyGain.gain.setValueAtTime(0.0001, at);
  bodyGain.gain.exponentialRampToValueAtTime(0.30 * intensity, at + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.21);

  sub.type = "sine";
  sub.frequency.setValueAtTime(58, at);
  subGain.gain.setValueAtTime(0.0001, at);
  subGain.gain.exponentialRampToValueAtTime(0.095 * intensity, at + 0.012);
  subGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);

  click.type = "triangle";
  click.frequency.setValueAtTime(1_100, at);
  click.frequency.exponentialRampToValueAtTime(180, at + 0.024);
  clickGain.gain.setValueAtTime(0.0001, at);
  clickGain.gain.exponentialRampToValueAtTime(0.048 * intensity, at + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.032);

  filter.type = "lowpass";
  filter.frequency.value = 520;
  body.connect(bodyGain).connect(filter);
  sub.connect(subGain).connect(filter);
  click.connect(clickGain).connect(filter);
  filter.connect(drive).connect(destination);
  body.start(at); body.stop(at + 0.26);
  sub.start(at); sub.stop(at + 0.27);
  click.start(at); click.stop(at + 0.04);
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
  gain.gain.exponentialRampToValueAtTime(level, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function addModernSnare(context: OfflineAudioContext, destination: AudioNode, noise: AudioBuffer, at: number, intensity: number, clap: boolean) {
  addNoiseHit(context, destination, noise, at, 0.16, 1_250, 0.112 * intensity);
  const tone = context.createOscillator();
  const toneGain = context.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(205, at);
  tone.frequency.exponentialRampToValueAtTime(112, at + 0.095);
  toneGain.gain.setValueAtTime(0.0001, at);
  toneGain.gain.exponentialRampToValueAtTime(0.072 * intensity, at + 0.003);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.105);
  tone.connect(toneGain).connect(destination);
  tone.start(at);
  tone.stop(at + 0.12);
  if (clap) {
    for (const offset of [0.014, 0.029, 0.046]) addNoiseHit(context, destination, noise, at + offset, 0.075, 1_650, 0.052 * intensity);
  }
}

function addModernHat(context: OfflineAudioContext, destination: AudioNode, noise: AudioBuffer, at: number, intensity: number, open: boolean) {
  addNoiseHit(context, destination, noise, at, open ? 0.19 : 0.048, open ? 6_100 : 7_200, (open ? 0.040 : 0.028) * intensity);
}

function addLayeredBass(
  context: OfflineAudioContext,
  destination: AudioNode,
  at: number,
  duration: number,
  frequency: number,
  voicing: TextureVoicing,
  level: number,
) {
  const sub = context.createOscillator();
  const character = context.createOscillator();
  const subGain = context.createGain();
  const characterGain = context.createGain();
  const filter = context.createBiquadFilter();
  const drive = createDrive(context, voicing.bassType === "sine" ? 1.1 : 2.15);
  const gain = context.createGain();

  sub.type = "sine";
  sub.frequency.setValueAtTime(frequency, at);
  character.type = voicing.bassType;
  character.frequency.setValueAtTime(frequency, at);
  character.detune.value = voicing.bassType === "sine" ? 0 : -4;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(voicing.bassCutoff, at);
  filter.Q.value = 1.25;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level * voicing.bassGain, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.06, duration * 0.94));
  subGain.gain.value = 0.78;
  characterGain.gain.value = voicing.bassType === "sine" ? 0.12 : 0.28;
  sub.connect(subGain).connect(filter);
  character.connect(characterGain).connect(filter);
  filter.connect(drive).connect(gain).connect(destination);
  sub.start(at); sub.stop(at + duration);
  character.start(at); character.stop(at + duration);
}

function addModernLead(
  context: OfflineAudioContext,
  destination: AudioNode,
  at: number,
  duration: number,
  frequency: number,
  voicing: TextureVoicing,
  level: number,
) {
  const primary = context.createOscillator();
  const shimmer = context.createOscillator();
  const primaryGain = context.createGain();
  const shimmerGain = context.createGain();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  primary.type = voicing.leadType;
  shimmer.type = voicing.leadType === "square" ? "triangle" : "sine";
  primary.frequency.setValueAtTime(frequency, at);
  shimmer.frequency.setValueAtTime(frequency * 2, at);
  primary.detune.value = -7;
  shimmer.detune.value = 8;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(voicing.leadCutoff, at);
  filter.Q.value = 1.05;
  primaryGain.gain.value = 0.74;
  shimmerGain.gain.value = 0.24;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level * voicing.leadGain, at + Math.min(0.035, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.08, duration * 0.88));
  primary.connect(primaryGain).connect(filter);
  shimmer.connect(shimmerGain).connect(filter);
  filter.connect(gain).connect(destination);
  primary.start(at); primary.stop(at + duration);
  shimmer.start(at); shimmer.stop(at + duration);
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

function addPadChord(
  context: OfflineAudioContext,
  destination: AudioNode,
  at: number,
  duration: number,
  rootMidi: number,
  scale: AiLoopPlan["scale"],
  degree: number,
  voicing: TextureVoicing,
  level: number,
) {
  const triad = [0, 2, 4].map((interval) => frequencyForMidi(rootMidi + scaleOffset(scale, degree + interval) + 12));
  for (const [index, frequency] of triad.entries()) {
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = index === 0 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.detune.value = (index - 1) * 5;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voicing.chordCutoff, at);
    filter.Q.value = 0.4;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level * voicing.chordGain / triad.length, at + Math.min(0.25, duration * 0.16));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.25, duration * 0.9));
    oscillator.connect(filter).connect(gain).connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
}

function textureVoicing(texture: AiMusicTexture): TextureVoicing {
  switch (texture) {
    case "rnb":
      return { bassType: "sine", bassCutoff: 420, leadType: "triangle", leadCutoff: 1_600, bassGain: 1.1, leadGain: 0.9, chordGain: 1.22, chordCutoff: 1_050, reverbMix: 0.16, clap: true, openHat: true };
    case "rap":
      return { bassType: "sine", bassCutoff: 250, leadType: "triangle", leadCutoff: 920, bassGain: 1.35, leadGain: 0.72, chordGain: 0.48, chordCutoff: 800, reverbMix: 0.045, clap: true, openHat: false };
    case "hiphop":
      return { bassType: "sine", bassCutoff: 290, leadType: "triangle", leadCutoff: 1_150, bassGain: 1.28, leadGain: 0.78, chordGain: 0.75, chordCutoff: 940, reverbMix: 0.075, clap: true, openHat: true };
    case "pop":
      return { bassType: "triangle", bassCutoff: 580, leadType: "sawtooth", leadCutoff: 2_800, bassGain: 0.98, leadGain: 1.12, chordGain: 1.08, chordCutoff: 2_400, reverbMix: 0.12, clap: false, openHat: true };
    case "upbeat":
      return { bassType: "triangle", bassCutoff: 590, leadType: "sawtooth", leadCutoff: 3_000, bassGain: 0.98, leadGain: 1.16, chordGain: 1.02, chordCutoff: 2_600, reverbMix: 0.10, clap: false, openHat: true };
    case "rock":
      return { bassType: "sawtooth", bassCutoff: 820, leadType: "square", leadCutoff: 2_250, bassGain: 0.96, leadGain: 1.03, chordGain: 1.15, chordCutoff: 1_550, reverbMix: 0.07, clap: false, openHat: false };
    case "electronic":
    case "pulse":
      return { bassType: "sine", bassCutoff: 410, leadType: "sawtooth", leadCutoff: 2_450, bassGain: 1, leadGain: 1.04, chordGain: 0.82, chordCutoff: 1_700, reverbMix: 0.10, clap: false, openHat: true };
    case "ambient":
      return { bassType: "sine", bassCutoff: 320, leadType: "triangle", leadCutoff: 1_200, bassGain: 0.78, leadGain: 0.72, chordGain: 1.34, chordCutoff: 900, reverbMix: 0.27, clap: false, openHat: false };
    default:
      return { bassType: "sine", bassCutoff: 310, leadType: "triangle", leadCutoff: 1_300, bassGain: 0.92, leadGain: 0.9, chordGain: 0.86, chordCutoff: 1_300, reverbMix: 0.12, clap: false, openHat: false };
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
 * Renders the AI-generated musical blueprint locally. The Web Audio arrangement
 * uses layered percussion, saturated sub bass, modern lead voicing, evolving
 * chord pads, compression, and a short generated room response. A WAV is used
 * so it previews in-browser and works with the established Media Repository and
 * MediaBunny MP4 workflow without copying any third-party audio.
 */
export async function renderAiMusicLoop(plan: AiLoopPlan, durationSeconds = LOOP_SECONDS): Promise<Blob> {
  const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error("This browser does not support local audio rendering. Please use a current Chromium, Edge, or Safari browser.");
  const duration = Math.max(8, Math.min(30, durationSeconds));
  const context = new OfflineContext(2, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE) as OfflineAudioContext;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const limiter = context.createDynamicsCompressor();
  const drums = context.createGain();
  const music = context.createGain();
  const room = context.createConvolver();
  const roomGain = context.createGain();
  const voicing = textureVoicing(plan.texture);

  master.gain.value = 0.68;
  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.16;
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.08;
  drums.gain.value = 0.92;
  music.gain.value = 0.78;
  room.buffer = createImpulseResponse(context, plan.texture === "ambient" ? 1.7 : 0.75, plan.texture === "ambient" ? 1.8 : 2.8);
  roomGain.gain.value = voicing.reverbMix;
  drums.connect(master);
  music.connect(master);
  music.connect(roomGain).connect(room).connect(master);
  drums.connect(roomGain).connect(room);
  master.connect(compressor).connect(limiter).connect(context.destination);

  const rootMidi = 48 + plan.keyRoot;
  const stepDuration = 60 / plan.bpm / 4;
  const patternSteps = 16;
  const barDuration = patternSteps * stepDuration;
  const noise = createNoiseBuffer(context, 0.24);
  const bassLevel = 0.105 + plan.density * 0.015;
  const leadLevel = plan.texture === "minimal" ? 0.038 : 0.050 + plan.density * 0.010;
  const chordProgression = plan.scale === "major" ? [0, 4, 5, 3] : plan.scale === "dorian" ? [0, 3, 4, 2] : [0, 5, 3, 4];

  for (let cycleAt = 0, cycle = 0; cycleAt < duration; cycleAt += barDuration, cycle += 1) {
    const arrangementGain = cycle % 4 === 3 ? 1 : cycle % 4 === 0 ? 0.78 : 0.90;
    if (plan.texture !== "minimal" || cycle % 2 === 0) {
      addPadChord(context, music, cycleAt, Math.min(barDuration * 0.96, duration - cycleAt), rootMidi, plan.scale, chordProgression[cycle % chordProgression.length], voicing, (plan.texture === "ambient" ? 0.075 : 0.050) * arrangementGain);
    }
    for (let step = 0; step < patternSteps; step += 1) {
      const swingOffset = step % 2 === 1 ? stepDuration * plan.swing : 0;
      const at = cycleAt + step * stepDuration + swingOffset;
      if (at >= duration) continue;
      const accent = (step % 4 === 0 ? 1 : 0.78) * arrangementGain;
      if (plan.kickPattern[step]) addModernKick(context, drums, at, accent);
      if (plan.snarePattern[step]) addModernSnare(context, drums, noise, at, accent, voicing.clap);
      if (plan.hatPattern[step] && plan.density >= 2) addModernHat(context, drums, noise, at, accent, voicing.openHat && step % 8 === 7);
      const bassOffset = plan.bassPattern[step] ?? -1;
      if (bassOffset >= 0) addLayeredBass(context, music, at, stepDuration * 0.9, frequencyForMidi(rootMidi - 12 + bassOffset), voicing, bassLevel * accent);
      const leadOffset = plan.leadPattern[step] ?? -1;
      if (leadOffset >= 0 && plan.density >= 2) addModernLead(context, music, at, stepDuration * 0.75, frequencyForMidi(rootMidi + scaleOffset(plan.scale, leadOffset % 14) + 12), voicing, leadLevel * accent);
    }
  }

  master.gain.setValueAtTime(0.68, Math.max(0, duration - 0.2));
  master.gain.linearRampToValueAtTime(0.0001, duration);
  return writeWav(await context.startRendering());
}

export function aiLoopFilename(title: string) {
  const safe = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "ai-music-loop";
  return `${safe}-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
}

export const AI_MUSIC_DURATION_SECONDS = LOOP_SECONDS;
