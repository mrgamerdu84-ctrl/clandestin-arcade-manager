/**
 * Petite discothèque synthétique : boucle disco générée en WebAudio
 * (aucun fichier audio à télécharger). Démarre au premier clic utilisateur.
 */
export type DiscoAudio = {
  toggle: () => boolean;
  isOn: () => boolean;
  setDucked: (ducked: boolean) => void;
  dispose: () => void;
};

export function createDiscoAudio(): DiscoAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: number | null = null;
  let step = 0;
  let nextTime = 0;
  let on = false;
  let ducked = false;

  const BPM = 116;
  const stepDur = 60 / BPM / 4; // double-croches
  // ligne de basse disco (demi-tons relatifs à A1)
  const bass = [0, 0, 12, 0, 7, 0, 10, 0, 0, 0, 12, 0, 5, 0, 3, 0];
  const chordSteps = [4, 12];

  const freq = (semi: number, base = 55) => base * Math.pow(2, semi / 12);

  function env(node: GainNode, t: number, peak: number, dur: number, attack = 0.005) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function kick(t: number) {
    const c = ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, t, 0.9, 0.24);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.3);
  }

  function hat(t: number, open: boolean) {
    const c = ctx!;
    const len = open ? 0.18 : 0.05;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = open ? 0.16 : 0.1;
    src.connect(hp).connect(g).connect(master!);
    src.start(t);
  }

  function bassNote(t: number, semi: number) {
    const c = ctx!;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq(semi);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    const g = c.createGain();
    env(g, t, 0.28, 0.2, 0.01);
    o.connect(f).connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.25);
  }

  function stab(t: number, bar: number) {
    const c = ctx!;
    // Am7 / Fmaj7 en alternance : couleur disco
    const root = bar % 2 === 0 ? 12 : 8;
    [root, root + 3, root + 7, root + 10].forEach((semi) => {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = freq(semi, 110);
      const g = c.createGain();
      env(g, t, 0.055, 0.28, 0.01);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2600;
      o.connect(f).connect(g).connect(master!);
      o.start(t);
      o.stop(t + 0.32);
    });
  }

  function schedule() {
    const c = ctx!;
    while (nextTime < c.currentTime + 0.2) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      if (s % 4 === 0) kick(nextTime);
      hat(nextTime, s % 4 === 2);
      if (bass[s]) bassNote(nextTime, bass[s]);
      if (chordSteps.includes(s)) stab(nextTime, bar);
      nextTime += stepDur;
      step++;
    }
  }

  function applyGain() {
    if (!master || !ctx) return;
    const target = on ? (ducked ? 0.06 : 0.22) : 0;
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
  }

  function start() {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      nextTime = ctx.currentTime + 0.05;
    }
    void ctx.resume();
    if (timer === null) timer = window.setInterval(schedule, 60);
    applyGain();
  }

  return {
    toggle() {
      on = !on;
      if (on) start();
      applyGain();
      return on;
    },
    isOn: () => on,
    setDucked(v: boolean) {
      if (ducked === v) return;
      ducked = v;
      applyGain();
    },
    dispose() {
      on = false;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (ctx) void ctx.close();
      ctx = null;
      master = null;
    },
  };
}
