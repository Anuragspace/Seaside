const recordButton: HTMLButtonElement | null = document.querySelector('#video-rec');
const videoRecord: HTMLVideoElement | null = document.querySelector('.video-record');
const timerDisplay: HTMLElement | null = document.getElementById('video-timer');

let videoRecorder: MediaRecorder | null = null;
let videoStream: MediaStream | null = null;
let chunks: BlobPart[] = [];
let timeInterval: ReturnType<typeof setInterval> | null = null;
let secondsElapsed = 0;
let minutesElapsed = 0;
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

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
            startSessionMonitoring();
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
            stopSessionMonitoring();
            if (recordButton) recordButton.textContent = 'Start Recording';
        } catch (err) {
            console.error('Error stopping video recording:', err);
        }
    }
}

// Session monitoring for authentication during recording
function startSessionMonitoring(): void {
    // Check session every 5 minutes during recording
    sessionCheckInterval = setInterval(() => {
        checkSessionDuringRecording();
    }, 5 * 60 * 1000); // 5 minutes
}

function stopSessionMonitoring(): void {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
}

async function checkSessionDuringRecording(): Promise<void> {
    try {
        // Import TokenManager dynamically to avoid circular dependencies
        const { TokenManager } = await import('../utils/tokenManager');

        // If token is expired and we're recording, stop recording
        if (!TokenManager.hasValidTokens() && videoRecorder && videoRecorder.state === 'recording') {
            console.warn('Session expired during video recording, stopping recording');
            stopVideoRecording();

            // Dispatch custom event to notify UI components
            window.dispatchEvent(new CustomEvent('recording-session-expired', {
                detail: { type: 'video' }
            }));
        }
    } catch (error) {
        console.error('Error checking session during video recording:', error);
    }
}

// Enhanced recording functions with authentication awareness
export function startVideoRecordingWithAuth(onAuthRequired?: () => void): boolean {
    // Check if we can record
    if (!videoRecorder || videoRecorder.state !== 'inactive') {
        return false;
    }

    // Dynamic import to check authentication
    import('../utils/tokenManager').then(({ TokenManager }) => {
        if (!TokenManager.hasValidTokens()) {
            if (onAuthRequired) {
                onAuthRequired();
            } else {
                // Dispatch event for auth required
                window.dispatchEvent(new CustomEvent('recording-auth-required', {
                    detail: { type: 'video' }
                }));
            }
            return false;
        }

        // Start recording if authenticated
        startVideoRecording();
        return true;
    }).catch(error => {
        console.error('Error checking authentication for video recording:', error);
        return false;
    });

    return true;
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
    stopSessionMonitoring();
    videoRecorder = null;
    chunks = [];
    isRecording = false;
}