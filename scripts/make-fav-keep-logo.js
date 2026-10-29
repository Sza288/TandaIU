const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'images', 'tandaiu-mascot.png');
const out = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');

async function run() {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const buf = Buffer.from(data);
  
  // Only remove pure white pixels - keep everything else including checkmark
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i+1], b = buf[i+2];
    if (buf[i+3] === 0) continue;
    // Only remove pure white
    if (r === 255 && g === 255 && b === 255) {
      buf[i+3] = 0;
    }
    // Remove very light near-white
    else if (r > 254 && g > 254 && b > 254) {
      buf[i+3] = 0;
    }
  }
  
  // Resize to 256x256 to fill more of canvas
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .resize(256, 256, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3'
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  
  console.log('done');
}

run().catch(e => { console.error(e); process.exit(1); });
