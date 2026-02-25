const API_URL = '/api/auth';
let socket;
let currentUser = null;
let currentRoom = null;
let isHost = false;

// YouTube Player Variables
let ytPlayer;
let ytReady = false;
let isVideoSyncing = false; // Flag to prevent echo loops
let syncInterval;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// --- UI Navigation ---
const App = {
    showView: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'hidden'));
        document.querySelectorAll('.view').forEach(v => {
            if (v.id === viewId) v.classList.add('active');
            else v.classList.add('hidden');
        });
    },

    showToast: (message, type = '') => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    switchTab: (tabName) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active', 'hidden'));

        event.target.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => {
            if (c.id === `tab-${tabName}`) c.classList.add('active');
            else c.classList.add('hidden');
        });
    },

    logout: () => {
        localStorage.removeItem('mpot_token');
        localStorage.removeItem('mpot_user');
        currentUser = null;
        if (socket) socket.disconnect();
        App.showView('view-login');
        App.showToast('Logged out');
    }
};

window.app = App;

// --- Authentication ---
const checkAuth = () => {
    const token = localStorage.getItem('mpot_token');
    const user = localStorage.getItem('mpot_user');

    if (token && user) {
        currentUser = JSON.parse(user);
        document.getElementById('user-greeting').textContent = currentUser.contact;
        App.showView('view-dashboard');
        initSocket();
        fetchLibrary(); // Load library on start
    } else {
        App.showView('view-login');
    }
};

// Register
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('reg-contact').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, password })
        });
        const data = await res.json();

        if (res.ok) {
            App.showToast(data.message, 'success');
            // Store contact temporarily for OTP verify
            document.getElementById('form-verify').dataset.contact = contact;
            App.showView('view-verify-otp');

            // Auto-fill OTP for easy testing
            if (data.otp) {
                setTimeout(() => {
                    document.getElementById('otp-1').value = data.otp[0];
                    document.getElementById('otp-2').value = data.otp[1];
                    document.getElementById('otp-3').value = data.otp[2];
                    document.getElementById('otp-4').value = data.otp[3];
                }, 500);
            }

        } else {
            App.showToast(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        App.showToast('Server error', 'error');
    }
});

