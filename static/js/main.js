/*
  
Analysis UX Flow:
  
User enters URL and clicks "Analyze" ->
Perform search for existing results and show (Re)submit button ->
Request gets resubmitted, page polls for updates ->
page notifies user as soon as results are present
  
*/
(function($){
  
  var exports = {};
  window.thugme = exports;
  
  var notifySound = new buzz.sound("/static/sounds/airhorn", {
    formats: [ "ogg", "mp3" ],
    preload: false,
    autoplay: false,
    loop: false
  }); 
  
  function replaceState(url){
    history.pushState({}, "", url);
  }

  var TemplateMixin = {
    initialize: function(args){
      this._initialize.apply(this,args);
    },
    _initialize: function(node, options){
      this.$parentNode = $(node);
      this.options = $.extend({}, this.defaults, options);
      this.render();
    },
    render: function(){
      if(!this._template){
        console.debug("Rendering template",this);
        var templatesrc = this.template.indexOf("#") == 0 ? $(this.template).html() : this.template;
        Object.getPrototypeOf(this)._template = _.template($.trim(templatesrc));
      }
      var $e = $($.parseHTML(this._template(this))[0]);
      if(this.$element)
        this.$element.replaceWith($e)
      this.$element = $e;
      this._attachNodes();
    },
    _attachNodes: function(){
      
      var addAttribute = (function(name,value){
        if(name in this)
          throw "Cannot attach to attribute: "+name+" already exists.";
        this[name] = value;
      }).bind(this);
      
      this.$element.find("[data-attach]").each(function(){
        var attr = $(this).data("attach");
        addAttribute(attr,this);
        addAttribute("$"+attr,$(this));
      });
    }
  }
  
  var MainView = exports.MainView = function(node,options){
    this.initialize(arguments);
    
    this.$parentNode.append(this.$element);
    
    this.$analyzeForm.submit(this.search.bind(this));
  };
  $.extend(MainView.prototype,TemplateMixin,{
    template: "#maintpl",
    defaults: {},
    search: function(){
      //Search for existing results
      this.$analyzeButtonIcon.addClass("icon-spin");
      $.post("/api/search", $(this).serialize(), "json").then((function(data){
        this.$analyzeButtonIcon.removeClass("icon-spin");
      
        var hasResults = (data.results.length > 0);
      
        //hide/show analysis table if we have results
        hasResults ? this.$analysisTable.show("fast") : this.$analysisTable.hide("fast");
        if(hasResults) {
          console.log("FIXME: display results");
          this.$analysisTable.html($("<pre>").text(JSON.stringify(data.results, null, "  ")));
        
        } else {
          //analysisTable.html("<div class="alert alert-info">...</div>");
        }
        new SubmitHandler(this.$parentNode,{url:this.$analyzeUrl.val()});
      }).bind(this));
      return false;
    }
  });
  
  var SubmitHandler = function(node,options){
    this.initialize(arguments);

    this.$element.submit(this.submit.bind(this));
    
    this.$element.hide();
    this.$parentNode.append(this.$element);
    this.$element.fadeIn();

    this.initCaptcha();
  };
  $.extend(SubmitHandler.prototype, TemplateMixin, {
    template: "#submittpl",
    defaults:  {url:"http://example.com/"},
    initCaptcha: function(){
      //Lazy-load Recaptcha
      
      var showRecaptcha = (function(){
        Recaptcha.create("6LcYzt0SAAAAAMG60o7oeNa9AZ_BYz0fAgc64Pu4", //FIXME: insert correct key
                         this.captcha, {
                           theme: "white",
                           callback: Recaptcha.focus_response_field
                         });
      }).bind(this);
      
      if(!window.lazyRecaptchaInit){
        $.getScript("//www.google.com/recaptcha/api/js/recaptcha_ajax.js").then(showRecaptcha);
        window.lazyRecaptchaInit = true;
      } else {
        showRecaptcha();
      }
    },
    submit: function(){
      $.post("/api/analyze", this.$element.serialize(), "json").then((function(data){
        if(!data.success && this.$element.serialize().indexOf("foo") === -1) { //FIXME Debug
          this.$captchaError.slideDown("fast");
          Recaptcha.reload();
        } else {
          this.$parentNode.children().slideUp().promise().done(function(){
            $(this).remove();
          });
          new QueueHandler(this.$parentNode, {}, data.success ? data : {id:"abc",queue:6}); //FIXME Debug
        }
      }).bind(this));
      return false;
    }
  });

  var ShareWidget = exports.ShareWidget = function(node,options){
    this.initialize(arguments);

    this.$parentNode.append(this.$element);

    this.$element.on("click",".share-open",function(){
      window.open(this.href,'', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600');
      return false;
    });
    
    this.$urlCopyInput
      .click(function(){
        $(this).select();
      })
      .tooltip();
  };
  $.extend(ShareWidget.prototype,TemplateMixin, {
    template: "#sharetpl",
    defaults: {text: "Share:", url: "http://example.com"}
  });
  
  var QueueHandler = exports.QueueHandler = function(node,options,firstData){
    this.initialize(arguments);
    this.id = firstData ? firstData.id || options.id : options.id;
    
    this.initGui(this.$parentNode);
    
    
    if(firstData)
      this.handleStatus(firstData);
    else
      this.pollStatus();
    
    this.pollStatusInterval = window.setInterval(this.pollStatus.bind(this),3000);
  };
  $.extend(QueueHandler.prototype, TemplateMixin, {
    template: "#queuetpl",
    defaults: { showSuccessMessage: false },
    initGui: function(node){
  	  var url = "/analysis/"+this.id;
      //hide existing content
    
      new ShareWidget(this.$shareWidget,
                      {text: "Share analysis:",
                       url: location.host + url});
    
      this.$notifyButton.click(this.notifyClick.bind(this));
    
      this.$element.hide();
      this.$parentNode.append(this.$element);
      this.$element.slideDown();
      
      notifySound.load();
      replaceState(url);
    },
    pollStatus: function(){
      console.log("Poll Status for "+this.id+"...");
      $.get("/api/analysis/"+this.id, this.handleStatus.bind(this),"json");
    },
    handleStatus: function(data){
      if(data.complete) {
        window.clearInterval(this.pollStatusInterval);
        this.notify();
        this.$parentNode.children().slideUp().promise().done(function(){
          $(this).remove();
        });
        console.log("FIXME: Show results");
        //FIXME: show results
      } else {
        this.setQueueNumber(data.queue);
      }
    },
    setQueueNumber: function(no){
      this.$queuePosition.text(no);
    },
    notify: function(){
      if(!this.$notifyButton.hasClass("active"))
        return;
      notifySound.stop();
      notifySound.play();
    },
    notifyClick: function(){
      //TODO: Add support for HTML5 Notifications API as soon as Chrome supports the new spec
      // http://www.html5rocks.com/en/tutorials/notifications/quick/
      if(!this.$notifyButton.hasClass("active")) { //activated
        notifySound.play();
      } else { //deactivated
      }
    }
  });
  
})(jQuery);