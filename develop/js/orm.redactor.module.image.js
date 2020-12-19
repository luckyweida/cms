$(function () {
    $R.add('module', 'image', {
        modals: {
            'image':
                '<div class="redactor-modal-tab redactor-modal-tab-upload" data-title="## upload ##"><form action=""> \
                    <input type="file" name="file"> \
                </form></div>',
            'imageedit':
                '<div class="redactor-modal-group"> \
                    <div id="redactor-modal-image-preview" class="redactor-modal-side"></div> \
                    <form action="" class="redactor-modal-area"> \
                        <div class="form-item"> \
                            <label for="modal-image-title"> ## title ##</label> \
                            <input type="text" id="modal-image-title" name="title" /> \
                        </div> \
                        <div class="form-item form-item-caption"> \
                            <label for="modal-image-caption">## caption ##</label> \
                            <input type="text" id="modal-image-caption" name="caption" aria-label="## caption ##" /> \
                        </div> \
                        <div class="form-item form-item-align"> \
                            <label>## image-position ##</label> \
                            <select name="align" aria-label="## image-position ##"> \
                                <option value="none">## none ##</option> \
                                <option value="left">## left ##</option> \
                                <option value="center">## center ##</option> \
                                <option value="right">## right ##</option> \
                            </select> \
                        </div> \
                        <div class="form-item form-item-link"> \
                            <label for="modal-image-url">## link ##</label> \
                            <input type="text" id="modal-image-url" name="url" aria-label="## link ##" /> \
                        </div> \
                        <div class="form-item form-item-link"> \
                            <label class="checkbox"><input type="checkbox" name="target" aria-label="## link-in-new-tab ##"> ## link-in-new-tab ##</label> \
                        </div> \
                    </form> \
                </div>'
        },
        init: function(app)
        {
            this.app = app;
            this.opts = app.opts;
            this.lang = app.lang;
            this.caret = app.caret;
            this.utils = app.utils;
            this.editor = app.editor;
            this.storage = app.storage;
            this.component = app.component;
            this.inspector = app.inspector;
            this.insertion = app.insertion;
            this.selection = app.selection;

            // local
            this.justResized = false;
        },
        // messages
        oninsert: function()
        {
            this._observeImages();
        },
        onstarted: function()
        {
            // storage observe
            this.storage.observeImages();

            // resize
            if (this.opts.imageResizable)
            {
                this.resizer = $R.create('image.resize', this.app);
            }

            // observe
            this._observeImages();
        },
        ondropimage: function(e, files, clipboard)
        {
            if (!this.opts.imageUpload) return;

            var options = {
                url: this.opts.imageUpload,
                event: (clipboard) ? false : e,
                files: files,
                name: 'imagedrop',
                data: this.opts.imageData,
                paramName: this.opts.imageUploadParam
            };

            this.app.api('module.upload.send', options);
        },
        onstop: function()
        {
            if (this.resizer) this.resizer.stop();
        },
        onbottomclick: function()
        {
            this.insertion.insertToEnd(this.editor.getLastNode(), 'image');
        },
        onimageresizer: {
            stop: function()
            {
                if (this.resizer) this.resizer.hide();
            }
        },
        onsource: {
            open: function()
            {
                if (this.resizer) this.resizer.hide();
            },
            closed: function()
            {
                this._observeImages();
                if (this.resizer) this.resizer.rebuild();
            }
        },
        onupload: {
            complete: function()
            {
                this._observeImages();
            },
            image: {
                complete: function(response)
                {
                    this._insert(response);
                },
                error: function(response)
                {
                    this._uploadError(response);
                }
            },
            imageedit: {
                complete: function(response)
                {
                    this._change(response);
                },
                error: function(response)
                {
                    this._uploadError(response);
                }
            },
            imagedrop: {
                complete: function(response, e)
                {
                    this._insert(response, e);
                },
                error: function(response)
                {
                    this._uploadError(response);
                }
            },
            imagereplace: {
                complete: function(response)
                {
                    this._change(response, false);
                },
                error: function(response)
                {
                    this._uploadError(response);
                }
            }
        },
        onmodal: {
            image: {
                open: function($modal, $form)
                {
                    this._setUpload($modal, $form);
                }
            },
            imageedit: {
                open: function($modal, $form)
                {
                    this._setFormData($modal, $form);
                },
                opened: function($modal, $form)
                {
                    this._setFormFocus($form);
                },
                remove: function()
                {
                    this._remove(this.$image);
                },
                save: function($modal, $form)
                {
                    this._save($modal, $form);
                }
            }
        },
        onimage: {
            observe: function()
            {
                this._observeImages();
            },
            resized: function()
            {
                this.justResized = true;
            }
        },
        oncontextbar: function(e, contextbar)
        {
            if (this.justResized)
            {
                this.justResized = false;
                return;
            }

            var current = this.selection.getCurrent();
            var data = this.inspector.parse(current);
            var $img = $R.dom(current).closest('img');

            if (!data.isFigcaption() && data.isComponentType('image') || $img.length !== 0)
            {
                var node = ($img.length !== 0) ? $img.get() : data.getComponent();
                var buttons = {
                    "edit": {
                        title: this.lang.get('edit'),
                        api: 'module.image.open'
                    },
                    "remove": {
                        title: this.lang.get('delete'),
                        api: 'module.image.remove',
                        args: node
                    }
                };

                contextbar.set(e, node, buttons);
            }
        },

        // public
        open: function()
        {
            this.$image = this._getCurrent();
            this._pzImageEdit.call(this);
            // this.app.api('module.modal.build', this._getModalData());
        },
        insert: function(data)
        {
            this._insert(data);
        },
        remove: function(node)
        {
            this._remove(node);
        },

        // private
        _getModalData: function()
        {
            var modalData;
            if (this._isImage() && this.opts.imageEditable)
            {
                modalData = {
                    name: 'imageedit',
                    width: '800px',
                    title: this.lang.get('edit'),
                    handle: 'save',
                    commands: {
                        save: { title: this.lang.get('save') },
                        remove: { title: this.lang.get('delete'), type: 'danger' },
                        cancel: { title: this.lang.get('cancel') }
                    }
                };
            }
            else
            {
                modalData = {
                    name: 'image',
                    title: this.lang.get('image')
                };
            }

            return modalData;
        },
        _isImage: function()
        {
            return this.$image;
        },
        _getCurrent: function()
        {
            var current = this.selection.getCurrent();
            var data = this.inspector.parse(current);
            var $img = $R.dom(current).closest('img');

            if ($img.length !== 0) {
                return this.component.create('image', $img);
            }
            else {
                return (data.isComponentType('image') && data.isComponentActive()) ? this.component.create('image', data.getComponent()) : false;
            }
        },
        _insert: function(response, e)
        {
            this.app.api('module.modal.close');

            if (Array.isArray(response))
            {
                var obj = {};
                for (var i = 0; i < response.length; i++)
                {
                    obj = $R.extend(obj, response[i]);
                }

                response = obj;
            }
            else if (typeof response === 'string')
            {
                response = { "file": { url: response }};
            }

            if (typeof response === 'object')
            {

                var multiple = 0;
                for (var key in response)
                {
                    if (typeof response[key] === 'object') multiple++;
                }

                if (multiple > 1)
                {
                    this._insertMultiple(response, e);
                }
                else
                {
                    this._insertSingle(response, e);
                }
            }
        },
        _insertSingle: function(response, e)
        {
            for (var key in response)
            {
                if (typeof response[key] === 'object')
                {
                    var $img = this._createImageAndStore(response[key]);
                    var inserted = (e) ? this.insertion.insertToPoint(e, $img, false, false) : this.insertion.insertHtml($img, false);

                    this._removeSpaceBeforeFigure(inserted[0]);

                    // set is active
                    this.component.setActive(inserted[0]);
                    this.app.broadcast('image.uploaded', inserted[0], response);
                }
            }
        },
        _insertMultiple: function(response, e)
        {
            var z = 0;
            var inserted = [];
            var last;
            for (var key in response)
            {
                if (typeof response[key] === 'object')
                {
                    z++;

                    var $img = this._createImageAndStore(response[key]);

                    if (z === 1)
                    {
                        inserted = (e) ? this.insertion.insertToPoint(e, $img, false, false) : this.insertion.insertHtml($img, false);
                    }
                    else
                    {
                        var $inserted = $R.dom(inserted[0]);
                        $inserted.after($img);
                        inserted = [$img.get()];

                        this.app.broadcast('image.inserted', $img);
                    }

                    last = inserted[0];

                    this._removeSpaceBeforeFigure(inserted[0]);
                    this.app.broadcast('image.uploaded', inserted[0], response);
                }
            }

            // set last is active
            this.component.setActive(last);
        },
        _createImageAndStore: function(item)
        {
            var $img = this.component.create('image');

            $img.addClass('redactor-uploaded-figure');
            $img.setData({
                src: item.url,
                id: (item.id) ? item.id : this.utils.getRandomId()
            });

            // add to storage
            this.storage.add('image', $img.getElement());

            return $img;
        },
        _removeSpaceBeforeFigure: function(img)
        {
            if (!img) return;

            var prev = img.previousSibling;
            var next = img.nextSibling;
            var $prev = $R.dom(prev);
            var $next = $R.dom(next);

            if (this.opts.breakline) {
                if (next && $next.attr('data-redactor-tag') === 'br') {
                    $next.find('br').first().remove();
                }
                if (prev && $prev.attr('data-redactor-tag') === 'br') {
                    $prev.find('br').last().remove();
                }
            }

            if (prev)
            {
                this._removeInvisibleSpace(prev);
                this._removeInvisibleSpace(prev.previousSibling);
            }
        },
        _removeInvisibleSpace: function(el)
        {
            if (el && el.nodeType === 3 && this.utils.searchInvisibleChars(el.textContent) !== -1)
            {
                el.parentNode.removeChild(el);
            }
        },
        _save: function($modal, $form)
        {
            var data = $form.getData();
            var imageData = {
                title: data.title
            };

            if (this.opts.imageLink) imageData.link = { url: data.url, target: data.target };
            if (this.opts.imageCaption) imageData.caption = data.caption;
            if (this.opts.imagePosition) imageData.align = data.align;

            this.$image.setData(imageData);
            if (this.resizer) this.resizer.rebuild();

            this.app.broadcast('image.changed', this.$image);
            this.app.api('module.modal.close');
        },
        _change: function(response, modal)
        {
            if (typeof response === 'string')
            {
                response = { "file": { url: response }};
            }

            if (typeof response === 'object')
            {
                var $img;
                for (var key in response)
                {
                    if (typeof response[key] === 'object')
                    {
                        $img = $R.dom('<img>');
                        $img.attr('src', response[key].url);

                        this.$image.changeImage(response[key]);

                        this.app.broadcast('image.changed', this.$image, response);
                        this.app.broadcast('image.uploaded', this.$image, response);

                        this.app.broadcast('hardsync');

                        break;
                    }
                }

                if (modal !== false)
                {
                    $img.on('load', function() { this.$previewBox.html($img); }.bind(this));
                }
            }
        },
        _uploadError: function(response)
        {
            this.app.broadcast('image.uploadError', response);
        },
        _remove: function(node)
        {
            this.app.api('module.modal.close');
            this.component.remove(node);
        },
        _observeImages: function()
        {
            var $editor = this.editor.getElement();
            var self = this;
            $editor.find('img').each(function(node)
            {
                var $node = $R.dom(node);

                $node.off('.drop-to-replace');
                $node.on('dragover.drop-to-replace dragenter.drop-to-replace', function(e)
                {
                    e.preventDefault();
                    return;
                });

                $node.on('drop.drop-to-replace', function(e)
                {
                    if (!self.app.isDragComponentInside())
                    {
                        return self._setReplaceUpload(e, $node);
                    }
                });
            });
        },
        _setFormData: function($modal, $form)
        {
            this._buildPreview($modal);
            this._buildPreviewUpload();

            var imageData = this.$image.getData();
            var data = {
                title: imageData.title
            };

            // caption
            if (this.opts.imageCaption) data.caption = imageData.caption;
            else $modal.find('.form-item-caption').hide();

            // position
            if (this.opts.imagePosition) data.align = imageData.align;
            else $modal.find('.form-item-align').hide();

            // link
            if (this.opts.imageLink)
            {
                if (imageData.link)
                {
                    data.url = imageData.link.url;
                    if (imageData.link.target) data.target = true;
                }
            }
            else $modal.find('.form-item-link').hide();

            $form.setData(data);
        },
        _setFormFocus: function($form)
        {
            $form.getField('title').focus();
        },
        _setReplaceUpload: function(e, $node)
        {
            e = e.originalEvent || e;
            e.stopPropagation();
            e.preventDefault();

            if (!this.opts.imageUpload) return;

            this.$image = this.component.create('image', $node);

            var options = {
                url: this.opts.imageUpload,
                files: e.dataTransfer.files,
                name: 'imagereplace',
                data: this.opts.imageData,
                paramName: this.opts.imageUploadParam
            };

            this.app.api('module.upload.send', options);

            return;
        },
        _setUpload: function($modal, $form)
        {
            if (!this.opts.imageUpload) {
                var $body = $modal.getBody();
                var $tab = $body.find('.redactor-modal-tab-upload');
                $tab.remove();
            }

            var options = {
                url: this.opts.imageUpload,
                element: $form.getField('file'),
                name: 'image',
                data: this.opts.imageData,
                paramName: this.opts.imageUploadParam
            };

            this.app.api('module.upload.build', options);
        },
        _buildPreview: function($modal)
        {
            this.$preview = $modal.find('#redactor-modal-image-preview');

            var imageData = this.$image.getData();
            var $previewImg = $R.dom('<img>');
            $previewImg.attr('src', imageData.src);

            this.$previewBox = $R.dom('<div>');
            this.$previewBox.append($previewImg);

            this.$preview.html('');
            this.$preview.append(this.$previewBox);
        },
        _buildPreviewUpload: function()
        {
            if (!this.opts.imageUpload) return;

            var $desc = $R.dom('<div class="desc">');
            $desc.html(this.lang.get('upload-change-label'));

            this.$preview.append($desc);

            var options = {
                url: this.opts.imageUpload,
                element: this.$previewBox,
                name: 'imageedit',
                data: this.opts.imageData,
                paramName: this.opts.imageUploadParam
            };

            this.app.api('module.upload.build', options);
        },
        _pzImageEdit: function()
        {
            const schemeAndHttpHost = (location.protocol === 'https:' ? 'https://' : 'http://') + window.location.host;

            var _this = this;
            var imageCode = null;
            var imageSize = null;
            var parsedUrl = null;

            var data = this.$image.getData();
            var link = data.link;
            var url = typeof link == 'object' && typeof link.url !== "undefined" ? link.url : '';
            var target = typeof link == 'object' && typeof link.url !== "undefined" ? link.target : 0;

            var src = data.src;
            try {
                parsedUrl = new URL(src);
            } catch (ex) {

            }

            if (parsedUrl) {
                alert('Can not crop external linked image');
                return;
            }

            try {
                parsedUrl = new URL(src, schemeAndHttpHost);
            } catch (ex) {
            }

            if (!parsedUrl) {
                alert('Can not recognise the image URL');
                return;
            }

            var srcFragments = parsedUrl.pathname.split('/');
            if (srcFragments.length >= 4) {
                imageCode = srcFragments[3];
            }

            if (srcFragments.length >= 5) {
                imageSize = srcFragments[4];
            }

            $.ajax({
                type: 'GET',
                url: '/manage/rest/asset/file/size',
                data: {
                    code: imageCode,
                    size: imageSize,
                },
            }).done(function (msg) {
                if (msg.id) {
                    console.log(data)
                    var template_crop_image = Handlebars.compile($('#crop-image-redactor').html());
                    $('#crop-image-modal').html(template_crop_image({
                        code: msg.id,
                        width: msg.width,
                        height: msg.height,
                        imageSizes: window._imageSizes,
                        size: msg.size,
                        alt: data.title,
                        caption: data.caption,
                        align: data.align,
                        url: url,
                        target: target,
                    }));
                    fc.setUpCropModal();

                    $('.js-redactor-save').on('click', function () {
                        var formData = $('.js-redactor-edit-image').serializeArray();
                        var imageData = {};
                        for (var idx in formData) {
                            var itm = formData[idx];
                            imageData[itm.name] = itm.value;
                        }

                        imageData.target = (typeof imageData.target != "undefined" && imageData.target == 'on') ? 1 : 0;

                        if (typeof imageData.align != "undefined" && imageData.align) {
                            imageData.align = 'img-' + imageData.align;
                        } else {
                            imageData.align = ''
                        }

                        var selectedImageSize = 1;
                        if (imageData.size) {
                            selectedImageSize = $('#redactor_image_size option:selected').data('code');
                        }

                        imageData.src = '/images/assets/' + imageCode + '/' + selectedImageSize + '?v=' + Math.random();
                        console.log(imageData);
                        var current = _this.selection.getCurrent();
                        $(current).removeClass('img-left');
                        $(current).removeClass('img-right');
                        $(current).removeClass('img-center');
                        $(current).addClass(imageData.align);

                        var template_image = Handlebars.compile($('#crop-image-redactor-img-with-figure').html());
                        $(current).html(template_image(imageData))
                        $.fancybox.close();
                    });

                } else {
                    alert('Can not crop this image');
                }
            });


        },
    });
});