// The world's numbers: the terrain, the instruments' ranges, and the colours the renderer reads.
// Nothing here draws; it only says what the sky and the ground are made of.
export const W = 1280;
export const H = 720;

// The palette: a late afternoon over a coastal range, warm haze near the horizon, cold sky above.
export const C = {
  skyTop: '#1b3a5c',
  skyMid: '#3d6a8f',
  skyLow: '#a8b8b4',
  haze: '#efe2c8',
  sunGlow: '#f2c27a',
  sun: '#fff0c8',
  ridgeFar: '#8a9a92',
  ridgeMid: '#6b7a4a',
  ridgeNear: '#4a5530',
  ground: '#7fa03f',
  groundDark: '#4a6b28',
  groundLight: '#b4cc60',
  water: '#2f5566',
  runway: '#3a3a38',
  runwayLine: '#e8e4d8',
  aircraft: '#c8ccd0',
  aircraftDark: '#6e767c',
  aircraftShade: '#8a9298',
  canopy: '#2e4a5e',
  glow: '#e8a24a',
  hot: '#e05a2e',
  target: '#f0c040',
  targetDim: '#8a7030',
  hud: '#8ff0c0',
  hudDim: '#3f7a62',
  hudWarn: '#f0a040',
  hudBad: '#e0542e',
  ink: '#0a1014',
  paper: '#e8e4d8',
};

// The flight model. Speeds in knots, altitudes in feet, angles in radians per second.
export const FLIGHT = {
  cruise: 320,          // knots, the speed the throttle settles at
  stall: 110,
  maxBank: 1.15,        // radians of roll the aircraft will hold
  pitchRate: 1.25,
  rollRate: 2.1,
  yawRate: 0.9,
  gravity: 32.174,      // ft/s^2, for the climb the wing can hold at a bank
  zoom: 1.35,           // how much the projected world is magnified
  horizonLift: 0.02,    // radians the horizon sits above centre at level flight
};

// The world: rings to fly through, laid along a valley so a route reads from the air.
export const RINGS = [
  { x: 0, z: 900, alt: 1200, r: 90 },
  { x: 180, z: 1700, alt: 1500, r: 90 },
  { x: 120, z: 2500, alt: 1100, r: 85 },
  { x: -160, z: 3200, alt: 900, r: 85 },
  { x: -320, z: 4000, alt: 1300, r: 95 },
  { x: -280, z: 4900, alt: 1700, r: 95 },
  { x: -60, z: 5700, alt: 1500, r: 90 },
  { x: 200, z: 6400, alt: 1150, r: 90 },
];

// The runway the flight starts over, and the one it lands on.
export const RUNWAY = { x: 0, z: 0, length: 1400, width: 45, heading: 0 };

// Terrain: a heightfield sampled on a grid, so the projection has something to fold over.
export const TERRAIN = {
  span: 9000,        // world units across the visible square
  step: 300,         // grid spacing
  base: 0,           // sea level
  ridgeHeight: 900,  // the tallest ridge, before noise
};
