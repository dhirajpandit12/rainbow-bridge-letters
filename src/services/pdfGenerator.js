const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');
const { getInlineFontCss } = require('./fonts');
const { fetchImageAsDataUrl } = require('./imageFetch');

const BG_IMAGE_PATH = path.join(__dirname, '..', 'templates', 'rainbow-bridge-bg.png');

const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;
const CONTENT_TOP_PADDING = 320;
const CONTENT_BOTTOM_PADDING = 260;
const CONTENT_BOTTOM_PADDING_P1 = 180;
const CONTENT_SIDE_PADDING = 52;
const COLUMN_GAP = 28;
const SIGNATURE_HEIGHT = 90;
const SIGNATURE_HEIGHT_PHOTO = 175;

function getBgDataUrl() {
  const bgImageBase64 = fs.readFileSync(BG_IMAGE_PATH).toString('base64');
  return `data:image/png;base64,${bgImageBase64}`;
}

function parseParagraphs(letterBody) {
  return letterBody.split('\n\n').filter(p => p.trim()).map(p => p.trim().replace(/\n/g, ' '));
}

function splitParagraphsByWordCount(paragraphs) {
  const totalWords = paragraphs.reduce((sum, p) => sum + p.split(' ').length, 0);
  const target = Math.floor(totalWords * 0.44);
  let count = 0;
  let splitIdx = Math.floor(paragraphs.length / 2);
  for (let i = 0; i < paragraphs.length - 1; i++) {
    count += paragraphs[i].split(' ').length;
    if (count >= target) {
      splitIdx = i + 1;
      break;
    }
  }
  return [paragraphs.slice(0, splitIdx), paragraphs.slice(splitIdx)];
}

function buildPageHtml({ calledYou, paragraphs, petName, bgDataUrl, isFirstPage, includeSignature, fontCss, photoDataUrl }) {
  const bodyHtml = paragraphs.map(p => `<p>${p}</p>`).join('\n');

  const photoHtml = (includeSignature && photoDataUrl)
    ? `<div class="sig-photo"><img src="${photoDataUrl}" alt="${petName}"/></div>`
    : '';

  const greetingHtml = isFirstPage
    ? `<div class="greeting">Dear ${calledYou},<span class="greeting-heart">♥</span></div>`
    : '';

  const signatureHtml = includeSignature ? `
    <div class="signature-block">
      <div class="pet-name">${petName}<svg class="paw" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse class="paw-pad" cx="20" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="80" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="6" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="94" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="50" cy="72" rx="30" ry="24"/></svg></div>
      <div class="forever-text">Forever Loved. Never Gone.</div>
      <div class="forever-line"></div>
    </div>` : '';

  const sigHeight = photoDataUrl ? SIGNATURE_HEIGHT_PHOTO : SIGNATURE_HEIGHT;
  const textBottom = includeSignature
    ? CONTENT_BOTTOM_PADDING + sigHeight + 16
    : (isFirstPage ? CONTENT_BOTTOM_PADDING_P1 : CONTENT_BOTTOM_PADDING);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  ${fontCss}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; overflow: hidden; }
    .page {
      width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
      position: relative;
      background-image: url('${bgDataUrl}');
      background-size: cover; background-position: center;
    }
    .text-area {
      position: absolute;
      top: ${CONTENT_TOP_PADDING}px;
      left: ${CONTENT_SIDE_PADDING}px;
      right: ${CONTENT_SIDE_PADDING}px;
      bottom: ${textBottom}px;
      overflow: hidden;
    }
    .sig-area {
      position: absolute;
      bottom: ${CONTENT_BOTTOM_PADDING}px;
      left: ${CONTENT_SIDE_PADDING}px;
      right: ${CONTENT_SIDE_PADDING}px;
      height: ${sigHeight}px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-end;
      gap: 10px;
      padding-right: 8px;
    }
    .sig-text { text-align: right; }
    .sig-photo {
      width: 90px; height: 90px; border-radius: 50%; overflow: hidden;
      border: 3px solid #c47d7d;
    }
    .sig-photo img { width: 100%; height: 100%; object-fit: cover; }
    .greeting {
      font-family: 'Dancing Script', cursive;
      font-size: 28px; font-weight: 600; color: #c47d7d; margin-bottom: 18px;
    }
    .greeting-heart { color: #e8a0a0; font-size: 22px; margin-left: 6px; }
    .letter-body {
      font-family: 'Lato', sans-serif;
      font-size: 11.4px; font-weight: 400; line-height: 1.72; color: #1a1210;
      column-count: 2; column-gap: ${COLUMN_GAP}px;
    }
    .letter-body p { margin-bottom: 8px; }
    .pet-name { font-family: 'Dancing Script', cursive; font-size: 34px; font-weight: 700; color: #2c2420; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .paw { display: inline-block; width: 26px; height: 26px; }
    .paw-pad { fill: #2c2420; }
    .forever-text { font-size: 10px; color: #c4913a; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
    .forever-line { width: 90px; height: 1.5px; background: #c47d7d; margin: 5px 0 0 auto; }
  </style>
</head>
<body>
  <div class="page">
    <div class="text-area">
      ${greetingHtml}
      <div class="letter-body">${bodyHtml}</div>
    </div>
    ${includeSignature ? `
    <div class="sig-area">
      ${photoHtml}
      <div class="sig-text">
        <div class="pet-name">${petName}<svg class="paw" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse class="paw-pad" cx="20" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="80" cy="28" rx="11" ry="15"/><ellipse class="paw-pad" cx="6" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="94" cy="58" rx="9" ry="13"/><ellipse class="paw-pad" cx="50" cy="72" rx="30" ry="24"/></svg></div>
        <div class="forever-text">Forever Loved. Never Gone.</div>
        <div class="forever-line"></div>
      </div>
    </div>` : ''}
  </div>
</body>
</html>`;
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

async function generatePdf({ calledYou, letterBody, petName, photoUrl }) {
  const bgDataUrl = getBgDataUrl();
  const fontCss = await getInlineFontCss();
  const paragraphs = parseParagraphs(letterBody);
  const [page1Paras, page2Paras] = splitParagraphsByWordCount(paragraphs);

  let photoDataUrl = null;
  if (photoUrl) {
    photoDataUrl = await fetchImageAsDataUrl(photoUrl);
    if (!photoDataUrl) console.warn('[RainbowPdf] Could not fetch pet photo, rendering without it');
  }

  const isLocal = process.env.IS_LOCAL === 'true';
  const browser = await puppeteer.launch(isLocal ? {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--no-sandbox'],
  } : {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const pdfBuffers = [];

    const pg1 = await browser.newPage();
    await pg1.setContent(buildPageHtml({
      calledYou, paragraphs: page1Paras, petName, bgDataUrl,
      isFirstPage: true, includeSignature: false, fontCss,
    }), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg1.evaluate(() => document.fonts.ready);
    pdfBuffers.push(await pg1.pdf({
      width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
      printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
    await pg1.close();

    const pg2 = await browser.newPage();
    await pg2.setContent(buildPageHtml({
      calledYou, paragraphs: page2Paras, petName, bgDataUrl,
      isFirstPage: false, includeSignature: true, fontCss, photoDataUrl,
    }), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg2.evaluate(() => document.fonts.ready);
    pdfBuffers.push(await pg2.pdf({
      width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
      printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
    await pg2.close();

    return await mergePdfs(pdfBuffers);
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
