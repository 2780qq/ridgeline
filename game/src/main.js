// The page and the loop: boots the canvas, reads the keys, and runs the flight. A `?shot=` query
// stages one of the screenshots' moments, so the game's own code draws every picture it ships.
import { W, H, RINGS } from './config.js';
import { createFlight, step } from './flight.js';
import { draw } from './render.js';

const canvas = document.getElementById('stage');
const g = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

let flight = createFlight();
let paused = false;

const keys = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
const down = new Set();

window.addEventListener('keydown', (e) => {
  down.add(e.code);
  if (e.code === 'Escape') paused = !paused;
  if (e.code === 'KeyR') { flight = createFlight(); stageDefault(); }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => down.delete(e.code));

/** Reads the stick: arrows or WASD to fly, shift and ctrl for power. */
function readInput() {
  keys.pitch = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') ? 1 : 0);
  keys.roll = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
  keys.yaw = (down.has('KeyE') ? 1 : 0) - (down.has('KeyQ') ? 1 : 0);
  keys.throttle = (down.has('ShiftLeft') || down.has('ShiftRight') ? 1 : 0) - (down.has('ControlLeft') ? 1 : 0);
  return keys;
}

/** The attitude a screenshot wants, set straight rather than flown to. */
function stageShot(kind) {
  flight = createFlight();
  if (kind === 'approach') {
    // on final: wings level, a shallow descent, the runway and the first ring ahead
    flight.x = -40; flight.z = -2400; flight.alt = 460;
    flight.pitch = -0.04; flight.roll = 0.03; flight.speed = 210; flight.throttle = 0.32;
    flight.ringsPassed = 2;
    flight.distance = 41000;
  } else if (kind === 'valley') {
    // banked through the valley, the next ring of centre
    flight.x = 110; flight.z = 2050; flight.alt = 1250;
    flight.yaw = 0.10; flight.pitch = 0.02; flight.roll = -0.30;
    flight.speed = 335; flight.throttle = 0.78;
    flight.ringsPassed = 3;
    flight.distance = 62000;
  } else if (kind === 'ridge') {
    // climbing over the ridge line, sun off the port wing
    flight.x = -300; flight.z = 3600; flight.alt = 1500;
    flight.yaw = -0.16; flight.pitch = 0.06; flight.roll = 0.38;
    flight.speed = 300; flight.throttle = 0.9;
    flight.ringsPassed = 5;
    flight.distance = 88000;
  }
}

function stageDefault() {
  flight.pitch = -0.075;
  flight.speed = 265;
  flight.throttle = 0.45;
}

if (shot) {
  stageShot(shot);
  draw(g, flight);
} else {
  stageDefault();
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      const input = readInput();
      step(flight, input, dt);
      checkRings(flight);
    }
    draw(g, flight);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** A ring counts when the aircraft passes inside it, along the route's order. */
function checkRings(f) {
  const ring = RINGS[f.ringsPassed];
  if (!ring) return;
  const dz = ring.z - f.z;
  if (dz < -60) { f.ringsMissed++; f.ringsPassed++; return; }
  if (Math.abs(dz) < 90) {
    const dx = Math.abs(ring.x - f.x);
    const dy = Math.abs(ring.alt - f.alt);
    if (dx < ring.r && dy < ring.r) f.ringsPassed++;
  }
}
