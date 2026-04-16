var Pdf = (function() {
    const PDFDocument = require('pdfkit');
    const BlobStream = require('blob-stream');

    function getPageSize(item) {
        if (item.dpi && item.dpi.unit === 2 && item.dpi.x && item.dpi.y) {
            return [
                item.img.width * 72 / item.dpi.x,
                item.img.height * 72 / item.dpi.y
            ];
        }
        return [item.img.width, item.img.height];
    }

    var Pdf = function(el) {
        this.el = el;
        this._finishHandlers = [];
        this._currentUrl = null;
    }
    Pdf.prototype.makePDF = function(list) {
        // create a document and pipe to a blob
        const doc = new PDFDocument({
            'margin': 0,
            'autoFirstPage': false
        });
        const stream = doc.pipe(BlobStream());

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const img = item.img;
            const pageSize = getPageSize(item);
            doc.addPage({
                'size': pageSize,
                'margin': 0
            });
            const image = item.pdfBase64 || item.base64;
            doc.image(image, 0, 0, {
                width: pageSize[0],
                height: pageSize[1]
            });
        }

        // end and display the document in the iframe to the right
        doc.end();
        const _this = this;
        stream.on('finish', function() {
            const blob = stream.toBlob('application/pdf');
            if (_this._currentUrl) URL.revokeObjectURL(_this._currentUrl);
            _this._currentUrl = URL.createObjectURL(blob);
            _this.el.src = _this._currentUrl;
            for (let i = 0; i < _this._finishHandlers.length; i++) {
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
