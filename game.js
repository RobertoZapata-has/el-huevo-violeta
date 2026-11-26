/* El Huevo Violeta — plataformas de Chispa y Bichi */
'use strict';
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- Pantalla ---------- */
let W = 640, H = 360, S = 1, DPR = 1, OX = 0, OY = 0;
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1);
  const vw = innerWidth, vh = innerHeight;
  H = 360; W = clamp(Math.round(vw / vh * H), 520, 800); S = Math.min(vw / W, vh / H);
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
  OX = (vw - W * S) / 2; OY = (vh - H * S) / 2;
  checkRotate();
}
addEventListener('resize', layout);

/* ---------- Guardado ---------- */
const SAVE_KEY = 'huevo-violeta-save-v1';
let SV = { unlocked: 1, coins: 0, fig: [0, 0, 0, 0, 0, 0], best: [0, 0, 0, 0, 0, 0], maxhp: 3, ammo: 12, seen: {}, beaten: false, mute: false, resume: null };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) SV = Object.assign(SV, s); } catch (e) {}
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} };

/* ---------- Audio ---------- */
let AC = null, master = null;
function audioOn() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  if (AC && M.want && (!M.th || M.th !== THEMES[M.want])) playMusic(M.want);
}
function tone(f, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
  if (!AC || SV.mute) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function nb() { if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function noise(dur, vol, freq = 1000, delay = 0) {
  if (!AC || SV.mute) return;
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = nb(); s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
const SFX = {
  jump() { tone(300, 0.14, 'square', 0.04, 380); },
  land() { tone(120, 0.05, 'triangle', 0.05); },
  beam() { tone(880, 0.16, 'sine', 0.06, 900); tone(1320, 0.12, 'triangle', 0.03, -600, 0.02); },
  sling() { tone(220, 0.08, 'triangle', 0.07, 300); noise(0.05, 0.05, 3000); },
  empty() { tone(160, 0.06, 'square', 0.04); },
  hit() { tone(240, 0.06, 'square', 0.05, -100); },
  shrink() { [1200, 900, 700, 500].forEach((f, i) => tone(f, 0.08, 'sine', 0.05, -100, i * 0.05)); },
  coin() { tone(1320, 0.05, 'square', 0.035); tone(1760, 0.08, 'square', 0.035, 0, 0.05); },
  pick() { [660, 880, 1100].forEach((f, i) => tone(f, 0.07, 'square', 0.04, 0, i * 0.05)); },
  fig() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.1, 'triangle', 0.07, 0, i * 0.07)); },
  hurt() { tone(400, 0.3, 'sawtooth', 0.06, -300); },
  splash() { noise(0.4, 0.2, 1800); tone(300, 0.2, 'sine', 0.05, -200); },
  boom() { noise(0.4, 0.22, 1200); tone(100, 0.3, 'triangle', 0.12, -50); },
  geyser() { noise(0.9, 0.2, 2500); },
  bichi() { tone(1500, 0.05, 'square', 0.03); tone(1900, 0.05, 'square', 0.03, 0, 0.07); tone(1500, 0.05, 'square', 0.03, 0, 0.14); },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.11)); },
  tunnel() { for (let i = 0; i < 3; i++) tone(700, 0.12, 'square', 0.05, 0, i * 0.22); },
};

/* ---------- Música (sintetizada, misma familia que Puelche) ---------- */
function seeded(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const PENTA = { min: [0, 3, 5, 7, 10, 12, 15, 17], maj: [0, 2, 4, 7, 9, 12, 14, 16] };
function theme(o) {
  const r = seeded(o.seed), sc = PENTA[o.minor ? 'min' : 'maj'], mel = [];
  let last = 2;
  for (let i = 0; i < 64; i++) { if (i % 2 || r() > o.dens) { mel.push(null); continue; } last = clamp(last + Math.round((r() - 0.5) * 4), 0, sc.length - 1); mel.push(sc[last]); }
  for (let i = 32; i < 48; i++) mel[i] = mel[i - 32];
  return Object.assign({ mel }, o);
}
const THEMES = {
  menu: theme({ seed: 9, bpm: 100, root: 57, prog: [0, -4, 3, -2], minor: 1, dens: 0.55, bass: 'x...x...x...x.o.', kick: 'x.......x.......', snare: '................', hat: 0 }),
  l1: theme({ seed: 101, bpm: 140, root: 52, prog: [0, 3, -2, 5], minor: 0, dens: 0.72, bass: 'x.ox.ox.x.ox.oxo', kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 1 }),
  l2: theme({ seed: 33, bpm: 112, root: 45, prog: [0, -4, -2, 0], minor: 1, dens: 0.5, bass: 'x.....x.x.......', kick: 'x.......x.......', snare: '....x.......x...', hat: 0 }),
  l3: theme({ seed: 57, bpm: 132, root: 55, prog: [0, -5, -3, -1], minor: 0, dens: 0.7, bass: 'x..x..x.x..x.o.o', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 1 }),
  l4: theme({ seed: 77, bpm: 144, root: 50, prog: [0, 5, 3, -2], minor: 0, dens: 0.75, bass: 'x.xox.xox.xox.xo', kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 1 }),
  l5: theme({ seed: 61, bpm: 120, root: 46, prog: [0, 1, -2, -4], minor: 1, dens: 0.6, bass: 'x..x..x...x..x.o', kick: 'x.....x...x.....', snare: '....x.......x...', hat: 1 }),
  l6: theme({ seed: 13, bpm: 150, root: 49, prog: [0, -2, -4, -5], minor: 1, dens: 0.8, bass: 'xoxoxoxoxoxoxoxo', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 1 }),
  boss: theme({ seed: 83, bpm: 162, root: 45, prog: [0, 1, 0, -1], minor: 1, dens: 0.85, bass: 'xoxoxoxoxoxoxoxo', kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 1 }),
  epica: theme({ soft: 1, style: 'epic', seed: 101, bpm: 84, root: 50, prog: [0, -4, 3, -2], q: ['m', 'M', 'M', 'M'], minor: 1, dens: 0.55, bass: '', kick: '', snare: '', hat: 0 }),
  oscuro: theme({ soft: 1, style: 'dark', seed: 29, bpm: 56, root: 45, prog: [0, 1, 0, 6], q: ['m', 'M', 'm', 'd'], minor: 1, dens: 0.3, bass: '', kick: '', snare: '', hat: 0 }),
  final: theme({ soft: 1, style: 'final', seed: 17, bpm: 80, root: 55, prog: [0, 5, 7, 5], q: ['M', 'M', 'M', 'M'], minor: 0, dens: 0.6, bass: '', kick: '', snare: '', hat: 0 }),
};
const M = { th: null, want: null, step: 0, t: 0, iv: null, g: null };
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function mv(f, t, dur, type, vol) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(M.g); o.start(t); o.stop(t + dur + 0.02); }
function mnoise(t, dur, vol, hp) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = nb(); f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(M.g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); }
function kick(t) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(M.g); o.start(t); o.stop(t + 0.18); }
function softBus() {
  if (M.sb) return M.sb;
  const g = AC.createGain(), lp = AC.createBiquadFilter(), d = AC.createDelay(1), fb = AC.createGain(), wet = AC.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.4; M.sbLP = lp; d.delayTime.value = 0.36; fb.gain.value = 0.35; wet.gain.value = 0.4;
  g.connect(lp); lp.connect(M.g); lp.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(M.g);
  return M.sb = g;
}
function sv(f, t, dur, type, vol, att, det, dest) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0.0001, t + att, dur / 3); o.connect(g); g.connect(dest); o.start(t); o.stop(t + att + dur * 1.8); }
function timp(t, f, v) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.connect(g); g.connect(M.g); o.start(t); o.stop(t + 0.85); mnoise(t, 0.08, v * 0.25, 250); }
function thump(t, v) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(M.g); o.start(t); o.stop(t + 0.32); }
function playSoft(th, step, t, sp) {
  const bus = softBus(), bi = Math.floor(step / 16) % th.prog.length, s = step % 16, cr = th.root + th.prog[bi], L = sp * 16;
  const ch = { m: [0, 3, 7], M: [0, 4, 7], d: [0, 3, 6] }[(th.q || [])[bi] || (th.minor ? 'm' : 'M')];
  const m = th.mel[step % 64];
  if (s === 0) M.sbLP.frequency.setTargetAtTime(th.style === 'dark' ? 1000 : 2600, t, 0.4);
  if (th.style === 'dark') {
    if (s === 0) { sv(mf(cr - 24), t, L, 'sawtooth', 0.035, 1.4, -7, bus); sv(mf(cr - 24), t, L, 'sawtooth', 0.035, 1.4, 7, bus); sv(mf(cr - 12), t, L, 'sine', 0.16, 0.8, 0, bus); ch.forEach(n => sv(mf(cr + n), t, L, 'triangle', 0.022, 1.6, 0, bus)); }
    if (s === 0) thump(t, 0.32); if (s === 3) thump(t, 0.2);
    if (s === 8 && bi % 2 === 0) sv(mf(cr + 30), t, sp * 12, 'sine', 0.05, 0.01, 0, bus);
    if (m != null && s % 4 === 2) sv(mf(cr + 12 + m), t, sp * 8, 'sine', 0.045, 0.5, 0, bus);
    if (bi === 3 && s === 10) mnoise(t, 1.6, 0.08, 60);
    return;
  }
  if (s === 0) { ch.forEach(n => { sv(mf(cr + 12 + n), t, L, 'sawtooth', 0.015, 0.35, -8, bus); sv(mf(cr + 12 + n), t, L, 'sawtooth', 0.015, 0.35, 8, bus); }); sv(mf(cr - 12), t, L * 0.6, 'sine', 0.22, 0.05, 0, bus); }
  if (s % 2 === 0) sv(mf(cr + (s % 4 === 2 ? 7 : 0)), t, sp * 1.6, 'sawtooth', 0.032, 0.008, 0, bus);
  if (s === 0 || s === 6 || s === 10) ch.forEach(n => sv(mf(cr + 12 + n), t, sp * 2.5, 'sawtooth', 0.026, 0.02, 0, bus));
  if (s === 0 || s === 8) timp(t, mf(cr - 12), 0.4);
  if (th.style === 'epic' && bi === 3 && s >= 12) timp(t, mf(cr - 12), 0.22);
  if (m != null) { sv(mf(cr + 24 + m), t, sp * 3, 'sawtooth', 0.026, 0.03, 0, bus); sv(mf(cr + 24 + m), t, sp * 3, 'triangle', 0.06, 0.02, 0, bus); }
}
/* Orquesta de la historieta: cuerdas con vibrato, cornos, arpa, chelos, timbales y una sala con reverberación */
function orchBus() {
  if (M.ob) return M.ob;
  const g = AC.createGain(), lp = AC.createBiquadFilter(), dry = AC.createGain(), cv = AC.createConvolver(), wet = AC.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.3; dry.gain.value = 1.15; wet.gain.value = 0.8;
  const len = Math.floor(AC.sampleRate * 3.2), ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 200 ? i / 200 : 1); }
  cv.buffer = ir; g.connect(lp); lp.connect(dry); dry.connect(M.g); lp.connect(cv); cv.connect(wet); wet.connect(M.g);
  M.oLP = lp; return M.ob = g;
}
function ovoice(f, t, dur, o) {
  // o: {type, vol, att, rel, det, vib, cut, q, pan}
  const bus = orchBus(), osc = AC.createOscillator(), g = AC.createGain();
  osc.type = o.type || 'sawtooth'; osc.frequency.setValueAtTime(f, t); if (o.det) osc.detune.value = o.det;
  if (o.vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 4.6 + Math.random() * 0.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(dur, 0.9)); l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + dur + (o.rel || 0.5) + 0.1); }
  let node = osc;
  if (o.cut) { const fl = AC.createBiquadFilter(); fl.type = o.bp ? 'bandpass' : 'lowpass'; fl.frequency.setValueAtTime(o.cut, t); fl.Q.value = o.q || 0.7; if (o.swell) fl.frequency.linearRampToValueAtTime(o.cut * o.swell, t + (o.att || 0.05) + dur * 0.5); node.connect(fl); node = fl; }
  const att = o.att || 0.02, rel = o.rel || 0.4, v = o.vol || 0.05;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + att);
  if (o.pluck) g.gain.exponentialRampToValueAtTime(0.0001, t + att + dur);
  else { g.gain.setValueAtTime(v, t + att + Math.max(0, dur - att)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel); }
  node.connect(g);
  if (o.pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(bus); } else g.connect(bus);
  osc.start(t); osc.stop(t + dur + rel + 0.05);
}
function otimp(t, f, v) { const o = AC.createOscillator(), g = AC.createGain(), b = orchBus(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); o.connect(g); g.connect(b); o.start(t); o.stop(t + 1.5); }
function playOrch(th, step, t, sp) {
  orchBus();
  const bar = Math.floor(step / 16), bi = bar % th.prog.length, s = step % 16, cr = th.root + th.prog[bi], L = sp * 16;
  const q = (th.q || [])[bi] || (th.minor ? 'm' : 'M'), ch = { m: [0, 3, 7], M: [0, 4, 7], d: [0, 3, 6] }[q];
  const m = th.mel[step % 64], dark = th.style === 'dark', fin = th.style === 'final';
  if (s === 0) {
    M.oLP.frequency.setTargetAtTime(dark ? 1500 : 3600, t, 0.5);
    // cuerdas: el acorde en dos octavas, cada nota con dos arcos desafinados y vibrato
    const voicing = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
    voicing.forEach((n, i) => { const f = mf(cr + n + (dark ? 0 : 12)); const pan = (i - 2) * 0.25; ovoice(f, t, L, { type: 'sawtooth', vol: dark ? 0.012 : 0.014, att: dark ? 1.4 : 0.7, rel: 1.2, det: -9, vib: 9, cut: dark ? 900 : 1700, swell: 1.4, pan }); ovoice(f, t, L, { type: 'sawtooth', vol: dark ? 0.012 : 0.014, att: dark ? 1.4 : 0.7, rel: 1.2, det: 9, vib: 9, cut: dark ? 900 : 1700, swell: 1.4, pan: -pan }); });
    // chelos y contrabajos
    ovoice(mf(cr - 12), t, L, { type: 'sawtooth', vol: 0.05, att: 0.25, rel: 1, cut: 420, vib: 5 });
    ovoice(mf(cr - 24), t, L, { type: 'sine', vol: 0.12, att: 0.3, rel: 1 });
    otimp(t, mf(cr - 12), dark ? 0.45 : 0.32);
  }
  if (dark) {
    // coro grave ("uuu") y latido
    if (s === 0) [0, 7].forEach(n => ovoice(mf(cr + n), t, L, { type: 'sawtooth', vol: 0.02, att: 1.6, rel: 1.5, cut: 520, bp: 1, q: 4, vib: 6 }));
    if (s === 0 || s === 3) thumpO(t, s === 0 ? 0.35 : 0.22);
    if (m != null && s % 4 === 2) ovoice(mf(cr + 12 + m), t, sp * 7, { type: 'triangle', vol: 0.07, att: 0.005, pluck: 1 });
    if (bi === 3 && s >= 12) otimp(t, mf(cr - 12), 0.12 + (s - 12) * 0.05);
    return;
  }
  // arpa: arpegio que sube y baja
  const arp = [0, 1, 2, 3, 4, 3, 2, 1], tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
  if (s % 2 === 0) ovoice(mf(cr + 24 + tones[arp[(s / 2) % 8]]), t, sp * 6, { type: 'triangle', vol: 0.05, att: 0.004, pluck: 1, pan: ((s / 2) % 8 - 3.5) * 0.15 });
  // cornos con la melodía, y violines una octava arriba
  if (m != null) {
    const dur = sp * (th.mel[(step + 2) % 64] == null ? 4 : 2.2);
    ovoice(mf(cr + 12 + m), t, dur, { type: 'sawtooth', vol: 0.045, att: 0.08, rel: 0.5, cut: 1200, swell: 1.3, vib: 7 });
    ovoice(mf(cr + 24 + m), t, dur, { type: 'sawtooth', vol: 0.016, att: 0.12, rel: 0.6, cut: 2600, vib: 12, det: 5 });
  }
  if (fin && s % 4 === 0 && m != null) ovoice(mf(cr + 36 + m), t, sp * 8, { type: 'sine', vol: 0.03, att: 0.003, pluck: 1 });
  if (s === 8) otimp(t, mf(cr - 5), 0.18);
  if (th.style === 'epic' && bi === 3 && s >= 12) otimp(t, mf(cr - 12), 0.14 + (s - 12) * 0.04);
  if (th.style === 'epic' && s === 0 && bi === 0) { const b = orchBus(); const n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); n.buffer = nb(); f.type = 'bandpass'; f.frequency.value = 3500; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); n.connect(f); f.connect(g); g.connect(b); n.start(t); n.stop(t + 2.3); }
}
function thumpO(t, v) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.2); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(orchBus()); o.start(t); o.stop(t + 0.4); }
function playStep(th, step, t, sp) {
  if (th.soft) return playOrch(th, step, t, sp);
  const bar = Math.floor(step / 16) % th.prog.length, s = step % 16, cr = th.root + th.prog[bar];
  const b = th.bass[s]; if (b === 'x') mv(mf(cr - 12), t, sp * 1.7, 'triangle', 0.32); else if (b === 'o') mv(mf(cr), t, sp * 1.2, 'triangle', 0.24);
  if (s % 2 === 0) { const ch = th.minor ? [0, 3, 7, 12] : [0, 4, 7, 12]; mv(mf(cr + 12 + ch[(s / 2) % 4]), t, sp * 0.8, 'square', 0.03); }
  const m = th.mel[step % 64]; if (m != null) mv(mf(cr + 24 + m), t, sp * 1.9, 'square', 0.05);
  if (th.kick[s] === 'x') kick(t);
  if (th.snare[s] === 'x') mnoise(t, 0.12, 0.2, 1200);
  if (th.hat && s % 2 === 1) mnoise(t, 0.03, 0.05, 7000);
}
function musicTick() {
  if (!M.th || !AC) return;
  const sp = 60 / M.th.bpm / 4;
  if (M.t < AC.currentTime - 0.2) M.t = AC.currentTime + 0.05;
  while (M.t < AC.currentTime + 0.15) { if (!SV.mute) playStep(M.th, M.step, M.t, sp); M.step++; M.t += sp; }
}
function playMusic(name) {
  M.want = name; if (!AC) return;
  if (!M.g) { M.g = AC.createGain(); M.g.gain.value = 0.5; M.g.connect(master); }
  if (!M.iv) M.iv = setInterval(musicTick, 25);
  if (M.th === THEMES[name]) return;
  M.th = THEMES[name]; M.step = 0; M.t = AC.currentTime + 0.1;
}
function stopMusic() { M.th = null; M.want = null; }

