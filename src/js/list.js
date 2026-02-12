var Sortable = require('sortablejs');

var List = (function() {
    var List = function(el) {
        this._el = el;
        this._changeHandlers = [];
        this._list = [];

        var _this = this;
        this._sortable = new Sortable(el, {
            // Element dragging ended
            onEnd: function(e) {
                var l = _this._list;
                var a = l[e.oldIndex];
                for (var i = e.oldIndex; i < e.newIndex; i++) l[i] = l[i+1];
                for (var i = e.oldIndex; i > e.newIndex; i--) l[i] = l[i-1];
                l[e.newIndex] = a;
                _this._hasChanged();
            }
        });
    }
    List.prototype.add = function(nfs) {
        for (var i = 0; i < nfs.length; i++) {
            var nf = nfs[i];
            this._list.push(nf);
            var li = document.createElement('li');
            var handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.innerHTML = '&#9776;';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            nameSpan.textContent = nf.name;
            var deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remove';
            li.appendChild(handle);
            li.appendChild(nameSpan);
            li.appendChild(deleteBtn);
            this._el.appendChild(li);

            var _this = this;
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var li = e.target.parentNode;
                var ind = Array.prototype.indexOf.call(_this._el.children, li);
                _this.remove(ind);
            });
        }
        this._hasChanged();
    }
    List.prototype.remove = function(i) {
        this._el.children[i].remove();
        this._list.splice(i, 1);
        this._hasChanged();
    }
    List.prototype._hasChanged = function() {
        for (var i = 0; i < this._changeHandlers.length; i++) {
            this._changeHandlers[i]();
        }
    }
    List.prototype.getList = function() {
        return this._list;
    }
    List.prototype.addChangeHandler = function(handle) {
        this._changeHandlers.push(handle);
    }
    return List;
})();

module.exports = List;