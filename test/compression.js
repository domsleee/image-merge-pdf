// Test script to measure JPG compression ratios for scanner-like images
// Simulates A4 scanned documents at 300 DPI (2480x3508 pixels)

var { createCanvas } = require('canvas');

var WIDTH = 2480;
var HEIGHT = 3508;
var NUM_PAGES = 8;

function generateScannerLikeImage() {
    var canvas = createCanvas(WIDTH, HEIGHT);
    var ctx = canvas.getContext('2d');

    // White background (like scanned paper)
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Add scanner noise/grain
    var imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
        var noise = (Math.random() - 0.5) * 20;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    // Add some text-like content (dark blocks to simulate text lines)
    ctx.fillStyle = '#1a1a1a';
    for (var y = 200; y < HEIGHT - 200; y += 45) {
        var lineWidth = 300 + Math.random() * (WIDTH - 700);
        ctx.fillRect(200, y, lineWidth, 8);
    }

    return canvas;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

console.log('Generating scanner-like test image (' + WIDTH + 'x' + HEIGHT + ')...\n');
var canvas = generateScannerLikeImage();

var pngBuf = canvas.toBuffer('image/png');
console.log('PNG size (1 page): ' + formatBytes(pngBuf.length));
console.log('PNG size (8 pages): ' + formatBytes(pngBuf.length * NUM_PAGES));
console.log('');

var qualities = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
console.log('Quality | JPG Size (1pg) | JPG Size (8pg) | Ratio vs PNG');
console.log('--------|----------------|----------------|-------------');

for (var q = 0; q < qualities.length; q++) {
    var quality = qualities[q];
    var jpgBuf = canvas.toBuffer('image/jpeg', { quality: quality / 100 });
    var ratio = ((1 - jpgBuf.length / pngBuf.length) * 100).toFixed(1);
    console.log(
        ('   ' + quality).slice(-3) + '%    | ' +
        (formatBytes(jpgBuf.length) + '               ').slice(0, 15) + '| ' +
        (formatBytes(jpgBuf.length * NUM_PAGES) + '               ').slice(0, 15) + '| ' +
        ratio + '% smaller'
    );
}

console.log('\nRecommendation: Quality 70% is a good default for scanned documents.');
console.log('It provides significant compression while maintaining readable text.');
