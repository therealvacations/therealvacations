const fs = require('fs');

const script = `<script nowprocket data-noptimize="1" data-cfasync="false" data-wpfc-render="false" seraph-accel-crit="1" data-no-defer="1">
(function () {
    var script = document.createElement("script");
    script.async = 1;
    script.src = 'https://emrld.ltd/MzA4Njkz.js?t=308693';
    document.head.appendChild(script);
})();
</script>`;

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('emrld.ltd')) {
        content = content.replace('</head>', `${script}\n</head>`);
        fs.writeFileSync(file, content);
        console.log(`Injected into ${file}`);
    }
});
