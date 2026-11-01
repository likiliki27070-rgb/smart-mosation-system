// ===================================================================
// GLOBAL APP STATE & ROUTING
// ===================================================================
let currentUser = null;
let apiBaseUrl = '/api'; // Relative endpoint since frontend is served by Spring Boot
let chartInstance = null;
let mapInstance = null;
let allLogsData = []; // Cache logs to filter client-side

// Verify if backend is reachable (failsafe)
async function testBackendConnection() {
    try {
        const res = await fetch(`${apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        console.log("Connected to Spring Boot backend API.");
        return true;
    } catch(err) {
        console.warn("Backend API unreachable. Falling back to local demo mock mode.");
        return false;
    }
}

// SPA Navigation
function switchView(viewId) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${viewId}`);
    if (navEl) navEl.classList.add('active');
    const viewEl = document.getElementById(`view-${viewId}`);
    if (viewEl) viewEl.classList.add('active');
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (viewId === 'dashboard') {
        titleEl.textContent = "Safety Dashboard";
        subtitleEl.textContent = "Real-time driver vigilance statistics";
        loadDashboardStats();
    } else if (viewId === 'camera') {
        titleEl.textContent = "AI Webcam Monitor";
        subtitleEl.textContent = "Real-time facial aspect mapping and eye analysis";
        resizeCanvas();
    } else if (viewId === 'logs') {
        titleEl.textContent = "Driver History Logs";
        subtitleEl.textContent = "Search, filter and analyze drowsiness incidents";
        loadHistoryLogs();
    }
}

function toggleAuthCard(cardType) {
    if (cardType === 'login') {
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('register-card').style.display = 'none';
    } else {
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
    }
}

// ===================================================================
// USER AUTHENTICATION HANDLERS
// ===================================================================
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) { alert("Please fill in all fields."); return; }
    try {
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) { const data = await response.json(); loginSuccess(data); }
        else { const err = await response.json(); alert(err.error || "Invalid credentials."); }
    } catch(err) {
        if (username === 'driver' && password === 'password123') {
            loginSuccess({ username: 'driver', fullName: 'John Doe (Mock)', licenseNumber: 'TN-15-2023-0089123', vehicleNumber: 'TN-30-AX-4567' });
        } else {
            let localUsers = JSON.parse(localStorage.getItem('users') || '[]');
            let found = localUsers.find(u => u.username === username && u.password === password);
            if (found) loginSuccess(found);
            else alert("Connection failed, and no matching mock user found. Try 'driver' / 'password123'");
        }
    }
}

function loginSuccess(userData) {
    currentUser = userData;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    document.getElementById('driver-display-name').textContent = currentUser.fullName;
    document.getElementById('vehicle-display-no').textContent = currentUser.vehicleNumber;
    const initials = currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('avatar-letters').textContent = initials;
    switchView('dashboard');
    initLocalStorageLogs();
}

