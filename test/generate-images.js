const { createCanvas } = require('canvas');
const fs = require('fs');
const os = require('os');
const path = require('path');
const UTIF = require('utif2');
const PDFDocument = require('pdfkit');

const tmpDir = os.tmpdir();
const c = createCanvas(200, 200);
const ctx = c.getContext('2d');

ctx.fillStyle = 'blue';
ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'white';
ctx.font = '24px sans-serif';
ctx.fillText('PNG test', 30, 110);
fs.writeFileSync(path.join(tmpDir, 'test-img.png'), c.toBuffer('image/png'));

ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'white';
ctx.fillText('JPG test', 30, 110);
fs.writeFileSync(path.join(tmpDir, 'test-img.jpg'), c.toBuffer('image/jpeg'));

ctx.fillStyle = 'green';
ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'white';
ctx.fillText('TIF test', 30, 110);
const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
const tif = Buffer.from(UTIF.encodeImage(rgba, c.width, c.height));
fs.writeFileSync(path.join(tmpDir, 'test-img.tif'), tif);

const pdfDoc = new PDFDocument({ margin: 0 });
const pdfChunks = [];
pdfDoc.on('data', chunk => pdfChunks.push(chunk));
pdfDoc.on('end', () => {
    fs.writeFileSync(path.join(tmpDir, 'test-input.pdf'), Buffer.concat(pdfChunks));
});
pdfDoc.fontSize(24).text('PDF input test', 30, 60);
pdfDoc.addPage();
pdfDoc.fontSize(24).text('PDF input page 2', 30, 60);
pdfDoc.end();

// Generate large images for perf tests
if (process.argv.includes('--perf')) {
    const perfCanvas = createCanvas(3000, 3000);
    const pctx = perfCanvas.getContext('2d');
    const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
    for (let i = 0; i < 8; i++) {
        pctx.fillStyle = colors[i];
        pctx.fillRect(0, 0, 3000, 3000);
        pctx.fillStyle = 'white';
        pctx.font = '80px sans-serif';
        pctx.fillText('Perf ' + (i + 1), 100, 200);
        fs.writeFileSync(path.join(tmpDir, 'test-perf-' + (i + 1) + '.png'), perfCanvas.toBuffer('image/png'));
    }
    console.log('Perf test images generated.');
}

console.log('Test images generated in ' + tmpDir);