/* ---------- Imágenes ---------- */
const IMG = {};
function loadAll(names, onp) {
  let done = 0;
  return Promise.all(names.map(n => new Promise(r => { const i = new Image(); i.onload = () => { IMG[n] = i; done++; onp(done / names.length); r(); }; i.onerror = () => { done++; onp(done / names.length); r(); }; i.src = 'a/' + n + '.webp'; })));
}
// dibuja un cuadro de una tira (las tiras miran a la derecha si es personaje, a la izquierda si es bicho)
function drawStrip(name, f, x, y, s, flip, alpha) {
  const im = IMG[name], m = STRIPS[name]; if (!im || !m) return;
  f = ((f % m.n) + m.n) % m.n;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(im, f * m.fw, 0, m.fw, m.fh, -m.ax * s, -m.ay * s, m.fw * s, m.fh * s);
  ctx.restore();
}
function outlined(s, x, y, size, fill = '#ffd21f', font = 'Luckiest Guy') {
  ctx.font = size + 'px "' + font + '", Impact, sans-serif'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5.5); ctx.strokeStyle = '#120a1f'; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function toast(msg, ms = 1800) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- Controles ---------- */
const keys = {};
const IN = { l: 0, r: 0, u: 0, d: 0, j: 0, f: 0, b: 0 };
let jumpBuf = 0, fireHeld = false, bichiPress = false;
addEventListener('keydown', e => {
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true; audioOn();
  if (['Space', 'ArrowUp', 'KeyW', 'KeyZ'].includes(e.code)) { e.preventDefault(); if (!(e.code === 'ArrowUp' || e.code === 'KeyW') || !onLadderNear()) jumpBuf = 0.13; }
  if (e.code === 'KeyC' || e.code === 'KeyK') bichiPress = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && G && G.run) togglePause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
// zona táctil: joystick flotante a la izquierda, botones a la derecha
const TC = { stick: null, base: null, pos: null, btn: {} };
const BTNS = () => ({ j: { x: W - 58, y: H - 60, r: 40, label: 'SALTAR' }, f: { x: W - 146, y: H - 46, r: 34, label: 'TIRAR' }, b: { x: W - 92, y: H - 140, r: 28, label: 'BICHI' } });
const pts = new Map();
function logical(e) { return { x: (e.clientX - OX) / S, y: (e.clientY - OY) / S }; }
function hitBtn(p) { const b = BTNS(); for (const k in b) { const o = b[k]; if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 < (o.r + 14) ** 2) return k; } return null; }
function evalTouch() {
  let j = 0, f = 0, bb = 0, stickPt = null;
  for (const [id, p] of pts) {
    if (p.kind === 'stick') stickPt = p;
    else if (p.kind === 'j') j = 1; else if (p.kind === 'f') f = 1; else if (p.kind === 'b') bb = 1;
  }
  if (j && !TC.btn.j) jumpBuf = 0.13;
  if (bb && !TC.btn.b) bichiPress = true;
  TC.btn = { j, f, b: bb };
  if (stickPt) { const dx = stickPt.x - stickPt.bx, dy = stickPt.y - stickPt.by; TC.pos = { dx, dy, bx: stickPt.bx, by: stickPt.by }; }
  else TC.pos = null;
}
cv.addEventListener('pointerdown', e => {
  audioOn(); if (!G || !G.run) return;
  const p = logical(e);
  if (p.x > W - 64 && p.y < 64) { togglePause(); return; }
  const k = hitBtn(p);
  if (k) p.kind = k; else if (p.x < W * 0.5) { p.kind = 'stick'; p.bx = p.x; p.by = p.y; } else p.kind = 'j';
  pts.set(e.pointerId, p); evalTouch(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
});
cv.addEventListener('pointermove', e => {
  const o = pts.get(e.pointerId); if (!o) return; const p = logical(e); o.x = p.x; o.y = p.y;
  if (o.kind === 'stick') { const dx = o.x - o.bx, dy = o.y - o.by, d = Math.hypot(dx, dy); if (d > 46) { o.bx += dx * (1 - 46 / d); o.by += dy * (1 - 46 / d); } }
  evalTouch();
});
const pup = e => { pts.delete(e.pointerId); evalTouch(); };
cv.addEventListener('pointerup', pup); cv.addEventListener('pointercancel', pup);
function readInput() {
  const p = TC.pos;
  IN.l = keys.ArrowLeft || keys.KeyA || (p && p.dx < -12) ? 1 : 0;
  IN.r = keys.ArrowRight || keys.KeyD || (p && p.dx > 12) ? 1 : 0;
  IN.u = keys.ArrowUp || keys.KeyW || (p && p.dy < -22) ? 1 : 0;
  IN.d = keys.ArrowDown || keys.KeyS || (p && p.dy > 22) ? 1 : 0;
  IN.j = keys.Space || keys.KeyZ || TC.btn.j ? 1 : 0;
  IN.f = keys.KeyX || keys.KeyJ || keys.Enter || TC.btn.f ? 1 : 0;
}

/* ---------- Mundo: terreno con mapa de alturas sacado de cada dibujo ---------- */
const GRAV = 1900, JV = 640, SPD = 205, HW = 10, HH = 58, HC = 34;
const PIECE = {
  shelf: ['plataformas-bodega-1', 0.62], barrels: ['plataformas-bodega-2', 0.62, 1], ledge: ['plataformas-bodega-3', 0.62], ladder: ['plataformas-bodega-4', 0.62],
  crate: ['cajones-0', 0.55, 1], crate2: ['cajones-1', 0.55, 1], barrel: ['cajones-2', 0.55, 1], barrelS: ['cajones-3', 0.55, 1],
  slab: ['plataformas-acequias-0', 0.62], stone: ['plataformas-acequias-1', 0.6, 1], bridge: ['plataformas-acequias-2', 0.66], branch: ['plataformas-acequias-3', 0.62], log: ['plataformas-acequias-4', 0.62],
  stairs: ['plataformas-cerro-0', 0.62, 1], brick: ['plataformas-cerro-1', 0.62], rock: ['plataformas-cerro-2', 0.62, 1], branch2: ['plataformas-cerro-3', 0.62], bench: ['plataformas-cerro-4', 0.6],
  hex: ['plataformas-colmena-0', 0.62], ice: ['plataformas-colmena-1', 0.62], pillar: ['plataformas-colmena-2', 0.62, 1], crystal: ['plataformas-colmena-3', 0.6],
  wet: ['plataformas-termas-0', 0.66], walk: ['plataformas-termas-2', 0.66], boulder: ['plataformas-termas-4', 0.6, 1],
};
function hmCore(name) { const t = HM[name].t.filter(v => v >= 0), mid = t.slice(Math.floor(t.length * 0.3), Math.ceil(t.length * 0.7)).sort((a, b) => a - b); return mid[Math.floor(mid.length / 2)] || 0; }
function surfY(o, x) {
  if (x < o.x || x > o.x + o.w) return null;
  if (o.flat) return o.y;
  const hm = o.hm, c = clamp(Math.floor((x - o.x) / (o.s * hm.s)), 0, hm.t.length - 1), v = hm.t[c];
  return v < 0 ? null : o.y + v * o.s;
}
// la superficie más alta entre y0 e y1 en la columna x
function surfaceAt(x, y0, y1, ignore) {
  let best = null, bo = null;
  for (const o of G.T) { if (o === ignore || o.dead) continue; if (x < o.x || x > o.x + o.w) continue; const s = surfY(o, x); if (s == null || s < y0 || s > y1) continue; if (best == null || s < best) { best = s; bo = o; } }
  return best == null ? null : { s: best, o: bo };
}
function feetSurface(x, y0, y1, ignore) {
  let r = null;
  for (const dx of [-HW * 0.7, 0, HW * 0.7]) { const q = surfaceAt(x + dx, y0, y1, ignore); if (q && (!r || q.s < r.s)) r = q; }
  return r;
}
function wallAt(x, footY, headY) {
  for (const o of G.T) {
    if (!o.solid || o.dead || x < o.x || x > o.x + o.w) continue;
    const s = surfY(o, x); if (s == null) continue;
    if (s < footY - 15 && headY < o.y + o.h) return true;
  }
  return false;
}

/* ---------- Constructor de niveles ---------- */
function builder(o) {
  const L = Object.assign({ T: [], haz: [], lad: [], en: [], pk: [], deco: [], front: [], lights: [], gey: [], tunnels: [], h: 360, gy: 300 }, o);
  const B = {
    L,
    ground(x0, x1, y = L.gy, opt = {}) { L.T.push(Object.assign({ flat: 1, x: x0, y, w: x1 - x0, h: 600, solid: 1, ground: 1 }, opt)); return B; },
    t(img, x, y, s, opt = {}) { const sz = SIZES[img]; const t = Object.assign({ img, x, y, s, w: sz[0] * s, h: sz[1] * s, hm: HM[img], solid: 0 }, opt); L.T.push(t); return t; },
    // plataforma: (x, superficie)
    p(key, x, sy, opt = {}) { const [img, s, solid] = PIECE[key]; const sc = opt.s || s; const y = sy - hmCore(img) * sc; const t = B.t(img, x, y, sc, Object.assign({ solid: solid ? 1 : 0, key }, opt)); if (opt.mv) { t.mv = Object.assign({ ax: 0, ay: 0, per: 4, ph: 0 }, opt.mv); t.bx = x; t.by = y; } B.last = t; return B; },
    // caja apoyada en el piso (x, piso)
    box(key, x, fy = L.gy, opt = {}) { const [img, s] = PIECE[key]; const sc = opt.s || s, sz = SIZES[img]; B.last = B.t(img, x, fy - sz[1] * sc + 2, sc, Object.assign({ solid: 1, key }, opt)); return B; },
    haz(x, y, w, h, type) { L.haz.push({ x, y, w, h, type }); return B; },
    water(x0, x1) { B.haz(x0, L.gy + 16, x1 - x0, 400, 'agua'); return B; },
    ladder(x, top, bot) { const [img, s] = PIECE.ladder; L.lad.push({ x, top, bot, img, s }); L.T.push({ flat: 1, x: x - 18, y: top, w: 36, h: 4, solid: 0, ladTop: 1 }); return B; },
    e(type, x, y, opt = {}) { L.en.push(Object.assign({ type, x, y }, opt)); return B; },
    coin(x, y, n = 1, dx = 26, arc = 0) { for (let i = 0; i < n; i++) L.pk.push({ type: 'coin', x: x + i * dx, y: y - (arc ? Math.sin((i + 0.5) / n * Math.PI) * arc : 0) }); return B; },
    pk(type, x, y) { L.pk.push({ type, x, y }); return B; },
    fig(x, y, i) { L.pk.push({ type: 'fig', x, y, i }); return B; },
    deco(img, x, y, s, front, opt = {}) { (front ? L.front : L.deco).push(Object.assign({ img, x, y, s }, opt)); return B; },
    light(x, y, r = 120) { L.lights.push({ x, y, r }); return B; },
    cart(x, y = L.gy) { L.cart = { x, y }; return B; },
    geyser(x, y = L.gy) { L.gey.push({ x, y, t: Math.random() * 3 }); return B; },
    arena(x0, x1, boss, bx, by, opt = {}) { L.arena = Object.assign({ x0, x1, boss, bx, by, trig: x0 + 60 }, opt); return B; },
  };
  return B;
}

/* ---------- Los seis niveles ---------- */
const LEVEL_NAMES = ['Vagones del Trasandino', 'La bodega subterránea', 'Las acequias', 'El Cerro de la Gloria', 'Las termas de Cacheuta', 'La colmena del glaciar'];
const LEVEL_THUMB = ['fondo-tren', 'fondo-bodega', 'fondo-acequias', 'fondo-cerro', 'fondo-termas', 'fondo-colmena'];
const RAIL = 334;
function level1() {
  const b = builder({ id: 0, bg: 'fondo-tren', music: 'l1', weapon: 'des', train: 1, gy: RAIL, fallY: RAIL + 40 }), L = b.L;
  const seq = ['P', 'P', 'C', 'P', 'P', 'C', 'P', 'C', 'P'], gaps = [75, 85, 78, 90, 80, 88, 85, 84, 86];
  const ws = []; let x = 0;
  seq.forEach((k, i) => { const t = k === 'P' ? b.t('vagon-pasajeros', x, RAIL - 159, 0.5222, { solid: 1, wagon: 1 }) : b.t('vagon-carga', x, RAIL - 176, 0.5853, { solid: 1, wagon: 1 }); t.kind = k; ws.push(t); x += t.w + gaps[i]; });
  const loco = b.t('locomotora-lado', x, RAIL - 165, 0.75, { solid: 1, wagon: 1, loco: 1 });
  L.w = loco.x + loco.w + 30; L.start = { x: 60, y: 150 };
  ws.forEach((w, i) => {
    const roof = w.kind === 'P' ? 184 : 150;
    if (w.kind === 'P') b.coin(w.x + 70, 160, 4, 30).coin(w.x + 300, 160, 3, 30);
    if (i < ws.length - 1) { const g0 = w.x + w.w, g1 = ws[i + 1].x; b.coin(g0 - 14, 150, 4, (g1 - g0 + 28) / 3, 46); }
    if (i >= 1) b.e('mosquito', w.x + w.w * 0.7, 110 + (i % 3) * 20);
    if (i >= 2 && w.kind === 'P') b.e('langosta', w.x + w.w * 0.55, roof);
    if (i >= 5 && i % 2) b.e('mosquito', w.x + w.w * 0.3, 90);
  });
  b.coin(ws[2].x + ws[2].w * 0.27, 135, 3, 22).coin(ws[5].x + ws[5].w * 0.66, 135, 3, 22);
  b.fig(ws[0].x + ws[0].w + 42, 88, 0);
  b.fig(ws[2].x + ws[2].w * 0.29, 118, 1);
  b.fig(ws[7].x + ws[7].w * 0.69, 116, 2);
  b.pk('bat', ws[3].x + 230, 150).pk('heart', ws[5].x + ws[5].w * 0.5, 120).pk('pit', ws[6].x + 120, 160).pk('pit', ws[8].x + 330, 160);
  b.cart(ws[4].x + 330, 184);
  L.tunnels = [{ trig: ws[2].x + 40 }, { trig: ws[6].x + 120 }];
  b.arena(loco.x + 6, loco.x + loco.w - 6, 'langosta', loco.x + loco.w * 0.66, null, { trig: loco.x + 40 });
  return L;
}
function level2() {
  const b = builder({ id: 1, bg: 'fondo-bodega', music: 'l2', weapon: 'des', dark: 1, ground: ['#5d4330', '#3a281c', '#7a5a3e'] }), L = b.L, gy = 300;
  L.w = 4300; L.start = { x: 60, y: gy };
  b.ground(0, 700).ground(790, 1500).ground(1600, 2500).ground(2660, 3300).ground(3420, 4300);
  // decorado del fondo
  for (const x of [120, 980, 1880, 2780, 3700]) b.deco('plataformas-bodega-0', x, gy - 150, 0.62);
  for (const x of [330, 1250, 2150, 3050, 3950]) { b.deco('deco-bodega-0', x, 70, 0.42); b.light(x + 26, 120, 150); }
  for (const x of [600, 1450, 2400, 3350]) b.deco('deco-bodega-1', x, 20, 0.5);
  for (const x of [880, 2250, 3200]) b.deco('deco-bodega-2', x, 0, 0.5);
  b.deco('deco-bodega-3', 3520, 90, 0.42);
  // primer tramo
  b.box('crate', 340).box('barrels', 470).coin(355, 228, 3, 24).coin(490, 190, 3, 24);
  b.e('oruga', 640, gy);
  b.p('ledge', 840, 232).p('shelf', 1000, 180).coin(860, 210, 4, 26).coin(1010, 158, 3, 26);
  b.ladder(1170, 120, gy).p('ledge', 1150, 120).fig(1240, 90, 0).coin(1180, 98, 3, 24);
  b.e('polilla', 1060, 150).e('escarabajo', 1330, gy).box('barrel', 1420);
  b.p('ledge', 1515, 258).coin(1530, 236, 3, 24);
  // segundo tramo
  b.cart(1700); b.pk('heart', 1820, 260);
  b.box('crate2', 1920).box('barrels', 2060).p('shelf', 2200, 170).coin(2210, 148, 3, 26);
  b.fig(2100, 150, 1);
  b.e('polilla', 2120, 120).e('oruga', 2300, gy).e('polilla', 2420, 170);
  b.p('ledge', 2540, 268, { mv: { ax: 46, per: 3.2 } }).coin(2560, 240, 3, 24);
  b.e('escarabajo', 2800, gy).box('crate', 2700);
  b.ladder(2920, 150, gy).p('ledge', 2895, 150).p('shelf', 3040, 110).fig(3080, 70, 2).coin(2915, 128, 3, 24).pk('bat', 3060, 90);
  b.e('oruga', 3150, gy).e('polilla', 3250, 140);
  b.p('ledge', 3300, 262).coin(3320, 240, 3, 24);
  // arena de la polilla
  b.p('ledge', 3740, 230).p('ledge', 4060, 230);
  b.arena(3560, 4290, 'polilla', 4000, 160);
  return L;
}
function level3() {
  const b = builder({ id: 2, bg: 'fondo-acequias', music: 'l3', weapon: 'gom', ground: ['#8a6a4a', '#5a4030', '#b08f68'] }), L = b.L, gy = 300;
  L.w = 4700; L.start = { x: 60, y: gy };
  const acq = [[520, 610], [980, 1080], [1460, 1740], [2300, 2390], [2780, 2880], [3300, 3560], [4230, 4300]];
  let x0 = 0; for (const [a, c] of acq) { b.ground(x0, a); b.water(a, c); x0 = c; } b.ground(x0, 4700);
  L.acq = acq;
  b.coin(150, 270, 5, 30).e('oruga', 400, gy);
  b.p('bridge', 512, 296).coin(530, 262, 3, 24);
  b.p('slab', 700, 240).p('branch', 820, 175).coin(720, 216, 3, 28).coin(850, 150, 3, 24).e('mosquito', 820, 120);
  b.pk('pit', 760, 210).pk('pit', 1150, 270);
  b.e('langosta', 1200, gy).p('slab', 1290, 236).fig(1330, 140, 0);
  b.p('log', 1470, 300, { mv: { ax: 80, per: 4.2 } }).p('log', 1620, 296, { mv: { ax: 60, per: 3.4, ph: 1.4 } }).coin(1500, 262, 6, 36);
  b.e('mosquito', 1600, 160);
  b.cart(1900); b.pk('heart', 2000, 260);
  b.box('stone', 2120).e('oruga', 2230, gy).p('bridge', 2292, 296).p('branch', 2420, 238).coin(2440, 210, 3, 26).fig(2470, 150, 1);
  b.e('langosta', 2600, gy).e('mosquito', 2700, 130).pk('pit', 2650, 270);
  b.p('slab', 2770, 246).p('slab', 2900, 200).p('branch', 3040, 150).coin(2920, 176, 3, 26).coin(3060, 128, 3, 24);
  b.p('log', 3320, 300, { mv: { ax: 70, per: 3.6 } }).p('slab', 3440, 228, { mv: { ay: 30, per: 3, ph: 0.6 } }).coin(3330, 262, 5, 40);
  b.fig(3470, 130, 2).e('mosquito', 3460, 120).e('langosta', 3700, gy).pk('pit', 3640, 270).pk('pit', 3760, 270);
  b.p('slab', 4000, 226).p('slab', 4420, 226);
  b.arena(3880, 4690, 'libelula', 4400, 130);
  return L;
}
function level4() {
  const b = builder({ id: 3, bg: 'fondo-cerro', music: 'l4', weapon: 'gom', vertical: 1, ground: ['#7a5b3c', '#4e3826', '#a08060'] }), L = b.L;
  L.w = 800; L.h = 2900; L.gy = 2860; L.start = { x: 120, y: 2860 };
  b.ground(0, 800, 2860);
  // zigzag de escalones: cada uno 63 px más arriba y a menos de 70 px del anterior
  const XS = [230, 380, 530, 650, 500, 350, 200, 60];
  const steps = [];
  for (let i = 0; i < 39; i++) { const y = 2794 - i * 63, x = XS[i % XS.length], k = i % 5 === 2 ? 'bench' : 'brick'; steps.push([k, x, y]); b.p(k, x, y); }
  // decorado: rocas con pasto al costado del camino
  for (let i = 3; i < 39; i += 5) b.deco('plataformas-cerro-2', (XS[i % XS.length] + 360) % 700, 2794 - i * 63 - 50, 0.5);
  b.box('stairs', 620, 2860);
  steps.forEach(([k, x, y], i) => { if (i % 2 === 0) b.coin(x + 25, y - 24, 3, 24); if (i % 6 === 3) b.e('avispa', x + 50, y - 90); if (i % 7 === 5) b.e('mosquito', 400, y - 110); if (i % 8 === 4) b.pk('pit', x + 50, y - 20); });
  b.p('brick', 455, 1975); b.cart(440, 1975); b.pk('heart', 380, 1940);
  // figuritas en ramas que salen al costado
  b.p('branch2', 690, 2545); b.fig(745, 2500, 0); b.p('branch2', 0, 1789); b.fig(40, 1744, 1); b.p('branch2', 690, 1033); b.fig(745, 988, 2);
  b.ground(0, 800, 330, { h: 26, solid: 0 });
  b.p('brick', 90, 262).p('brick', 620, 262);
  b.arena(0, 800, 'avispon', 560, 160, { trigY: 330 });
  return L;
}
function level5() {
  const b = builder({ id: 4, bg: 'fondo-termas', music: 'l5', weapon: 'gom', steam: 1, ground: ['#9a5a3a', '#6a3a24', '#c07a50'] }), L = b.L, gy = 300;
  L.w = 4600; L.start = { x: 60, y: gy };
  const pools = [[600, 700], [1300, 1400], [2140, 2240], [2900, 3000], [3400, 3500]];
  let x0 = 0; for (const [a, c] of pools) { b.ground(x0, a); b.haz(a, gy + 6, c - a, 400, 'pileta'); x0 = c; } b.ground(x0, 4600);
  L.pools = pools;
  b.coin(160, 270, 4, 30).e('escarabajo', 420, gy).box('boulder', 500);
  b.p('wet', 610, 246).coin(625, 222, 3, 24);
  b.geyser(860).p('walk', 820, 120).coin(840, 96, 4, 24).fig(870, 70, 0);
  b.e('mosquito', 980, 150).e('langosta', 1150, gy).pk('pit', 1050, 270);
  b.p('wet', 1310, 250, { mv: { ay: 26, per: 2.6 } }).box('boulder', 1500);
  b.cart(1700); b.pk('heart', 1790, 260);
  b.geyser(1950).p('walk', 1910, 130).p('wet', 2060, 186).coin(1930, 106, 3, 24).e('mosquito', 2100, 110);
  b.p('walk', 2150, 250).e('escarabajo', 2400, gy).pk('pit', 2350, 270);
  b.geyser(2600).p('walk', 2560, 110).fig(2600, 60, 1).coin(2570, 86, 4, 24);
  b.e('langosta', 2760, gy).p('wet', 2905, 244, { mv: { ax: 30, per: 3 } }).box('boulder', 3120).e('mosquito', 3200, 130);
  b.p('walk', 3410, 248).geyser(3650).p('wet', 3610, 140).p('wet', 3760, 90).fig(3790, 50, 2).coin(3620, 116, 3, 24);
  b.e('escarabajo', 3700, gy).pk('pit', 3800, 270);
  b.p('walk', 4050, 230).p('walk', 4400, 230);
  b.arena(3920, 4590, 'escarabajo', 4400, null);
  return L;
}
function level6() {
  const b = builder({ id: 5, bg: 'fondo-colmena', music: 'l6', weapon: 'des', ice: 1, ground: ['#7fb6e0', '#3d6c9a', '#d8f1ff'] }), L = b.L, gy = 300;
  L.w = 4700; L.start = { x: 60, y: gy };
  b.ground(0, 640, gy, { slip: 1 }).ground(760, 1500, gy, { slip: 1 }).ground(1640, 2600, gy, { slip: 1 }).ground(2760, 3500, gy, { slip: 1 }).ground(3620, 4700, gy, { slip: 1 });
  const spike = (x) => { b.deco('plataformas-colmena-4', x, gy - 104, 0.62, true); b.haz(x + 14, gy - 50, 42, 52, 'cristal'); };
  b.coin(150, 270, 4, 30).e('oruga', 420, gy); spike(520);
  b.p('hex', 640, 250).coin(660, 226, 3, 26).e('avispa', 820, 160);
  b.box('pillar', 920).p('ice', 1080, 200).coin(1100, 176, 3, 26).fig(1140, 120, 0);
  spike(1250); b.e('polilla', 1300, 150).e('oruga', 1400, gy);
  b.p('crystal', 1520, 250, { mv: { ay: 50, per: 3.2 } }).coin(1550, 200, 3, 24);
  b.cart(1760); b.pk('heart', 1850, 260);
  b.p('hex', 1950, 230).p('hex', 2100, 170).coin(2120, 146, 3, 26).e('avispa', 2150, 110).fig(2160, 100, 1);
  spike(2250); b.box('pillar', 2380).e('mosquito', 2450, 130).e('oruga', 2500, gy);
  b.p('crystal', 2620, 240, { mv: { ax: 50, per: 3.4 } }).coin(2640, 210, 3, 24).pk('bat', 2680, 200);
  b.e('polilla', 2900, 140).p('ice', 2950, 220).p('hex', 3100, 160).spike; spike(3020);
  b.p('crystal', 3260, 110, { mv: { ay: 30, per: 2.8 } }).fig(3300, 50, 2).e('avispa', 3300, 160);
  b.p('hex', 3450, 250).e('oruga', 3800, gy).e('mosquito', 3700, 120);
  b.p('hex', 4060, 214).p('hex', 4420, 214).p('ice', 4240, 150);
  b.arena(3920, 4690, 'princesa', 4400, 140);
  return L;
}
const LEVELS = [level1, level2, level3, level4, level5, level6];

/* ---------- Bichos ---------- */
const EN = {
  mosquito: { strip: 'bicho-mosquito', s: 0.3, fly: 1, hp: 2, w: 40, h: 36 },
  langosta: { strip: 'bicho-langosta', s: 0.28, hp: 2, w: 40, h: 40 },
  polilla: { strip: 'bicho-polilla', s: 0.3, fly: 1, hp: 2, w: 42, h: 40 },
  escarabajo: { strip: 'bicho-escarabajo', s: 0.38, hp: 3, w: 52, h: 30 },
  oruga: { strip: 'bicho-oruga', s: 0.34, hp: 2, w: 48, h: 30 },
  avispa: { strip: 'bicho-avispa', s: 0.32, fly: 1, hp: 2, w: 40, h: 40 },
};
const BOSS = {
  langosta: { strip: 'jefe-langosta', s: 0.34, hp: 24, name: 'LA LANGOSTA MAQUINISTA' },
  polilla: { strip: 'jefe-polilla', s: 0.4, hp: 26, name: 'LA POLILLA DE LA CAVA', fly: 1 },
  libelula: { strip: 'jefe-libelula', s: 0.36, hp: 22, name: 'LA LIBÉLULA DE LAS ACEQUIAS', fly: 1 },
  avispon: { strip: 'jefe-avispon', s: 0.38, hp: 24, name: 'EL AVISPÓN DEL CERRO', fly: 1 },
  escarabajo: { strip: 'jefe-escarabajo', s: 0.33, hp: 26, name: 'EL ESCARABAJO DE LAS TERMAS' },
  princesa: { strip: 'jefe-princesa', s: 0.4, hp: 40, name: 'LA PRINCESA DEL ENJAMBRE', fly: 1 },
};
const FACES = { bichi: 'cara-bichi', chispa: 'cara-chispa', tito: 'cara-tito', ozan: 'cara-ozan', princesa: 'cara-princesa' };
const WHO = { bichi: 'BICHI', chispa: 'CHISPA', tito: 'DON TITO', ozan: 'DRA. OZÁN', princesa: 'LA PRINCESA' };

let G = null, P = null, BI = null;
function say(who, text, d = 2.8) { if (!G) return; G.says.push({ who, text, d }); }
function puff(x, y, n, col, sp = 90, life = 0.6, sz = 4) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(sp * 0.3, sp); G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(life * 0.6, life), col, sz: rnd(sz * 0.6, sz) }); } }
function word(x, y, w, col) { G.words.push({ x, y, w, t: 0, col: col || '#ffd21f' }); }

