const MUTE_KEY = "hisaby-pos-mute-beep";

export function getPosBeepMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPosBeepMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* ignore */
  }
}

function playTone(opts: {
  frequency: number;
  durationMs: number;
  type?: OscillatorType;
  volume?: number;
  secondFrequency?: number;
}): void {
  if (typeof window === "undefined") return;
  if (getPosBeepMuted()) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.value = opts.frequency;
    const vol = opts.volume ?? 0.08;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const dur = opts.durationMs / 1000;
    gain.gain.setValueAtTime(vol, now);
    if (opts.secondFrequency) {
      osc.frequency.setValueAtTime(opts.frequency, now);
      osc.frequency.setValueAtTime(opts.secondFrequency, now + dur * 0.45);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* ignore — audio may be blocked */
  }
}

/** Short success beep via Web Audio oscillator (no asset files). */
export function playPosScanBeep(): void {
  playTone({ frequency: 880, durationMs: 90 });
}

  /** Soft warning — at or under min stock after add. */
export function playPosWarnBeep(): void {
  playTone({
    frequency: 660,
    secondFrequency: 520,
    durationMs: 160,
    type: "triangle",
    volume: 0.09,
  });
}

/** Hard deny — overstock or blocked add. */
export function playPosDenyBeep(): void {
  playTone({
    frequency: 220,
    secondFrequency: 160,
    durationMs: 180,
    type: "square",
    volume: 0.07,
  });
}

/** Manager alert — elevated voids / ops threshold. */
export function playPosAlertBeep(): void {
  playTone({
    frequency: 480,
    secondFrequency: 720,
    durationMs: 280,
    type: "sawtooth",
    volume: 0.08,
  });
  window.setTimeout(() => {
    playTone({
      frequency: 720,
      secondFrequency: 480,
      durationMs: 220,
      type: "sawtooth",
      volume: 0.07,
    });
  }, 300);
}
