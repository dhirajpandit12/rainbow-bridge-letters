// Soul Blueprint keepsake PDF — browser-free (sharp SVG→PNG + pdfkit). No Puppeteer.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { buildSVG, soulNumber, PALETTES } = require('./blueprint-generator');
const { buildKeepsakePDF } = require('./keepsake-pdfkit');

// Generates the keepsake PDF and returns it as a Buffer. Cleans up temp files.
async function generateSoulBlueprintPdf({ name, birth, reading, closing, intention }) {
  const g = soulNumber(name, birth);
  const pal = PALETTES[g.month];

  // Cover mandala: no baked caption (avoids double name), transparent bg (no square edge).
  const svg = buildSVG(name, birth, 2000, { showCaption: false, transparentBg: true });
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pngPath = path.join(os.tmpdir(), `blueprint-${stamp}.png`);
  const pdfPath = path.join(os.tmpdir(), `blueprint-${stamp}.pdf`);
  fs.writeFileSync(pngPath, pngBuffer);

  try {
    const meta = `SOUL NUMBER ${g.reduced}  ·  ${pal.name.toUpperCase()}  ·  ${g.pattern.toUpperCase()}`;
    const frameMeta = `SOUL NUMBER ${g.reduced}  ·  ${pal.name.toUpperCase()}`;
    const focus = intention && intention.trim() ? `FOCUSED TOWARD  ·  ${intention.trim().toUpperCase()}` : null;
    await buildKeepsakePDF({ name, meta, frameMeta, focus, imagePath: pngPath, reading, closing, outPath: pdfPath });
    const buffer = fs.readFileSync(pdfPath);
    return buffer;
  } finally {
    for (const p of [pngPath, pdfPath]) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
  }
}

// Structural facts for the reading prompt so the words match the image.
function blueprintFacts(name, birth) {
  const g = soulNumber(name, birth);
  const pal = PALETTES[g.month];
  return {
    pattern: g.pattern,
    rings: g.rings,
    petals: g.petals,
    starPoints: g.starPoints,
    soulNumber: g.reduced,
    colorName: pal.name,
    seed: g.seed,
  };
}

module.exports = { generateSoulBlueprintPdf, blueprintFacts };
