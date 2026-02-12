var puppeteer = require('puppeteer');
var path = require('path');

function assert(condition, message) {
    if (!condition) {
        throw new Error('Assertion failed: ' + message);
    }
}

(async function() {
    var browser = await puppeteer.launch({
        headless: 'new',
        args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    var page = await browser.newPage();
    await page.goto('file://' + path.resolve('dist/index.html'));

    function getPreviewSrc() {
        return page.$eval('#preview', function(el) { return el.src; });
    }

    async function waitForPdfRegeneration(prevSrc) {
        await page.waitForFunction(function(prev) {
            var el = document.getElementById('preview');
            return el.src !== prev && el.src !== '' && el.src !== 'about:blank';
        }, { timeout: 10000 }, prevSrc);
    }

    var fileInput = await page.$('input.fileDialog');

    // Test 1: Upload PNG only
    console.log('Test 1: Upload PNG...');
    var src0 = await getPreviewSrc();
    await fileInput.uploadFile('/tmp/test-img.png');
    await waitForPdfRegeneration(src0);
    var items1 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var size1 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    assert(items1 === 1, 'Expected 1 file, got ' + items1);
    assert(size1 !== '', 'Expected file size to be set');
    console.log('  PASS: ' + items1 + ' file, PDF size: ' + size1);

    // Test 2: Upload JPG (added to existing)
    console.log('Test 2: Upload JPG...');
    var src1 = await getPreviewSrc();
    await fileInput.uploadFile('/tmp/test-img.jpg');
    await waitForPdfRegeneration(src1);
    var items2 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items2 === 2, 'Expected 2 files, got ' + items2);
    var size2 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items2 + ' files, PDF size: ' + size2);

    // Test 3: Enable compression and verify it still works
    console.log('Test 3: Enable compression...');
    var src2 = await getPreviewSrc();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src2);
    var size3 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    assert(size3 !== '', 'Expected compressed file size to be set');
    console.log('  PASS: Compressed PDF size: ' + size3);

    // Test 4: Delete first image
    console.log('Test 4: Delete first image...');
    var src3 = await getPreviewSrc();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src3);
    var items4 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items4 === 1, 'Expected 1 file after delete, got ' + items4);
    var size4 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items4 + ' file, PDF size: ' + size4);

    // Test 5: Delete last image - should show placeholder
    console.log('Test 5: Delete last image...');
    await page.click('#items li:first-child .delete-btn');
    await page.waitForFunction(function() {
        var ph = document.getElementById('preview-placeholder');
        return ph && ph.style.display !== 'none';
    }, { timeout: 10000 });
    var items5 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var placeholder = await page.$eval('#preview-placeholder', function(el) {
        return el.style.display !== 'none';
    });
    assert(items5 === 0, 'Expected 0 files, got ' + items5);
    assert(placeholder === true, 'Expected placeholder to be visible');
    console.log('  PASS: ' + items5 + ' files, placeholder visible');

    console.log('\nAll tests passed!');
    await browser.close();
})().catch(function(err) {
    console.error('FAIL:', err.message);
    process.exit(1);
});
