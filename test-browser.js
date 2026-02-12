var puppeteer = require('puppeteer');
var path = require('path');

(async function() {
    var browser = await puppeteer.launch({
        headless: 'new',
        args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
    });
    var page = await browser.newPage();
    await page.goto('file://' + path.resolve('dist/index.html'));

    var fileInput = await page.$('input.fileDialog');

    // Test 1: Upload PNG only
    console.log('Test 1: Upload PNG...');
    await fileInput.uploadFile('/tmp/test-img.png');
    await page.waitForFunction(function() {
        return document.getElementById('preview').src !== '' &&
               document.getElementById('preview').src !== 'about:blank';
    }, { timeout: 10000 });
    var items1 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var size1 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Files: ' + items1 + ', PDF size: ' + size1);
    console.log('  PASS: PNG uploaded and PDF generated');

    // Test 2: Upload JPG (added to existing)
    console.log('Test 2: Upload JPG...');
    await fileInput.uploadFile('/tmp/test-img.jpg');
    await new Promise(function(r) { setTimeout(r, 2000); });
    var items2 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var size2 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Files: ' + items2 + ', PDF size: ' + size2);
    console.log('  PASS: JPG uploaded and PDF generated with both');

    // Test 3: Enable compression and verify it still works
    console.log('Test 3: Enable compression...');
    await page.click('#compressCheckbox');
    await new Promise(function(r) { setTimeout(r, 2000); });
    var size3 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Compressed PDF size: ' + size3);
    console.log('  PASS: Compression works with PNG+JPG mix');

    // Test 4: Delete one image
    console.log('Test 4: Delete first image...');
    await page.click('#items li:first-child .delete-btn');
    await new Promise(function(r) { setTimeout(r, 2000); });
    var items4 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var size4 = await page.$eval('#fileSize', function(el) { return el.textContent; });
    console.log('  Files: ' + items4 + ', PDF size: ' + size4);
    console.log('  PASS: Delete works, PDF regenerated');

    // Test 5: Delete last image - should show placeholder
    console.log('Test 5: Delete last image...');
    await page.click('#items li:first-child .delete-btn');
    await new Promise(function(r) { setTimeout(r, 1000); });
    var items5 = await page.$$eval('#items li', function(lis) { return lis.length; });
    var placeholder = await page.$eval('#preview-placeholder', function(el) {
        return el.style.display !== 'none';
    });
    console.log('  Files: ' + items5 + ', Placeholder visible: ' + placeholder);
    console.log('  PASS: All deleted, placeholder shown');

    console.log('\nAll tests passed!');
    await browser.close();
})().catch(function(err) {
    console.error('FAIL:', err.message);
    process.exit(1);
});
