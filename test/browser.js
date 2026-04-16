const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

const tmpDir = os.tmpdir();

function assert(condition, message) {
    if (!condition) {
        throw new Error('Assertion failed: ' + message);
    }
}

(async function() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    const page = await browser.newPage();
    await page.goto('file://' + path.resolve('dist/index.html'));

    function getPreviewSrc() {
        return page.$eval('#preview', function(el) { return el.src; });
    }

    async function waitForPdfRegeneration(prevSrc) {
        await page.waitForFunction(function(prev) {
            const el = document.getElementById('preview');
            return el.src !== prev && el.src !== '' && el.src !== 'about:blank';
        }, { timeout: 10000 }, prevSrc);
    }

    const fileInput = await page.$('input.fileDialog');

    // Test 1: Upload PNG only
    console.log('Test 1: Upload PNG...');
    const src0 = await getPreviewSrc();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.png'));
    await waitForPdfRegeneration(src0);
    const items1 = await page.$$eval('#items li', function(lis) { return lis.length; });
    const size1 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    assert(items1 === 1, 'Expected 1 file, got ' + items1);
    assert(size1 !== '', 'Expected file size to be set');
    console.log('  PASS: ' + items1 + ' file, PDF size: ' + size1);

    // Test 2: Upload JPG (added to existing)
    console.log('Test 2: Upload JPG...');
    const src1 = await getPreviewSrc();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.jpg'));
    await waitForPdfRegeneration(src1);
    const items2 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items2 === 2, 'Expected 2 files, got ' + items2);
    const size2 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items2 + ' files, PDF size: ' + size2);

    // Test 3: Upload TIFF (added to existing)
    console.log('Test 3: Upload TIFF...');
    const src2 = await getPreviewSrc();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.tif'));
    await waitForPdfRegeneration(src2);
    const items3 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items3 === 3, 'Expected 3 files, got ' + items3);
    const size3 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items3 + ' files, PDF size: ' + size3);

    // Test 4: Enable compression and verify it still works
    console.log('Test 4: Enable compression...');
    const src3 = await getPreviewSrc();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src3);
    const size4 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    assert(size4 !== '', 'Expected compressed file size to be set');
    console.log('  PASS: Compressed PDF size: ' + size4);

    // Test 5: Delete first image
    console.log('Test 5: Delete first image...');
    const src4 = await getPreviewSrc();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src4);
    const items5 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items5 === 2, 'Expected 2 files after delete, got ' + items5);
    const size5 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items5 + ' files, PDF size: ' + size5);

    // Test 6: Delete down to placeholder
    console.log('Test 6: Delete down to placeholder...');
    const src5 = await getPreviewSrc();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src5);
    await page.click('#items li:first-child .delete-btn');
    await page.waitForFunction(function() {
        const ph = document.getElementById('preview-placeholder');
        return ph && ph.style.display !== 'none';
    }, { timeout: 10000 });
    const items6 = await page.$$eval('#items li', function(lis) { return lis.length; });
    const placeholder = await page.$eval('#preview-placeholder', function(el) {
        return el.style.display !== 'none';
    });
    assert(items6 === 0, 'Expected 0 files, got ' + items6);
    assert(placeholder === true, 'Expected placeholder to be visible');
    console.log('  PASS: ' + items6 + ' files, placeholder visible');

    console.log('\nAll tests passed!');
    await browser.close();
})().catch(function(err) {
    console.error('FAIL:', err.message);
    process.exit(1);
});
