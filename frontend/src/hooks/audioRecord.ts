const playback: HTMLAudioElement | null = document.querySelector('.playback');

let can_record: boolean = false;
let recorder: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

// Call this once to set up permissions and recorder
export function setupAudio(): void {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then(SetupStream)
            .catch((err: any) => {
                console.error('Microphone access error:', err);
            });
    }
}

// Internal setup after mic access is granted
function SetupStream(stream: MediaStream): void {
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (e: BlobEvent): void => {
        chunks.push(e.data);
    };

    recorder.onstop = (): void => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        chunks = [];

        const audioURL = window.URL.createObjectURL(blob);

        if (playback) {
            playback.src = audioURL;
        }

        // Auto download after stop
        const a = document.createElement('a');
        a.href = audioURL;
        a.download = 'recording.wav';
        a.click();
    };

    can_record = true;
}

// Call this to start recording
export function startRecording(): void {
    if (can_record && recorder && recorder.state === 'inactive') {
        recorder.start();
        startSessionMonitoring();
    }
}

// Call this to stop recording
export function stopRecording(): void {
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
    }
    stopSessionMonitoring();
}

// Session monitoring for authentication during recording
function startSessionMonitoring(): void {
    // Check session every 30 seconds during recording
    sessionCheckInterval = setInterval(() => {
        checkSessionDuringRecording();
    }, 30000);
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
        if (!TokenManager.hasValidTokens() && recorder && recorder.state === 'recording') {
            console.warn('Session expired during recording, stopping recording');
            stopRecording();
            
            // Dispatch custom event to notify UI components
            window.dispatchEvent(new CustomEvent('recording-session-expired', {
                detail: { type: 'audio' }
            }));
        }
    } catch (error) {
        console.error('Error checking session during recording:', error);
    }
}

// Enhanced recording functions with authentication awareness
export function startRecordingWithAuth(onAuthRequired?: () => void): boolean {
    // Check if we can record
    if (!can_record || !recorder || recorder.state !== 'inactive') {
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
                    detail: { type: 'audio' }
                }));
            }
            return false;
        }
        
        // Start recording if authenticated
        startRecording();
        return true;
    }).catch(error => {
        console.error('Error checking authentication for recording:', error);
        return false;
    });

    return true;
}

// Cleanup function for session monitoring
export function cleanupAudioRecording(): void {
    stopSessionMonitoring();
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
    }
}