async function handleRegister() {
    const fullName = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const license = document.getElementById('reg-license').value.trim();
    const vehicle = document.getElementById('reg-vehicle').value.trim();
    if (!fullName || !username || !password || !license || !vehicle) { alert("Please fill in all fields."); return; }
    const payload = { fullName, username, password, licenseNumber: license, vehicleNumber: vehicle };
    try {
        const response = await fetch(`${apiBaseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) { alert("Driver Registration Successful! Proceed to Login."); toggleAuthCard('login'); }
        else { const err = await response.json(); alert(err.error || "Registration failed."); }
    } catch(err) {
        let localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        if (localUsers.some(u => u.username === username) || username === 'driver') { alert("Username already taken."); return; }
        localUsers.push(payload);
        localStorage.setItem('users', JSON.stringify(localUsers));
        alert("Registration Successful in Offline Mock Database! Proceed to Login.");
        toggleAuthCard('login');
    }
}

function handleLogout() {
    shutdownCamera();
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('auth-section').style.display = 'flex';
}

// ===================================================================
// LOCAL STORAGE MOCK DATA (For Offline Demos)
// ===================================================================
function initLocalStorageLogs() {
    const logKey = `logs_${currentUser.username}`;
    if (!localStorage.getItem(logKey)) {
        let logs = [
            { id: 1, username: currentUser.username, timestamp: new Date(Date.now() - 2*24*3600*1000).toISOString(), eventType: 'YAWNING', duration: 2.5, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            // ... additional mock entries omitted for brevity
        ];
        localStorage.setItem(logKey, JSON.stringify(logs));
    }
}

function getLocalLogs() { try { return JSON.parse(localStorage.getItem(`logs_${currentUser.username}`) || '[]'); } catch (error) { return []; } }
function saveLocalLogs(logs) { localStorage.setItem(`logs_${currentUser.username}`, JSON.stringify(logs)); }
function mergeIncidentLogs(remoteLogs, localLogs) {
    const merged = [...(remoteLogs || [])];
    const known = new Set(merged.map(log => `${log.timestamp}|${log.eventType}|${log.duration}`));
    localLogs.forEach(log => { const key = `${log.timestamp}|${log.eventType}|${log.duration}`; if (!known.has(key)) merged.push(log); });
    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function pushLogIncident(eventType, duration, lat, lng, addr) {
    const payload = { username: currentUser.username, timestamp: new Date().toISOString(), eventType, duration: parseFloat(duration), latitude: parseFloat(lat), longitude: parseFloat(lng), address: addr, status: 'Drowsiness Detected ⚠️' };
    const logs = getLocalLogs(); payload.id = logs.reduce((highest, log) => Math.max(highest, Number(log.id) || 0), 0) + 1; logs.unshift(payload); saveLocalLogs(logs); allLogsData = logs;
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) return await res.json();
        throw new Error('Incident API returned a non-success response');
    } catch(err) {
        return payload;
    } finally {
        loadDashboardStats();
        if (document.getElementById('view-logs').classList.contains('active')) loadHistoryLogs();
    }
}

async function resolveIncident(id) {
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/resolve/${id}`, { method: 'PUT' });
        if (res.ok) return true;
    } catch(err) {
        let logs = getLocalLogs();
        let idx = logs.findIndex(l => l.id == id);
        if (idx !== -1) { logs[idx].status = 'Resolved ✅'; saveLocalLogs(logs); return true; }
    }
    return false;
}

