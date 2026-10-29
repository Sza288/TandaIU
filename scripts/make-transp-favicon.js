const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'images', 'tandaiu-mascot.png');
const out = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');

async function run() {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  
  const w = info.width, h = info.height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    // Remove white/light backgrounds and circular/white fills
    // If very light and not saturated, make transparent
    if (a > 0) {
      const max = Math.max(r,g,b);
      const min = Math.min(r,g,b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (max > 230 && sat < 0.1) {
        data[i+3] = 0;
      } else if (r > 245 && g > 245 && b > 245) {
        data[i+3] = 0;
      } else if (r > 220 && g > 220 && b > 220 && sat < 0.08) {
        data[i+3] = 0;
      }
    }
  }
  
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  
  console.log('done');
}

run().catch(e => { console.error(e.message); process.exit(1); });
