/**
 * Created by hn on 14-3-17.
 */

define( function ( require ) {

    var kity = require( "kity"),

        // UiUitls
        $$ = require( "ui/ui-impl/ui-utils" ),
        
        $ = require('jquery');

        Utils = require( "base/utils" ),

        VIEW_STATE = require( "ui/def" ).VIEW_STATE,

        Scrollbar = require( "ui/ui-impl/scrollbar/scrollbar" ),

        // Toolbar = require( "ui/toolbar/toolbar" ),
        // 控制组件
        ScrollZoom = require( "ui/control/zoom" ),

        // ELEMENT_LIST = require( "ui/toolbar-ele-list" ),

        Keyboard = require( "ui/keyboard/keyboard" ),
        Header = require("ui/header/header"),

        UIComponent = kity.createClass( 'UIComponent', {

            constructor: function ( kfEditor, options ) {

                var currentDocument = null;

                this.options = options;

                this.container = kfEditor.getContainer();
                
                this.switchThemeByDeviceType();

                currentDocument = this.container.ownerDocument;

                // ui组件实例集合
                this.components = {};

                this.canvasRect = null;
                this.viewState = VIEW_STATE.NO_OVERFLOW;

                this.kfEditor = kfEditor;

                this.header = createHeader( currentDocument );
                this.editArea = createEditArea( currentDocument );
                this.okButton = createOkButton( currentDocument );
                this.canvasContainer = createCanvasContainer( currentDocument );
                this.scrollbarContainer = createScrollbarContainer( currentDocument );
                this.keyboardContainer = createKeyboardContainer( currentDocument );
                
                this.editArea.appendChild( this.header );
                this.editArea.appendChild( this.canvasContainer );
                this.editArea.appendChild( this.okButton );
                this.container.appendChild( this.editArea );
                this.container.appendChild( this.scrollbarContainer );
                this.container.appendChild( this.keyboardContainer );

                this.initComponents();

                this.initServices();

                this.initEvent();

                this.initScrollEvent();

                this.updateSize();

            },
            updateSize: function () {
              const scale = this.options.scale;
              this.setScale(this.canvasContainer, scale, true);
              this.setScale(this.editArea, scale, false);
              this.setScaleByWidth(this.keyboardContainer, scale);
              const okButton = $(this.okButton);
              okButton.css('font-size', okButton.css('font-size').split('px')[0] * scale); 
              okButton.css('right', okButton.css('right').split('px')[0] * scale); 
            },
            setScaleByWidth: function (target, scale) {
              target.style.transform = `scale(${scale})`;
              target.style.transformOrigin = `left top`;
            },
            setScale: function (target, scale, useHeight) {
              const node = $(target);
              const width = node.outerWidth();
              const height = node.outerHeight();
              const padding = node.css('padding').split('px')[0];
              node.outerWidth(width * scale);
              useHeight && node.outerHeight(height * scale);
              node.css('padding', padding * scale + 'px');
              console.log(width, height, padding);
            },
            isAndroid: function () {
              return this.options.device === 'android';
            },

            switchThemeByDeviceType: function () {
              if (this.isAndroid()) {
                this.container.className += ' android';
              } else {
                this.container.className += ' pc';
              }
            },

            // 组件实例化
            initComponents: function () {

                // TODO 禁用缩放, 留待后面再重新开启
                if ( false ) {
//                if ( this.options.zoom ) {
                    this.components.scrollZoom = new ScrollZoom( this, this.kfEditor, this.canvasContainer, {
                        max: this.options.maxzoom,
                        min: this.options.minzoom
                    } );
                }

                this.components.header = new Header( this, this.kfEditor );
                this.components.scrollbar = new Scrollbar( this, this.kfEditor );

                // 软件盘
                this.components.keyboard = new Keyboard( this, this.kfEditor );

            },

            // 初始化服务
            initServices: function () {

                this.kfEditor.registerService( "ui.get.canvas.container", this, {
                    getCanvasContainer: this.getCanvasContainer
                } );

                this.kfEditor.registerService( "ui.update.canvas.view", this, {
                    updateCanvasView: this.updateCanvasView
                } );

                this.kfEditor.registerService( "ui.canvas.container.event", this, {
                    on: this.addEvent,
                    off: this.removeEvent,
                    trigger: this.trigger,
                    fire: this.trigger
                } );

            },

            initEvent: function () {
              $$.delegate(this.container.ownerDocument, '.kf-editor-ok', 'click', () => {
                this.kfEditor.execCommand('get.image.data', (data) => {
                  const formula = this.kfEditor.execCommand('get.source');
                  this.kfEditor.eclassWebService.send({
                    type: 'common.setFormula',
                    data: {
                      body: {
                        formulaSrc: data.img,
                        formula,
                      },
                    },
                  });
                });
              })
            },

            initScrollEvent: function () {

                var _self = this;

                this.kfEditor.requestService( "ui.set.scrollbar.update.handler", function ( proportion, offset, values ) {

                    offset = Math.floor( proportion * ( values.contentWidth - values.viewWidth ) );
                    _self.kfEditor.requestService( "render.set.canvas.offset", offset );

                } );

            },

            getCanvasContainer: function () {

                return this.canvasContainer;

            },

            addEvent: function ( type, handler ) {

                Utils.addEvent( this.canvasContainer, type, handler );

            },

            removeEvent: function () {},

            trigger: function ( type ) {

                Utils.trigger( this.canvasContainer, type );

            },

            // 更新画布视窗， 决定是否出现滚动条
            updateCanvasView: function () {

                var canvas = this.kfEditor.requestService( "render.get.canvas" ),
                    contentContainer = canvas.getContentContainer(),
                    contentRect = null;

                if ( this.canvasRect === null ) {
                    // 兼容firfox， 获取容器大小，而不是获取画布大小
                    this.canvasRect = this.canvasContainer.getBoundingClientRect();
                }

                contentRect = contentContainer.getRenderBox( "paper" );

                if ( contentRect.width > this.canvasRect.width ) {

                    if ( this.viewState === VIEW_STATE.NO_OVERFLOW  ) {
                        this.toggleViewState();
                        this.kfEditor.requestService( "ui.show.scrollbar" );
                        this.kfEditor.requestService( "render.disable.relocation" );
                    }

                    this.kfEditor.requestService( "render.relocation" );

                    // 更新滚动条， 参数是：滚动条所控制的内容长度
                    this.kfEditor.requestService( "ui.update.scrollbar", contentRect.width );
                    this.kfEditor.requestService( "ui.relocation.scrollbar" );

                } else {

                    if ( this.viewState === VIEW_STATE.OVERFLOW  ) {
                        this.toggleViewState();
                        this.kfEditor.requestService( "ui.hide.scrollbar" );
                        this.kfEditor.requestService( "render.enable.relocation" );
                    }

                    this.kfEditor.requestService( "render.relocation" );

                }

            },

            toggleViewState: function () {

                this.viewState = this.viewState === VIEW_STATE.NO_OVERFLOW ? VIEW_STATE.OVERFLOW : VIEW_STATE.NO_OVERFLOW;

            },

            getDeviceType: function () {
                return this.options.device;
            }

        } );

    // function createToolbarWrap ( doc ) {

    //     return $$.ele( doc, "div", {
    //         className: "kf-editor-toolbar"
    //     } );

    // }

    // function createToolbarContainer ( doc ) {

    //     return $$.ele( doc, "div", {
    //         className: "kf-editor-inner-toolbar"
    //     } );

    // }
    function createHeader ( doc ) {
      var container = doc.createElement('div');
      container.className = "kf-editor-header";
      return container;
    }
    
    function createOkButton ( doc ) {
      var container = doc.createElement( "div" );
      container.className = "kf-editor-ok";
      container.innerText = "确定";
      return container;
    }

    function createEditArea ( doc ) {
        var container = doc.createElement( "div" );
        container.className = "kf-editor-edit-area";
        return container;
    }

    function createCanvasContainer ( doc ) {
        var container = doc.createElement( "div" );
        container.className = "kf-editor-canvas-container";
        return container;
    }

    function createScrollbarContainer ( doc ) {
        var container = doc.createElement( "div" );
        container.className = "kf-editor-edit-scrollbar";
        return container;
    }

    function createKeyboardContainer ( doc ) {
        var container = doc.createElement('div');
        container.className = 'kf-editor-edit-keyboard';
        return container;
    }

    return UIComponent;

} );