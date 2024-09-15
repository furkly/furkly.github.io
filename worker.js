// Worker thread script

importScripts('ffmpeg/ffmpeg.min.js');

const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'ffmpeg/ffmpeg-core/ffmpeg-core.js',
});
let isCanceled = false;
let ffmpegLoaded = false;

self.onmessage = async (event) => {
    const message = event.data;

    if (message.type === 'start') {
        const videoFile = message.file;
        ffmpegLoaded = message.ffmpegLoaded;
        const cpuCores = message.deviceCapabilities.cpuCores;

        try {
            // Load FFmpeg if not already loaded
            if (!ffmpegLoaded) {
                await ffmpeg.load();
                self.postMessage({ type: 'loaded' });
                ffmpegLoaded = true;
            }

            if (isCanceled) return;

            // Write the file to FFmpeg's virtual file system
            ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

            if (isCanceled) return;

            // Adjust the number of threads based on CPU cores
            const threadCount = Math.min(cpuCores, 8); // Limit to a max of 8 threads

            // Run the compression command with adjusted parameters
            ffmpeg.setProgress(({ ratio }) => {
                self.postMessage({ type: 'progress', progress: ratio });
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

            // Send the compressed video back to the main thread
            self.postMessage({ type: 'completed', blob: blob });
        } catch (error) {
            self.postMessage({ type: 'error', error: getErrorMessage(error) });
        } finally {
            // Free up memory
            ffmpeg.exit();
            ffmpegLoaded = false;
        }
    } else if (message.type === 'cancel') {
        isCanceled = true;
    } else if (message.type === 'performanceTest') {
        // ... existing performance test code ...
    }
};

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
