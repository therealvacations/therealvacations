const fs = require('fs');
const path = require('path');

const navFile = fs.readFileSync(path.join(__dirname, 'public/nav.html'), 'utf8');
const footerFile = fs.readFileSync(path.join(__dirname, 'public/footer.html'), 'utf8');

const publicDir = path.join(__dirname, 'public');
const sourceJsDir = path.join(__dirname, 'js');
const publicJsDir = path.join(publicDir, 'js');

const driveScript = `
<script nowprocket data-noptimize="1" data-cfasync="false" data-wpfc-render="false" seraph-accel-crit="1" data-no-defer="1" data-cmp-ab="2">
  (function () {
    var script = document.createElement("script");
    script.async = 1;
    script.setAttribute("data-cmp-ab","2");
    script.src = 'https://emrld.ltd/MzA4Njkz.js?t=308693';
    document.head.appendChild(script);
  })();
</script>`;

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

  // Install Travelpayouts Drive only on public-facing pages.
  // Never allow affiliate click rewriting inside admin, account, auth,
  // proposal, checkout, payment, supplier, host, or member workflows.
  const fileName = path.basename(filePath).toLowerCase();
  const driveExcluded = new Set([
    'admin.html','admin-login.html','dashboard.html',
    'login.html','signup.html','forgot-password.html','reset-password.html',
    'book-trip.html','join-group.html','group-deposit.html',
    'account-confirmed.html','my-trips.html','member-profile.html','member-book.html',
    'proposal.html','quote-checkout.html','custom-payment-result.html','payment-result.html',
    'request-payment-result.html','request-received.html','request-travel.html',
    'supplier-portal.html','host.html','host-center.html','host-profile.html',
    'update-payment-method.html'
  ]);
  if (!driveExcluded.has(fileName) && !content.includes('https://emrld.ltd/MzA4Njkz.js?t=308693')) {
    content = content.replace('</head>', driveScript + '\n</head>');
  }

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
