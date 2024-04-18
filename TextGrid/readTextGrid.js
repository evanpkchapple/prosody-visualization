document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        intervals = processTextGrid(content);
        createSegments(intervals);
    };
    reader.readAsText(file);
});

document.getElementById('file-input-trigger').addEventListener('click', function() {
    document.getElementById('file-input').click();
});

function processTextGrid(textGridContent) {
    const lines = textGridContent.split('\n');
    const intervals = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('item [2]:')) {
            break;
        }
        if (line.startsWith('intervals [')) {
            const timeStartLine = lines[++i].trim();
            const timeEndLine = lines[++i].trim();
            const textLine = lines[++i].trim();

            const timeStart = parseFloat(timeStartLine.split('=')[1]);
            const timeEnd = parseFloat(timeEndLine.split('=')[1]);
            // Removing double quotes from the text string
            const text = textLine.split('=')[1].trim().replace(/^"|"$/g, '');

            intervals.push({ timeStart, timeEnd, text });
        }
    }

    console.log(intervals);
    return intervals;
}

function createSegments(intervals) {
    const container = document.getElementById('intervalsContainer');
    container.innerHTML = ''; // Clear existing content

    const totalDuration = intervals.reduce((acc, cur) => acc + (cur.timeEnd - cur.timeStart), 0);

    intervals.forEach(interval => {
        const segmentDuration = interval.timeEnd - interval.timeStart;
        const widthPercentage = (segmentDuration / totalDuration) * 100;

        const segmentDiv = document.createElement('div');
        segmentDiv.style.width = `${widthPercentage}%`;
        segmentDiv.style.minHeight = '50px'; // Ensure visibility for text centering
        segmentDiv.style.backgroundColor = getRandomColor();
        segmentDiv.style.display = 'flex';
        segmentDiv.style.alignItems = 'center';
        segmentDiv.style.justifyContent = 'center';
        segmentDiv.style.color = 'white';
        segmentDiv.style.textOverflow = 'ellipsis';
        segmentDiv.style.whiteSpace = 'nowrap';
        segmentDiv.style.overflow = 'hidden';
        segmentDiv.innerText = interval.text;

        container.appendChild(segmentDiv);
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