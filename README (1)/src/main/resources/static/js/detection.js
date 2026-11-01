// ===================================================================
// WEBCAM & DETECTOR VARIABLES
// ===================================================================
let webcamStream = null;
let requestFrameId = null;
let isMonitoring = false;

// Simulated/Demo States: 'ALERT', 'EYES_CLOSED', 'YAWNING', 'HEAD_TILT'
let activeDemoState = 'ALERT'; 

// Real AI FaceMesh variables
let faceMeshModel = null;
let cameraUtilsInstance = null;
let lastFrameTime = 0;

// Alarm sound variables using Web Audio API
let audioCtx = null;
let alarmOscillator = null;
let alarmInterval = null;
let isAlarmSounding = false;

// Geolocation Mock spots around Tamil Nadu
const TAMIL_NADU_SPOTS = [
    { name: "Gobichettipalayam, Erode District, Tamilnadu", lat: 11.4530, lng: 77.4367 },
    { name: "Poonamallee High Rd, Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707 },
    { name: "Avinashi Road, Coimbatore, Tamil Nadu", lat: 11.0168, lng: 76.9558 },
    { name: "NH 38, Madurai Bypass, Tamil Nadu", lat: 9.9252, lng: 78.1198 },
    { name: "NH 45, Trichy Bypass, Tamil Nadu", lat: 10.7905, lng: 78.7047 },
    { name: "NH 48, Vellore, Tamil Nadu", lat: 12.9716, lng: 79.1378 }
];

// Tracking buffers for triggering alerts
let eyeClosedStartTime = null;
let yawnStartTime = null;
let headTiltStartTime = null;
let alertCooldown = false; // Prevent spamming duplicate database logs
let emergencyLocation = null;

// Canvas overlays
const canvas = document.getElementById('mesh-overlay');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam-video');

// Resize detection canvas dynamically
function resizeCanvas() {
    if (canvas && video) {
        canvas.width = video.clientWidth || 640;
        canvas.height = video.clientHeight || 480;
    }
}
window.addEventListener('resize', resizeCanvas);

// ===================================================================
// AUDIO BUZZER CONTROLLER (Web Audio API Synthesizer)
// ===================================================================
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function startAlarmBuzzer() {
    initAudio();
    if (isAlarmSounding) return;
    isAlarmSounding = true;
    
    // Pulse buzzer sound (beep... beep... beep...)
    alarmInterval = setInterval(() => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        let osc = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        
        osc.type = 'sawtooth'; // Piercing buzzer sound
        osc.frequency.setValueAtTime(950, audioCtx.currentTime); // 950 Hz Tone
        
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    }, 500);
}

function stopAlarmBuzzer() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    isAlarmSounding = false;
}

function updateEmergencyLocation(lat, lng, address) {
    emergencyLocation = { lat, lng, address };
    const locationBox = document.getElementById('emergency-location');
    const locationText = document.getElementById('emergency-location-text');
    if (locationBox && locationText) { locationText.textContent = `${address} (${lat.toFixed(4)}, ${lng.toFixed(4)})`; locationBox.hidden = false; }
}

async function shareEmergencyLocation(recipient) {
    if (!emergencyLocation) return;
    const shareUrl = `https://maps.google.com/?q=${emergencyLocation.lat},${emergencyLocation.lng}`;
    const title = recipient === 'family' || recipient === 'sms' ? 'Family emergency location' : 'Emergency responder location';
    const text = `${title}: Driver drowsiness alert at ${emergencyLocation.address}. ${shareUrl}`;
    try {
        if (recipient === 'family' || recipient === 'sms') {
            let phone = prompt('Enter family member WhatsApp number with country code (example: 919876543210)');
            if (!phone) return;
            phone = phone.replace(/[^0-9]/g, '');
            if (phone.length < 10) {
                sessionStorage.removeItem('familyEmergencyPhone');
                alert('Please enter a valid phone number with country code.');
                return;
            }
            sessionStorage.setItem('familyEmergencyPhone', phone);
            const encodedText = encodeURIComponent(text);
            const waLink = `https://wa.me/${phone}?text=${encodedText}`;
            const smsLink = `sms:${phone}?body=${encodedText}`;
            const targetUrl = recipient === 'family' ? waLink : smsLink;
            const shareWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
            if (!shareWindow) {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(text);
                    alert('WhatsApp window was blocked. The message content was copied to your clipboard.');
                } else {
                    alert(text);
                }
            }
        } else if (navigator.share) await navigator.share({ title, text, url: shareUrl }); else if (navigator.clipboard) { await navigator.clipboard.writeText(text); alert('Emergency location copied. Share it with your contact.'); } else alert(text);
    } catch (error) { if (error.name !== 'AbortError') alert(text); }
}

