const UTIF = require('utif2');
const TIFF_PDF_MAX_DPI = 200;
const PDF_INPUT_SCALE = 2;

var Dropbox = (function() {
    let _nextId = 1;

    // constructor
    var Dropbox = function(el) {
        this._el = el;
        this._dropHandlers = [];
        this._addDragEvents();
        this._addClickEvents();
    }
    Dropbox.prototype._addDragEvents = function() {
        const el = this._el;
        const _this = this;
        el.addEventListener('dragover', function(e) {
            e.preventDefault();
            el.classList.add('over');
        });
        el.addEventListener('dragleave', function(e) {
            el.classList.remove('over');
        });
        el.addEventListener('drop', function(e) {
            e.preventDefault();
            el.classList.remove('over');
            _this._handleFileList(e.dataTransfer.files);
        }, false);
    }
    Dropbox.prototype._addClickEvents = function() {
        const el = this._el;
        const _this = this;
        const fd = el.querySelector('.fileDialog');

        el.addEventListener('click', function(e) {
            fd.click();
        });
        fd.addEventListener('change', function(e) {
            _this._handleFileList(e.target.files);
        }, false);
    }
    Dropbox.prototype._isTiffFile = function(file) {
        return file.type === 'image/tiff' || /\.tiff?$/i.test(file.name);
    }
    Dropbox.prototype._isPdfFile = function(file) {
        return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    }
    Dropbox.prototype._waitForPdfJs = function(done) {
        if (window.pdfjsLib) {
            done(window.pdfjsLib);
            return;
        }
        window.setTimeout(() => {
            this._waitForPdfJs(done);
        }, 25);
    }
    Dropbox.prototype._createImageFile = function(name, type, base64, done) {
        const img = new Image();
        const nf = {
            'id': _nextId++,
            'base64': base64,
            'type': type,
            'name': name,
            'img': img
        };
        img.onload = function() { done(nf); };
        img.onerror = function() { done(null); };
        img.src = base64;
    }
    Dropbox.prototype._loadBrowserImage = function(file, done) {
        const filereader = new FileReader();
        const _this = this;
        filereader.onload = function(e) {
            _this._createImageFile(file.name, file.type, e.target.result, done);
        };
        filereader.onerror = function() { done(null); };
        filereader.readAsDataURL(file);
    }
    Dropbox.prototype._loadTiffImage = function(file, done) {
        const filereader = new FileReader();
        const _this = this;
        filereader.onload = function(e) {
            try {
                const buffer = e.target.result;
                const ifds = UTIF.decode(buffer);
                if (!ifds.length) {
                    done(null);
                    return;
                }
                UTIF.decodeImage(buffer, ifds[0]);
                const rgba = UTIF.toRGBA8(ifds[0]);
                const width = ifds[0].width || ifds[0].t256[0];
                const height = ifds[0].height || ifds[0].t257[0];
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                if (rgba.length !== width * height * 4) {
                    console.warn('TIFF decode size mismatch: expected ' + (width * height * 4) + ' bytes, got ' + rgba.length);
                    done(null);
                    return;
                }
                const imageData = ctx.createImageData(width, height);
                imageData.data.set(rgba);
                ctx.putImageData(imageData, 0, 0);
                _this._createImageFile(file.name, 'image/png', canvas.toDataURL('image/png'), function(nf) {
                    if (!nf) {
                        done(null);
                        return;
                    }
                    var xRes = ifds[0].t282, yRes = ifds[0].t283, resUnit = ifds[0].t296;
                    nf.dpi = {
                        x: xRes ? (Array.isArray(xRes[0]) ? xRes[0][0] / xRes[0][1] : xRes[0]) : null,
                        y: yRes ? (Array.isArray(yRes[0]) ? yRes[0][0] / yRes[0][1] : yRes[0]) : null,
                        unit: resUnit ? resUnit[0] : null
                    };
                    if (nf.dpi.unit === 2 && nf.dpi.x && nf.dpi.y) {
                        const scale = Math.min(1, TIFF_PDF_MAX_DPI / Math.max(nf.dpi.x, nf.dpi.y));
                        if (scale < 1) {
                            const pdfCanvas = document.createElement('canvas');
                            const pdfCtx = pdfCanvas.getContext('2d');
                            pdfCanvas.width = Math.round(width * scale);
                            pdfCanvas.height = Math.round(height * scale);
                            pdfCtx.drawImage(canvas, 0, 0, pdfCanvas.width, pdfCanvas.height);
                            nf.pdfBase64 = pdfCanvas.toDataURL('image/png');
                        }
                    }
                    done(nf);
                });
            } catch (err) {
                done(null);
            }
        };
        filereader.onerror = function() { done(null); };
        filereader.readAsArrayBuffer(file);
    }
    Dropbox.prototype._loadPdfFile = function(file, done) {
        const filereader = new FileReader();
        const _this = this;

        filereader.onload = function(e) {
            _this._waitForPdfJs(function(pdfjsLib) {
                (async function() {
                    const bytes = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
                    const pages = [];

                    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                        const page = await pdf.getPage(pageNumber);
                        const viewport = page.getViewport({ scale: PDF_INPUT_SCALE });
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = Math.ceil(viewport.width);
                        canvas.height = Math.ceil(viewport.height);

                        await page.render({
                            canvasContext: ctx,
                            viewport: viewport
                        }).promise;

                        const name = file.name.replace(/\.pdf$/i, '') + ' - page ' + pageNumber + '.png';
                        const nf = await new Promise(function(resolve) {
                            _this._createImageFile(name, 'image/png', canvas.toDataURL('image/png'), function(result) {
                                if (result) {
                                    result.dpi = {
                                        x: 72 * PDF_INPUT_SCALE,
                                        y: 72 * PDF_INPUT_SCALE,
                                        unit: 2
                                    };
                                }
                                resolve(result);
                            });
                        });

                        if (nf) {
                            pages.push(nf);
                        }
                    }

                    await pdf.destroy();
                    done(pages);
                })().catch(function() {
                    done([]);
                });
            });
        };
        filereader.onerror = function() { done([]); };
        filereader.readAsArrayBuffer(file);
    }
    Dropbox.prototype._handleFileList = function(files) {
        const _this = this;
        const nfs = [];
        let remaining = files.length;

        if (remaining === 0) return;

        function finishFile(i, loadedItems) {
            nfs[i] = loadedItems || [];
            remaining--;
            if (remaining !== 0) return;

            const loaded = [];
            for (let index = 0; index < nfs.length; index++) {
                if (nfs[index] && nfs[index].length) {
                    Array.prototype.push.apply(loaded, nfs[index]);
                }
            }
            const dh = _this._dropHandlers;
            for (let j = 0; j < dh.length; j++) dh[j](loaded);
        }

        for (let i = 0; i < files.length; i++) {
            (function(index) {
                const file = files[index];
                if (_this._isPdfFile(file)) {
                    _this._loadPdfFile(file, function(items) {
                        finishFile(index, items);
                    });
                    return;
                }

                const load = _this._isTiffFile(file) ? _this._loadTiffImage : _this._loadBrowserImage;
                load.call(_this, file, function(nf) {
                    finishFile(index, nf ? [nf] : []);
                });
            })(i);
        }
    }
    Dropbox.prototype.addDropHandler = function(handle) {
        this._dropHandlers.push(handle);
    }
    return Dropbox;
})();

module.exports = Dropbox;
