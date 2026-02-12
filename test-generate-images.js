var { createCanvas } = require('canvas');
var fs = require('fs');

var c = createCanvas(200, 200);
var ctx = c.getContext('2d');

ctx.fillStyle = 'blue';
ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'white';
ctx.font = '24px sans-serif';
ctx.fillText('PNG test', 30, 110);
fs.writeFileSync('/tmp/test-img.png', c.toBuffer('image/png'));

ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'white';
ctx.fillText('JPG test', 30, 110);
fs.writeFileSync('/tmp/test-img.jpg', c.toBuffer('image/jpeg'));

console.log('Test images generated.');