function startLevel(lv, fromCp) {
  const L = LEVELS[lv]();
  G = { lv, L, T: L.T, run: true, paused: false, t: 0, cx: 0, cy: 0, E: [], PS: [], ES: [], fx: [], words: [], says: [], sayT: 0, pk: L.pk.map(p => Object.assign({}, p)), boss: null, lock: false, clear: 0, cp: null, coins: 0, figs: 0, trainX: 0, tunnels: (L.tunnels || []).map(t => Object.assign({ on: 0, x: 0 }, t)), dark: L.dark, shake: 0, cartMet: false, bichiFast: false, spawnIdx: 0, lastSafe: null, tunnelIn: 0, intro: 1.2 };
  // figuritas ya pegadas en una partida anterior no vuelven a aparecer
  G.pk = G.pk.filter(p => !(p.type === 'fig' && (SV.fig[lv] >> p.i) & 1));
  G.E = L.en.map(e => Object.assign({ st: 'wait' }, e));
  const st = fromCp && L.cart ? { x: L.cart.x + 40, y: L.cart.y } : L.start;
  if (fromCp && L.cart) { G.cp = { x: L.cart.x + 40, y: L.cart.y }; G.cartMet = true; G.pk = G.pk.filter(p => p.type === 'fig' || p.x > L.cart.x); G.E = G.E.filter(e => e.x > L.cart.x + 120); }
  P = { x: st.x, y: st.y - 2, vx: 0, vy: 0, on: false, face: 1, hp: SV.maxhp, inv: 1, anim: 0, crouch: false, climb: null, shootT: 0, fireCd: 0, energy: 100, ammo: Math.max(SV.ammo, L.weapon === 'gom' ? 12 : 0), hurtT: 0, landT: 0, coyote: 0, ground: null, dead: 0, safe: { x: st.x, y: st.y }, slipV: 0, win: 0 };
  BI = { x: st.x - 40, y: st.y, vy: 0, on: true, face: 1, trail: [], cd: 0, throwT: 0, scare: 0, giftT: 6, anim: 0 };
  G.cx = clamp(P.x - W * 0.4, 0, Math.max(0, L.w - W)); G.cy = L.vertical ? clamp(P.y - H * 0.65, 0, L.h - H) : 0;
  SV.resume = { lv, cp: !!fromCp }; save();
  hideAll(); $('mute').classList.add('hidden');
  playMusic(L.music);
  introLines(lv, fromCp); checkRotate();
}
function introLines(lv, cp) {
  if (cp) { say('tito', '¡Acá estoy, nena! Seguí que vas bien.'); return; }
  const L = [
    [['bichi', '¡Saltá entre los vagones! Si caés a las vías, perdés un corazón.'], ['chispa', 'Y con el desmutador los bichos vuelven a su tamaño. Nadie sale lastimado.']],
    [['chispa', 'Qué oscuro… Quedate cerca de los faroles, Bichi.'], ['bichi', 'A las orugas tirales agachada: deslizá para abajo.'], ['bichi', 'Y si tocás BICHI, les tiro un carozo yo.']],
    [['chispa', 'Sin el desmutador… Bueno, la gomera de Don Tito.'], ['bichi', '¡Yo te junto carozos! Y ojo con las acequias.']],
    [['bichi', '¡Hay que subir hasta el monumento!'], ['chispa', 'Un escalón a la vez. Si me caigo, vuelvo a subir.']],
    [['tito', 'Cuidado con las piletas calientes. Los géiseres te tiran para arriba.'], ['chispa', '¡Ese escarabajo tiene el desmutador en la panza!']],
    [['ozan', 'Ya reparé el desmutador. Achicala, Chispa. Sin lastimarla.'], ['chispa', 'El hielo resbala. Despacito.']],
  ][lv];
  L.forEach(([w, t]) => say(w, t, 3));
}

