const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BG_IMAGE_PATH = path.join(__dirname, '..', 'templates', 'soul-reading-bg.png');

const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;
const CONTENT_TOP = 310;
const CONTENT_BOTTOM = 110;
const CONTENT_SIDE = 40;
const COLUMN_GAP = 52;
const CONTENT_WIDTH = PAGE_WIDTH - CONTENT_SIDE * 2;

function getBgDataUrl() {
  const base64 = fs.readFileSync(BG_IMAGE_PATH).toString('base64');
  return `data:image/png;base64,${base64}`;
}

function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || 'image/jpeg';
        resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function stripMarkdown(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&display=swap" rel="stylesheet" crossorigin="anonymous"/>`;

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; overflow: hidden; }
  .page {
    width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
    position: relative;
    background-size: cover; background-position: center;
  }
  .content {
    position: absolute;
    top: ${CONTENT_TOP}px;
    left: ${CONTENT_SIDE}px;
    width: ${CONTENT_WIDTH}px;
    bottom: ${CONTENT_BOTTOM}px;
    overflow: hidden;
  }
  .columns { display: flex; gap: 0; height: 100%; }
  .col { width: 50%; }
  .col-left { padding-right: 26px; }
  .col-right { padding-left: 26px; }
  .para {
    font-family: 'Lato', sans-serif;
    font-size: 12.8px; font-weight: 400; line-height: 1.82; color: #2c2420;
    margin-bottom: 16px;
  }
  .para.italic { font-style: italic; color: #8b5e52; }
  .divider { text-align: center; color: #c47d7d; font-size: 13px; letter-spacing: 4px; margin: 0 0 14px 0; }
  .pet-greeting { font-family: 'Dancing Script', cursive; font-size: 22px; font-weight: 600; color: #c47d7d; margin-bottom: 14px; }
  .pet-signoff { font-family: 'Dancing Script', cursive; font-size: 20px; font-weight: 600; color: #2c2420; margin-top: 14px; }
  .sig-block { margin-top: 24px; text-align: center; }
  .photo-circle { width: 120px; height: 120px; border-radius: 50%; overflow: hidden; border: 4px solid #e8724a; margin: 0 auto 10px auto; }
  .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
  .pet-name-sig { font-family: 'Dancing Script', cursive; font-size: 28px; font-weight: 700; color: #2c2420; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .paw-sig { width: 20px; height: 20px; }
  .forever-text { font-size: 9px; color: #c4913a; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px; }
  .forever-line { width: 80px; height: 1.5px; background: #c47d7d; margin: 4px auto 0 auto; }
`;

const PAW_SVG = `<svg class="paw-sig" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="80" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="6" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="94" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="50" cy="72" rx="30" ry="24" fill="#2c2420"/></svg>`;

function buildPage1Html({ bgDataUrl, paragraphs }) {
  const { PARA_ONE, PARA_TWO, PARA_THREE, PARA_FOUR } = paragraphs;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  ${FONT_LINK}
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="page" style="background-image:url('${bgDataUrl}')">
    <div class="content">
      <div class="columns">
        <div class="col col-left">
          <p class="para">${stripMarkdown(PARA_ONE)}</p>
          <p class="para">${stripMarkdown(PARA_TWO)}</p>
        </div>
        <div class="col col-right">
          <p class="para">${stripMarkdown(PARA_THREE)}</p>
          <p class="para">${stripMarkdown(PARA_FOUR)}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildPage2Html({ bgDataUrl, petCallsYou, petName, paragraphs, photoDataUrl }) {
  const raw = paragraphs.PARA_FIVE || '';
  const lines = raw.split('\n');
  const lastLine = lines[lines.length - 1];
  const isItalic = lastLine.startsWith('*') && lastLine.endsWith('*');
  const bodyLines = isItalic ? lines.slice(0, -1) : lines;
  const italicLine = isItalic ? lastLine.replace(/\*/g, '') : '';

  const bodyHtml = bodyLines
    .filter(l => l.trim())
    .map(l => `<p class="para">${stripMarkdown(l)}</p>`)
    .join('');

  const photoHtml = photoDataUrl
    ? `<div class="photo-circle"><img src="${photoDataUrl}" alt="${petName}"/></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  ${FONT_LINK}
  <style>${BASE_STYLES}
    .flow { column-count: 2; column-gap: ${COLUMN_GAP}px; }
    .flow * { break-inside: avoid; }
  </style>
</head>
<body>
  <div class="page" style="background-image:url('${bgDataUrl}')">
    <div class="content">
      <div class="flow">
        <div class="divider">─────── ✦ ───────</div>
        <div class="pet-greeting">Dear ${petCallsYou},</div>
        ${bodyHtml}
        ${italicLine ? `<p class="para italic">${italicLine}</p>` : ''}
        <div class="pet-signoff">${petName} 🐾</div>
        <div class="sig-block">
          ${photoHtml}
          <div class="pet-name-sig">${petName}${PAW_SVG}</div>
          <div class="forever-text">FOREVER LOVED. NEVER GONE.</div>
          <div class="forever-line"></div>
        </div>
      </div>
    </div>
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
  return Buffer.from(await merged.save());
}

async function generateSoulReadingPdf({ calledYou, petName, paragraphs, photoUrl }) {
  const bgDataUrl = getBgDataUrl();

  let photoDataUrl = null;
  if (photoUrl) {
    try {
      photoDataUrl = await fetchImageAsBase64(photoUrl);
    } catch (err) {
      console.warn('[SoulReadingPdf] Could not fetch pet photo:', err.message);
    }
  }

  const isLocal = process.env.IS_LOCAL === 'true';
  const browser = await puppeteer.launch(isLocal ? {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  } : {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const pdfBuffers = [];

    const page1 = await browser.newPage();
    await page1.setContent(buildPage1Html({ bgDataUrl, paragraphs }), { waitUntil: 'networkidle2', timeout: 90000 });
    pdfBuffers.push(await page1.pdf({
      width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
      printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
    await page1.close();

    const page2 = await browser.newPage();
    await page2.setContent(buildPage2Html({ bgDataUrl, petCallsYou: calledYou, petName, paragraphs, photoDataUrl }), { waitUntil: 'networkidle2', timeout: 90000 });
    pdfBuffers.push(await page2.pdf({
      width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
      printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
    await page2.close();

    return await mergePdfs(pdfBuffers);
  } finally {
    await browser.close();
  }
}

module.exports = { generateSoulReadingPdf };
