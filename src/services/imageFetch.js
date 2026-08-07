const https = require('https');
const http = require('http');

// Fetch an image URL and return { mediaType, base64 } for Claude vision.
// Returns null on any failure so callers can fall back to text-only.
function fetchImageForVision(url, redirectCount = 0) {
  return new Promise((resolve) => {
    if (!url || redirectCount > 5) return resolve(null);

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchImageForVision(res.headers.location, redirectCount + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }

      const rawType = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const mediaType = allowed.includes(rawType) ? rawType : 'image/jpeg';

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (!buffer.length) return resolve(null);
          resolve({ mediaType, base64: buffer.toString('base64') });
        } catch { resolve(null); }
      });
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

// Fetch an image URL and return a data: URL string for embedding in HTML/PDF.
// Returns null on any failure so callers can render without a photo.
function fetchImageAsDataUrl(url, redirectCount = 0) {
  return new Promise((resolve) => {
    if (!url || redirectCount > 5) return resolve(null);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchImageAsDataUrl(res.headers.location, redirectCount + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const contentType = (res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (!buffer.length) return resolve(null);
          resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
        } catch { resolve(null); }
      });
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

module.exports = { fetchImageForVision, fetchImageAsDataUrl };