/* ---------- Jugadora ---------- */
function onLadderNear() { if (!G || !P) return false; return G.L.lad.some(l => Math.abs(P.x - l.x) < 18 && P.y > l.top - 4 && P.y - 20 < l.bot); }
function hurt(src) {
  if (P.inv > 0 || P.win || G.clear) return;
  P.hp--; P.inv = 1.6; P.hurtT = 0.45; P.climb = null; P.vy = -360; P.vx = (src != null ? Math.sign(P.x - src) || -P.face : -P.face) * 210; P.on = false; P.ground = null;
  SFX.hurt(); G.shake = 0.25; BI.scare = 0.6; vibe(60);
  if (P.hp <= 0) { P.dead = 1.2; P.inv = 9; stopMusic(); }
  else if (Math.random() < 0.5) say('bichi', pick(['¡Ay! ¡Cuidado, Chispa!', '¡Esos bichos pican!', '¡Arriba, Chispa!']), 1.8);
}
function fall(type) {
  if (P.dead || G.clear) return;
  if (type === 'agua' || type === 'pileta') { SFX.splash(); puff(P.x, P.y, 14, type === 'agua' ? '#6fd3ff' : '#ffffff', 160, 0.8, 5); }
  P.inv = 0; hurt(); if (P.hp <= 0) return;
  P.x = P.safe.x; P.y = P.safe.y - 2; P.vx = 0; P.vy = 0; P.inv = 1.8; P.on = false;
  BI.x = P.x - 30; BI.y = P.y - 10;
  say('bichi', type === 'agua' ? '¡Te mojaste toda! Saltá con más carrera.' : type === 'pileta' ? '¡Quema! Mejor por arriba.' : '¡Uy! Volvemos acá.', 2);
}
function vibe(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
function shoot() {
  const L = G.L, gom = L.weapon === 'gom';
  if (P.fireCd > 0 || P.climb || P.hurtT > 0) return;
  const hy = P.y - (P.crouch ? 20 : 39), hx = P.x + P.face * (P.crouch ? 30 : 28);
  if (gom) {
    if (P.ammo <= 0) { SFX.empty(); P.fireCd = 0.35; if (!G.saidAmmo || G.t - G.saidAmmo > 6) { G.saidAmmo = G.t; say('bichi', '¡No hay carozos! Juntá los que ves por ahí.', 2); } return; }
    P.ammo--; P.fireCd = 0.34; SFX.sling();
    G.PS.push({ kind: 'pit', x: hx, y: hy, vx: P.face * 440 + P.vx * 0.3, vy: -70, g: 650, life: 1.4, rot: 0, dmg: 1 });
  } else {
    if (P.energy < 12) { SFX.empty(); P.fireCd = 0.3; return; }
    P.energy -= 12; P.fireCd = 0.26; SFX.beam();
    G.PS.push({ kind: 'beam', x: hx, y: hy, vx: P.face * 540, vy: 0, g: 0, life: 0.7, dmg: 2 });
  }
  P.shootT = 0.35;
}
function updatePlayer(dt) {
  const L = G.L;
  if (P.dead) { P.dead -= dt; P.vy += GRAV * dt * 0.5; if (P.dead <= 0) gameOver(); return; }
  if (P.win) { P.vx = 0; P.anim += dt * 4; return; }
  P.inv -= dt; P.hurtT -= dt; P.fireCd -= dt; P.shootT -= dt; P.landT -= dt;
  if (L.weapon === 'des') P.energy = Math.min(100, P.energy + 16 * dt);
  const mv = IN.r - IN.l;
  // escaleras
  if (!P.climb && (IN.u || (IN.d && !P.on)) && P.hurtT <= 0) { const l = L.lad.find(l => Math.abs(P.x - l.x) < 18 && P.y > l.top - 4 && P.y - 20 < l.bot && !(IN.u && P.y <= l.top + 2)); if (l) { P.climb = l; P.vx = 0; P.vy = 0; } }
  if (!P.climb && IN.d && P.on) { const l = L.lad.find(l => Math.abs(P.x - l.x) < 18 && Math.abs(P.y - l.top) < 6); if (l) { P.climb = l; P.y += 6; } }
  if (P.climb) {
    const l = P.climb; P.x = lerp(P.x, l.x, Math.min(1, dt * 12)); const v = (IN.d - IN.u) * 120; P.y += v * dt; if (v) P.anim += dt * 7;
    if (P.y < l.top) { P.y = l.top; P.climb = null; P.on = true; }
    else if (P.y > l.bot) { P.y = l.bot; P.climb = null; }
    if (jumpBuf > 0) { jumpBuf = 0; P.climb = null; P.vy = -JV * 0.75; P.vx = mv * SPD; SFX.jump(); }
    if (mv && P.y > l.bot - 4) P.climb = null;
    if (IN.f) shoot();
    return;
  }
  // agacharse
  const wantCrouch = IN.d && P.on;
  const ceil = tunnelCeil(P.x);
  P.crouch = wantCrouch || (P.on && ceil != null && P.y - HH < ceil);
  const hh = P.crouch ? HC : HH;
  // horizontal (en hielo o piedra mojada resbala)
  const ice = P.ground && (P.ground.slip || (G.L.ice && P.ground.ground) || P.ground.key === 'ice' || P.ground.key === 'wet');
  const target = mv * (P.crouch ? SPD * 0.4 : SPD);
  const acc = P.hurtT > 0 ? 2 : P.on ? (ice ? 2.2 : 14) : 7;
  P.vx += (target - P.vx) * Math.min(1, dt * acc);
  if (mv && P.hurtT <= 0) P.face = mv;
  // salto
  P.coyote = P.on ? 0.1 : P.coyote - dt; jumpBuf -= dt;
  if (jumpBuf > 0 && P.coyote > 0 && !P.crouch && P.hurtT <= 0) { P.vy = -JV; P.on = false; P.coyote = 0; jumpBuf = 0; P.ground = null; SFX.jump(); }
  if (!IN.j && P.vy < -250 && !P.spring) P.vy = -250;
  // plataforma que se mueve
  if (P.on && P.ground && P.ground.mv) { P.x += P.ground.dx || 0; P.y += P.ground.dy || 0; }
  // paredes
  let nx = P.x + P.vx * dt;
  const edge = nx + Math.sign(P.vx || P.face) * HW;
  if (P.vx && wallAt(edge, P.y, P.y - hh)) { nx = P.x; P.vx = 0; }
  if (G.lock && L.arena) nx = clamp(nx, L.arena.x0 + HW, L.arena.x1 - HW);
  P.x = clamp(nx, HW, L.w - HW);
  // vertical
  P.vy = Math.min(950, P.vy + GRAV * dt);
  const ny = P.y + P.vy * dt;
  if (P.vy >= 0) {
    const q = feetSurface(P.x, P.y - (P.on ? 16 : 3), ny + (P.on ? 20 : 1));
    if (q) { if (!P.on && P.vy > 300) { SFX.land(); P.landT = 0.12; puff(P.x, q.s, 4, 'rgba(255,255,255,.6)', 50, 0.3, 3); } P.y = q.s; P.vy = 0; P.on = true; P.ground = q.o; P.spring = 0; }
    else { P.y = ny; P.on = false; P.ground = null; }
  } else {
    P.y = ny; P.on = false; P.ground = null;
    if (ceil != null && P.y - HH < ceil && tunnelOver(P.x)) { P.y = ceil + HH; P.vy = 0; }
  }
  // lugar seguro para volver si te caés
  if (P.on && P.ground && !P.ground.mv && !P.ground.dead && surfaceAt(P.x - 26, P.y - 6, P.y + 6) && surfaceAt(P.x + 26, P.y - 6, P.y + 6) && !L.haz.some(h => Math.abs(h.x + h.w / 2 - P.x) < h.w / 2 + 50)) { P.safe.x = P.x; P.safe.y = P.y; }
  // caídas y peligros
  if (P.y > (L.fallY || L.h + 40)) fall('pozo');
  for (const h of L.haz) {
    if (P.x > h.x && P.x < h.x + h.w && P.y > h.y && P.y - hh < h.y + h.h) {
      if (h.type === 'cristal') { hurt(h.x + h.w / 2); P.vy = -420; } else if (P.y > h.y + 8) fall(h.type);
    }
  }
  if (IN.f) shoot();
  P.anim += Math.abs(P.vx) * dt / 24;
}

/* ---------- Túneles del Trasandino ---------- */
const TUN_S = 0.86, TUN_CEIL = 145;
function tunRock() { if (tunRock.v) return tunRock.v; const b = HM.tunel.b, r = b.slice(Math.floor(b.length * 0.4), Math.floor(b.length * 0.8)).sort((a, c) => a - c); return tunRock.v = r[r.length >> 1]; }
function tunTop() { return TUN_CEIL - tunRock() * TUN_S; }
function tunnelOver(x) { return G.tunnels.some(t => t.on === 1 && x > t.x + 20 && x < t.x + SIZES.tunel[0] * TUN_S); }
function tunnelCeil(x) {
  for (const t of G.tunnels) {
    if (t.on !== 1) continue; const w = SIZES.tunel[0] * TUN_S; if (x < t.x + 20 || x > t.x + w) continue;
    const c = clamp(Math.floor((x - t.x) / (TUN_S * HM.tunel.s)), 0, HM.tunel.b.length - 1);
    return tunTop() + Math.min(HM.tunel.b[c], tunRock()) * TUN_S;
  }
  return null;
}
function updateTunnels(dt) {
  G.tunnelIn = Math.max(0, G.tunnelIn - dt * 2);
  for (const t of G.tunnels) {
    if (!t.on && P.x > t.trig && !G.lock) { t.on = 1; t.x = G.cx + W + 260; SFX.tunnel(); say('bichi', '¡TÚNEL! ¡Agachate en el techo!', 2.4); G.words.push({ x: G.cx + W - 90, y: 110, w: '¡TÚNEL!', t: 0, col: '#ff8a1f', fixed: 1 }); }
    if (t.on !== 1) continue;
    t.x -= 250 * dt;
    if (t.x + SIZES.tunel[0] * TUN_S < G.cx - 60) { t.on = 2; continue; }
    const c = tunnelCeil(P.x);
    if (c != null) {
      G.tunnelIn = Math.min(1, G.tunnelIn + dt * 5);
      const head = P.y - (P.crouch && IN.d ? HC : HH);
      if (head < c) { if (!t.hit || P.y - HC < c) { t.hit = 1; hurt(P.x + 30); } }
    }
  }
}

/* ---------- Bichos: comportamiento ---------- */
function eBox(e) { const d = EN[e.type], k = e.st === 'shrink' || e.st === 'gone' ? e.k : 1; return { x: e.x, y: (e.fly ? e.cy : e.y - d.h / 2) , w: d.w * k, h: d.h * k }; }
function activate(e) {
  const d = EN[e.type]; Object.assign(e, { st: 'live', hp: d.hp, t: rnd(0, 3), face: -1, vx: 0, vy: 0, hx: e.x, hy: e.y, fly: d.fly, k: 1, stun: 0, f: 0, mode: 0, mt: rnd(0.5, 2) });
  if (d.fly) { e.cy = e.y; e.hy = e.y; }
  else { const q = surfaceAt(e.x, e.y - 60, e.y + 400); e.y = q ? q.s : e.y; e.on = !!q; }
}
function walkStep(e, sp, dt) {
  const nx = e.x + e.face * sp * dt, ahead = nx + e.face * EN[e.type].w * 0.45;
  const q = surfaceAt(ahead, e.y - 14, e.y + 14);
  if (!q || wallAt(ahead, e.y, e.y - 20) || (G.lock && G.L.arena && (ahead < G.L.arena.x0 || ahead > G.L.arena.x1))) { e.face *= -1; return false; }
  e.x = nx; const q2 = surfaceAt(e.x, e.y - 14, e.y + 14); if (q2) { e.y = q2.s; e.gnd = q2.o; } return true;
}
function updateEnemy(e, dt) {
  const d = EN[e.type];
  if (e.st === 'wait') { if (Math.abs(e.x - P.x) < W * 0.75 + 60 && (!G.L.vertical || Math.abs(e.y - P.y) < H)) activate(e); else return; }
  e.t += dt;
  if (e.st === 'shrink') { e.k = Math.max(0.22, e.k - dt * 1.8); if (e.k <= 0.22) { e.st = 'gone'; e.gt = 0; } return; }
  if (e.st === 'gone') { e.gt += dt; if (e.fly) { e.cy -= 70 * dt; e.x += Math.sin(e.gt * 9) * 40 * dt + 50 * dt; } else { e.x += 120 * dt * (e.face || 1); } if (e.gt > 1.6) e.dead = 1; return; }
  if (e.stun > 0) { e.stun -= dt; return; }
  const dx = P.x - e.x;
  if (e.gnd && e.gnd.mv && !e.fly) { e.x += e.gnd.dx || 0; e.y += e.gnd.dy || 0; }
  switch (e.type) {
    case 'mosquito': {
      e.f = Math.floor(e.t * 14) % 3;
      if (e.mode === 1) { e.x += e.vx * dt; e.cy += e.vy * dt; e.f = 3; e.mt -= dt; if (e.mt <= 0) { e.mode = 2; } break; }
      const ty = e.mode === 2 ? e.hy : e.hy + Math.sin(e.t * 2.4) * 16;
      e.cy += (ty - e.cy) * Math.min(1, dt * 2);
      e.x += clamp(dx, -1, 1) * (Math.abs(dx) < 320 ? 45 : 0) * dt; e.face = dx > 0 ? 1 : -1;
      if (e.mode === 2 && Math.abs(e.cy - e.hy) < 8) e.mode = 0;
      e.mt -= dt;
      if (e.mode === 0 && e.mt <= 0 && Math.abs(dx) < 140 && P.y - 30 > e.cy) { const a = Math.atan2(P.y - 30 - e.cy, dx); e.vx = Math.cos(a) * 230; e.vy = Math.sin(a) * 230; e.mode = 1; e.mt = 0.7; }
      if (e.mode === 0 && e.mt <= 0) e.mt = rnd(0.6, 1.4);
      break;
    }
    case 'polilla': {
      e.f = Math.floor(e.t * 10) % 4;
      const tx = e.hx + Math.sin(e.t * 0.9) * 90 + (Math.abs(dx) < 260 ? clamp(dx, -60, 60) : 0), ty = e.hy + Math.sin(e.t * 2.3) * 36;
      e.x += (tx - e.x) * Math.min(1, dt * 1.5); e.cy += (ty - e.cy) * Math.min(1, dt * 2); e.face = dx > 0 ? 1 : -1;
      break;
    }
    case 'avispa': {
      if (e.mode === 1) { e.x += e.vx * dt; e.cy += e.vy * dt; e.f = 3; e.mt -= dt; if (e.mt <= 0) { e.mode = 0; e.mt = rnd(1.8, 2.8); } break; }
      e.f = Math.floor(e.t * 16) % 3; e.face = dx > 0 ? 1 : -1;
      e.x += (e.hx + Math.sin(e.t * 1.3) * 40 - e.x) * Math.min(1, dt * 1.2); e.cy += (e.hy + Math.sin(e.t * 3) * 12 - e.cy) * Math.min(1, dt * 2);
      e.mt -= dt;
      if (e.mt <= 0 && Math.hypot(dx, P.y - 30 - e.cy) < 270) { const a = Math.atan2(P.y - 30 - e.cy, dx); e.vx = Math.cos(a) * 300; e.vy = Math.sin(a) * 300; e.mode = 1; e.mt = 0.55; }
      else if (e.mt <= 0) e.mt = 0.8;
      if (e.mode === 0) { e.hx += (e.x - e.hx) * dt * 0.3; }
      break;
    }
    case 'langosta': {
      if (!e.on) { e.vy += GRAV * 0.8 * dt; e.x += e.vx * dt; const ny = e.y + e.vy * dt; const q = e.vy > 0 ? surfaceAt(e.x, e.y - 2, ny + 1) : null; if (q) { e.y = q.s; e.on = true; e.gnd = q.o; e.vx = 0; e.f = 3; e.mt = rnd(0.9, 1.6); } else e.y = ny; if (e.vy < 0) e.f = 2; if (e.y > (G.L.fallY || G.L.h + 60)) e.dead = 1; break; }
      e.mt -= dt; e.f = e.mt < 0.25 ? 1 : (e.f === 3 && e.mt > 0.9 ? 3 : 0); e.face = dx > 0 ? 1 : -1;
      if (e.mt <= 0 && Math.abs(dx) < 380) { e.vy = -520; e.vx = e.face * rnd(90, 150); e.on = false; e.gnd = null; }
      else if (e.mt <= 0) e.mt = 1;
      break;
    }
    case 'escarabajo': {
      const charge = e.mode === 1;
      e.f = charge ? 3 : Math.floor(e.t * 6) % 3;
      if (!walkStep(e, charge ? 170 : 45, dt) && charge) { e.mode = 0; e.mt = 2; }
      e.mt -= dt;
      if (!charge && e.mt <= 0 && Math.abs(dx) < 240 && Math.abs(P.y - e.y) < 30 && Math.sign(dx) === e.face) { e.mode = 1; e.mt = 1.4; }
      if (charge && e.mt <= 0) { e.mode = 0; e.mt = 1.8; }
      break;
    }
    case 'oruga': { e.f = Math.floor(e.t * 5) % 4; walkStep(e, 28, dt); break; }
  }
  // contacto
  if (P.inv <= 0 && !P.dead) { const b = eBox(e); if (Math.abs(P.x - b.x) < b.w / 2 + HW - 4 && P.y > b.y - b.h / 2 + 4 && P.y - (P.crouch ? HC : HH) < b.y + b.h / 2 - 4) { if (P.vy > 120 && P.y < b.y) { P.vy = -380; P.spring = 1; } hurt(e.x); } }
}
function damageEnemy(e, dmg, stun) {
  e.hp -= dmg; e.flash = 0.12; SFX.hit();
  if (stun) e.stun = Math.max(e.stun, stun);
  if (e.hp <= 0) {
    e.st = 'shrink'; e.k = 1; SFX.shrink(); const b = eBox(e); puff(b.x, b.y, 12, '#d78bff', 120, 0.6, 4); word(b.x, b.y - 26, pick(['¡ZAP!', '¡PIUM!', '¡FIUU!', '¡ACHICADO!']), '#d78bff');
    G.pk.push({ type: 'coin', x: b.x, y: b.y, vy: -220, drop: 1 });
    if (G.L.weapon === 'gom' && Math.random() < 0.45) G.pk.push({ type: 'pit', x: b.x + 12, y: b.y, vy: -260, drop: 1 });
  }
}

/* ---------- Jefes ---------- */
function startBoss() {
  const L = G.L, a = L.arena, d = BOSS[a.boss];
  G.lock = true;
  const b = { type: a.boss, x: a.bx, y: a.by, hp: d.hp, max: d.hp, t: 0, st: 'intro', f: 0, face: -1, vx: 0, vy: 0, flash: 0, k: 1, mt: 1.6, n: 0, d };
  if (!d.fly) { const q = surfaceAt(b.x, 0, 1000); b.y = q ? q.s : L.gy; }
  b.hx = b.x; b.hy = b.y;
  G.boss = b; playMusic('boss');
  const lines = {
    langosta: [['chispa', '¡Una langosta con gorra de maquinista!'], ['bichi', 'Salta fuerte. ¡Movete cuando se agacha!']],
    polilla: [['bichi', '¡La Polilla de la Cava! Ojo con el polvo.'], ['princesa', 'Jijiji… Muy lindo tu juguetito, pilotita.']],
    libelula: [['chispa', 'Una libélula que gotea… ¡Agua de acequia!'], ['bichi', 'Las gotas caen derecho. ¡Esquivalas!']],
    avispon: [['bichi', '¡El Avispón del Cerro! Cuando brilla, llama a las avispas.'], ['chispa', 'Gomera lista.']],
    escarabajo: [['chispa', '¡Ahí brilla el desmutador, en la panza!'], ['tito', '¡Subite a las pasarelas cuando embiste!']],
    princesa: [['princesa', '¡Mi enjambre gobernará Mendoza!'], ['chispa', 'Nadie va a lastimarte. Solo vas a volver a tu tamaño.']],
  }[a.boss];
  lines.forEach(([w, t]) => say(w, t, 2.6));
}
function bossBox(b) { const d = b.d, m = STRIPS[d.strip], w = m.fw * d.s * 0.55 * b.k; if (b.type === 'escarabajo') { const h = m.fh * d.s * 0.45 * b.k; return { x: b.x, y: b.y - h / 2, w, h }; } const h = m.fh * d.s * 0.62 * b.k; return { x: b.x, y: d.fly ? b.y : b.y - m.fh * d.s * 0.5 * b.k, w, h }; }
function eshot(x, y, vx, vy, kind, o = {}) { G.ES.push(Object.assign({ x, y, vx, vy, g: 0, r: 8, kind, life: 4 }, o)); }
function arenaFloorAt(x) { const q = surfaceAt(x, 0, 1200); return q ? q.s : G.L.gy; }
function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  const L = G.L, a = L.arena; b.t += dt; b.flash -= dt;
  if (b.st === 'shrink') { b.k = Math.max(0.15, b.k - dt * 0.9); if (b.k <= 0.15) { b.st = 'gone'; b.gt = 0; } if (Math.random() < 0.5) puff(b.x + rnd(-40, 40), b.y - 60 * b.k, 2, pick(['#d78bff', '#fff', '#ffd21f']), 100, 0.6, 4); return; }
  if (b.st === 'gone') { b.gt += dt; b.y -= (b.d.fly ? 60 : 0) * dt; b.x += 90 * dt; if (b.gt > 1.2 && !G.clear) levelClear(); return; }
  const dx = P.x - b.x; b.face = dx > 0 ? 1 : -1;
  b.mt -= dt;
  switch (b.type) {
    case 'langosta': {
      if (b.st === 'intro' || b.st === 'idle') { b.f = 0; if (b.mt <= 0) { b.n++; if (b.n % 3 === 0) { b.st = 'throw'; b.mt = 0.9; } else { b.st = 'crouch'; b.mt = 0.45; } } }
      else if (b.st === 'crouch') { b.f = 1; if (b.mt <= 0) { b.st = 'jump'; const tx = clamp(P.x, a.x0 + 60, a.x1 - 60); b.vx = (tx - b.x) / 0.9; b.vy = -620; } }
      else if (b.st === 'jump') { b.f = 2; b.vy += GRAV * 0.75 * dt; b.x = clamp(b.x + b.vx * dt, a.x0 + 50, a.x1 - 50); b.y += b.vy * dt; const fl = arenaFloorAt(b.x); if (b.vy > 0 && b.y >= fl) { b.y = fl; b.st = 'idle'; b.mt = 1.1; G.shake = 0.35; SFX.boom(); puff(b.x, b.y, 14, '#c8b9a0', 140, 0.6, 5); for (const s of [-1, 1]) eshot(b.x + s * 40, b.y - 20, s * 170, -380, 'coal', { g: 900 }); } }
      else if (b.st === 'throw') { b.f = 0; if (b.mt <= 0.5 && !b.thrown) { b.thrown = 1; for (let i = 0; i < 3; i++) { const vx = (dx / 0.9) * (0.75 + i * 0.25); eshot(b.x, b.y - 90, clamp(vx, -420, 420), -420, 'coal', { g: 900 }); } SFX.boom(); } if (b.mt <= 0) { b.thrown = 0; b.st = 'idle'; b.mt = 0.9; } }
      break;
    }
    case 'polilla': {
      if (b.st === 'swoop') { b.f = 2; b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 520 * dt; if (b.mt <= 0) { b.st = 'fly'; b.mt = 2.5; } break; }
      b.f = b.st === 'dust' ? 1 : Math.floor(b.t * 6) % 2 ? 0 : 2;
      const cx = (a.x0 + a.x1) / 2, tx = cx + Math.sin(b.t * 0.7) * (a.x1 - a.x0) * 0.33, ty = 170 + Math.sin(b.t * 1.4) * 40;
      b.x += (tx - b.x) * Math.min(1, dt * 1.4); b.y += (ty - b.y) * Math.min(1, dt * 1.6);
      if (b.mt <= 0) {
        b.n++;
        if (b.n % 3 === 0) { b.st = 'swoop'; b.vx = dx * 0.9; b.vy = 300; b.mt = 1.1; }
        else { b.st = 'dust'; b.mt = 2.6; for (let i = 0; i < 5; i++) eshot(b.x - 30 + i * 15, b.y + 10, rnd(-60, 60), rnd(-20, 40), 'dust', { home: 1, life: 5, r: 14, sp: 70 + i * 6 }); SFX.geyser(); }
      }
      if (b.st === 'dust' && b.mt < 1.6) b.st = 'fly';
      break;
    }
    case 'libelula': {
      if (b.st === 'intro' || b.st === 'hover') { b.f = 0; b.y += (120 - b.y) * Math.min(1, dt * 2); if (b.mt <= 0) { b.st = 'pass'; b.dir = b.x > (a.x0 + a.x1) / 2 ? -1 : 1; b.mt = 3; b.drop = 0; } }
      else if (b.st === 'pass') {
        b.f = 1; b.face = b.dir; b.x += b.dir * 210 * dt; b.y = 110 + Math.sin(b.t * 4) * 10; b.drop -= dt;
        if (b.drop <= 0) { b.drop = b.hp < b.max / 2 ? 0.28 : 0.4; eshot(b.x - b.dir * 60, b.y + 30, 0, 40, 'drop', { g: 700, r: 7 }); }
        if ((b.dir > 0 && b.x > a.x1 - 70) || (b.dir < 0 && b.x < a.x0 + 70)) { b.st = 'hover'; b.mt = 1.2; b.n++; if (b.n % 2 === 0) { b.st = 'dash'; b.mt = 0.9; b.ty = P.y - 30; } }
      }
      else if (b.st === 'dash') { b.f = 2; b.y += (b.ty - b.y) * Math.min(1, dt * 3); if (b.mt < 0.5) b.x += b.face * 360 * dt; b.x = clamp(b.x, a.x0 + 60, a.x1 - 60); if (b.mt <= 0) { b.st = 'hover'; b.mt = 1; } }
      break;
    }
    case 'avispon': {
      if (b.st === 'intro' || b.st === 'hover') {
        b.f = 0; const tx = clamp(P.x + (b.x > P.x ? 180 : -180), a.x0 + 70, a.x1 - 70), ty = 160 + Math.sin(b.t * 2) * 30;
        b.x += (tx - b.x) * Math.min(1, dt * 1.2); b.y += (ty - b.y) * Math.min(1, dt * 1.5);
        if (b.mt <= 0) { b.n++; if (b.n % 3 === 0 && G.E.filter(e => e.st === 'live').length < 3) { b.st = 'call'; b.mt = 1.1; } else { b.st = 'aim'; b.mt = 0.6; } }
      }
      else if (b.st === 'aim') { b.f = 1; b.y += (P.y - 34 - b.y) * Math.min(1, dt * 3); if (b.mt <= 0) { b.st = 'dash'; b.vx = b.face * 380; b.mt = 1.2; } }
      else if (b.st === 'dash') { b.f = 1; b.x += b.vx * dt; if (b.x < a.x0 + 60 || b.x > a.x1 - 60) { b.x = clamp(b.x, a.x0 + 60, a.x1 - 60); b.st = 'hover'; b.mt = 1.4; } if (b.mt <= 0) { b.st = 'hover'; b.mt = 1.2; } }
      else if (b.st === 'call') { b.f = 2; if (b.mt <= 0.5 && !b.called) { b.called = 1; for (const s of [-1, 1]) { const e = { type: 'avispa', x: b.x + s * 80, y: b.y - 30 }; activate(e); G.E.push(e); } SFX.bichi(); } if (b.mt <= 0) { b.called = 0; b.st = 'hover'; b.mt = 1.6; } }
      break;
    }
    case 'escarabajo': {
      if (b.st === 'intro' || b.st === 'walk') { b.f = 0; b.x += b.face * 40 * dt; b.y = arenaFloorAt(b.x); if (b.mt <= 0) { b.n++; if (b.n % 2) { b.st = 'warn'; b.mt = 0.7; b.dir = b.face; } else { b.st = 'spit'; b.mt = 1.2; } } }
      else if (b.st === 'warn') { b.f = 1; b.x += Math.sin(b.t * 40) * 1.5; if (b.mt <= 0) { b.st = 'charge'; b.mt = 3; } }
      else if (b.st === 'charge') { b.f = 1; b.face = b.dir; b.x += b.dir * 300 * dt; b.y = L.gy; if (Math.random() < 0.4) puff(b.x - b.dir * 60, b.y, 1, '#e0c0a0', 60, 0.5, 5); if (b.x < a.x0 + 80 || b.x > a.x1 - 80) { b.x = clamp(b.x, a.x0 + 80, a.x1 - 80); b.st = 'walk'; b.mt = 1.6; G.shake = 0.4; SFX.boom(); } }
      else if (b.st === 'spit') { b.f = 2; if (b.mt <= 0.6 && !b.spat) { b.spat = 1; for (let i = 0; i < 3; i++) eshot(b.x + b.face * 40, b.y - 110, b.face * (120 + i * 90), -420, 'lava', { g: 800, r: 9 }); SFX.boom(); } if (b.mt <= 0) { b.spat = 0; b.st = 'walk'; b.mt = 1.6; } }
      break;
    }
    case 'princesa': {
      const angry = b.hp < b.max / 2;
      if (b.st === 'intro' || b.st === 'hover') {
        b.f = angry && Math.floor(b.t * 2) % 3 === 0 ? 2 : 0;
        const tx = (a.x0 + a.x1) / 2 + Math.sin(b.t * 0.8) * (a.x1 - a.x0) * 0.32, ty = 150 + Math.sin(b.t * 1.7) * 40;
        b.x += (tx - b.x) * Math.min(1, dt * 1.3); b.y += (ty - b.y) * Math.min(1, dt * 1.5);
        if (b.mt <= 0) { b.n++; if (angry && b.n % 3 === 0 && G.E.filter(e => e.st === 'live').length < 3) { b.st = 'call'; b.mt = 1.1; } else { b.st = 'shard'; b.mt = 0.9; } }
      }
      else if (b.st === 'shard') { b.f = 1; if (b.mt <= 0.5 && !b.thrown) { b.thrown = 1; const ang = Math.atan2(P.y - 40 - (b.y - 20), dx), n = angry ? 5 : 3; for (let i = 0; i < n; i++) { const aa = ang + (i - (n - 1) / 2) * 0.22; eshot(b.x, b.y - 20, Math.cos(aa) * 230, Math.sin(aa) * 230, 'crystal', { r: 8 }); } SFX.beam(); } if (b.mt <= 0) { b.thrown = 0; b.st = 'hover'; b.mt = angry ? 1.1 : 1.6; } }
      else if (b.st === 'call') { b.f = 2; if (b.mt <= 0.5 && !b.called) { b.called = 1; for (const s of [-1, 1]) { const e = { type: 'mosquito', x: b.x + s * 90, y: b.y }; activate(e); G.E.push(e); } } if (b.mt <= 0) { b.called = 0; b.st = 'hover'; b.mt = 1.4; } }
      break;
    }
  }
  if (b.st !== 'intro' && P.inv <= 0) { const bb = bossBox(b); if (Math.abs(P.x - bb.x) < bb.w / 2 + HW - 6 && P.y > bb.y - bb.h / 2 + 4 && P.y - (P.crouch ? HC : HH) < bb.y + bb.h / 2) hurt(b.x); }
  if (b.st === 'intro' && b.mt <= 0) { b.st = { langosta: 'idle', polilla: 'fly', libelula: 'hover', avispon: 'hover', escarabajo: 'walk', princesa: 'hover' }[b.type]; b.mt = 1; }
}
function damageBoss(dmg) {
  const b = G.boss; if (!b || b.st === 'shrink' || b.st === 'gone' || b.st === 'intro') return;
  b.hp -= dmg; b.flash = 0.12; SFX.hit();
  if (b.hp <= 0) {
    b.hp = 0; b.st = 'shrink'; G.ES = []; SFX.shrink(); setTimeout(() => SFX.win(), 400);
    G.E.forEach(e => { if (e.st === 'live') { e.st = 'shrink'; e.k = 1; } });
    word(b.x, b.y - 120, '¡ACHICADO!', '#d78bff'); G.shake = 0.5; stopMusic();
  }
}

