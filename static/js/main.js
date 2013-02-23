/*
  
Analysis UX Flow:
  
User enters URL and clicks "Analyze" ->
Perform search for existing results and show (Re)submit button ->
Request gets resubmitted, page polls for updates ->
page notifies user as soon as results are present
  
*/
  
  /*ar analysisResults            = $("#analysis-results"),
      analysisTable              = $("#analysis-table"),
      analyzeStep1               = $("#analyze-step1"),
      analyzeStep1Url            = analyzeStep1.find("input[name=url]"),
      analyzeStep1ButtonIcon     = analyzeStep1.find("button i");*/
  var main = $("#main");
  
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
    initialize: function(options){
      this.options = $.extend({}, this.defaults, options);
      this.render();
    },
    render: function(){
      if(!this._template){
        console.log("Rendering template",this);
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
      var self = this;
      this.$element.find("[data-attach]").each(function(){
        var $this = $(this);
        var attr = $this.data("attach");
        if(attr in self)
          throw "Cannot attach to attribute: "+attr+" already exists.";
        self[$this.data("attach")] = $this;
      });
    }
  }
  
  var MainView = function(node,options){
    this.initialize(options);
    
    $(node).append(this.$element);
    
    this.analyzeForm.submit(this.search.bind(this));
  };
  $.extend(MainView.prototype,TemplateMixin,{
    template: "#maintpl",
    defaults: {},
    search: function(){
      //Search for existing results
      this.analyzeButtonIcon.addClass("icon-spin");
      $.post("/api/search", $(this).serialize(), "json").then((function(data){
        this.analyzeButtonIcon.removeClass("icon-spin");
      
        var hasResults = (data.results.length > 0);
      
        //hide/show analysis table if we have results
        hasResults ? this.analysisTable.show("fast") : this.analysisTable.hide("fast");
        if(hasResults) {
          console.log("FIXME: display results");
          this.analysisTable.html($("<pre>").text(JSON.stringify(data.results, null, "  ")));
        
        } else {
          //analysisTable.html("<div class="alert alert-info">...</div>");
        }
        new SubmitHandler(main,{url:this.analyzeUrl.val()});
      }).bind(this));
      return false;
    }
  });
  
  var SubmitHandler = function(node,options){
    this.initialize(options)
    
    this.$element.submit(this.submit.bind(this));
    
    this.$element.hide();
    $(node).append(this.$element);
    this.$element.fadeIn();

    this.initCaptcha();
  };
  $.extend(SubmitHandler.prototype, TemplateMixin, {
    template: "#submittpl",
    defaults:  {url:"http://example.com/"},
    initCaptcha: function(){
      //Lazy-load Recaptcha
      
      var showRecaptcha = (function(){
        Recaptcha.create("6Ld4iQsAAAAAAM3nfX_K0vXaUudl2Gk0lpTF3REf", //FIXME: insert correct key
                         this.captcha.get(0), {
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
          this.captchaError.slideDown("fast");
          Recaptcha.reload();
        } else {
          main.children().slideUp().promise().done(function(){
            $(this).remove();
          });
          new QueueHandler(main, {}, data.success ? data : {id:"abc",queue:6}); //FIXME Debug
        }
      }).bind(this));
      return false;
    }
  });

  var ShareWidget = function(node,options){
    this.initialize(options);

    $(node).append(this.$element);

    this.$element.on("click",".share-open",function(){
      window.open(this.href,'', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600');
      return false;
    });
    
    this.urlCopyInput
      .click(function(){
        $(this).select();
      })
      .tooltip();
  };
  $.extend(ShareWidget.prototype,TemplateMixin, {
    template: "#sharetpl",
    defaults: {text: "Share:", url: "http://example.com"}
  });
  
  var QueueHandler = function(node,options,firstData){
    this.id = _.escape(firstData.id);
    this.initialize(options);
    
    this.initGui(node);
    
    
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
    
      new ShareWidget(this.$element.find(".share"),
                      {text: "Share analysis:",
                       url: location.host + url});
    
      this.$notifyButton = this.$element.find("button.notify");
      this.$notifyButton.click(this.notifyClick.bind(this));
    
      this.$element.hide();
      $(node).append(this.$element);
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
        main.children().slideUp().promise().done(function(){
          $(this).remove();
        });
        console.log("FIXME: Show results");
        //FIXME: show results
      } else {
        this.setQueueNumber(data.queue);
      }
    },
    setQueueNumber: function(no){
      this.$element.find(".queue-position").text(no);
    },
    notify: function(){
      if(!this.$notifyButton.hasClass("active"))
        return;
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