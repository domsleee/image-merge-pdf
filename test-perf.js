var puppeteer = require('puppeteer');
var path = require('path');

(async function() {
    var browser = await puppeteer.launch({
        headless: 'new',
        args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    var page = await browser.newPage();

    // Collect console messages and errors
    var errors = [];
    page.on('pageerror', function(err) { errors.push(err.message); });

    // Monitor memory
    async function getMemory() {
        return page.evaluate(function() {
            if (performance.memory) {
                return {
                    usedHeap: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1),
                    totalHeap: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)
                };
            }
            return null;
        });
    }

    function getPreviewSrc() {
        return page.$eval('#preview', function(el) { return el.src; });
    }

    async function waitForPdfRegeneration(prevSrc) {
        await page.waitForFunction(function(prev) {
            var el = document.getElementById('preview');
            return el.src !== prev && el.src !== '' && el.src !== 'about:blank';
        }, { timeout: 60000 }, prevSrc);
    }

    await page.goto('file://' + path.resolve('dist/index.html'));
    var fileInput = await page.$('input.fileDialog');

    var mem0 = await getMemory();
    if (mem0) console.log('Initial memory: ' + mem0.usedHeap + ' MB');

    // Upload 8 large PNGs
    var files = [];
    for (var i = 1; i <= 8; i++) files.push('/tmp/test-perf-' + i + '.png');

    console.log('\n--- Upload 8 PNGs (9.5 MB each) ---');
    var src = await getPreviewSrc();
    var t0 = Date.now();
    await fileInput.uploadFile.apply(fileInput, files);
    await waitForPdfRegeneration(src);
    var t1 = Date.now();
    var items = await page.$$eval('#items li', function(lis) { return lis.length; });
    var size = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Time: ' + (t1 - t0) + 'ms');
    console.log('  Files: ' + items + ', PDF size: ' + size);
    var mem1 = await getMemory();
    if (mem1) console.log('  Memory: ' + mem1.usedHeap + ' MB');

    // Enable compression
    console.log('\n--- Enable compression (quality 70%) ---');
    src = await getPreviewSrc();
    t0 = Date.now();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src);
    t1 = Date.now();
    size = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Time: ' + (t1 - t0) + 'ms');
    console.log('  Compressed PDF size: ' + size);
    var mem2 = await getMemory();
    if (mem2) console.log('  Memory: ' + mem2.usedHeap + ' MB');

    // Delete first image (should use cache for remaining 7)
    console.log('\n--- Delete first image (7 cached) ---');
    src = await getPreviewSrc();
    t0 = Date.now();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src);
    t1 = Date.now();
    items = await page.$$eval('#items li', function(lis) { return lis.length; });
    size = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Time: ' + (t1 - t0) + 'ms');
    console.log('  Files: ' + items + ', PDF size: ' + size);
    var mem3 = await getMemory();
    if (mem3) console.log('  Memory: ' + mem3.usedHeap + ' MB');

    // Delete another image
    console.log('\n--- Delete another image (6 cached) ---');
    src = await getPreviewSrc();
    t0 = Date.now();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src);
    t1 = Date.now();
    items = await page.$$eval('#items li', function(lis) { return lis.length; });
    size = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Time: ' + (t1 - t0) + 'ms');
    console.log('  Files: ' + items + ', PDF size: ' + size);

    // Disable compression
    console.log('\n--- Disable compression ---');
    src = await getPreviewSrc();
    t0 = Date.now();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src);
    t1 = Date.now();
    size = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Time: ' + (t1 - t0) + 'ms');
    console.log('  Uncompressed PDF size: ' + size);
    var mem4 = await getMemory();
    if (mem4) console.log('  Memory: ' + mem4.usedHeap + ' MB');

    // Delete all remaining
    console.log('\n--- Delete all remaining ---');
    var remaining = await page.$$eval('#items li', function(lis) { return lis.length; });
    for (var d = 0; d < remaining; d++) {
        if (d < remaining - 1) {
            src = await getPreviewSrc();
            await page.click('#items li:first-child .delete-btn');
            await waitForPdfRegeneration(src);
        } else {
            await page.click('#items li:first-child .delete-btn');
            await page.waitForFunction(function() {
                var ph = document.getElementById('preview-placeholder');
                return ph && ph.style.display !== 'none';
            }, { timeout: 10000 });
        }
    }
    var finalItems = await page.$$eval('#items li', function(lis) { return lis.length; });
    var mem5 = await getMemory();
    console.log('  All deleted. Files: ' + finalItems);
    if (mem5) console.log('  Final memory: ' + mem5.usedHeap + ' MB');

    if (errors.length > 0) {
        console.log('\n--- JS Errors ---');
        errors.forEach(function(e) { console.log('  ERROR: ' + e); });
    } else {
        console.log('\n  No JS errors detected.');
    }

    console.log('\nPerf test complete.');
    await browser.close();
})().catch(function(err) {
    console.error('FAIL:', err.message);
    process.exit(1);
});