// Manual Test Sound
function triggerTestAlert() {
    initAudio();
    startAlarmBuzzer();
    setTimeout(stopAlarmBuzzer, 2000);
}

// ===================================================================
// WEBCAM INITIALIZATION & LIFECYCLE
// ===================================================================
async function initiateCamera() {
    activeDemoState = 'ALERT';
    eyeClosedStartTime = null;
    yawnStartTime = null;
    headTiltStartTime = null;
    alertCooldown = false;
    resetAlertState();
    document.getElementById('camera-placeholder').style.display = 'none';
    document.getElementById('camera-toggle-btn').style.display = 'inline-flex';
    isMonitoring = true;
    
    // Reset simulation metrics UI
    updateMetricsUI(0.32, 0.12);
    
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
        });
        video.srcObject = webcamStream;
        video.onloadedmetadata = () => {
            video.play();
            resizeCanvas();
            // Start detection loop
            startDetectionLoop();
        };
    } catch(err) {
        console.warn("Webcam access denied or unavailable. Running in Simualtor-Only GUI mode.");
        // Continue simulation loop anyway so presenter can demonstrate it without webcam!
        startDetectionLoop();
    }
}

function shutdownCamera() {
    isMonitoring = false;
    stopAlarmBuzzer();
    resetAlertState();
    
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (video) {
        video.srcObject = null;
    }
    if (requestFrameId) {
        cancelAnimationFrame(requestFrameId);
        requestFrameId = null;
    }
    
    // Hide controls, show standby banner
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('camera-toggle-btn').style.display = 'none';
    
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ===================================================================
// DETECTION PROCESSING LOOP (REAL OR SIMULATED)
// ===================================================================
function startDetectionLoop() {
    function frame() {
        if (!isMonitoring) return; 
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (activeDemoState !== 'ALERT') {
            // Presenter Mock Mode is active, override webcam and render simulated wireframe
            renderSimulatedMesh();
        } else {
            // Normal operation: try drawing bounding overlay or wireframe helper
            drawStandardHelperWireframe();
        }
        
        requestFrameId = requestAnimationFrame(frame);
    }
    requestFrameId = requestAnimationFrame(frame);
}

// ===================================================================
// DUAL DETECTOR: MOCK GRAPHICS GENERATOR (Wireframes)
// ===================================================================
function drawStandardHelperWireframe() {
    // Keep the live fallback safely neutral until real face landmarks are available.
    let simulatedEAR = 0.32;
    let simulatedYawn = 0.12;
    
    updateMetricsUI(simulatedEAR, simulatedYawn);
    drawFaceMeshWireframe(simulatedEAR, simulatedYawn, "Alert Driver");
    
    // Only deliberate demo states or real detector values should enter this rule engine.
    evaluateDrowsinessMetrics(simulatedEAR, simulatedYawn);
}

function renderSimulatedMesh() {
    let simulatedEAR = 0.32;
    let simulatedYawn = 0.12;
    let simulatedHeadTilt = 0.08;
    
    if (activeDemoState === 'EYES_CLOSED') {
        simulatedEAR = 0.07; // Very low EAR
        simulatedYawn = 0.14;
    } else if (activeDemoState === 'YAWNING') {
        simulatedEAR = 0.28;
        simulatedYawn = 0.72; // High Yawn opening
    } else if (activeDemoState === 'HEAD_TILT') {
        simulatedEAR = 0.24;
        simulatedHeadTilt = 0.82;
    }
    
    updateMetricsUI(simulatedEAR, simulatedYawn);
    drawFaceMeshWireframe(simulatedEAR, simulatedYawn, activeDemoState.replace('_', ' '));
    evaluateDrowsinessMetrics(simulatedEAR, simulatedYawn, simulatedHeadTilt);
}

// UI Metrics updater
function updateMetricsUI(ear, yawn) {
    document.getElementById('ear-val').textContent = ear.toFixed(2);
    document.getElementById('yawn-val').textContent = yawn.toFixed(2);
    
    const earBar = document.getElementById('ear-bar');
    const yawnBar = document.getElementById('yawn-bar');
    
    // EAR bar width and styling
    earBar.style.width = `${Math.min(ear * 250, 100)}%`;
    if (ear < 0.20) {
        earBar.className = "metric-bar-fill danger";
    } else if (ear < 0.25) {
        earBar.className = "metric-bar-fill warning";
    } else {
        earBar.className = "metric-bar-fill";
    }
    
    // Yawn bar width and styling
    yawnBar.style.width = `${Math.min(yawn * 120, 100)}%`;
    if (yawn > 0.55) {
        yawnBar.className = "metric-bar-fill danger";
    } else if (yawn > 0.40) {
        yawnBar.className = "metric-bar-fill warning";
    } else {
        yawnBar.className = "metric-bar-fill";
    }
}

// Render vectors on Canvas to draw glowing face mesh overlays
function drawFaceMeshWireframe(ear, yawn, stateLabel) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    
    ctx.strokeStyle = 'rgba(117, 185, 223, 0.5)';
    ctx.lineWidth = 1.5;
    
    // 1. Draw Bounding Face Oval
    ctx.beginPath();
    ctx.ellipse(cx, cy, 110, 150, 0, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw glowing node dots along oval boundary
    ctx.fillStyle = 'rgba(117, 185, 223, 0.85)';
    for(let i=0; i<12; i++) {
        let angle = (i / 12) * 2 * Math.PI;
        let dx = cx + 110 * Math.cos(angle);
        let dy = cy + 150 * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, 2*Math.PI);
        ctx.fill();
    }
    
    // 2. Draw Left Eye & Right Eye vectors
    let eyeRadiusX = 18;
    let leftEyeHeight = ear * 40; // Scaled height based on EAR
    let rightEyeHeight = ear * 40;
    
    ctx.strokeStyle = ear < 0.20 ? 'rgba(241, 123, 120, 0.8)' : 'rgba(98, 214, 169, 0.8)';
    ctx.fillStyle = ear < 0.20 ? 'rgba(241, 123, 120, 0.15)' : 'rgba(98, 214, 169, 0.15)';
    ctx.lineWidth = 2;
    
    // Left Eye
    ctx.beginPath();
    ctx.ellipse(cx - 45, cy - 30, eyeRadiusX, leftEyeHeight, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();
    
    // Right Eye
    ctx.beginPath();
    ctx.ellipse(cx + 45, cy - 30, eyeRadiusX, rightEyeHeight, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();
    
    // Draw pupils
    if (ear >= 0.20) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(cx - 45, cy - 30, 4, 0, 2*Math.PI);
        ctx.arc(cx + 45, cy - 30, 4, 0, 2*Math.PI);
        ctx.fill();
    }
    
    // 3. Draw Mouth vector
    let mouthW = 40;
    let mouthH = yawn * 55; // Height based on yawn value
    
    ctx.strokeStyle = yawn > 0.55 ? 'rgba(241, 123, 120, 0.8)' : 'rgba(86, 199, 165, 0.8)';
    ctx.fillStyle = yawn > 0.55 ? 'rgba(241, 123, 120, 0.15)' : 'rgba(86, 199, 165, 0.15)';
    
    ctx.beginPath();
    ctx.ellipse(cx, cy + 50, mouthW, mouthH, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();
    
    // 4. Print telemetry labels on canvas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 13px Outfit';
    ctx.textAlign = 'center';
    
    let textY = cy - 100;
    ctx.fillText(`AI VIGILANCE: ${stateLabel.toUpperCase()}`, cx, textY);
    
    if (ear < 0.20 || yawn > 0.55) {
        ctx.fillStyle = '#f17b78';
        ctx.fillText("ATTENTION REQUIRED! ⚠️", cx, textY + 22);
    } else {
        ctx.fillStyle = '#62d6a9';
        ctx.fillText("DRIVER VIGILANT ✅", cx, textY + 22);
    }
}

// ===================================================================
// AI DECISION RULES ENGINE
// ===================================================================
function evaluateDrowsinessMetrics(ear, yawn, headTilt = 0.08) {
    const timeNow = Date.now();
    
    // Rule 1: Evaluate Eye Closure Duration (Microsleep: closed > 1.2s)
    if (ear < 0.20) {
        if (!eyeClosedStartTime) {
            eyeClosedStartTime = timeNow;
        } else {
            let duration = (timeNow - eyeClosedStartTime) / 1000;
            if (duration >= 1.2) {
                triggerDrowsinessAlert('EYES_CLOSED', duration);
            }
        }
    } else {
        eyeClosedStartTime = null;
    }
    
    // Rule 2: Evaluate Yawning Duration (Yawning: open > 2.0s)
    if (yawn > 0.55) {
        if (!yawnStartTime) {
            yawnStartTime = timeNow;
        } else {
            let duration = (timeNow - yawnStartTime) / 1000;
            if (duration >= 2.0) {
                triggerDrowsinessAlert('YAWNING', duration);
            }
        }
    } else {
        yawnStartTime = null;
    }

    // Rule 3: Evaluate sustained head tilt / sleeping posture.
    if (headTilt > 0.65) {
        if (!headTiltStartTime) {
            headTiltStartTime = timeNow;
        } else {
            const duration = (timeNow - headTiltStartTime) / 1000;
            if (duration >= 1.5) {
                triggerDrowsinessAlert('HEAD_TILT', duration);
            }
        }
    } else {
        headTiltStartTime = null;
    }
    
    // Resolve alert if state returned to normal and buzzer was ringing
    if (ear >= 0.20 && yawn <= 0.55 && headTilt <= 0.65 && isAlarmSounding && activeDemoState === 'ALERT') {
        resetAlertState();
    }
}

// ===================================================================
// ALERT NOTIFICATION & BACKEND INTEGRATION
// ===================================================================
async function triggerDrowsinessAlert(type, duration) {
    if (alertCooldown) return;
    alertCooldown = true; // Wait for cooldown reset
    
    // Trigger Alarm & Danger Glow
    startAlarmBuzzer();
    document.getElementById('danger-overlay').style.display = 'block';
    
    // Update global status pills
    const pill = document.getElementById('live-status-pill');
    pill.className = 'live-status-pill status-danger';
    document.getElementById('live-status-text').textContent = 'Drowsiness Detected ⚠️';
    
    const statusText = document.getElementById('stat-current-status');
    statusText.textContent = type === 'EYES_CLOSED' ? 'Drowsy (Eyes Closed)' : type === 'YAWNING' ? 'Drowsy (Yawning)' : 'Drowsy (Head Tilt)';
    statusText.style.color = 'var(--color-danger)';
    
    // Trigger UI Toast popup
    const toast = document.getElementById('drowsiness-toast');
    document.getElementById('toast-title').textContent = type === 'EYES_CLOSED' ? 'Drowsiness Detected ⚠️' : type === 'YAWNING' ? 'Yawning Incident ⚠️' : 'Sleeping Posture Detected ⚠️';
    document.getElementById('toast-msg').textContent = `Warning: driver displays sleepy behavior. Alarm initialized.`;
    toast.classList.add('active');
    
    // Retrieve live location coordinates (HTML5 Geolocation)
    let lat = 11.4530;
    let lng = 77.4367;
    let addr = "Gobichettipalayam, Erode District, Tamilnadu"; // Default fallback (Erode District, Gobichettipalayam)
    updateEmergencyLocation(lat, lng, addr);
    
    // Geolocation grab
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                addr = `GPS: (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                
                // Query free OSM reverse geocoder API to get Tamil Nadu town/road name if possible, forcing English
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`, {
                        headers: { 'User-Agent': 'VigilanceDrowsinessApp/1.0' }
                    });
                    if (res.ok) {
                        const geo = await res.json();
                        let rawAddress = geo.display_name;
                        
                        // Clean up Tamil translations and mavattam terms
                        rawAddress = rawAddress.replace(/Erode Mavattam/gi, "Erode District");
                        rawAddress = rawAddress.replace(/Erode/gi, "Erode District");
                        rawAddress = rawAddress.replace(/ஈரோடு மாவட்டம்/g, "Erode District");
                        rawAddress = rawAddress.replace(/ஈரோடு/g, "Erode District");
                        rawAddress = rawAddress.replace(/மாவட்டம்/g, "District");
                        rawAddress = rawAddress.replace(/Mavattam/gi, "District");
                        rawAddress = rawAddress.replace(/Tamil\s*Nadu/gi, "Tamilnadu");
                        
                        addr = rawAddress.split(',').slice(0, 3).join(',');
                    }
                } catch(e) {
                    console.log("Using baseline GPS address representation");
                }
                updateEmergencyLocation(lat, lng, addr);
                
                // Log to db
                await pushLogIncident(type, duration, lat, lng, addr);
            },
            async (err) => {
                // Denied or timeout, pick a random simulated Tamil Nadu spot
                const spot = TAMIL_NADU_SPOTS[Math.floor(Math.random() * TAMIL_NADU_SPOTS.length)];
                lat = spot.lat;
                lng = spot.lng;
                addr = spot.name;
                updateEmergencyLocation(lat, lng, addr);
                await pushLogIncident(type, duration, lat, lng, addr);
            }
        );
    } else {
        const spot = TAMIL_NADU_SPOTS[Math.floor(Math.random() * TAMIL_NADU_SPOTS.length)];
        lat = spot.lat;
        lng = spot.lng;
        addr = spot.name;
        updateEmergencyLocation(lat, lng, addr);
        await pushLogIncident(type, duration, lat, lng, addr);
    }
    
    // Force alert timeout resolution (e.g. log cooldown)
    setTimeout(() => { alertCooldown = false; }, 4000);
}