// Verify Registration OTP
document.getElementById('form-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('form-verify').dataset.contact;
    const otp = [1, 2, 3, 4].map(i => document.getElementById(`otp-${i}`).value).join('');

    try {
        const res = await fetch(`${API_URL}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, otp })
        });
        const data = await res.json();

        if (res.ok) {
            App.showToast(data.message, 'success');
            App.showView('view-login');
        } else {
            App.showToast(data.error || 'Verification failed', 'error');
        }
    } catch (err) {
        App.showToast('Server error', 'error');
    }
});

// Login
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('login-contact').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('mpot_token', data.token);
            localStorage.setItem('mpot_user', JSON.stringify(data.user));
            currentUser = data.user;
            document.getElementById('user-greeting').textContent = currentUser.contact;
            App.showView('view-dashboard');
            initSocket();
        } else {
            App.showToast(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        App.showToast('Server error', 'error');
    }
});

// Forgot Password Flow
document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('forgot-contact').value;

    try {
        const res = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact })
        });
        const data = await res.json();
        if (res.ok) {
            App.showToast('OTP sent to your contact', 'success');
            document.getElementById('form-reset').dataset.contact = contact;
            App.showView('view-reset-password');

            // Auto-fill OTP for easy testing
            if (data.otp) {
                setTimeout(() => {
                    document.getElementById('reset-otp-1').value = data.otp[0];
                    document.getElementById('reset-otp-2').value = data.otp[1];
                    document.getElementById('reset-otp-3').value = data.otp[2];
                    document.getElementById('reset-otp-4').value = data.otp[3];
                }, 500);
            }
        } else {
            App.showToast(data.error, 'error');
        }
    } catch (err) {
        App.showToast('Server Error', 'error');
    }
});

// Reset Password Flow
document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('form-reset').dataset.contact;
    const otp = [1, 2, 3, 4].map(i => document.getElementById(`reset-otp-${i}`).value).join('');
    const newPassword = document.getElementById('reset-new-password').value;

    try {
        const res = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, otp, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            App.showToast(data.message, 'success');
            App.showView('view-login');
        } else {
            App.showToast(data.error, 'error');
        }
    } catch (err) {
        App.showToast('Server Error', 'error');
    }
});


// OTP Auto-focus logic
document.querySelectorAll('.otp-box').forEach((input, index, inputs) => {
    input.addEventListener('input', function () {
        if (this.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) inputs[index - 1].focus();
    });
});


// --- Rooms & Sockets ---
const initSocket = () => {
    if (socket) socket.disconnect();
    socket = io();

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('roomUpdate', (data) => {
        updateMembersList(data.members, data.hostId);
        // Check if I became the host
        if (data.hostId === socket.id && !isHost) {
            isHost = true;
            App.showToast('You are now the host', 'success');
            document.getElementById('host-controls').style.display = 'flex';
            document.getElementById('playback-controls').style.display = 'flex';
        }
    });

    socket.on('chatMessage', (msg) => {
        appendChatMessage(msg);
    });

    socket.on('videoStateSync', (state) => {
        if (!state.videoId) return;

        if (ytReady && !isHost) {
            isVideoSyncing = true;
            if (ytPlayer.getVideoData().video_id !== state.videoId) {
                ytPlayer.loadVideoById(state.videoId, state.currentTime);
                document.getElementById('player-overlay').style.display = 'none';
            } else {
                if (Math.abs(ytPlayer.getCurrentTime() - state.currentTime) > 2) {
                    ytPlayer.seekTo(state.currentTime);
                }
            }
            state.isPlaying ? ytPlayer.playVideo() : ytPlayer.pauseVideo();
            isVideoSyncing = false;
        }
    });

    socket.on('videoStateUpdate', ({ action, payload }) => {
        if (!ytReady || isHost) return;
        isVideoSyncing = true;

        if (action === 'NEW_VIDEO') {
            document.getElementById('player-overlay').style.display = 'none';
            ytPlayer.loadVideoById(payload.videoId, 0);
        } else if (action === 'PLAY') {
            ytPlayer.seekTo(payload.currentTime);
            ytPlayer.playVideo();
        } else if (action === 'PAUSE') {
            ytPlayer.seekTo(payload.currentTime);
            ytPlayer.pauseVideo();
        } else if (action === 'SEEK') {
            ytPlayer.seekTo(payload.currentTime);
        }

        isVideoSyncing = false;
    });

    socket.on('kicked', () => {
        App.leaveRoom();
        App.showToast('You were removed by the host', 'error');
    });
};

App.createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(roomId, true);
};

App.joinRoom = () => {
    const roomId = document.getElementById('join-room-id').value.toUpperCase();
    if (!roomId) return App.showToast('Enter a Room ID', 'error');
    joinRoom(roomId, false);
};

const joinRoom = (roomId, hosting) => {
    currentRoom = roomId;
    isHost = hosting;

    document.getElementById('room-id-display').textContent = `Room: ${roomId}`;
    document.getElementById('host-controls').style.display = isHost ? 'flex' : 'none';
    document.getElementById('playback-controls').style.display = isHost ? 'flex' : 'none';
    document.getElementById('chat-messages').innerHTML = '';

    socket.emit('joinRoom', { roomId, username: currentUser.contact });
    App.showView('view-room');
};

App.leaveRoom = () => {
    if (socket) {
        // Just reconnecting to clear room state easily
        initSocket();
        currentRoom = null;
        isHost = false;
        if (ytPlayer && ytPlayer.stopVideo) {
            ytPlayer.stopVideo();
        }
        document.getElementById('player-overlay').style.display = 'flex';
        clearInterval(syncInterval);
        App.showView('view-dashboard');
    }
};

const updateMembersList = (members, hostId) => {
    document.getElementById('member-count').textContent = `(${members.length})`;
    const list = document.getElementById('member-list');
    list.innerHTML = '';

    members.forEach(m => {
        const li = document.createElement('li');
        const isMe = m.id === socket.id;
        let html = `<span>${m.name} ${isMe ? '(You)' : ''}</span>`;
        if (m.id === hostId) {
            html += `<span class="badge">HOST</span>`;
        } else if (isHost) {
            html += `<button class="kick-btn" onclick="app.kickMember('${m.id}')">Kick</button>`;
        }
        li.innerHTML = html;
        list.appendChild(li);
    });
};

App.kickMember = (socketId) => {
    if (isHost && currentRoom) {
        socket.emit('removeMember', { roomId: currentRoom, targetSocketId: socketId });
    }
};

// --- Library ---
const fetchLibrary = async () => {
    try {
        const res = await fetch('/api/library', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('mpot_token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            renderLibrary(data);
        }
    } catch (err) {
        console.error('Failed to fetch library', err);
    }
};

const renderLibrary = (songs) => {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    songs.forEach(song => {
        const li = document.createElement('li');

        let playBtnHTML = '';
        if (isHost) {
            playBtnHTML = `<button class="icon-btn text-pink tooltip" onclick="app.playFromLibrary('${song.videoId}')"><i class="fas fa-play"></i><span class="tooltiptext">Play</span></button>`;
        }

        li.innerHTML = `
            <div class="song-info">
                <span class="song-title">${song.title || 'Unknown Song'}</span>
            </div>
            <div class="song-actions">
                ${playBtnHTML}
                <button class="icon-btn text-danger tooltip" onclick="app.deleteFromLibrary(${song.id})"><i class="fas fa-trash"></i><span class="tooltiptext">Remove</span></button>
            </div>
        `;
        list.appendChild(li);
    });
};

App.saveCurrentToLibrary = async () => {
    if (!ytReady || !ytPlayer || !ytPlayer.getVideoData) {
        return App.showToast('No active video to save', 'error');
    }

    // Sometimes getVideoData is not fully populated if player isn't playing yet
    let videoData = {};
    try { videoData = ytPlayer.getVideoData(); } catch (e) { }

    const videoId = videoData.video_id;
    if (!videoId) return App.showToast('No video playing', 'error');

    let title = document.getElementById('lib-song-title').value.trim();
    if (!title) title = videoData.title || 'Saved Song';

    try {
        const res = await fetch('/api/library', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mpot_token')}`
            },
            body: JSON.stringify({ videoId, title })
        });

        if (res.ok) {
            App.showToast('Saved to library', 'success');
            document.getElementById('lib-song-title').value = '';
            fetchLibrary();
        } else {
            const data = await res.json();
            App.showToast(data.error || 'Failed to save', 'error');
        }
    } catch (err) {
        App.showToast('Server error', 'error');
    }
};

