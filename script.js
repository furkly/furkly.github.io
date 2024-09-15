// Main thread script

let videoFile = null;
let worker = null;
let ffmpegLoaded = false;

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
document.getElementById('compressBtn').addEventListener('click', () => {
    if (!videoFile) {
        alert('Please select a video file first.');
        return;
    }

    // Get device capabilities
    const deviceCapabilities = {
        cpuCores: navigator.hardwareConcurrency || 4, // Default to 4 cores if unavailable
    };

    // Disable buttons and show cancel button
    document.getElementById('compressBtn').disabled = true;
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('performanceTestBtn').disabled = true;

    // Initialize worker
    worker = new Worker('worker.js');

    // Send video file and device capabilities to worker
    worker.postMessage({
        type: 'start',
        file: videoFile,
        ffmpegLoaded: ffmpegLoaded,
        deviceCapabilities: deviceCapabilities,
    });

    // Update status message
    updateStatus('Initializing compression...');

    // Start progress simulation
    simulateProgress();

    // Handle messages from worker
    worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'loaded') {
            ffmpegLoaded = true;
            updateStatus('FFmpeg loaded. Starting compression...');
        } else if (message.type === 'progress') {
            // Update progress based on actual progress
            updateActualProgress(message.progress);
        } else if (message.type === 'completed') {
            // Stop progress simulation
            progress = 100;
            updateProgress();

            // Create a download link
            const compressedVideo = URL.createObjectURL(message.blob);
            const link = document.createElement('a');
            link.href = compressedVideo;
            link.download = 'compressed_video.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Reset UI
            resetUI();
            updateStatus('Compression complete.');
        } else if (message.type === 'error') {
            // Handle error
            resetUI();
            updateStatus(`Error: ${message.error}`);
        }
    };

    // Handle worker errors
    worker.onerror = (error) => {
        resetUI();
        updateStatus(`Error: ${error.message}`);
    };
});

// Handle cancel
document.getElementById('cancelBtn').addEventListener('click', () => {
    if (worker) {
        worker.postMessage({ type: 'cancel' });
        worker.terminate();
        worker = null;
        resetUI();
        updateStatus('Compression canceled.');
    }
});

// Performance test
document.getElementById('performanceTestBtn').addEventListener('click', () => {
    runPerformanceTest();
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
    document.getElementById('performanceTestBtn').disabled = true;
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

// Run performance test
function runPerformanceTest() {
    if (!ffmpegLoaded) {
        updateStatus('Loading FFmpeg for performance test...');
    } else {
        updateStatus('Running performance test...');
    }

    // Disable buttons
    document.getElementById('compressBtn').disabled = true;
    document.getElementById('performanceTestBtn').disabled = true;

    // Get device capabilities
    const deviceCapabilities = {
        cpuCores: navigator.hardwareConcurrency || 4,
    };

    // Initialize worker
    const testWorker = new Worker('worker.js');

    // Send test command to worker
    testWorker.postMessage({
        type: 'performanceTest',
        ffmpegLoaded: ffmpegLoaded,
        deviceCapabilities: deviceCapabilities,
    });

    // Handle messages from worker
    testWorker.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'loaded') {
            ffmpegLoaded = true;
            updateStatus('FFmpeg loaded. Running performance test...');
        } else if (message.type === 'testCompleted') {
            // Provide feedback based on test results
            const time = message.time;
            updateStatus(`Performance test completed. Estimated compression time: ${time.toFixed(2)} seconds.`);
            // Re-enable buttons
            document.getElementById('compressBtn').disabled = false;
            document.getElementById('performanceTestBtn').disabled = false;
            testWorker.terminate();
        } else if (message.type === 'error') {
            updateStatus(`Error: ${message.error}`);
            document.getElementById('compressBtn').disabled = false;
            document.getElementById('performanceTestBtn').disabled = false;
            testWorker.terminate();
        }
    };

    testWorker.onerror = (error) => {
        updateStatus(`Error: ${error.message}`);
        document.getElementById('compressBtn').disabled = false;
        document.getElementById('performanceTestBtn').disabled = false;
        testWorker.terminate();
    };
}
