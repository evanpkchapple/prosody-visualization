crepe = (function() {
  //Global vars
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  var minPitch = 50;
  var maxPitch = 500;
  var canvasHeight = canvas.height;
  var canvasWidth = canvas.width;
  const stepSize = getStepSize(minPitch, maxPitch, canvasHeight);
    
  function error(message) {
    document.getElementById('status').innerHTML = 'Error: ' + message;
    return message;
  }

  function status(message) {
    document.getElementById('status').innerHTML = message;
  }

  function getStepSize(minPitch, maxPitch, numBins) {
    const totalRange = maxPitch - minPitch;
    const minIndex = 0;
    const maxIndex = Math.ceil((maxPitch - 50) / totalRange * numBins);
    return { minIndex, maxIndex };
  }

  const updateFrame = (function() {
    const buffer = ctx.createImageData(canvas.width, canvas.height);
    var column = 0;

    return function(predicted_hz) {
      for (var i = minIndex; i <= maxIndex; i++) {
        let value = Math.floor(predicted_hz);
        if (isNaN(value) || value < 0) value = 0;
        if (value > 255) value = 255;
        console.log(value);
        
        const index = ((canvasHeight - 1 - (i - minIndex)) * canvasWidth + column) * 4;
        
        if (index >= 0 && index < buffer.data.length) {
          buffer.data.set(newColorMap[value], index);
        } else {
          console.error(`Index out of bounds: ${index}, buffer length: ${buffer.data.length}`);
        }
      }

      column = (column + 1) % canvas.width;
      ctx.putImageData(buffer, canvas.width - column, 0);
      ctx.putImageData(buffer, -column, 0);
    };
  })();
    
  // a function that accepts the activation vector for each frame
  const updateActivation = (function() {
    // Define the new color map
    const newColorMap = [];
    for (let i = 0; i <= 127; i++) {
      newColorMap.push([255, 255, 255, 255]); // white for values 0-5
    }
    for (let i = 128; i < 256; i++) {
      newColorMap.push([0, 0, 139, 255]); // dark blue for values > 5
    }

    // Convert each color to Uint8ClampedArray
    for (var i = 0; i < newColorMap.length; i++) {
      array = new Uint8ClampedArray(4);
      array.set(newColorMap[i]);
      newColorMap[i] = array;
    }

    const canvas = document.getElementById('activation');
    const ctx = canvas.getContext('2d');
    const buffer = ctx.createImageData(canvas.width, canvas.height);
    var column = 0;

    const { minIndex, maxIndex } = calculatePitchIndices(50, 300, 360);

    return function(activation) {
      // render
      for (var i = minIndex; i <= maxIndex; i++) {
        let value = Math.floor(activation[i] * 256.0);
        if (isNaN(value) || value < 0) value = 0;
        if (value > 255) value = 255;
        console.log(value);
        
        const index = ((canvas.height - 1 - (i - minIndex)) * canvas.width + column) * 4;
        
        if (index >= 0 && index < buffer.data.length) {
          buffer.data.set(newColorMap[value], index);
        } else {
          console.error(`Index out of bounds: ${index}, buffer length: ${buffer.data.length}`);
        }
      }

      column = (column + 1) % canvas.width;
      ctx.putImageData(buffer, canvas.width - column, 0);
      ctx.putImageData(buffer, -column, 0);
    };
  })();

  var audioContext;
  var running = false;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    document.getElementById('srate').innerHTML = audioContext.sampleRate;
  } catch (e) {
    error('Could not instantiate AudioContext: ' + e.message);
    throw e;
  }

  function resample(audioBuffer, onComplete) {
    const interpolate = (audioBuffer.sampleRate % 16000 != 0);
    const multiplier = audioBuffer.sampleRate / 16000;
    const original = audioBuffer.getChannelData(0);
    const subsamples = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) {
      if (!interpolate) {
        subsamples[i] = original[i * multiplier];
      } else {
        var left = Math.floor(i * multiplier);
        var right = left + 1;
        var p = i * multiplier - left;
        subsamples[i] = (1 - p) * original[left] + p * original[right];
      }
    }
    onComplete(subsamples);
  }

  const cent_mapping = tf.add(tf.linspace(0, 7180, 360), tf.tensor(1997.3794084376191))

  function process_microphone_buffer(event) {
    resample(event.inputBuffer, function(resampled) {
      tf.tidy(() => {
        running = true;

        const frame = tf.tensor(resampled.slice(0, 1024));
        const zeromean = tf.sub(frame, tf.mean(frame));
        const framestd = tf.tensor(tf.norm(zeromean).dataSync() / Math.sqrt(1024));
        const normalized = tf.div(zeromean, framestd);
        const input = normalized.reshape([1, 1024]);
        const activation = model.predict([input]).reshape([360]);

        const confidence = activation.max().dataSync()[0];
        const center = activation.argMax().dataSync()[0];
        document.getElementById('voicing-confidence').innerHTML = confidence.toFixed(3);

        const start = Math.max(0, center - 4);
        const end = Math.min(360, center + 5);
        const weights = activation.slice([start], [end - start]);
        const cents = cent_mapping.slice([start], [end - start]);

        const products = tf.mul(weights, cents);
        const productSum = products.dataSync().reduce((a, b) => a + b, 0);
        const weightSum = weights.dataSync().reduce((a, b) => a + b, 0);
        const predicted_cent = productSum / weightSum;
        const predicted_hz = 10 * Math.pow(2, predicted_cent / 1200.0);

        var result = (confidence > 0.5) ? predicted_hz.toFixed(3) + ' Hz' : '&nbsp;no voice&nbsp&nbsp;';
        var strlen = result.length;
        for (var i = 0; i < 11 - strlen; i++) result = "&nbsp;" + result;
        document.getElementById('estimated-pitch').innerHTML = result;
        console.log(predicted_hz);
        updateFrame(predicted_hz);
      });
    });
  }

  function initAudio() {
    if (!navigator.getUserMedia) {
      if (navigator.mediaDevices) {
        navigator.getUserMedia = navigator.mediaDevices.getUserMedia;
      } else {
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
      }
    }
    if (navigator.getUserMedia) {
      status('Initializing audio...')
      navigator.getUserMedia({ audio: true }, function(stream) {
        status('Setting up AudioContext ...');
        const mic = audioContext.createMediaStreamSource(stream);

        const minBufferSize = audioContext.sampleRate / 16000 * 1024;
        for (var bufferSize = 4; bufferSize < minBufferSize; bufferSize *= 2);
        const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
        scriptNode.onaudioprocess = process_microphone_buffer;

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(0, audioContext.currentTime);

        mic.connect(scriptNode);
        scriptNode.connect(gain);
        gain.connect(audioContext.destination);

        if (audioContext.state === 'running') {
          status('Running ...');
        } else {
          status('<a href="javascript:crepe.resume();" style="color:red;">* Click here to start the demo *</a>')
        }
      }, function(message) {
        error('Could not access microphone - ' + message);
      });
    } else error('Could not access microphone - getUserMedia not available');
  }

  async function initTF() {
    try {
      status('Loading Keras model...');
      window.model = await tf.loadModel('model/model.json');
      status('Model loading complete');
    } catch (e) {
      throw error(e);
    }
    initAudio();
  }

  initTF();

  return {
    'audioContext': audioContext,
    'resume': function() {
      audioContext.resume();
      status('Running ...');
    }
  }
})();
