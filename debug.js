// whether to log debug information to the console
const debug = true; 

(function() {
  // debug printer (I dunno if this is good practice lol)
  if (debug) {var log = console.log.bind(window.console);}
  else {var log = function(){}}
  
  module.exports.log = log;
}());
