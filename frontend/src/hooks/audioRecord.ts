const playback: HTMLAudioElement | null = document.querySelector('.playback');

let can_record: boolean = false;
let recorder: MediaRecorder | null = null;
let chunks: BlobPart[] = [];

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
    }
}

// Call this to stop recording
export function stopRecording(): void {
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
    }
}