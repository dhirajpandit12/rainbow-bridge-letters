const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BG_IMAGE_PATH = path.join(__dirname, '..', 'templates', 'soul-reading-bg.png');

const PAGE_HEIGHT = 1123;
const PAGE_WIDTH = 794;

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
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

function buildSoulReadingHtml({ calledYou, petName, paragraphs, bgDataUrl, photoDataUrl }) {
  const { PARA_ONE, PARA_TWO, PARA_THREE, PARA_FOUR, PARA_FIVE } = paragraphs;

  const para5Lines = PARA_FIVE.split('\n');
  const lastLine = para5Lines[para5Lines.length - 1];
  const isLastItalic = lastLine.startsWith('*') && lastLine.endsWith('*');
  const para5Body = isLastItalic
    ? para5Lines.slice(0, -1).join('\n') + `\n<em>${lastLine.replace(/\*/g, '')}</em>`
    : PARA_FIVE;

  const photoHtml = photoDataUrl ? `
    <div class="photo-block">
      <div class="photo-circle">
        <img src="${photoDataUrl}" alt="${petName}" />
      </div>
      <div class="pet-name-sig">${petName}<svg class="paw-sig" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="80" cy="28" rx="11" ry="15" fill="#2c2420"/><ellipse cx="6" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="94" cy="58" rx="9" ry="13" fill="#2c2420"/><ellipse cx="50" cy="72" rx="30" ry="24" fill="#2c2420"/></svg></div>
      <div class="forever-text">FOREVER LOVED. NEVER GONE.</div>
      <div class="forever-line"></div>
    </div>` : '';

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
      background-image: url('${bgDataUrl}');
      background-size: cover;
      background-position: center;
    }
    .content-area {
      position: absolute;
      top: 295px;
      left: 36px;
      right: 36px;
      bottom: 120px;
      display: flex;
      flex-direction: column;
    }
    .greeting {
      font-family: 'Dancing Script', cursive;
      font-size: 26px;
      font-weight: 600;
      color: #c47d7d;
      margin-bottom: 14px;
    }
    .greeting-heart { color: #e8a0a0; font-size: 20px; margin-left: 6px; }
    .columns {
      display: flex;
      gap: 0;
      flex: 1;
    }
    .col-left {
      width: 50%;
      padding-right: 24px;
    }
    .col-right {
      width: 50%;
      padding-left: 24px;
      border-left: 1px dashed #d4b8b0;
    }
    .para {
      font-family: 'Lato', sans-serif;
      font-size: 12.5px;
      font-weight: 400;
      line-height: 1.8;
      color: #2c2420;
      margin-bottom: 14px;
    }
    .para-five {
      font-family: 'Lato', sans-serif;
      font-size: 12.5px;
      font-weight: 400;
      line-height: 1.8;
      color: #2c2420;
      margin-bottom: 14px;
    }
    .para-five em { font-style: italic; color: #8b5e52; }
    .photo-block {
      position: absolute;
      bottom: 30px;
      right: 36px;
      text-align: center;
      width: 160px;
    }
    .photo-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      overflow: hidden;
      border: 4px solid #e8724a;
      margin: 0 auto 8px auto;
    }
    .photo-circle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pet-name-sig {
      font-family: 'Dancing Script', cursive;
      font-size: 28px;
      font-weight: 700;
      color: #2c2420;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .paw-sig { width: 20px; height: 20px; }
    .forever-text {
      font-size: 9px;
      color: #c4913a;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .forever-line {
      width: 80px;
      height: 1.5px;
      background: #c47d7d;
      margin: 4px auto 0 auto;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="content-area">
      <div class="greeting">Dear ${calledYou},<span class="greeting-heart">♥</span></div>
      <div class="columns">
        <div class="col-left">
          <p class="para">${stripMarkdown(PARA_ONE)}</p>
          <p class="para">${stripMarkdown(PARA_TWO)}</p>
        </div>
        <div class="col-right">
          <p class="para">${stripMarkdown(PARA_THREE)}</p>
          <p class="para">${stripMarkdown(PARA_FOUR)}</p>
          <p class="para-five">${para5Body.replace(/\n/g, '<br/>')}</p>
        </div>
      </div>
    </div>
    ${photoHtml}
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

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const html = buildSoulReadingHtml({ calledYou, petName, paragraphs, bgDataUrl, photoDataUrl });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      width: `${PAGE_WIDTH}px`,
      height: `${PAGE_HEIGHT}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await page.close();
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generateSoulReadingPdf };
