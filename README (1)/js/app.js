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
    // Remove active class from all menu items and views
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
    
    // Set clicked item active
    const navEl = document.getElementById(`nav-${viewId}`);
    if (navEl) navEl.classList.add('active');
    
    // Set section active
    const viewEl = document.getElementById(`view-${viewId}`);
    if (viewEl) viewEl.classList.add('active');
    
    // Set Header titles
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    
    if (viewId === 'dashboard') {
        titleEl.textContent = "Safety Dashboard";
        subtitleEl.textContent = "Real-time driver vigilance statistics";
        loadDashboardStats();
    } else if (viewId === 'camera') {
        titleEl.textContent = "AI Webcam Monitor";
        subtitleEl.textContent = "Real-time facial aspect mapping and eye analysis";
        // Resize canvas if needed
        resizeCanvas();
    } else if (viewId === 'logs') {
        titleEl.textContent = "Driver History Logs";
        subtitleEl.textContent = "Search, filter and analyze drowsiness incidents";
        loadHistoryLogs();
    }
}

// Toggle between Login & Register panels
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
    const userEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    const username = userEl.value.trim();
    const password = passEl.value.trim();

    if (!username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            loginSuccess(data);
        } else {
            const errData = await response.json();
            alert(errData.error || "Invalid username or password.");
        }
    } catch(err) {
        // Mock fallback if Spring Boot is offline
        if (username === 'driver' && password === 'password123') {
            loginSuccess({
                username: 'driver',
                fullName: 'John Doe (Mock)',
                licenseNumber: 'TN-15-2023-0089123',
                vehicleNumber: 'TN-30-AX-4567'
            });
        } else {
            // Check local storage mock users
            let localUsers = JSON.parse(localStorage.getItem('users') || '[]');
            let found = localUsers.find(u => u.username === username && u.password === password);
            if (found) {
                loginSuccess(found);
            } else {
                alert("Connection failed, and no matching mock user found. Try 'driver' / 'password123'");
            }
        }
    }
}

function loginSuccess(userData) {
    currentUser = userData;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Hide auth page, show main app page
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    
    // Set user profile info
    document.getElementById('driver-display-name').textContent = currentUser.fullName;
    document.getElementById('vehicle-display-no').textContent = currentUser.vehicleNumber;
    
    // Set initials in avatar
    const names = currentUser.fullName.split(' ');
    const initials = names.map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('avatar-letters').textContent = initials;
    
    // Redirect to dashboard
    switchView('dashboard');
    
    // Initialize standard mock data in localStorage for standalone run
    initLocalStorageLogs();
}

