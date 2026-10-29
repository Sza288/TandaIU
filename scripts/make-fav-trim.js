const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'images', 'tandaiu-mascot.png');
const out = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');

async function run() {
  // Trim transparent borders to make mascot larger
  const trimmed = await sharp(src)
    .ensureAlpha()
    .trim({ threshold: 10 })
    .toBuffer();
  
  const meta = await sharp(trimmed).metadata();
  console.log('trimmed:', meta.width, meta.height);
  
  // Resize to 512x512 to be crisp at small sizes
  await sharp(trimmed)
    .resize(512, 512, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3'
    })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(out);
  
  console.log('done');
}

run().catch(e => { console.error(e); process.exit(1); });
