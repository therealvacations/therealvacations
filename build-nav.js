const fs = require('fs');
const path = require('path');

const navFile = fs.readFileSync(path.join(__dirname, 'public/nav.html'), 'utf8');
const footerFile = fs.readFileSync(path.join(__dirname, 'public/footer.html'), 'utf8');

const publicDir = path.join(__dirname, 'public');
const sourceJsDir = path.join(__dirname, 'js');
const publicJsDir = path.join(publicDir, 'js');

// The deployed site is served from /public. Copy browser modules there so
// imports such as /js/auth.js and /js/supabase-client.js resolve in production.
fs.mkdirSync(publicJsDir, { recursive: true });
fs.readdirSync(sourceJsDir).forEach(file => {
  if (file.endsWith('.js')) {
    fs.copyFileSync(path.join(sourceJsDir, file), path.join(publicJsDir, file));
    console.log(`✓ Published js/${file}`);
  }
});

function processHTML(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace nav placeholder
  content = content.replace('<!-- NAV_PLACEHOLDER -->', navFile);
  // Replace footer placeholder
  content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footerFile);

  // Keep a safe default logo in older templates; live branding is then
  // applied from site_settings by /js/site-settings.js.
  content = content.replace(/(?:\/)?logo\.jpeg/g, '/newtrv180x180no bckgrd logo favi.jpg');

  // Make every deployed HTML page load the same site-wide branding/navigation
  // settings, even if the page began as an older standalone template.
  if (!content.includes('/js/site-settings.js')) {
    content = content.replace('</body>', '<script type="module" src="/js/site-settings.js"></script>\n</body>');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Updated ${path.basename(filePath)}`);
}

fs.readdirSync(publicDir).forEach(file => {
  if (file.endsWith('.html') && !file.startsWith('nav.html') && !file.startsWith('footer.html')) {
    processHTML(path.join(publicDir, file));
  }
});

console.log('✓ Navigation injected into all HTML files');
