// Sintetizador simples (Web Audio) para o piano e pequenos sons de interface.
let ctx = null;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** note: 0 = C3 ... 12 = C4 ... 24 = C5 */
export function playNote(note, volume = 0.6) {
  const ac = audio();
  const freq = 130.81 * Math.pow(2, note / 12);
  const t = ac.currentTime;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.28 * volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  gain.connect(ac.destination);
  for (const [type, mult, vol] of [['triangle', 1, 1], ['sine', 2, 0.3]]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = vol;
    osc.connect(g).connect(gain);
    osc.start(t);
    osc.stop(t + 1.5);
  }
}

export function blip(freq = 880, dur = 0.08, volume = 0.05) {
  try {
    const ac = audio();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* áudio indisponível */
  }
}
