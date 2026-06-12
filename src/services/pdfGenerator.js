const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'letterTemplate.html');
const BG_IMAGE_PATH = path.join(__dirname, '..', 'templates', 'rainbow-bridge-bg.png');

const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;
const CONTENT_TOP_PADDING = 320;
const CONTENT_BOTTOM_PADDING = 140;
const CONTENT_SIDE_PADDING = 52;
const CONTENT_AREA_HEIGHT = PAGE_HEIGHT - CONTENT_TOP_PADDING - CONTENT_BOTTOM_PADDING;

function getBgDataUrl() {
  const bgImageBase64 = fs.readFileSync(BG_IMAGE_PATH).toString('base64');
  return `data:image/png;base64,${bgImageBase64}`;
}

function parseParagraphs(letterBody) {
  return letterBody.split('\n\n').filter(p => p.trim()).map(p => p.trim().replace(/\n/g, ' '));
}

function buildSinglePageHtml({ calledYou, paragraphs, petName, bgDataUrl, includeSignature }) {
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const bodyHtml = paragraphs.map(p => `<p>${p}</p>`).join('\n      ');
  const signatureHtml = includeSignature ? `
    <div class="signature-block">
      <div class="pet-name">${petName} 🐾</div>
      <div class="forever-text">Forever Loved. Never Gone.</div>
      <div class="forever-line"></div>
    </div>` : '';

  return template
    .replace('{{BACKGROUND_IMAGE}}', bgDataUrl)
    .replace('{{CALLED_YOU}}', calledYou)
    .replace(/\{\{LETTER_BODY\}\}[\s\S]*?\{\{PET_NAME\}\}[^<]*🐾<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/, '')
    .replace('{{LETTER_BODY}}', bodyHtml)
    .replace(/\s*<div class="signature-block">[\s\S]*?<\/div>\s*<\/div>\s*$/, `${signatureHtml}\n  </div>\n</body>`);
}

function buildPageHtml({ calledYou, paragraphs, petName, bgDataUrl, isFirstPage, includeSignature }) {
  const bodyHtml = paragraphs.map(p => `<p>${p}</p>`).join('\n');

  const greetingHtml = isFirstPage
    ? `<div class="greeting">Dear ${calledYou},<span class="greeting-heart">♥</span></div>`
    : '';

  const signatureHtml = includeSignature ? `
    <div class="signature-block">
      <div class="pet-name">${petName} 🐾</div>
      <div class="forever-text">Forever Loved. Never Gone.</div>
      <div class="forever-line"></div>
    </div>` : '';

  const bgDataUrl64 = bgDataUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&display=swap" rel="stylesheet"/>
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
    }
    .letter-body p { margin-bottom: 12px; }
    .signature-block { text-align: right; margin-top: 24px; padding-right: 8px; }
    .pet-name { font-family: 'Dancing Script', cursive; font-size: 34px; font-weight: 700; color: #2c2420; }
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

async function measureContentHeight(browser, paragraphs, isFirstPage) {
  const bgDataUrl = getBgDataUrl();
  const html = buildPageHtml({
    calledYou: 'Test',
    paragraphs,
    petName: 'Test',
    bgDataUrl,
    isFirstPage,
    includeSignature: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const height = await page.evaluate(() => {
    const body = document.querySelector('.letter-body');
    const sig = document.querySelector('.signature-block');
    const greeting = document.querySelector('.greeting');
    let total = 0;
    if (greeting) total += greeting.offsetHeight + 18;
    if (body) total += body.offsetHeight;
    if (sig) total += sig.offsetHeight + 24;
    return total;
  });

  await page.close();
  return height;
}

async function findSplitPoint(browser, paragraphs) {
  const topPadding = CONTENT_TOP_PADDING;
  const bottomPadding = CONTENT_BOTTOM_PADDING;
  const greetingHeight = 50;
  const signatureHeight = 80;
  const availablePage1 = PAGE_HEIGHT - topPadding - bottomPadding - greetingHeight - signatureHeight;
  const availablePage2 = PAGE_HEIGHT - 60 - bottomPadding - signatureHeight;

  for (let i = 1; i <= paragraphs.length; i++) {
    const page1Paras = paragraphs.slice(0, i);
    const html = buildPageHtml({
      calledYou: 'Test',
      paragraphs: page1Paras,
      petName: 'Test',
      bgDataUrl: getBgDataUrl(),
      isFirstPage: true,
      includeSignature: false,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const bodyHeight = await page.evaluate(() => {
      const body = document.querySelector('.letter-body');
      return body ? body.offsetHeight : 0;
    });
    await page.close();

    if (bodyHeight > availablePage1) {
      return Math.max(1, i - 1);
    }
  }

  return paragraphs.length;
}

async function generatePdf({ calledYou, letterBody, petName }) {
  const bgDataUrl = getBgDataUrl();
  const paragraphs = parseParagraphs(letterBody);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
