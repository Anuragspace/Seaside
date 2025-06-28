const recordButton: HTMLButtonElement | null = document.querySelector('#video-rec');
const videoRecord: HTMLVideoElement | null = document.querySelector('.video-record');
const timerDisplay: HTMLElement | null = document.getElementById('video-timer');

let videoRecorder: MediaRecorder | null = null;
let videoStream: MediaStream | null = null;
let chunks: BlobPart[] = [];
let timeInterval: ReturnType<typeof setInterval> | null = null;
let secondsElapsed = 0;
let minutesElapsed = 0;

let isRecording = false;

// Setup camera and microphone access
export async function setupVideo() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: true // Enable audio for video recording
        });

        if (videoRecord) {
            videoRecord.srcObject = videoStream;
            videoRecord.muted = true;
            videoRecord.play();
        }

        // Use better codec if available
        const options: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            options.mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options.mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            options.mimeType = 'video/mp4';
        }

        videoRecorder = new MediaRecorder(videoStream, options);

        videoRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        videoRecorder.onstop = () => {
            const mimeType = videoRecorder?.mimeType || 'video/webm';
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `recorded_video_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            a.click();

            // Clean up
            URL.revokeObjectURL(url);
            chunks = [];
        };

        videoRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
        };

    } catch (err) {
        console.error("Error accessing the camera/microphone:", err);
        throw err;
    }
}

export function startVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'inactive') {
        try {
            videoRecorder.start(1000); // Collect data every second
            isRecording = true;
            secondsElapsed = 0;
            minutesElapsed = 0;
            updateTimerDisplay();
            timeInterval = setInterval(() => {
                secondsElapsed++;
                if (secondsElapsed === 60) {
                    minutesElapsed++;
                    secondsElapsed = 0;
                }
                updateTimerDisplay();
            }, 1000);
            if (recordButton) recordButton.textContent = 'Stop Recording';
        } catch (err) {
            console.error('Error starting video recording:', err);
        }
    }
}

export function stopVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'recording') {
        try {
            videoRecorder.stop();
            isRecording = false;
            if (timeInterval) {
                clearInterval(timeInterval);
                timeInterval = null;
            }
            if (recordButton) recordButton.textContent = 'Start Recording';
        } catch (err) {
            console.error('Error stopping video recording:', err);
        }
    }
}

function updateTimerDisplay() {
    const hours = String(Math.floor(minutesElapsed / 60)).padStart(2, '0');
    const minutes = String(minutesElapsed % 60).padStart(2, '0');
    const seconds = String(secondsElapsed).padStart(2, '0');
    if (timerDisplay) timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

// Cleanup function
export function cleanupVideoRecording() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
    }
    videoRecorder = null;
    chunks = [];
    isRecording = false;
}