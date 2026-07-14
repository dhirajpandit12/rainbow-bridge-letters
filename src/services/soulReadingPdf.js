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
const CONTENT_AREA_HEIGHT = PAGE_HEIGHT - CONTENT_TOP - CONTENT_BOTTOM;
const GREETING_HEIGHT = 52;

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

function parsePara5Html(raw, petCallsYou, petName) {
  const lines = raw.split('\n');
  const lastLine = lines[lines.length - 1];
  const isItalic = lastLine.startsWith('*') && lastLine.endsWith('*');
  const bodyLines = isItalic ? lines.slice(0, -1) : lines;
  const italicLine = isItalic ? `<em>${lastLine.replace(/\*/g, '')}</em>` : '';
  const bodyHtml = bodyLines.map(l => l.trim() ? `<p class="para">${stripMarkdown(l)}</p>` : '').join('')
    + (italicLine ? `<p class="para italic">${italicLine}</p>` : '');

  return `<div class="divider">─────── ✦ ───────</div>
<div class="pet-greeting">Dear ${petCallsYou},</div>
${bodyHtml}
<div class="pet-signoff">${petName} 🐾</div>`;
}

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; overflow: hidden; }
  .page {
    width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
    position: relative;
    background-size: cover; background-position: center;
  }
  .flow {
    position: absolute;
    top: ${CONTENT_TOP}px;
    left: ${CONTENT_SIDE}px;
    width: ${CONTENT_WIDTH}px;
    column-count: 2;
    column-gap: ${COLUMN_GAP}px;
  }
  .greeting {
    font-family: 'Dancing Script', cursive;
    font-size: 26px; font-weight: 600; color: #c47d7d;
    margin-bottom: 16px;
    column-span: all;
  }
  .greeting-heart { color: #e8a0a0; font-size: 20px; margin-left: 6px; }
  .para {
    font-family: 'Lato', sans-serif;
    font-size: 12.8px; font-weight: 400; line-height: 1.82; color: #2c2420;
    margin-bottom: 16px; break-inside: avoid;
  }
  .para.italic { font-style: italic; color: #8b5e52; }
  .divider { text-align: center; color: #c47d7d; font-size: 13px; letter-spacing: 4px; margin: 18px 0 14px 0; break-inside: avoid; break-after: avoid; }
  .pet-greeting { font-family: 'Dancing Script', cursive; font-size: 22px; font-weight: 600; color: #c47d7d; margin-bottom: 12px; break-inside: avoid; break-after: avoid; }
  .pet-signoff { font-family: 'Dancing Script', cursive; font-size: 20px; font-weight: 600; color: #2c2420; margin-top: 14px; break-inside: avoid; }
  .sig-block { margin-top: 20px; text-align: center; break-inside: avoid; }
  .photo-circle {
    width: 120px; height: 120px; border-radius: 50%; overflow: hidden;
    border: 4px solid #e8724a; margin: 0 auto 10px auto;
  }
  .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
  .pet-name-sig {
    font-family: 'Dancing Script', cursive; font-size: 28px; font-weight: 700; color: #2c2420;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .paw-sig { width: 20px; height: 20px; }
  .forever-text { font-size: 9px; color: #c4913a; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px; }
  .forever-line { width: 80px; height: 1.5px; background: #c47d7d; margin: 4px auto 0 auto; }
`;

const PAW_SVG = `<svg class="paw-sig" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="80" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="6" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="94" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="50" cy="72" rx="30" ry="24" fill="#2c2420"/></svg>`;

async function measure2ColHeight(browser, paragraphsHtml) {
  const html = `<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400&display=swap" rel="stylesheet"/>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { width: ${PAGE_WIDTH}px; }
      .measure {
        width: ${CONTENT_WIDTH}px;
        column-count: 2; column-gap: ${COLUMN_GAP}px;
        font-family: 'Lato', sans-serif; font-size: 12.8px; line-height: 1.82; color: #2c2420;
      }
      .para { margin-bottom: 16px; break-inside: avoid; }
      .sig-block { margin-top: 20px; break-inside: avoid; height: 180px; }
    </style>
  </head><body><div class="measure" id="box">${paragraphsHtml}</div></body></html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: 9999 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const height = await page.evaluate(() => document.getElementById('box').offsetHeight);
  await page.close();
  return height;
}

async function findPageSplits(browser, allParas, sigBlockHeight) {
  const availablePage1 = CONTENT_AREA_HEIGHT - GREETING_HEIGHT;
  const availableOtherPages = CONTENT_AREA_HEIGHT;

  const splits = [];
  let remaining = [...allParas];
  let isFirst = true;

  while (remaining.length > 0) {
    const available = isFirst ? availablePage1 : availableOtherPages;
    isFirst = false;

    const totalHtml = remaining.map(p => `<p class="para">${p}</p>`).join('');
    const totalHeight = await measure2ColHeight(browser, totalHtml + `<div class="sig-block" style="height:${sigBlockHeight}px"></div>`);

    if (totalHeight <= available) {
      splits.push(remaining.length);
      break;
    }

    let lo = 1, hi = remaining.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const html = remaining.slice(0, mid).map(p => `<p class="para">${p}</p>`).join('');
      const h = await measure2ColHeight(browser, html);
      if (h <= available) lo = mid;
      else hi = mid - 1;
    }
    splits.push(lo);
    remaining = remaining.slice(lo);
  }

  return splits;
}

function buildPageHtml({ bgDataUrl, calledYou, isFirstPage, paragraphsHtml, signatureHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&display=swap" rel="stylesheet"/>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="page" style="background-image:url('${bgDataUrl}')">
    <div class="flow">
      ${isFirstPage ? `<div class="greeting">Dear ${calledYou},<span class="greeting-heart">♥</span></div>` : ''}
      ${paragraphsHtml}
      ${signatureHtml}
    </div>
  </div>
</body>
</html>`;
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

  const { PARA_ONE, PARA_TWO, PARA_THREE, PARA_FOUR, PARA_FIVE } = paragraphs;
  const para5Html = parsePara5Html(PARA_FIVE || '', calledYou, petName);

  const allParaTexts = [
    stripMarkdown(PARA_ONE),
    stripMarkdown(PARA_TWO),
    stripMarkdown(PARA_THREE),
    stripMarkdown(PARA_FOUR),
    para5Html,
  ];

  const signatureHtml = `
    <div class="sig-block">
      ${photoDataUrl ? `<div class="photo-circle"><img src="${photoDataUrl}" alt="${petName}" /></div>` : ''}
      <div class="pet-name-sig">${petName}${PAW_SVG}</div>
      <div class="forever-text">FOREVER LOVED. NEVER GONE.</div>
      <div class="forever-line"></div>
    </div>`;

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
    const splits = await findPageSplits(browser, allParaTexts, 200);

    const pdfBuffers = [];
    let paraIndex = 0;
    let isFirstPage = true;

    for (let i = 0; i < splits.length; i++) {
      const count = splits[i];
      const isLastPage = i === splits.length - 1;
      const pageParas = allParaTexts.slice(paraIndex, paraIndex + count);
      paraIndex += count;

      const parasHtml = pageParas.map((p, idx) => {
        const originalIdx = paraIndex - count + idx;
        if (originalIdx === 4) return p;
        return `<p class="para">${p}</p>`;
      }).join('');

      const html = buildPageHtml({
        bgDataUrl,
        calledYou,
        isFirstPage,
        paragraphsHtml: parasHtml,
        signatureHtml: isLastPage ? signatureHtml : '',
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffers.push(await page.pdf({
        width: `${PAGE_WIDTH}px`, height: `${PAGE_HEIGHT}px`,
        printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }));
      await page.close();
      isFirstPage = false;
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
  return Buffer.from(await merged.save());
}

module.exports = { generateSoulReadingPdf };
