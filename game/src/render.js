// All the painting: the sky, the terrain folding to the horizon, the aircraft in frame, the rings,
// the runway ahead and the instrument strip. Everything is drawn from primitives, so the game ships
// no image files and every frame is its own render.
import { W, H, C, FLIGHT, RINGS, RUNWAY } from './config.js';
import { heightAt, project, buildTerrainMesh } from './terrain.js';
import { headingDeg, pitchDeg } from './flight.js';

const FOV = 1.05;

function text(g, str, x, y, size = 14, color = C.paper, align = 'left', weight = '400') {
  g.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(str, x, y);
}

/** One frame of the whole flight. */
export function draw(g, f) {
  // the chase camera sits above and behind the aircraft and is angled a little further down than
  // the aircraft itself, which is what brings the near ground into the lower half of the frame
  const cam = { x: f.x, z: f.z, alt: f.alt, yaw: f.yaw, pitch: f.pitch - 0.10, roll: f.roll };
  drawSky(g);
  drawSun(g, cam);
  const mesh = buildTerrainMesh(cam, FOV, W, H, 12000, 80, 56);
  drawTerrain(g, mesh, cam);
  drawRings(g, cam, f);
  drawRunway(g, cam);
  drawAircraft(g, f);
  drawHud(g, f);
}

/** The sky: a gradient from cold at the zenith to warm haze at the horizon, shifted by pitch. */
function drawSky(g) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.skyTop);
  grad.addColorStop(0.35, C.skyMid);
  grad.addColorStop(0.66, C.skyLow);
  grad.addColorStop(1, C.haze);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/** A low sun off to the left, with a glow that warms the haze around it. */
function drawSun(g, cam) {
  const p = project(-2600, 700 - cam.alt, 5200, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, FOV, W, H);
  if (!p) return;
  const r = Math.max(18, 190 * p.scale * 0.7);
  const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
  glow.addColorStop(0, 'rgba(255,240,200,.55)');
  glow.addColorStop(0.18, 'rgba(242,194,122,.22)');
  glow.addColorStop(1, 'rgba(242,194,122,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(p.x, p.y, r * 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.sun;
  g.beginPath(); g.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2); g.fill();
}

/** Paints the heightfield as flat-shaded cells, far ones first so nearer ground covers them. */
function drawTerrain(g, mesh, cam) {
  // the horizon band, so the ground meets the sky in haze rather than a hard edge
  const horizon = project(0, -cam.alt, 60000, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, FOV, W, H);
  const hz = horizon ? horizon.y : H * 0.55;
  // fill everything under the horizon with a far-ground colour, so a banked frame shows land at its
  // edges rather than the sky's haze
  g.fillStyle = mix(C.ridgeFar, C.haze, 0.28);
  g.fillRect(0, Math.max(0, hz - 8), W, H);

  for (let iz = mesh.length - 1; iz >= 1; iz--) {
    const far = mesh[iz];
    const near = mesh[iz - 1];
    for (let ix = 0; ix < far.length - 1; ix++) {
      const a = near[ix], b = near[ix + 1], c = far[ix + 1], d = far[ix];
      if (!a.p || !b.p || !c.p || !d.p) continue;
      const hAvg = (a.h + b.h + c.h + d.h) / 4;
      const water = hAvg < 4;
      const depth = Math.min(1, a.dist / 9000);

      // the sun comes from the left, so a face whose ground drops away to the right is lit
      const dLeft = (b.h - a.h) + (c.h - d.h);
      const sunlit = clamp01(0.5 - dLeft * 0.0022);
      // height ramp: valleys read as green, high ground as rock
      const rocky = clamp01(hAvg / 900);

      let col;
      if (water) {
        col = mix(C.water, C.haze, depth * 0.7);
      } else {
        const lowland = mix(C.groundDark, C.ground, sunlit);
        const upland = mix(C.ridgeMid, C.ridgeNear, 1 - sunlit);
        const base = mix(lowland, upland, rocky);
        const lit2 = mix(base, C.groundLight, sunlit * 0.35 * (1 - rocky));
        const fog = Math.max(0, (depth - 0.5) / 0.5);
        col = mix(lit2, C.haze, Math.pow(fog, 2.0) * 0.86);
      }
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(a.p.x, a.p.y);
      g.lineTo(b.p.x, b.p.y);
      g.lineTo(c.p.x, c.p.y);
      g.lineTo(d.p.x, d.p.y);
      g.closePath();
      g.fill();

      // a crest line on the near side of a ridge, which is what makes the relief read
      if (!water && Math.abs(c.h - a.h) > 70) {
        const fade = Math.max(0, 1 - a.dist / 5000);
        g.strokeStyle = `rgba(246,240,222,${0.3 * fade})`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(a.p.x, a.p.y); g.lineTo(b.p.x, b.p.y); g.stroke();
      }
    }
  }
}

