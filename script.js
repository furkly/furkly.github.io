// Main thread script

const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.1/dist/ffmpeg-core.js',
});

let videoFile = null;
let ffmpegLoaded = false;
let isCanceled = false;

// Readiness check
document.addEventListener('DOMContentLoaded', () => {
    readinessCheck();
});

// Handle file selection
document.getElementById('videoInput').addEventListener('change', (event) => {
    videoFile = event.target.files[0];
    if (videoFile) {
        estimateCompressionSize(videoFile);
    }
});

// Handle compression
document.getElementById('compressBtn').addEventListener('click', async () => {
    if (!videoFile) {
        alert('Please select a video file first.');
        return;
    }

    // Disable buttons and show cancel button
    document.getElementById('compressBtn').disabled = true;
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('performanceTestBtn').disabled = true;

    // Update status message
    updateStatus('Initializing compression...');

    isCanceled = false;

    // Start progress simulation
    simulateProgress();

    try {
        // Load FFmpeg if not already loaded
        if (!ffmpegLoaded) {
            await ffmpeg.load();
            ffmpegLoaded = true;
            updateStatus('FFmpeg loaded. Starting compression...');
        }

        if (isCanceled) return;

        // Write the file to FFmpeg's virtual file system
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

        if (isCanceled) return;

        // Adjust the number of threads based on CPU cores
        const cpuCores = navigator.hardwareConcurrency || 4;
        const threadCount = Math.min(cpuCores, 8); // Limit to a max of 8 threads

        // Run the compression command with adjusted parameters
        ffmpeg.setProgress(({ ratio }) => {
            updateActualProgress(ratio);
        });

        await ffmpeg.run(
            '-i',
            'input.mp4',
            '-c:v',
            'libx265',
            '-x265-params',
            'lossless=1',
            '-threads',
            threadCount.toString(),
            'output.mp4'
        );

        if (isCanceled) return;

        // Read the output file
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        // Clean up virtual file system
        ffmpeg.FS('unlink', 'input.mp4');
        ffmpeg.FS('unlink', 'output.mp4');

        // Stop progress simulation
        progress = 100;
        updateProgress();

        // Create a download link
        const compressedVideo = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = compressedVideo;
        link.download = 'compressed_video.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset UI
        resetUI();
        updateStatus('Compression complete.');
    } catch (error) {
        resetUI();
        updateStatus(`Error: ${getErrorMessage(error)}`);
    } finally {
        // Free up memory
        ffmpeg.exit();
        ffmpegLoaded = false;
    }
});

// Handle cancel
document.getElementById('cancelBtn').addEventListener('click', () => {
    isCanceled = true;
    resetUI();
    updateStatus('Compression canceled.');
});

// Readiness check function
function readinessCheck() {
    const readinessMessage = document.getElementById('readinessMessage');

    // Check for WebAssembly support
    if (typeof WebAssembly === 'object') {
        readinessMessage.innerText = 'Your browser supports WebAssembly.';
    } else {
        readinessMessage.innerText = 'WebAssembly is not supported in your browser. The tool may not work.';
        disableTool();
        return;
    }

    // Check for WebGL support (GPU acceleration)
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
        readinessMessage.innerText += '\nYour browser supports WebGL.';
    } else {
        readinessMessage.innerText += '\nWebGL is not supported in your browser. Performance may be degraded.';
    }

    // Show readiness message with animation
    readinessMessage.classList.add('show');
    setTimeout(() => {
        readinessMessage.classList.remove('show');
    }, 5000);
}

// Disable tool if not supported
function disableTool() {
    document.getElementById('videoInput').disabled = true;
    document.getElementById('compressBtn').disabled = true;
}

// Estimate compression size
function estimateCompressionSize(file) {
    // Placeholder estimation logic
    const estimatedSize = (file.size * 0.5) / (1024 * 1024);
    document.getElementById('estimation').innerText = `Estimated Compression Size: ${estimatedSize.toFixed(2)} MB`;
}

// Update status message
function updateStatus(message) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.innerText = message;
    statusElement.classList.add('show');
    setTimeout(() => {
        statusElement.classList.remove('show');
    }, 5000); // Message will fade out after 5 seconds
}

// Reset UI elements
function resetUI() {
    document.getElementById('compressBtn').disabled = false;
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('performanceTestBtn').disabled = false;
    progress = 0;
    updateProgress();
}

// Progress bar simulation
let progress = 0;
let progressInterval = null;

function simulateProgress() {
    progress = 0;
    progressInterval = setInterval(() => {
        if (progress < 99) {
            progress += 0.1; // Small increment to keep the progress bar moving
            updateProgress();
        }
    }, 100);
}

function updateProgress() {
    const progressBar = document.getElementById('progress');
    progressBar.style.width = Math.min(progress, 100) + '%';
    if (progress >= 100 && progressInterval) {
        clearInterval(progressInterval);
    }
}

function updateActualProgress(actualProgress) {
    progress = actualProgress * 100;
    updateProgress();
}

// Enhanced error messages
function getErrorMessage(error) {
    if (error.message.includes('Out of memory')) {
        return 'The browser ran out of memory during compression. Try using a smaller file.';
    } else if (error.message.includes('Invalid data')) {
        return 'The selected file is not a valid video or is corrupted.';
    } else {
        return error.message;
    }
}
