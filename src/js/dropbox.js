var Dropbox = (function() {
    var _nextId = 1;

    // constructor
    var Dropbox = function(el) {
        this._el = el;
        this._dropHandlers = [];
        this._addDragEvents();
        this._addClickEvents();
    }
    Dropbox.prototype._addDragEvents = function() {
        var el = this._el;
        var _this = this;
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
        var el = this._el;
        var _this = this;
        var fd = el.querySelector('.fileDialog');

        el.addEventListener('click', function(e) {
            fd.click();
        });
        fd.addEventListener('change', function(e) {
            _this._handleFileList(e.target.files);
        }, false);
    }
    Dropbox.prototype._handleFileList = function(files) {
        var _this = this;
        var nfs = [];
        var count = files.length;

        var async = {
            fun: function(file, i) {
                var name = file.name;
                var type = file.type;
                var filereader = new FileReader();
                filereader.onload = function(e) {
                    var img = new Image();
                    var nf = {
                        'id': _nextId++,
                        'base64': e.target.result,
                        'type': type,
                        'name': name,
                        'img': img
                    };
                    nfs[i] = nf;
                    img.onload = function() { if (--count == 0) async.done(); }
                    img.src = e.target.result;
                };
                filereader.readAsDataURL(file);
            },
            done: function() {
                var dh = _this._dropHandlers;
                for (var i = 0; i < dh.length; i++) dh[i](nfs);                
            }
        }
        for (var i = 0; i < files.length; i++) async.fun(files[i], i);
    }
    Dropbox.prototype.addDropHandler = function(handle) {
        this._dropHandlers.push(handle);
    }
    return Dropbox;
})();

module.exports = Dropbox;