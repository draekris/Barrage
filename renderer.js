// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// icon paths ==================================================================
const play_icon = "resources/play_circle.svg";
const pause_icon = "resources/pause_circle.svg";

// config options ==============================================================
// whether newly drag-and-dropped songs play immediately
// otherwise, new songs are added to the end of the queue
const dropToFront = true;
// whether songs are removed from the queue after being played 
// (effectively, the "repeat" button)
const removeAfterPlayed = false;
// if the current song's position is more than this many seconds, rewind 
// seeks to the beginning of the song.
// Otherwise, it skips to the previous song.
const skipThreshold = 5;

// marquee pixels per second
const animPPS = 20;

// requires ====================================================================
const remote = require("electron").remote;
const howler = require("howler");
const mmd = require("music-metadata");
const aart = require("album-art");

// separate js file for frequency visualization
const vis = require("./vis.js");
// debug stuff
const debug = require("./debug.js");
// scrubbing stuff
const scrubber = require("./scrubber.js");

// actual stuff ================================================================
// there variables are poorly named, so probably read the descriptions

// whether we think something's playing
var playing = false;
// the play/pause DOM element
var ppButton;
// the marquee DOM element
var marquee;
// the song name DOM element
var songLabel;
// the artist name DOM element
var artistLabel;
// the album image DOM element
var albumImage;
// queue of songs to be played
var songQueue = [];
// the Howl, which is currently being played
var song;
// Howler's audio context (not populated until something's playing)
var context;

function printQueue() {
  out = "Current queue: ";
  for (var i = 0; i < songQueue.length; i++) {
    out = out + songQueue[i].name + ", ";
  }
  debug.log(out);
}

// set some stuff up (doesn't actually need to wait for onload, but whatever)
window.onload = function() {
  ppButton = document.querySelector("#pp img");
  marquee = document.querySelector(".marquee");
  songLabel = document.querySelector("#song");
  song2Label = document.querySelector("#song2");
  artistLabel = document.querySelector("#artist");
  albumImage = document.querySelector("#art img");
  
  document.querySelector("#closeButton").addEventListener("click", close);
  
  // drag-and-drop files
  // adapted from https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
  document.addEventListener("dragover", function(event) {
    debug.log("Drag over detected.");
    event.preventDefault();
    return false;
  }, false);

  document.addEventListener("drop", function(event) {
    debug.log("Drop detected.");
    dropHandler(event);
  }, false);
  
  document.addEventListener("dragend", function(event) {
    debug.log("Drag ended.");
    event.preventDefault();
    return false;
  }, false);
  
  document.querySelector("#pp img").addEventListener("click", pp);
  document.querySelector("#re img").addEventListener("click", re);
  document.querySelector("#ff img").addEventListener("click", ff);
  
  handleMarquee();
}

// when (a) file(s) is/are dropped on the document, handle it, hopefully
function dropHandler(event) {
  event.preventDefault();
  debug.log("File dropped.");
  debug.log(event.dataTransfer);
  
  if (event.dataTransfer.items) {
    for (var i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[i].kind === "file") {
        var file = event.dataTransfer.items[i].getAsFile();
        readMetadata(file);
      } else if (event.dataTransfer.items[i]) {
        debug.log("Unexpected drag type: ");
        debug.log(event.dataTransfer.items[i]);
      }
    }
  } else {
    debug.log("Weird drop format?");
    //for (var i = 0; i < event.dataTransfer.files.length; i++) {
    //  debug.log(event.dataTransfer.files[i].name);
    //}
  }
}

// read file metadata and add it to the file object
function readMetadata(file) {
  debug.log("Attempting to read metadata for: " + file.name);
  mmd.parseFile(file.path, {native: true})
  .then(function (metadata) {
    file.metadata = metadata;
    aart(metadata.common.artist, {album: metadata.common.album})
    .then(function (artPath) {
      if (artPath instanceof Error) {
        throw "Album not found.";
      }
      file.metadata.artPath = artPath;
      addToQueue(file);
      playFromQueue();
    })
    .catch(function (error) {
      debug.log("Album art fetch error: ")
      debug.log(error);
      file.metadata.artPath = "resources/audiotrack.svg";
      addToQueue(file);
      playFromQueue();
    })
  })
  .catch(function (error) {
    debug.log("Metadata read error: ")
    file.metadata = {};
    file.metadata.common = {};
    file.metadata.common.title = file.name;
    file.metadata.common.artist = "Unknown Artist";
    file.metadata.common.album = "Unknown Album";
    file.metadata.artPath = "resources/audiotrack.svg";
    addToQueue(file);
    playFromQueue();
    debug.log(error);
  })
}

