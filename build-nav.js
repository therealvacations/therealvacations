const fs = require('fs');
const path = require('path');

const navFile = fs.readFileSync(path.join(__dirname, 'public/nav.html'), 'utf8');
const footerFile = fs.readFileSync(path.join(__dirname, 'public/footer.html'), 'utf8');

const publicDir = path.join(__dirname, 'public');

function processHTML(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace nav placeholder
  content = content.replace('<!-- NAV_PLACEHOLDER -->', navFile);
  // Replace footer placeholder
  content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footerFile);
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Updated ${path.basename(filePath)}`);
}

fs.readdirSync(publicDir).forEach(file => {
  if (file.endsWith('.html') && !file.startsWith('nav.html') && !file.startsWith('footer.html')) {
    processHTML(path.join(publicDir, file));
  }
});

console.log('✓ Navigation injected into all HTML files');
