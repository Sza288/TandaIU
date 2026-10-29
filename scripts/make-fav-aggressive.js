const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'images', 'tandaiu-mascot.png');
const out = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');

async function run() {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (data[i+3] === 0) continue;
    const max = Math.max(r,g,b);
    const min = Math.min(r,g,b);
    const sat = max === 0 ? 0 : (max - min) / max;
    // Very aggressive - remove anything that's very light/low saturation (backgrounds)
    if (max > 250 && sat < 0.3) { data[i+3] = 0; continue; }
    if (max > 220 && sat < 0.25) { data[i+3] = 0; continue; }
    if (max > 190 && sat < 0.2) { data[i+3] = 0; continue; }
    // Remove pinkish backgrounds
    if (r > 200 && g > 180 && b > 200 && sat < 0.3) { data[i+3] = 0; continue; }
    // Remove checkmark elements (usually light/white or different color)
    if (r > 240 && g > 240 && b > 240) { data[i+3] = 0; continue; }
  }
  
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(out);
  
  console.log('done');
}

run().catch(e => { console.error(e); process.exit(1); });
