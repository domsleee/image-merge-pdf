var Compress = (function() {
    var Compress = function(opts) {
        this._enabled = false;
        this._quality = 0.7;
        this._changeHandlers = [];
        this._cache = {};
        this._setupUI(opts);
    };

    Compress.prototype._setupUI = function(opts) {
        var checkbox = opts.checkbox;
        var slider = opts.slider;
        var sliderContainer = opts.sliderContainer;
        var valueDisplay = opts.valueDisplay;
        var _this = this;

        checkbox.addEventListener('change', function() {
            _this._enabled = checkbox.checked;
            sliderContainer.style.display = checkbox.checked ? 'block' : 'none';
            _this._hasChanged();
        });

        slider.addEventListener('input', function() {
            _this._quality = slider.value / 100;
            valueDisplay.textContent = slider.value;
            _this._cache = {};
            _this._hasChanged();
        });
    };

    Compress.prototype._hasChanged = function() {
        for (var i = 0; i < this._changeHandlers.length; i++) {
            this._changeHandlers[i]();
        }
    };

    Compress.prototype.addChangeHandler = function(handle) {
        this._changeHandlers.push(handle);
    };

    Compress.prototype.isEnabled = function() {
        return this._enabled;
    };

    Compress.prototype.getQuality = function() {
        return this._quality;
    };

    // Compress a single file object by converting to JPG via canvas
    Compress.prototype.compressFile = function(nf, callback) {
        var key = nf.id;
        if (this._cache[key]) {
            callback(this._cache[key]);
            return;
        }

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = nf.img.width;
        canvas.height = nf.img.height;
        ctx.drawImage(nf.img, 0, 0);

        var jpgBase64;
        try {
            jpgBase64 = canvas.toDataURL('image/jpeg', this._quality);
        } catch (e) {
            callback(nf);
            return;
        }
        var _this = this;
        var compressedImg = new Image();
        compressedImg.onload = function() {
            var result = {
                'base64': jpgBase64,
                'type': 'image/jpeg',
                'name': nf.name,
                'img': compressedImg
            };
            _this._cache[key] = result;
            callback(result);
        };
        compressedImg.src = jpgBase64;
    };

    // Compress a list of file objects, returns via callback
    Compress.prototype.compressList = function(list, callback) {
        if (!this._enabled || list.length === 0) {
            callback(list);
            return;
        }

        var result = [];
        var remaining = list.length;
        var _this = this;

        for (var i = 0; i < list.length; i++) {
            (function(index) {
                _this.compressFile(list[index], function(compressed) {
                    result[index] = compressed;
                    if (--remaining === 0) {
                        callback(result);
                    }
                });
            })(i);
        }
    };

    return Compress;
})();

module.exports = Compress;
