const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'js');
const dest = path.join(__dirname, 'public', 'js');

if (!fs.existsSync(src)) {
  console.log('No js/ directory found, skipping copy.');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

for (const file of fs.readdirSync(src)) {
  const srcPath = path.join(src, file);
  const destPath = path.join(dest, file);
  if (fs.statSync(srcPath).isFile()) {
    fs.copyFileSync(srcPath, destPath);
    console.log('Copied: ' + file);
  }
}

console.log('Build complete. js/ copied to public/js/');   