/** The route: hoops laid along the valley, the next one bright and the rest dim. */
function drawRings(g, cam, f) {
  const sorted = RINGS
    .map((r, i) => ({ r, i, dz: r.z - cam.z }))
    .filter((o) => o.dz > 60)
    .sort((a, b) => b.dz - a.dz);

  for (const o of sorted) {
    const { r } = o;
    const next = o.i === f.ringsPassed;
    const cx = r.x - cam.x;
    const cz = r.z - cam.z;
    const cy = r.alt - cam.alt;
    const c = project(cx, cy, cz, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, FOV, W, H);
    if (!c) continue;
    const radius = Math.max(3, r.r * c.scale);
    const col = next ? C.target : C.targetDim;
    g.strokeStyle = col;
    g.lineWidth = Math.max(1.5, 5 * c.scale * 0.6);
    g.beginPath();
    g.ellipse(c.x, c.y, radius, radius * 0.94, 0, 0, Math.PI * 2);
    g.stroke();
    if (next) {
      g.strokeStyle = 'rgba(240,192,64,.25)';
      g.lineWidth = Math.max(2, 12 * c.scale * 0.6);
      g.beginPath();
      g.ellipse(c.x, c.y, radius * 1.12, radius * 1.06, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
}

/** The runway: a strip with its centreline and threshold bars, drawn only when it is ahead. */
function drawRunway(g, cam) {
  // The strip is drawn in segments, because the near end of a long runway sits behind the camera's
  // near plane and would otherwise drop the whole strip.
  const halfW = RUNWAY.width / 2;
  const segs = 14;
  const z0 = RUNWAY.z - RUNWAY.length / 2;
  const z1 = RUNWAY.z + RUNWAY.length / 2;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const wz = z0 + ((z1 - z0) * i) / segs;
    const dz = wz - cam.z;
    pts.push({
      dz,
      left: project(-halfW - cam.x, heightAt(0, wz) - cam.alt, dz, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, FOV, W, H),
      right: project(halfW - cam.x, heightAt(0, wz) - cam.alt, dz, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, FOV, W, H),
    });
  }

  // the paved surface, as one quad per segment that is in front of the near plane
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    if (!a.left || !a.right || !b.left || !b.right) continue;
    g.fillStyle = i % 2 === 0 ? '#4e4c46' : '#53514a';
    g.beginPath();
    g.moveTo(a.left.x, a.left.y); g.lineTo(a.right.x, a.right.y);
    g.lineTo(b.right.x, b.right.y); g.lineTo(b.left.x, b.left.y);
    g.closePath(); g.fill();
  }

  // the threshold bars and the centreline, drawn only on segments that survive
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    if (!a.left || !a.right || !b.left || !b.right) continue;
    const cx = (a.left.x + a.right.x) / 2;
    const bx = (b.left.x + b.right.x) / 2;
    // centre dashes
    if (i % 2 === 0) {
      g.strokeStyle = 'rgba(232,228,216,.5)';
      g.lineWidth = Math.max(1, 2.4 * (a.left.scale || 0.2));
      g.beginPath(); g.moveTo(cx, (a.left.y + a.right.y) / 2); g.lineTo(bx, (b.left.y + b.right.y) / 2); g.stroke();
    }
    // threshold bars on the first third
    if (i < 3) {
      const span = Math.max(2, Math.abs(a.right.x - a.left.x) * 0.28);
      g.strokeStyle = 'rgba(240,236,224,.85)';
      g.lineWidth = Math.max(1, 2.2 * (a.left.scale || 0.2));
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(cx + k * span, (a.left.y + a.right.y) / 2);
        g.lineTo(bx + k * span, (b.left.y + b.right.y) / 2);
        g.stroke();
      }
    }
  }

  // the approach light chain, which announces the runway from a distance
  g.fillStyle = 'rgba(240,192,64,.85)';
  for (let i = 2; i <= segs; i += 2) {
    const a = pts[i];
    if (!a.left || !a.right) continue;
    const yy = (a.left.y + a.right.y) / 2;
    const xx = (a.left.x + a.right.x) / 2;
    if (yy < 0 || yy > H) continue;
    const rr2 = Math.max(1.4, 3.2 * (a.left.scale || 0.2));
    g.beginPath(); g.arc(xx, yy, rr2, 0, Math.PI * 2); g.fill();
  }
}