async function handleRegister() {
    const fullName = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const licenseNumber = document.getElementById('reg-license').value.trim();
    const vehicleNumber = document.getElementById('reg-vehicle').value.trim();

    if (!fullName || !username || !password || !licenseNumber || !vehicleNumber) {
        alert("Please fill in all fields.");
        return;
    }

    const payload = { fullName, username, password, licenseNumber, vehicleNumber };

    try {
        const response = await fetch(`${apiBaseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Driver Registration Successful! Proceed to Login.");
            toggleAuthCard('login');
        } else {
            const errData = await response.json();
            alert(errData.error || "Registration failed.");
        }
    } catch(err) {
        // Offline registration fallback
        let localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        if (localUsers.some(u => u.username === username) || username === 'driver') {
            alert("Username already taken in Local Storage Database.");
            return;
        }
        localUsers.push(payload);
        localStorage.setItem('users', JSON.stringify(localUsers));
        alert("Registration Successful in Offline Mock Database! Proceed to Login.");
        toggleAuthCard('login');
    }
}

function handleLogout() {
    shutdownCamera(); // Safety turnoff webcam
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    // Swap screens
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
            { id: 1, username: currentUser.username, timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), eventType: 'YAWNING', duration: 2.5, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            { id: 2, username: currentUser.username, timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 3600000).toISOString(), eventType: 'EYES_CLOSED', duration: 3.1, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            { id: 3, username: currentUser.username, timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), eventType: 'EYES_CLOSED', duration: 4.2, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            { id: 4, username: currentUser.username, timestamp: new Date(Date.now() - 24 * 3600 * 1000 + 4000000).toISOString(), eventType: 'MICROSLEEP', duration: 5.8, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            { id: 5, username: currentUser.username, timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), eventType: 'YAWNING', duration: 1.8, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' },
            { id: 6, username: currentUser.username, timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), eventType: 'EYES_CLOSED', duration: 3.5, latitude: 11.4530, longitude: 77.4367, address: 'Gobichettipalayam, Erode District, Tamilnadu', status: 'Resolved ✅' }
        ];
        localStorage.setItem(logKey, JSON.stringify(logs));
    }
}

function getLocalLogs() {
    try { return JSON.parse(localStorage.getItem(`logs_${currentUser.username}`) || '[]'); }
    catch (error) { return []; }
}

function saveLocalLogs(logs) {
    localStorage.setItem(`logs_${currentUser.username}`, JSON.stringify(logs));
}

function mergeIncidentLogs(remoteLogs, localLogs) {
    const merged = [...(remoteLogs || [])];
    const known = new Set(merged.map(log => `${log.timestamp}|${log.eventType}|${log.duration}`));
    localLogs.forEach(log => {
        const key = `${log.timestamp}|${log.eventType}|${log.duration}`;
        if (!known.has(key)) merged.push(log);
    });
    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Helper to push a new incident log
async function pushLogIncident(eventType, duration, lat, lng, addr) {
    const payload = {
        username: currentUser.username,
        timestamp: new Date().toISOString(),
        eventType: eventType,
        duration: parseFloat(duration),
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        address: addr,
        status: 'Drowsiness Detected ⚠️'
    };

    const logs = getLocalLogs();
    payload.id = logs.reduce((highest, log) => Math.max(highest, Number(log.id) || 0), 0) + 1;
    logs.unshift(payload);
    saveLocalLogs(logs);
    allLogsData = logs;

    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            console.log("Logged drowsiness event to backend MySQL/H2.");
            return await res.json();
        }
        throw new Error("Incident API returned a non-success response");
    } catch(err) {
        console.warn("Backend error. Logging drowsiness to LocalStorage.");
        return payload;
    } finally {
        loadDashboardStats();
        if (document.getElementById('view-logs').classList.contains('active')) loadHistoryLogs();
    }
}

// Helper to mark a log resolved
async function resolveIncident(id) {
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/resolve/${id}`, { method: 'PUT' });
        if (res.ok) return true;
    } catch(err) {
        let logs = getLocalLogs();
        let index = logs.findIndex(l => l.id == id);
        if (index !== -1) {
            logs[index].status = 'Resolved ✅';
            saveLocalLogs(logs);
            return true;
        }
    }
    return false;
}

