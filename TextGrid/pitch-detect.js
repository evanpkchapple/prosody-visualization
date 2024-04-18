window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isListening = false;
var mediaStreamSource = null;
var analyser = null;
var pitchData = [];
var startButton = document.getElementById('startButton');
var pitchGraphCanvas = document.getElementById('pitchGraph');
var pitchGraphCtx = pitchGraphCanvas.getContext('2d');

function startListening() {
    audioContext = new AudioContext();

    navigator.mediaDevices.getUserMedia({audio: true})
    .then(stream => {
        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        mediaStreamSource.connect(analyser);
        updatePitch();
    }).catch(err => {
        alert('Error accessing audio input.');
        console.error(err);
    });
}

function stopListening() {
    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
        mediaStreamSource = null;
    }
}

function toggleListening() {
    if (isListening) {
        stopListening();
        startButton.innerText = 'Start Listening';
        isListening = false
    } else {
        startListening();
        startButton.innerText = 'Stop Listening';
        isListening = true
    }
}

startButton.addEventListener('click', toggleListening);

function autoCorrelate(buf, sampleRate) {
    var SIZE = buf.length;
	var rms = 0;

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var r1=0, r2=SIZE-1, thres=0.2;
	for (var i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (var i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	var c = new Array(SIZE).fill(0);
	for (var i=0; i<SIZE; i++)
		for (var j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	var d=0; while (c[d]>c[d+1]) d++;
	var maxval=-1, maxpos=-1;
	for (var i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	var T0 = maxpos;

	var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}

function updatePitch() {
    var buflen = 2048;
    var buf = new Float32Array(buflen);
    analyser.getFloatTimeDomainData(buf);
    var ac = autoCorrelate(buf, audioContext.sampleRate);

    if (ac == -1) {
        console.log("pushing latest")
        try {
            let lastElement = pitchData[pitchData.length - 1];
            pitchData.push(lastElement.time, lastElement.pitch);
        } catch (error) {
            pitchData.push(0, 0);
        }
    }
    pitchData.push({time: audioContext.currentTime, pitch: ac});
    drawPitchGraph();

    if (isListening) {
        requestAnimationFrame(updatePitch);
    }
}

function drawPitchGraph() {
    pitchGraphCtx.clearRect(0, 0, pitchGraphCanvas.width, pitchGraphCanvas.height);

    pitchGraphCtx.beginPath();
    pitchGraphCtx.moveTo(0, pitchGraphCanvas.height);

    pitchData.forEach(data => {
        var x = (data.time - (audioContext.currentTime - 10)) / 10 * pitchGraphCanvas.width;
        var y = (1 - data.pitch / 2000) * pitchGraphCanvas.height; // Adjust as needed
        pitchGraphCtx.lineTo(x, y);
    });

    pitchGraphCtx.stroke();
}
