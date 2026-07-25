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

/** Short success beep via Web Audio oscillator (no asset files). */
export function playPosScanBeep(): void {
  if (typeof window === "undefined") return;
  if (getPosBeepMuted()) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* ignore — audio may be blocked */
  }
}
