import * as pdfjsLib from './vendor/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).toString();
window.pdfjsLib = pdfjsLib;

class PdfPreview {
    constructor(el) {
        this.el = el;
        this._renderToken = 0;
    }

    clear() {
        this._renderToken += 1;
        this.el.innerHTML = '';
        delete this.el.dataset.renderId;
    }

    async renderBlob(blob) {
        const token = ++this._renderToken;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        if (token !== this._renderToken) {
            await pdf.destroy();
            return;
        }

        this.el.innerHTML = '';

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            if (token !== this._renderToken) {
                break;
            }

            const unscaledViewport = page.getViewport({ scale: 1 });
            const styles = window.getComputedStyle(this.el);
            const horizontalPadding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
            const targetWidth = Math.max((this.el.clientWidth - horizontalPadding) || 480, 1);
            const scale = targetWidth / unscaledViewport.width;
            const outputScale = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: scale });
            const renderViewport = page.getViewport({ scale: scale * outputScale });

            const pageEl = document.createElement('div');
            pageEl.className = 'preview-page';
            pageEl.dataset.pageNumber = String(pageNumber);

            const canvas = document.createElement('canvas');
            canvas.className = 'preview-canvas';
            canvas.width = Math.ceil(renderViewport.width);
            canvas.height = Math.ceil(renderViewport.height);
            canvas.style.width = Math.ceil(viewport.width) + 'px';
            canvas.style.height = Math.ceil(viewport.height) + 'px';

            pageEl.appendChild(canvas);
            this.el.appendChild(pageEl);

            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: renderViewport
            }).promise;
        }

        this.el.dataset.renderId = String(token);
        await pdf.destroy();
    }
}

window.PdfPreview = PdfPreview;
