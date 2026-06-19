const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

const BG_IMAGE_PATH = path.join(__dirname, '..', 'templates', 'rainbow-bridge-bg.png');

const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;
const CONTENT_TOP_PADDING = 320;
const CONTENT_BOTTOM_PADDING = 175;
const CONTENT_SIDE_PADDING = 52;
const COLUMN_GAP = 28;
const CONTENT_AREA_HEIGHT = PAGE_HEIGHT - CONTENT_TOP_PADDING - CONTENT_BOTTOM_PADDING;

function getBgDataUrl() {
  const bgImageBase64 = fs.readFileSync(BG_IMAGE_PATH).toString('base64');
  return `data:image/png;base64,${bgImageBase64}`;
}

function parseParagraphs(letterBody) {
  return letterBody.split('\n\n').filter(p => p.trim()).map(p => p.trim().replace(/\n/g, ' '));
}


function buildPageHtml({ calledYou, paragraphs, petName, bgDataUrl, isFirstPage, includeSignature }) {
  const bodyHtml = paragraphs.map(p => `<p>${p}</p>`).join('\n');

  const greetingHtml = isFirstPage
    ? `<div class="greeting">Dear ${calledYou},<span class="greeting-heart">♥</span></div>`
    : '';

  const signatureHtml = includeSignature ? `
    <div class="signature-block">
      <div class="pet-name">${petName}<svg class="paw" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse class="paw-pad" cx="20" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="80" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="6" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="94" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="50" cy="72" rx="30" ry="24"/></svg></div>
      <div class="forever-text">Forever Loved. Never Gone.</div>
      <div class="forever-line"></div>
    </div>` : '';

  const bgDataUrl64 = bgDataUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&family=Noto+Emoji&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; overflow: hidden; }
    .page {
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      position: relative;
      background-image: url('${bgDataUrl64}');
      background-size: cover;
      background-position: center;
      padding: ${CONTENT_TOP_PADDING}px ${CONTENT_SIDE_PADDING}px ${CONTENT_BOTTOM_PADDING}px ${CONTENT_SIDE_PADDING}px;
      overflow: hidden;
    }
    .greeting {
      font-family: 'Dancing Script', cursive;
      font-size: 28px;
      font-weight: 600;
      color: #c47d7d;
      margin-bottom: 18px;
    }
    .greeting-heart { color: #e8a0a0; font-size: 22px; margin-left: 6px; }
    .letter-body {
      font-family: 'Lato', sans-serif;
      font-size: 13.2px;
      font-weight: 400;
      line-height: 1.85;
      color: #1a1210;
      column-count: 2;
      column-gap: ${COLUMN_GAP}px;
    }
    .letter-body p { margin-bottom: 12px; }
    .signature-block { text-align: right; margin-top: 24px; padding-right: 8px; }
    .pet-name { font-family: 'Dancing Script', cursive; font-size: 34px; font-weight: 700; color: #2c2420; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .paw { display: inline-block; width: 26px; height: 26px; }
    .paw-pad { fill: #2c2420; }
    .forever-text { font-size: 10px; color: #c4913a; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
    .forever-line { width: 90px; height: 1.5px; background: #c47d7d; margin: 5px 0 0 auto; }
  </style>
</head>
<body>
  <div class="page">
    ${greetingHtml}
    <div class="letter-body">${bodyHtml}</div>
    ${signatureHtml}
  </div>
</body>
</html>`;
}


async function measure2ColHeight(browser, paragraphs) {
  const contentWidth = PAGE_WIDTH - CONTENT_SIDE_PADDING * 2;
  const measureHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${PAGE_WIDTH}px; }
    .measure {
      width: ${contentWidth}px;
      font-family: 'Lato', sans-serif;
      font-size: 13.2px;
      font-weight: 400;
      line-height: 1.85;
      color: #1a1210;
      column-count: 2;
      column-gap: ${COLUMN_GAP}px;
    }
    .measure p { margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="measure" id="box">
    ${paragraphs.map(p => `<p>${p}</p>`).join('\n')}
  </div>
</body>
</html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: 9999 });
  await page.setContent(measureHtml, { waitUntil: 'networkidle0' });
  const height = await page.evaluate(() => document.getElementById('box').offsetHeight);
  await page.close();
  return height;
}

async function findSplitPoint(browser, paragraphs) {
  const GREETING_HEIGHT = 55;
  const SIGNATURE_HEIGHT = 114;

  const availableSinglePage = CONTENT_AREA_HEIGHT - GREETING_HEIGHT - SIGNATURE_HEIGHT;
  const availablePage1 = CONTENT_AREA_HEIGHT - GREETING_HEIGHT;

  const totalHeight = await measure2ColHeight(browser, paragraphs);
  if (totalHeight <= availableSinglePage) return paragraphs.length;

  let lo = 1, hi = paragraphs.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const h = await measure2ColHeight(browser, paragraphs.slice(0, mid));
    if (h <= availablePage1) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

async function generatePdf({ calledYou, letterBody, petName }) {
  const bgDataUrl = getBgDataUrl();
  const paragraphs = parseParagraphs(letterBody);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const splitAt = await findSplitPoint(browser, paragraphs);
    const needsTwoPages = splitAt < paragraphs.length;

    const pdfBuffers = [];

    if (!needsTwoPages) {
      const html = buildPageHtml({
        calledYou, paragraphs, petName, bgDataUrl,
        isFirstPage: true, includeSignature: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
        printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await page.close();
      return pdf;
    }

    const page1Paras = paragraphs.slice(0, splitAt);
    const page2Paras = paragraphs.slice(splitAt);

    for (let i = 0; i < 2; i++) {
      const isFirst = i === 0;
      const paras = isFirst ? page1Paras : page2Paras;
      const html = buildPageHtml({
        calledYou, paragraphs: paras, petName, bgDataUrl,
        isFirstPage: isFirst, includeSignature: !isFirst,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
        printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await page.close();
      pdfBuffers.push(pdf);
    }

    return await mergePdfs(pdfBuffers);
  } finally {
    await browser.close();
  }
}

async function mergePdfs(buffers) {
  const { PDFDocument } = require('pdf-lib');
  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    const doc = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }

  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes);
}

module.exports = { generatePdf };
