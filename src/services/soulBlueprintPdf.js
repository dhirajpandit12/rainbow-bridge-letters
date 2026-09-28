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

  // Dark mandala (cover + dark framable page): no baked caption, transparent bg.
  const svg = buildSVG(name, birth, 4000, { showCaption: false, transparentBg: true });
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Light mandala (print-friendly white framable page): dark line-art, no glow.
  const svgLight = buildSVG(name, birth, 4000, { showCaption: false, transparentBg: true, lightTheme: true });
  const pngLightBuffer = await sharp(Buffer.from(svgLight)).png().toBuffer();

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pngPath = path.join(os.tmpdir(), `blueprint-${stamp}.png`);
  const pngLightPath = path.join(os.tmpdir(), `blueprint-light-${stamp}.png`);
  const pdfPath = path.join(os.tmpdir(), `blueprint-${stamp}.pdf`);
  fs.writeFileSync(pngPath, pngBuffer);
  fs.writeFileSync(pngLightPath, pngLightBuffer);

  try {
    const meta = `SOUL NUMBER ${g.reduced}  ·  ${pal.name.toUpperCase()}  ·  ${g.pattern.toUpperCase()}`;
    const frameMeta = `SOUL NUMBER ${g.reduced}  ·  ${pal.name.toUpperCase()}`;
    const focus = intention && intention.trim() ? `FOCUSED TOWARD  ·  ${intention.trim().toUpperCase()}` : null;
    await buildKeepsakePDF({ name, meta, frameMeta, focus, imagePath: pngPath, lightImagePath: pngLightPath, reading, closing, outPath: pdfPath });
    const buffer = fs.readFileSync(pdfPath);
    return buffer;
  } finally {
    for (const p of [pngPath, pngLightPath, pdfPath]) {
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
