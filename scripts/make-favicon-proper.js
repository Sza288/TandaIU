const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'images', 'tandaiu-mascot.png');
const out = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');

async function run() {
  // Load source with alpha
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  
  // Create copy
  const buf = Buffer.from(data);
  
  // Find and remove white/light circular backgrounds and checkmarks
  // Be more careful - only remove very specific background patterns
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = buf[i], g = buf[i+1], b = buf[i+2], a = buf[i+3];
      if (a === 0) continue;
      
      const max = Math.max(r,g,b);
      const min = Math.min(r,g,b);
      const sat = max === 0 ? 0 : (max - min) / max;
      
      // Remove pure white
      if (r > 250 && g > 250 && b > 250 && sat < 0.05) {
        buf[i+3] = 0;
        continue;
      }
      // Remove very light grays
      if (max > 245 && sat < 0.08) {
        buf[i+3] = 0;
        continue;
      }
      // Remove light pink backgrounds
      if (r > 240 && g > 230 && b > 240 && sat < 0.15) {
        buf[i+3] = 0;
        continue;
      }
      // Remove circular white/pink fills
      if (max > 235 && sat < 0.12) {
        buf[i+3] = 0;
        continue;
      }
    }
  }
  
  // Export at multiple sizes - use 64x64 for better quality, will be downscaled by browser
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .resize(64, 64, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3'
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  
  console.log('done');
}

run().catch(e => { console.error('err', e); process.exit(1); });