/** The aircraft from a chase view behind and above, banking with the flight. */
function drawAircraft(g, f) {
  const cx = W * 0.5;
  const cy = H * 0.62;
  const s = 1.0;
  g.save();
  g.translate(cx, cy);
  g.rotate(-f.roll * 0.55);

  // the shadow of the wing across the fuselage
  g.fillStyle = C.aircraftDark;
  // wings, swept back
  g.beginPath();
  g.moveTo(-150 * s, 26 * s);
  g.lineTo(-22 * s, -8 * s);
  g.lineTo(22 * s, -8 * s);
  g.lineTo(150 * s, 26 * s);
  g.lineTo(150 * s, 34 * s);
  g.lineTo(22 * s, 6 * s);
  g.lineTo(-22 * s, 6 * s);
  g.lineTo(-150 * s, 34 * s);
  g.closePath();
  g.fill();

  // fuselage, narrowing to the nose
  g.fillStyle = C.aircraft;
  g.beginPath();
  g.moveTo(0, -96 * s);
  g.lineTo(17 * s, -34 * s);
  g.lineTo(20 * s, 40 * s);
  g.lineTo(11 * s, 62 * s);
  g.lineTo(-11 * s, 62 * s);
  g.lineTo(-20 * s, 40 * s);
  g.lineTo(-17 * s, -34 * s);
  g.closePath();
  g.fill();

  // the canopy, a dark shape that catches the sky
  g.fillStyle = C.canopy;
  g.beginPath();
  g.ellipse(0, -46 * s, 11 * s, 20 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(180,220,240,.18)';
  g.beginPath();
  g.ellipse(-3 * s, -50 * s, 4 * s, 9 * s, 0, 0, Math.PI * 2);
  g.fill();

  // tailplane and fin
  g.fillStyle = C.aircraftShade;
  g.beginPath();
  g.moveTo(-46 * s, 58 * s); g.lineTo(46 * s, 58 * s);
  g.lineTo(46 * s, 66 * s); g.lineTo(-46 * s, 66 * s);
  g.closePath(); g.fill();
  g.fillStyle = C.aircraftDark;
  g.beginPath();
  g.moveTo(0, 30 * s); g.lineTo(7 * s, 30 * s); g.lineTo(9 * s, 68 * s); g.lineTo(-9 * s, 68 * s);
  g.lineTo(-7 * s, 30 * s);
  g.closePath(); g.fill();

  // navigation lights on the wingtips, lit
  g.fillStyle = '#e05a4a';
  g.beginPath(); g.arc(-148 * s, 30 * s, 3.5 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4ae0a0';
  g.beginPath(); g.arc(148 * s, 30 * s, 3.5 * s, 0, Math.PI * 2); g.fill();

  g.restore();
}

/** The instruments: altitude on the left, speed on the right, heading above, and the tape between. */
function drawHud(g, f) {
  const altFt = Math.round(f.alt);
  const kt = Math.round(f.speed);
  const hdg = Math.round(headingDeg(f));
  const vs = Math.round(Math.sin(f.pitch) * f.speed * 101);

  // the centre reticle
  g.strokeStyle = 'rgba(143,240,192,.55)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(W / 2 - 46, H / 2); g.lineTo(W / 2 - 14, H / 2);
  g.moveTo(W / 2 + 14, H / 2); g.lineTo(W / 2 + 46, H / 2);
  g.moveTo(W / 2, H / 2 - 12); g.lineTo(W / 2, H / 2 - 4);
  g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 4, 0, Math.PI * 2); g.stroke();

  // the pitch ladder, tilting with the bank
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-f.roll);
  g.strokeStyle = 'rgba(143,240,192,.3)';
  g.lineWidth = 1;
  for (let d = -30; d <= 30; d += 10) {
    if (d === 0) continue;
    const y = -d * 4.2 - pitchDeg(f) * 4.2;
    const w = d === 0 ? 90 : 54;
    g.beginPath(); g.moveTo(-w, y); g.lineTo(-w * 0.55, y); g.moveTo(w * 0.55, y); g.lineTo(w, y); g.stroke();
  }
  g.restore();

  // the altitude tape, left
  drawTape(g, 70, H / 2, altFt, 'ALT', 'ft', C.hud, 1);
  // the speed tape, right
  drawTape(g, W - 70, H / 2, kt, 'SPD', 'kt', C.hud, -1);

  // vertical speed, under the altitude
  text(g, `${vs >= 0 ? '+' : ''}${vs}`, 78, H / 2 + 150, 13, vs > 0 ? C.hud : C.hudWarn, 'center', '600');
  text(g, 'FPM', 78, H / 2 + 166, 9, C.hudDim, 'center');

  // the heading band across the top
  drawHeading(g, hdg);

  // the route and the warnings along the bottom
  g.fillStyle = 'rgba(10,16,20,.72)';
  g.fillRect(0, H - 56, W, 56);
  text(g, `RINGS  ${f.ringsPassed} / ${RINGS.length}`, 40, H - 22, 15, C.target, 'left', '700');
  text(g, `DIST  ${(f.distance / 6076).toFixed(1)} nm`, 260, H - 22, 14, C.hud, 'left');
  text(g, `THR ${Math.round(f.throttle * 100)}%`, 470, H - 22, 14, C.hud, 'left');
  text(g, `G ${f.gLoad.toFixed(1)}`, 620, H - 22, 14, f.gLoad > 3.5 ? C.hudWarn : C.hud, 'left');
  if (f.stalled) text(g, 'STALL', W - 40, H - 22, 16, C.hudBad, 'right', '700');
  else if (f.alt < 300) text(g, 'LOW ALT', W - 40, H - 22, 16, C.hudWarn, 'right', '700');
  else text(g, 'CLEAR', W - 40, H - 22, 13, C.hudDim, 'right');

  // the bank indicator, an arc that rolls with the aircraft
  drawBank(g, f);
}

