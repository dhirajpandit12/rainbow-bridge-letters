// Soul Blueprint generator — unique-but-deterministic sacred geometry
// Seeded by name + birth date. Same person => same art. JS, drop into pipeline.

const PALETTES = {
  // birth-month (1-12) => palette. Luminous, framable.
  1:  { name: "frost gold",   line: "#e9d8a6", accent: "#f4e9c8", bg1: "#0b1020", bg2: "#05060d" },
  2:  { name: "amethyst",     line: "#c8a2ff", accent: "#e5d4ff", bg1: "#160f24", bg2: "#08050f" },
  3:  { name: "spring rose",  line: "#ffb3c6", accent: "#ffd9e2", bg1: "#1e0f18", bg2: "#0c050a" },
  4:  { name: "verdant",      line: "#a7e8bd", accent: "#d6f5e2", bg1: "#0a1a14", bg2: "#040a08" },
  5:  { name: "sky opal",     line: "#9ad8ff", accent: "#d2efff", bg1: "#0a1622", bg2: "#04080f" },
  6:  { name: "solar gold",   line: "#f2c94c", accent: "#ffe9a8", bg1: "#1a1206", bg2: "#0b0803" },
  7:  { name: "ember",        line: "#ff9e6d", accent: "#ffd0b0", bg1: "#1f0f08", bg2: "#0d0604" },
  8:  { name: "royal jade",   line: "#7ee0c9", accent: "#c7f5ec", bg1: "#0a1c1a", bg2: "#040b0a" },
  9:  { name: "wine gold",    line: "#e0a86a", accent: "#f6d9ac", bg1: "#1c0f0d", bg2: "#0b0605" },
  10: { name: "twilight",     line: "#b7a6ff", accent: "#ddd3ff", bg1: "#120f24", bg2: "#07050f" },
  11: { name: "deep amber",   line: "#f0b429", accent: "#ffdd8a", bg1: "#1a1305", bg2: "#0a0703" },
  12: { name: "silver frost", line: "#d7e3f4", accent: "#ffffff", bg1: "#0c111c", bg2: "#04060b" },
};

const BASE_PATTERNS = ["Flower of Life", "Seed of Life", "Metatron's Field", "Star Lattice", "Vesica Bloom", "Torus Ring"];

function soulNumber(name, birth) {
  const n = name.toUpperCase().replace(/[^A-Z]/g, "")
    .split("").reduce((a, c) => a + (c.charCodeAt(0) - 64), 0);
  const digits = birth.replace(/\D/g, "");
  const b = digits.split("").reduce((a, d) => a + +d, 0);
  const month = parseInt(digits.slice(2, 4) || digits.slice(4, 6) || "6", 10) || 6; // DDMMYYYY assumed
  const seed = n + b;
  return {
    seed,
    petals: 6 + (n % 7),          // 6..12 outer petals
    rings: 3 + (b % 3),           // 3..5 concentric rings
    starPoints: 5 + (seed % 7),   // 5..11 point star overlay
    rotation: (seed % 360),
    month: ((month - 1) % 12) + 1,
    reduced: reduce(seed),        // 1..9 "soul number"
    pattern: BASE_PATTERNS[seed % BASE_PATTERNS.length],
  };
}
function reduce(n){ while(n>9){ n = String(n).split("").reduce((a,d)=>a+ +d,0);} return n; }

const P = (cx, cy, r, ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];

function flowerOfLife(cx, cy, r, stroke, w, rings) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
  let centers = [[cx, cy]];
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < 6 * ring; i++) {
      const ang = (Math.PI / 3) * (i / ring);
      const [x, y] = P(cx, cy, r * ring, ang);
      centers.push([x, y]);
    }
  }
  for (const [x, y] of centers) {
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}" opacity="0.85"/>`;
  }
  return s;
}

function petalRing(cx, cy, radius, petals, stroke, w, rot) {
  let s = "";
  for (let p = 0; p < petals; p++) {
    const ang = (2 * Math.PI / petals) * p + rot;
    const [x, y] = P(cx, cy, radius, ang);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius * 0.5).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${w}" opacity="0.5"/>`;
  }
  return s;
}

function starPolygon(cx, cy, r, points, stroke, w, rot) {
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  let step = Math.floor(points / 2) || 1;
  while (step > 1 && gcd(step, points) !== 1) step--;   // coprime => true star, no degenerate line
  let pts = [];
  for (let i = 0; i < points; i++) {
    const ang = (2 * Math.PI / points) * (i * step) - Math.PI / 2 + rot;
    pts.push(P(cx, cy, r, ang).map(v => v.toFixed(1)).join(","));
  }
  return `<polygon points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${w}" opacity="0.7"/>`;
}