/* ---------- Disparos ---------- */
function updateShots(dt) {
  for (const s of G.PS) {
    s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot = (s.rot || 0) + dt * 14;
    if (s.kind === 'beam' && Math.random() < 0.6) G.fx.push({ x: s.x, y: s.y + rnd(-3, 3), vx: -s.vx * 0.05, vy: rnd(-20, 20), t: 0, life: 0.25, col: pick(['#d78bff', '#fff', '#b04dff']), sz: 2.5 });
    if (s.x < G.cx - 40 || s.x > G.cx + W + 40 || s.y > G.cy + H + 40) s.life = 0;
    if (surfaceAt(s.x, s.y - 2, s.y + 6) && s.kind === 'pit') { s.life = 0; puff(s.x, s.y, 4, '#a8693a', 60, 0.3, 3); }
    if (s.life <= 0) continue;
    for (const e of G.E) {
      if (e.st !== 'live') continue; const b = eBox(e);
      if (Math.abs(s.x - b.x) < b.w / 2 + 6 && Math.abs(s.y - b.y) < b.h / 2 + 11) { damageEnemy(e, s.dmg, s.stun); s.life = 0; puff(s.x, s.y, 5, s.kind === 'beam' ? '#d78bff' : '#a8693a', 80, 0.3, 3); break; }
    }
    const B = G.boss;
    if (s.life > 0 && B && B.st !== 'shrink' && B.st !== 'gone') { const bb = bossBox(B); if (Math.abs(s.x - bb.x) < bb.w / 2 && Math.abs(s.y - bb.y) < bb.h / 2) { damageBoss(s.boss || s.dmg); s.life = 0; puff(s.x, s.y, 6, s.kind === 'beam' ? '#d78bff' : '#a8693a', 90, 0.35, 3); } }
  }
  G.PS = G.PS.filter(s => s.life > 0);
  for (const s of G.ES) {
    s.life -= dt;
    if (s.home) { const a = Math.atan2(P.y - 34 - s.y, P.x - s.x); s.vx += (Math.cos(a) * s.sp - s.vx) * dt * 0.9; s.vy += (Math.sin(a) * s.sp - s.vy) * dt * 0.9; }
    s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.g && surfaceAt(s.x, s.y - 4, s.y + 8)) { s.life = 0; puff(s.x, s.y, 6, s.kind === 'drop' ? '#7fdcff' : s.kind === 'lava' ? '#ff8a1f' : '#555', 80, 0.4, 3); }
    if (s.y > G.cy + H + 60) s.life = 0;
    if (s.life > 0 && P.inv <= 0 && Math.abs(s.x - P.x) < s.r + HW && s.y > P.y - (P.crouch ? HC : HH) - s.r && s.y < P.y + s.r) { s.life = 0; hurt(s.x); }
  }
  G.ES = G.ES.filter(s => s.life > 0);
}

