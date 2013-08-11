// Realtime spectrogram in logscale
// build largely from http://www.smartjava.org/content/exploring-html5-web-audio-visualizing-sound
// refactored to use requestAnimationFrame
// reuse and momoization of CPU heavy objects/lookups
// resolution of FFT  window increased to default of native default of 2048
// many other small bug fixes
(function () {

  // create the audio context (chrome only for now)
  var context = new webkitAudioContext();
  var audioBuffer;
  var sourceNode;
  var analyser;
  var javascriptNode;
  var canvas, ctx;

  // used for color distribution
  var hot = chroma
    .scale(['#000000', '#0A64A4', '#F80012', '#FFFF00'])
    .domain([0, 255]);

  // create a temp canvas we use for copying
  var tempCanvas = document.createElement("canvas");
  var tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width=1000;
  tempCanvas.height=1024;

  // document ready - the only need for jquery
  $(function () {

    // get reference to the canvas
    canvas = document.getElementById("canvas");

    // get the context from the canvas to draw on
    ctx = canvas.getContext("2d");

    // connect all nodes
    setupAudioNodes();
    // loadSound("Schoenberg- Pierrot Lunaire - 1ste Teil.mp3");
    // loadSound("Bach- Chromatic Fantasy and Fugue in D Minor BWV 903.mp3");

    // start drawing
    window.requestAnimationFrame(drawDaStuff);
  });

  function getUserAudio () {

    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia  = navigator.getUserMedia ||
      navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (navigator.getUserMedia) {

      navigator.getUserMedia({ 'audio': true }, function (stream) {

        // connect micrphone to analyser and output (loopback, PUT ON HEADPHONES!)
        var microphone = context.createMediaStreamSource(stream);
        microphone.connect(analyser);
        microphone.connect(context.destination);
      }, function (e) {

        console.log('fail', e);
      });
    }
    else {

      console.log('no audio granted, or received');
    }
  }

  function setupAudioNodes() {

    // setup a analyzer
    analyser = context.createAnalyser();
    analyser.smoothingTimeConstant = 0;
    analyser.fftSize = 2048;

    // create a buffer source node for playing a sound
    sourceNode = context.createBufferSource();
    sourceNode.connect(analyser);
    sourceNode.connect(context.destination);

    // get microphone input
    getUserAudio();
  }

  // load the specified sound
  function loadSound (url) {

    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    // When loaded decode the data
    request.onload = function () {

      // decode the data
      context.decodeAudioData(request.response, function (buffer) {
        // when the audio is decoded play the sound
        playSound(buffer);
      }, onError);
    };
    request.send();
  }

  function playSound (buffer) {
    sourceNode.buffer = buffer;
    sourceNode.noteOn(0);
    sourceNode.loop = true;
  }

  // log if an error occurs
  function onError (e) {
    console.log(e);
  }

  // when the javascript node is called
  // we use information from the analyzer node
  // to draw the volume
  var freqArray, timeArray;
  function drawDaStuff () {

    if (!freqArray || !timeArray) {
      freqArray =  new Uint8Array(analyser.frequencyBinCount);
      timeArray = new Uint8Array(analyser.frequencyBinCount);
    }

    // get the average for the first channel
    analyser.getByteFrequencyData(freqArray);
    analyser.getByteTimeDomainData(timeArray);

    // draw the spectrogram
    drawSpectrogram(freqArray);

    // draw next frame
    window.requestAnimationFrame(drawDaStuff);
  }

  // do the actual drawing work
  // reussed array for log scaled values
  var values = new Array(1024);
  function drawSpectrogram (array) {

    var value, lastValue, x;
    // reuse values array, prevent memory thrashing
    values = emptyArray(values);

    // copy the current canvas onto the temp canvas
    tempCtx.drawImage(canvas, 0, 0, 1000, 1024);

    // iterate over the elements from the array
    for (var i = 0, len = array.length; i < len; i++) {
      // draw each pixel with the specific color
      value = array[i];
      // convert linear frequencies to a log scale
      x = Math.floor(log10(i) / log10(1024) * 1024);
      values[x] = value;
    }

    // draw the line at the right side of the canvas
    for (var i2 = 0, len2 = array.length; i2 < len2; i2++) {
      value = values[i2];
      if (value !== undefined) {
        // log scale produces holes
        // fill holes with last value (alias)
        lastValue = value;
      }
      else {
        value = lastValue;
      }
      ctx.fillStyle = colorFromValue(value);
      ctx.fillRect(1000 - 1, 1024 - i2, 1, 1);
    }

    // set translate on the canvas
    ctx.translate(-1, 0);
    // draw the copied image
    ctx.drawImage(tempCanvas, 0, 0, 1000, 1024, 0, 0, 1000, 1024);

    // reset the transformation matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // memoize color lookups
  var colorArray = new Array(255);
  function colorFromValue (value) {

    if (!colorArray[value]) {
      colorArray[value] = hot(value).hex();
    }
    return colorArray[value];
  }

  function log10 (val) {
    return Math.log(val) / Math.LN10;
  }

  function emptyArray (arr) {

    for (var i = 0, len = arr.length; i < len; i++) {
      arr[i] = undefined;
    }
    return arr;
  }
})();