// A single crisp ring of tangent circles (classic sacred-geometry "rosette")
function rosette(cx, cy, radius, count, stroke, w, rot, op) {
  let s = "";
  const cr = radius * Math.sin(Math.PI / count); // tangent radius
  for (let p = 0; p < count; p++) {
    const ang = (2 * Math.PI / count) * p + rot;
    const [x, y] = P(cx, cy, radius, ang);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cr.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${w}" opacity="${op}"/>`;
  }
  return s;
}

// Radial spokes for subtle structure
function spokes(cx, cy, r0, r1, count, stroke, w, rot, op) {
  let s = "";
  for (let i = 0; i < count; i++) {
    const ang = (2 * Math.PI / count) * i + rot;
    const [x0, y0] = P(cx, cy, r0, ang);
    const [x1, y1] = P(cx, cy, r1, ang);
    s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${stroke}" stroke-width="${w}" opacity="${op}"/>`;
  }
  return s;
}

function buildSVG(name, birth, S = 2000, opts = {}) {
  const { showCaption = true, transparentBg = false } = opts;
  const g = soulNumber(name, birth);
  const pal = PALETTES[g.month];
  const cx = S / 2, cy = S / 2;
  const R = S * 0.34;              // master radius scales with canvas
  const k = S / 900;              // stroke scale factor
  const rot = g.rotation * Math.PI / 180;

  const layers = [
    flowerOfLife(cx, cy, R * 0.16, pal.line, 1.4 * k, 1),
    rosette(cx, cy, R * 0.62, g.petals, pal.line, 1.3 * k, rot, 0.72),
    starPolygon(cx, cy, R * 0.9, g.starPoints, pal.accent, 1.3 * k, rot),
    rosette(cx, cy, R * 0.34, g.petals, pal.accent, 0.9 * k, -rot, 0.42),
    spokes(cx, cy, R * 0.16, R * 0.9, g.starPoints, pal.line, 0.5 * k, rot, 0.22),
  ].join("");

  return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="72%">
      <stop offset="0%" stop-color="${pal.bg1}"/>
      <stop offset="100%" stop-color="${pal.bg2}"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${2.2 * k}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softglow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${9 * k}"/>
    </filter>
  </defs>
  ${transparentBg ? '' : `<rect width="${S}" height="${S}" fill="url(#bg)"/>`}
  <!-- faint aura behind the figure -->
  <circle cx="${cx}" cy="${cy}" r="${R * 0.55}" fill="${pal.line}" opacity="0.06" filter="url(#softglow)"/>
  <circle cx="${cx}" cy="${cy}" r="${R * 0.97}" fill="none" stroke="${pal.line}" stroke-width="${1.4 * k}" opacity="0.42"/>
  <circle cx="${cx}" cy="${cy}" r="${R * 1.02}" fill="none" stroke="${pal.line}" stroke-width="${0.6 * k}" opacity="0.2"/>
  <g filter="url(#glow)">${layers}</g>
  <circle cx="${cx}" cy="${cy}" r="${5 * k}" fill="${pal.accent}" filter="url(#glow)"/>
  ${transparentBg ? '' : `<rect width="${S}" height="${S}" fill="url(#vig)"/>`}
  ${showCaption ? `<text x="${cx}" y="${S - 100 * k}" text-anchor="middle" fill="${pal.line}" opacity="0.92"
    font-family="Georgia, 'Times New Roman', serif" font-size="${34 * k}" letter-spacing="${7 * k}">${name.toUpperCase()}</text>
  <text x="${cx}" y="${S - 60 * k}" text-anchor="middle" fill="${pal.accent}" opacity="0.55"
    font-family="Georgia, serif" font-size="${14 * k}" letter-spacing="${5 * k}">SOUL NUMBER ${g.reduced}  ·  ${pal.name.toUpperCase()}</text>` : ''}
</svg>`;
}

module.exports = { buildSVG, soulNumber, BASE_PATTERNS, PALETTES };

// Demo render when run directly
if (require.main === module) {
  const sharp = require("sharp");
  const fs = require("fs");
  const samples = [
    ["Amelia", "14/03/1994"],
    ["Rohan",  "09/11/1988"],
    ["Sofia",  "27/06/2001"],
  ];
  (async () => {
    for (const [name, birth] of samples) {
      const svg = buildSVG(name, birth, 2000);
      const g = soulNumber(name, birth);
      const file = `/mnt/user-data/outputs/blueprint_${name.toLowerCase()}`;
      fs.writeFileSync(file + ".svg", svg);
      await sharp(Buffer.from(svg)).png().toFile(file + ".png");
      console.log(`${name} (${birth}) -> soul#${g.reduced}, ${g.petals} petals, ${g.rings} rings, ${g.starPoints}-pt star, ${PALETTES[g.month].name}`);
    }
    console.log("done");
  })();
}
