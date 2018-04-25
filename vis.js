(function() {
  var howl;
  var audioCtx;
  var canvasCtx;
  var analyser;
  var bufferLength;
  
  var dataArray;
  var scaledDataArray;
  var barHeight;
  var barWidth;
  var x;
  
  var median = 1;
  var max = 1;
  
  var width;
  var height;
  
  var numBars;
  var playedProportion;
  var visExtra;
  
  var mousePos = -1;
  
  const math = require("mathjs")
  
  const debug = require("./debug.js");
  
  // color for vis bars coming "before" the elapsed song time
  const playedColor = "#6441a4";
  // color for vis bars coming "after" the elpased song time
  const unplayedColor = "#383438";
  // as above, but coming "before" the current mouse position
  const mousePlayedColor = "#8663c6";
  // as above, but coming "before" the current mouse position
  const mouseUnplayedColor = "#474447";
  // whether to produce a "bump" in the spectrum vis at the mouse position
  const mouseBump = true;
  const visExtraLimit = 100;
  
  // FFT size (spectrum resolution)
  // warn: large values are detrimental to performance
  const fftSize = 8192;
  // how much of the available spectrum data to display (from the minFreq)
  const spectrumProportion = 0.10;
  // smoother (across time)
  const smoothing = 0.1;
  
  // space between bars, in px
  const spacing = 1;
  
  // scaling consts =============================================================
  const medianProportionSubtracted = 0.6;
  const exp = 5;
  // smoothing across frequency
  const smoothScale = 0.6;
  
  function smooth(array, variance) {
    var tmean = math.mean(array) * variance;
    var out = Array(array.length);
    for (var i = 0; i < array.length; i++) {
      var previous = i > 0 ? out[i - 1] : array[i];
      var next = i < array.length ? array[i] : array[i - 1];
      out[i] = math.mean([tmean, math.mean([previous, array[i], next])]);
    }
    return out;
  }
  
  // this function has no basis in DSP or any other branch of rational thought
  // it is *art* (lol)
  function scaleData() {
    scaledDataArray = [];
    // emphasize larger values
    for (var i = 0; i < dataArray.length; i++) {
      scaledDataArray[i] = Math.pow(dataArray[i] / 255.0, exp);
    }
    mouseSig = ~~(mousePos * (width / (barWidth + 1)));
    scaledDataArray[mouseSig] = scaledDataArray[mouseSig] * 1.6 + .2;
    // again, ignore that piddly stuff
    median = math.median(scaledDataArray);
    for (var i = 0; i < scaledDataArray.length; i++) {
      scaledDataArray[i] = scaledDataArray[i] - median * medianProportionSubtracted;
    }
    // smooth it out a little (so ignoring the small values doesn't look so unnatural)
    scaledDataArray = smooth(scaledDataArray, smoothScale);
    // bump everything up to the proper height 
    for (var i = 0; i < scaledDataArray.length; i++) {
      scaledDataArray[i] = scaledDataArray[i] * height * 2;
    }
  }
  
  function draw() {
    if (howl && (howl.playing() || mousePos >= 0 || visExtra < visExtraLimit)) {
      if (!howl.playing()) {
        visExtra++;
      }
      drawVisual = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      dataArray = dataArray.slice(0, numBars);
    
      scaleData();
      playedProportion = howl.seek() / howl.duration();
      
      canvasCtx.fillStyle = "#181414";
      canvasCtx.fillRect(0, 0, width, height);
      
      x = 0;
      
      for (var i = 0; i < dataArray.length; i++) {
        barHeight = Math.max(scaledDataArray[i], 1);
        var iProportion = i / (width / (barWidth + 1));
        // yeah that's too much ternary...
        canvasCtx.fillStyle = (mousePos > iProportion ?
          (iProportion > playedProportion ? mouseUnplayedColor : mousePlayedColor):
          (iProportion > playedProportion ? unplayedColor : playedColor));
        canvasCtx.fillRect(x, height / 2 - barHeight / 2, barWidth, barHeight);
        x += barWidth + spacing;
      }
    } else {
      visExtra = 0;
      return;
    }
  }
  
  module.exports.setMousePos = function(value) {
    mousePos = value;
  };
  
  module.exports.start = function(Howler, song) {
    debug.log("Starting visualization...");
    
    howl = song;
    
    audioCtx = Howler.ctx;
    analyser = audioCtx.createAnalyser();
    Howler.masterGain.connect(analyser);
    
    // NEVER UNCOMMENT THIS, I'm leaving it here because I spent like four hours
    // trying to track down my audio quality bug and eventually found out this 
    // was both the problem and completely unnecessary.
    // analyser.connect(audioCtx.destination);
    
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    bufferLength = analyser.frequencyBinCount;
    debug.log(bufferLength);
    dataArray = new Uint8Array(bufferLength);
    
    canvasCtx = document.querySelector("#analyser canvas").getContext("2d");
    width = document.getElementById("analyser").clientWidth;
    height = document.getElementById("analyser").clientHeight;
    canvasCtx.canvas.width = width;
    canvasCtx.canvas.height = height;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    barWidth = Math.max((width / (bufferLength * spectrumProportion)), 1);
    numBars = width / (barWidth + spacing);
    draw();
  };
  
  module.exports.resume = function() {draw();};
  module.exports.stop = function() {howl = null;};
}());