// ===================================================================
// DASHBOARD VIEW LOADER (CHART.JS AND COUNTERS)
// ===================================================================
async function loadDashboardStats() {
    let stats = { total: 0, eyesClosed: 0, yawning: 0, microsleep: 0, recentLogs: [], allLogs: [] };

    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/stats/${currentUser.username}`);
        if (res.ok) {
            stats = await res.json();
        } else {
            throw new Error("Stats API failed");
        }
    } catch(err) {
        // Fetch offline local storage mock logs
        let logs = getLocalLogs();
        stats.total = logs.length;
        stats.eyesClosed = logs.filter(l => l.eventType === 'EYES_CLOSED').length;
        stats.yawning = logs.filter(l => l.eventType === 'YAWNING').length;
        stats.microsleep = logs.filter(l => l.eventType === 'MICROSLEEP').length;
        stats.recentLogs = logs.slice(0, 5);
        stats.allLogs = logs;
    }

    stats.allLogs = mergeIncidentLogs(stats.allLogs, getLocalLogs());
    stats.total = stats.allLogs.length;
    stats.eyesClosed = stats.allLogs.filter(log => log.eventType === 'EYES_CLOSED').length;
    stats.yawning = stats.allLogs.filter(log => log.eventType === 'YAWNING').length;
    stats.microsleep = stats.allLogs.filter(log => log.eventType === 'MICROSLEEP' || log.eventType === 'HEAD_TILT').length;
    stats.recentLogs = stats.allLogs.slice(0, 5);

    // Populate Widget Values
    document.getElementById('stat-total-incidents').textContent = stats.total;
    document.getElementById('stat-eye-closures').textContent = stats.eyesClosed;
    document.getElementById('stat-yawn-count').textContent = stats.yawning;

    // Populate Recent logs
    const recentLogsContainer = document.getElementById('mini-log-list-container');
    recentLogsContainer.innerHTML = '';
    
    if (stats.recentLogs.length === 0) {
        recentLogsContainer.innerHTML = `
            <div class="mini-log-item">
                <div class="mini-log-details">
                    <h5>No incidents logged</h5>
                    <p>Driver is vigilant and safe</p>
                </div>
            </div>`;
    } else {
        stats.recentLogs.forEach(log => {
            const timeFormatted = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let badgeClass = 'tag-warning';
            if (log.eventType === 'MICROSLEEP') badgeClass = 'tag-danger';
            if (log.eventType === 'EYES_CLOSED') badgeClass = 'tag-danger';

            recentLogsContainer.innerHTML += `
                <div class="mini-log-item">
                    <div class="mini-log-details">
                        <h5>${log.eventType.replace('_', ' ')}</h5>
                        <p>${timeFormatted} • ${log.address.split(',')[0]}</p>
                    </div>
                    <span class="mini-log-tag ${badgeClass}">${log.status.includes('Resolved') ? 'Resolved' : 'Active ⚠️'}</span>
                </div>`;
        });
    }

    // Build Chart JS
    buildTrendChart(stats.allLogs);
}

function buildTrendChart(allLogs) {
    const ctx = document.getElementById('drowsyTrendChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Map logs to simple hour groups (00:00 - 23:00)
    let hoursCount = Array(24).fill(0);
    allLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        hoursCount[hour]++;
    });

    const labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    
    // Style chart with gradient glow
    const primaryGrad = ctx.createLinearGradient(0, 0, 0, 300);
    primaryGrad.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
    primaryGrad.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Incidents Count',
                data: hoursCount,
                borderColor: '#6366f1',
                backgroundColor: primaryGrad,
                fill: true,
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: '#06b6d4',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', maxRotation: 45 }
                }
            }
        }
    });
}

// ===================================================================
// LOGS HISTORY & SEARCH FILTER LOADER
// ===================================================================
async function loadHistoryLogs() {
    try {
        const res = await fetch(`${apiBaseUrl}/drowsiness/history/${currentUser.username}`);
        if (res.ok) {
            allLogsData = mergeIncidentLogs(await res.json(), getLocalLogs());
        } else {
            throw new Error("API fail");
        }
    } catch(err) {
        allLogsData = getLocalLogs();
    }

    renderLogsTable(allLogsData);
}

function renderLogsTable(data) {
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim);">No incidents matching criteria.</td></tr>`;
        return;
    }

    data.forEach(log => {
        const dateStr = new Date(log.timestamp).toLocaleString();
        
        let typeBadge = `<span class="badge badge-warning">Yawning</span>`;
        if (log.eventType === 'EYES_CLOSED') typeBadge = `<span class="badge badge-danger">Eyes Closed</span>`;
        if (log.eventType === 'MICROSLEEP') typeBadge = `<span class="badge badge-danger" style="background: red;">Microsleep</span>`;

        let statusActionBtn = '';
        if (log.status.includes('⚠️') || log.status.includes('Active') || log.status.includes('Drowsiness')) {
            statusActionBtn = `<button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.75rem;" onclick="resolveLogItem(${log.id})">Resolve</button>`;
        } else {
            statusActionBtn = `<span class="badge badge-success">Resolved</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>#${log.id || 'N/A'}</td>
                <td>${dateStr}</td>
                <td>${typeBadge}</td>
                <td>${log.duration.toFixed(1)}s</td>
                <td>${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}</td>
                <td>${log.address}</td>
                <td id="status-col-${log.id}">${statusActionBtn}</td>
                <td>
                    <button class="map-link-btn" onclick="openMapModal(${log.latitude}, ${log.longitude}, '${log.address}')">
                        <i class="fa-solid fa-map-location-dot"></i> Map
                    </button>
                </td>
            </tr>`;
    });
}

function applyFilters() {
    const q = document.getElementById('search-filter').value.toLowerCase();
    const filtered = allLogsData.filter(log => {
        return log.eventType.toLowerCase().includes(q) || 
               log.address.toLowerCase().includes(q) ||
               log.status.toLowerCase().includes(q);
    });
    renderLogsTable(filtered);
}

async function resolveLogItem(id) {
    const success = await resolveIncident(id);
    if (success) {
        const col = document.getElementById(`status-col-${id}`);
        if (col) {
            col.innerHTML = `<span class="badge badge-success">Resolved</span>`;
        }
        // Refresh counts
        loadHistoryLogs();
    }
}

