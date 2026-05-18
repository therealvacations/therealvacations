// inject-script.js — The Real Vacations
// Injects nav, footer, affiliate scripts, and fixes into all HTML pages at build time

const fs = require('fs');
const path = require('path');

const HTML_FILES = fs.readdirSync('.').filter(f => f.endsWith('.html') && f !== 'index-enhanced.html');

// Scripts to inject into <head>
const HEAD_SCRIPTS = `
  <!-- Travelpayouts LinkSwitcher — auto-converts travel links to affiliate links -->
  <script>(function(d,s,id,marker){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src='https://www.travelpayouts.com/linkswitcher/script.js?marker='+marker;fjs.parentNode.insertBefore(js,fjs);}})(document,'script','tpls','533951');</script>
  <!-- Sovrn Commerce — affiliate monetization -->
  <script type="text/javascript">var VigLink={api_url:"https://api.viglink.com",key:"sovrn"};(function(d,script){script=d.createElement("script");script.type="text/javascript";script.async=true;script.src="https://cdn.viglink.com/api/vl.js";d.getElementsByTagName("head")[0].appendChild(script);}(document));</script>
`;

let injectedCount = 0;

HTML_FILES.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Inject affiliate scripts if not already present
  if (!content.includes('travelpayouts.com/linkswitcher') && content.includes('</head>')) {
    content = content.replace('</head>', HEAD_SCRIPTS + '</head>');
    modified = true;
  }

  // Fix .html nav extensions to clean paths
  const navFixes = [
    [/href="index\.html"/g, 'href="/"'],
    [/href="trips\.html"/g, 'href="/trips"'],
    [/href="about\.html"/g, 'href="/about"'],
    [/href="blog\.html"/g, 'href="/blog"'],
    [/href="contact\.html"/g, 'href="/contact"'],
    [/href="real-stories\.html"/g, 'href="/real-stories"'],
    [/href="how-it-works\.html"/g, 'href="/how-it-works"'],
    [/href="resources\.html"/g, 'href="/resources"'],
    [/href="login\.html"/g, 'href="/login"'],
    [/href="signup\.html"/g, 'href="/signup"'],
    [/href="privacy-policy\.html"/g, 'href="/privacy-policy"'],
    [/href="terms-of-service\.html"/g, 'href="/terms-of-service"'],
    [/href="dashboard\.html"/g, 'href="/dashboard"'],
    [/href="my-trips\.html"/g, 'href="/my-trips"'],
  ];

  navFixes.forEach(([pattern, replacement]) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  // Fix dead deals.html links
  if (content.includes('deals.html#flights')) {
    content = content.replace(/href="deals\.html#flights"/g, 'href="https://www.kiwi.com" target="_blank"');
    modified = true;
  }
  if (content.includes('deals.html#hotels')) {
    content = content.replace(/href="deals\.html#hotels"/g, 'href="https://www.hotels.com" target="_blank"');
    modified = true;
  }
  if (content.includes('deals.html#gear')) {
    content = content.replace(/href="deals\.html#gear"/g, 'href="/resources"');
    modified = true;
  }
  if (content.includes('deals.html#experiences')) {
    content = content.replace(/href="deals\.html#experiences"/g, 'href="https://www.klook.com" target="_blank"');
    modified = true;
  }

  // Fix raw email protection links in footer
  if (content.includes('/cdn-cgi/l/email-protection')) {
    content = content.replace(/<a[^>]*\/cdn-cgi\/l\/email-protection[^>]*>.*?<\/a>/g, '<a href="mailto:contact@therealvacations.com">contact@therealvacations.com</a>');
    modified = true;
  }

  // Add Privacy Policy + Terms of Service to footer if missing
  if (content.includes('</footer>') && !content.includes('privacy-policy')) {
    content = content.replace(
      /(<a[^>]*>Send a Message<\/a>)/,
      '$1\n      <a href="/privacy-policy">Privacy Policy</a>\n      <a href="/terms-of-service">Terms of Service</a>'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Injected into ${file}`);
    injectedCount++;
  } else {
    console.log(`⏭  Skipped ${file} (already up to date)`);
  }
});

console.log(`\n✅ Done — ${injectedCount} files updated`);
