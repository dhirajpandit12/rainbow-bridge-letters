// Browser-free Soul Blueprint keepsake PDF — pdfkit only, NO Puppeteer/Chromium.
// Input: blueprint PNG (glow already baked by sharp) + reading object. Output: 4-page PDF.

const PDFDocument = require("pdfkit");
const fs = require("fs");

function buildKeepsakePDF({ name, meta, frameMeta, focus, imagePath, reading, closing, outPath }) {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const W = doc.page.width;    // 595.28 pt (A4)
  const H = doc.page.height;   // 841.89 pt
  const GOLD = "#b08a2e", GOLD_L = "#e9d8a6", INK = "#2a2620", IVORY = "#f7f3ea";

  // ---------- PAGE 1: COVER ----------
  doc.rect(0, 0, W, H).fill("#0a0a12");                 // dark bg
  doc.fillColor(GOLD_L).font("Times-Roman");
  doc.fontSize(11).text("YOUR SACRED GEOMETRY", 0, 70, { align: "center", characterSpacing: 6 });
  doc.fontSize(30).text("SOUL BLUEPRINT", 0, 92, { align: "center", characterSpacing: 8 });

  const imgW = 360, imgX = (W - imgW) / 2, imgY = 150;
  doc.image(imagePath, imgX, imgY, { width: imgW, height: imgW });  // glow baked in PNG

  doc.fontSize(22).fillColor(GOLD_L)
    .text(name.toUpperCase(), 0, imgY + imgW + 24, { align: "center", characterSpacing: 6 });
  doc.fontSize(9).fillColor(GOLD)
    .text(meta, 0, imgY + imgW + 58, { align: "center", characterSpacing: 3 });
  if (focus) {
    doc.fontSize(8).fillColor(GOLD_L).opacity(0.75)
      .text(focus, 0, imgY + imgW + 76, { align: "center", characterSpacing: 3 })
      .opacity(1);
  }
  doc.fontSize(8).fillColor(GOLD_L).opacity(0.6)
    .text("PREPARED BY LUNA EVERLY", 0, H - 70, { align: "center", characterSpacing: 5 })
    .opacity(1);

  // ---------- READING PAGES ----------
  const secs = Object.entries(reading);
  const groups = [secs.slice(0, 2), secs.slice(2, 4), secs.slice(4)];
  const M = 68;                                          // page margin for text

  groups.forEach((group, gi) => {
    doc.addPage();
    doc.rect(0, 0, W, H).fill(IVORY);                   // ivory bg
    doc.fillColor(GOLD).font("Times-Roman").fontSize(9)
      .text(`${name.toUpperCase()}  ·  SOUL BLUEPRINT`, 0, 60, { align: "center", characterSpacing: 5 });
    doc.moveTo(W / 2 - 40, 90).lineTo(W / 2 + 40, 90).lineWidth(0.6).strokeColor("#d9c48a").stroke();

    let y = 120;
    group.forEach(([title, body]) => {
      doc.fillColor(GOLD).fontSize(12)
        .text(title.toUpperCase(), M, y, { characterSpacing: 2 });
      y = doc.y + 8;
      doc.fillColor(INK).fontSize(12)
        .text(body, M, y, { width: W - M * 2, align: "justify", lineGap: 6 });
      y = doc.y + 22;
    });

    if (gi === groups.length - 1 && closing) {
      doc.fillColor("#8a6d1e").font("Times-Italic").fontSize(15)
        .text(closing, M, y + 20, { width: W - M * 2, align: "center", lineGap: 4 });
    }
    doc.font("Times-Roman").fillColor("#b6a67e").fontSize(8)
      .text(`LUNA EVERLY  ·  ${gi + 2}`, 0, H - 50, { align: "center", characterSpacing: 4 });
  });

  // ---------- FINAL PAGE: FRAMABLE ART (print & frame) ----------
  // Clean gallery piece — just the mandala inside an elegant border, name + soul caption.
  // No header, no "prepared by", no page number.
  doc.addPage();
  doc.rect(0, 0, W, H).fill("#0a0a12");                    // dark bg

  const pad = 34;                                          // double gold border (mat/frame)
  doc.lineWidth(1.4).strokeColor(GOLD).opacity(0.85)
    .rect(pad, pad, W - pad * 2, H - pad * 2).stroke();
  doc.lineWidth(0.5).strokeColor(GOLD_L).opacity(0.5)
    .rect(pad + 7, pad + 7, W - (pad + 7) * 2, H - (pad + 7) * 2).stroke();
  doc.opacity(1);

  const fW = 400, fX = (W - fW) / 2, fY = 165;             // large centered mandala
  doc.image(imagePath, fX, fY, { width: fW, height: fW });

  doc.fillColor(GOLD_L).font("Times-Roman").fontSize(26)
    .text(name.toUpperCase(), 0, fY + fW + 42, { align: "center", characterSpacing: 8 });
  doc.fillColor(GOLD).fontSize(10)
    .text(frameMeta || meta, 0, fY + fW + 80, { align: "center", characterSpacing: 4 });

  doc.end();
  return new Promise((res) => stream.on("finish", () => res(outPath)));
}

module.exports = { buildKeepsakePDF };

// Demo
if (require.main === module) {
  const reading = {
    "Your Shape": "Sofia, when your blueprint came through, it arrived as a Metatron's Field — three concentric rings holding seven luminous petals, crossed by a ten-pointed star, all of it burning in solar gold. This is not a shape I assign. It is the shape that formed when your name and the light of your birth-day were laid over one another. Three rings means your soul moves in threes — beginning, unraveling, becoming — always circling back to start again, wiser. Seven petals is a seeker's number, and gold is the color of a soul that was never meant to stay small.",
    "What It Means": "A Metatron's Field is the geometry of a builder and a bridge. Every line in it touches every other line — nothing in you stands alone. This is why you have always felt things at full volume, Sofia: joy, restlessness, love, the itch to move. Your ten-pointed star is the mark of someone who holds two worlds at once — the dreamer and the doer. Your blueprint doesn't ask you to choose between them. It was drawn to hold both.",
    "The Pattern in Your Life": "Look at how you love and work, and you'll see these rings turning. You throw yourself in fully, then you need air, then you return — and the people who understand you have learned that your leaving is never abandoning. Soul number five is the number of change and of freedom. A seven-petaled soul doesn't grow in a straight line; it blooms outward, in every direction at once. What has looked like restlessness has always been your blueprint doing exactly what it was made to do.",
    "Your Hidden Frequency": "Here is what your gold is hiding, Sofia. The ten points of your star meet at a single center — the quietest part of you, the part you rarely show. Your gift is not the movement. It is the stillness underneath it that you keep forgetting you have. When you stop running long enough to feel it, you become magnetic. Your lesson is to trust that you can be still without disappearing. The center of your blueprint has never once moved.",
    "Living Your Blueprint": "Once a week, sit with your blueprint in front of you and find its center point — the single gold star at the heart. Breathe there for one minute. That point is you, underneath everything. Return to it whenever the world asks you to be smaller than seven petals wide.",
  };
  buildKeepsakePDF({
    name: "Sofia",
    meta: "SOUL NUMBER 5  ·  SOLAR GOLD  ·  METATRON'S FIELD",
    imagePath: "/mnt/user-data/outputs/blueprint_sofia.png",
    reading,
    closing: "You were drawn whole, Sofia. Live like it.",
    outPath: "/mnt/user-data/outputs/soul-blueprint-nopuppeteer.pdf",
  }).then(p => console.log("built (no browser):", p));
}
