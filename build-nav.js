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

// Fail the deployment instead of silently publishing an incomplete shell.
const requiredFiles = [
  'index.html', 'trips.html', 'resources.html', 'blog.html', 'flights.html',
  'spin.html', 'admin.html', 'admin-login.html', 'signup.html', 'login.html',
  'request-travel.html', 'trip.html', 'blog-post.html'
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(publicDir, file))) {
    throw new Error(`Missing required public file: ${file}`);
  }
}

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

  // Keep branding consistent across every deployed HTML page, including
  // older templates that still hard-code the legacy logo filename.
  content = content.replace(/(?:\/)?logo\.jpeg/g, '/newtrv180x180no bckgrd logo favi.jpg');\n  // Keep Spin & Save navigation consistent and route to the dedicated page.\n  content = content.replace(/href=[\"']\\\/#spinwheel[\"']/g, 'href=\"/spin\"');
  
  fs.writeFileSync(filePath, content);
  console.log(`✓ Updated ${path.basename(filePath)}`);
}

fs.readdirSync(publicDir).forEach(file => {
  if (file.endsWith('.html') && !file.startsWith('nav.html') && !file.startsWith('footer.html')) {
    processHTML(path.join(publicDir, file));
  }
});

console.log('✓ Navigation injected into all HTML files');