function exportData(format) {
    if (allLogsData.length === 0) {
        alert("No data available to export.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,ID,Timestamp,Event Type,Duration(s),Latitude,Longitude,Location,Status\n";
    allLogsData.forEach(log => {
        csvContent += `${log.id},"${new Date(log.timestamp).toLocaleString()}",${log.eventType},${log.duration},${log.latitude},${log.longitude},"${log.address}","${log.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `drowsiness_report_${currentUser.username}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===================================================================
// LEAFLET MAP MODAL LOADER & RADAR SCANNER FALLBACK
// ===================================================================
function openMapModal(lat, lng, address) {
    const modal = document.getElementById('map-modal-overlay');
    document.getElementById('map-modal-title').textContent = `Incident Location: ${address}`;
    modal.classList.add('active');

    // Timeout allows DOM container to resize before loading map
    setTimeout(() => {
        // Reset container content in case it was overwritten by fallback
        document.getElementById('map-element').innerHTML = '';
        
        if (typeof L === 'undefined') {
            console.warn("Leaflet Map library not loaded. Falling back to Radar satellite simulation.");
            showRadarFallbackMap(lat, lng, address);
            return;
        }

        try {
            if (mapInstance) {
                mapInstance.remove();
                mapInstance = null;
            }
            
            mapInstance = L.map('map-element').setView([lat, lng], 14);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            L.marker([lat, lng]).addTo(mapInstance)
                .bindPopup(`<b>Incident Spot</b><br>${address}`)
                .openPopup();

            // Force map recalculation for correct rendering inside modal
            setTimeout(() => {
                if (mapInstance) mapInstance.invalidateSize();
            }, 150);

        } catch (err) {
            console.error("Leaflet initialization failed, showing Radar fallback: ", err);
            showRadarFallbackMap(lat, lng, address);
        }
    }, 300);
}

function showRadarFallbackMap(lat, lng, address) {
    const container = document.getElementById('map-element');
    container.innerHTML = `
        <div style="width:100%; height:100%; background:#090d16; border:1px solid rgba(255,255,255,0.08); border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; overflow:hidden;">
            <!-- Grid pattern background -->
            <div style="position:absolute; width:100%; height:100%; background-image: linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px); background-size: 20px 20px; z-index:1;"></div>
            
            <!-- Radar target tracker rings -->
            <div style="position:absolute; width:180px; height:180px; border-radius:50%; border:1px solid rgba(6,182,212,0.15); display:flex; align-items:center; justify-content:center; z-index:2;">
                <div style="width:120px; height:120px; border-radius:50%; border:1.5px dashed rgba(6,182,212,0.3); display:flex; align-items:center; justify-content:center; animation: alertPulse 3s infinite;">
                    <div style="width:12px; height:12px; border-radius:50%; background:#ef4444; box-shadow:0 0 15px #ef4444, 0 0 30px #ef4444; animation: pulseIcon 0.8s infinite alternate;"></div>
                </div>
            </div>
            
            <!-- Telemetry info -->
            <div style="z-index:3; text-align:center; margin-top:190px; padding: 0 15px;">
                <h4 style="color:#06b6d4; font-family:'Outfit', sans-serif; font-size:1.15rem; margin-bottom:6px; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fa-solid fa-satellite-dish" style="animation: pulseIcon 1.5s infinite alternate;"></i> GPS ALERT BEACON LOCKED
                </h4>
                <p style="color:#f8fafc; font-size:0.95rem; font-weight:600; font-family:'Outfit', sans-serif; text-shadow:0 0 10px rgba(255,255,255,0.2);">${address}</p>
                <p style="color:#94a3b8; font-size:0.8rem; font-family:monospace; margin-top:6px; letter-spacing:0.5px;">COORD: ${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E</p>
                <span style="font-size:0.7rem; background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); padding:4px 10px; border-radius:15px; margin-top:12px; display:inline-block; font-weight:600; letter-spacing:0.5px;">SYSTEM LIVE MAP FALLBACK</span>
            </div>
        </div>
    `;
}

function closeMapModal() {
    document.getElementById('map-modal-overlay').classList.remove('active');
    if (mapInstance) {
        try {
            mapInstance.remove();
        } catch(e) {
            console.warn("Error removing map instance on close: ", e);
        }
        mapInstance = null;
    }
    // Clean element content
    document.getElementById('map-element').innerHTML = '';
}

// ===================================================================
// ON LOAD SESSION RESTORE
// ===================================================================
window.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        loginSuccess(JSON.parse(storedUser));
    }
    testBackendConnection();
});