// ===================================================================
// DASHBOARD LOADER (Chart & Counters)
// ===================================================================
async function loadDashboardStats() {
    let stats = { total:0, eyesClosed:0, yawning:0, microsleep:0, recentLogs:[], allLogs:[] };
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/stats/${currentUser.username}`);
        if (res.ok) stats = await res.json(); else throw new Error('Stats API failed');
    } catch(err) {
        let logs = getLocalLogs();
        stats.total = logs.length;
        stats.eyesClosed = logs.filter(l=>l.eventType==='EYES_CLOSED').length;
        stats.yawning = logs.filter(l=>l.eventType==='YAWNING').length;
        stats.microsleep = logs.filter(l=>l.eventType==='MICROSLEEP').length;
        stats.recentLogs = logs.slice(0,5);
        stats.allLogs = logs;
    }
    stats.allLogs = mergeIncidentLogs(stats.allLogs, getLocalLogs()); stats.total = stats.allLogs.length; stats.eyesClosed = stats.allLogs.filter(l=>l.eventType==='EYES_CLOSED').length; stats.yawning = stats.allLogs.filter(l=>l.eventType==='YAWNING').length; stats.microsleep = stats.allLogs.filter(l=>l.eventType==='MICROSLEEP' || l.eventType==='HEAD_TILT').length; stats.recentLogs = stats.allLogs.slice(0,5);
    document.getElementById('stat-total-incidents').textContent = stats.total;
    document.getElementById('stat-eye-closures').textContent = stats.eyesClosed;
    document.getElementById('stat-yawn-count').textContent = stats.yawning;
    const recentContainer = document.getElementById('mini-log-list-container');
    recentContainer.innerHTML = '';
    if (stats.recentLogs.length===0) {
        recentContainer.innerHTML = `<div class="mini-log-item"><div class="mini-log-details"><h5>No incidents logged</h5><p>Driver is vigilant and safe</p></div></div>`;
    } else {
        stats.recentLogs.forEach(log=>{ const t=new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); let badge='tag-warning'; if(['MICROSLEEP','EYES_CLOSED'].includes(log.eventType)) badge='tag-danger';
            recentContainer.innerHTML += `<div class="mini-log-item"><div class="mini-log-details"><h5>${log.eventType.replace('_',' ')}</h5><p>${t} • ${log.address.split(',')[0]}</p></div><span class="mini-log-tag ${badge}">${log.status.includes('Resolved')?'Resolved':'Active ⚠️'}</span></div>`; });
    }
    buildTrendChart(stats.allLogs);
}

function buildTrendChart(allLogs) {
    const ctx = document.getElementById('drowsyTrendChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const hours = Array(24).fill(0);
    allLogs.forEach(l=>{ const h=new Date(l.timestamp).getHours(); hours[h]++; });
    const labels = Array.from({length:24},(_,i)=>`${i.toString().padStart(2,'0')}:00`);
    const grad = ctx.createLinearGradient(0,0,0,300);
    grad.addColorStop(0, 'rgba(99,102,241,0.45)');
    grad.addColorStop(1, 'rgba(99,102,241,0.02)');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Incidents Count', data:hours, borderColor:'#6366f1', backgroundColor:grad, fill:true, borderWidth:2, tension:0.4, pointBackgroundColor:'#06b6d4', pointHoverRadius:6 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ y:{ grid:{ color:'rgba(255,255,255,0.05)' }, ticks:{ color:'#94a3b8', stepSize:1 } }, x:{ grid:{display:false}, ticks:{ color:'#94a3b8', maxRotation:45 } } } }
    });
}

// ===================================================================
// LOGS HISTORY & FILTERS
// ===================================================================
async function loadHistoryLogs() {
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/history/${currentUser.username}`);
        if (res.ok) allLogsData = mergeIncidentLogs(await res.json(), getLocalLogs()); else throw new Error('API fail');
    } catch(err) {
        allLogsData = getLocalLogs();
    }
    renderLogsTable(allLogsData);
}

function renderLogsTable(data) {
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = '';
    if (data.length===0) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-dim);">No incidents matching criteria.</td></tr>`; return; }
    data.forEach(log=>{ const dt=new Date(log.timestamp).toLocaleString(); let badge=`<span class="badge badge-warning">Yawning</span>`; if (log.eventType==='EYES_CLOSED') badge=`<span class="badge badge-danger">Eyes Closed</span>`; if (log.eventType==='MICROSLEEP') badge=`<span class="badge badge-danger" style="background:red;">Microsleep</span>`; const action = (log.status.includes('⚠️')||log.status.includes('Active')) ? `<button class="btn btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="resolveLogItem(${log.id})">Resolve</button>` : `<span class="badge badge-success">Resolved</span>`;
        tbody.innerHTML += `<tr><td>#${log.id||'N/A'}</td><td>${dt}</td><td>${badge}</td><td>${log.duration.toFixed(1)}s</td><td>${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}</td><td>${log.address}</td><td id="status-col-${log.id}">${action}</td><td><button class="map-link-btn" onclick="openMapModal(${log.latitude}, ${log.longitude}, '${log.address}')"><i class="fa-solid fa-map-location-dot"></i> Map</button></td></tr>`; });
}

function applyFilters() {
    const q = document.getElementById('search-filter').value.toLowerCase();
    const filtered = allLogsData.filter(l=> l.eventType.toLowerCase().includes(q) || l.address.toLowerCase().includes(q) || l.status.toLowerCase().includes(q));
    renderLogsTable(filtered);
}

async function resolveLogItem(id) {
    const ok = await resolveIncident(id);
    if (ok) { const col=document.getElementById(`status-col-${id}`); if (col) col.innerHTML = `<span class="badge badge-success">Resolved</span>`; loadHistoryLogs(); }
}

