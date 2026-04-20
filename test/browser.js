const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

const tmpDir = os.tmpdir();
const today = new Date();
const expectedDownloadName = [
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
].join('') + '-merged.pdf';

function assert(condition, message) {
    if (!condition) {
        throw new Error('Assertion failed: ' + message);
    }
}

function createStaticServer(rootDir) {
    return http.createServer(function(req, res) {
        const reqPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
        const filePath = path.join(rootDir, decodeURIComponent(reqPath));

        fs.readFile(filePath, function(err, data) {
            if (err) {
                res.statusCode = 404;
                res.end('Not found');
                return;
            }

            const ext = path.extname(filePath);
            const contentTypes = {
                '.html': 'text/html; charset=UTF-8',
                '.js': 'application/javascript; charset=UTF-8',
                '.mjs': 'application/javascript; charset=UTF-8',
                '.css': 'text/css; charset=UTF-8'
            };

            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.end(data);
        });
    });
}

(async function() {
    const server = createStaticServer(path.resolve('dist'));
    await new Promise(function(resolve) {
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const baseUrl = 'http://127.0.0.1:' + address.port;

    const browser = await puppeteer.launch({
        headless: 'new',
        timeout: 120000,
        args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    const page = await browser.newPage();
    await page.goto(baseUrl + '/');
    await page.evaluate(function() {
        window.__lastDownloadName = null;
        const nativeClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            window.__lastDownloadName = this.download;
            return nativeClick.call(this);
        };
    });

    function getPreviewRenderId() {
        return page.$eval('#preview', function(el) { return el.dataset.renderId || ''; });
    }

    async function getLastDownloadName() {
        return page.evaluate(function() { return window.__lastDownloadName; });
    }

    async function waitForPdfRegeneration(prevRenderId, expectedPages) {
        await page.waitForFunction(function(prev) {
            const el = document.getElementById('preview');
            return !!el.dataset.renderId && el.dataset.renderId !== prev;
        }, { timeout: 30000 }, prevRenderId);
        await page.waitForFunction(function(pageCount) {
            return document.querySelectorAll('#preview canvas').length === pageCount;
        }, { timeout: 30000 }, expectedPages);
    }

    const fileInput = await page.$('input.fileDialog');

    // Test 1: Upload PNG only
    console.log('Test 1: Upload PNG...');
    const src0 = await getPreviewRenderId();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.png'));
    await waitForPdfRegeneration(src0, 1);
    const items1 = await page.$$eval('#items li', function(lis) { return lis.length; });
    const size1 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    await page.click('#downloadBtn');
    const downloadName1 = await getLastDownloadName();
    assert(items1 === 1, 'Expected 1 file, got ' + items1);
    assert(size1 !== '', 'Expected file size to be set');
    assert(downloadName1 === expectedDownloadName, 'Expected date-based download name, got ' + downloadName1);
    console.log('  PASS: ' + items1 + ' file, PDF size: ' + size1);

    // Test 2: Upload JPG (added to existing)
    console.log('Test 2: Upload JPG...');
    const src1 = await getPreviewRenderId();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.jpg'));
    await waitForPdfRegeneration(src1, 2);
    const items2 = await page.$$eval('#items li', function(lis) { return lis.length; });
    await page.click('#downloadBtn');
    const downloadName2 = await getLastDownloadName();
    assert(items2 === 2, 'Expected 2 files, got ' + items2);
    assert(downloadName2 === expectedDownloadName, 'Expected date-based download name, got ' + downloadName2);
    const size2 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items2 + ' files, PDF size: ' + size2);

    // Test 3: Upload TIFF (added to existing)
    console.log('Test 3: Upload TIFF...');
    const src2 = await getPreviewRenderId();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.tif'));
    await waitForPdfRegeneration(src2, 3);
    const items3 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items3 === 3, 'Expected 3 files, got ' + items3);
    const size3 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items3 + ' files, PDF size: ' + size3);

    // Test 4: Upload PDF input (added to existing)
    console.log('Test 4: Upload PDF...');
    const src3 = await getPreviewRenderId();
    await fileInput.uploadFile(path.join(tmpDir, 'test-input.pdf'));
    await waitForPdfRegeneration(src3, 5);
    const items4 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items4 === 5, 'Expected 5 files after PDF expansion, got ' + items4);
    const pdfNames = await page.$$eval('#items li .file-name', function(nodes) {
        return nodes.map(function(node) { return node.textContent; });
    });
    assert(pdfNames.some(function(name) { return /test-input - page 1\.png/.test(name); }), 'Expected PDF page 1 in file list');
    assert(pdfNames.some(function(name) { return /test-input - page 2\.png/.test(name); }), 'Expected PDF page 2 in file list');
    const size4 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items4 + ' files, PDF size: ' + size4);

    // Test 5: Enable compression and verify it still works
    console.log('Test 5: Enable compression...');
    const src4 = await getPreviewRenderId();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src4, 5);
    const size5 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    assert(size5 !== '', 'Expected compressed file size to be set');
    console.log('  PASS: Compressed PDF size: ' + size5);

    // Test 6: Preview toolbar download
    console.log('Test 6: Preview toolbar download...');
    await page.evaluate(function() { window.__lastDownloadName = null; });
    await page.click('#previewDownloadBtn');
    const previewToolbarDownloadName = await getLastDownloadName();
    assert(previewToolbarDownloadName === expectedDownloadName, 'Expected preview toolbar download name, got ' + previewToolbarDownloadName);
    console.log('  PASS: Preview toolbar download name: ' + previewToolbarDownloadName);

    // Test 7: Status bar visibility and content
    console.log('Test 7: Status bar visible...');
    const statusBarVisible = await page.$eval('#previewStatusBar', function(el) {
        return getComputedStyle(el).display !== 'none';
    });
    assert(statusBarVisible, 'Expected status bar to be visible');
    const pageText = await page.$eval('#pageIndicator', function(el) { return el.textContent; });
    assert(/of 5/.test(pageText), 'Expected page indicator to say "of 5", got: ' + pageText);
    console.log('  PASS: Status bar visible, indicator: ' + pageText);

    // Test 8: File size in status bar matches left panel
    console.log('Test 8: Status bar file size synced...');
    const leftSize = await page.$eval('#fileSize', function(el) { return el.textContent; });
    const barSize = await page.$eval('#previewFileSize', function(el) { return el.textContent; });
    assert(leftSize === barSize, 'Expected status bar size "' + barSize + '" to match left panel "' + leftSize + '"');
    console.log('  PASS: Both show ' + leftSize);

    // Test 9: Zoom in changes level
    console.log('Test 9: Zoom in...');
    const zoomBefore = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomBefore === '100%', 'Expected initial zoom 100%, got ' + zoomBefore);
    await page.click('#zoomInBtn');
    const zoomAfterIn = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomAfterIn === '125%', 'Expected zoom 125% after zoom in, got ' + zoomAfterIn);
    console.log('  PASS: 100% -> ' + zoomAfterIn);

    // Test 10: Zoom out changes level
    console.log('Test 10: Zoom out...');
    await page.click('#zoomOutBtn');
    await page.click('#zoomOutBtn');
    const zoomAfterOut = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomAfterOut === '75%', 'Expected zoom 75% after two zoom outs, got ' + zoomAfterOut);
    console.log('  PASS: 125% -> 100% -> ' + zoomAfterOut);

    // Test 11: Zoom resets on file change
    console.log('Test 11: Zoom reset on file change...');
    await page.click('#zoomInBtn');
    await page.click('#zoomInBtn');
    const zoomBeforeReset = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomBeforeReset !== '100%', 'Expected zoom to not be 100% before reset, got ' + zoomBeforeReset);
    const src5b = await getPreviewRenderId();
    await fileInput.uploadFile(path.join(tmpDir, 'test-img.png'));
    await waitForPdfRegeneration(src5b, 6);
    const zoomAfterReset = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomAfterReset === '100%', 'Expected zoom to reset to 100%, got ' + zoomAfterReset);
    console.log('  PASS: ' + zoomBeforeReset + ' -> ' + zoomAfterReset + ' after adding file');

    // Test 12: Zoom is preserved across compression toggles
    console.log('Test 12: Zoom preserved on compression toggle...');
    await page.click('#zoomInBtn');
    const zoomBeforeCompressToggle = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomBeforeCompressToggle === '125%', 'Expected zoom 125% before compression toggle, got ' + zoomBeforeCompressToggle);
    const src5c = await getPreviewRenderId();
    await page.click('#compressCheckbox');
    await waitForPdfRegeneration(src5c, 6);
    const zoomAfterCompressToggle = await page.$eval('#zoomLevel', function(el) { return el.textContent; });
    assert(zoomAfterCompressToggle === zoomBeforeCompressToggle, 'Expected zoom to remain ' + zoomBeforeCompressToggle + ' after compression toggle, got ' + zoomAfterCompressToggle);
    console.log('  PASS: Zoom stayed at ' + zoomAfterCompressToggle);

    // Test 13: Preview download button stays named on narrow screens
    console.log('Test 13: Mobile preview download accessible name...');
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForFunction(function() {
        return window.matchMedia('(max-width: 767.98px)').matches;
    }, { timeout: 10000 });
    const previewDownloadBtn = await page.$('#previewDownloadBtn');
    const downloadAccessibility = await page.accessibility.snapshot({ root: previewDownloadBtn });
    assert(downloadAccessibility && downloadAccessibility.name === 'Download PDF', 'Expected mobile preview download button accessible name to be "Download PDF", got ' + JSON.stringify(downloadAccessibility));
    await page.setViewport({ width: 1280, height: 800 });
    console.log('  PASS: Accessible name on mobile is ' + downloadAccessibility.name);

    // Test 14: Delete first image
    console.log('Test 14: Delete first image...');
    const src5 = await getPreviewRenderId();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src5, 5);
    const items6 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items6 === 5, 'Expected 5 files after delete, got ' + items6);
    const size6 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items6 + ' files, PDF size: ' + size6);

    // Test 15: Delete down to placeholder
    console.log('Test 15: Delete down to placeholder...');
    while (await page.$$eval('#items li', function(lis) { return lis.length; }) > 1) {
        const prevRenderId = await getPreviewRenderId();
        const currentCount = await page.$$eval('#items li', function(lis) { return lis.length; });
        await page.click('#items li:first-child .delete-btn');
        await waitForPdfRegeneration(prevRenderId, currentCount - 1);
    }
    await page.click('#items li:first-child .delete-btn');
    await page.waitForFunction(function() {
        const ph = document.getElementById('preview-placeholder');
        return ph && ph.style.display !== 'none';
    }, { timeout: 30000 });
    const items7 = await page.$$eval('#items li', function(lis) { return lis.length; });
    const placeholder = await page.$eval('#preview-placeholder', function(el) {
        return el.style.display !== 'none';
    });
    assert(items7 === 0, 'Expected 0 files, got ' + items7);
    assert(placeholder === true, 'Expected placeholder to be visible');
    console.log('  PASS: ' + items7 + ' files, placeholder visible');

    console.log('\nAll tests passed!');
    await browser.close();
    server.close();
})().catch(function(err) {
    console.error('FAIL:', err.message);
    process.exit(1);
});
