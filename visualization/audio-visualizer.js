document.getElementById('file-input-trigger').addEventListener('click', function() {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const jsonContent = JSON.parse(event.target.result);
        populateFileSelect(jsonContent.audios);
    };
    reader.readAsText(file);
});

function populateFileSelect(audios) {
    const select = document.getElementById('file-select');
    select.innerHTML = ''; // Clear existing options if any

    const defaultOption = new Option('Select an item...', '', true, true);
    defaultOption.disabled = true; // Make it disabled so it cannot be reselected after making a choice
    select.appendChild(defaultOption);
    
    audios.forEach((audio, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = audio.filename;
        select.appendChild(option);
    });
    // Add event listener to handle selection changes
    select.addEventListener('change', function() {
        displayTextGrid(audios[this.value]);
    });
}

function displayTextGrid(audio) {
    const intervals = audio.labels.map((label, index) => ({
        text: label,
        duration: audio.label_int[index] || 0 // Ensure a default if undefined
    }));
    // Pass pitches and pitchIntensities to createSegments
    createSegments(intervals, audio.pitches, audio.pitch_int);
}


function createSegments(intervals, pitches, pitchIntervals) {
    const container = document.getElementById('intervalsContainer');
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const displayWidth = container.clientWidth;
    const displayHeight = 200; // Increased height to accommodate pitch plots

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    container.appendChild(canvas);

    let xOffset = 0;
    const totalDuration = intervals.reduce((acc, cur) => acc + cur.duration, 0);
    const scale = canvas.width / totalDuration;

    // Draw segments
    intervals.forEach(interval => {
        const segmentWidth = interval.duration * scale;
        ctx.fillStyle = getRandomColor();
        ctx.fillRect(xOffset, 0, segmentWidth, displayHeight - 50); // Reserve space for plotting pitches

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '16px Arial';
        ctx.fillText(interval.text, xOffset + segmentWidth / 2, (displayHeight - 50) / 2, segmentWidth);

        xOffset += segmentWidth;
    });

    // Plot each pitch with its corresponding interval
    const maxPitch = Math.max(...pitches);
    const minPitch = Math.min(...pitches);
    const pitchRange = maxPitch - minPitch;

    pitches.forEach((pitch, index) => {
        if (pitchIntervals[index] !== undefined) {
            const xPosition = pitchIntervals[index] * scale; // Calculate position based on pitch interval
            const yPosition = displayHeight - 50 - (((pitch - minPitch) / pitchRange) * (displayHeight - 50));

            ctx.beginPath();
            ctx.arc(xPosition, yPosition, 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
        }
    });
}


function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}