// attempt to add a file to the song queue 
function addToQueue(file) {
  index = songQueue.findIndex(element => (element.path === file.path));
  // if the song is already in the queue, move it to the start
  if (index >= 0) {
    songQueue.splice(index, 1); // remove the song 
  }
  if (dropToFront) {
    songQueue.unshift(file); // add song to beginning of queue
  } else {
    songQueue.push(file); // add song to end of queue
  }
  printQueue();
}

// play the song at the front of the queue 
function playFromQueue() {
  debug.log("Attempting to play from queue...");
  if (songQueue.length > 0) {
    playFile(songQueue[0]);
  } else {
    debug.log("Play From Queue Error: no files found.");
  }
}

// attempt to play a file
function playFile(file) {
  pausePlayback();
  showMetadata(file);
  vis.stop();
  
  debug.log("Creating new Howl...");
  song = new Howl({src: file.path});
  song.on("end", function() {
    handleSongEnd(song, file);
  });
  debug.log("New Howl created.");
  song.once("load", function() {
    pausePlayback();
    debug.log("song loaded.");
    vis.start(Howler, song);
    scrubber.start(song);
    resumePlayback();
    debug.log("Now playing: " + file.name);
    return;
  });
  if (song.state() === "loaded") {
    debug.log("song already loaded.");
    vis.start(Howler, song);
    scrubber.start(song);
    resumePlayback();
    debug.log("Now playing: " + file.name);
  } else {
    debug.log("Play File Error: No load state.\nIn some cases this is an expected artifact of Howler.js (i.e., I don't know why it happens but it still works fine.)")
  }
}

function showMetadata(file) {
  songLabel.textContent = file.metadata.common.title;
  artistLabel.textContent = file.metadata.common.artist;
  if (file.metadata.common.picture && file.metadata.common.picture[0].format && file.metadata.common.picture[0].data) {
    debug.log("Loading image from metadata.");
    var image = new Image();
    image.src = "data:image/" + file.metadata.common.picture[0].format + ";base64," + file.metadata.common.picture[0].data.toString("base64");
    //debug.log(image); // (spits out the whole data URL, if you're into that)
    albumImage.src = image.src;
  } else {
    debug.log("Using remote (Last.fm) image, or default.")
    //debug.log(file.metadata.artPath);
    albumImage.src = file.metadata.artPath;
  }
  
  handleMarquee();
}

function handleMarquee() {
  var tempWidth = songLabel.offsetWidth;
  debug.log("Song label width: " + tempWidth);
  debug.log(marquee.clientWidth);
  debug.log(document.querySelector("#content").clientWidth);
  if (document.querySelector("#metadata").clientWidth < tempWidth) {
    debug.log("Turning marquee on.");
    song2Label.innerHTML = songLabel.innerHTML;
    marquee.style.animation = "marquee " + (tempWidth / animPPS) + "s linear infinite";
    song2Label.style.display = "inline-block";
    marquee.style.width = tempWidth * 2 + 40 + "px";
    console.log(marquee.offsetWidth + "px");
  } else {
    debug.log("No marquee needed.");
    marquee.style.animation = "none";
    marquee.classList.remove("marquee");
    marquee.style.width = "auto";
    song2Label.style.display = "none";
  }
}

function handleSongEnd(song, file) {
  ff();
}

// close button stuff
function close() {
  remote.getCurrentWindow().close();
}

// controls
// play/pause 
function pp() {
  if (song) {
    if (song.playing()) {
      pausePlayback();
    } else {
      resumePlayback();
    }
  } else {
    debug.log("Play/Pause Error: No song playing.");
  }
}

function pausePlayback() {
  if (song) {
    debug.log("Pausing playback.");
    playing = false;
    song.pause();
    ppButton.src = play_icon;
  } else {
    debug.log("Pause Error: No song to pause.");
  }
}

function resumePlayback() {
  if (song) {
    debug.log("Resuming playback.");
    playing = true;
    song.play();
    vis.resume();
    ppButton.src = pause_icon;
  } else {
    debug.log("Resume Error: No song to resume.");
  }
}

// rewind 
function re() {
  if (song) {
    if (song.seek() >= skipThreshold || songQueue.length <= 1) {
      debug.log("Rewinding to beginning of current song.");
      song.seek(0); // seek to beginning of current song 
    } else if (songQueue.length > 1) {
      debug.log("Rewinding to previous song.");
      songQueue.unshift(songQueue.pop());
      playFromQueue();
    }
  } else {
    debug.log("Rewind Error: No song to rewind.")
  }
}

// fast-forward
function ff() {
  if (song && (!removeAfterPlayed && songQueue.length > 0) || (removeAfterPlayed && songQueue.length > 1)) {
    pausePlayback();
    vis.stop();
    //song.unload();
    //Howler.unload();
    song = null;
    if (removeAfterPlayed) {
      songQueue.shift();
    } else {
      songQueue.push(songQueue.shift());
    }
    playFromQueue();
  } else {
    debug.log("Fast-Forward Error")
  }
}
