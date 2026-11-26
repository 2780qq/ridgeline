// The terrain: a deterministic heightfield the aircraft flies over, and the projection that folds it
// into the screen. The heights come from a small value-noise field so the ridges are recognisable
// from the air and the same on every run.
import { TERRAIN } from './config.js';

/** A stable hash of two grid coordinates, in 0..1. */
function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Smooth interpolation between the four corners of a grid cell. */
function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Several octaves stacked, so the ground has both broad ridges and fine grain. */
function fbm(x, z) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < 4; i++) {
    total += valueNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return total / norm;
}

/** The ground's height in feet at a world point, in world units where one unit is one foot. */
export function heightAt(x, z) {
  const s = 1 / 2600;
  // broad landform: a noise field stretched over kilometres, so a range reads as a range
  const broad = fbm(x * s * 0.55 + 11.3, z * s * 0.55 + 4.7);
  // ridges: the fold of a second field, which gives long crests rather than blobs
  const fold = Math.abs(fbm(x * s + 2.1, z * s + 8.9) - 0.5) * 2;
  // fine grain, so the near ground is not a smooth sheet
  const grain = fbm(x * s * 3.4 + 30.1, z * s * 3.4 + 17.5);

  let h = broad * 0.42 + Math.pow(fold, 1.35) * 0.78 + grain * 0.12;
  h = (h - 0.28) * TERRAIN.ridgeHeight * 2.1;

  // the valley the route follows: cut away the ridge line so the rings sit over flyable ground
  const valley = Math.exp(-((x + 40) ** 2) / (1100 * 1100));
  h *= 1 - 0.8 * valley;
  // flat ground around the runway, so the sortie starts and ends over an airfield
  const flat = Math.exp(-(x * x + z * z) / (1700 * 1700));
  h *= 1 - flat;
  return Math.max(0, h);
}

/** Whether a point is over the sea, which the renderer paints as water rather than ground. */
export function isWater(x, z) {
  return heightAt(x, z) < 4;
}

/**
 * Projects a world point into screen space for a camera at the origin looking down +z with the given
 * attitude. Returns null when the point is behind the near plane.
 *   rot: the aircraft's attitude in radians
 *   fov: the vertical field of view
 */
export function project(px, py, pz, rot, fov, width, height) {
  // translate into the camera's frame: the camera sits at the world origin with the pilot's eye
  // offset, so a point is taken relative to it first
  const cx = px, cy = py, cz = pz;

  // yaw about y: bring the point into the heading's frame
  const cyw = Math.cos(-rot.yaw), syw = Math.sin(-rot.yaw);
  let x1 = cx * cyw - cz * syw;
  let z1 = cx * syw + cz * cyw;

  // pitch about x
  const cp = Math.cos(-rot.pitch), sp = Math.sin(-rot.pitch);
  let y1 = cy * cp - z1 * sp;
  let z2 = cy * sp + z1 * cp;

  // roll about z
  const cr = Math.cos(-rot.roll), sr = Math.sin(-rot.roll);
  const x2 = x1 * cr - y1 * sr;
  const y2 = x1 * sr + y1 * cr;

  if (z2 < 12) return null;   // behind the near plane

  const f = (height * 0.5) / Math.tan(fov * 0.5);
  const sx = width * 0.5 + (x2 / z2) * f;
  const sy = height * 0.5 - (y2 / z2) * f;
  return { x: sx, y: sy, z: z2, scale: f / z2 };
}

/**
 * Builds the terrain mesh once per frame: a fan of rays out from the eye, each sampled at growing
 * distances, so the near ground fills the lower screen and the far ground compresses into ridges.
 * Points are returned in the camera's frame already, so the renderer only paints them.
 */
export function buildTerrainMesh(cam, fov, width, height, maxRange, rays, steps) {
  const rows = [];
  // wide enough that the fan still covers the screen's corners once it is projected
  const halfFov = fov * 1.45;
  const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
  // the distances grow geometrically, which keeps the near cells big and the far ones fine
  const dists = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    dists.push(8 + Math.pow(t, 3.1) * maxRange);
  }
  for (let i = 0; i <= steps; i++) {
    const d = dists[i];
    const row = [];
    for (let j = 0; j <= rays; j++) {
      const a = -halfFov + (2 * halfFov * j) / rays;
      const lx = Math.sin(a) * d;
      const lz = Math.cos(a) * d;
      // rotate the ray into world space around the aircraft's heading
      const rx = lx * cyw - lz * syw;
      const rz = lx * syw + lz * cyw;
      const gx = cam.x + rx;
      const gz = cam.z + rz;
      const h = heightAt(gx, gz);
      const pt = project(rx, h - cam.alt, rz, { yaw: 0, pitch: cam.pitch, roll: cam.roll }, fov, width, height);
      row.push({ p: pt, h, dist: d, water: h < 4 });
    }
    rows.push(row);
  }
  return rows;
}
