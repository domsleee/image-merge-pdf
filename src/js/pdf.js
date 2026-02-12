var Pdf = (function() {
    var PDFDocument = require('pdfkit');
    var BlobStream = require('blob-stream');

    var Pdf = function(el) {
        this.el = el;
        this._finishHandlers = [];
    }
    Pdf.prototype.makePDF = function(list) {
        // create a document and pipe to a blob
        var doc = new PDFDocument({
            'margin': 0,
            'autoFirstPage': false
        });
        var stream = doc.pipe(BlobStream());

        for (var i = 0; i < list.length; i++) {
            var img = list[i].img;
            doc.addPage({
                'size': [img.width, img.height],
                'margin': 0
            });
            var image = list[i].base64;
            doc.image(image, 0, 0);
        }

        // end and display the document in the iframe to the right
        doc.end();
        var _this = this;
        stream.on('finish', function() {
            var blob = stream.toBlob('application/pdf');
            _this.el.src = URL.createObjectURL(blob);
            for (var i = 0; i < _this._finishHandlers.length; i++) {
                _this._finishHandlers[i](blob);
            }
        });
    }
    Pdf.prototype.addFinishHandler = function(handle) {
        this._finishHandlers.push(handle);
    }
    return Pdf;
})();

module.exports = Pdf;
