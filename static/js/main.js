$(function(){
  
  /*
  
  Analysis UX Flow:
  
  User enters URL and clicks "Analyze" ->
  Perform search for existing results and show (Re)submit button ->
  Request gets resubmitted, page polls for updates ->
  page notifies user as soon as results are present
  
  */
  
  var analysisResults            = $("#analysis-results"),
      analysisTable              = $("#analysis-table"),
      analyzeStep1               = $("#analyze-step1"),
      analyzeStep1Url            = analyzeStep1.find("input[name=url]"),
      analyzeStep1ButtonIcon     = analyzeStep1.find("button i"),
      analyzeStep2               = $("#analyze-step2"),
      analyzeStep2Url            = analyzeStep2.find("input[name=url]"),
      analyzeStep2Button         = analyzeStep2.find("button[type=submit]"),
      analyzeStep2CaptchaErr     = $("#analyze-step2-captchaerror"),
      analyzeStep3               = $("#analyze-step3"),
      analyzeStep3NotifyButton   = $("#analyze-step3-notify"),
      allSteps                   = analysisResults.add(analyzeStep1).add(analyzeStep2).add(analyzeStep3),
      lazyRecaptchaInit          = false;
  
  var notifySound = new buzz.sound("/static/sounds/airhorn", {
    formats: [ "ogg", "mp3" ],
    preload: false,
    autoplay: false,
    loop: false
  }); 
  
  function replaceState(url){
    history.pushState({}, "", url);
  }
  
  analyzeStep1.submit(function(){
    
    //Search for existing results
    analyzeStep1ButtonIcon.addClass("icon-spin");
    $.post("/api/search", $(this).serialize(), "json").then(function(data){
      analyzeStep1ButtonIcon.removeClass("icon-spin");
      
      var hasResults = (data.results.length > 0);
      
      //hide/show analysis table if we have results
      hasResults ? analysisResults.show("fast") : analysisResults.hide("fast");
      if(hasResults) {
        console.log("FIXME: display results");
        analysisTable.html($("<pre>").text(JSON.stringify(data.results, null, "  ")));
        
      }
      analyzeStep2.show();
    });
    
    //Lazy init Recaptcha
    if(!lazyRecaptchaInit){
      $.getScript("http://www.google.com/recaptcha/api/js/recaptcha_ajax.js").then(function(){
        Recaptcha.create("6Ld4iQsAAAAAAM3nfX_K0vXaUudl2Gk0lpTF3REf", //FIXME: insert correct key
                         "analyze-step2-recaptcha", {
                           theme: "white",
                           callback: Recaptcha.focus_response_field
                         });
      });
      lazyRecaptchaInit = true;
    }
    
    //copy over url to second form
    analyzeStep2Url.val(analyzeStep1Url.val());
    
    return false;
  });
  
  
  analyzeStep2.submit(function(){
    $.post("/api/analyze", $(this).serialize(), "json").then(function(data){
      if(!data.success && this.data.indexOf("foo") === -1) { //FIXME Debug
        analyzeStep2CaptchaErr.slideDown("fast");
        Recaptcha.reload();
      } else {
        new QueueHandler(data.success ? data : {id:"abc",queue:6}); //FIXME Debug
      }
    });
    return false;
  });

  var ShareWidget = function(element,options){
  	this.$element = $(element).html(ShareWidget.template(options));
    
    this.$element.on("click",".share-open",function(){
      window.open(this.href,'', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600');
      return false;
    });
    
    this.$element.find("input")
      .click(function(){
        $(this).select();
      })
      .tooltip();
  };
  ShareWidget.template = _.template($("#sharetpl").html());

  
  
  var QueueHandler = function(data){
    this.id = _.escape(data.id);
    
    this.initGui();
    
    if(data)
      this.handleStatus(data);
    else
      this.pollStatus();
    this.pollStatusInterval = window.setInterval(this.pollStatus.bind(this),3000);
  };
  QueueHandler.prototype.initGui = function(){
  	var url = "/analysis/"+this.id;
    //hide existing content
    allSteps.not(analyzeStep3).slideUp();
    
    new ShareWidget("#analyze-step3-share",
                    {text: "Share analysis:",
                     url: location.host + url});
    
    analyzeStep3NotifyButton.click(this.notifyClick.bind(this));
    
    analyzeStep3.slideDown();
    replaceState(url);
  };
  QueueHandler.prototype.pollStatus = function(){
    console.log("Poll Status...");
    $.get("/api/analysis/"+this.id, this.handleStatus.bind(this),"json");
  };
  QueueHandler.prototype.handleStatus = function(data){
    if(data.complete) {
      window.clearInterval(this.pollStatusInterval);
      this.notify();
      //play sound
      //show results
    } else {
      this.setQueueNumber(data.queue);
    }
  };
  QueueHandler.prototype.setQueueNumber = function(no){
    $(".queue-position").text(no);
  };
  QueueHandler.prototype.notify = function(){
    if(!analyzeStep3NotifyButton.hasClass("active"))
      return;
    notifySound.play();
  }
  QueueHandler.prototype.notifyClick = function(){
    //TODO: Add support for HTML5 Notifications API as soon as Chrome supports the new spec
    // http://www.html5rocks.com/en/tutorials/notifications/quick/
    console.log("notifyClick",!analyzeStep3NotifyButton.hasClass("active"));
    if(!analyzeStep3NotifyButton.hasClass("active")) { //activated
      notifySound.play();
    } else { //deactivated
    }
  };
  
});