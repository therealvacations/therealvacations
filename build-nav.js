const fs = require('fs');
const path = require('path');

const navFile = fs.readFileSync(path.join(__dirname, 'public/nav.html'), 'utf8');
const footerFile = fs.readFileSync(path.join(__dirname, 'public/footer.html'), 'utf8');

const publicDir = path.join(__dirname, 'public');
const sourceJsDir = path.join(__dirname, 'js');
const publicJsDir = path.join(publicDir, 'js');

const metricoolScript = `
<script>function loadScript(a){var b=document.getElementsByTagName("head")[0],c=document.createElement("script");c.type="text/javascript",c.src="https://tracker.metricool.com/resources/be.js",c.onreadystatechange=a,c.onload=a,b.appendChild(c)}loadScript(function(){beTracker.t({hash:"b412d375229b11c597d491a655b0a632"})});</script>`;

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

  // Install the Impact/Drive tracking script globally in <head>.
  // Idempotent so repeated builds never duplicate the snippet.
  if (!content.includes('https://emrld.ltd/MzA4Njkz.js?t=308693')) {
    content = content.replace('</head>', driveScript + '\n</head>');
  }

  // Install Metricool website analytics globally in <head>.
  // Idempotent so repeated builds never duplicate the snippet.
  if (!content.includes('tracker.metricool.com/resources/be.js')) {
    content = content.replace('</head>', metricoolScript + '\n</head>');
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
