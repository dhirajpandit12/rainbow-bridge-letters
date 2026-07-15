const https = require('https');

let cachedFontCss = null;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getInlineFontCss() {
  if (cachedFontCss) return cachedFontCss;

  try {
    const css = await fetchText(
      'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&display=swap'
    );

    const urlRegex = /url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/g;
    const matches = [...css.matchAll(urlRegex)];
    let result = css;

    for (const match of matches) {
      const fontUrl = match[1];
      const buffer = await fetchBuffer(fontUrl);
      const b64 = buffer.toString('base64');
      result = result.replace(fontUrl, `data:font/woff2;base64,${b64}`);
    }

    cachedFontCss = `<style>${result}</style>`;
    console.log('[Fonts] Inline font CSS ready');
  } catch (err) {
    console.warn('[Fonts] Could not load Google Fonts, using fallback:', err.message);
    cachedFontCss = `<style>
      @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Lato:wght@300;400&display=swap');
    </style>`;
  }

  return cachedFontCss;
}

module.exports = { getInlineFontCss };