function drawTape(g, x, cy, value, label, unit, color, side) {
  g.fillStyle = 'rgba(10,16,20,.62)';
  g.fillRect(x - 52, cy - 120, 104, 240);
  g.strokeStyle = 'rgba(143,240,192,.25)';
  g.lineWidth = 1;
  g.strokeRect(x - 52, cy - 120, 104, 240);

  for (let i = -5; i <= 5; i++) {
    const v = value + i * 100;
    if (v < 0) continue;
    const y = cy + i * 21;
    const major = i % 2 === 0;
    g.strokeStyle = major ? 'rgba(143,240,192,.5)' : 'rgba(143,240,192,.22)';
    g.beginPath();
    g.moveTo(x - (side > 0 ? 44 : 30), y);
    g.lineTo(x - (side > 0 ? 30 : 44), y);
    g.stroke();
    if (major) text(g, String(v), x - (side > 0 ? 52 : -18), y + 4, 10, C.hudDim, side > 0 ? 'right' : 'left');
  }

  // the readout box, the number the eye lands on
  g.fillStyle = 'rgba(10,16,20,.9)';
  g.fillRect(x - 46, cy - 17, 92, 34);
  g.strokeStyle = color; g.lineWidth = 1.5;
  g.strokeRect(x - 46, cy - 17, 92, 34);
  text(g, String(value), x, cy + 8, 22, color, 'center', '700');
  text(g, label, x, cy - 96, 11, C.hudDim, 'center', '700');
  text(g, unit, x, cy + 102, 10, C.hudDim, 'center');
}

function drawHeading(g, hdg) {
  const cy = 56;
  g.fillStyle = 'rgba(10,16,20,.7)';
  g.fillRect(W / 2 - 240, cy - 26, 480, 52);
  g.strokeStyle = 'rgba(143,240,192,.25)';
  g.strokeRect(W / 2 - 240, cy - 26, 480, 52);

  for (let d = -40; d <= 40; d += 5) {
    const deg = hdg + d;
    const x = W / 2 + d * 5.2;
    const major = ((deg % 10) + 10) % 10 === 0;
    g.strokeStyle = major ? 'rgba(143,240,192,.6)' : 'rgba(143,240,192,.25)';
    g.beginPath();
    g.moveTo(x, cy + 14);
    g.lineTo(x, cy + 14 - (major ? 10 : 5));
    g.stroke();
    if (major && Math.abs(d) <= 35) {
      const n = ((Math.round(deg / 10) * 10) % 360 + 360) % 360;
      text(g, String(n), x, cy - 2, 10, C.hudDim, 'center');
    }
  }
  g.fillStyle = 'rgba(10,16,20,.9)';
  g.fillRect(W / 2 - 34, cy - 30, 68, 26);
  g.strokeStyle = C.hud; g.lineWidth = 1.5;
  g.strokeRect(W / 2 - 34, cy - 30, 68, 26);
  text(g, String(hdg).padStart(3, '0'), W / 2, cy - 10, 18, C.hud, 'center', '700');
}

function drawBank(g, f) {
  const cx = W / 2, cy = H / 2, r = 150;
  g.strokeStyle = 'rgba(143,240,192,.22)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, r, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke();
  for (const a of [-45, -30, -15, 0, 15, 30, 45]) {
    const rad = (-90 + a) * Math.PI / 180;
    const x1 = cx + Math.cos(rad) * r, y1 = cy + Math.sin(rad) * r;
    const x2 = cx + Math.cos(rad) * (r + (a === 0 ? 12 : 7)), y2 = cy + Math.sin(rad) * (r + (a === 0 ? 12 : 7));
    g.strokeStyle = a === 0 ? 'rgba(143,240,192,.6)' : 'rgba(143,240,192,.3)';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  const rollDeg = (f.roll * 180) / Math.PI;
  const rad = (-90 + rollDeg) * Math.PI / 180;
  g.fillStyle = C.hud;
  g.beginPath();
  g.arc(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, 5, 0, Math.PI * 2);
  g.fill();
}

function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const gg = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${gg},${bl})`;
}
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
