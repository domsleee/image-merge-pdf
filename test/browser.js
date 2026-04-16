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
        }, { timeout: 10000 }, prevRenderId);
        await page.waitForFunction(function(pageCount) {
            return document.querySelectorAll('#preview canvas').length === pageCount;
        }, { timeout: 10000 }, expectedPages);
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

    // Test 6: Right-click preview context menu download
    console.log('Test 6: Context menu download...');
    await page.click('#downloadBtn');
    await page.evaluate(function() { window.__lastDownloadName = null; });
    await page.click('#preview canvas', { button: 'right' });
    await page.waitForSelector('.preview-context-menu:not([hidden])');
    await page.click('.preview-context-action');
    const contextMenuDownloadName = await getLastDownloadName();
    assert(contextMenuDownloadName === expectedDownloadName, 'Expected context menu download name, got ' + contextMenuDownloadName);
    console.log('  PASS: Context menu download name: ' + contextMenuDownloadName);

    // Test 7: Delete first image
    console.log('Test 7: Delete first image...');
    const src5 = await getPreviewRenderId();
    await page.click('#items li:first-child .delete-btn');
    await waitForPdfRegeneration(src5, 4);
    const items6 = await page.$$eval('#items li', function(lis) { return lis.length; });
    assert(items6 === 4, 'Expected 4 files after delete, got ' + items6);
    const size6 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  PASS: ' + items6 + ' files, PDF size: ' + size6);

    // Test 8: Delete down to placeholder
    console.log('Test 8: Delete down to placeholder...');
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
    }, { timeout: 10000 });
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
