const recordButton: HTMLButtonElement | null = document.querySelector('#video-rec');
const vudeoRecord: HTMLVideoElement | null = document.querySelector('.video-record');
const timerDisplay : HTMLElement | null = document.getElementById('video-timer');

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
            audio: false
        });

        if (vudeoRecord) {
            vudeoRecord.srcObject = videoStream;
            vudeoRecord.muted = true;
            vudeoRecord.play();
        }

        videoRecorder = new MediaRecorder(videoStream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        videoRecorder.ondataavailable = (event: BlobEvent) => {
            chunks.push(event.data);
        };

        videoRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'recorded_video_best_quality.webm';
            a.click();

            chunks = [];
        };

        if(vudeoRecord){
            const canvas = document.createElement('canvas');
            canvas.width = vudeoRecord.videoWidth;
            canvas.height = vudeoRecord.videoHeight;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(vudeoRecord, 0, 0, canvas.width, canvas.height);
                const thumbnailURL = canvas.toDataURL('image/png');
        
                const thumbLink = document.createElement('a');
                thumbLink.href = thumbnailURL;
                thumbLink.download = 'thumbnail.png';
                thumbLink.click();
            }
        }

    } catch (err) {
        console.error("error accessing the camera");
    }
}

export function startVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'inactive') {
        videoRecorder.start();
        isRecording = true;
        secondsElapsed = 0;
        minutesElapsed = 0;
        updateTimerDisplay();
        timeInterval = setInterval(() => {
            secondsElapsed++;
            if(secondsElapsed === 60){
                minutesElapsed++;
                secondsElapsed = 0;
            }
            updateTimerDisplay();
        }, 1000);
        if (recordButton) recordButton.textContent = 'Stop Recording';
    }
}

export function stopVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'recording') {
        videoRecorder.stop();
        isRecording = false;
        if(timeInterval){
            clearInterval(timeInterval);
            timeInterval = null;
        }
        if (recordButton) recordButton.textContent = 'Start Recording';
    }
}

function updateTimerDisplay() {
    const hours = String(Math.floor(minutesElapsed / 60)).padStart(2, '0');
    const minutes = String(minutesElapsed % 60).padStart(2, '0');
    const seconds = String(secondsElapsed).padStart(2, '0');
    if (timerDisplay) timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}