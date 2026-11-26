// The aircraft's flight model: what the stick does to pitch, roll and yaw, what the wing holds at
// a bank, and where the aircraft ends up each frame. Pure arithmetic over a state object, so the
// renderer can read it and a screenshot can stage any attitude.
import { FLIGHT } from './config.js';

/** A flight at rest above the runway's threshold, level and on heading. */
export function createFlight() {
  return {
    x: 0, z: -2200, alt: 900,
    yaw: 0, pitch: 0, roll: 0,
    speed: FLIGHT.cruise,
    throttle: 0.72,
    pitchRate: 0, rollRate: 0, yawRate: 0,
    gLoad: 1, stalled: false,
    onGround: false, crashed: false,
    distance: 0, ringsPassed: 0, ringsMissed: 0,
    t: 0,
  };
}

/**
 * Advances the flight by dt seconds with an input of { pitch, roll, yaw, throttle } each in -1..1.
 * Returns the same state, changed.
 */
export function step(f, input, dt) {
  f.t += dt;

  // the stick builds a rate and the rate decays, so the aircraft answers at once but settles
  f.pitchRate = approach(f.pitchRate, input.pitch * FLIGHT.pitchRate, dt * 8);
  f.rollRate = approach(f.rollRate, input.roll * FLIGHT.rollRate, dt * 8);
  f.yawRate = approach(f.yawRate, input.yaw * FLIGHT.yawRate, dt * 6);

  f.pitch = clamp(f.pitch + f.pitchRate * dt, -1.1, 1.1);
  f.roll = clamp(f.roll + f.rollRate * dt, -FLIGHT.maxBank, FLIGHT.maxBank);
  f.yaw += f.yawRate * dt;

  // the bank turns the aircraft: a coordinated turn at this bank and speed
  const bankTurn = Math.tan(f.roll) * (FLIGHT.gravity / 100) * (FLIGHT.cruise / Math.max(60, f.speed));
  f.yaw += bankTurn * dt * 0.55;

  // the wing holds the load its bank demands; too much and the aircraft stalls
  f.gLoad = 1 / Math.max(0.2, Math.cos(f.roll));
  f.throttle = clamp(f.throttle + input.throttle * dt * 0.6, 0, 1);
  const target = FLIGHT.stall + (FLIGHT.cruise - FLIGHT.stall) * f.throttle;
  f.speed = approach(f.speed, target, dt * 22);
  f.stalled = f.speed < FLIGHT.stall + 8 || f.gLoad > 4.2;

  // the climb follows the pitch and the power left over
  const climb = Math.sin(f.pitch) * f.speed * 1.688 * 60 * 0.32;
  f.alt = Math.max(0, f.alt + climb * dt);
  f.alt -= (f.stalled ? 120 : 0) * dt;

  // ground track
  const forward = f.speed * 1.688;
  f.x += Math.sin(f.yaw) * forward * dt;
  f.z += Math.cos(f.yaw) * forward * dt;
  f.distance += forward * dt;
  return f;
}

/** Moves a value toward a target at a bounded rate. */
function approach(v, target, rate) {
  const d = target - v;
  return Math.abs(d) <= rate ? target : v + Math.sign(d) * rate;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** The heading in degrees, 0 at north and turning east, the way a compass reads it. */
export function headingDeg(f) {
  let d = (f.yaw * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return d;
}

/** The pitch in degrees, positive climbing. */
export function pitchDeg(f) { return (f.pitch * 180) / Math.PI; }
