const crepe = (function() {
    // Global vars
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const minPitch = 50;
    const maxPitch = 300;
    const canvasHeight = canvas.height;
    const canvasWidth = canvas.width;
    var duration = 5000;
    const callFrequency = 12; // A new frame is called callFrequency times every second
    const columnWidth = calculateColumnWidth();
    var column = 0;
    const minConfidence = 0.3;
    var tfInitialized = false;

    function error(message) {
        document.getElementById('status').innerHTML = 'Error: ' + message;
        return message;
    }

    function status(message) {
        document.getElementById('status').innerHTML = message;
    }

    function stopDetection() {
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        running = false;
        status('<a id="restartButton" href="javascript:crepe.resume();">* Click here to restart listening *</a>');
    }

    function getPixels(pitch) {
        var pixel = Math.floor(((pitch - minPitch) / maxPitch) * canvasHeight);
        return pixel;
    }

    function calculateColumnWidth() {
        var columnWidth = canvasWidth / ((duration / 1000) * callFrequency);
        return columnWidth;
    }

    const updateFrame = (function() {
        const buffer = ctx.createImageData(canvasWidth, canvasHeight);

        return function(predicted_hz) {
            for (var j = 0; j < columnWidth; j++) {
                for (var i = 0; i <= canvasHeight; i++) {
                    let value = getPixels(predicted_hz);

                    const index = ((canvasHeight - 1 - (i)) * canvasWidth + column) * 4;

                    if (i === value || i === value - 1 || i === value + 1) {
                        buffer.data[index] = 0;
                        buffer.data[index + 1] = 0;
                        buffer.data[index + 2] = 255;
                        buffer.data[index + 3] = 255;
                    } else {
                        buffer.data[index] = 255;
                        buffer.data[index + 1] = 255;
                        buffer.data[index + 2] = 255;
                        buffer.data[index + 3] = 255;
                    }
                }
                column++;
                if (column >= canvasWidth) {
                    stopDetection();
                }
            }
            ctx.putImageData(buffer, 0, 0);
        };
    })();

    var audioContext;
    var running = false;
    var stream;
    var scriptNode;

    function initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
            console.log("audioContext", audioContext);
        } catch (e) {
            error('Could not instantiate AudioContext: ' + e.message);
            throw e;
        }
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

    const cent_mapping = tf.add(tf.linspace(0, 7180, 360), tf.tensor(1997.3794084376191));

    function process_microphone_buffer(event) {
        if (!running) return;
        resample(event.inputBuffer, function(resampled) {
            tf.tidy(() => {
                const frame = tf.tensor(resampled.slice(0, 1024));
                const zeromean = tf.sub(frame, tf.mean(frame));
                const framestd = tf.tensor(tf.norm(zeromean).dataSync() / Math.sqrt(1024));
                const normalized = tf.div(zeromean, framestd);
                const input = normalized.reshape([1, 1024]);
                const activation = model.predict([input]).reshape([360]);

                const confidence = activation.max().dataSync()[0];
                const center = activation.argMax().dataSync()[0];

                const start = Math.max(0, center - 4);
                const end = Math.min(360, center + 5);
                const weights = activation.slice([start], [end - start]);
                const cents = cent_mapping.slice([start], [end - start]);

                const products = tf.mul(weights, cents);
                const productSum = products.dataSync().reduce((a, b) => a + b, 0);
                const weightSum = weights.dataSync().reduce((a, b) => a + b, 0);
                const predicted_cent = productSum / weightSum;
                var predicted_hz = 10 * Math.pow(2, predicted_cent / 1200.0);

                predicted_hz = confidence > minConfidence ? predicted_hz : 0;

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
            status('Initializing audio...');
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(newStream) {
                stream = newStream;
                console.log("audioContext", audioContext);
                if (!audioContext) {
                    initAudioContext();
                }
                status('Setting up AudioContext ...');
                const mic = audioContext.createMediaStreamSource(stream);

                const minBufferSize = audioContext.sampleRate / 16000 * 1024;
                for (var bufferSize = 4; bufferSize < minBufferSize; bufferSize *= 2);
                scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
                scriptNode.onaudioprocess = process_microphone_buffer;

                const gain = audioContext.createGain();
                gain.gain.setValueAtTime(0, audioContext.currentTime);

                mic.connect(scriptNode);
                scriptNode.connect(gain);
                gain.connect(audioContext.destination);

                if (audioContext.state === 'running') {
                    status('Running ...');
                    running = true;
                } else {
                    status('<a id="restartButton" href="javascript:crepe.resume();">* Click here to start listening *</a>');
                }
            }, function(message) {
                error('Could not access microphone - ' + message);
            });
        } else error('Could not access microphone - getUserMedia not available');
    }

    async function initTF() {
        if (!tfInitialized) {
            try {
                status('Loading Keras model...');
                window.model = await tf.loadModel('../model/model.json');
                status('Model loading complete');
                tfInitialized = true;
            } catch (e) {
                throw error(e);
            }
        }
        initAudio();
    }

    return {
        'audioContext': audioContext,
        'resume': function() {
            column = 0;
            if (!audioContext) {
                initAudioContext();
            }
            audioContext.resume().then(() => {
                status('Running ...');
                initTF();
                running = true;
            }).catch(e => {
                error('Error resuming audio context: ' + e.message);
            });
        }
    }
})();
