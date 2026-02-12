var { createCanvas } = require('canvas');
var fs = require('fs');
var os = require('os');
var path = require('path');

var tmpDir = os.tmpdir();
var c = createCanvas(200, 200);
var ctx = c.getContext('2d');

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

// Generate large images for perf tests
if (process.argv.includes('--perf')) {
    var perfCanvas = createCanvas(3000, 3000);
    var pctx = perfCanvas.getContext('2d');
    var colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
    for (var i = 0; i < 8; i++) {
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