function resetAlertState() {
    stopAlarmBuzzer();
    document.getElementById('danger-overlay').style.display = 'none';
    
    const pill = document.getElementById('live-status-pill');
    pill.className = 'live-status-pill';
    document.getElementById('live-status-text').textContent = 'Driver is Alert ✅';
    
    const statusText = document.getElementById('stat-current-status');
    statusText.textContent = 'Alert';
    statusText.style.color = 'var(--color-success)';
    
    closeToast();
}

function closeToast() {
    document.getElementById('drowsiness-toast').classList.remove('active');
}

// ===================================================================
// PRESENTATION DEMO MODE STATE SWITCHER
// ===================================================================
function simulateState(state) {
    activeDemoState = state;
    
    // Remove active styles from demo buttons
    document.getElementById('demo-ear-btn').classList.remove('active');
    document.getElementById('demo-yawn-btn').classList.remove('active');
    document.getElementById('demo-tilt-btn').classList.remove('active');
    document.getElementById('demo-alert-btn').classList.remove('active');
    
    if (state === 'EYES_CLOSED') {
        document.getElementById('demo-ear-btn').classList.add('active');
    } else if (state === 'YAWNING') {
        document.getElementById('demo-yawn-btn').classList.add('active');
    } else if (state === 'HEAD_TILT') {
        document.getElementById('demo-tilt-btn').classList.add('active');
    } else if (state === 'ALERT') {
        document.getElementById('demo-alert-btn').classList.add('active');
        resetAlertState();
    }
}

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
    // Only capture keys if webcam view is active and we are monitoring
    const camSection = document.getElementById('view-camera');
    if (camSection.classList.contains('active') && isMonitoring) {
        const key = e.key.toUpperCase();
        if (key === 'C') {
            simulateState('EYES_CLOSED');
        } else if (key === 'Y') {
            simulateState('YAWNING');
        } else if (key === 'T') {
            simulateState('HEAD_TILT');
        } else if (key === 'A') {
            simulateState('ALERT');
        }
    }
});

// End of detection.js