/* ---------- Cosas para juntar ---------- */
const PK_IMG = { pit: 'objetos-juntar-0', bat: 'objetos-juntar-1', heart: 'objetos-juntar-2', fig: 'objetos-juntar-3' };
function updatePickups(dt) {
  for (const p of G.pk) {
    if (p.got) continue;
    if (p.drop) { p.vy += 900 * dt; const ny = p.y + p.vy * dt; const q = p.vy > 0 ? surfaceAt(p.x, p.y - 2, ny + 8) : null; if (q) { p.y = q.s - 8; p.vy = 0; p.drop = 0; } else p.y = ny; if (p.y > G.cy + H + 80) p.got = 1; }
    const cy = P.y - (P.crouch ? 18 : 30);
    if (Math.abs(p.x - P.x) < 22 && Math.abs(p.y - cy) < 36 && !P.dead) {
      p.got = 1;
      if (p.type === 'coin') { G.coins++; SV.coins++; SFX.coin(); }
      else if (p.type === 'pit') { P.ammo = Math.min(40, P.ammo + 4); SFX.pick(); word(p.x, p.y - 16, '+4 CAROZOS'); }
      else if (p.type === 'bat') { P.energy = 100; P.ammo = Math.min(40, P.ammo + 2); SFX.pick(); word(p.x, p.y - 16, G.L.weapon === 'des' ? '¡ENERGÍA!' : '+2 CAROZOS'); }
      else if (p.type === 'heart') { P.hp = Math.min(SV.maxhp, P.hp + 1); SFX.pick(); word(p.x, p.y - 16, '+1 ❤'); }
      else if (p.type === 'fig') { SV.fig[G.lv] |= 1 << p.i; G.figs++; save(); SFX.fig(); word(p.x, p.y - 20, '¡FIGURITA!', '#ff8ad8'); puff(p.x, p.y, 16, '#ffd21f', 140, 0.7, 4); say('bichi', pick(['¡Una figurita para el álbum!', '¡Esa no la tenía!', '¡Pegala en el álbum!']), 2); }
    }
  }
  G.pk = G.pk.filter(p => !p.got);
}

/* ---------- Bichi ---------- */
function updateBichi(dt) {
  BI.trail.push([P.x, P.y, P.face]); if (BI.trail.length > 22) BI.trail.shift();
  BI.cd -= dt * (G.bichiFast ? 2 : 1); BI.scare -= dt; BI.anim += dt;
  if (BI.throwT > 0) {
    BI.throwT -= dt;
    if (BI.throwT < 0.32 && !BI.thrown) {
      BI.thrown = 1; const tg = BI.target; SFX.sling();
      if (tg) { const tx = tg.x, ty = tg.y, t = 0.55; G.PS.push({ kind: 'pit', x: BI.x, y: BI.y - 34, vx: (tx - BI.x) / t, vy: (ty - (BI.y - 34)) / t - 0.5 * 700 * t, g: 700, life: 1.2, dmg: 1, boss: 2, stun: 1.4 }); }
    }
    return;
  }
  if (bichiPress) {
    bichiPress = false;
    if (BI.cd <= 0) {
      let best = null, bd = 330;
      for (const e of G.E) { if (e.st !== 'live') continue; const b = eBox(e), d = Math.hypot(b.x - BI.x, b.y - BI.y); if (d < bd) { bd = d; best = { x: b.x, y: b.y }; } }
      if (G.boss && G.boss.st !== 'shrink' && G.boss.st !== 'gone' && G.boss.st !== 'intro') { const bb = bossBox(G.boss), d = Math.hypot(bb.x - BI.x, bb.y - BI.y); if (d < 500 && (!best || d < bd)) best = { x: bb.x, y: bb.y }; }
      if (best) { BI.target = best; BI.throwT = 0.6; BI.thrown = 0; BI.face = best.x > BI.x ? 1 : -1; BI.cd = 6; SFX.bichi(); return; }
      say('bichi', 'No veo ningún bicho cerca.', 1.4);
    } else SFX.empty();
  }
  // regalo: si te quedás sin carozos, Bichi encuentra uno
  if (G.L.weapon === 'gom' && P.ammo < 3) { BI.giftT -= dt; if (BI.giftT <= 0) { BI.giftT = 5; P.ammo++; word(BI.x, BI.y - 40, '+1 CAROZO'); SFX.bichi(); } }
  const tg = BI.trail[0], tx = tg[0] - 34 * tg[2];
  const dist = Math.hypot(tx - BI.x, tg[1] - BI.y);
  if (dist > 320 || BI.y > (G.L.fallY || G.L.h + 40)) { puff(BI.x, BI.y - 20, 8, '#9cff7a', 80, 0.4, 3); BI.x = P.x - 30 * P.face; BI.y = P.y - 20; BI.vy = 0; BI.on = false; puff(BI.x, BI.y - 20, 8, '#9cff7a', 80, 0.4, 3); }
  BI.x += clamp((tx - BI.x) * Math.min(1, dt * 5), -260 * dt, 260 * dt);
  if (BI.on && (Math.abs(tx - BI.x) > 16 || tg[1] < BI.y - 24)) { BI.vy = tg[1] < BI.y - 24 ? -Math.min(760, 260 + (BI.y - tg[1]) * 4.2) : -300; BI.on = false; }
  BI.vy = Math.min(900, BI.vy + GRAV * 0.85 * dt);
  const ny = BI.y + BI.vy * dt;
  if (BI.vy >= 0) { const q = surfaceAt(BI.x, BI.y - (BI.on ? 14 : 2), ny + (BI.on ? 16 : 1)); if (q) { BI.y = q.s; BI.vy = 0; BI.on = true; if (q.o.mv) { BI.x += q.o.dx || 0; } } else { BI.y = ny; BI.on = false; } }
  else { BI.y = ny; BI.on = false; }
  if (Math.abs(tx - BI.x) > 3) BI.face = tx > BI.x ? 1 : -1; else BI.face = P.face;
}

/* ---------- Plataformas móviles, géiseres, cámara ---------- */
function updateWorld(dt) {
  for (const o of G.T) if (o.mv) { const m = o.mv, ph = (G.t / m.per) * TAU + m.ph * TAU, nx = o.bx + Math.sin(ph) * m.ax, ny = o.by + Math.sin(ph) * m.ay; o.dx = nx - o.x; o.dy = ny - o.y; o.x = nx; o.y = ny; }
  for (const g of G.L.gey) {
    g.t += dt; const per = 3.4, ph = g.t % per; g.on = ph > per - 1.1;
    if (g.on && !g.wasOn) { if (Math.abs(g.x - P.x) < W) SFX.geyser(); }
    g.wasOn = g.on;
    if (g.on && Math.abs(P.x - g.x) < 24 && P.y > g.y - 260 && P.y <= g.y + 4) { P.vy = Math.min(P.vy, -960); P.on = false; P.ground = null; P.spring = 1; }
    if (g.on && Math.abs(BI.x - g.x) < 24 && BI.y > g.y - 200) { BI.vy = -800; BI.on = false; }
    if (g.on && Math.random() < 0.9) G.fx.push({ x: g.x + rnd(-10, 10), y: g.y - 10, vx: rnd(-20, 20), vy: rnd(-520, -380), t: 0, life: 0.6, col: 'rgba(255,255,255,.8)', sz: rnd(5, 9) });
  }
  if (G.L.cart) {
    const c = G.L.cart, near = Math.abs(P.x - (c.x + 40)) < 60 && Math.abs(P.y - c.y) < 30;
    if (near && !G.cartMet) { G.cartMet = true; G.cp = { x: c.x + 40, y: c.y }; SV.resume = { lv: G.lv, cp: true }; SV.ammo = P.ammo; save(); say('tito', '¡Pasá, nena! Tengo de todo. Y si te cansás, volvés acá.', 3); word(c.x + 40, c.y - 110, '¡PUESTO!', '#7ef08a'); SFX.pick(); }
    G.nearCart = near && !G.lock && !G.clear && !P.dead;
  }
  const L = G.L;
  if (L.arena && !G.lock && (L.arena.trigY != null ? P.y <= L.arena.trigY && P.on : P.x > L.arena.trig)) startBoss();
  // cámara
  let tx, ty = 0;
  if (G.lock && L.arena && !L.vertical) { const a = L.arena, aw = a.x1 - a.x0; tx = aw <= W ? a.x0 - (W - aw) / 2 : clamp(P.x - W / 2, a.x0, a.x1 - W); }
  else tx = P.x - W * 0.4 + P.face * 30;
  tx = clamp(tx, L.vertical ? Math.min(0, (L.w - W) / 2) : 0, Math.max(0, L.w - W));
  if (L.vertical) { tx = L.w <= W ? (L.w - W) / 2 : clamp(P.x - W / 2, 0, L.w - W); ty = G.lock ? 0 : clamp(P.y - H * 0.62, 0, L.h - H); }
  G.cx += (tx - G.cx) * Math.min(1, dt * (G.lock ? 3 : 6)); G.cy += (ty - G.cy) * Math.min(1, dt * 5);
  if (L.train) G.trainX += 150 * dt;
}
function update(dt) {
  G.t += dt; readInput();
  updateWorld(dt); updatePlayer(dt); if (G.L.train) updateTunnels(dt);
  for (const e of G.E) updateEnemy(e, dt); G.E = G.E.filter(e => !e.dead);
  updateBoss(dt); updateShots(dt); updatePickups(dt); updateBichi(dt);
  for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; } G.fx = G.fx.filter(f => f.t < f.life);
  for (const w of G.words) w.t += dt; G.words = G.words.filter(w => w.t < 0.9);
  if (G.says.length) { G.sayT += dt; if (G.sayT > G.says[0].d) { G.says.shift(); G.sayT = 0; } }
  G.shake = Math.max(0, G.shake - dt);
  $('shopBtn').classList.toggle('hidden', !G.nearCart || G.paused);
  if (G.clear) { G.clear += dt; if (G.clear > 2.6 && !G.winShown) { G.winShown = 1; showWin(); } }
}