function exportData(format) {
    if (allLogsData.length===0) { alert("No data available to export."); return; }
    let csv = "data:text/csv;charset=utf-8,ID,Timestamp,Event Type,Duration(s),Latitude,Longitude,Location,Status\n";
    allLogsData.forEach(l=>{ csv += `${l.id},"${new Date(l.timestamp).toLocaleString()}",${l.eventType},${l.duration},${l.latitude},${l.longitude},"${l.address}","${l.status}"\n`; });
    const link=document.createElement('a'); link.setAttribute('href', encodeURI(csv)); link.setAttribute('download', `drowsiness_report_${currentUser.username}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ===================================================================
// MAP MODAL & FALLBACK
// ===================================================================
function openMapModal(lat, lng, address) {
    const modal=document.getElementById('map-modal-overlay');
    document.getElementById('map-modal-title').textContent = `Incident Location: ${address}`;
    modal.classList.add('active');
    setTimeout(()=>{
        document.getElementById('map-element').innerHTML = '';
        if (typeof L === 'undefined') { console.warn("Leaflet not loaded. Using radar fallback."); showRadarFallbackMap(lat,lng,address); return; }
        try {
            if (mapInstance) { mapInstance.remove(); mapInstance=null; }
            mapInstance = L.map('map-element').setView([lat,lng],14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap contributors' }).addTo(mapInstance);
            L.marker([lat,lng]).addTo(mapInstance).bindPopup(`<b>Incident Spot</b><br>${address}`).openPopup();
            setTimeout(()=>{ if (mapInstance) mapInstance.invalidateSize(); },150);
        } catch(e){ console.error('Leaflet init failed, showing fallback:', e); showRadarFallbackMap(lat,lng,address); }
    },300);
}

function showRadarFallbackMap(lat,lng,address) {
    const container=document.getElementById('map-element');
    container.innerHTML = `<div style="width:100%;height:100%;background:#090d16;border:1px solid rgba(255,255,255,0.08);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;">
        <div style="position:absolute;width:100%;height:100%;background-image:linear-gradient(rgba(99,102,241,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.05) 1px,transparent 1px);background-size:20px 20px;z-index:1;"></div>
        <div style="position:absolute;width:180px;height:180px;border-radius:50%;border:1px solid rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;z-index:2;">
            <div style="width:120px;height:120px;border-radius:50%;border:1.5px dashed rgba(6,182,212,0.3);display:flex;align-items:center;justify-content:center;animation:alertPulse 3s infinite;">
                <div style="width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 15px #ef4444,0 0 30px #ef4444;animation:pulseIcon 0.8s infinite alternate;"></div>
            </div>
        </div>
        <div style="z-index:3;text-align:center;margin-top:190px;padding:0 15px;">
            <h4 style="color:#06b6d4;font-family:'Outfit',sans-serif;font-size:1.15rem;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:8px;">
                <i class="fa-solid fa-satellite-dish" style="animation:pulseIcon 1.5s infinite alternate;"></i> GPS ALERT BEACON LOCKED
            </h4>
            <p style="color:#f8fafc;font-size:0.95rem;font-weight:600;font-family:'Outfit',sans-serif;text-shadow:0 0 10px rgba(255,255,255,0.2);">${address}</p>
            <p style="color:#94a3b8;font-size:0.8rem;font-family:monospace;margin-top:6px;letter-spacing:0.5px;">COORD: ${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E</p>
            <span style="font-size:0.7rem;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25);padding:4px 10px;border-radius:15px;margin-top:12px;display:inline-block;font-weight:600;letter-spacing:0.5px;">SYSTEM LIVE MAP FALLBACK</span>
        </div>
    </div>`;
}

function closeMapModal() {
    document.getElementById('map-modal-overlay').classList.remove('active');
    if (mapInstance) { try { mapInstance.remove(); } catch(e){ console.warn('Error removing map:', e); } mapInstance=null; }
    document.getElementById('map-element').innerHTML = '';
}

// ===================================================================
// ON LOAD SESSION RESTORE
// ===================================================================
window.addEventListener('DOMContentLoaded', async ()=> {
    const stored = localStorage.getItem('currentUser');
    if (stored) loginSuccess(JSON.parse(stored));
    testBackendConnection();
});
