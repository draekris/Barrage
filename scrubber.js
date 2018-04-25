(function() {
  const debug = require("./debug.js");
  const vis = require("./vis.js");
  
  var howl;
  
  var canvas;
  var canvasCtx;
  var canvasWidth;
  //var canvasHeight;
  
  var offsetX;
  
  function refreshCoords() {
    offsetX = canvas.getBoundingClientRect().left;
    canvasWidth = canvas.width;
  }
  
  function calcMousePos(event) {
    return ((event.clientX - offsetX) / canvasWidth);
  }
  
  function handleMouseUp(event) {
    event.preventDefault();
    event.stopPropagation();
    
    howl.seek(howl.duration() * calcMousePos(event));
    vis.setMousePos(-1);
  }
  
  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    vis.setMousePos(calcMousePos(event));
  }
  
  function handleMouseOver(event) {
    event.preventDefault();
    event.stopPropagation();
    
    vis.setMousePos(calcMousePos(event));
    vis.resume();
  }
  
  function handleMouseMove(event) {
    event.preventDefault();
    event.stopPropagation();
    
    vis.setMousePos(calcMousePos(event));
  }
  
  function handleMouseOut(event) {
    event.preventDefault();
    event.stopPropagation();
    
    vis.setMousePos(-1);
  }
  
  module.exports.start = function(song) {
    canvas = document.querySelector("#analyser canvas");
    howl = song;
    refreshCoords();
    canvas.onmousedown = (function(event) {handleMouseDown(event);});
    canvas.onmouseup = (function(event) {handleMouseUp(event);});
    canvas.onmouseover = (function(event) {handleMouseOver(event);});
    canvas.onmousemove = (function(event) {handleMouseMove(event);});
    canvas.onmouseout = (function(event) {handleMouseOut(event);});
  };
}());
