// ─── Page router ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'auth')   initAuth();
    if (page === 'home')   initHome();
    if (page === 'result') initResult();
});

// ─── Route guards ─────────────────────────────────────────────────────────────
function requireAuth() {
    if (!localStorage.getItem('token')) {
        window.location.replace('/index.html');
    }
}

function redirectIfAuthed() {
    if (localStorage.getItem('token')) {
        window.location.replace('/home.html');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH PAGE
// ═════════════════════════════════════════════════════════════════════════════

function initAuth() {
    redirectIfAuthed();

    document.getElementById('login-tab').addEventListener('click', () => showTab('login'));
    document.getElementById('register-tab').addEventListener('click', () => showTab('register'));

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await register(
            document.getElementById('reg-email').value,
            document.getElementById('reg-password').value
        );
    });
}

function showTab(tab) {
    const isLogin = tab === 'login';

    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('register-form').classList.toggle('hidden', isLogin);

    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    loginTab.classList.toggle('text-slate-300', isLogin);
    loginTab.classList.toggle('border-slate-400', isLogin);
    loginTab.classList.toggle('text-zinc-500', !isLogin);
    loginTab.classList.toggle('border-transparent', !isLogin);
    registerTab.classList.toggle('text-slate-300', !isLogin);
    registerTab.classList.toggle('border-slate-400', !isLogin);
    registerTab.classList.toggle('text-zinc-500', isLogin);
    registerTab.classList.toggle('border-transparent', isLogin);

    document.getElementById('auth-error').textContent = '';
}

async function login(email, password) {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        // Guard against non-JSON responses (e.g. 502 HTML error page from Nginx)
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Invalid credentials');
        localStorage.setItem('token', data.token);
        window.location.href = '/home.html';
    } catch (e) {
        errEl.textContent = e.message || 'Server unreachable — please try again.';
    }
}

async function register(email, password) {
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Registration failed');
        localStorage.setItem('token', data.token);
        window.location.href = '/home.html';
    } catch (e) {
        errEl.textContent = e.message || 'Server unreachable — please try again.';
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═════════════════════════════════════════════════════════════════════════════

let selectedFile = null;

function initHome() {
    requireAuth();

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('analyze-btn').addEventListener('click', () => {
        if (selectedFile) analyze(selectedFile);
    });

    initDropZone();
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

// ─── Drop zone ───────────────────────────────────────────────────────────────
function initDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', (e) => {
        // Don't re-open dialog when clicking the preview image inside the zone
        if (e.target === dropZone || e.target.id === 'drop-hint' || e.target.closest('#drop-hint')) {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
}

function handleFile(file) {
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showUploadError('Only JPEG and PNG files are accepted.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showUploadError('File must be under 10MB.');
        return;
    }

    selectedFile = file;
    document.getElementById('upload-error').textContent = '';
    showPreview(file);
}

function showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const src = e.target.result;

        const previewImg = document.getElementById('preview-img');
        previewImg.src = src;
        previewImg.classList.remove('hidden');

        document.getElementById('drop-hint').classList.add('hidden');
        document.getElementById('analyze-btn').disabled = false;

        // Store original image src for result page
        sessionStorage.setItem('originalImageSrc', src);
    };
    reader.readAsDataURL(file);
}

function showUploadError(msg) {
    document.getElementById('upload-error').textContent = msg;
}

// ─── Analyze ─────────────────────────────────────────────────────────────────
async function analyze(file) {
    setLoading(true);

    // Guard: token should always exist here (requireAuth runs on page load),
    // but if localStorage was cleared mid-session, redirect cleanly.
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const form = new FormData();
    form.append('file', file);

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });

        if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
            return;
        }
        if (!res.ok) throw new Error('Analysis failed — please try again.');

        // Guard against malformed JSON or missing fields from the server
        const result = await res.json().catch(() => null);
        if (!result || result.score == null || !result.label || !result.gradcamB64) {
            throw new Error('Unexpected response from server — please try again.');
        }

        // Persist result and navigate to dedicated result page
        sessionStorage.setItem('analysisResult', JSON.stringify(result));
        window.location.href = '/result.html';
    } catch (e) {
        showUploadError(e.message || 'Server unreachable — please try again.');
        setLoading(false);
    }
}

function setLoading(on) {
    document.getElementById('analyze-btn').disabled = on;
    document.getElementById('loading-spinner').classList.toggle('hidden', !on);
}

// ═════════════════════════════════════════════════════════════════════════════
// RESULT PAGE
// ═════════════════════════════════════════════════════════════════════════════

const HALF_CIRC = Math.PI * 54; // 169.646

function initResult() {
    requireAuth();

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    const raw = sessionStorage.getItem('analysisResult');
    const originalSrc = sessionStorage.getItem('originalImageSrc');

    // If someone lands here directly without a result, send them back
    if (!raw) {
        window.location.replace('/home.html');
        return;
    }

    let result;
    try {
        result = JSON.parse(raw);
    } catch {
        window.location.replace('/home.html');
        return;
    }

    renderResult(result, originalSrc);
}

function renderResult({ score, label, confidence, gradcamB64 }, originalSrc) {
    // GradCAM overlay
    document.getElementById('gradcam-img').src = `data:image/jpeg;base64,${gradcamB64}`;

    // Original image
    if (originalSrc) {
        document.getElementById('original-preview').src = originalSrc;
    }

    // Verdict
    const verdict = document.getElementById('verdict');
    verdict.textContent = label;
    verdict.className = 'text-5xl font-black tracking-widest mb-1 ' + labelColor(score);

    // Verdict badge
    const badge = document.getElementById('verdict-badge');
    badge.textContent = label;
    badge.className = 'px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-3 ' + badgeClass(score);

    // Confidence
    document.getElementById('confidence-pct').textContent = `${confidence}% confidence`;

    // Score bar + label
    const pct = Math.round(score * 100);
    document.getElementById('score-pct').textContent = `${pct}%`;
    setTimeout(() => {
        document.getElementById('score-bar').style.width = `${pct}%`;
        document.getElementById('score-bar').className =
            'h-full rounded-full transition-all duration-1000 ' + scoreBarColor(score);
    }, 60);

    // Concern line
    document.getElementById('concern-line').textContent = concernText(score);
}

function labelColor(score) {
    if (score > 0.7) return 'text-red-500';
    if (score > 0.3) return 'text-slate-300';
    return 'text-green-500';
}

function badgeClass(score) {
    if (score > 0.7) return 'bg-red-950 text-red-400 border border-red-900';
    if (score > 0.3) return 'bg-slate-800 text-slate-300 border border-slate-700';
    return 'bg-green-950 text-green-400 border border-green-900';
}

function scoreBarColor(score) {
    if (score > 0.7) return 'bg-red-500';
    if (score > 0.3) return 'bg-slate-400';
    return 'bg-green-500';
}

function concernText(score) {
    if (score > 0.9)  return 'Strong indicators of AI manipulation detected. This image is very likely synthetically generated or heavily altered.';
    if (score > 0.7)  return 'Multiple signs of deepfake synthesis found. Exercise caution before sharing or trusting this image.';
    if (score > 0.5)  return 'Some inconsistencies detected. The image may have been partially manipulated or processed.';
    if (score > 0.3)  return 'Results are inconclusive. The model could not confidently determine authenticity — review carefully.';
    if (score > 0.1)  return 'No significant manipulation detected. This image appears to be authentic.';
    return 'High confidence this is a genuine, unaltered image with no signs of AI generation.';
}