App.playFromLibrary = (videoId) => {
    if (!isHost || !currentRoom) return;

    document.getElementById('player-overlay').style.display = 'none';
    ytPlayer.loadVideoById(videoId, 0);
    socket.emit('videoAction', {
        roomId: currentRoom,
        action: 'NEW_VIDEO',
        payload: { videoId }
    });
    App.showToast('Playing from library', 'success');
};

App.deleteFromLibrary = async (id) => {
    try {
        const res = await fetch(`/api/library/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('mpot_token')}` }
        });
        if (res.ok) {
            App.showToast('Removed from library', 'success');
            fetchLibrary();
        }
    } catch (err) {
        App.showToast('Server error', 'error');
    }
};

// --- Chat ---
document.getElementById('form-chat').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg && currentRoom) {
        socket.emit('sendMessage', { roomId: currentRoom, message: msg, username: currentUser.contact });
        input.value = '';
    }
});

const appendChatMessage = ({ sender, text }) => {
    const chatContainer = document.getElementById('chat-messages');
    const div = document.createElement('div');

    if (sender === 'System') {
        div.className = 'chat-bubble system';
        div.textContent = text;
    } else {
        const isMe = sender === currentUser.contact;
        div.className = `chat-bubble ${isMe ? 'me' : ''}`;
        div.innerHTML = `<div class="sender">${isMe ? 'Me' : sender}</div><div>${text}</div>`;
    }

    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

// --- YouTube API ---
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'controls': 0, // Hide default controls
            'disablekb': 1,
            'rel': 0
        },
        events: {
            'onReady': () => { ytReady = true; },
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (!isHost || isVideoSyncing) return;

    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit('videoAction', {
            roomId: currentRoom,
            action: 'PLAY',
            payload: { currentTime: ytPlayer.getCurrentTime() }
        });
        startSyncInterval();
        updateUIPlayState(true);
    } else if (event.data === YT.PlayerState.PAUSED) {
        socket.emit('videoAction', {
            roomId: currentRoom,
            action: 'PAUSE',
            payload: { currentTime: ytPlayer.getCurrentTime() }
        });
        clearInterval(syncInterval);
        updateUIPlayState(false);
    }
}

// Host actions
App.loadVideo = () => {
    if (!isHost) return;
    const url = document.getElementById('youtube-url').value;
    const videoId = extractVideoID(url);

    if (videoId && ytReady) {
        document.getElementById('player-overlay').style.display = 'none';
        ytPlayer.loadVideoById(videoId, 0);
        socket.emit('videoAction', {
            roomId: currentRoom,
            action: 'NEW_VIDEO',
            payload: { videoId }
        });
    } else {
        App.showToast('Invalid YouTube URL', 'error');
    }
};

App.togglePlayPause = () => {
    if (!ytReady || !isHost) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
};

App.skip = (seconds) => {
    if (!ytReady || !isHost) return;
    const time = ytPlayer.getCurrentTime() + seconds;
    ytPlayer.seekTo(time);
    socket.emit('videoAction', {
        roomId: currentRoom,
        action: 'SEEK',
        payload: { currentTime: time }
    });
};

const slider = document.getElementById('time-slider');
slider.addEventListener('change', () => {
    if (!ytReady || !isHost) return;
    const duration = ytPlayer.getDuration();
    const seekTo = (slider.value / 100) * duration;
    ytPlayer.seekTo(seekTo);
    socket.emit('videoAction', {
        roomId: currentRoom,
        action: 'SEEK',
        payload: { currentTime: seekTo }
    });
});

const extractVideoID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// UI Updaters
const updateUIPlayState = (isPlaying) => {
    const btn = document.getElementById('btn-play-pause');
    btn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
};

const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const startSyncInterval = () => {
    clearInterval(syncInterval);
    syncInterval = setInterval(() => {
        if (ytReady && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
            const current = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();

            document.getElementById('current-time').textContent = formatTime(current);
            document.getElementById('total-time').textContent = formatTime(duration);

            if (duration > 0 && isHost) {
                document.getElementById('time-slider').value = (current / duration) * 100;
            }
        }
    }, 1000);
};