/* ---------- Dibujo ---------- */
let touchUI = matchMedia && matchMedia('(pointer: coarse)').matches;
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchUI = true; }, { passive: true });
function drawBgImage(name, par, yOff = 0) {
  const im = IMG[name]; if (!im) return;
  const h = H * 1.02, w = im.width * h / im.height, off = ((G.cx * par) % (w * 2) + w * 2) % (w * 2);
  for (let k = -1; k < Math.ceil(W / w) + 2; k++) { const x = k * w - off; if (x > W || x + w < 0) continue; ctx.save(); if (k & 1) { ctx.translate(x + w, yOff); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); } else ctx.drawImage(im, x, yOff, w, h); ctx.restore(); }
}
function drawTrainBg() {
  const im = IMG['fondo-tren']; if (!im) return;
  const h = H * 0.95, w = im.width * h / im.height, off = ((G.trainX * 0.08 + G.cx * 0.15) % (w * 2) + w * 2) % (w * 2);
  for (let k = -1; k < 3; k++) { const x = k * w - off; if (x > W || x + w < 0) continue; ctx.save(); if (k & 1) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); } else ctx.drawImage(im, x, 0, w, h); ctx.restore(); }
  ctx.fillStyle = '#5a3524'; ctx.fillRect(0, RAIL + 4, W, H - RAIL);
  const so = (G.trainX + G.cx) % 28; ctx.fillStyle = '#2b1810'; for (let x = -so; x < W; x += 28) ctx.fillRect(x, RAIL + 8, 16, 6);
  ctx.fillStyle = '#b9b2c4'; ctx.fillRect(0, RAIL + 5, W, 3);
  const po = (G.trainX + G.cx) % 300; ctx.fillStyle = '#2b1810'; for (let x = -po; x < W + 20; x += 300) { ctx.fillRect(x, RAIL - 130, 6, 134); ctx.fillRect(x - 14, RAIL - 130, 34, 5); }
}
function drawTrainFront() {
  const im = IMG['rocas-cerca']; if (!im) return;
  const h = 70, w = im.width * h / im.height, off = ((G.trainX * 2.2 + G.cx * 1.3) % w + w) % w;
  for (let x = -off; x < W; x += w) ctx.drawImage(im, x, H - h + 14, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < 12; i++) { const y = 30 + (i * 53) % 230, x = W - ((G.trainX * 2.4 + i * 137) % (W + 80)); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); } ctx.stroke();
}
function drawGround(o) {
  const L = G.L, pal = L.ground || ['#6a4a30', '#3e2a1c', '#8a6a48'];
  const x = o.x - G.cx, y = o.y - G.cy, w = o.w, h = Math.min(o.h, H + G.cy - o.y + 10);
  if (x > W || x + w < 0 || y > H) return;
  const g = ctx.createLinearGradient(0, y, 0, y + 60); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pal[2]; ctx.fillRect(x, y, w, 6);
  ctx.strokeStyle = 'rgba(18,10,31,.35)'; ctx.lineWidth = 2; ctx.beginPath();
  const st = L.ice ? 70 : 46;
  for (let r = 0; r < 3; r++) { const yy = y + 16 + r * 18; if (yy > y + h) break; const sh = (r % 2) * st / 2; for (let xx = x - ((x % st) + st) % st + sh; xx < x + w; xx += st) { ctx.moveTo(Math.max(x, xx), yy); ctx.lineTo(Math.min(x + w, xx + st - 8), yy); } }
  ctx.stroke();
  if (L.ice) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let xx = x + 20; xx < x + w; xx += 90) ctx.fillRect(xx, y + 2, 30, 2); }
  ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.stroke();
}
function drawHazards() {
  for (const h of G.L.haz) {
    const x = h.x - G.cx, y = h.y - G.cy; if (x > W || x + h.w < 0) continue;
    if (h.type === 'agua') {
      ctx.fillStyle = '#2e6f9e'; ctx.fillRect(x, y, h.w, H); ctx.fillStyle = '#4fb3e8'; ctx.fillRect(x, y, h.w, 5);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < h.w; i += 22) { const yy = y + 12 + Math.sin(G.t * 3 + i) * 2; ctx.moveTo(x + i + ((G.t * 30) % 22), yy); ctx.lineTo(x + i + 10 + ((G.t * 30) % 22), yy); } ctx.stroke();
      ctx.fillStyle = '#7a6a5a'; ctx.fillRect(x - 4, y - 16, 6, H); ctx.fillRect(x + h.w - 2, y - 16, 6, H);
    } else if (h.type === 'pileta') {
      const g = ctx.createLinearGradient(0, y, 0, y + 40); g.addColorStop(0, '#7ff0e6'); g.addColorStop(1, '#2a9fb0');
      ctx.fillStyle = g; ctx.fillRect(x, y, h.w, H); ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < h.w; i += 26) ctx.fillRect(x + i + Math.sin(G.t * 2 + i) * 4, y + 6, 12, 2);
      if (Math.random() < 0.25) G.fx.push({ x: h.x + rnd(0, h.w), y: h.y, vx: rnd(-10, 10), vy: rnd(-60, -30), t: 0, life: 1.4, col: 'rgba(255,255,255,.5)', sz: rnd(6, 11), soft: 1 });
    }
  }
}
function drawT(o) {
  if (o.ground) return drawGround(o);
  if (o.ladTop || !o.img) return;
  const im = IMG[o.img]; if (!im) return;
  const x = o.x - G.cx, y = o.y - G.cy; if (x > W + 10 || x + o.w < -10 || y > H || y + o.h < -10) return;
  const r = o.wagon && !o.loco ? Math.sin(G.t * 30 + o.x) * 0.5 : 0;
  ctx.drawImage(im, x, y + r, o.w, o.h);
}
function drawLadders() {
  for (const l of G.L.lad) { const im = IMG[l.img]; if (!im) continue; const w = im.width * l.s, hh = im.height * l.s; const x = l.x - w / 2 - G.cx; if (x > W || x + w < 0) continue; for (let y = l.top - 8; y < l.bot; y += hh * 0.92) { const h = Math.min(hh, l.bot - y + 4); ctx.drawImage(im, 0, 0, im.width, h / l.s, x, y - G.cy, w, h); } }
}
function drawCoin(x, y, t) { const sx = Math.abs(Math.cos(t * 5 + x * 0.05)); ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.2, sx), 1); ctx.fillStyle = '#ffd21f'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff8a1f'; ctx.fillRect(-1.5, -4.5, 3, 9); ctx.restore(); }
function drawPickups() {
  for (const p of G.pk) {
    const x = p.x - G.cx, y = p.y - G.cy + (p.drop ? 0 : Math.sin(G.t * 3 + p.x) * 3); if (x < -30 || x > W + 30 || y < -40 || y > H + 40) continue;
    if (p.type === 'coin') { drawCoin(x, y, G.t); continue; }
    const im = IMG[PK_IMG[p.type]]; if (!im) continue;
    const s = p.type === 'fig' ? 0.62 : 0.5, w = im.width * s, h = im.height * s;
    if (p.type === 'fig') { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(G.t * 4) * 0.15; ctx.fillStyle = '#fff4a8'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill(); ctx.restore(); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(G.t * 2) * 0.15); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
    else ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
  }
}
function drawEnemies() {
  for (const e of G.E) {
    if (e.st === 'wait' || e.dead) continue; const d = EN[e.type];
    const k = e.k || 1, x = e.x - G.cx; if (x < -80 || x > W + 80) continue;
    const by = (e.fly ? e.cy + (STRIPS[d.strip].fh * d.s * k) / 2 : e.y) - G.cy;
    const a = e.st === 'gone' ? Math.max(0, 1 - e.gt / 1.6) : 1;
    if (e.flash > 0) { e.flash -= 1 / 60; }
    drawStrip(d.strip, e.f || 0, x, by, d.s * k, e.face > 0, e.flash > 0 ? 0.55 : a);
    if (e.stun > 0) { ctx.fillStyle = '#ffd21f'; for (let i = 0; i < 3; i++) { const aa = G.t * 6 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(aa) * 14, by - STRIPS[d.strip].fh * d.s * k - 4 + Math.sin(aa) * 4, 3, 0, TAU); ctx.fill(); } }
  }
}
function drawBoss() {
  const b = G.boss; if (!b) return; const d = b.d, m = STRIPS[d.strip];
  const a = b.st === 'gone' ? Math.max(0, 1 - b.gt / 1.2) : 1;
  const by = (d.fly ? b.y + m.fh * d.s * b.k / 2 : b.y) - G.cy;
  ctx.save(); ctx.globalAlpha = 0.3 * a; ctx.fillStyle = '#120a1f'; ctx.beginPath(); ctx.ellipse(b.x - G.cx, (d.fly ? arenaFloorAt(b.x) : b.y) - G.cy + 2, 60 * b.k, 9 * b.k, 0, 0, TAU); ctx.fill(); ctx.restore();
  drawStrip(d.strip, b.f, b.x - G.cx, by, d.s * b.k, b.face > 0, b.flash > 0 ? 0.5 : a);
  if (b.type === 'princesa' && b.st !== 'gone') { ctx.save(); ctx.globalAlpha = 0.12 + Math.sin(G.t * 5) * 0.05; ctx.fillStyle = '#e25bff'; ctx.beginPath(); ctx.arc(b.x - G.cx, by - m.fh * d.s * b.k * 0.55, 70 * b.k, 0, TAU); ctx.fill(); ctx.restore(); }
}
function chispaFrame() {
  const gom = G.L.weapon === 'gom';
  if (P.win) return ['chispa-festejo', Math.floor(P.anim) % 3];
  if (P.dead || P.hurtT > 0) return ['chispa-golpe', P.dead ? (P.dead > 0.6 ? 1 : 2) : 0];
  if (P.climb) return ['chispa-trepa', Math.floor(P.anim) % 4];
  if (P.crouch) return ['chispa-agachada', P.shootT > 0 && !gom ? 2 : 1];
  if (!P.on) return ['chispa-salto', P.vy < -250 ? 1 : P.vy < 200 ? 2 : 3];
  if (P.landT > 0) return ['chispa-salto', 4];
  const run = Math.abs(P.vx) > 30;
  if (run) return [P.shootT > 0 ? (gom ? 'chispa-corre-gomera' : 'chispa-corre-dispara') : 'chispa-correr', Math.floor(P.anim) % 6];
  if (P.shootT > 0) return [gom ? 'chispa-gomera' : 'chispa-dispara', P.shootT > 0.24 ? 1 : 0];
  return ['chispa-quieta', Math.floor(G.t * 1.6) % 3];
}
const CH_S = 0.4;
function drawChispa() {
  if (P.inv > 0 && !P.dead && P.hurtT <= 0 && Math.floor(P.inv * 14) % 2) return;
  const [n, f] = chispaFrame();
  drawStrip(n, f, P.x - G.cx, P.y - G.cy + 1, CH_S, P.face < 0);
}
function drawBichi() {
  let n, f;
  if (BI.throwT > 0) { n = 'bichi-tira'; f = BI.throwT > 0.45 ? 0 : BI.throwT > 0.32 ? 1 : BI.throwT > 0.12 ? 2 : 3; }
  else if (BI.scare > 0) { n = 'bichi-golpe'; f = 0; }
  else if (!BI.on) { n = 'bichi-camina'; f = BI.vy < -150 ? 1 : BI.vy < 100 ? 2 : 3; }
  else if (Math.abs(BI.trail[0] ? BI.trail[0][0] - 34 * BI.trail[0][2] - BI.x : 0) > 10) { n = 'bichi-camina'; f = Math.floor(BI.anim * 8) % 5; }
  else { n = 'bichi-quieto'; f = Math.floor(BI.anim * 1.2) % 3; }
  drawStrip(n, f, BI.x - G.cx, BI.y - G.cy + 1, 0.42, BI.face < 0);
}
function drawShots() {
  for (const s of G.PS) {
    const x = s.x - G.cx, y = s.y - G.cy;
    if (s.kind === 'beam') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(215,139,255,.9)'); g.addColorStop(1, 'rgba(150,40,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 20, 8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot); ctx.fillStyle = '#a8693a'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#6b3c1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke(); ctx.restore(); }
  }
  for (const s of G.ES) {
    const x = s.x - G.cx, y = s.y - G.cy;
    ctx.save(); ctx.translate(x, y);
    if (s.kind === 'coal') { ctx.fillStyle = '#2a2230'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff7a1f'; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, TAU); ctx.fill(); }
    else if (s.kind === 'dust') { ctx.globalAlpha = 0.7; ctx.fillStyle = '#b9c9a0'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(G.t * 3 + i * 1.6) * 6, Math.sin(G.t * 3 + i * 1.6) * 6, 8, 0, TAU); ctx.fill(); } }
    else if (s.kind === 'drop') { ctx.fillStyle = '#7fdcff'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(8, 2, 0, 7); ctx.quadraticCurveTo(-8, 2, 0, -10); ctx.fill(); ctx.stroke(); }
    else if (s.kind === 'crystal') { ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = '#ff6ef0'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 6); ctx.lineTo(-10, 0); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (s.kind === 'lava') { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ff8a1f'); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
function drawFx() {
  for (const f of G.fx) { const a = 1 - f.t / f.life; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x - G.cx, f.y - G.cy, f.sz * (f.soft ? 1 + f.t : 1), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const w of G.words) { ctx.save(); ctx.globalAlpha = 1 - w.t / 0.9; ctx.translate(w.x - G.cx, (w.fixed ? w.y : w.y - G.cy) - w.t * 30); ctx.rotate(-0.12); outlined(w.w, 0, 0, 22, w.col); ctx.restore(); }
}
function drawGeysers() {
  for (const g of G.L.gey) {
    const im = IMG['plataformas-termas-3']; const x = g.x - G.cx, y = g.y - G.cy; if (x < -60 || x > W + 60) continue;
    if (im) { const s = 0.36, w = im.width * s, h = im.height * s; ctx.drawImage(im, x - w * 0.52, y - h + 8, w, h); }
    if (g.on) { const gr = ctx.createLinearGradient(0, y - 260, 0, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.75)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 26, y - 260); ctx.lineTo(x + 26, y - 260); ctx.lineTo(x + 10, y); ctx.fill(); }
    else { const ph = g.t % 3.4; if (ph > 1.6) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x + Math.sin(G.t * 20) * 2, y - 14, 4 + (ph - 1.6) * 3, 0, TAU); ctx.fill(); } }
  }
}
function drawTunnels() {
  for (const t of G.tunnels) {
    if (t.on !== 1) continue; const im = IMG.tunel; if (!im) continue;
    const x = t.x - G.cx, y = tunTop() - G.cy, w = im.width * TUN_S, h = im.height * TUN_S;
    ctx.save(); ctx.beginPath(); ctx.rect(x, -10, w, TUN_CEIL + 6 - G.cy + 10); ctx.clip(); ctx.drawImage(im, x, y, w, h); ctx.restore();
  }
}
function drawDark() {
  const k = G.dark ? 0.8 : G.tunnelIn * 0.55; if (k <= 0.01) return;
  if (!drawDark.c) drawDark.c = document.createElement('canvas');
  const c = drawDark.c; if (c.width !== Math.ceil(W) || c.height !== H) { c.width = Math.ceil(W); c.height = H; }
  const d = c.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, c.width, H); d.fillStyle = `rgba(10,4,20,${k})`; d.fillRect(0, 0, c.width, H);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => { const g = d.createRadialGradient(x, y, r * 0.15, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill(); };
  hole(P.x - G.cx, P.y - 34 - G.cy, G.dark ? 150 : 120, 1);
  if (G.dark) { for (const l of G.L.lights) hole(l.x - G.cx, l.y - G.cy, l.r * (0.95 + Math.sin(G.t * 7 + l.x) * 0.04), 0.95); for (const s of G.PS) if (s.kind === 'beam') hole(s.x - G.cx, s.y - G.cy, 50, 0.8); if (G.boss) hole(G.boss.x - G.cx, (G.boss.d.fly ? G.boss.y : G.boss.y - 70) - G.cy, 130, 0.7); for (const e of G.E) if (e.st !== 'wait' && e.type === 'polilla') hole(e.x - G.cx, e.cy - G.cy, 40, 0.5); }
  ctx.drawImage(c, 0, 0, W, H);
}
function heart(x, y, on, s = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = on ? '#e2357a' : 'rgba(255,255,255,.25)'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(10, 18); ctx.bezierCurveTo(-6, 6, 2, -4, 10, 4); ctx.bezierCurveTo(18, -4, 26, 6, 10, 18); ctx.fill(); ctx.stroke(); ctx.restore(); }
function drawHUD() {
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let i = 0; i < SV.maxhp; i++) heart(12 + i * 25, 12, i < P.hp);
  const cx0 = 18 + SV.maxhp * 25; drawCoin(cx0 + 4, 22, 0); outlined(String(SV.coins), cx0 + 16, 24, 17, '#fff');
  // arma
  const gom = G.L.weapon === 'gom', wim = IMG[gom ? 'gomera' : 'desmutador'], wx = 12, wy = 40;
  ctx.fillStyle = 'rgba(18,10,31,.55)'; ctx.fillRect(wx, wy, 104, 30); ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.strokeRect(wx, wy, 104, 30);
  if (wim) { const h = 26, w = wim.width * h / wim.height; ctx.drawImage(wim, wx + 3, wy + 2, w, h); }
  if (gom) { const im = IMG['objetos-juntar-0']; if (im) ctx.drawImage(im, wx + 40, wy + 7, 22, 15); outlined('×' + P.ammo, wx + 64, wy + 16, 16, P.ammo < 3 ? '#ff6b6b' : '#fff'); }
  else { ctx.fillStyle = '#2a1840'; ctx.fillRect(wx + 40, wy + 11, 58, 9); ctx.fillStyle = P.energy < 12 ? '#ff6b6b' : '#d78bff'; ctx.fillRect(wx + 40, wy + 11, 58 * P.energy / 100, 9); ctx.strokeRect(wx + 40, wy + 11, 58, 9); }
  // figuritas del nivel
  for (let i = 0; i < 3; i++) { const has = (SV.fig[G.lv] >> i) & 1, x = W - 150 + i * 22, y = 10; ctx.fillStyle = has ? '#fff' : 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, 17, 22); ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 17, 22); if (has) { ctx.fillStyle = '#e2357a'; ctx.fillRect(x + 3, y + 3, 11, 10); } }
  // pausa
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W - 30, 26, 18, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#120a1f'; ctx.fillRect(W - 37, 18, 5, 16); ctx.fillRect(W - 28, 18, 5, 16);
  // jefe
  const b = G.boss;
  if (b && b.st !== 'gone') { const bw = Math.min(280, W - 340), bx = (W - bw) / 2, by = 26; ctx.fillStyle = '#120a1f'; ctx.fillRect(bx - 3, by - 3, bw + 6, 16); ctx.fillStyle = '#3a1d55'; ctx.fillRect(bx, by, bw, 10); ctx.fillStyle = '#e2357a'; ctx.fillRect(bx, by, bw * b.hp / b.max, 10); ctx.textAlign = 'center'; outlined(b.d.name, W / 2, by - 12, 14, '#fff'); ctx.textAlign = 'left'; }
  // diálogo
  const s = G.says[0];
  if (s) {
    const k = Math.min(1, G.sayT * 6, (s.d - G.sayT) * 6), bw = Math.min(360, W - 290), x = 126 - (1 - k) * 420, y = 40, h = 52;
    ctx.fillStyle = '#120a1f'; ctx.fillRect(x + 3, y + 3, bw, h); ctx.fillStyle = '#fff7e6'; ctx.fillRect(x, y, bw, h); ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, bw, h);
    const fi = IMG[FACES[s.who]]; ctx.fillStyle = '#18a9df'; ctx.fillRect(x + 5, y + 5, 42, 42); if (fi) { const sw = Math.min(fi.width, fi.height); ctx.drawImage(fi, (fi.width - sw) / 2, 0, sw, sw, x + 5, y + 5, 42, 42); } ctx.strokeRect(x + 5, y + 5, 42, 42);
    ctx.font = '12px "Luckiest Guy", Impact'; ctx.fillStyle = '#e2357a'; ctx.fillText(WHO[s.who], x + 55, y + 13);
    ctx.font = '700 12px Archivo, sans-serif'; ctx.fillStyle = '#120a1f'; wrap(s.text, x + 55, y + 29, bw - 62, 14);
  }
  if (touchUI) drawTouch();
}
function wrap(t, x, y, mw, lh) { const ws = t.split(' '); let line = '', yy = y; for (const w of ws) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > mw && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = tt; } ctx.fillText(line, x, yy); }
function drawTouch() {
  const b = BTNS();
  const btn = (o, on, extra) => { ctx.globalAlpha = on ? 0.95 : 0.55; ctx.fillStyle = '#120a1f'; ctx.beginPath(); ctx.arc(o.x + 3, o.y + 3, o.r, 0, TAU); ctx.fill(); ctx.fillStyle = on ? '#ffd21f' : '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 3; ctx.stroke(); if (extra) extra(o); ctx.textAlign = 'center'; ctx.font = (o.r > 30 ? 14 : 11) + 'px "Luckiest Guy", Impact'; ctx.fillStyle = '#120a1f'; ctx.fillText(o.label, o.x, o.y + 1); ctx.globalAlpha = 1; };
  btn(b.j, TC.btn.j); btn(b.f, TC.btn.f);
  btn(b.b, TC.btn.b, o => { if (BI.cd > 0) { ctx.fillStyle = 'rgba(18,10,31,.45)'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.arc(o.x, o.y, o.r, -Math.PI / 2, -Math.PI / 2 + TAU * (BI.cd / 6)); ctx.fill(); } });
  const p = TC.pos;
  if (p) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.bx, p.by, 46, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffd21f'; ctx.strokeStyle = '#120a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.bx + clamp(p.dx, -46, 46), p.by + clamp(p.dy, -46, 46), 22, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; }
  else if (G.t < 8) { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(90, H - 70, 46, 0, TAU); ctx.stroke(); ctx.textAlign = 'center'; ctx.font = '12px "Luckiest Guy", Impact'; ctx.fillStyle = '#fff'; ctx.fillText('DESLIZÁ', 90, H - 78); ctx.fillText('PARA MOVERTE', 90, H - 62); ctx.globalAlpha = 1; }
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d0618'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!G) return;
  ctx.setTransform(S * DPR, 0, 0, S * DPR, OX * DPR, OY * DPR);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const sh = G.shake > 0 ? G.shake * 14 : 0; if (sh) ctx.translate(rnd(-sh, sh), rnd(-sh, sh));
  const L = G.L;
  if (L.train) drawTrainBg();
  else if (L.vertical) { const im = IMG[L.bg]; if (im) { const w = Math.max(W, 420), h = im.height * w / im.width, y = -(G.cy / Math.max(1, L.h - H)) * (h - H); ctx.drawImage(im, (W - w) / 2, y, w, h); } }
  else drawBgImage(L.bg, 0.3);
  if (L.vertical) { ctx.fillStyle = 'rgba(13,6,24,.25)'; ctx.fillRect(0, 0, W, H); }
  for (const d of L.deco) { const im = IMG[d.img]; if (!im) continue; const x = d.x - G.cx, y = d.y - G.cy, w = im.width * d.s, h = im.height * d.s; if (x > W || x + w < 0) continue; ctx.drawImage(im, x, y, w, h); }
  drawHazards();
  for (const o of G.T) drawT(o);
  drawLadders();
  if (L.cart) { const im = IMG['puesto-tito']; if (im) { const s = 0.42, w = im.width * s, h = im.height * s, x = L.cart.x - G.cx, y = L.cart.y - G.cy - h + 4; if (x < W && x + w > 0) { ctx.drawImage(im, x, y, w, h); if (G.nearCart) { ctx.textAlign = 'center'; outlined('PUESTO DE DON TITO', x + w / 2, y - 10, 13, '#7ef08a'); } } } }
  drawGeysers();
  drawPickups(); drawEnemies(); drawBoss(); drawBichi(); drawChispa(); drawShots();
  for (const d of L.front) { const im = IMG[d.img]; if (!im) continue; const x = d.x - G.cx, y = d.y - G.cy, w = im.width * d.s, h = im.height * d.s; if (x > W || x + w < 0) continue; ctx.drawImage(im, x, y, w, h); }
  if (L.train) { drawTunnels(); drawTrainFront(); }
  drawFx();
  drawDark();
  if (L.vertical && !G.lock) { const pr = 1 - clamp((P.y - 330) / (L.h - 400), 0, 1); ctx.fillStyle = 'rgba(18,10,31,.6)'; ctx.fillRect(W - 18, 80, 8, 180); ctx.fillStyle = '#ffd21f'; ctx.fillRect(W - 18, 80 + 180 * (1 - pr), 8, 180 * pr); }
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); drawHUD(); ctx.restore();
}

