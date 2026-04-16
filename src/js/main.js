require('bootstrap');

var Dropbox = require('./dropbox');
var List = require('./list');
var Compress = require('./compress');

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function buildDownloadName(fileList) {
    if (!fileList.length) return 'merged.pdf';

    var now = new Date();
    var year = String(now.getFullYear());
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');

    return year + month + day + '-merged.pdf';
}

document.addEventListener('DOMContentLoaded', function(){
    var drop = new Dropbox(document.getElementById('dropbox'));
    var list = new List(document.getElementById('items'));
    var compress = new Compress({
        checkbox: document.getElementById('compressCheckbox'),
        slider: document.getElementById('qualitySlider'),
        sliderContainer: document.getElementById('quality-slider-container'),
        valueDisplay: document.getElementById('qualityValue')
    });

    var downloadBtn = document.getElementById('downloadBtn');
    var fileSize = document.getElementById('fileSize');
    var downloadSection = document.getElementById('downloadSection');
    var fileListSection = document.getElementById('file-list-section');
    var previewPlaceholder = document.getElementById('preview-placeholder');
    var previewActive = document.getElementById('preview-active');
    var currentBlob = null;
    var currentDownloadName = 'merged.pdf';
    var pdf = null;
    var pdfLoading = false;
    var pdfQueue = null;

    function waitForPreviewModule(callback) {
        if (window.PdfPreview) {
            callback();
            return;
        }
        window.setTimeout(function() {
            waitForPreviewModule(callback);
        }, 25);
    }

    function loadPdf(callback) {
        if (pdf) { callback(); return; }
        if (pdfLoading) { pdfQueue = callback; return; }
        pdfLoading = true;
        waitForPreviewModule(function() {
            var script = document.createElement('script');
            script.src = 'js/pdf.min.js';
            script.onload = function() {
                pdf = new window.Pdf(document.getElementById('preview'));
                pdf.addFinishHandler(function(blob) {
                    currentBlob = blob;
                    fileSize.textContent = formatBytes(blob.size);
                    downloadSection.style.display = 'block';
                });
                pdfLoading = false;
                callback();
                if (pdfQueue) { var q = pdfQueue; pdfQueue = null; q(); }
            };
            document.body.appendChild(script);
        });
    }

    function updateLayout(hasFiles) {
        fileListSection.style.display = hasFiles ? 'block' : 'none';
        previewPlaceholder.style.display = hasFiles ? 'none' : '';
        previewActive.style.display = hasFiles ? 'block' : 'none';
        if (!hasFiles) downloadSection.style.display = 'none';
    }

    function regeneratePDF() {
        var fileList = list.getList();
        currentDownloadName = buildDownloadName(fileList);
        updateLayout(fileList.length > 0);
        if (fileList.length === 0) {
            currentBlob = null;
            if (pdf) {
                pdf.clear();
            }
            return;
        }
        loadPdf(function() {
            pdf.setDownloadName(currentDownloadName);
            compress.compressList(fileList, function(processed) {
                pdf.makePDF(processed);
            });
        });
    }

    downloadBtn.addEventListener('click', function() {
        if (!currentBlob) return;
        var url = URL.createObjectURL(currentBlob);
        var a = document.createElement('a');
        a.href = url;
        a.download = currentDownloadName;
        a.click();
        URL.revokeObjectURL(url);
    });

    list.addChangeHandler(regeneratePDF);
    compress.addChangeHandler(regeneratePDF);

    drop.addDropHandler(function(nfs) {
        list.add(nfs);
    });
});
