$(function(){
  
  /*
  
  Analysis UX Flow:
  
  User enters URL and clicks "Analyze" ->
  Perform search for existing results and show (Re)submit button ->
  Request gets resubmitted, page polls for updates ->
  page notifies user as soon as results are present
  
  */
  
  var analysisResults = $("#analysis-results"),
      analysisTable = $("#analysis-table"),
      analyzeStep1 = $("#analyze-step1"),
      analyzeStep1ButtonIcon = analyzeStep1.find("button i"),
      analyzeStep2 = $("#analyze-step2"),
      analyzeStep2Button = analyzeStep2.find("button"),
      lazyRecaptchaInit = false;
  
  
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
                          "analyze-recaptcha", {
                            theme: "white",
                            callback: Recaptcha.focus_response_field
                          });
       });
       lazyRecaptchaInit = true;
     }
    
    return false;
  });
  
  
  analyzeStep2.submit(function(){
    $.post("/api/submit", $(this).serialize(), "json").then(function(data){
      console.log("FIXME: Submit");
  });
});