/* ---------- Historieta ---------- */
const COMIC = {
  prologo: [
    ['h-prologo-1', 'En lo más hondo del glaciar, el huevo violeta se abrió. Algo nuevo había nacido.', 'oscuro'],
    ['h-prologo-2', 'En una sola noche, la Princesa del Enjambre creció y llevó a sus bichos hacia Mendoza.', 'oscuro'],
    ['h-prologo-3', 'Al amanecer, la Puelche estaba hecha pedazos. —¡Mi nave! —se agarró la cabeza Don Tito.', 'oscuro'],
    ['h-prologo-4', '—Llevate esto —dijo la Dra. Ozán—. El desmutador no lastima: devuelve a los bichos a su tamaño.', 'epica'],
    ['h-prologo-5', 'Sin nave, había que ir a pie. Chispa y Bichi subieron al techo del Trasandino.', 'epica'],
  ],
  c0: [['h-1a', 'La Princesa escapó entre los viñedos hacia una bodega abandonada.', 'epica'], ['h-1b', 'Abajo, en la cava, todo estaba oscuro. Al fondo brillaba algo violeta.', 'oscuro']],
  c1: [['h-2a', '—¡Esto es mío ahora! —La Princesa le arrancó el desmutador de las manos y se fue riendo.', 'oscuro'], ['h-2b', 'En la mochila había una gomera vieja con una nota: «Por las dudas. Tito.»', 'epica']],
  c2: [['h-3', 'Desde el lago del parque lo vieron: el enjambre se juntaba arriba del Cerro de la Gloria.', 'epica']],
  c3: [['h-4', 'Don Tito los pasó a buscar con la camioneta. —A Cacheuta. Ahí se esconde el grandote.', 'epica']],
  c4: [['h-5a', '¡El escarabajo cayó y escupió el desmutador! Chispa lo agarró en el aire.', 'epica'], ['h-5b', 'Don Tito había arreglado la Puelche. Rumbo al glaciar violeta.', 'epica'], ['h-6', 'En el trono de la colmena, la Princesa los esperaba.', 'oscuro']],
  c5: [['h-final-1', '¡Zzzap! El rayo le dio de lleno y la Princesa empezó a achicarse.', 'final'], ['h-final-2', 'Quedó chiquita, del tamaño de Bichi. Bichi le convidó una uva. Amigos.', 'final'], ['h-final-3', 'Esa noche hubo asado en el hangar. Mendoza estaba a salvo… por ahora.', 'final']],
};
// cada figurita del álbum es una viñeta de la historia
const ALBUM = ['h-prologo-1', 'h-prologo-2', 'h-prologo-3', 'h-prologo-4', 'h-prologo-5', 'h-1a', 'h-1b', 'h-2a', 'h-2b', 'h-3', 'h-4', 'h-5a', 'h-5b', 'h-6', 'h-final-1', 'h-final-2', 'h-final-3', 'portada-huevo'];
let comicQ = null, comicI = 0, comicDone = null, comicFlip = 0;
function playComic(key, done) {
  comicQ = COMIC[key]; comicI = -1; comicDone = done; SV.seen[key] = 1; save();
  hideAll(); $('mute').classList.add('hidden'); show('comic'); $('cimgA').classList.remove('on'); $('cimgB').classList.remove('on'); nextPanel();
}
function nextPanel() {
  comicI++;
  if (comicI >= comicQ.length) { const d = comicDone; comicDone = null; d && d(); return; }
  const [img, cap, mood] = comicQ[comicI];
  comicFlip ^= 1; const on = $(comicFlip ? 'cimgA' : 'cimgB'), off = $(comicFlip ? 'cimgB' : 'cimgA');
  on.src = 'a/' + img + '.webp'; on.classList.add('on'); off.classList.remove('on');
  $('cap').textContent = cap; playMusic(mood);
  $('cnext').textContent = comicI === comicQ.length - 1 ? 'JUGAR ▶' : 'SEGUIR ▶';
}
$('cnext').onclick = e => { e.stopPropagation(); nextPanel(); };
$('comic').onclick = () => nextPanel();
$('cskip').onclick = e => { e.stopPropagation(); comicI = comicQ.length; nextPanel(); };

/* ---------- Pantallas ---------- */
const SCREENS = ['loading', 'menu', 'levels', 'albumS', 'comic', 'pause', 'over', 'win', 'shop', 'fin', 'ios'];
function hideAll() { SCREENS.forEach(id => $(id).classList.add('hidden')); }
function show(id) { $(id).classList.remove('hidden'); }
function vis(id) { return !$(id).classList.contains('hidden'); }
function toMenu() {
  if (G) { G.run = false; } G = null; hideAll(); show('menu'); $('mute').classList.remove('hidden'); $('shopBtn').classList.add('hidden');
  $('bResume').classList.toggle('hidden', !SV.resume);
  $('bPlay').textContent = SV.unlocked > 1 || SV.seen.prologo ? (SV.beaten ? 'JUGAR DE NUEVO' : 'JUGAR') : 'EMPEZAR';
  $('mute').textContent = SV.mute ? '✕' : '♪';
  playMusic('menu'); updInstall(); checkRotate();
}
function playStory() {
  const lv = SV.beaten ? 0 : Math.min(5, SV.unlocked - 1);
  if (lv === 0 && !SV.seen.prologo) playComic('prologo', () => startLevel(0));
  else startLevel(lv);
}
$('bPlay').onclick = () => { audioOn(); playStory(); };
$('bResume').onclick = () => { audioOn(); const r = SV.resume; if (r) startLevel(r.lv, r.cp); };
$('bLevels').onclick = () => {
  hideAll(); show('levels');
  $('lvGrid').innerHTML = LEVEL_NAMES.map((n, i) => { const lock = i >= SV.unlocked, f = [0, 1, 2].filter(k => (SV.fig[i] >> k) & 1).length; return `<button class="card${lock ? ' lock' : ''}" data-lv="${i}" ${lock ? 'disabled' : ''}><span class="num">${i + 1}</span><img src="a/${LEVEL_THUMB[i]}.webp" alt=""><b>${n}</b><small>${lock ? 'Bloqueado' : `Figuritas ${f}/3` + (SV.best[i] ? ` · ${fmtT(SV.best[i])}` : '')}</small></button>`; }).join('');
  $('mute').classList.add('hidden'); $('lvGrid').querySelectorAll('.card').forEach(c => c.onclick = () => { if (!c.disabled) { audioOn(); startLevel(+c.dataset.lv); } });
};
$('lvBack').onclick = toMenu;
$('bAlbum').onclick = () => {
  hideAll(); show('albumS');
  let n = 0;
  $('albumGrid').innerHTML = ALBUM.map((img, k) => { const lv = Math.floor(k / 3), i = k % 3, has = (SV.fig[lv] >> i) & 1; if (has) n++; const r = ((k * 37) % 7 - 3) * 0.6; return `<div class="fig" style="--r:${r}deg">${has ? `<img src="a/${img}.webp" alt="">` : `<div class="hole">${k + 1}</div>`}<small>${has ? 'N.º ' + (k + 1) : LEVEL_NAMES[lv]}</small></div>`; }).join('');
  $('mute').classList.add('hidden'); $('albumTxt').textContent = `Pegaste ${n} de 18 figuritas. Hay 3 escondidas en cada nivel.`;
};
$('alBack').onclick = toMenu;
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function togglePause() {
  if (!G || !G.run || G.clear || P.dead) return;
  G.paused = !G.paused;
  if (G.paused) { show('pause'); $('pMute').textContent = 'SONIDO: ' + (SV.mute ? 'NO' : 'SÍ'); saveResume(); } else hideAll();
}
function saveResume() { if (!G) return; SV.ammo = P.ammo; SV.resume = { lv: G.lv, cp: !!G.cp }; save(); }
$('pResume').onclick = togglePause;
$('pRestart').onclick = () => startLevel(G.lv, false);
$('pMute').onclick = () => { SV.mute = !SV.mute; save(); $('pMute').textContent = 'SONIDO: ' + (SV.mute ? 'NO' : 'SÍ'); };
$('pMenu').onclick = () => { saveResume(); toMenu(); };
$('mute').onclick = () => { SV.mute = !SV.mute; save(); $('mute').textContent = SV.mute ? '✕' : '♪'; audioOn(); };
function gameOver() {
  G.run = false; SV.ammo = Math.max(P.ammo, 8); save(); hideAll(); show('over'); $('shopBtn').classList.add('hidden');
  $('overTxt').textContent = G.cp ? 'Bichi te espera en el puesto de Don Tito.' : 'Bichi te espera al principio del nivel.';
  $('oRetry').textContent = G.cp ? 'VOLVER AL PUESTO' : 'OTRA VEZ';
  playMusic('oscuro');
}
$('oRetry').onclick = () => startLevel(G.lv, !!G.cp);
$('oMenu').onclick = toMenu;
function levelClear() {
  G.clear = 0.001; P.win = 1; P.vx = 0; SFX.win();
  say('chispa', pick(['¡Lo achicamos!', '¡Uno menos!', '¡Vamos, Bichi!']), 2);
  const lv = G.lv;
  SV.unlocked = Math.min(6, Math.max(SV.unlocked, lv + 2)); SV.ammo = P.ammo;
  if (!SV.best[lv] || G.t < SV.best[lv]) SV.best[lv] = G.t;
  if (lv === 5) SV.beaten = true;
  SV.resume = lv < 5 ? { lv: lv + 1, cp: false } : null; save();
}
function showWin() {
  G.run = false; hideAll(); show('win'); $('shopBtn').classList.add('hidden');
  const f = [0, 1, 2].filter(k => (SV.fig[G.lv] >> k) & 1).length;
  $('winT').textContent = G.lv === 5 ? '¡LA PRINCESA, ACHICADA!' : '¡NIVEL SUPERADO!';
  $('winS').innerHTML = `<b>${LEVEL_NAMES[G.lv]}</b><br>Monedas juntadas: ${G.coins} · Figuritas: ${f}/3 · Tiempo: ${fmtT(G.t)}` + (f < 3 ? '<br><small>Te quedan figuritas escondidas. Podés volver desde NIVELES.</small>' : '');
}
$('wNext').onclick = () => { const lv = G.lv; playComic('c' + lv, () => { if (lv >= 5) { hideAll(); show('fin'); $('finS').textContent = `Figuritas pegadas: ${SV.fig.reduce((a, v) => a + [0, 1, 2].filter(k => (v >> k) & 1).length, 0)} de 18.`; playMusic('final'); } else startLevel(lv + 1); }); };
$('fMenu').onclick = toMenu;

/* ---------- El puesto de Don Tito ---------- */
const SHOP = [
  { id: 'heart', name: 'Corazón', desc: 'Recuperás un corazón.', cost: 25, img: 'objetos-juntar-2', ok: () => P.hp < SV.maxhp, buy: () => { P.hp++; } },
  { id: 'pits', name: 'Bolsa de carozos', desc: '10 carozos para la gomera.', cost: 15, img: 'objetos-juntar-0', ok: () => P.ammo < 40, buy: () => { P.ammo = Math.min(40, P.ammo + 10); } },
  { id: 'bat', name: 'Batería violeta', desc: 'Desmutador cargado al máximo.', cost: 10, img: 'objetos-juntar-1', ok: () => G.L.weapon === 'des' && P.energy < 100, buy: () => { P.energy = 100; } },
  { id: 'maxhp', name: 'Corazón extra', desc: 'Un corazón más para siempre (hasta 5).', cost: 120, img: 'objetos-juntar-2', ok: () => SV.maxhp < 5, buy: () => { SV.maxhp++; P.hp++; } },
  { id: 'bichi', name: 'Yerba para Bichi', desc: 'Bichi tira el doble de rápido en este nivel.', cost: 30, img: 'cara-bichi', ok: () => !G.bichiFast, buy: () => { G.bichiFast = true; } },
];
function openShop() {
  if (!G || !G.run) return; G.paused = true; hideAll(); show('shop'); $('shopBtn').classList.add('hidden');
  $('shSay').textContent = '';
  $('shSay').textContent = pick(['—Todo usado pero anda, nena.', '—Para vos, precio de amiga.', '—¿Qué te llevás? No fío.']);
  renderShop();
}
function renderShop() {
  $('shCoins').textContent = SV.coins;
  $('shItems').innerHTML = SHOP.filter(it => it.id !== 'bat' || G.L.weapon === 'des').map(it => { const can = it.ok() && SV.coins >= it.cost; return `<div class="item"><img src="a/${it.img}.webp" alt=""><b>${it.name}</b><small>${it.desc}</small><button class="btn sm" data-id="${it.id}" ${can ? '' : 'disabled'}>${it.ok() ? it.cost + ' monedas' : (it.id === 'heart' ? 'Llenos' : it.id === 'bat' ? 'Cargada' : it.id === 'maxhp' ? 'Máximo' : 'Listo')}</button></div>`; }).join('');
  $('shItems').querySelectorAll('button').forEach(b => b.onclick = () => { const it = SHOP.find(s => s.id === b.dataset.id); if (it && it.ok() && SV.coins >= it.cost) { SV.coins -= it.cost; it.buy(); save(); SFX.pick(); renderShop(); } });
}
$('shopBtn').onclick = () => { audioOn(); openShop(); };
$('shBack').onclick = () => { hideAll(); G.paused = false; };

/* ---------- Tecla atrás de Android ---------- */
function backTrap() { try { history.pushState({ hv: 1 }, ''); } catch (e) {} }
let exitArm = 0;
addEventListener('popstate', () => {
  if (vis('menu')) { if (Date.now() < exitArm) return; exitArm = Date.now() + 2000; toast('Tocá atrás otra vez para salir'); setTimeout(() => { if (Date.now() >= exitArm) backTrap(); }, 2100); return; }
  backTrap();
  if (vis('loading')) return;
  if (G && G.run && !G.paused) { togglePause(); return; }
  if (vis('pause')) { togglePause(); return; }
  if (vis('shop')) { $('shBack').click(); return; }
  if (vis('comic')) { $('cskip').click(); return; }
  if (vis('ios')) { hideAll(); toMenu(); return; }
  toMenu();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.run && !G.paused && !G.clear) togglePause(); if (document.hidden) saveResume(); });
addEventListener('pagehide', saveResume);

/* ---------- Girar el cel ---------- */
let rotBlock = false;
function checkRotate() {
  const portrait = innerHeight > innerWidth * 1.05;
  rotBlock = portrait && !!G && G.run;
  $('rotate').classList.toggle('hidden', !rotBlock);
}

/* ---------- Instalar ---------- */
let installEvt = null;
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const onPages = /github\.io$/.test(location.hostname) || location.hostname === 'localhost';
function updInstall() { $('bInstall').classList.toggle('hidden', standalone()); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; updInstall(); });
addEventListener('appinstalled', () => { installEvt = null; updInstall(); toast('¡El Huevo Violeta instalado!'); });
const PAGES_URL = 'https://robertozapata-has.github.io/el-huevo-violeta/';
$('bInstall').onclick = async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; updInstall(); return; }
  $('instTxt').innerHTML = !onPages ? `Para instalarlo, abrí el juego desde <b>${PAGES_URL.replace('https://', '')}</b> en el navegador del cel y tocá de nuevo este botón.`
    : isIOS ? 'Tocá el botón <b>Compartir</b> de Safari (el cuadrito con la flecha) y después <b>«Agregar a pantalla de inicio»</b>.'
    : 'Abrí el menú <b>⋮</b> de Chrome y tocá <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.';
  hideAll(); show('ios');
};
$('iosOk').onclick = toMenu;
if ('serviceWorker' in navigator && onPages) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }

/* ---------- Bucle ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (G && G.run && !G.paused && !rotBlock) update(dt);
  render(); requestAnimationFrame(frame);
}
document.addEventListener('pointerdown', () => audioOn(), { passive: true });
layout();
requestAnimationFrame(frame);
const CORE = Object.keys(STRIPS).concat(Object.keys(SIZES).filter(n => !/^h-|^portada|^princesa-retrato/.test(n)));
loadAll(CORE, k => { $('lbar').style.width = Math.round(k * 100) + '%'; }).then(() => {
  document.fonts && document.fonts.load('20px "Luckiest Guy"');
  backTrap(); toMenu();
  // las viñetas se cargan de fondo
  setTimeout(() => ALBUM.forEach(n => { const i = new Image(); i.src = 'a/' + n + '.webp'; }), 400);
  const q = new URLSearchParams(location.search); if (q.has('nivel')) { audioOn(); startLevel(clamp(+q.get('nivel') - 1, 0, 5), q.has('puesto')); }
});
