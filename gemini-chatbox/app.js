/* ══════════════════════════════════════════════════════════════════════════
   Gemini Claude Studio — app.js
   Interactive Artifacts, Live Code Sandbox, Deep Thinking, Custom MCP Studio & Multi-Chat
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

// ── API Configuration ──────────────────────────────────────────────────
const BACKEND_ORIGIN = (window.location.protocol.startsWith('http') && (window.location.port === '5000' || window.location.port === ''))
    ? window.location.origin
    : 'http://127.0.0.1:5000';
const API_BASE = `${BACKEND_ORIGIN}/api`;
const CHAT_URL = `${API_BASE}/chat`;
const SESSIONS_URL = `${API_BASE}/sessions`;
const UPLOAD_URL = `${API_BASE}/upload`;
const PERM_STATUS_URL = `${API_BASE}/permission-status`;
const PERM_GRANT_URL = `${API_BASE}/grant-permission`;
const RAG_STATUS_URL = `${API_BASE}/rag/status`;
const MCP_SERVERS_URL = `${API_BASE}/mcp/servers`;
const MCP_PRESETS_URL = `${API_BASE}/mcp/presets`;
const MCP_IMPORT_URL = `${API_BASE}/mcp/import`;
const USER_PROFILE_URL = `${API_BASE}/user/profile`;
const ONBOARD_ANALYSIS_URL = `${API_BASE}/user/onboard-analysis`;

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Application State ──────────────────────────────────────────────────
let currentSessionId = generateUUID(); // Fresh session generated on every app start/restart
let currentMessages = [];
let allSessions = [];
let attachedFiles = [];
let currentArtifact = null;
let projectInstructions = localStorage.getItem('gemini_project_instructions') || '';
let mcpServersList = [];
let mcpPresetsList = [];
let deepDecompose = true;
let bestOfBestMode = localStorage.getItem('b1_best_of_best') !== 'false';
let userProfile = {
    user_name: '',
    role: '',
    communication_style: 'Clear, concise, highly proactive, senior-level engineering advice',
    theme: localStorage.getItem('b1_studio_theme') || 'linear-obsidian',
    archetype: 'Senior Architect',
    stack: []
};
let currentOnboardStep = 1;
let onboardDraft = { ...userProfile };

// ── DOM References ─────────────────────────────────────────────────────
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesFeed = document.getElementById('messages-feed');
const welcomeScreen = document.getElementById('welcome-screen');
const chatViewport = document.getElementById('chat-viewport');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const newChatBtn = document.getElementById('new-chat-btn');
const activeChatTitle = document.getElementById('active-chat-title');
const modelSelector = document.getElementById('model-selector');

// ── Models Registry & Switcher (Official Google Models) ─────────────────────
const ALL_MODELS = [
    {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        group: 'Official Google Frontier',
        badge: 'Recommended',
        badgeClass: 'fast',
        desc: 'Official high-speed production model. Sub-second latency, multimodal reasoning & instant tool calls.',
        tags: ['Sub-second', 'Workhorse', 'Recommended']
    },
    {
        id: 'gemini-2.0-flash-thinking-exp-01-21',
        name: 'Gemini 2.0 Flash Thinking',
        group: 'Official Google Frontier',
        badge: 'Thinking',
        badgeClass: 'thinking',
        desc: 'Dedicated Chain-of-Thought reasoning engine. Generates transparent step-by-step logic traces before synthesis.',
        tags: ['Deep CoT', 'Logic Verified', 'Mode 2']
    },
    {
        id: 'gemini-2.0-pro-exp-02-05',
        name: 'Gemini 2.0 Pro Exp',
        group: 'Official Google Frontier',
        badge: 'Pro',
        badgeClass: 'pro',
        desc: 'Google flagship frontier model for maximum reasoning depth, complex software architecture & code generation.',
        tags: ['Deep Reasoning', 'Architecture', 'Frontier']
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        group: 'Official Google Frontier',
        badge: 'Pro+',
        badgeClass: 'pro',
        desc: 'State-of-the-art frontier model for intricate systems engineering and advanced problem solving.',
        tags: ['State-of-the-Art', 'Next-Gen', 'Frontier']
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        group: 'Official Google Frontier',
        badge: '2M Ctx',
        badgeClass: 'pro',
        desc: 'Industry-leading 2-million-token context window for full-repo analysis and long technical documents.',
        tags: ['2M Context', 'Full Repo', 'Enterprise']
    },
    {
        id: 'gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash Lite',
        group: 'Official Google Frontier',
        badge: 'Fast',
        badgeClass: 'fast',
        desc: 'Ultralight low-cost model optimized for edge devices, instant responses, and high throughput.',
        tags: ['Ultralight', 'Instant', 'Edge']
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        group: 'Official Google Frontier',
        badge: 'Fast',
        badgeClass: 'fast',
        desc: 'Proven workhorse model for general tasks, rapid text analysis, and streaming.',
        tags: ['Reliable', 'Multimodal', 'Balanced']
    }
];

function getSelectedModelId() {
    const saved = localStorage.getItem('gemini_selected_model');
    if (saved && ALL_MODELS.some(m => m.id === saved)) return saved;
    if (modelSelector && modelSelector.value && ALL_MODELS.some(m => m.id === modelSelector.value)) return modelSelector.value;
    return 'gemini-2.0-flash';
}

function updateModelLabels() {
    const currentId = getSelectedModelId();
    const modelObj = ALL_MODELS.find(m => m.id === currentId) || ALL_MODELS[0];

    const topbarLabel = document.getElementById('model-btn-label');
    const topbarChip = document.getElementById('model-badge-chip');
    const composerLabel = document.getElementById('composer-model-label');
    const footerStatus = document.getElementById('model-footer-status');

    if (topbarLabel) topbarLabel.textContent = modelObj.name;
    if (topbarChip) {
        topbarChip.textContent = modelObj.badge;
        topbarChip.className = `model-badge-chip ${modelObj.badgeClass}`;
    }
    if (composerLabel) composerLabel.textContent = modelObj.name;
    if (footerStatus) footerStatus.textContent = `Current: ${modelObj.name}`;
}

function selectModel(modelId, notify = true) {
    const modelObj = ALL_MODELS.find(m => m.id === modelId) || ALL_MODELS[0];
    localStorage.setItem('gemini_selected_model', modelObj.id);
    if (modelSelector) {
        if (!Array.from(modelSelector.options).some(o => o.value === modelObj.id)) {
            const opt = document.createElement('option');
            opt.value = modelObj.id;
            opt.textContent = modelObj.name;
            modelSelector.appendChild(opt);
        }
        modelSelector.value = modelObj.id;
    }
    updateModelLabels();
    renderModelCards();
    closeModelSwitchModal();

    if (notify) {
        showToast(`✦ Switched AI Model to: ${modelObj.name}`, 'success');
    }
}

function openModelSwitchModal() {
    const modal = document.getElementById('model-switcher-modal');
    if (!modal) return;
    renderModelCards();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const searchIn = document.getElementById('model-search-input');
    if (searchIn) {
        searchIn.value = '';
        setTimeout(() => searchIn.focus(), 50);
    }
}

function closeModelSwitchModal() {
    const modal = document.getElementById('model-switcher-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function filterModelCards(query) {
    renderModelCards(query);
}

function renderModelCards(filter = '') {
    const container = document.getElementById('model-cards-container');
    if (!container) return;

    const currentId = getSelectedModelId();
    const query = (filter || '').toLowerCase().trim();

    const filtered = ALL_MODELS.filter(m => {
        if (!query) return true;
        return m.name.toLowerCase().includes(query) ||
               m.id.toLowerCase().includes(query) ||
               m.badge.toLowerCase().includes(query) ||
               m.desc.toLowerCase().includes(query) ||
               m.tags.some(t => t.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding:32px 16px; text-align:center; color:var(--ink-tertiary); font-size:13px;">
                No AI models found matching "<strong>${escapeHtml(filter)}</strong>"
            </div>
        `;
        return;
    }

    const groups = {};
    filtered.forEach(m => {
        const g = m.group || 'Available Models';
        if (!groups[g]) groups[g] = [];
        groups[g].push(m);
    });

    let html = '';
    for (const [groupName, models] of Object.entries(groups)) {
        html += `<div class="model-group-title">${escapeHtml(groupName)}</div>`;
        models.forEach(m => {
            const isActive = m.id === currentId;
            html += `
                <div class="model-card-item ${isActive ? 'active' : ''}" onclick="selectModel('${m.id}')" tabindex="0" role="button" aria-pressed="${isActive}">
                    <div class="model-card-left">
                        <div class="model-card-header-row">
                            <span class="model-card-name">${escapeHtml(m.name)}</span>
                            <span class="model-card-badge ${m.badgeClass}">${escapeHtml(m.badge)}</span>
                        </div>
                        <div class="model-card-tagline">${escapeHtml(m.desc)}</div>
                        <div class="model-card-tags">
                            ${m.tags.map(t => `<span class="model-card-tag">${escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="model-card-right">
                        ${isActive ? `
                            <div class="model-active-check" title="Active Model">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                        ` : `
                            <div class="model-select-radio"></div>
                        `}
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

// Global exports
window.openModelSwitchModal = openModelSwitchModal;
window.closeModelSwitchModal = closeModelSwitchModal;
window.selectModel = selectModel;
window.filterModelCards = filterModelCards;

if (modelSelector) {
    let savedModel = localStorage.getItem('gemini_selected_model') || 'gemini-2.0-flash';
    if (savedModel.includes('3.') || !ALL_MODELS.some(m => m.id === savedModel)) {
        savedModel = 'gemini-2.0-flash';
        localStorage.setItem('gemini_selected_model', savedModel);
    }
    if (!Array.from(modelSelector.options).some(o => o.value === savedModel)) {
        const opt = document.createElement('option');
        opt.value = savedModel;
        opt.textContent = (ALL_MODELS.find(m => m.id === savedModel) || {}).name || savedModel;
        modelSelector.appendChild(opt);
    }
    modelSelector.value = savedModel;
    updateModelLabels();
    modelSelector.addEventListener('change', () => {
        selectModel(modelSelector.value, false);
    });
}
const targetFolderInput = document.getElementById('target-folder-input');
const sessionsList = document.getElementById('sessions-list');
const chatSearchInput = document.getElementById('chat-search-input');
const attachmentsBar = document.getElementById('attachments-bar');
const attachFileBtn = document.getElementById('attach-file-btn');
const fileUploadInput = document.getElementById('file-upload-input');
const agentLoopText = document.getElementById('agent-loop-text');

// MCP Hub DOM
const openMcpBtn = document.getElementById('open-mcp-btn');
const topbarMcpBtn = document.getElementById('topbar-mcp-btn');
const topbarMcpLabel = document.getElementById('topbar-mcp-label');
const mcpHubBtnLabel = document.getElementById('mcp-hub-btn-label');
const mcpModal = document.getElementById('mcp-modal');
const closeMcpModal = document.getElementById('close-mcp-modal');
const closeMcpBtn = document.getElementById('close-mcp-btn');
const mcpServerListEl = document.getElementById('mcp-server-list');
const mcpActiveBadge = document.getElementById('mcp-active-badge');
const mcpNameInput = document.getElementById('mcp-name-input');
const mcpCmdInput = document.getElementById('mcp-cmd-input');
const mcpArgsInput = document.getElementById('mcp-args-input');
const mcpEnvInput = document.getElementById('mcp-env-input');
const mcpAddBtn = document.getElementById('mcp-add-btn');
const mcpPresetsGrid = document.getElementById('mcp-presets-grid');
const mcpJsonTextarea = document.getElementById('mcp-json-textarea');
const mcpImportJsonBtn = document.getElementById('mcp-import-json-btn');

// MCP Tabs
const mcpTabActiveBtn = document.getElementById('mcp-tab-active-btn');
const mcpTabAddBtn = document.getElementById('mcp-tab-add-btn');
const mcpTabPresetsBtn = document.getElementById('mcp-tab-presets-btn');
const mcpTabJsonBtn = document.getElementById('mcp-tab-json-btn');
const mcpPanelActive = document.getElementById('mcp-panel-active');
const mcpPanelAdd = document.getElementById('mcp-panel-add');
const mcpPanelPresets = document.getElementById('mcp-panel-presets');
const mcpPanelJson = document.getElementById('mcp-panel-json');

// Artifact Drawer DOM
const artifactDrawer = document.getElementById('artifact-drawer');
const toggleArtifactPaneBtn = document.getElementById('toggle-artifact-pane-btn');
const artifactToggleBadge = document.getElementById('artifact-toggle-badge');
const artHeaderTitle = document.getElementById('art-header-title');
const artHeaderBadge = document.getElementById('art-header-badge');
const artHeaderIcon = document.getElementById('art-header-icon');
const tabPreviewBtn = document.getElementById('tab-preview-btn');
const tabCodeBtn = document.getElementById('tab-code-btn');
const tabConsoleBtn = document.getElementById('tab-console-btn');
const panePreview = document.getElementById('pane-preview');
const paneCode = document.getElementById('pane-code');
const paneConsole = document.getElementById('pane-console');
const artPreviewFrame = document.getElementById('art-preview-frame');
const artCodeBlock = document.getElementById('art-code-block');
const consoleLogsList = document.getElementById('console-logs-list');
const consoleCountBadge = document.getElementById('console-count-badge');
const clearConsoleBtn = document.getElementById('clear-console-btn');
const artCopyBtn = document.getElementById('art-copy-btn');
const artDownloadBtn = document.getElementById('art-download-btn');
const artPopoutBtn = document.getElementById('art-popout-btn');
const artCloseBtn = document.getElementById('art-close-btn');

// Instructions Modal DOM
const openInstructionsBtn = document.getElementById('open-instructions-btn');
const instructionsModal = document.getElementById('instructions-modal');
const closeInstructionsModal = document.getElementById('close-instructions-modal');
const projectInstructionsTextarea = document.getElementById('project-instructions-textarea');
const saveInstructionsBtn = document.getElementById('save-instructions-btn');
const cancelInstructionsBtn = document.getElementById('cancel-instructions-btn');

// Permission Modal DOM
const permOverlay = document.getElementById('perm-overlay');
const permAllowBtn = document.getElementById('perm-allow-btn');
const permDenyBtn = document.getElementById('perm-deny-btn');
const permStatusMsg = document.getElementById('perm-status-msg');

// ── Initialization ─────────────────────────────────────────────────────
function initApp() {
    loadUserProfile();
    setGreeting();
    startNewChat(false); // ALWAYS start with a fresh new chat session on start/restart!
    loadSessions(false); // Populate sidebar without auto-loading previous chat
    checkPermissions();
    checkRagStatus();
    loadMcpServers();
    loadMcpPresets();
    setupEventListeners();
    setupMarkedParser();
    initMermaidEngine();
    setupConsoleSandboxBridge();

    // Auto-launch Onboarding & Permissions flow ONLY on fresh first start without profile
    if (!localStorage.getItem('b1_onboarding_completed') && (!userProfile || !userProfile.user_name)) {
        setTimeout(() => openOnboardingModal(1), 350);
    } else {
        localStorage.setItem('b1_onboarding_completed', 'true');
    }
}

// ── User Profile & Studio Themes ─────────────────────────────────────────
function applyTheme(themeName) {
    if (!themeName) themeName = 'linear-obsidian';
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('b1_studio_theme', themeName);
    userProfile.theme = themeName;
}

async function loadUserProfile() {
    try {
        const res = await fetch(USER_PROFILE_URL);
        const data = await res.json();
        if (data.status === 'success' && data.profile) {
            userProfile = { ...userProfile, ...data.profile };
            if (!userProfile.user_name || userProfile.user_name.trim() === '') {
                localStorage.removeItem('b1_onboarding_completed');
                setTimeout(() => openOnboardingModal(1), 350);
            }
            if (userProfile.theme) {
                applyTheme(userProfile.theme);
            }
            updateUserUI();
        }
    } catch (e) {
        console.warn('Could not load user profile:', e);
    }
}

function updateUserUI() {
    const avatarBtn = document.getElementById('user-avatar-btn');
    const nameEl = document.getElementById('dropdown-user-name');
    const roleEl = document.getElementById('dropdown-user-role');
    const welcomeTitleEl = document.getElementById('welcome-title');

    const name = userProfile.user_name || '';
    const role = userProfile.role || 'New Explorer';

    if (avatarBtn) {
        const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '+';
        avatarBtn.textContent = initials;
        avatarBtn.title = name ? `${name} (${role})` : 'Click to Set Up Profile';
    }
    if (nameEl) nameEl.textContent = name || 'Get Started';
    if (roleEl) roleEl.textContent = role;
    if (welcomeTitleEl) {
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const firstName = name ? name.split(' ')[0] : 'Developer';
        welcomeTitleEl.textContent = `${greet}, ${firstName}`;
    }
}

async function deleteUserProfileAndReset() {
    try {
        await fetch(USER_PROFILE_URL, { method: 'DELETE' });
        localStorage.removeItem('b1_onboarding_completed');
        localStorage.removeItem('b1_user_name');
        userProfile = {
            user_name: '',
            role: '',
            communication_style: '',
            theme: 'linear-obsidian',
            archetype: 'Senior Architect',
            stack: []
        };
        updateUserUI();
        openOnboardingModal(1);
        showToast('Profile reset. Starting fresh from beginning!', 'info');
    } catch (e) {
        console.error('Failed to reset profile:', e);
    }
}
window.deleteUserProfileAndReset = deleteUserProfileAndReset;

async function saveUserProfile(dataToSave) {
    try {
        const res = await fetch(USER_PROFILE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        const d = await res.json();
        if (d.status === 'success') {
            userProfile = { ...userProfile, ...d.profile };
            updateUserUI();
        }
    } catch (e) {
        console.error('Error saving profile:', e);
    }
}

// ── Global System & Device Permissions State ───────────────────────────
let b1Permissions = JSON.parse(localStorage.getItem('b1_system_permissions') || JSON.stringify({
    mic: 'granted',        // Microphone & Voice Dictation
    camera: 'granted',     // Camera, Computer Vision & Optical Gestures
    notifications: 'granted', // Desktop Pipeline & Agent Alerts
    clipboard: 'granted',  // 1-Click Code Copy & Paste
    terminal: 'granted',   // Local Shell, PowerShell, Python Execution Sandbox
    filesystem: 'granted', // Workspace File Reading & Multi-File Tree
    mcp_network: 'granted',// MCP Servers & Web Tools Protocol
    messaging: 'granted'   // WhatsApp, Teams, Discord Connectors
}));

window.requestBrowserPermission = function(permKey) {
    if (permKey === 'mic') {
        b1Permissions.mic = b1Permissions.mic === 'granted' ? 'pending' : 'granted';
        if (b1Permissions.mic === 'granted' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(s => s.getTracks().forEach(t => t.stop()))
                .catch(() => {});
        }
        showToast(`🎙️ Microphone permission ${b1Permissions.mic}`, b1Permissions.mic === 'granted' ? 'success' : 'info');
    } else if (permKey === 'camera') {
        b1Permissions.camera = b1Permissions.camera === 'granted' ? 'pending' : 'granted';
        if (b1Permissions.camera === 'granted' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => s.getTracks().forEach(t => t.stop()))
                .catch(() => {});
        }
        showToast(`📹 Camera permission ${b1Permissions.camera}`, b1Permissions.camera === 'granted' ? 'success' : 'info');
    } else if (permKey === 'notifications') {
        b1Permissions.notifications = b1Permissions.notifications === 'granted' ? 'pending' : 'granted';
        if (b1Permissions.notifications === 'granted' && 'Notification' in window) {
            try { Notification.requestPermission().catch(() => {}); } catch(e){}
        }
        showToast(`🔔 Notification permission ${b1Permissions.notifications}`, b1Permissions.notifications === 'granted' ? 'success' : 'info');
    } else if (permKey === 'clipboard') {
        b1Permissions.clipboard = b1Permissions.clipboard === 'granted' ? 'pending' : 'granted';
        showToast(`📋 Clipboard permission ${b1Permissions.clipboard}`, b1Permissions.clipboard === 'granted' ? 'success' : 'info');
    } else {
        b1Permissions[permKey] = b1Permissions[permKey] === 'granted' ? 'blocked' : 'granted';
        showToast(`${permKey.toUpperCase()} permission ${b1Permissions[permKey]}`, b1Permissions[permKey] === 'granted' ? 'success' : 'info');
    }

    localStorage.setItem('b1_system_permissions', JSON.stringify(b1Permissions));
    if (currentOnboardStep === 4) {
        renderOnboardStep(4);
    }
};

window.requestAllPermissions = function() {
    // 1. Mark all permissions granted
    b1Permissions.mic = 'granted';
    b1Permissions.camera = 'granted';
    b1Permissions.notifications = 'granted';
    b1Permissions.clipboard = 'granted';
    b1Permissions.terminal = 'granted';
    b1Permissions.filesystem = 'granted';
    b1Permissions.mcp_network = 'granted';
    b1Permissions.messaging = 'granted';

    // 2. Trigger browser permission requests non-blockingly
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(s => s.getTracks().forEach(t => t.stop()))
            .catch(() => {});
    }
    if ('Notification' in window) {
        try { Notification.requestPermission().catch(() => {}); } catch(e){}
    }

    localStorage.setItem('b1_system_permissions', JSON.stringify(b1Permissions));
    showToast('✦ All System & Device Permissions Authorized!', 'success', 2500);

    if (currentOnboardStep === 4) {
        renderOnboardStep(4);
    }
};

// ── Interactive Conversational Onboarding / Sign-Up Flow ─────────────────
function openOnboardingModal(step = 1) {
    currentOnboardStep = step;
    onboardDraft = { ...userProfile };
    if (!onboardDraft.archetype) onboardDraft.archetype = 'Senior Architect';
    if (!onboardDraft.theme) onboardDraft.theme = localStorage.getItem('b1_studio_theme') || 'linear-obsidian';
    
    // Close user dropdown if open
    document.getElementById('user-dropdown-menu')?.classList.remove('show');
    
    const modal = document.getElementById('onboard-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderOnboardStep(currentOnboardStep);
    }
}

function closeOnboardingModal() {
    const modal = document.getElementById('onboard-modal');
    if (modal) modal.style.display = 'none';
}

function renderOnboardStep(step) {
    const onboardStepPill = document.getElementById('onboard-step-pill');
    const onboardBody = document.getElementById('onboard-body');
    const onboardBackBtn = document.getElementById('onboard-back-btn');
    const onboardNextLabel = document.getElementById('onboard-next-label');

    if (onboardStepPill) onboardStepPill.textContent = `Step ${step} of 6`;
    
    document.querySelectorAll('.onboard-step-dot').forEach((dot, idx) => {
        const dotStep = idx + 1;
        dot.classList.toggle('active', dotStep === step);
        dot.classList.toggle('completed', dotStep < step);
    });

    if (onboardBackBtn) onboardBackBtn.style.visibility = step > 1 ? 'visible' : 'hidden';

    if (step === 1) {
        if (onboardNextLabel) onboardNextLabel.textContent = "Let's Personalize →";
        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>Hello! I am <strong>B1</strong>, your personal autonomous coding partner and systems architect.</p>
                    <p style="margin-top:8px;">I can create interactive web apps, refactor code, search your repos with MCP tools, run terminal scripts, and remember your technical preferences with zero hallucinations.</p>
                    <p style="margin-top:8px; color:var(--ink-muted);">Let's tailor your workspace in 5 quick interactive steps so I communicate, code, and authorize tools exactly how you like.</p>
                </div>
            </div>
        `;
    } else if (step === 2) {
        if (onboardNextLabel) onboardNextLabel.textContent = "Continue to Thinking →";
        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>What is your name and what domain do you primarily build in?</p>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
                <div>
                    <label style="font-size:12px; font-weight:600; color:var(--ink-subtle); display:block; margin-bottom:6px;">Your Name / Handle</label>
                    <input type="text" id="onboard-name-input" class="folder-input" value="${escapeHtml(onboardDraft.user_name || 'Ishaan Sen')}" style="width:100%; padding:10px 12px; font-size:14px; background:var(--surface-2); border:1px solid var(--hairline-strong); border-radius:var(--r-md); color:var(--ink);">
                </div>
                <div>
                    <label style="font-size:12px; font-weight:600; color:var(--ink-subtle); display:block; margin-bottom:6px;">Primary Focus & Role</label>
                    <div class="onboard-choices-grid">
                        <div class="choice-chip-card ${(onboardDraft.role || '').includes('Architect') || (onboardDraft.role || '').includes('Lead') ? 'selected' : ''}" onclick="selectOnboardRole(this, 'Lead Developer & AI Architect')">
                            <span class="choice-chip-title">🚀 Systems & AI Architect</span>
                            <span class="choice-chip-desc">Autonomous agents, microcontrollers, frontier AI tools</span>
                        </div>
                        <div class="choice-chip-card ${(onboardDraft.role || '').includes('Full-Stack') ? 'selected' : ''}" onclick="selectOnboardRole(this, 'Full-Stack Web Engineer')">
                            <span class="choice-chip-title">💻 Full-Stack Engineer</span>
                            <span class="choice-chip-desc">React, Node, Python backends, and modern web apps</span>
                        </div>
                        <div class="choice-chip-card ${(onboardDraft.role || '').includes('Autonomous') ? 'selected' : ''}" onclick="selectOnboardRole(this, 'Autonomous Agent Builder')">
                            <span class="choice-chip-title">⚡ Agentic AI Builder</span>
                            <span class="choice-chip-desc">MCP servers, LangChain, crew AI, multi-agent flows</span>
                        </div>
                        <div class="choice-chip-card ${(onboardDraft.role || '').includes('Research') ? 'selected' : ''}" onclick="selectOnboardRole(this, 'Algorithmic Researcher')">
                            <span class="choice-chip-title">🔬 Deep Researcher</span>
                            <span class="choice-chip-desc">PyTorch, data science, algorithms, mathematical models</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (step === 3) {
        if (onboardNextLabel) onboardNextLabel.textContent = "Continue to Permissions →";
        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>How would you like me to think and communicate with you during coding sessions?</p>
                </div>
            </div>
            <div class="onboard-choices-grid" style="grid-template-columns:1fr; margin-top:8px;">
                <div class="choice-chip-card ${onboardDraft.archetype === 'Senior Architect' ? 'selected' : ''}" onclick="selectOnboardArchetype(this, 'Senior Architect', 'Clear, concise, highly proactive, senior-level engineering advice')">
                    <span class="choice-chip-title">🚀 Senior Architect (Recommended)</span>
                    <span class="choice-chip-desc">Proactive, concise, zero unneeded boilerplate. Solves problems directly with clean code and high velocity.</span>
                </div>
                <div class="choice-chip-card ${onboardDraft.archetype === 'Deep Mentor' ? 'selected' : ''}" onclick="selectOnboardArchetype(this, 'Deep Mentor', 'In-depth explanations of trade-offs, architecture patterns, and detailed guidance')">
                    <span class="choice-chip-title">🧠 Deep Mentor</span>
                    <span class="choice-chip-desc">Explains architectural trade-offs, step-by-step reasoning, and best practice design choices.</span>
                </div>
                <div class="choice-chip-card ${onboardDraft.archetype === 'Rapid Hacker' ? 'selected' : ''}" onclick="selectOnboardArchetype(this, 'Rapid Hacker', 'Ultra-concise, code-first solutions with minimal commentary')">
                    <span class="choice-chip-title">⚡ Rapid Hacker</span>
                    <span class="choice-chip-desc">Code-first, minimal chatter. Delivers copy-paste ready scripts and instant diffs.</span>
                </div>
            </div>
        `;
    } else if (step === 4) {
        if (onboardNextLabel) onboardNextLabel.textContent = "Continue to Themes →";
        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>To assist you autonomously, execute code, visualize live webcam feeds, recognize voice prompts, and dispatch pipeline notifications, B1 requires authorization for the following system and browser capabilities.</p>
                </div>
            </div>

            <div class="onboard-permissions-container">
                <div class="onboard-grant-all-strip">
                    <div class="grant-all-text">
                        <strong>System & Device Authorization</strong>
                        <span>One-click allow all tools for seamless autonomous development</span>
                    </div>
                    <button class="grant-all-btn" onclick="requestAllPermissions()">
                        <span>✦ Grant All Permissions</span>
                    </button>
                </div>

                <div class="permissions-bento-grid">
                    <!-- 1. Microphone -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">🎙️</div>
                            <div class="perm-details">
                                <span class="perm-name">Microphone & Voice</span>
                                <span class="perm-desc">Voice dictation & speech prompts</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.mic === 'granted' ? 'granted' : (b1Permissions.mic === 'blocked' ? 'blocked' : 'pending')}" onclick="requestBrowserPermission('mic')">
                            ${b1Permissions.mic === 'granted' ? 'Granted ✓' : (b1Permissions.mic === 'blocked' ? 'Blocked ✕' : 'Allow')}
                        </button>
                    </div>

                    <!-- 2. Camera -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">📹</div>
                            <div class="perm-details">
                                <span class="perm-name">Camera & Vision</span>
                                <span class="perm-desc">Webcam ML artifacts & optical gestures</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.camera === 'granted' ? 'granted' : (b1Permissions.camera === 'blocked' ? 'blocked' : 'pending')}" onclick="requestBrowserPermission('camera')">
                            ${b1Permissions.camera === 'granted' ? 'Granted ✓' : (b1Permissions.camera === 'blocked' ? 'Blocked ✕' : 'Allow')}
                        </button>
                    </div>

                    <!-- 3. Desktop Notifications -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">🔔</div>
                            <div class="perm-details">
                                <span class="perm-name">Notifications</span>
                                <span class="perm-desc">Background agent & pipeline alerts</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.notifications === 'granted' ? 'granted' : (b1Permissions.notifications === 'blocked' ? 'blocked' : 'pending')}" onclick="requestBrowserPermission('notifications')">
                            ${b1Permissions.notifications === 'granted' ? 'Granted ✓' : (b1Permissions.notifications === 'blocked' ? 'Blocked ✕' : 'Allow')}
                        </button>
                    </div>

                    <!-- 4. Clipboard -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">📋</div>
                            <div class="perm-details">
                                <span class="perm-name">Clipboard Access</span>
                                <span class="perm-desc">1-click code copying & vision paste</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.clipboard === 'granted' ? 'granted' : (b1Permissions.clipboard === 'blocked' ? 'blocked' : 'pending')}" onclick="requestBrowserPermission('clipboard')">
                            ${b1Permissions.clipboard === 'granted' ? 'Granted ✓' : (b1Permissions.clipboard === 'blocked' ? 'Blocked ✕' : 'Allow')}
                        </button>
                    </div>

                    <!-- 5. Terminal Execution -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">💻</div>
                            <div class="perm-details">
                                <span class="perm-name">Terminal & Scripts</span>
                                <span class="perm-desc">PowerShell, Python & shell sandbox</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.terminal === 'granted' ? 'granted' : 'blocked'}" onclick="requestBrowserPermission('terminal')">
                            ${b1Permissions.terminal === 'granted' ? 'Granted ✓' : 'Disabled'}
                        </button>
                    </div>

                    <!-- 6. Filesystem -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">📁</div>
                            <div class="perm-details">
                                <span class="perm-name">Filesystem Access</span>
                                <span class="perm-desc">Codebase reading & multi-file editing</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.filesystem === 'granted' ? 'granted' : 'blocked'}" onclick="requestBrowserPermission('filesystem')">
                            ${b1Permissions.filesystem === 'granted' ? 'Granted ✓' : 'Disabled'}
                        </button>
                    </div>

                    <!-- 7. MCP Tools & Network -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">🌐</div>
                            <div class="perm-details">
                                <span class="perm-name">MCP Tools Protocol</span>
                                <span class="perm-desc">Web search, SQLite & GitHub tools</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.mcp_network === 'granted' ? 'granted' : 'blocked'}" onclick="requestBrowserPermission('mcp_network')">
                            ${b1Permissions.mcp_network === 'granted' ? 'Granted ✓' : 'Disabled'}
                        </button>
                    </div>

                    <!-- 8. Messaging Connectors -->
                    <div class="permission-item-card">
                        <div class="perm-left">
                            <div class="perm-icon-box">💬</div>
                            <div class="perm-details">
                                <span class="perm-name">Messaging Dispatch</span>
                                <span class="perm-desc">WhatsApp, Teams, Discord webhooks</span>
                            </div>
                        </div>
                        <button class="perm-badge ${b1Permissions.messaging === 'granted' ? 'granted' : 'blocked'}" onclick="requestBrowserPermission('messaging')">
                            ${b1Permissions.messaging === 'granted' ? 'Granted ✓' : 'Disabled'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else if (step === 5) {
        if (onboardNextLabel) onboardNextLabel.textContent = "View Alignment Report →";
        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>Choose your workspace visual atmosphere. All themes feature custom dark scrollbars and high contrast surfaces.</p>
                </div>
            </div>
            <div class="theme-picker-grid">
                <div class="theme-card ${onboardDraft.theme === 'linear-obsidian' ? 'selected' : ''}" onclick="selectOnboardTheme(this, 'linear-obsidian')">
                    <div class="theme-preview-swatch" style="background:#010102; border:1px solid #23252a;">
                        <span style="width:12px; height:12px; border-radius:50%; background:#5e6ad2;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#828fff;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#f7f8f8;"></span>
                    </div>
                    <div class="theme-card-title">Linear Obsidian (Default)</div>
                    <div style="font-size:11px; color:var(--ink-subtle); margin-top:2px;">Signature #010102 dark canvas with lavender-blue accent</div>
                </div>

                <div class="theme-card ${onboardDraft.theme === 'midnight-lavender' ? 'selected' : ''}" onclick="selectOnboardTheme(this, 'midnight-lavender')">
                    <div class="theme-preview-swatch" style="background:#08060f; border:1px solid #2a2545;">
                        <span style="width:12px; height:12px; border-radius:50%; background:#8b5cf6;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#a78bfa;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#f8f6ff;"></span>
                    </div>
                    <div class="theme-card-title">Midnight Lavender</div>
                    <div style="font-size:11px; color:var(--ink-subtle); margin-top:2px;">Deep purple-night aesthetic with vivid violet accents</div>
                </div>

                <div class="theme-card ${onboardDraft.theme === 'cyber-matrix' ? 'selected' : ''}" onclick="selectOnboardTheme(this, 'cyber-matrix')">
                    <div class="theme-preview-swatch" style="background:#030806; border:1px solid #1b3d2e;">
                        <span style="width:12px; height:12px; border-radius:50%; background:#10b981;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#34d399;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#f0fdf4;"></span>
                    </div>
                    <div class="theme-card-title">Cyber Matrix</div>
                    <div style="font-size:11px; color:var(--ink-subtle); margin-top:2px;">Deep emerald hacker glow with vibrant green accents</div>
                </div>

                <div class="theme-card ${onboardDraft.theme === 'monochrome-slate' ? 'selected' : ''}" onclick="selectOnboardTheme(this, 'monochrome-slate')">
                    <div class="theme-preview-swatch" style="background:#0a0a0c; border:1px solid #2e2e38;">
                        <span style="width:12px; height:12px; border-radius:50%; background:#ffffff;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#94a3b8;"></span>
                        <span style="width:12px; height:12px; border-radius:50%; background:#222229;"></span>
                    </div>
                    <div class="theme-card-title">Monochrome Slate</div>
                    <div style="font-size:11px; color:var(--ink-subtle); margin-top:2px;">Minimalist carbon and pure white high-contrast styling</div>
                </div>
            </div>
        `;
    } else if (step === 6) {
        if (onboardNextLabel) onboardNextLabel.textContent = "Save & Launch B1 Studio 🚀";
        
        const nameVal = document.getElementById('onboard-name-input')?.value.trim();
        if (nameVal) onboardDraft.user_name = nameVal;

        const role = onboardDraft.role || 'Lead Developer & AI Architect';
        const arch = onboardDraft.archetype || 'Senior Architect';
        const theme = onboardDraft.theme || 'linear-obsidian';
        const name = onboardDraft.user_name || 'Ishaan Sen';

        onboardBody.innerHTML = `
            <div class="onboard-b1-chat">
                <div class="onboard-b1-avatar">B1</div>
                <div class="onboard-speech-bubble">
                    <p>I have aligned our workspace persona and configured long-term memory & tool authorization for you, <strong>${escapeHtml(name)}</strong>!</p>
                </div>
            </div>

            <div class="perception-report-card">
                <div class="perception-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>B1's Perception & Alignment Report</span>
                </div>
                <ul class="perception-list">
                    <li>⚡ <strong>Engineering Identity:</strong> ${escapeHtml(role)} with high curiosity and proactive tooling habits.</li>
                    <li>🎯 <strong>Communication Standard:</strong> ${escapeHtml(arch)} — concise reasoning, zero hallucination, direct execution.</li>
                    <li>🔒 <strong>System & Device Authorization:</strong> Complete authorization for Microphone, Camera, Terminal, Notifications & Filesystem.</li>
                    <li>🎨 <strong>Visual Atmosphere:</strong> ${escapeHtml(theme.replace('-', ' ').toUpperCase())} with dark custom scrollbars.</li>
                    <li>💾 <strong>Memory Preservation:</strong> All previous chat sessions, MCP tools, and SQLite facts remain 100% intact and linked.</li>
                </ul>
            </div>
        `;
    }
}

window.selectOnboardRole = function(el, roleTitle) {
    document.querySelectorAll('.onboard-choices-grid .choice-chip-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    onboardDraft.role = roleTitle;
};

window.selectOnboardArchetype = function(el, archTitle, styleDesc) {
    document.querySelectorAll('.onboard-choices-grid .choice-chip-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    onboardDraft.archetype = archTitle;
    onboardDraft.communication_style = styleDesc;
};

window.selectOnboardTheme = function(el, themeName) {
    document.querySelectorAll('.theme-picker-grid .theme-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    onboardDraft.theme = themeName;
    applyTheme(themeName);
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function setGreeting() {
    const titleEl = document.getElementById('welcome-title');
    if (!titleEl) return;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    titleEl.textContent = `${greet}, Ishaan`;
}

// ── Markdown, LaTeX Math & Code Setup ──────────────────────────────────
function setupMarkedParser() {
    if (!window.marked) return;
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        highlight: function(code, lang) {
            if (window.hljs && lang && hljs.getLanguage(lang)) {
                try { return hljs.highlight(code, { language: lang }).value; } catch(e) {}
            }
            return window.hljs ? hljs.highlightAuto(code).value : code;
        }
    });
}

// Canonical formatMarkdown — handles Mermaid cards, KaTeX math, and hljs highlighting
function formatMarkdown(text) {
    if (!text) return '';

    // 1. Extract Mermaid blocks and replace with clean placeholders
    const mermaidBlocks = [];
    let processed = text.replace(/```mermaid([\s\S]*?)```/gi, (match, code) => {
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        const trimmedCode = code.trim();
        const idx = mermaidBlocks.length;
        mermaidBlocks.push({ id, code: trimmedCode });
        return `\n\nMERMAIDPLACEHOLDER${idx}XYZ\n\n`;
    });

    // 1.2 Extract Action Cards and replace with placeholders
    const actionCards = [];
    processed = processed.replace(/(?::::action-card\s*([\s\S]*?):::|\[ACTION_CARD:\s*([\s\S]*?)\])/gi, (match, p1, p2) => {
        const idx = actionCards.length;
        actionCards.push((p1 || p2 || '').trim());
        return `\n\nACTIONCARDPLACEHOLDER${idx}XYZ\n\n`;
    });

    // 2. Parse Markdown → HTML
    let rendered = '';
    try {
        rendered = marked.parse(processed, { breaks: true, gfm: true });
    } catch(e) {
        rendered = escapeHtml(processed).replace(/\n/g, '<br>');
    }

    // 2.1 Parse [VISUALIZE_OFFER: prompt="..."] tags into interactive offer cards
    rendered = rendered.replace(/\[VISUALIZE_OFFER:\s*prompt="([^"]+)"\]/gi, (match, visPrompt) => {
        return `
            <div class="vis-offer-card">
                <div class="vis-offer-header">
                    <span class="vis-offer-icon">🔬</span>
                    <div>
                        <div class="vis-offer-title">Interactive STEM Simulation Available</div>
                        <div class="vis-offer-desc">Generate a live Canvas/D3 simulation with real-time sliders and dynamic physics curves.</div>
                    </div>
                </div>
                <button class="vis-offer-btn" onclick="requestVisualization('${escapeHtml(visPrompt).replace(/'/g, "\\'")}')">
                    <span>⚡ Visualize It Now</span>
                </button>
            </div>
        `;
    });

    // 2.2 Parse [SUGGESTIONS: "...", "..."] tags into smart follow-up action chips
    rendered = rendered.replace(/\[SUGGESTIONS:\s*([\s\S]*?)\]/gi, (match, rawList) => {
        try {
            const matches = [...rawList.matchAll(/"([^"]+)"/g)].map(m => m[1]);
            if (matches.length === 0) return '';
            const chips = matches.map(s => `
                <button class="smart-suggestion-chip" onclick="useSmartSuggestion('${escapeHtml(s).replace(/'/g, "\\'")}')">
                    <span>💡 ${escapeHtml(s)}</span>
                </button>
            `).join('');
            return `<div class="smart-suggestions-container"><div class="smart-suggestions-title">Suggested Next Actions:</div><div class="smart-suggestions-row">${chips}</div></div>`;
        } catch(e) {
            return '';
        }
    });

    // 2.3 Restore Action Cards
    rendered = rendered.replace(/ACTIONCARDPLACEHOLDER(\d+)XYZ/g, (match, idx) => {
        const rawJson = actionCards[parseInt(idx, 10)] || '';
        try {
            const data = JSON.parse(rawJson);
            const cardId = 'act_' + Math.random().toString(36).substring(2, 9);
            const plat = (data.platform || 'whatsapp').toLowerCase();
            const isDrive = plat === 'google_drive' || plat === 'drive';
            const icon = isDrive ? '📁' : (plat === 'whatsapp' ? '💬' : (plat === 'telegram' ? '✈️' : (plat === 'slack' ? '💼' : '🚀')));
            const title = isDrive ? 'Google Drive Cloud Upload' : `${plat.toUpperCase()} Message & File Dispatch`;
            const badge = data.recipient ? `To: ${escapeHtml(data.recipient)}` : (isDrive ? `Folder: ${escapeHtml(data.target_folder || 'My Drive')}` : 'Ready to Dispatch');
            const file = data.file || data.file_target || '';
            const initialMsg = data.suggested_message || data.message || '';
            const suggestions = data.suggestions || data.alternatives || [];

            return `
                <div class="linear-action-card" id="${cardId}">
                    <div class="action-card-header">
                        <div class="action-card-title">
                            <span>${icon}</span>
                            <span>${title}</span>
                        </div>
                        <span class="action-card-badge">${badge}</span>
                    </div>

                    ${file ? `
                    <div class="action-card-file-chip">
                        <span>📄 Attached File:</span>
                        <strong>${escapeHtml(file)}</strong>
                    </div>` : ''}

                    ${suggestions.length > 0 ? `
                    <div class="action-suggestions-box">
                        <div class="action-suggestions-label">💡 AI Suggested Messages (Click any to use):</div>
                        <div class="action-suggestions-row">
                            ${suggestions.map(s => `
                                <div class="action-suggest-chip" onclick="applySuggestedMessage('${cardId}', '${escapeHtml(s).replace(/'/g, "\\'")}')">
                                    " ${escapeHtml(s)} "
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}

                    <textarea class="action-card-textarea" id="${cardId}-text" rows="2" placeholder="Accompanying message or caption...">${escapeHtml(initialMsg)}</textarea>

                    <div class="action-card-footer">
                        <button class="action-card-btn" onclick="executeActionCard('${cardId}', '${data.type || 'share'}', '${plat}', '${escapeHtml(data.recipient || '')}', '${escapeHtml(file)}')">
                            <span>${isDrive ? '☁️ Upload to Google Drive' : '🚀 Send to ' + (plat === 'whatsapp' ? 'WhatsApp' : plat.toUpperCase())}</span>
                        </button>
                        <div class="action-card-result" id="${cardId}-res"></div>
                    </div>
                </div>
            `;
        } catch(e) {
            return `<div class="action-card-result error" style="display:block;">⚠️ Could not render Action Card: ${escapeHtml(e.message)}</div>`;
        }
    });

    // 2.4 Restore Mermaid Cards
    rendered = rendered.replace(/(?:<p>)?MERMAIDPLACEHOLDER(\d+)XYZ(?:<\/p>)?/g, (match, idxStr) => {
        const item = mermaidBlocks[parseInt(idxStr, 10)];
        if (!item) return '';
        const { id, code: trimmedCode } = item;
        return `
            <div class="mermaid-card" id="card-${id}">
                <div class="mermaid-header">
                    <div class="mermaid-header-left">
                        <span class="mermaid-icon">📐</span>
                        <span>Architecture Diagram</span>
                    </div>
                    <div class="mermaid-actions">
                        <button class="mermaid-btn" id="btn-toggle-${id}" onclick="toggleMermaidSource('${id}')">Source</button>
                        <button class="mermaid-btn" id="btn-copy-${id}" onclick="copyMermaidSource('${id}')">Copy Code</button>
                    </div>
                </div>
                <div class="mermaid-svg-container" id="${id}" data-mermaid-code="${encodeURIComponent(trimmedCode)}">
                    <div class="mermaid-loading-pulse">Rendering diagram...</div>
                </div>
                <div class="mermaid-source-drawer" id="drawer-${id}" style="display: none;">
                    <pre><code class="language-mermaid">${escapeHtml(trimmedCode)}</code></pre>
                </div>
            </div>
        `;
    });

    // 3. Apply KaTeX math rendering
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rendered;
    if (window.renderMathInElement) {
        try {
            renderMathInElement(tempDiv, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$',  right: '$',  display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false,
                output: 'html'
            });
        } catch(e) {}
    }

    // 4. Apply syntax highlighting to all code blocks
    if (window.hljs) {
        tempDiv.querySelectorAll('pre code').forEach(block => {
            if (!block.dataset.highlighted && !block.classList.contains('language-mermaid')) {
                hljs.highlightElement(block);
                block.dataset.highlighted = 'yes';
            }
        });
    }

    // 5. Trigger robust Mermaid render async
    if (mermaidBlocks.length > 0) {
        setTimeout(renderAllMermaidCards, 60);
    }

    return tempDiv.innerHTML;
}

// ── MCP Servers Management ──────────────────────────────────────────────
async function loadMcpServers() {
    try {
        const res = await fetch(MCP_SERVERS_URL);
        if (!res.ok) return;
        const data = await res.json();
        mcpServersList = data.servers || [];

        const activeCount = mcpServersList.filter(s => s.status === 'connected').length;
        const totalTools = data.total_tools || 0;

        if (topbarMcpLabel) topbarMcpLabel.textContent = `MCP: ${activeCount} Active`;
        if (mcpHubBtnLabel) mcpHubBtnLabel.textContent = `MCP Servers (${activeCount} Active · ${totalTools} Tools)`;
        if (mcpActiveBadge) mcpActiveBadge.textContent = activeCount;
        renderMcpServersModal();
    } catch (e) {
        console.warn('MCP endpoint not available yet.');
    }
}

async function loadMcpPresets() {
    try {
        const res = await fetch(MCP_PRESETS_URL);
        if (!res.ok) return;
        const data = await res.json();
        mcpPresetsList = data.presets || [];
        renderMcpPresets();
    } catch (e) {}
}

function renderMcpServersModal() {
    if (!mcpServerListEl) return;
    if (mcpServersList.length === 0) {
        mcpServerListEl.innerHTML = '<div style="font-size:12px; color:var(--ink-tertiary); padding: 12px 0;">No MCP servers configured.</div>';
        return;
    }

    mcpServerListEl.innerHTML = mcpServersList.map(s => `
        <div class="mcp-server-card">
            <div class="mcp-card-top">
                <div class="mcp-server-name">
                    <span>🔌 ${escapeHtml(s.name || s.id)}</span>
                    <span class="mcp-status-chip ${s.status === 'connected' ? 'connected' : 'configured'}">
                        ${s.status === 'connected' ? '● Connected' : '○ Configured'}
                    </span>
                    <span class="mcp-tool-pill" style="font-size:10px;">${s.tools_count || 0} tools</span>
                </div>
                <div class="mcp-card-actions">
                    <button class="mcp-btn-sm" id="btn-ping-${s.id}" onclick="testMcpServer('${s.id}')">Ping / Test</button>
                    ${s.type !== 'builtin' ? `<button class="mcp-btn-sm" onclick="deleteMcpServer('${s.id}')" style="color:var(--semantic-error);">Delete</button>` : ''}
                </div>
            </div>
            ${s.command ? `<div style="font-size:11px; font-family:'JetBrains Mono',monospace; color:var(--ink-subtle);">${escapeHtml(s.command)} ${(s.args || []).join(' ')}</div>` : ''}
            ${s.error ? `<div style="font-size:11px; color:#e06c75; background:rgba(224,108,117,0.1); padding:4px 8px; border-radius:4px;">Error: ${escapeHtml(s.error)}</div>` : ''}
            <div class="mcp-tools-tags">
                ${(s.tools || []).map(t => `<span class="mcp-tool-pill">${escapeHtml(t)}</span>`).join('')}
                ${(!s.tools || s.tools.length === 0) ? '<span style="font-size:11px; color:var(--ink-tertiary);">No tools discovered</span>' : ''}
            </div>
        </div>
    `).join('');
}

function renderMcpPresets() {
    if (!mcpPresetsGrid) return;
    if (mcpPresetsList.length === 0) {
        mcpPresetsGrid.innerHTML = '<div style="font-size:12px; color:var(--ink-tertiary);">No presets available.</div>';
        return;
    }

    mcpPresetsGrid.innerHTML = mcpPresetsList.map(p => `
        <div class="mcp-preset-card">
            <div>
                <div class="mcp-preset-title">
                    <span>⚡ ${escapeHtml(p.name)}</span>
                </div>
                <div class="mcp-preset-desc">${escapeHtml(p.description)}</div>
            </div>
            <div class="mcp-preset-cmd">${escapeHtml(p.command)} ${(p.args || []).join(' ')}</div>
            <button class="btn-secondary" style="padding:4px 10px; font-size:11.5px;" onclick="installPreset('${p.id}')">+ Install Preset</button>
        </div>
    `).join('');
}

window.installPreset = async function(presetId) {
    const preset = mcpPresetsList.find(p => p.id === presetId);
    if (!preset) return;

    try {
        const res = await fetch(MCP_SERVERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: preset.id,
                name: preset.name,
                command: preset.command,
                args: preset.args,
                env: preset.env || {}
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await loadMcpServers();
            switchMcpTab('active');
            testMcpServer(preset.id);
        } else {
            alert(data.message || 'Failed to install preset.');
        }
    } catch (e) {
        alert('Network error while installing preset.');
    }
};

window.testMcpServer = async function(id) {
    const btn = document.getElementById(`btn-ping-${id}`);
    if (btn) {
        btn.textContent = 'Testing...';
        btn.disabled = true;
    }
    try {
        const res = await fetch(`${MCP_SERVERS_URL}/${id}/test`, { method: 'POST' });
        const d = await res.json();
        await loadMcpServers();
    } catch (e) {
        console.error('MCP test error:', e);
    } finally {
        if (btn) {
            btn.textContent = 'Ping / Test';
            btn.disabled = false;
        }
    }
};

window.deleteMcpServer = async function(id) {
    if (!confirm(`Are you sure you want to remove MCP server '${id}'?`)) return;
    try {
        await fetch(`${MCP_SERVERS_URL}/${id}`, { method: 'DELETE' });
        await loadMcpServers();
    } catch (e) {
        console.error('Failed to delete MCP server:', e);
    }
};

function switchMcpTab(tabName) {
    [mcpTabActiveBtn, mcpTabAddBtn, mcpTabPresetsBtn, mcpTabJsonBtn].forEach(b => b?.classList.remove('active'));
    [mcpPanelActive, mcpPanelAdd, mcpPanelPresets, mcpPanelJson].forEach(p => p?.classList.remove('active'));

    if (tabName === 'active') {
        mcpTabActiveBtn?.classList.add('active');
        mcpPanelActive?.classList.add('active');
    } else if (tabName === 'add') {
        mcpTabAddBtn?.classList.add('active');
        mcpPanelAdd?.classList.add('active');
    } else if (tabName === 'presets') {
        mcpTabPresetsBtn?.classList.add('active');
        mcpPanelPresets?.classList.add('active');
    } else if (tabName === 'json') {
        mcpTabJsonBtn?.classList.add('active');
        mcpPanelJson?.classList.add('active');
    }
}

// ── Multi-Chat Sessions Management ─────────────────────────────────────
async function loadSessions(autoSelect = false) {
    try {
        const res = await fetch(SESSIONS_URL);
        if (!res.ok) return;
        const data = await res.json();
        allSessions = data.sessions || [];
        renderSessionsNav();

        // Only auto-load if explicitly requested
        if (autoSelect && currentSessionId && allSessions.some(s => s.id === currentSessionId)) {
            loadSessionMessages(currentSessionId);
        }
    } catch (e) {
        console.warn('Backend offline or loading fresh session.');
    }
}

function renderSessionsNav() {
    if (!sessionsList) return;
    if (allSessions.length === 0) {
        sessionsList.innerHTML = '<div style="padding:10px 8px; font-size:12px; color:var(--ink-tertiary);">No saved chats yet.</div>';
        return;
    }

    sessionsList.innerHTML = allSessions.map(s => `
        <div class="session-item ${s.id === currentSessionId ? 'active' : ''}" data-id="${s.id}">
            <span class="session-title-text" title="${escapeHtml(s.title)}">${escapeHtml(s.title || 'Untitled Chat')}</span>
            <div class="session-actions">
                <button class="session-del-btn" title="Delete chat" onclick="event.stopPropagation(); deleteSession('${s.id}')">✕</button>
            </div>
        </div>
    `).join('');

    sessionsList.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => switchSession(item.dataset.id));
    });
}

async function switchSession(id) {
    if (window.backToB1) window.backToB1();
    if (currentSessionId === id && currentMessages.length > 0) return;
    currentSessionId = id;
    renderSessionsNav();
    await loadSessionMessages(id);
}

async function loadSessionMessages(id) {
    try {
        const res = await fetch(`${SESSIONS_URL}/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        
        currentMessages = [];
        messagesFeed.innerHTML = '';
        
        if (data.session && activeChatTitle) {
            activeChatTitle.textContent = data.session.title || 'Conversation';
        }

        const msgs = data.messages || [];
        if (msgs.length > 0) {
            welcomeScreen.style.display = 'none';
            msgs.forEach(m => {
                const thinking = m.thinking ? JSON.parse(m.thinking) : [];
                const artifacts = m.artifacts ? JSON.parse(m.artifacts) : [];
                currentMessages.push({ role: m.role, content: m.content });
                renderMessage(m.role, m.content, thinking, artifacts, false);
            });
            scrollToBottom();
        } else {
            welcomeScreen.style.display = 'flex';
        }
    } catch (e) {
        console.error('Error loading session:', e);
    }
}

async function deleteSession(id) {
    try {
        await fetch(`${SESSIONS_URL}/${id}`, { method: 'DELETE' });
        allSessions = allSessions.filter(s => s.id !== id);
        if (currentSessionId === id) {
            startNewChat();
        } else {
            renderSessionsNav();
        }
    } catch (e) {
        console.error('Failed to delete session:', e);
    }
}

function startNewChat(showToastNotification = false) {
    if (window.backToB1) window.backToB1();
    currentSessionId = generateUUID();
    currentMessages = [];
    messagesFeed.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    if (activeChatTitle) activeChatTitle.textContent = 'New Conversation';
    closeArtifactDrawer();
    renderSessionsNav();
    if (messageInput) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.focus();
    }
    if (sendButton) sendButton.disabled = true;
    if (showToastNotification) {
        showToast('✦ New Conversation Started', 'info');
    }
}

// ── Claude-Style Artifact Engine & Sandbox ─────────────────────────────
function openArtifact(artifact) {
    if (!artifact) return;
    
    // Clean code fences if present in artifact content
    if (artifact.content) {
        artifact.content = artifact.content
            .replace(/^```(?:html|css|javascript|js|svg|xml)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        artifact.content = artifact.content.replace(/^[\.\s]{1,4}(?=<)/, '');
    }

    currentArtifact = artifact;

    artHeaderTitle.textContent = artifact.title || 'Interactive Artifact';
    const isApp = artifact.type === 'text/html' || artifact.language === 'html';
    artHeaderBadge.textContent = isApp ? 'Live HTML Application' : `${(artifact.language || 'Code').toUpperCase()}`;
    artHeaderIcon.textContent = isApp ? '⚡' : '📄';

    const artCodeEditor = document.getElementById('art-code-editor');
    const codePaneLang = document.getElementById('code-pane-lang');
    const codePaneLines = document.getElementById('code-pane-lines');

    if (artCodeEditor) {
        artCodeEditor.value = artifact.content || '';
        const lines = (artifact.content || '').split('\n').length;
        if (codePaneLines) codePaneLines.textContent = `${lines} lines`;
        if (codePaneLang) codePaneLang.textContent = (artifact.language || 'html').toUpperCase();
    }

    if (isApp || artifact.type === 'image/svg+xml') {
        tabPreviewBtn.style.display = 'flex';
        renderPreviewFrame(artifact.content);
        switchArtifactTab('preview');
    } else {
        tabPreviewBtn.style.display = 'none';
        switchArtifactTab('code');
    }

    showArtifactDrawer();
    if (toggleArtifactPaneBtn) {
        toggleArtifactPaneBtn.style.display = 'flex';
        artifactToggleBadge.textContent = 'Artifact Active';
    }
}

function renderPreviewFrame(code) {
    if (!artPreviewFrame) return;

    // 1. Strip accidental markdown code fences (e.g. ```html ... ```)
    let cleanCode = (code || '').trim();
    cleanCode = cleanCode.replace(/^```(?:html|css|javascript|js|svg|xml)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // 2. Clean stray dots / markdown artifacts at the start
    cleanCode = cleanCode.replace(/^[\.\s]{1,4}(?=<)/, '');

    // 3. Clean and normalize unrendered LaTeX math notation inside HTML text nodes
    cleanCode = cleanCode
        .replace(/\\\(\s*\\?theta\s*\\\)/g, 'θ')
        .replace(/\$\s*\\?theta\s*\$/g, 'θ')
        .replace(/\\\(\s*\\?vec\{v\}\s*\\\)/g, 'v⃗')
        .replace(/\$\s*\\?vec\{v\}\s*\$/g, 'v⃗')
        .replace(/\\\(\s*\\?v_0\s*\\\)/g, 'v₀')
        .replace(/\$\s*\\?v_0\s*\$/g, 'v₀')
        .replace(/\\\(\s*\\?v_x\s*\\\)/g, 'vₓ')
        .replace(/\$\s*\\?v_x\s*\$/g, 'vₓ')
        .replace(/\\\(\s*\\?v_y\s*\\\)/g, 'vᵧ')
        .replace(/\$\s*\\?v_y\s*\$/g, 'vᵧ')
        .replace(/\$\s*v\s*\$/g, 'v')
        .replace(/\$\s*g\s*\$/g, 'g')
        .replace(/\$\s*t\s*\$/g, 't')
        .replace(/\$\s*k\/m\s*\$/g, 'k/m')
        .replace(/\$\s*k\s*=\s*0\s*\$/g, 'k = 0')
        .replace(/\$\s*Y_\{?max\}?\s*\$/g, 'Y_max')
        .replace(/\$\s*X_\{?max\}?\s*\$/g, 'X_max')
        .replace(/\$\s*\\?Delta\s*L\s*\$/g, 'ΔL')
        .replace(/\$\s*P_\{?crop\}?\s*\$/g, 'P_crop')
        .replace(/\$([a-zA-Z0-9_]+)\$/g, '$1');

    const consoleCaptureScript = `
        <script>
            (function() {
                const sendLog = (type, args) => {
                    try {
                        const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
                        window.parent.postMessage({ type: 'SANDBOX_CONSOLE', level: type, text: msg }, '*');
                    } catch(e){}
                };
                console.log = (...args) => sendLog('log', args);
                console.error = (...args) => sendLog('error', args);
                console.warn = (...args) => sendLog('warn', args);
                console.info = (...args) => sendLog('info', args);
                window.onerror = (msg, url, line) => {
                    sendLog('error', ['[Runtime Error Line ' + line + ']: ' + msg]);
                };
            })();
        <\/script>
    `;

    let htmlContent = cleanCode;
    if (!htmlContent.includes('<html') && !htmlContent.includes('<!DOCTYPE')) {
        htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:16px;background:#090a0f;color:#e6edf3;}</style></head><body>${cleanCode}</body></html>`;
    }

    htmlContent = consoleCaptureScript + htmlContent;
    artPreviewFrame.srcdoc = htmlContent;
}

function switchArtifactTab(tab) {
    const tabs = [tabPreviewBtn, tabCodeBtn, tabConsoleBtn, document.getElementById('tab-files-btn'), document.getElementById('tab-terminal-btn')].filter(Boolean);
    const panes = [panePreview, paneCode, paneConsole, document.getElementById('pane-files'), document.getElementById('pane-terminal')].filter(Boolean);

    tabs.forEach(b => b.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    if (tab === 'preview') {
        tabPreviewBtn.classList.add('active');
        panePreview.classList.add('active');
    } else if (tab === 'code') {
        tabCodeBtn.classList.add('active');
        paneCode.classList.add('active');
    } else if (tab === 'console') {
        tabConsoleBtn.classList.add('active');
        paneConsole.classList.add('active');
        if (consoleCountBadge) consoleCountBadge.style.display = 'none';
    } else if (tab === 'files') {
        const btn = document.getElementById('tab-files-btn');
        const pane = document.getElementById('pane-files');
        if (btn) btn.classList.add('active');
        if (pane) pane.classList.add('active');
        if (typeof refreshProjectFiles === 'function') {
            refreshProjectFiles();
        } else {
            loadWorkspaceTree();
        }
    } else if (tab === 'terminal') {
        const btn = document.getElementById('tab-terminal-btn');
        const pane = document.getElementById('pane-terminal');
        if (btn) btn.classList.add('active');
        if (pane) pane.classList.add('active');
        setTimeout(() => document.getElementById('terminal-input')?.focus(), 50);
    }
}

function showArtifactDrawer() {
    if (!artifactDrawer) return;
    artifactDrawer.style.display = 'flex';
    const overlay = document.getElementById('drawer-overlay');
    if (overlay && window.innerWidth < 1440) {
        overlay.classList.add('active');
    }
}
window.showArtifactDrawer = showArtifactDrawer;

function closeArtifactDrawer() {
    if (artifactDrawer) artifactDrawer.style.display = 'none';
    const overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.classList.remove('active');
}
window.closeArtifactDrawer = closeArtifactDrawer;

async function saveCurrentArtifactToProject() {
    if (!currentArtifact) return;
    const saveBtn = document.getElementById('art-save-project-btn');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) saveBtn.innerHTML = '<span style="font-size:11px; margin-left:4px;">Saving...</span>';

    try {
        const resp = await fetch(`${API_BASE}/artifacts/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: currentArtifact.title || 'b1_artifact',
                content: currentArtifact.content || '',
                filename: currentArtifact.filename || ''
            })
        });
        const data = await resp.json();
        if (data.status === 'success') {
            if (saveBtn) saveBtn.innerHTML = '<span style="font-size:11px; margin-left:4px; color:#00e5a3;">✓ Saved to Playground</span>';
            setTimeout(() => {
                if (saveBtn) saveBtn.innerHTML = originalText;
            }, 2500);
        }
    } catch (e) {
        console.error('Save artifact failed:', e);
        if (saveBtn) saveBtn.innerHTML = originalText;
    }
}

function setupConsoleSandboxBridge() {
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'SANDBOX_CONSOLE') {
            appendConsoleLog(e.data.level, e.data.text);
        }
    });
}

let consoleLogs = [];
function appendConsoleLog(level, text) {
    consoleLogs.push({ level, text, time: new Date().toLocaleTimeString() });
    if (!consoleLogsList) return;

    if (consoleLogs.length === 1) consoleLogsList.innerHTML = '';

    const row = document.createElement('div');
    row.className = `console-log-row ${level}`;
    row.textContent = `[${level.toUpperCase()}] ${text}`;
    consoleLogsList.appendChild(row);
    consoleLogsList.scrollTop = consoleLogsList.scrollHeight;

    if (consoleCountBadge && !paneConsole.classList.contains('active')) {
        consoleCountBadge.style.display = 'inline-block';
        consoleCountBadge.textContent = consoleLogs.length;
    }
}

// ── WebAssembly Python Sandbox (Pyodide Runtime) ────────────────────────
let pyodideInstance = null;
let isPyodideLoading = false;

window.initPyodideRuntime = async function() {
    if (pyodideInstance) return pyodideInstance;
    if (isPyodideLoading) {
        while (isPyodideLoading) await new Promise(r => setTimeout(r, 100));
        return pyodideInstance;
    }
    isPyodideLoading = true;
    try {
        if (typeof loadPyodide === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Could not load Pyodide WASM CDN.'));
                document.head.appendChild(script);
            });
        }
        pyodideInstance = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
        });
        showToast('🐍 Pyodide WASM Sandbox Ready (In-Browser Python Active)', 'success');
        return pyodideInstance;
    } catch (e) {
        console.error('Pyodide Init Error:', e);
        showToast('Pyodide WASM notice: ' + (e.message || 'WASM runtime initialized offline mode'), 'info');
        return null;
    } finally {
        isPyodideLoading = false;
    }
};

window.runCurrentArtifactInWASM = async function() {
    if (!currentArtifact || !currentArtifact.content) {
        showToast('⚠️ No active artifact code to run.', 'info');
        return;
    }

    switchArtifactTab('console');
    appendConsoleLog('info', 'Initializing Pyodide WebAssembly Python sandbox...');

    try {
        const py = await window.initPyodideRuntime();
        if (!py) {
            appendConsoleLog('warn', 'Falling back to simulated Python execution.');
            return;
        }

        // Redirect stdout/stderr to B1 console
        py.setStdout({ batched: (str) => appendConsoleLog('log', str) });
        py.setStderr({ batched: (str) => appendConsoleLog('error', str) });

        const startTime = performance.now();
        const result = await py.runPythonAsync(currentArtifact.content);
        const elapsed = (performance.now() - startTime).toFixed(2);
        
        if (result !== undefined) {
            appendConsoleLog('info', `Result: ${result}`);
        }
        appendConsoleLog('info', `✓ Execution completed in ${elapsed}ms (0ms server load)`);
    } catch (err) {
        appendConsoleLog('error', `Python Runtime Error: ${err.message}`);
    }
};

// ── Agent Swarm Consensus & AST Symbol Explorer Client Helpers ─────────
window.runSwarmConsensusAudit = async function(task, proposal) {
    showToast('🤖 Convening 4-Agent Consensus Swarm...', 'info', 3000);
    try {
        const resp = await fetch(`${API_BASE}/swarm/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, proposal })
        });
        const data = await resp.json();
        return data;
    } catch (e) {
        console.error('Swarm audit error:', e);
        return null;
    }
};

// ── Message Rendering Engine ───────────────────────────────────────────
function renderMessage(role, content, thinkingLogs = [], artifacts = [], animate = false, attachedImages = []) {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? 'IS' : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
        let userHtml = '';
        if (attachedImages && attachedImages.length > 0) {
            userHtml += `
                <div class="chat-images-container">
                    ${attachedImages.map(img => `
                        <div class="chat-image-wrapper" onclick="openImageLightbox('${escapeHtml(img.image_url || img.url)}')">
                            <img src="${escapeHtml(img.image_url || img.url)}" alt="${escapeHtml(img.filename || 'Attached image')}">
                            <span class="image-zoom-badge">🔍 Zoom</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        if (content) {
            userHtml += escapeHtml(content).replace(/\n/g, '<br>');
        }
        bubble.innerHTML = userHtml;
    } else {
        updateAssistantBubble(bubble, thinkingLogs, content, artifacts);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesFeed.appendChild(row);
    scrollToBottom();
    return bubble;
}

// ── Mermaid Engine & Diagram Sanitizer (Zero Red-Bomb Engine) ───────────
function initMermaidEngine() {
    if (window.mermaid) {
        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    darkMode: true,
                    background: '#0b0c0d',
                    primaryColor: '#5e6ad2',
                    primaryTextColor: '#f7f8f8',
                    primaryBorderColor: '#32353d',
                    lineColor: '#828fff',
                    secondaryColor: '#121315',
                    tertiaryColor: '#18191b',
                    fontFamily: 'inherit'
                },
                suppressErrorRendering: true,
                securityLevel: 'loose'
            });
        } catch (e) {
            console.warn('Mermaid initialization warning:', e);
        }
    }
}

function sanitizeMermaidSyntax(raw) {
    if (!raw) return 'flowchart TD\n  Start["Process"]';
    let code = raw.trim();

    // Strip markdown fences
    code = code.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();

    // Ensure valid root diagram header
    const validHeaders = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|block-beta|xychart-beta)/i;
    if (!validHeaders.test(code)) {
        code = 'flowchart TD\n' + code;
    }

    // Convert old `graph ` to `flowchart ` for cleaner modern parsing
    code = code.replace(/^graph\s+([A-Za-z]{2})/i, 'flowchart $1');

    const lines = code.split('\n');
    let openSubgraphs = 0;
    const sanitized = [];

    for (let line of lines) {
        let l = line.trim();
        if (!l || l.startsWith('%%')) {
            sanitized.push(line);
            continue;
        }

        // Subgraph handling
        if (/^subgraph\s+/i.test(l)) {
            openSubgraphs++;
            // Fix unquoted subgraph titles with spaces: subgraph Client Interface -> subgraph Client_Interface ["Client Interface"]
            const subMatch = l.match(/^subgraph\s+([^\["\n]+)$/i);
            if (subMatch && subMatch[1].trim().includes(' ')) {
                const title = subMatch[1].trim();
                const safeId = title.replace(/[^a-zA-Z0-9_]/g, '_');
                l = `subgraph ${safeId} ["${title}"]`;
            }
        } else if (/^end$/i.test(l)) {
            if (openSubgraphs > 0) openSubgraphs--;
        }

        // Fix labels with unquoted special characters inside brackets
        // 1. Double brackets [[Text]] or cylinder [("Text")] or round ([Text])
        l = l.replace(/([a-zA-Z0-9_\-]+)\[\(\s*([^"\]\n]*[\(\):,/\\][^"\]\n]*)\s*\)\]/g, '$1[("$2")]');
        l = l.replace(/([a-zA-Z0-9_\-]+)\(\[\s*([^"\]\n]*[\(\):,/\\][^"\]\n]*)\s*\]\)/g, '$1(["$2"])');
        
        // 2. Standard box: Node[Text with (parentheses) or : colons or &]
        l = l.replace(/([a-zA-Z0-9_\-]+)\[([^"\]\n]*[\(\):,/\\][^"\]\n]*)\]/g, '$1["$2"]');
        
        // 3. Round: Node(Text with [brackets] or : colons)
        l = l.replace(/([a-zA-Z0-9_\-]+)\(([^"\)\n]*[\[\]:,/\\][^"\)\n]*)\)/g, '$1(["$2"])');
        
        // 4. Diamond: Node{Text with (parentheses) or [brackets]}
        l = l.replace(/([a-zA-Z0-9_\-]+)\{([^"\}\n]*[\(\)\[\]:,/\\][^"\}\n]*)\}/g, '$1{"$2"}');

        // 5. Arrow labels: -->|Label with (parens) or : colons|
        l = l.replace(/-->\s*\|\s*([^"\|\n]*[\(\):,/\\][^"\|\n]*)\s*\|/g, '-->|"$1"|');
        l = l.replace(/---\s*\|\s*([^"\|\n]*[\(\):,/\\][^"\|\n]*)\s*\|/g, '---|"$1"|');
        l = l.replace(/-\.->\s*\|\s*([^"\|\n]*[\(\):,/\\][^"\|\n]*)\s*\|/g, '-.->|"$1"|');
        l = l.replace(/==>\s*\|\s*([^"\|\n]*[\(\):,/\\][^"\|\n]*)\s*\|/g, '==>|"$1"|');

        // Strip markdown bold / asterisks inside labels
        l = l.replace(/\[\s*\*\*([^\*]+)\*\*\s*\]/g, '["$1"]');

        sanitized.push(l);
    }

    while (openSubgraphs > 0) {
        sanitized.push('end');
        openSubgraphs--;
    }

    return sanitized.join('\n');
}

function simplifyMermaidDiagram(raw) {
    const lines = raw.split('\n').filter(l => l.trim() && !l.trim().startsWith('%%'));
    const cleanNodes = [];
    cleanNodes.push('flowchart TD');

    for (let line of lines) {
        let trimmed = line.trim();
        if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram)/i.test(trimmed)) continue;
        if (/-->|---|==>|-\.->/i.test(trimmed)) {
            const parts = trimmed.split(/-->|---|==>|-\.->/);
            if (parts.length === 2) {
                const rawFrom = parts[0].replace(/[\[\]\(\)\{\}"]/g, '').trim() || 'A';
                const rawTo = parts[1].replace(/[\[\]\(\)\{\}"]/g, '').trim() || 'B';
                const safeFrom = rawFrom.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 20);
                const safeTo = rawTo.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 20);
                cleanNodes.push(`  ${safeFrom}["${rawFrom}"] --> ${safeTo}["${rawTo}"]`);
            }
        }
    }

    if (cleanNodes.length <= 1) {
        return 'flowchart TD\n  A["Autonomous Agent System"] --> B["Multi-Stage Plan"] --> C["Tool Execution & Reasoning"] --> D["Synthesized Response"]';
    }
    return cleanNodes.join('\n');
}

async function renderAllMermaidCards() {
    if (!window.mermaid) return;

    const containers = document.querySelectorAll('.mermaid-svg-container[data-mermaid-code]:not([data-rendered="done"])');
    for (const container of containers) {
        const rawCode = decodeURIComponent(container.getAttribute('data-mermaid-code') || '');
        const id = container.id || ('mermaid-' + Math.random().toString(36).substr(2, 9));
        container.setAttribute('data-rendered', 'done');

        const sanitized = sanitizeMermaidSyntax(rawCode);

        try {
            await mermaid.parse(sanitized);
            const renderId = 'svg-' + id.replace(/[^a-zA-Z0-9_-]/g, '');
            const { svg } = await mermaid.render(renderId, sanitized);
            container.innerHTML = svg;
        } catch (err) {
            console.warn('Primary Mermaid parse failed, attempting auto-repair fallback:', err);
            try {
                const fallbackCode = simplifyMermaidDiagram(rawCode);
                const renderId = 'fallback-svg-' + id.replace(/[^a-zA-Z0-9_-]/g, '');
                const { svg } = await mermaid.render(renderId, fallbackCode);
                container.innerHTML = svg;
            } catch (err2) {
                console.warn('Fallback render also failed, rendering clean architecture view:', err2);
                container.innerHTML = `
                    <div class="mermaid-fallback-view">
                        <div class="mermaid-fallback-badge">📐 Architecture Diagram (Source View)</div>
                        <pre class="mermaid-fallback-code"><code>${escapeHtml(sanitized)}</code></pre>
                    </div>
                `;
            }
        }
    }
}

window.toggleMermaidSource = function(id) {
    const drawer = document.getElementById('drawer-' + id);
    const btn = document.getElementById('btn-toggle-' + id);
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'block' : 'none';
    if (btn) btn.textContent = isHidden ? 'Hide Source' : 'Source';
};

window.copyMermaidSource = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const code = decodeURIComponent(el.getAttribute('data-mermaid-code') || '');
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copy-' + id) || el.parentElement.querySelector('.mermaid-btn');
            if (btn) {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy Code', 1800);
            }
        });
    }
};

function updateAssistantBubble(bubble, thinkingLogs, responseText, artifacts = [], decomposedPlan = null, currentStepProgress = null, disambiguationData = null, groundingData = null, refinementData = null) {
    let html = '';

    if (disambiguationData && (disambiguationData.assumptions?.length > 0 || disambiguationData.refined_intent)) {
        const assumptionList = (disambiguationData.assumptions || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');
        html += `
            <div class="intent-disambig-banner">
                <div class="intent-banner-header">
                    <span class="intent-orb">✦</span>
                    <span class="intent-title">Intent Understood: <strong>${escapeHtml(disambiguationData.refined_intent || 'Technical Task')}</strong></span>
                </div>
                ${assumptionList ? `<ul class="intent-assumptions-list">${assumptionList}</ul>` : ''}
            </div>
        `;
    }

    if (decomposedPlan && decomposedPlan.length > 0) {
        html += `
            <div class="stepper-container">
                <div class="stepper-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <div class="stepper-header-left">
                        <span class="stepper-bolt">⚡</span>
                        <span class="stepper-title">Multi-Stage Execution Plan</span>
                        <span class="stepper-badge">${decomposedPlan.length} Stages</span>
                    </div>
                    <span class="stepper-chevron">▼</span>
                </div>
                <div class="stepper-steps-list">
                    ${decomposedPlan.map((st, i) => {
                        const isDone = currentStepProgress && (currentStepProgress.current > st.id);
                        const isActive = currentStepProgress && (currentStepProgress.current === st.id);
                        const cls = isDone ? 'done' : isActive ? 'active' : 'pending';
                        const icon = isDone ? '✓' : isActive ? '●' : st.id;
                        return `
                            <div class="stepper-step-item ${cls}">
                                <div class="step-left-meta">
                                    <span class="step-status-icon">${icon}</span>
                                    <span>${escapeHtml(st.title)}</span>
                                </div>
                                <span class="step-tool-badge">${escapeHtml(st.tool_hint || 'auto')}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    if (thinkingLogs && thinkingLogs.length > 0) {
        const lines = thinkingLogs.map(l => `<div class="thinking-log-step">${escapeHtml(l)}</div>`).join('');
        html += `
            <details class="thinking-accordion" open>
                <summary class="thinking-summary">
                    <span class="thinking-orb"></span>
                    <span>Reasoning Process</span>
                    <span class="thinking-count-tag">${thinkingLogs.length} steps</span>
                </summary>
                <div class="thinking-body">${lines}</div>
            </details>
        `;
    }

    if (responseText) {
        let cleanedText = responseText.replace(/<antArtifact[\s\S]*?<\/antArtifact>/gi, '');
        // Clean stray trailing dots, orphaned quotes, or lone backticks left by artifact removal
        cleanedText = cleanedText.replace(/(?:\r?\n|^)\s*[\.`'\-]{1,3}\s*(?:\r?\n|$)/g, '\n').trim();
        
        let visOfferPrompt = null;
        const offerMatch = cleanedText.match(/\[VISUALIZE_OFFER(?::\s*prompt="([^"]+)")?\]/i);
        if (offerMatch) {
            visOfferPrompt = offerMatch[1] || 'Generate an interactive live simulation artifact with sliders and dynamic visualization for this topic.';
            cleanedText = cleanedText.replace(/\[VISUALIZE_OFFER(?::\s*prompt="[^"]+")?\]/gi, '').trim();
        }

        html += formatMarkdown(cleanedText);

        if (visOfferPrompt) {
            html += `
                <div class="visualize-offer-card">
                    <div class="vis-offer-left">
                        <div class="vis-offer-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#828fff" stroke-width="2">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                                <polyline points="2 17 12 22 22 17"/>
                                <polyline points="2 12 12 17 22 12"/>
                            </svg>
                        </div>
                        <div class="vis-offer-text">
                            <strong>Interactive Visual Simulation Available</strong>
                            <span>Explore with dynamic parameter sliders, animated graphs, and live calculations.</span>
                        </div>
                    </div>
                    <button class="vis-launch-btn" onclick="quickPrompt('${escapeHtml(visOfferPrompt)}')">
                        <span>Visualize It</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            `;
        }
    } else if (thinkingLogs.length === 0 && !decomposedPlan) {
        html += '<span style="color:var(--ink-tertiary);font-style:italic;">Thinking & analyzing tools...</span>';
    }

    if (artifacts && artifacts.length > 0) {
        artifacts.forEach((art, idx) => {
            const isApp = art.type === 'text/html' || art.language === 'html';
            html += `
                <div class="artifact-card-inline" onclick="window.triggerArtifactClick(${idx})">
                    <div class="art-card-left">
                        <div class="art-card-icon">${isApp ? '⚡' : '📄'}</div>
                        <div class="art-card-info">
                            <strong>${escapeHtml(art.title || 'Interactive Artifact')}</strong>
                            <span>${isApp ? 'Click to run interactive live preview' : 'Click to inspect source code'}</span>
                        </div>
                    </div>
                    <button class="art-card-btn">View Artifact →</button>
                </div>
            `;
        });
        window.lastRenderedArtifacts = artifacts;
    }

    if (groundingData && responseText) {
        const isZeroRisk = groundingData.risk_level === 'ZERO' || (groundingData.grounding_score >= 0.85);
        const badgeCls = isZeroRisk ? 'zero-risk' : 'low-risk';
        const icon = isZeroRisk ? '🛡️' : '🔍';
        const percent = groundingData.grounding_percentage || `${Math.round((groundingData.grounding_score || 1.0) * 100)}%`;
        const verifiedList = (groundingData.verified_claims || []).slice(0, 4);

        html += `
            <div class="grounding-telemetry-badge ${badgeCls}">
                <div class="grounding-pill-content">
                    <span class="grounding-icon">${icon}</span>
                    <span class="grounding-label">Epistemic Truth: <strong>${percent} Grounded</strong></span>
                    <span class="grounding-evidence-tag">${groundingData.evidence_count || 0} Verified Anchors</span>
                </div>
                ${verifiedList.length > 0 ? `
                    <div class="grounding-verified-chips">
                        ${verifiedList.map(c => `<span class="grounding-chip">✓ ${escapeHtml(c)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    if (refinementData && responseText) {
        const isApproved = refinementData.passed || (refinementData.quality_score >= 88);
        const statusCls = isApproved ? 'approved' : 'refining';
        const score = refinementData.quality_score || 95;
        const iterText = `Cycle ${refinementData.iteration || 1}/${refinementData.max_iterations || 2}`;
        const critiques = refinementData.critiques || [];

        html += `
            <div class="best-of-best-telemetry-badge ${statusCls}">
                <div class="bob-header-row">
                    <div class="bob-title-group">
                        <span class="bob-icon">✦</span>
                        <span>Best-of-Best Self-Correction Engine</span>
                    </div>
                    <div class="bob-score-pill ${statusCls}">
                        <span>${isApproved ? 'Verified ✓' : 'Refining'}</span>
                        <strong>${score}/100</strong>
                    </div>
                </div>
                <div class="bob-chips-row">
                    <span class="bob-chip">${iterText}</span>
                    <span class="bob-chip">AST Syntax Verified</span>
                    <span class="bob-chip">Zero AI Slop</span>
                    <span class="bob-chip">Epistemic Grounding</span>
                </div>
                ${critiques.length > 0 && !isApproved ? `
                    <div class="bob-critiques-box">
                        <strong>Active Refinement Directives:</strong>
                        ${critiques.map(c => `<div>• ${escapeHtml(c)}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    if (responseText) {
        html += `
            <div class="msg-actions-toolbar" style="display:flex;align-items:center;gap:8px;margin-top:10px;">
                <button class="msg-voice-read-btn" type="button" onclick="window.readMessageBubbleAloud(this)" title="Read aloud with Ava's Neural Voice">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <span>Read Aloud</span>
                </button>
            </div>
        `;
    }

    bubble.innerHTML = html;
    enhanceCodeBlocks(bubble);
}

window.triggerArtifactClick = function(index) {
    if (window.lastRenderedArtifacts && window.lastRenderedArtifacts[index]) {
        openArtifact(window.lastRenderedArtifacts[index]);
    }
};

function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.code-header-bar')) return;
        const codeEl = pre.querySelector('code');
        // Skip mermaid blocks
        if (codeEl?.classList.contains('language-mermaid') || pre.classList.contains('mermaid')) return;

        const langClass = codeEl?.className || '';
        const lang = langClass.replace('language-', '').split(' ')[0] || 'code';

        const header = document.createElement('div');
        header.className = 'code-header-bar';
        header.innerHTML = `
            <span class="code-lang-label">${escapeHtml(lang.toUpperCase())}</span>
            <button class="code-copy-btn" type="button">Copy</button>
        `;

        header.querySelector('.code-copy-btn').addEventListener('click', function() {
            const code = codeEl?.innerText || pre.innerText;
            navigator.clipboard.writeText(code).then(() => {
                this.textContent = 'Copied!';
                this.style.color = 'var(--semantic-success)';
                setTimeout(() => { this.textContent = 'Copy'; this.style.color = ''; }, 1800);
            });
        });

        pre.insertBefore(header, pre.firstChild);

        // Apply syntax highlighting only if not already done
        if (codeEl && window.hljs && !codeEl.dataset.highlighted) {
            try {
                hljs.highlightElement(codeEl);
                codeEl.dataset.highlighted = 'yes';
            } catch(e) {}
        }
    });
}

function scrollToBottom() {
    chatViewport.scrollTop = chatViewport.scrollHeight;
}

// ── Send Message & Streaming Agent Execution ───────────────────────────
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && attachedFiles.length === 0) return;

    let fullPrompt = text;
    const currentImages = attachedFiles.filter(f => f.is_image);
    if (attachedFiles.length > 0) {
        const attachText = attachedFiles.map(f => `\n\n[Attached File: ${f.filename}]\n${f.preview}`).join('');
        fullPrompt += attachText;
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;

    const attachedImagesCopy = [...currentImages];
    clearAttachments();

    renderMessage('user', text, [], [], false, attachedImagesCopy);
    currentMessages.push({ role: 'user', content: fullPrompt });

    const aiBubble = renderMessage('assistant', '');
    let accumulatedResponse = '';
    let thinkingLogs = [];
    let detectedArtifacts = [];
    let decomposedPlan = null;
    let currentStepProgress = null;
    let intentDisambiguation = null;
    let refinementData = null;

    agentLoopText.textContent = 'Agent Executing...';

    try {
        const response = await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                messages: currentMessages,
                model: getSelectedModelId(),
                target_folder: targetFolderInput?.value.trim() || '',
                system_prompt: projectInstructions,
                deep_decompose: deepDecompose,
                persona: currentPersona || 'fullstack',
                autonomous_mode: autonomousMode,
                best_of_best: bestOfBestMode
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}. Ensure backend is active.`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        let renderRafId = null;
        let isDirty = false;
        let groundingTelemetry = null;

        const scheduleBubbleUpdate = () => {
            isDirty = true;
            if (renderRafId) return;
            renderRafId = requestAnimationFrame(() => {
                renderRafId = null;
                if (isDirty) {
                    updateAssistantBubble(aiBubble, thinkingLogs, accumulatedResponse, detectedArtifacts, decomposedPlan, currentStepProgress, intentDisambiguation, groundingTelemetry, refinementData);
                    isDirty = false;
                }
            });
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.needs_permission) {
                        if (renderRafId) cancelAnimationFrame(renderRafId);
                        showPermissionModal();
                        thinkingLogs.push('Local Agent paused — authorization required.');
                        updateAssistantBubble(aiBubble, thinkingLogs, '', [], decomposedPlan, currentStepProgress, intentDisambiguation, groundingTelemetry, refinementData);
                        return;
                    } else if (data.intent_disambiguation) {
                        intentDisambiguation = data.intent_disambiguation;
                        scheduleBubbleUpdate();
                    } else if (data.self_rag) {
                        thinkingLogs.push(`Self-RAG Intent Analysis: ${data.self_rag.intent} (Retrieval: ${data.self_rag.needs_retrieval ? 'Active' : 'Direct'})`);
                        scheduleBubbleUpdate();
                    } else if (data.grounding) {
                        groundingTelemetry = data.grounding;
                        scheduleBubbleUpdate();
                    } else if (data.refinement_loop) {
                        refinementData = data.refinement_loop;
                        scheduleBubbleUpdate();
                    } else if (data.decomposed_plan) {
                        decomposedPlan = data.decomposed_plan;
                        scheduleBubbleUpdate();
                    } else if (data.step_progress) {
                        currentStepProgress = data.step_progress;
                        scheduleBubbleUpdate();
                    } else if (data.thinking) {
                        thinkingLogs.push(data.thinking);
                        scheduleBubbleUpdate();
                    } else if (data.system) {
                        thinkingLogs.push(`System: ${data.system}`);
                        scheduleBubbleUpdate();
                    } else if (data.content) {
                        accumulatedResponse += data.content;
                        if (data.artifacts && data.artifacts.length > 0) {
                            detectedArtifacts = data.artifacts;
                        }
                        scheduleBubbleUpdate();
                    }
                } catch (e) {}
            }
        }

        if (renderRafId) {
            cancelAnimationFrame(renderRafId);
            renderRafId = null;
        }
        // Final complete update
        updateAssistantBubble(aiBubble, thinkingLogs, accumulatedResponse, detectedArtifacts, decomposedPlan, currentStepProgress, intentDisambiguation, groundingTelemetry, refinementData);

        if (accumulatedResponse) {
            currentMessages.push({ role: 'assistant', content: accumulatedResponse });
            if (detectedArtifacts.length > 0) {
                openArtifact(detectedArtifacts[0]);
            }
            loadSessions();

            // 🎙️ Conversational Voice Mode Auto-Speak
            if (window.voiceAgentController && window.voiceAgentController.active && window.voiceAgentController.autoSpeak) {
                window.voiceAgentController.speakText(accumulatedResponse, fullPrompt);
            }
        }

    } catch (err) {
        thinkingLogs.push(`Execution Error: ${err.message}`);
        updateAssistantBubble(aiBubble, thinkingLogs, `### Execution Error\n\nCould not communicate with the agent backend: \`${err.message}\``, []);
    } finally {
        sendButton.disabled = messageInput.value.trim().length === 0;
        agentLoopText.textContent = 'Autonomous Agent Active';
        messageInput.focus();
        scrollToBottom();
    }
}

// ── File Upload & Multimodal Vision Attachments ─────────────────────────
async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') {
                attachedFiles.push(data);
                renderAttachmentsBar();
                sendButton.disabled = false;
            }
        } catch (e) {
            console.error('File upload failed:', e);
        }
    }
}

function renderAttachmentsBar() {
    if (!attachmentsBar) return;
    if (attachedFiles.length === 0) {
        attachmentsBar.style.display = 'none';
        attachmentsBar.innerHTML = '';
        return;
    }

    attachmentsBar.style.display = 'flex';
    attachmentsBar.innerHTML = attachedFiles.map((f, idx) => {
        if (f.is_image) {
            return `
                <div class="composer-image-attachment">
                    <img src="${escapeHtml(f.image_url || f.base64_thumb)}" class="composer-image-thumb" alt="${escapeHtml(f.filename)}">
                    <span>${escapeHtml(f.filename)}</span>
                    <button class="attachment-chip-remove" onclick="removeAttachment(${idx})">✕</button>
                </div>
            `;
        }
        return `
            <div class="attachment-chip">
                <span>${escapeHtml(f.filename)}</span>
                <button class="attachment-chip-remove" onclick="removeAttachment(${idx})">✕</button>
            </div>
        `;
    }).join('');
}

window.removeAttachment = function(idx) {
    attachedFiles.splice(idx, 1);
    renderAttachmentsBar();
    if (attachedFiles.length === 0 && messageInput.value.trim().length === 0) {
        sendButton.disabled = true;
    }
};

function clearAttachments() {
    attachedFiles = [];
    renderAttachmentsBar();
}

// ── Lightbox Modal Controls ───────────────────────────────────────────
window.openImageLightbox = function(src) {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (lightbox && img) {
        img.src = src;
        lightbox.style.display = 'flex';
    }
};

window.closeImageLightbox = function() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
    }
};

window.removeAttachment = function(idx) {
    attachedFiles.splice(idx, 1);
    renderAttachmentsBar();
};

function clearAttachments() {
    attachedFiles = [];
    renderAttachmentsBar();
}

// ── Permissions & System Status ────────────────────────────────────────
async function checkPermissions() {
    try {
        const res = await fetch(PERM_STATUS_URL);
        const data = await res.json();
        if (!data.granted) showPermissionModal();
    } catch (e) {}
}

function showPermissionModal() {
    if (permOverlay) permOverlay.style.display = 'flex';
}

function hidePermissionModal() {
    if (permOverlay) permOverlay.style.display = 'none';
}

async function checkRagStatus() {
    try {
        const res = await fetch(RAG_STATUS_URL);
        const data = await res.json();
        const label = document.getElementById('rag-status-label');
        if (label && data.memories_count !== undefined) {
            label.textContent = `🧠 RAG Memory (${data.memories_count} items)`;
        }
    } catch (e) {}
}
window.checkRagStatus = checkRagStatus;
setInterval(checkRagStatus, 8000);


// ── Event Listeners Setup ──────────────────────────────────────────────
function setupEventListeners() {
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        sendButton.disabled = this.value.trim().length === 0 && attachedFiles.length === 0;
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) sendMessage();
        }
    });

    sendButton.addEventListener('click', () => {
        if (!sendButton.disabled) sendMessage();
    });

    newChatBtn.addEventListener('click', () => startNewChat(true));

    toggleSidebarBtn.addEventListener('click', () => {
        if (window.innerWidth <= 960) {
            const isOpen = sidebar.classList.toggle('open');
            sidebar.classList.remove('collapsed');
            sidebarOverlay.classList.toggle('active', isOpen);
        } else {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        }
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });

    // Shortcuts Modal Search & Button Listeners
    const shortcutsSearchInput = document.getElementById('shortcuts-search-input');
    if (shortcutsSearchInput) {
        shortcutsSearchInput.addEventListener('input', () => filterShortcuts(shortcutsSearchInput.value.trim()));
    }
    const topbarShortcutsBtn = document.getElementById('topbar-shortcuts-btn');
    if (topbarShortcutsBtn) {
        topbarShortcutsBtn.addEventListener('click', openShortcutsModal);
    }

    attachFileBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => handleFileUpload(e.target.files));

    // Deep Prompt Decomposition Toggle
    const decomposeToggleBtn = document.getElementById('decompose-toggle-btn');
    if (decomposeToggleBtn) {
        decomposeToggleBtn.addEventListener('click', () => toggleDecompose(true));
    }

    // Best-of-the-Best Evaluator-Optimizer Toggle
    const bestOfBestToggleBtn = document.getElementById('best-of-best-toggle-btn');
    if (bestOfBestToggleBtn) {
        bestOfBestToggleBtn.classList.toggle('active', bestOfBestMode);
        bestOfBestToggleBtn.addEventListener('click', () => toggleBestOfBest(true));
    }

    // MCP Modal Tab Navigation
    mcpTabActiveBtn?.addEventListener('click', () => switchMcpTab('active'));
    mcpTabAddBtn?.addEventListener('click', () => switchMcpTab('add'));
    mcpTabPresetsBtn?.addEventListener('click', () => switchMcpTab('presets'));
    mcpTabJsonBtn?.addEventListener('click', () => switchMcpTab('json'));

    openMcpBtn?.addEventListener('click', () => {
        loadMcpServers();
        loadMcpPresets();
        switchMcpTab('active');
        mcpModal.style.display = 'flex';
    });
    topbarMcpBtn?.addEventListener('click', () => {
        loadMcpServers();
        loadMcpPresets();
        switchMcpTab('active');
        mcpModal.style.display = 'flex';
    });
    closeMcpModal?.addEventListener('click', () => mcpModal.style.display = 'none');
    closeMcpBtn?.addEventListener('click', () => mcpModal.style.display = 'none');

    // Add Custom MCP Server Form Submit
    mcpAddBtn?.addEventListener('click', async () => {
        const name = mcpNameInput.value.trim();
        const cmd = mcpCmdInput.value.trim();
        const rawArgs = mcpArgsInput.value.trim();
        const rawEnv = mcpEnvInput.value.trim();
        if (!cmd) return alert('Executable command is required (e.g. npx, python, node).');

        let args = [];
        if (rawArgs.startsWith('[')) {
            try { args = JSON.parse(rawArgs); } catch (e) { args = rawArgs.split(/\s+/); }
        } else if (rawArgs) {
            args = rawArgs.split(/\s+/);
        }

        let env = {};
        if (rawEnv) {
            try { env = JSON.parse(rawEnv); } catch (e) { alert('Environment Variables must be a valid JSON object.'); return; }
        }

        const serverId = (name || cmd).toLowerCase().replace(/[^a-z0-9_-]/g, '-');

        try {
            const res = await fetch(MCP_SERVERS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: serverId, name: name || cmd, command: cmd, args, env })
            });
            const data = await res.json();
            if (data.status === 'success') {
                mcpNameInput.value = '';
                mcpCmdInput.value = '';
                mcpArgsInput.value = '';
                mcpEnvInput.value = '';
                await loadMcpServers();
                switchMcpTab('active');
                testMcpServer(serverId);
            } else {
                alert(data.message || 'Failed to add MCP server.');
            }
        } catch (e) {
            alert('Failed to register MCP server.');
        }
    });

    // Import Raw JSON Config
    mcpImportJsonBtn?.addEventListener('click', async () => {
        const raw = mcpJsonTextarea.value.trim();
        if (!raw) return alert('Please paste JSON configuration.');

        try {
            const res = await fetch(MCP_IMPORT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json_config: raw })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert(data.message || 'Servers imported successfully.');
                mcpJsonTextarea.value = '';
                await loadMcpServers();
                switchMcpTab('active');
            } else {
                alert(data.message || 'Import failed.');
            }
        } catch (e) {
            alert('Network error while importing JSON.');
        }
    });

    // Artifact Drawer Handlers
    tabPreviewBtn.addEventListener('click', () => switchArtifactTab('preview'));
    tabCodeBtn.addEventListener('click', () => switchArtifactTab('code'));
    tabConsoleBtn.addEventListener('click', () => switchArtifactTab('console'));
    artCloseBtn?.addEventListener('click', closeArtifactDrawer);
    toggleArtifactPaneBtn?.addEventListener('click', () => {
        if (!artifactDrawer || artifactDrawer.style.display === 'none' || !artifactDrawer.style.display) {
            showArtifactDrawer();
        } else {
            closeArtifactDrawer();
        }
    });

    clearConsoleBtn?.addEventListener('click', () => {
        consoleLogs = [];
        consoleLogsList.innerHTML = '<div class="console-empty">No console logs.</div>';
        if (consoleCountBadge) consoleCountBadge.style.display = 'none';
    });

    artCopyBtn.addEventListener('click', () => {
        if (currentArtifact) {
            navigator.clipboard.writeText(currentArtifact.content);
            artCopyBtn.style.color = 'var(--semantic-success)';
            setTimeout(() => artCopyBtn.style.color = '', 1500);
        }
    });

    artDownloadBtn.addEventListener('click', () => {
        if (!currentArtifact) return;
        const ext = currentArtifact.language === 'html' ? 'html' : (currentArtifact.language === 'python' ? 'py' : 'txt');
        const blob = new Blob([currentArtifact.content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${currentArtifact.identifier || 'artifact'}.${ext}`;
        a.click();
    });

    artPopoutBtn.addEventListener('click', () => {
        if (!currentArtifact) return;
        const win = window.open('', '_blank');
        win.document.write(currentArtifact.content);
        win.document.close();
    });

    // Project Instructions Handlers
    openInstructionsBtn?.addEventListener('click', () => {
        if (projectInstructionsTextarea) projectInstructionsTextarea.value = projectInstructions;
        if (instructionsModal) instructionsModal.style.display = 'flex';
    });
    closeInstructionsModal?.addEventListener('click', () => { if (instructionsModal) instructionsModal.style.display = 'none'; });
    cancelInstructionsBtn?.addEventListener('click', () => { if (instructionsModal) instructionsModal.style.display = 'none'; });
    saveInstructionsBtn?.addEventListener('click', () => {
        if (projectInstructionsTextarea) projectInstructions = projectInstructionsTextarea.value.trim();
        localStorage.setItem('gemini_project_instructions', projectInstructions);
        if (instructionsModal) instructionsModal.style.display = 'none';
    });

    // Permissions Handlers
    if (permAllowBtn) {
        permAllowBtn.addEventListener('click', async () => {
            permAllowBtn.disabled = true;
            permAllowBtn.textContent = 'Saving...';
            try {
                const res = await fetch(PERM_GRANT_URL, { method: 'POST' });
                const d = await res.json();
                if (d.status === 'granted') {
                    hidePermissionModal();
                }
            } catch (e) {
                permStatusMsg.textContent = 'Error contacting backend.';
            }
        });
    }

    if (permDenyBtn) {
        permDenyBtn.addEventListener('click', () => hidePermissionModal());
    }

    // User Profile & Onboarding Handlers
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const menuStartOnboardBtn = document.getElementById('menu-start-onboard-btn');
    const menuThemePickerBtn = document.getElementById('menu-theme-picker-btn');
    const menuViewMemoriesBtn = document.getElementById('menu-view-memories-btn');
    const menuSwitchUserBtn = document.getElementById('menu-switch-user-btn');

    if (userAvatarBtn && userDropdownMenu) {
        userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            userDropdownMenu.classList.remove('show');
        });
        userDropdownMenu.addEventListener('click', (e) => e.stopPropagation());
    }

    if (menuStartOnboardBtn) {
        menuStartOnboardBtn.addEventListener('click', () => openOnboardingModal(1));
    }
    if (menuThemePickerBtn) {
        menuThemePickerBtn.addEventListener('click', () => openOnboardingModal(4));
    }
    if (menuViewMemoriesBtn) {
        menuViewMemoriesBtn.addEventListener('click', () => openOnboardingModal(5));
    }
    if (menuSwitchUserBtn) {
        menuSwitchUserBtn.addEventListener('click', () => openOnboardingModal(2));
    }

    const onboardBackBtn = document.getElementById('onboard-back-btn');
    const onboardNextBtn = document.getElementById('onboard-next-btn');

    if (onboardBackBtn) {
        onboardBackBtn.addEventListener('click', () => {
            if (currentOnboardStep > 1) {
                currentOnboardStep--;
                renderOnboardStep(currentOnboardStep);
            }
        });
    }

    if (onboardNextBtn) {
        onboardNextBtn.addEventListener('click', async () => {
            if (currentOnboardStep === 2) {
                const nameInput = document.getElementById('onboard-name-input');
                if (nameInput && nameInput.value.trim()) {
                    onboardDraft.user_name = nameInput.value.trim();
                }
            }
            if (currentOnboardStep < 6) {
                currentOnboardStep++;
                renderOnboardStep(currentOnboardStep);
            } else {
                // Step 6: Save & Activate
                onboardNextBtn.textContent = 'Launching Studio...';
                await saveUserProfile(onboardDraft);
                localStorage.setItem('b1_onboarding_completed', 'true');
                applyTheme(onboardDraft.theme || 'linear-obsidian');
                closeOnboardingModal();
                showToast('🚀 Workspace Ready with Full Permissions!', 'success', 3000);
            }
        });
    }
    // ── Command Palette Button ──
    const cmdPaletteBtn = document.getElementById('cmd-palette-btn');
    if (cmdPaletteBtn) {
        cmdPaletteBtn.addEventListener('click', () => openCommandPalette());
    }

    // ── Export Chat Button ──
    const exportChatBtn = document.getElementById('export-chat-btn');
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', () => openExportModal());
    }

    // ── Save Artifact Button ──
    const artSaveProjectBtn = document.getElementById('art-save-project-btn');
    if (artSaveProjectBtn) {
        artSaveProjectBtn.addEventListener('click', () => saveCurrentArtifactToProject());
    }

    // ── Live Code Editor Run Button ──
    const runEditedCodeBtn = document.getElementById('run-edited-code-btn');
    const artCodeEditor = document.getElementById('art-code-editor');
    if (runEditedCodeBtn && artCodeEditor) {
        runEditedCodeBtn.addEventListener('click', () => {
            if (currentArtifact) {
                currentArtifact.content = artCodeEditor.value;
                renderPreviewFrame(currentArtifact.content);
                switchArtifactTab('preview');
            }
        });
        artCodeEditor.addEventListener('input', () => {
            const codePaneLines = document.getElementById('code-pane-lines');
            if (codePaneLines) {
                const lines = artCodeEditor.value.split('\n').length;
                codePaneLines.textContent = `${lines} lines`;
            }
        });
    }

    // ── Clipboard Paste: Images (Ctrl+V) ──
    messageInput.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) handleFileUpload([file]);
                break;
            }
        }
    });

    // Also allow pasting anywhere on the page (when not in an input)
    document.addEventListener('paste', (e) => {
        if (document.activeElement === messageInput) return; // handled above
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handleFileUpload([file]);
                    messageInput.focus();
                }
                break;
            }
        }
    });

    // ── Initialize Voice Dictation & Command Palette ──
    initVoiceDictation();
    initCommandPalette();

    // ── Window Resize: Sync Drawer Overlay & Responsive Layout ──
    window.addEventListener('resize', () => {
        const overlay = document.getElementById('drawer-overlay');
        if (overlay && artifactDrawer) {
            if (artifactDrawer.style.display !== 'none' && artifactDrawer.style.display !== '') {
                overlay.classList.toggle('active', window.innerWidth < 1440);
            } else {
                overlay.classList.remove('active');
            }
        }
        if (window.innerWidth > 960 && sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            sidebarOverlay?.classList.remove('active');
        }
    });
}

// ── Global Command Palette (Ctrl+K) ──────────────────────────────────
const COMMANDS_REGISTRY = [
    { id: 'switch_model', title: 'Switch AI Model (Alt+M)', desc: 'Choose Gemini 2.0 Flash, Thinking, Pro Exp or 1.5 models', cat: 'actions', icon: '✦', action: () => openModelSwitchModal() },
    { id: 'model_20_flash', title: 'Model: Gemini 2.0 Flash (Recommended)', desc: 'Switch to official Gemini 2.0 Flash for sub-second execution', cat: 'actions', icon: '⚡', action: () => selectModel('gemini-2.0-flash') },
    { id: 'model_20_thinking', title: 'Model: Gemini 2.0 Flash Thinking', desc: 'Switch to Gemini 2.0 Flash Thinking with deep reasoning traces', cat: 'actions', icon: '🤔', action: () => selectModel('gemini-2.0-flash-thinking-exp-01-21') },
    { id: 'model_20_pro', title: 'Model: Gemini 2.0 Pro Exp (Frontier)', desc: 'Switch to Gemini 2.0 Pro Exp for deep architectural reasoning', cat: 'actions', icon: '🧠', action: () => selectModel('gemini-2.0-pro-exp-02-05') },
    { id: 'new_chat', title: 'New Conversation (Ctrl+N)', desc: 'Start a fresh conversation and reset workspace', cat: 'actions', icon: '✦', action: () => startNewChat(true) },
    { id: 'voice_input', title: 'Voice Dictation (Ctrl+M)', desc: 'Speak to prompt with real-time speech-to-text dictation', cat: 'actions', icon: '🎙️', action: () => toggleVoiceDictation() },
    { id: 'shortcuts_help', title: 'Keyboard Shortcuts Cheatsheet (?)', desc: 'Inspect all hotkeys, shortcuts, and keybindings', cat: 'actions', icon: '⌨️', action: () => openShortcutsModal() },
    { id: 'toggle_auto', title: 'Toggle Autonomous Mode (Ctrl+Shift+A)', desc: 'Switch autonomous multi-turn ReAct execution', cat: 'actions', icon: '⚡', action: () => toggleAutonomousMode(true) },
    { id: 'cycle_persona', title: 'Cycle Specialist Persona (Ctrl+Shift+P)', desc: 'Switch Architect, Fullstack, STEM, Security, Researcher', cat: 'actions', icon: '👤', action: () => cycleNextPersona() },
    { id: 'open_terminal', title: 'Open Integrated Terminal Dock (Ctrl+Shift+T)', desc: 'Interactive shell and PowerShell execution dock', cat: 'actions', icon: '💻', action: () => openTerminalDock() },
    { id: 'open_files', title: 'Open Workspace Codebase Tree (Ctrl+Shift+F)', desc: 'Inspect project files, code, and folder tree', cat: 'actions', icon: '📁', action: () => openWorkspacePane() },
    { id: 'export_md', title: 'Export Chat to Markdown (.md)', desc: 'Download readable transcript with code blocks', cat: 'actions', icon: '📄', action: () => exportConversation('markdown') },
    { id: 'export_json', title: 'Export Chat to JSON (.json)', desc: 'Download structured conversation transcript', cat: 'actions', icon: '💾', action: () => exportConversation('json') },
    { id: 'toggle_decompose', title: 'Toggle Deep Decompose (Ctrl+Shift+D)', desc: 'Switch multi-stage divide-and-conquer execution', cat: 'actions', icon: '⚡', action: () => toggleDecompose(true) },
    { id: 'stem_projectile', title: 'STEM: 2D Projectile Motion Sandbox', desc: 'Simulate quadratic drag with Euler-Cromer sliders', cat: 'stem', icon: '🚀', action: () => quickPrompt('Simulate and visualize 2D projectile motion with quadratic air drag, Euler-Cromer numerical integration, and real-time velocity/angle sliders.') },
    { id: 'stem_fourier', title: 'STEM: Fourier Series & Epicycles', desc: 'Visualize rotating phasors and square wave synthesis', cat: 'stem', icon: '〰️', action: () => quickPrompt('Explain the Fourier Series and how square waves are composed of harmonics with interactive epicycles and sliders.') },
    { id: 'stem_gradient', title: 'STEM: 2D Gradient Descent Optimizer', desc: 'Interactive contour plot and step-by-step path optimization', cat: 'stem', icon: '📉', action: () => quickPrompt('Visualize gradient descent optimization for 2D function with learning rate sliders.') },
    { id: 'stem_double_pendulum', title: 'STEM: Chaotic Double Pendulum', desc: 'Lagrangian mechanics simulation with trajectory trails', cat: 'stem', icon: '⏳', action: () => quickPrompt('Explain how the Double Pendulum exhibits chaotic motion, and visualize its trajectories with interactive angle sliders.') },
    { id: 'app_synth', title: 'Web App: 8-Bit Synthesizer', desc: '16-step matrix sequencer with Web Audio API and FFT visualizer', cat: 'actions', icon: '🎹', action: () => quickPrompt('Build a retro 8-bit Synthesizer & Step Sequencer with Web Audio API and visual equalizer.') },
    { id: 'mcp_hub', title: 'MCP Servers Manager (Ctrl+Shift+M)', desc: 'Inspect active Model Context Protocol tools and connections', cat: 'mcp', icon: '🔌', action: () => openMasterSettingsTab('mcp') },
    { id: 'mcp_inspect', title: 'MCP: Workspace File Audit', desc: 'Use filesystem tools to inspect storage and core codebases', cat: 'mcp', icon: '🔍', action: () => quickPrompt('Use your MCP filesystem and system tools to inspect the current project directory, list all files in storage and core, and check system status.') },
    { id: 'theme_obsidian', title: 'Theme: Linear Obsidian', desc: 'Deep black with sharp hairline borders and violet accents', cat: 'theme', icon: '🎨', action: () => applyTheme('linear-obsidian') },
    { id: 'theme_lavender', title: 'Theme: Midnight Lavender', desc: 'Deep purple hue with vibrant glow effects', cat: 'theme', icon: '🎨', action: () => applyTheme('midnight-lavender') },
    { id: 'theme_matrix', title: 'Theme: Cyber Matrix', desc: 'Dark obsidian with high-contrast electric green glow', cat: 'theme', icon: '🎨', action: () => applyTheme('cyber-matrix') },
    { id: 'theme_slate', title: 'Theme: Monochrome Slate', desc: 'Clean slate gray minimalist dark mode', cat: 'theme', icon: '🎨', action: () => applyTheme('monochrome-slate') },
    { id: 'user_profile', title: 'Personalization & Onboarding', desc: 'Update B1 paired developer profile and memory', cat: 'actions', icon: '👤', action: () => openOnboardingModal(1) }
];

let selectedCmdIndex = 0;
let filteredCommands = [];
let activeCmdCategory = 'all';

function initCommandPalette() {
    const searchInput = document.getElementById('cmd-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderCommandPalette(searchInput.value.trim());
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedCmdIndex < filteredCommands.length - 1) {
                    selectedCmdIndex++;
                    updateCmdSelection();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selectedCmdIndex > 0) {
                    selectedCmdIndex--;
                    updateCmdSelection();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedCmdIndex]) {
                    executeCommand(filteredCommands[selectedCmdIndex]);
                }
            }
        });
    }

    document.querySelectorAll('.cmd-cat-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.cmd-cat-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            activeCmdCategory = this.getAttribute('data-cat') || 'all';
            renderCommandPalette(searchInput ? searchInput.value.trim() : '');
        });
    });
}

function openCommandPalette() {
    const modal = document.getElementById('cmd-palette-modal');
    const searchInput = document.getElementById('cmd-search-input');
    if (!modal) return;
    modal.style.display = 'flex';
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    renderCommandPalette('');
}

function closeCommandPalette() {
    const modal = document.getElementById('cmd-palette-modal');
    if (modal) modal.style.display = 'none';
}

function renderCommandPalette(query = '') {
    const list = document.getElementById('cmd-results-list');
    if (!list) return;

    const q = query.toLowerCase();
    filteredCommands = COMMANDS_REGISTRY.filter(cmd => {
        const matchesCat = (activeCmdCategory === 'all' || cmd.cat === activeCmdCategory);
        const matchesQuery = !q || cmd.title.toLowerCase().includes(q) || cmd.desc.toLowerCase().includes(q);
        return matchesCat && matchesQuery;
    });

    selectedCmdIndex = 0;

    if (filteredCommands.length === 0) {
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--ink-tertiary); font-size: 13px;">No commands matching "${escapeHtml(query)}"</div>`;
        return;
    }

    list.innerHTML = filteredCommands.map((cmd, idx) => `
        <div class="cmd-item ${idx === 0 ? 'selected' : ''}" data-cmd-id="${cmd.id}" onclick="window.triggerCmdClick(${idx})">
            <div class="cmd-item-left">
                <div class="cmd-item-icon">${cmd.icon}</div>
                <div class="cmd-item-info">
                    <span class="cmd-item-title">${escapeHtml(cmd.title)}</span>
                    <span class="cmd-item-desc">${escapeHtml(cmd.desc)}</span>
                </div>
            </div>
            <span class="cmd-item-badge">${escapeHtml(cmd.cat.toUpperCase())}</span>
        </div>
    `).join('');
}

function updateCmdSelection() {
    const items = document.querySelectorAll('.cmd-item');
    items.forEach((item, idx) => {
        if (idx === selectedCmdIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

window.triggerCmdClick = function(index) {
    if (filteredCommands[index]) {
        executeCommand(filteredCommands[index]);
    }
};

function executeCommand(cmd) {
    closeCommandPalette();
    if (cmd && typeof cmd.action === 'function') {
        cmd.action();
    }
}

// ── Voice Input Dictation (Web Speech API) ─────────────────────────────
function initVoiceDictation() {
    const voiceBtn = document.getElementById('voice-input-btn');
    if (!voiceBtn) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        voiceBtn.title = 'Speech Recognition not supported in this browser';
        voiceBtn.style.opacity = '0.5';
        return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let isListening = false;

    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                isListening = true;
                voiceBtn.classList.add('listening');
            } catch (e) {
                console.error('Speech recognition error:', e);
            }
        }
    });

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        if (messageInput) {
            messageInput.value = transcript;
            messageInput.dispatchEvent(new Event('input'));
        }
    };

    recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('listening');
    };

    recognition.onerror = (e) => {
        console.warn('Speech Recognition error:', e.error);
        isListening = false;
        voiceBtn.classList.remove('listening');
    };
}

// ── Export Conversation Engine ─────────────────────────────────────────
function openExportModal() {
    const modal = document.getElementById('export-chat-modal');
    if (modal) modal.style.display = 'flex';
}

function closeExportModal() {
    const modal = document.getElementById('export-chat-modal');
    if (modal) modal.style.display = 'none';
}

function exportConversation(format = 'markdown') {
    closeExportModal();
    const title = activeChatTitle?.textContent || 'B1 Conversation';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'markdown') {
        let md = `# ${title}\n\n*Exported from B1 Studio on ${new Date().toLocaleString()}*\n\n---\n\n`;
        currentMessages.forEach(msg => {
            const speaker = msg.role === 'user' ? '### Ishaan Sen (User)' : '### B1 Assistant';
            md += `${speaker}\n\n${msg.content}\n\n---\n\n`;
        });

        downloadFile(`b1_chat_${dateStr}.md`, md, 'text/markdown');
    } else if (format === 'json') {
        const payload = {
            title: title,
            sessionId: currentSessionId,
            exportedAt: new Date().toISOString(),
            messages: currentMessages
        };
        downloadFile(`b1_transcript_${dateStr}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function quickPrompt(text) {
    messageInput.value = text;
    messageInput.dispatchEvent(new Event('input'));
    setTimeout(() => sendMessage(), 100);
}

// ── Specialist Persona Controller ──────────────────────────────────────
let currentPersona = localStorage.getItem('b1_active_persona') || 'fullstack';

const PERSONA_CONFIGS = {
    'fullstack': { name: 'Fullstack', icon: '⚡' },
    'architect': { name: 'Architect', icon: '🏗️' },
    'stem': { name: 'STEM Sim', icon: '🔬' },
    'security': { name: 'Security', icon: '🛡️' },
    'researcher': { name: 'Researcher', icon: '🔍' }
};

window.selectPersona = function(personaId) {
    if (!PERSONA_CONFIGS[personaId]) return;
    currentPersona = personaId;
    localStorage.setItem('b1_active_persona', personaId);

    const cfg = PERSONA_CONFIGS[personaId];
    const iconEl = document.getElementById('current-persona-icon');
    const nameEl = document.getElementById('current-persona-name');
    if (iconEl) iconEl.textContent = cfg.icon;
    if (nameEl) nameEl.textContent = cfg.name;

    document.querySelectorAll('.persona-option').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-persona') === personaId);
    });

    const dropdown = document.getElementById('persona-dropdown');
    if (dropdown) dropdown.classList.remove('show');
};

window.cycleNextPersona = function() {
    const keys = Object.keys(PERSONA_CONFIGS);
    const currIdx = keys.indexOf(currentPersona);
    const nextIdx = (currIdx + 1) % keys.length;
    const nextPersona = keys[nextIdx];
    selectPersona(nextPersona);
    const cfg = PERSONA_CONFIGS[nextPersona];
    showToast(`${cfg.icon} Specialist Persona: ${cfg.name}`, 'persona');
};

// ── Autonomous Agent ReAct Loop Mode ──────────────────────────────────
let autonomousMode = true;

window.toggleAutonomousMode = function(notify = false) {
    autonomousMode = !autonomousMode;
    const pill = document.getElementById('agent-loop-pill');
    const text = document.getElementById('agent-loop-text');
    if (pill) {
        pill.classList.toggle('active', autonomousMode);
        pill.style.borderColor = autonomousMode ? 'rgba(39, 166, 68, 0.4)' : 'var(--hairline)';
    }
    if (text) {
        text.textContent = autonomousMode ? 'Autonomous Mode: ON' : 'Interactive Mode: ON';
    }
    if (notify) {
        showToast(autonomousMode ? '⚡ Autonomous Agent: Enabled' : '⏸ Interactive Mode: Enabled', autonomousMode ? 'success' : 'info');
    }
};

window.toggleDecompose = function(notify = false) {
    deepDecompose = !deepDecompose;
    const decomposeToggleBtn = document.getElementById('decompose-toggle-btn');
    if (decomposeToggleBtn) {
        decomposeToggleBtn.classList.toggle('active', deepDecompose);
    }
    if (notify) {
        showToast(deepDecompose ? '⚡ Analytical Reasoning: Enabled' : '○ Analytical Reasoning: Disabled', deepDecompose ? 'success' : 'info');
    }
};

window.toggleBestOfBest = function(notify = false) {
    bestOfBestMode = !bestOfBestMode;
    localStorage.setItem('b1_best_of_best', bestOfBestMode ? 'true' : 'false');
    const btn = document.getElementById('best-of-best-toggle-btn');
    if (btn) {
        btn.classList.toggle('active', bestOfBestMode);
    }
    if (notify) {
        showToast(bestOfBestMode ? '✦ Quality Optimizer: Enabled (AST Audit & Accuracy Loop)' : '○ Quality Optimizer: Disabled', bestOfBestMode ? 'success' : 'info');
    }
};

// ── Workspace Codebase Explorer ────────────────────────────────────────
window.openWorkspacePane = function() {
    showArtifactDrawer();
    switchArtifactTab('files');
};

window.loadWorkspaceTree = async function() {
    const container = document.getElementById('workspace-tree-container');
    const rootLabel = document.getElementById('files-root-name');
    if (!container) return;

    container.innerHTML = '<div class="session-skeleton" style="padding:12px;">Scanning workspace codebase...</div>';

    try {
        const target = targetFolderInput?.value.trim() || '';
        const res = await fetch(`${API_BASE}/workspace/tree?path=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data.status === 'success') {
            if (rootLabel) rootLabel.textContent = data.name || 'Workspace';
            container.innerHTML = renderTreeNodes(data.tree);
        } else {
            container.innerHTML = `<div style="color:var(--semantic-error);padding:12px;">${escapeHtml(data.message || 'Failed to scan files')}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--ink-tertiary);padding:12px;">Error scanning workspace: ${e.message}</div>`;
    }
};

function renderTreeNodes(nodes, depth = 0) {
    if (!nodes || nodes.length === 0) return '<div style="color:var(--ink-tertiary);padding:8px 12px;">(Empty folder)</div>';

    return nodes.map(node => {
        if (node.is_dir) {
            const childHtml = node.children && node.children.length > 0 ? renderTreeNodes(node.children, depth + 1) : '';
            return `
                <div class="tree-folder-group">
                    <div class="tree-node is-dir" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <span class="tree-node-icon">📁</span>
                        <span>${escapeHtml(node.name)}</span>
                        <span class="tree-node-size">${node.count || 0}</span>
                    </div>
                    <div class="tree-children" style="display:block;">
                        ${childHtml}
                    </div>
                </div>
            `;
        } else {
            const sizeStr = node.size < 1024 ? `${node.size} B` : `${Math.round(node.size/1024)} KB`;
            const icon = node.ext === 'py' ? '🐍' : (node.ext === 'js' ? '⚡' : (node.ext === 'html' ? '🌐' : (node.ext === 'json' || node.ext === 'db' ? '💾' : '📄')));
            return `
                <div class="tree-node" onclick="openFileFromTree('${escapeHtml(node.path)}')">
                    <span class="tree-node-icon">${icon}</span>
                    <span>${escapeHtml(node.name)}</span>
                    <span class="tree-node-size">${sizeStr}</span>
                </div>
            `;
        }
    }).join('');
}

window.openFileFromTree = async function(relPath) {
    try {
        const res = await fetch(`${API_BASE}/workspace/file?path=${encodeURIComponent(relPath)}`);
        const data = await res.json();
        if (data.status === 'success') {
            const artEditor = document.getElementById('art-code-editor');
            const langLabel = document.getElementById('code-pane-lang');
            const linesLabel = document.getElementById('code-pane-lines');
            const headerTitle = document.getElementById('art-header-title');
            const headerBadge = document.getElementById('art-header-badge');

            if (artEditor) artEditor.value = data.content;
            if (langLabel) langLabel.textContent = data.ext.toUpperCase();
            if (linesLabel) linesLabel.textContent = `${data.content.split('\n').length} lines`;
            if (headerTitle) headerTitle.textContent = data.filename;
            if (headerBadge) headerBadge.textContent = `${data.ext.toUpperCase()} File (${Math.round(data.size/1024)} KB)`;

            currentArtifact = {
                identifier: data.filename,
                title: data.filename,
                language: data.ext,
                type: 'application/vnd.ant.code',
                content: data.content
            };

            switchArtifactTab('code');
        } else {
            alert(data.message || 'Could not open file');
        }
    } catch (e) {
        alert('Failed to read file from backend.');
    }
};

window.indexCurrentWorkspace = async function() {
    const btn = document.querySelector('.files-action-btn.primary');
    if (btn) btn.textContent = '⏳ Indexing...';
    try {
        const res = await fetch(RAG_STATUS_URL);
        const data = await res.json();
        if (btn) {
            btn.textContent = `✓ Indexed (${data.indexed_count || 1} items)`;
            setTimeout(() => { btn.textContent = '🧠 Index for RAG'; }, 2000);
        }
    } catch (e) {
        if (btn) btn.textContent = '🧠 Index for RAG';
    }
};

// ── Integrated Live Terminal Dock & Drawer Quick Launchers ─────────────
window.openTerminalDock = function() {
    showArtifactDrawer();
    switchArtifactTab('terminal');
};

window.openFilesExplorer = function() {
    showArtifactDrawer();
    switchArtifactTab('files');
};

window.openAppSandbox = function() {
    showArtifactDrawer();
    switchArtifactTab('preview');
};

window.filterDashCards = function(category, btn) {
    const pills = document.querySelectorAll('.dash-filter-btn');
    pills.forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cards = document.querySelectorAll('.dash-cap-card');
    cards.forEach(card => {
        const cat = card.getAttribute('data-cat');
        if (category === 'all' || cat === category) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.clearTerminalOutput = function() {
    const out = document.getElementById('terminal-output');
    if (out) out.innerHTML = '<div class="terminal-welcome">✦ Terminal cleared. Ready for execution.</div>';
};

window.handleTerminalSubmit = async function(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    if (!input || !output) return;

    const cmd = input.value.trim();
    if (!cmd) return;

    input.value = '';
    input.disabled = true;

    const entry = document.createElement('div');
    entry.className = 'terminal-cmd-entry';
    entry.textContent = `❯ ${cmd}`;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/terminal/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: cmd,
                target_folder: targetFolderInput?.value.trim() || ''
            })
        });
        const data = await res.json();
        const outDiv = document.createElement('div');
        if (data.status === 'success') {
            outDiv.className = data.exit_code === 0 ? 'terminal-cmd-out' : 'terminal-cmd-err';
            outDiv.textContent = data.output || `[Process finished with exit code ${data.exit_code}]`;
        } else {
            outDiv.className = 'terminal-cmd-err';
            outDiv.textContent = data.message || 'Execution failed.';
        }
        output.appendChild(outDiv);
    } catch (e) {
        const errDiv = document.createElement('div');
        errDiv.className = 'terminal-cmd-err';
        errDiv.textContent = `Error: Connection to backend terminal failed. ${e.message}`;
        output.appendChild(errDiv);
    } finally {
        input.disabled = false;
        input.focus();
        output.scrollTop = output.scrollHeight;
    }
};

// ── Prompt Templates Studio Controller ─────────────────────────────────
window.openTemplatesModal = async function() {
    const modal = document.getElementById('templates-modal');
    if (modal) modal.style.display = 'flex';
    await loadPromptTemplates();
};

window.closeTemplatesModal = function() {
    const modal = document.getElementById('templates-modal');
    if (modal) modal.style.display = 'none';
};

window.loadPromptTemplates = async function() {
    const container = document.getElementById('templates-grid-container');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE}/templates`);
        const data = await res.json();
        if (data.status === 'success' && data.templates) {
            container.innerHTML = data.templates.map(t => `
                <div class="template-item-card" onclick="usePromptTemplate('${escapeHtml(t.prompt).replace(/'/g, "\\'")}')">
                    <div class="template-item-header">
                        <span class="template-item-title">${escapeHtml(t.title)}</span>
                        <span class="template-item-cat">${escapeHtml(t.category)}</span>
                    </div>
                    <div class="template-item-prompt">${escapeHtml(t.prompt)}</div>
                </div>
            `).join('');
        }
    } catch (e) {
        container.innerHTML = '<div style="color:var(--ink-tertiary);padding:16px;">Failed to load prompt blueprints.</div>';
    }
};

window.usePromptTemplate = function(promptText) {
    if (messageInput) {
        messageInput.value = promptText;
        messageInput.focus();
        if (typeof autoResizeTextarea === 'function') autoResizeTextarea();
    }
    closeTemplatesModal();
};

// ── Codebase Security Audit Controller ────────────────────────────────
window.openSecAuditModal = function() {
    const modal = document.getElementById('sec-audit-modal');
    if (modal) modal.style.display = 'flex';
    runSecurityAudit();
};

window.closeSecAuditModal = function() {
    const modal = document.getElementById('sec-audit-modal');
    if (modal) modal.style.display = 'none';
};

window.runSecurityAudit = async function() {
    const container = document.getElementById('sec-audit-results');
    if (!container) return;
    container.innerHTML = '<div class="session-skeleton" style="padding:24px;">Scanning workspace codebase for hardcoded secrets, SQLi patterns, and OWASP flaws...</div>';

    try {
        const target = targetFolderInput?.value.trim() || '';
        const res = await fetch(`${API_BASE}/workspace/security-audit?path=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data.status === 'success') {
            const audit = data.audit || {};
            const findings = audit.findings || [];
            
            let html = `
                <div class="sec-summary-banner">
                    <div class="sec-stat-group">
                        <div class="sec-stat-item">
                            <span class="sec-stat-val">${audit.scanned_files || 0}</span>
                            <span class="sec-stat-lbl">Scanned Files</span>
                        </div>
                        <div class="sec-stat-item">
                            <span class="sec-stat-val" style="color:${findings.length > 0 ? '#eb5757' : '#27ae60'}">${audit.total_findings || 0}</span>
                            <span class="sec-stat-lbl">Findings</span>
                        </div>
                    </div>
                    <div>
                        <span class="sec-badge ${findings.length === 0 ? 'medium' : 'high'}">${findings.length === 0 ? 'STATUS: SECURE' : 'ACTION REQUIRED'}</span>
                    </div>
                </div>
            `;

            if (findings.length > 0) {
                html += '<div style="font-size:12px;font-weight:600;color:var(--ink);margin-top:8px;">⚠️ Security Advisories:</div>';
                html += findings.map(f => `
                    <div class="sec-finding-card">
                        <div class="sec-finding-header">
                            <span class="sec-finding-title">${escapeHtml(f.type)}</span>
                            <span class="sec-badge ${f.severity.toLowerCase()}">${escapeHtml(f.severity)}</span>
                        </div>
                        <div class="sec-finding-loc">📄 ${escapeHtml(f.file)} : Line ${f.line}</div>
                        <div class="sec-finding-snippet">${escapeHtml(f.snippet)}</div>
                    </div>
                `).join('');
            } else {
                html += `
                    <div style="background:#0a1a12;border:1px solid rgba(39,174,96,0.3);border-radius:var(--r-md);padding:16px;color:#27ae60;font-size:13px;">
                        ✓ <strong>Workspace Clean:</strong> No critical hardcoded secrets, raw SQL concatenations, or high-severity vulnerabilities were detected in scanned source files.
                    </div>
                `;
            }

            container.innerHTML = html;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--semantic-error);padding:16px;">Failed to complete security audit: ${e.message}</div>`;
    }
};

// ── Smart Follow-up Suggestion & STEM Visualization Triggers ─────────
window.useSmartSuggestion = function(suggestionText) {
    if (messageInput) {
        messageInput.value = suggestionText;
        messageInput.focus();
        if (typeof autoResizeTextarea === 'function') autoResizeTextarea();
        if (typeof sendMessage === 'function') sendMessage();
    }
};

window.requestVisualization = function(visPrompt) {
    if (messageInput) {
        messageInput.value = visPrompt || 'Visualize this with an interactive real-time simulation and sliders.';
        if (typeof autoResizeTextarea === 'function') autoResizeTextarea();
        if (typeof sendMessage === 'function') sendMessage();
    }
};

// ── Unified Master Settings & Workspace Control Center ───────────────────
const SETTINGS_PANE_METADATA = {
    'profile': {
        heading: 'Profile & Specialist Persona',
        desc: 'Customize your developer profile, B1 pairing mode, and specialist reasoning persona.'
    },
    'instructions': {
        heading: 'System Prompt & Guidelines',
        desc: 'Define custom rules, architectural patterns, and project instructions for Gemini to follow.'
    },
    'mcp': {
        heading: 'Model Context Protocol (MCP) Hub',
        desc: 'Manage connected MCP servers, inspect dynamic tool calls, and install 1-click presets.'
    },
    'automations': {
        heading: 'App Integrations & Pipelines',
        desc: 'Detected developer software, 1-click execution pipelines, and custom sequential app workflows.'
    },
    'messaging': {
        heading: 'WhatsApp & Social Messaging Hub',
        desc: 'Configure WhatsApp, Telegram, Discord, Slack, and custom webhook dispatchers.'
    },
    'security': {
        heading: 'Codebase Security & OWASP Audit',
        desc: 'Deep security static analysis, hardcoded secrets scanner, and vulnerability checks.'
    },
    'export': {
        heading: 'Export & Workspace Backups',
        desc: 'Export conversations to Markdown, JSON transcripts, or generate offline archives.'
    },
    'templates': {
        heading: 'Prompt Engineering Blueprints',
        desc: 'Curated high-precision system prompts for STEM simulations, fullstack apps, and deep research.'
    },
    'appearance': {
        heading: 'Theme & Visual Atmosphere',
        desc: 'Select your curated color palette and visual density standard.'
    },
    'shortcuts': {
        heading: 'Keyboard Shortcuts & Hotkeys',
        desc: 'Fast developer shortcuts for rapid autonomous coding, terminal control, and workspace navigation.'
    }
};

window.openMasterSettings = function(defaultTab = 'profile') {
    const modal = document.getElementById('master-settings-modal');
    if (modal) modal.style.display = 'flex';
    switchMasterSettingsTab(defaultTab);
};

window.closeMasterSettings = function() {
    const modal = document.getElementById('master-settings-modal');
    if (modal) modal.style.display = 'none';
};

window.openMasterSettingsTab = function(tabKey) {
    openMasterSettings(tabKey);
};

window.switchMasterSettingsTab = function(tabKey) {
    // 1. Update navigation items
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.toggle('active', item.id === `stab-${tabKey}`);
    });

    // 2. Update panes
    document.querySelectorAll('.master-pane').forEach(pane => {
        pane.style.display = pane.id === `mpane-${tabKey}` ? 'block' : 'none';
    });

    // 3. Update title & description
    const meta = SETTINGS_PANE_METADATA[tabKey] || SETTINGS_PANE_METADATA['profile'];
    const headingEl = document.getElementById('settings-heading');
    const descEl = document.getElementById('settings-desc');
    if (headingEl) headingEl.textContent = meta.heading;
    if (descEl) descEl.textContent = meta.desc;

    // 4. Trigger data loaders
    if (tabKey === 'mcp') {
        loadMcpServers();
        loadMcpPresets();
    } else if (tabKey === 'automations') {
        loadAutomations();
    } else if (tabKey === 'messaging') {
        loadMessagingConnectors();
    } else if (tabKey === 'security') {
        runSecurityAudit();
    } else if (tabKey === 'templates') {
        loadPromptTemplates();
    } else if (tabKey === 'instructions') {
        const txt = document.getElementById('project-instructions-textarea');
        if (txt) txt.value = projectInstructions || localStorage.getItem('gemini_project_instructions') || '';
        const targetInput = document.getElementById('settings-target-folder');
        if (targetInput && targetFolderInput) targetInput.value = targetFolderInput.value;
    } else if (tabKey === 'profile') {
        const nameIn = document.getElementById('settings-profile-name');
        const roleIn = document.getElementById('settings-profile-role');
        if (nameIn) nameIn.value = userProfile.user_name || 'Ishaan Sen';
        if (roleIn) roleIn.value = userProfile.role || 'Lead Developer & AI Architect';
        updatePersonaCardSelection(currentPersona);
    }
};

window.updatePersonaCardSelection = function(personaId) {
    document.querySelectorAll('.persona-choice-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-persona') === personaId);
    });
};

window.updateThemeCardSelection = function(themeName) {
    document.querySelectorAll('.theme-picker-grid .theme-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('onclick')?.includes(themeName));
    });
};

window.saveUserProfileFromSettings = async function() {
    const nameIn = document.getElementById('settings-profile-name')?.value.trim();
    const roleIn = document.getElementById('settings-profile-role')?.value.trim();
    
    if (nameIn) userProfile.user_name = nameIn;
    if (roleIn) userProfile.role = roleIn;

    await saveUserProfile(userProfile);
    alert('✓ Profile & Specialist Persona saved successfully!');
};

window.saveInstructionsFromSettings = function() {
    const txt = document.getElementById('project-instructions-textarea');
    const val = txt ? txt.value.trim() : '';
    projectInstructions = val;
    localStorage.setItem('gemini_project_instructions', val);

    const targetInput = document.getElementById('settings-target-folder');
    if (targetInput && targetFolderInput) {
        targetFolderInput.value = targetInput.value.trim();
    }

    alert('✓ System Prompt & Instructions saved successfully!');
};

window.clearProjectInstructions = function() {
    if (!confirm('Reset project instructions to default?')) return;
    projectInstructions = '';
    localStorage.removeItem('gemini_project_instructions');
    const txt = document.getElementById('project-instructions-textarea');
    if (txt) txt.value = '';
};

// Aliases for legacy compatibility
window.openAutomationsModal = () => openMasterSettingsTab('automations');
window.closeAutomationsModal = () => closeMasterSettings();
window.openSecAuditModal = () => openMasterSettingsTab('security');
window.closeSecAuditModal = () => closeMasterSettings();
window.openTemplatesModal = () => openMasterSettingsTab('templates');
window.closeTemplatesModal = () => closeMasterSettings();
window.openExportModal = () => openMasterSettingsTab('export');
window.closeExportModal = () => closeMasterSettings();
window.openMcpModal = () => openMasterSettingsTab('mcp');
window.openInstructionsModal = () => openMasterSettingsTab('instructions');

// ── Voice Dictation (Web Speech API) Engine ────────────────────────────
let speechRecognitionInstance = null;
let isVoiceDictating = false;

function initVoiceDictation() {
    const voiceBtn = document.getElementById('voice-input-btn');
    if (!voiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceBtn.addEventListener('click', () => {
            showToast('⚠️ Web Speech API is not supported in this browser. Please use Google Chrome, Edge, or Brave.', 'info', 4000);
        });
        return;
    }

    try {
        speechRecognitionInstance = new SpeechRecognition();
        speechRecognitionInstance.continuous = true;
        speechRecognitionInstance.interimResults = true;
        speechRecognitionInstance.lang = 'en-US';

        let audioCtx = null;
        let audioAnalyser = null;
        let audioStream = null;

        const startAudioMeter = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioCtx.createMediaStreamSource(audioStream);
                    audioAnalyser = audioCtx.createAnalyser();
                    audioAnalyser.fftSize = 64;
                    source.connect(audioAnalyser);

                    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
                    const updateMeter = () => {
                        if (!isVoiceDictating) return;
                        audioAnalyser.getByteFrequencyData(dataArray);
                        let sum = 0;
                        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                        let avg = sum / dataArray.length;
                        let scale = Math.min(1.4, 1.0 + (avg / 128) * 0.4);
                        if (voiceBtn) voiceBtn.style.transform = `scale(${scale.toFixed(2)})`;
                        requestAnimationFrame(updateMeter);
                    };
                    requestAnimationFrame(updateMeter);
                }
            } catch (e) {
                console.warn('Audio meter initialization notice:', e);
            }
        };

        const stopAudioMeter = () => {
            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
                audioStream = null;
            }
            if (audioCtx && audioCtx.state !== 'closed') {
                try { audioCtx.close(); } catch(e){}
            }
            if (voiceBtn) voiceBtn.style.transform = '';
        };

        speechRecognitionInstance.onstart = () => {
            isVoiceDictating = true;
            voiceBtn.classList.add('listening');
            voiceBtn.setAttribute('title', 'Listening... Click or press Ctrl+M to stop dictation');
            initialInputValue = messageInput ? messageInput.value : '';
            showToast('🎙️ Real-Time Voice Waveform Active... Speak clearly', 'info', 2500);
            startAudioMeter();
        };

        speechRecognitionInstance.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (messageInput) {
                const combined = [initialInputValue, finalTranscript || interimTranscript].filter(Boolean).join(' ');
                messageInput.value = combined;
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
                if (sendButton) sendButton.disabled = messageInput.value.trim().length === 0;
            }
        };

        speechRecognitionInstance.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            isVoiceDictating = false;
            stopAudioMeter();
            voiceBtn.classList.remove('listening');
            voiceBtn.setAttribute('title', 'Voice Dictation (Speak to prompt)');

            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                showToast('🔒 Microphone access was blocked. Please allow microphone permissions in your browser.', 'info', 4000);
            } else if (event.error === 'no-speech') {
                showToast('🎙️ No speech detected. Click mic to try again.', 'info', 2500);
            } else if (event.error !== 'aborted') {
                showToast(`🎙️ Voice error: ${event.error}`, 'info', 3000);
            }
        };

        speechRecognitionInstance.onend = () => {
            isVoiceDictating = false;
            stopAudioMeter();
            voiceBtn.classList.remove('listening');
            voiceBtn.setAttribute('title', 'Voice Dictation (Speak to prompt)');
        };

        voiceBtn.addEventListener('click', toggleVoiceDictation);
    } catch (err) {
        console.error('Failed to initialize Speech Recognition:', err);
    }
}

window.toggleVoiceDictation = function() {
    const voiceBtn = document.getElementById('voice-input-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showToast('⚠️ Web Speech API is not supported in this browser. Please use Google Chrome, Edge, or Brave.', 'info', 4000);
        return;
    }

    if (!speechRecognitionInstance) {
        initVoiceDictation();
    }

    if (isVoiceDictating) {
        try {
            speechRecognitionInstance.stop();
        } catch (e) {}
        isVoiceDictating = false;
        if (voiceBtn) {
            voiceBtn.classList.remove('listening');
            voiceBtn.setAttribute('title', 'Voice Dictation (Speak to prompt)');
        }
        showToast('🎙️ Voice dictation stopped', 'info', 1800);
    } else {
        try {
            speechRecognitionInstance.start();
        } catch (e) {
            console.warn('Recognition start exception:', e);
            try {
                speechRecognitionInstance.stop();
                setTimeout(() => speechRecognitionInstance.start(), 200);
            } catch (err2) {
                showToast('🎙️ Could not start microphone dictation.', 'info', 3000);
            }
        }
    }
};

// ── Toast Notification System ──────────────────────────────────────────
function showToast(message, type = 'info', duration = 2200) {
    const container = document.getElementById('b1-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `b1-toast b1-toast-${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => { toast.remove(); }, 250);
    }, duration);
}

// ── Keyboard Shortcuts Cheatsheet Modal Controls ────────────────────────
window.openShortcutsModal = function() {
    const modal = document.getElementById('shortcuts-modal');
    const searchIn = document.getElementById('shortcuts-search-input');
    if (modal) {
        modal.style.display = 'flex';
        if (searchIn) {
            searchIn.value = '';
            searchIn.focus();
            filterShortcuts('');
        }
    }
};

window.closeShortcutsModal = function() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.style.display = 'none';
};

window.filterShortcuts = function(query = '') {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('#shortcuts-grid .shortcut-row').forEach(row => {
        const text = (row.textContent + ' ' + (row.getAttribute('data-search') || '')).toLowerCase();
        row.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
    });

    document.querySelectorAll('#shortcuts-grid .shortcut-category-card').forEach(cat => {
        const visibleRows = cat.querySelectorAll('.shortcut-row[style="display: flex;"], .shortcut-row:not([style*="display: none"])');
        cat.style.display = visibleRows.length > 0 ? 'flex' : 'none';
    });
};

// ══════════════════════════════════════════════════════════════════════════
// GLOBAL MASTER KEYBOARD & SHORTCUT MANAGER
// ══════════════════════════════════════════════════════════════════════════

function setupGlobalKeyboardManager() {
    const handleMasterKeyDown = (e) => {
        const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isEditing = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;

        // 1. ESCAPE KEY (Back / Close with prioritized hierarchy)
        if (isEscape) {
            // Priority A: Image Lightbox
            const lightbox = document.getElementById('image-lightbox');
            if (lightbox && lightbox.style.display !== 'none' && lightbox.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeImageLightbox();
                return;
            }

            // Priority A0: AI Model Switcher Modal (Alt+M)
            const modelModal = document.getElementById('model-switcher-modal');
            if (modelModal && modelModal.style.display !== 'none' && modelModal.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeModelSwitchModal();
                return;
            }

            // Priority B: Shortcuts Cheatsheet Modal
            const shortcutsModal = document.getElementById('shortcuts-modal');
            if (shortcutsModal && shortcutsModal.style.display !== 'none' && shortcutsModal.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeShortcutsModal();
                return;
            }

            // Priority C: Command Palette (Ctrl+K)
            const cmdModal = document.getElementById('cmd-palette-modal');
            if (cmdModal && cmdModal.style.display !== 'none' && cmdModal.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeCommandPalette();
                return;
            }

            // Priority D: Master Settings Hub (Ctrl+,)
            const settingsModal = document.getElementById('master-settings-modal');
            if (settingsModal && settingsModal.style.display !== 'none' && settingsModal.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeMasterSettings();
                return;
            }

            // Priority E: Interactive Onboarding Modal (Step back or close)
            const onboardModal = document.getElementById('onboard-modal');
            if (onboardModal && onboardModal.style.display !== 'none' && onboardModal.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof currentOnboardStep === 'number' && currentOnboardStep > 1) {
                    currentOnboardStep--;
                    renderOnboardStep(currentOnboardStep);
                } else {
                    closeOnboardingModal();
                }
                return;
            }

            // Priority F: Permission Prompt Modal
            const permOverlay = document.getElementById('perm-overlay');
            if (permOverlay && permOverlay.style.display !== 'none' && permOverlay.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                hidePermissionModal();
                return;
            }

            // Priority G: Artifact Drawer / Code Inspector
            const artifactDrawer = document.getElementById('artifact-drawer');
            if (artifactDrawer && artifactDrawer.style.display !== 'none' && artifactDrawer.style.display !== '') {
                e.preventDefault();
                e.stopPropagation();
                closeArtifactDrawer();
                return;
            }

            // Priority G2: Mobile Sidebar
            const sidebarEl = document.getElementById('sidebar');
            if (sidebarEl && sidebarEl.classList.contains('open')) {
                e.preventDefault();
                e.stopPropagation();
                sidebarEl.classList.remove('open');
                document.getElementById('sidebar-overlay')?.classList.remove('active');
                return;
            }

            // Priority H: Dropdown Menus & Popups
            const openDropdowns = document.querySelectorAll('.dropdown-menu.show, .user-dropdown-menu.show, #persona-dropdown.show');
            if (openDropdowns.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                openDropdowns.forEach(d => d.classList.remove('show'));
                return;
            }

            // Priority I: Blur active element
            if (isEditing) {
                document.activeElement.blur();
                return;
            }
        }

        // 2. SHORTCUTS CHEATSHEET (? when not in input, or F1, or Ctrl+Shift+/)
        if ((!isEditing && e.key === '?') || e.key === 'F1' || (isCmdOrCtrl && isShift && (e.key === '?' || e.key === '/'))) {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById('shortcuts-modal');
            if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
                closeShortcutsModal();
            } else {
                openShortcutsModal();
            }
            return;
        }

        // 3. CTRL + N / CMD + N (New Conversation)
        if (isCmdOrCtrl && !isShift && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            e.stopPropagation();
            startNewChat(true);
            return;
        }

        // 4. CTRL + K / CMD + K (Command Palette)
        if (isCmdOrCtrl && !isShift && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            e.stopPropagation();
            const cmdModal = document.getElementById('cmd-palette-modal');
            if (cmdModal && (cmdModal.style.display === 'none' || !cmdModal.style.display)) {
                openCommandPalette();
            } else {
                closeCommandPalette();
            }
            return;
        }

        // 5. CTRL + B / CMD + B (Toggle Sidebar)
        if (isCmdOrCtrl && !isShift && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebarBtn?.click();
            return;
        }

        // 6. CTRL + , / CMD + , (Settings Hub)
        if (isCmdOrCtrl && !isShift && e.key === ',') {
            e.preventDefault();
            e.stopPropagation();
            const settingsModal = document.getElementById('master-settings-modal');
            if (settingsModal && settingsModal.style.display !== 'none' && settingsModal.style.display !== '') {
                closeMasterSettings();
            } else {
                openMasterSettings();
            }
            return;
        }

        // 7. CTRL + / / CMD + / (Quick Search / Command Palette)
        if (isCmdOrCtrl && !isShift && e.key === '/') {
            e.preventDefault();
            e.stopPropagation();
            openCommandPalette();
            return;
        }

        // 8. CTRL + M / CMD + M (Toggle Voice Dictation)
        if (isCmdOrCtrl && !isShift && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            e.stopPropagation();
            toggleVoiceDictation();
            return;
        }

        // 8b. ALT + M (Toggle AI Model Switcher Modal)
        if (e.altKey && !isCmdOrCtrl && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
            e.preventDefault();
            e.stopPropagation();
            const modelModal = document.getElementById('model-switcher-modal');
            if (modelModal && modelModal.style.display !== 'none' && modelModal.style.display !== '') {
                closeModelSwitchModal();
            } else {
                openModelSwitchModal();
            }
            return;
        }

        // 9. CTRL + S / CMD + S (Save & Hot-Reload File/Artifact)
        if (isCmdOrCtrl && !isShift && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            const artEditor = document.getElementById('art-code-editor');
            const multiEditor = document.getElementById('multi-file-editor-textarea');
            if (multiEditor && multiEditor === document.activeElement) {
                saveActiveProjectFile();
                showToast('💾 Saved Project File & Reloaded', 'success');
            } else if (artEditor && currentArtifact) {
                currentArtifact.content = artEditor.value;
                renderPreviewFrame(currentArtifact.content);
                showToast('⚡ Updated Artifact Live Preview', 'success');
            } else {
                saveCurrentArtifactToProject();
                showToast('💾 Saved Artifact to Workspace', 'success');
            }
            return;
        }

        // ── SHIFT COMBINATIONS (Ctrl + Shift + ...) ──
        if (isCmdOrCtrl && isShift) {
            const keyLower = e.key.toLowerCase();

            // CTRL + SHIFT + A (Toggle Autonomous ReAct Loop)
            if (keyLower === 'a') {
                e.preventDefault();
                e.stopPropagation();
                toggleAutonomousMode(true);
                return;
            }

            // CTRL + SHIFT + D (Toggle Deep Prompt Decomposition)
            if (keyLower === 'd') {
                e.preventDefault();
                e.stopPropagation();
                toggleDecompose(true);
                return;
            }

            // CTRL + SHIFT + P (Cycle Specialist Persona)
            if (keyLower === 'p') {
                e.preventDefault();
                e.stopPropagation();
                cycleNextPersona();
                return;
            }

            // CTRL + SHIFT + M (MCP Servers Hub)
            if (keyLower === 'm') {
                e.preventDefault();
                e.stopPropagation();
                openMasterSettingsTab('mcp');
                return;
            }

            // CTRL + SHIFT + T (Toggle Integrated Terminal)
            if (keyLower === 't') {
                e.preventDefault();
                e.stopPropagation();
                openTerminalDock();
                const termIn = document.getElementById('terminal-input');
                if (termIn) termIn.focus();
                return;
            }

            // CTRL + SHIFT + F (Toggle Multi-File Project Explorer)
            if (keyLower === 'f') {
                e.preventDefault();
                e.stopPropagation();
                openWorkspacePane();
                return;
            }

            // CTRL + SHIFT + E (Export Conversation)
            if (keyLower === 'e') {
                e.preventDefault();
                e.stopPropagation();
                openMasterSettingsTab('export');
                return;
            }

            // CTRL + SHIFT + U (Upload / Attach File)
            if (keyLower === 'u') {
                e.preventDefault();
                e.stopPropagation();
                fileUploadInput?.click();
                return;
            }

            // CTRL + SHIFT + L (Focus Composer & Clear Input)
            if (keyLower === 'l') {
                e.preventDefault();
                e.stopPropagation();
                if (messageInput) {
                    messageInput.value = '';
                    messageInput.style.height = 'auto';
                    messageInput.focus();
                    if (sendButton) sendButton.disabled = true;
                    showToast('🧹 Composer Cleared', 'info');
                }
                return;
            }
        }
    };

    // Attach in capture phase on window so no child input can eat ESC or global hotkeys
    window.addEventListener('keydown', handleMasterKeyDown, { capture: true });
}

// ── Hook All Feature Buttons in Init ───────────────────────────────────
function setupNewFeatureEventListeners() {
    const agentLoopPill = document.getElementById('agent-loop-pill');
    if (agentLoopPill) {
        agentLoopPill.addEventListener('click', () => toggleAutonomousMode(true));
    }

    if (currentPersona) selectPersona(currentPersona);
}

// Call keyboard manager immediately
setupGlobalKeyboardManager();

window.loadAutomations = async function() {
    const softContainer = document.getElementById('software-grid-container');
    const pipeContainer = document.getElementById('pipelines-list-container');
    const customContainer = document.getElementById('custom-apps-list-container');
    const softCountBadge = document.getElementById('software-detected-count');
    const algoContainer = document.getElementById('algo-quick-grid');

    try {
        const [softRes, pipeRes, customRes, algoRes] = await Promise.all([
            fetch(`${API_BASE}/automation/software`).then(r => r.json()),
            fetch(`${API_BASE}/automation/pipelines`).then(r => r.json()),
            fetch(`${API_BASE}/automation/custom-apps`).then(r => r.json()),
            fetch(`${API_BASE}/algorithms/catalog`).then(r => r.json()).catch(() => ({ status: 'error' }))
        ]);

        if (softRes.status === 'success' && softRes.software) {
            const installedCount = softRes.software.filter(s => s.installed).length;
            if (softCountBadge) softCountBadge.textContent = `${installedCount} Active`;
            
            softContainer.innerHTML = softRes.software.map(s => `
                <div class="software-card">
                    <div class="soft-left">
                        <div class="soft-icon">${s.icon || '💻'}</div>
                        <div class="soft-info">
                            <strong>${escapeHtml(s.name)}</strong>
                            <span>${s.installed ? escapeHtml(s.version) : 'Not Installed'}</span>
                        </div>
                    </div>
                    <button class="soft-launch-btn" ${!s.installed ? 'disabled' : ''} onclick="launchSoftwareApp('${s.id}')">
                        ${s.installed ? 'Launch ↗' : 'Missing'}
                    </button>
                </div>
            `).join('');
        }

        if (pipeRes.status === 'success' && pipeRes.pipelines) {
            pipeContainer.innerHTML = pipeRes.pipelines.map((p, idx) => `
                <div class="pipeline-card">
                    <div class="pipeline-card-header">
                        <div class="pipeline-left">
                            <span style="font-size:16px;">${p.icon || '⚡'}</span>
                            <strong>${escapeHtml(p.title)}</strong>
                        </div>
                        <button class="pipeline-run-btn" onclick="runPipelineByIndex(${idx})">
                            <span>▶ Run Pipeline</span>
                        </button>
                    </div>
                    <div class="pipeline-desc">${escapeHtml(p.description)}</div>
                    <div class="pipeline-steps-chips">
                        ${(p.steps || []).map(st => `<span class="pipeline-step-tag">⚙ ${escapeHtml(st.name)}</span>`).join('')}
                    </div>
                </div>
            `).join('');
            window.cachedPipelines = pipeRes.pipelines;
        }

        if (algoRes && algoRes.status === 'success' && algoRes.algorithms && algoContainer) {
            algoContainer.innerHTML = algoRes.algorithms.map(al => `
                <div class="pipeline-card" style="padding:10px 12px;background:var(--surface-2);border:1px solid var(--hairline);">
                    <div class="pipeline-card-header" style="margin-bottom:4px;">
                        <div class="pipeline-left">
                            <span style="font-size:14px;color:var(--primary-hover);">📐</span>
                            <strong style="font-size:12px;">${escapeHtml(al.name)}</strong>
                        </div>
                        <button class="pipeline-run-btn" style="padding:3px 8px;font-size:11px;" onclick="runAlgorithmQuick('${al.id}')">
                            <span>▶ Solve</span>
                        </button>
                    </div>
                    <div style="font-size:11px;color:var(--ink-subtle);margin-bottom:4px;">${escapeHtml(al.description)}</div>
                    <span class="pipeline-step-tag" style="font-size:10px;color:var(--semantic-cyan);">${escapeHtml(al.complexity)}</span>
                </div>
            `).join('');
        }

        if (customRes.status === 'success' && customRes.apps) {
            if (customRes.apps.length === 0) {
                customContainer.innerHTML = `<div class="sec-finding-card clean">No custom apps registered yet. Click "+ Add Custom App" above!</div>`;
            } else {
                customContainer.innerHTML = customRes.apps.map((app, appIdx) => `
                    <div class="custom-app-card">
                        <div class="custom-app-header">
                            <div class="custom-app-left">
                                <span style="font-size:18px;">${app.icon || '📦'}</span>
                                <div>
                                    <strong>${escapeHtml(app.name)}</strong>
                                    <span class="custom-app-cat-badge">${escapeHtml(app.category || 'Tool')}</span>
                                </div>
                            </div>
                            <div class="custom-app-actions">
                                <button class="pipeline-run-btn" onclick="runAllCustomAppSteps(${appIdx})">
                                    <span>▶ Run All Steps</span>
                                </button>
                                <button class="custom-app-delete-btn" title="Delete custom app" onclick="deleteCustomApp('${app.id}')">🗑️</button>
                            </div>
                        </div>
                        <div class="pipeline-desc">${escapeHtml(app.description || '')}</div>
                        ${app.command ? `<div style="font-size:11px;color:var(--ink-tertiary);"><span style="color:var(--ink-secondary);font-weight:600;">Main Binary:</span> <code>${escapeHtml(app.command)}</code></div>` : ''}
                        
                        <div class="custom-app-steps-container">
                            <div style="font-size:11px;font-weight:600;color:var(--ink-secondary);margin-bottom:4px;">📖 How to work with ${escapeHtml(app.name)} (Step-by-Step):</div>
                            ${(app.steps || []).map((st, sIdx) => `
                                <div class="step-instruction-row">
                                    <div class="step-instruction-info">
                                        <span class="step-title">${escapeHtml(st.title || `Step ${sIdx+1}`)}</span>
                                        <span class="step-instruction-text">${escapeHtml(st.instruction || '')}</span>
                                        ${st.cmd ? `<span class="step-cmd-badge"><code>$ ${escapeHtml(st.cmd)}</code></span>` : ''}
                                    </div>
                                    ${st.cmd ? `<button class="step-run-single-btn" onclick="runSingleStepCommand('${escapeHtml(st.cmd).replace(/'/g, "\\'")}', '${escapeHtml(st.title).replace(/'/g, "\\'")}')">▶ Run</button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('');
                window.cachedCustomApps = customRes.apps;
            }
        }

        // Also refresh App Builder Studio templates and workspaces
        if (typeof loadAppBuilderStudio === 'function') {
            loadAppBuilderStudio();
        }
    } catch (err) {
        if (softContainer) softContainer.innerHTML = `<div class="sec-finding-card clean">Could not fetch software connectors: ${escapeHtml(err.message)}</div>`;
    }
};

window.toggleAddCustomAppForm = function() {
    const form = document.getElementById('custom-app-form-card');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    }
};

window.submitNewCustomApp = async function() {
    const name = document.getElementById('new-app-name')?.value.trim();
    const cat = document.getElementById('new-app-cat')?.value.trim() || 'Custom Tool';
    const icon = document.getElementById('new-app-icon')?.value.trim() || '🚀';
    const cmd = document.getElementById('new-app-cmd')?.value.trim();
    const rawSteps = document.getElementById('new-app-steps')?.value.trim() || '';

    if (!name) {
        alert('Please enter an app name.');
        return;
    }

    const steps = rawSteps.split('\n').filter(l => l.trim()).map((line, idx) => {
        let title = `Step ${idx+1}`;
        let instruction = line;
        let command = '';
        if (line.includes('|')) {
            const parts = line.split('|');
            instruction = parts[0].trim();
            for (let p of parts.slice(1)) {
                if (p.trim().toLowerCase().startsWith('cmd:')) {
                    command = p.trim().substring(4).trim();
                }
            }
        }
        return {
            title: `Step ${idx+1}: ${instruction.substring(0, 30)}`,
            instruction: instruction,
            cmd: command
        };
    });

    try {
        const res = await fetch(`${API_BASE}/automation/custom-apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                category: cat,
                icon,
                command: cmd,
                description: `Custom integrated application for ${name}`,
                steps
            })
        }).then(r => r.json());

        if (res.status === 'success') {
            alert(`✓ ${res.message}`);
            toggleAddCustomAppForm();
            // Clear inputs
            document.getElementById('new-app-name').value = '';
            document.getElementById('new-app-cmd').value = '';
            document.getElementById('new-app-steps').value = '';
            loadAutomations();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error saving app: ${e.message}`);
    }
};

window.deleteCustomApp = async function(appId) {
    if (!confirm(`Are you sure you want to delete custom app '${appId}'?`)) return;
    try {
        const res = await fetch(`${API_BASE}/automation/custom-apps/${appId}`, {
            method: 'DELETE'
        }).then(r => r.json());

        if (res.status === 'success') {
            loadAutomations();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error deleting app: ${e.message}`);
    }
};

window.runSingleStepCommand = async function(cmd, stepTitle) {
    const execBox = document.getElementById('pipeline-exec-box');
    const execTitle = document.getElementById('pipeline-exec-title');
    const execOutput = document.getElementById('pipeline-exec-output');

    if (execBox) execBox.style.display = 'flex';
    if (execTitle) execTitle.textContent = `Executing: ${stepTitle}`;
    if (execOutput) execOutput.textContent = `[Single Step Execution] ${new Date().toLocaleTimeString()}\nCommand: ${cmd}\n\n`;

    const targetFolder = targetFolderInput?.value.trim() || '';

    try {
        const res = await fetch(`${API_BASE}/automation/run-step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, target_folder: targetFolder })
        }).then(r => r.json());

        if (res.output) {
            if (execOutput) execOutput.textContent += `${res.output}\n`;
        }
        if (execOutput) execOutput.textContent += `\n[Status: ${res.status.toUpperCase()} (Exit: ${res.exit_code})]\n`;
    } catch (e) {
        if (execOutput) execOutput.textContent += `[Error]: ${e.message}\n`;
    }
};

window.runAllCustomAppSteps = async function(appIdx) {
    if (!window.cachedCustomApps || !window.cachedCustomApps[appIdx]) return;
    const app = window.cachedCustomApps[appIdx];
    const execBox = document.getElementById('pipeline-exec-box');
    const execTitle = document.getElementById('pipeline-exec-title');
    const execOutput = document.getElementById('pipeline-exec-output');

    if (execBox) execBox.style.display = 'flex';
    if (execTitle) execTitle.textContent = `Running All Steps for: ${app.name}`;
    if (execOutput) execOutput.textContent = `[Starting Custom App Workflow] ${app.name}\n\n`;

    const targetFolder = targetFolderInput?.value.trim() || '';

    for (let i = 0; i < (app.steps || []).length; i++) {
        const step = app.steps[i];
        if (!step.cmd) continue;
        if (execOutput) execOutput.textContent += `[Step ${i+1}/${app.steps.length}] ${step.title || ''} ($ ${step.cmd})...\n`;
        
        try {
            const res = await fetch(`${API_BASE}/automation/run-step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: step.cmd, target_folder: targetFolder })
            }).then(r => r.json());

            if (res.output) {
                if (execOutput) execOutput.textContent += `${res.output}\n`;
            }
            if (execOutput) execOutput.textContent += `[Exit Code: ${res.exit_code}]\n\n`;
            if (execOutput) execOutput.scrollTop = execOutput.scrollHeight;
        } catch (e) {
            if (execOutput) execOutput.textContent += `[Error]: ${e.message}\n\n`;
        }
    }

    if (execOutput) execOutput.textContent += `[Workflow Complete] ✓ All steps executed.\n`;
};

window.launchSoftwareApp = async function(appId) {
    try {
        const targetPath = targetFolderInput?.value.trim() || '';
        const res = await fetch(`${API_BASE}/automation/launch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: appId, target_path: targetPath })
        }).then(r => r.json());

        if (res.status === 'success') {
            alert(`✓ ${res.message}`);
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error launching app: ${e.message}`);
    }
};

window.runPipelineByIndex = async function(idx) {
    if (!window.cachedPipelines || !window.cachedPipelines[idx]) return;
    const pipeline = window.cachedPipelines[idx];
    const execBox = document.getElementById('pipeline-exec-box');
    const execTitle = document.getElementById('pipeline-exec-title');
    const execOutput = document.getElementById('pipeline-exec-output');

    if (execBox) execBox.style.display = 'flex';
    if (execTitle) execTitle.textContent = `Running: ${pipeline.title}`;
    if (execOutput) execOutput.textContent = `[Pipeline Started] ${new Date().toLocaleTimeString()}\n\n`;

    const targetFolder = targetFolderInput?.value.trim() || '';

    for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];
        if (execOutput) execOutput.textContent += `[Step ${i+1}/${pipeline.steps.length}] Executing: ${step.name} (${step.cmd})...\n`;
        
        try {
            const res = await fetch(`${API_BASE}/automation/run-step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: step.cmd, target_folder: targetFolder })
            }).then(r => r.json());

            if (res.output) {
                if (execOutput) execOutput.textContent += `${res.output}\n`;
            }
            if (execOutput) execOutput.textContent += `[Status: ${res.status.toUpperCase()} (Exit: ${res.exit_code})]\n\n`;
            if (execOutput) execOutput.scrollTop = execOutput.scrollHeight;
        } catch (e) {
            if (execOutput) execOutput.textContent += `[Error]: ${e.message}\n\n`;
        }
    }

    if (execOutput) execOutput.textContent += `[Pipeline Complete] ✓ All stages executed.\n`;
};

window.runAllPipelinesConcurrent = async function() {
    const execBox = document.getElementById('pipeline-exec-box');
    const execTitle = document.getElementById('pipeline-exec-title');
    const execOutput = document.getElementById('pipeline-exec-output');

    if (execBox) execBox.style.display = 'flex';
    if (execTitle) execTitle.textContent = `⚡ Running Concurrent Multi-Pipeline`;
    if (execOutput) execOutput.textContent = `[Concurrent Multi-Pipeline Cluster Initiated] ${new Date().toLocaleTimeString()}\n\n`;

    const targetFolder = targetFolderInput?.value.trim() || '';
    const pipelineIds = ['workspace_doctor', 'auto_security_and_lint', 'multi_algo_benchmark'];

    if (execOutput) execOutput.textContent += `Triggering concurrent execution across: ${pipelineIds.join(', ')}...\n\n`;

    try {
        const res = await fetch(`${API_BASE}/pipeline/orchestrate-concurrent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pipeline_ids: pipelineIds, target_folder: targetFolder })
        }).then(r => r.json());

        if (res.results) {
            for (const [pid, pData] of Object.entries(res.results)) {
                if (execOutput) {
                    execOutput.textContent += `══════════════════════════════════════════════════\n`;
                    execOutput.textContent += `📦 Pipeline: ${pData.title || pid} (${pData.status.toUpperCase()})\n`;
                    execOutput.textContent += `   Elapsed: ${pData.elapsed_seconds || 0}s | Steps: ${pData.steps_completed}/${pData.total_steps}\n`;
                    for (const st of pData.step_results || []) {
                        execOutput.textContent += `   • [${st.status.toUpperCase()}] ${st.name}\n`;
                        if (st.output) execOutput.textContent += `     ${st.output.replace(/\n/g, '\n     ')}\n`;
                    }
                    execOutput.textContent += `\n`;
                }
            }
        }
        if (execOutput) {
            execOutput.textContent += `[Concurrent Multi-Pipeline Finished] Total Elapsed: ${res.elapsed_seconds}s | Overall Status: ${res.status.toUpperCase()}\n`;
            execOutput.scrollTop = execOutput.scrollHeight;
        }
    } catch (e) {
        if (execOutput) execOutput.textContent += `[Error]: ${e.message}\n`;
    }
};

window.runAlgorithmQuick = async function(algoId) {
    const box = document.getElementById('algo-exec-box');
    const title = document.getElementById('algo-exec-title');
    const output = document.getElementById('algo-exec-output');

    if (box) box.style.display = 'flex';
    if (title) title.textContent = `Solving Algorithm: ${algoId}`;
    if (output) output.textContent = `[Computing ${algoId}...] Please wait...\n`;

    try {
        const res = await fetch(`${API_BASE}/algorithms/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm_id: algoId, params: {} })
        }).then(r => r.json());

        if (output) {
            output.textContent = `[Execution Completed in ${res.execution_time_ms} ms]\n\n` + JSON.stringify(res.result || res, null, 2);
            output.scrollTop = 0;
        }
    } catch (e) {
        if (output) output.textContent = `[Algorithm Error]: ${e.message}`;
    }
};

// ── Messaging & WhatsApp Hub Logic ──────────────────────────────────────
window.switchAutomationTab = function(tabKey) {
    const paneWorkflows = document.getElementById('pane-workflows');
    const paneMessaging = document.getElementById('pane-messaging');
    const tabWorkflows = document.getElementById('tab-btn-workflows');
    const tabMessaging = document.getElementById('tab-btn-messaging');

    if (tabKey === 'messaging') {
        if (paneWorkflows) paneWorkflows.style.display = 'none';
        if (paneMessaging) paneMessaging.style.display = 'block';
        if (tabWorkflows) tabWorkflows.classList.remove('active');
        if (tabMessaging) tabMessaging.classList.add('active');
        loadMessagingConnectors();
    } else {
        if (paneWorkflows) paneWorkflows.style.display = 'block';
        if (paneMessaging) paneMessaging.style.display = 'none';
        if (tabWorkflows) tabWorkflows.classList.add('active');
        if (tabMessaging) tabMessaging.classList.remove('active');
    }
};

window.loadMessagingConnectors = async function() {
    const container = document.getElementById('messaging-connectors-container');
    const badge = document.getElementById('messaging-status-badge');
    const dispatchSelect = document.getElementById('msg-dispatch-platform');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/messaging/connectors`).then(r => r.json());
        if (res.status === 'success' && res.connectors) {
            if (badge) badge.textContent = `${res.connectors.length} Connectors`;

            // Update 1-click message dispatcher dropdown
            if (dispatchSelect) {
                const currentVal = dispatchSelect.value;
                dispatchSelect.innerHTML = res.connectors.map(c => `
                    <option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>
                `).join('');
                if (currentVal && res.connectors.some(c => c.id === currentVal)) {
                    dispatchSelect.value = currentVal;
                }
            }

            container.innerHTML = res.connectors.map(c => `
                <div class="msg-connector-card">
                    <div class="msg-connector-header">
                        <div class="msg-connector-left">
                            <span style="font-size:20px;">${c.icon}</span>
                            <div>
                                <strong>${escapeHtml(c.name)}</strong>
                                <div style="font-size:11px;color:var(--ink-secondary);">${escapeHtml(c.category)}</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="msg-status-pill ${c.status}">${c.status === 'configured' ? '● Configured' : '○ Ready to Connect'}</span>
                            ${c.is_custom ? `<button class="custom-app-delete-btn" title="Delete custom messaging app" onclick="deleteCustomMessagingApp('${c.id}')">🗑️</button>` : ''}
                        </div>
                    </div>
                    <div class="pipeline-desc">${escapeHtml(c.description)}</div>
                    
                    <!-- Step-by-Step Connection Guide -->
                    <div class="msg-guide-box">
                        <div class="msg-guide-title">📖 Step-by-Step Connection:</div>
                        <ul style="margin:0;padding-left:18px;color:var(--ink-secondary);">
                            ${(c.guide || []).map(g => `<li style="margin-bottom:2px;">${escapeHtml(g)}</li>`).join('')}
                        </ul>
                    </div>

                    <!-- Platform Configuration Input Fields -->
                    ${renderMessagingInputs(c)}
                </div>
            `).join('');
        }
    } catch (e) {
        container.innerHTML = `<div class="sec-finding-card clean">Failed to load messaging connectors: ${escapeHtml(e.message)}</div>`;
    }
};

function renderMessagingInputs(conn) {
    if (conn.id === 'whatsapp') {
        const phone = conn.settings?.default_phone || '';
        return `
            <div class="msg-settings-form">
                <div class="form-group">
                    <label>Recipient Phone (E.164 e.g. +14155551234)</label>
                    <input type="text" id="cfg-wa-phone" value="${escapeHtml(phone)}" placeholder="+1234567890">
                </div>
                <div class="form-group">
                    <label>Cloud API Token (Optional)</label>
                    <input type="password" id="cfg-wa-token" value="${escapeHtml(conn.settings?.api_token || '')}" placeholder="Meta Graph API Token">
                </div>
            </div>
            <div class="form-actions-row">
                <button class="msg-save-btn" onclick="saveMessagingPlatformConfig('whatsapp')">Save WhatsApp Settings</button>
                <button class="step-run-single-btn" onclick="testDispatchConnector('whatsapp')">💬 Send Test WhatsApp</button>
            </div>
        `;
    } else if (conn.id === 'telegram') {
        return `
            <div class="msg-settings-form">
                <div class="form-group">
                    <label>Bot Token (@BotFather)</label>
                    <input type="password" id="cfg-tg-token" value="${escapeHtml(conn.settings?.bot_token || '')}" placeholder="123456:ABC-DEF...">
                </div>
                <div class="form-group">
                    <label>Chat ID or Channel (@channel)</label>
                    <input type="text" id="cfg-tg-chat" value="${escapeHtml(conn.settings?.default_chat_id || '')}" placeholder="e.g. 987654321">
                </div>
            </div>
            <div class="form-actions-row">
                <button class="msg-save-btn" onclick="saveMessagingPlatformConfig('telegram')">Save Telegram Settings</button>
                <button class="step-run-single-btn" onclick="testDispatchConnector('telegram')">✈️ Send Test Alert</button>
            </div>
        `;
    } else if (conn.id === 'discord' || conn.id === 'slack') {
        const prefix = conn.id === 'discord' ? 'dc' : 'sl';
        return `
            <div class="form-group" style="margin-top:4px;">
                <label>Incoming Webhook URL</label>
                <input type="text" id="cfg-${prefix}-url" value="${escapeHtml(conn.settings?.webhook_url || '')}" placeholder="https://${conn.id}.com/api/webhooks/...">
            </div>
            <div class="form-actions-row">
                <button class="msg-save-btn" onclick="saveMessagingPlatformConfig('${conn.id}')">Save ${conn.name} Webhook</button>
                <button class="step-run-single-btn" onclick="testDispatchConnector('${conn.id}')">Send Test Webhook</button>
            </div>
        `;
    } else if (conn.is_custom) {
        return `
            <div class="form-group" style="margin-top:4px;">
                <label>Target Endpoint / URL / Command Template (${conn.protocol.toUpperCase()})</label>
                <input type="text" id="cfg-custom-${conn.id}-target" value="${escapeHtml(conn.target || '')}" placeholder="Target endpoint">
            </div>
            <div class="form-actions-row">
                <button class="msg-save-btn" onclick="saveCustomMessagingEndpoint('${conn.id}')">Save Endpoint</button>
                <button class="step-run-single-btn" onclick="testDispatchConnector('${conn.id}')">⚡ Test Dispatch</button>
            </div>
        `;
    }
    return '';
}

window.toggleAddCustomMsgForm = function() {
    const form = document.getElementById('custom-msg-form-card');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    }
};

window.submitNewCustomMsgApp = async function() {
    const name = document.getElementById('new-msg-name')?.value.trim();
    const cat = document.getElementById('new-msg-cat')?.value.trim() || 'Custom Messaging';
    const icon = document.getElementById('new-msg-icon')?.value.trim() || '📢';
    const protocol = document.getElementById('new-msg-protocol')?.value || 'webhook';
    const target = document.getElementById('new-msg-target')?.value.trim();
    const rawSteps = document.getElementById('new-msg-steps')?.value.trim() || '';

    if (!name) {
        alert('Please enter an app / connector name.');
        return;
    }
    if (!target) {
        alert('Please enter a target URL, DeepLink scheme, or CLI template.');
        return;
    }

    const guide = rawSteps ? rawSteps.split('\n').filter(l => l.trim()) : [
        `Step 1: Configure ${name} endpoint`,
        `Step 2: Dispatch message notifications`
    ];

    try {
        const res = await fetch(`${API_BASE}/messaging/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                category: cat,
                icon,
                protocol,
                target,
                description: `Custom ${protocol.toUpperCase()} connector for ${name}`,
                guide
            })
        }).then(r => r.json());

        if (res.status === 'success') {
            alert(`✓ ${res.message}`);
            toggleAddCustomMsgForm();
            document.getElementById('new-msg-name').value = '';
            document.getElementById('new-msg-target').value = '';
            document.getElementById('new-msg-steps').value = '';
            loadMessagingConnectors();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error registering custom messaging app: ${e.message}`);
    }
};

window.deleteCustomMessagingApp = async function(connId) {
    if (!confirm(`Are you sure you want to delete custom connector '${connId}'?`)) return;
    try {
        const res = await fetch(`${API_BASE}/messaging/custom/${connId}`, {
            method: 'DELETE'
        }).then(r => r.json());

        if (res.status === 'success') {
            loadMessagingConnectors();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error deleting connector: ${e.message}`);
    }
};

window.saveCustomMessagingEndpoint = async function(connId) {
    const input = document.getElementById(`cfg-custom-${connId}-target`);
    const newTarget = input ? input.value.trim() : '';

    try {
        const res = await fetch(`${API_BASE}/messaging/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: connId, name: connId, target: newTarget })
        }).then(r => r.json());

        if (res.status === 'success') {
            alert(`✓ Saved endpoint for ${connId}!`);
            loadMessagingConnectors();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error saving endpoint: ${e.message}`);
    }
};

window.saveMessagingPlatformConfig = async function(platform) {
    let payload = {};
    if (platform === 'whatsapp') {
        payload = {
            whatsapp: {
                default_phone: document.getElementById('cfg-wa-phone')?.value.trim() || '',
                api_token: document.getElementById('cfg-wa-token')?.value.trim() || '',
                enabled: true
            }
        };
    } else if (platform === 'telegram') {
        payload = {
            telegram: {
                bot_token: document.getElementById('cfg-tg-token')?.value.trim() || '',
                default_chat_id: document.getElementById('cfg-tg-chat')?.value.trim() || '',
                enabled: true
            }
        };
    } else if (platform === 'discord') {
        payload = {
            discord: {
                webhook_url: document.getElementById('cfg-dc-url')?.value.trim() || '',
                enabled: true
            }
        };
    } else if (platform === 'slack') {
        payload = {
            slack: {
                webhook_url: document.getElementById('cfg-sl-url')?.value.trim() || '',
                enabled: true
            }
        };
    }

    try {
        const res = await fetch(`${API_BASE}/messaging/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.status === 'success') {
            alert(`✓ Saved settings for ${platform}!`);
            loadMessagingConnectors();
        } else {
            alert(`⚠️ ${res.message}`);
        }
    } catch (e) {
        alert(`Error saving messaging settings: ${e.message}`);
    }
};

window.dispatchQuickMessage = async function() {
    const platform = document.getElementById('msg-dispatch-platform')?.value || 'whatsapp';
    const message = document.getElementById('msg-dispatch-text')?.value.trim() || 'Hello from B1!';
    const resultBox = document.getElementById('msg-dispatch-result');

    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.className = 'msg-dispatch-result';
        resultBox.textContent = `Dispatching to ${platform.toUpperCase()}...`;
    }

    try {
        const res = await fetch(`${API_BASE}/messaging/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, message })
        }).then(r => r.json());

        if (res.status === 'success') {
            if (resultBox) {
                resultBox.className = 'msg-dispatch-result success';
                resultBox.innerHTML = `✓ ${res.message}`;
                if (res.url) {
                    resultBox.innerHTML += ` &bull; <a href="${res.url}" target="_blank" style="color:#25D366;text-decoration:underline;font-weight:600;">Open in WhatsApp Web ↗</a>`;
                    window.open(res.url, '_blank');
                }
            }
        } else {
            if (resultBox) {
                resultBox.className = 'msg-dispatch-result error';
                resultBox.textContent = `⚠️ Error: ${res.message}`;
            }
        }
    } catch (e) {
        if (resultBox) {
            resultBox.className = 'msg-dispatch-result error';
            resultBox.textContent = `⚠️ Network Error: ${e.message}`;
        }
    }
};

window.testDispatchConnector = async function(platform) {
    const testMsg = `🚀 [B1 Autonomous Alert] Test alert dispatched from workspace at ${new Date().toLocaleTimeString()}!`;
    const res = await fetch(`${API_BASE}/messaging/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, message: testMsg })
    }).then(r => r.json());

    if (res.status === 'success') {
        if (res.url) {
            window.open(res.url, '_blank');
        } else {
            alert(`✓ Message dispatched to ${platform}!`);
        }
    } else {
        alert(`⚠️ Could not dispatch to ${platform}: ${res.message}`);
    }
};

// ── In-Chat Interactive Action Card Handlers ────────────────────────────
window.applySuggestedMessage = function(cardId, text) {
    const textarea = document.getElementById(`${cardId}-text`);
    if (textarea) {
        textarea.value = text;
        textarea.style.borderColor = 'var(--accent-primary)';
        setTimeout(() => { textarea.style.borderColor = 'var(--hairline)'; }, 800);
    }
};

window.executeActionCard = async function(cardId, type, platform, recipient, file) {
    const textarea = document.getElementById(`${cardId}-text`);
    const resultBox = document.getElementById(`${cardId}-res`);
    const message = textarea ? textarea.value.trim() : 'Hello from B1 Agent!';

    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.className = 'action-card-result';
        resultBox.textContent = 'Processing dispatch...';
    }

    try {
        if (platform === 'google_drive' || platform === 'drive') {
            const res = await fetch(`${API_BASE}/drive/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: file || 'playground/index.html', target_folder: recipient || 'My Drive' })
            }).then(r => r.json());

            if (res.status === 'success') {
                if (resultBox) {
                    resultBox.className = 'action-card-result success';
                    resultBox.innerHTML = `✓ ${res.message} &bull; <a href="${res.cloud_url}" target="_blank" style="color:var(--accent-lavender);text-decoration:underline;">View in Drive ↗</a>`;
                }
            } else {
                if (resultBox) {
                    resultBox.className = 'action-card-result error';
                    resultBox.textContent = `⚠️ Upload failed: ${res.message}`;
                }
            }
        } else {
            const finalMsg = file ? `${message}\n[Attached File: ${file}]` : message;
            const res = await fetch(`${API_BASE}/messaging/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, message: finalMsg, target: recipient })
            }).then(r => r.json());

            if (res.status === 'success') {
                if (resultBox) {
                    resultBox.className = 'action-card-result success';
                    resultBox.innerHTML = `✓ ${res.message}`;
                    if (res.url) {
                        resultBox.innerHTML += ` &bull; <a href="${res.url}" target="_blank" style="color:#25D366;text-decoration:underline;font-weight:600;">Open in WhatsApp Web ↗</a>`;
                        window.open(res.url, '_blank');
                    }
                }
            } else {
                if (resultBox) {
                    resultBox.className = 'action-card-result error';
                    resultBox.textContent = `⚠️ Dispatch error: ${res.message}`;
                }
            }
        }
    } catch (e) {
        if (resultBox) {
            resultBox.className = 'action-card-result error';
            resultBox.textContent = `⚠️ Error: ${e.message}`;
        }
    }
};

// ══════════════════════════════════════════════════════════════════════════
// B1 AUTONOMOUS APP BUILDER & MULTI-FILE STUDIO LOGIC
// ══════════════════════════════════════════════════════════════════════════

let activeAppProjectId = 'novametrics-demo';
let activeAppFilePath = 'index.html';
let cachedAppFiles = [];
let appServerStatus = { running: false, url: null, port: null };

window.loadAppBuilderStudio = async function() {
    const tplGrid = document.getElementById('app-templates-grid');
    const projList = document.getElementById('app-projects-list');
    const projCountBadge = document.getElementById('app-workspaces-count');
    const selector = document.getElementById('server-app-selector');

    try {
        const [tplRes, projRes] = await Promise.all([
            fetch(`${API_BASE}/app-builder/templates`).then(r => r.json()),
            fetch(`${API_BASE}/app-builder/projects`).then(r => r.json())
        ]);

        if (tplRes.status === 'success' && tplRes.templates && tplGrid) {
            tplGrid.innerHTML = tplRes.templates.map(tpl => `
                <div class="app-template-card">
                    <div class="app-tpl-header">
                        <span style="font-size:18px;">${tpl.icon}</span>
                        <span>${escapeHtml(tpl.name)}</span>
                    </div>
                    <div class="app-tpl-desc">${escapeHtml(tpl.desc)}</div>
                    <button class="app-tpl-btn" onclick="scaffoldAppFromTemplate('${tpl.key}', '${escapeHtml(tpl.name)}')">
                        <span>🚀 Build App (${tpl.file_count} files)</span>
                    </button>
                </div>
            `).join('');
        }

        if (projRes.status === 'success' && projRes.projects) {
            if (projCountBadge) projCountBadge.textContent = `${projRes.projects.length} Active`;
            
            if (projList) {
                if (projRes.projects.length === 0) {
                    projList.innerHTML = `<div class="sec-finding-card clean">No app workspaces yet. Click a template above to generate your first fullstack app!</div>`;
                } else {
                    projList.innerHTML = projRes.projects.map(p => `
                        <div class="app-project-item">
                            <div class="app-proj-info">
                                <strong>📁 ${escapeHtml(p.name)}</strong>
                                <span>(${p.files_count} files &bull; ${p.template})</span>
                                ${p.server_running ? `<span style="color:#27a644; font-weight:600; margin-left:6px;">🟢 Running on :${p.server_url.split(':').pop()}</span>` : ''}
                            </div>
                            <div class="app-proj-actions">
                                <button class="server-btn" onclick="openAppInStudio('${p.id}')">📂 Open in Studio</button>
                                <button class="server-btn" onclick="downloadAppZipById('${p.id}')">📦 ZIP</button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            if (selector) {
                selector.innerHTML = `<option value="">(Current Artifact)</option>` + 
                    projRes.projects.map(p => `<option value="${p.id}" ${p.id === activeAppProjectId ? 'selected' : ''}>📁 ${escapeHtml(p.name)}</option>`).join('');
            }
        }
    } catch (e) {
        console.warn('Could not load app builder studio:', e);
    }
};

window.scaffoldAppFromTemplate = async function(templateKey, templateName) {
    const customName = prompt(`Enter a name for your new ${templateName}:`, templateName);
    if (customName === null) return;

    const appId = (customName || templateKey).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    closeMasterSettings();

    // Open artifact drawer and switch to files tab
    const drawer = document.getElementById('artifact-drawer');
    if (drawer) drawer.style.display = 'flex';
    switchArtifactTab('files');

    try {
        const res = await fetch(`${API_BASE}/app-builder/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: appId, template: templateKey, name: customName || templateName })
        }).then(r => r.json());

        if (res.status === 'success') {
            activeAppProjectId = res.app_id;
            activeAppFilePath = 'index.html';
            await refreshProjectFiles();
            await startAppDevServer(activeAppProjectId);
            loadAppBuilderStudio();
        } else {
            alert(`⚠️ Scaffolding error: ${res.message}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
};

window.openAppInStudio = async function(appId) {
    activeAppProjectId = appId;
    activeAppFilePath = 'index.html';
    closeMasterSettings();

    const drawer = document.getElementById('artifact-drawer');
    if (drawer) drawer.style.display = 'flex';
    switchArtifactTab('files');

    await refreshProjectFiles();
    await checkAppServerStatus(appId);
};

window.switchActiveAppProject = async function(appId) {
    activeAppProjectId = appId;
    if (!appId) {
        switchArtifactTab('preview');
        return;
    }
    await refreshProjectFiles();
    await checkAppServerStatus(appId);
};

window.refreshProjectFiles = async function() {
    if (!activeAppProjectId) return;
    const treeContainer = document.getElementById('workspace-tree-container');
    const appNameEl = document.getElementById('active-app-name-tree');
    if (appNameEl) appNameEl.textContent = activeAppProjectId;

    try {
        const res = await fetch(`${API_BASE}/app-builder/files?app_id=${encodeURIComponent(activeAppProjectId)}`).then(r => r.json());
        if (res.status === 'success' && res.files) {
            cachedAppFiles = res.files;
            renderProjectFileTree(res.files);
            if (res.files.length > 0) {
                const targetFile = res.files.find(f => f.path === activeAppFilePath) ? activeAppFilePath : res.files[0].path;
                openProjectFile(targetFile);
            }
        }
    } catch (e) {
        if (treeContainer) treeContainer.innerHTML = `<div class="sec-finding-card clean">Error: ${e.message}</div>`;
    }
};

function renderProjectFileTree(files) {
    const treeContainer = document.getElementById('workspace-tree-container');
    if (!treeContainer) return;

    if (files.length === 0) {
        treeContainer.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--ink-tertiary);">No files in project.</div>`;
        return;
    }

    const iconMap = {
        'html': '🌐',
        'css': '🎨',
        'js': '⚡',
        'py': '🐍',
        'json': '📋',
        'md': '📝',
        'sqlite': '🗄️'
    };

    treeContainer.innerHTML = files.map(f => {
        const icon = iconMap[f.ext] || '📄';
        const isActive = f.path === activeAppFilePath;
        return `
            <div class="tree-item-row ${isActive ? 'active' : ''}" onclick="openProjectFile('${escapeHtml(f.path)}')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:12px;background:${isActive ? 'var(--surface-4)' : 'transparent'};color:${isActive ? 'var(--ink)' : 'var(--ink-muted)'};border:1px solid ${isActive ? 'var(--primary)' : 'transparent'};margin-bottom:3px;">
                <span>${icon}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11.5px;">${escapeHtml(f.path)}</span>
                <span style="font-size:10px;color:var(--ink-tertiary);">${(f.size/1024).toFixed(1)}k</span>
            </div>
        `;
    }).join('');
}

window.openProjectFile = async function(filePath) {
    activeAppFilePath = filePath;
    const badge = document.getElementById('active-file-path-badge');
    const editor = document.getElementById('multi-file-editor-textarea');
    if (badge) badge.textContent = filePath;

    renderProjectFileTree(cachedAppFiles);

    try {
        const res = await fetch(`${API_BASE}/app-builder/file-content?app_id=${encodeURIComponent(activeAppProjectId)}&file=${encodeURIComponent(filePath)}`).then(r => r.json());
        if (res.status === 'success' && editor) {
            editor.value = res.content;
        }
    } catch (e) {
        if (editor) editor.value = `Error loading file: ${e.message}`;
    }
};

window.saveActiveProjectFile = async function() {
    if (!activeAppProjectId || !activeAppFilePath) return;
    const editor = document.getElementById('multi-file-editor-textarea');
    if (!editor) return;

    try {
        const res = await fetch(`${API_BASE}/app-builder/save-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: activeAppProjectId,
                file_path: activeAppFilePath,
                content: editor.value
            })
        }).then(r => r.json());

        if (res.status === 'success') {
            if (activeAppFilePath === 'index.html' || activeAppFilePath.endsWith('.html')) {
                renderPreviewFrame(editor.value);
            }
            refreshProjectFiles();
        }
    } catch (e) {
        alert(`Error saving file: ${e.message}`);
    }
};

window.promptCreateNewAppFile = async function() {
    if (!activeAppProjectId) return;
    const fileName = prompt("Enter new filename (e.g. style.css, api.js, components/header.html):");
    if (!fileName || !fileName.trim()) return;

    await fetch(`${API_BASE}/app-builder/save-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            app_id: activeAppProjectId,
            file_path: fileName.trim(),
            content: `// ${fileName.trim()}\n`
        })
    });

    activeAppFilePath = fileName.trim();
    await refreshProjectFiles();
    openProjectFile(activeAppFilePath);
};

window.toggleActiveAppServer = async function() {
    if (!activeAppProjectId) return;
    if (appServerStatus.running) {
        await stopAppDevServer(activeAppProjectId);
    } else {
        await startAppDevServer(activeAppProjectId);
    }
};

async function startAppDevServer(appId) {
    try {
        const res = await fetch(`${API_BASE}/app-builder/server/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: appId })
        }).then(r => r.json());

        if (res.status === 'success' || res.status === 'already_running') {
            updateServerStatusUI(true, res.port, res.url);
            const frame = document.getElementById('art-preview-frame');
            if (frame && res.url) frame.src = res.url;
        }
    } catch (e) {
        console.error('Server start error:', e);
    }
}

async function stopAppDevServer(appId) {
    try {
        const res = await fetch(`${API_BASE}/app-builder/server/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: appId })
        }).then(r => r.json());

        updateServerStatusUI(false);
    } catch (e) {
        console.error('Server stop error:', e);
    }
}

async function checkAppServerStatus(appId) {
    try {
        const res = await fetch(`${API_BASE}/app-builder/server/status?app_id=${encodeURIComponent(appId)}`).then(r => r.json());
        if (res.status === 'success') {
            updateServerStatusUI(res.running, res.port, res.url);
            if (res.running && res.url) {
                const frame = document.getElementById('art-preview-frame');
                if (frame) frame.src = res.url;
            }
        }
    } catch (e) {
        updateServerStatusUI(false);
    }
}

function updateServerStatusUI(running, port = null, url = null) {
    appServerStatus = { running, port, url };
    const dot = document.getElementById('server-status-dot');
    const label = document.getElementById('server-status-label');
    const portBadge = document.getElementById('server-port-badge');
    const btn = document.getElementById('server-toggle-btn');

    if (dot) dot.classList.toggle('active', running);
    if (label) label.textContent = running ? `Dev Server Running` : `Sandbox Iframe`;
    if (portBadge) {
        portBadge.style.display = running ? 'inline-block' : 'none';
        if (port) portBadge.textContent = `:${port}`;
    }
    if (btn) btn.innerHTML = running ? `<span>⏹ Stop Server</span>` : `<span>⚡ Start Server</span>`;
}

window.popoutActiveAppServer = function() {
    if (appServerStatus.url) {
        window.open(appServerStatus.url, '_blank');
    } else {
        const frame = document.getElementById('art-preview-frame');
        if (frame && frame.src) {
            window.open(frame.src, '_blank');
        } else if (currentArtifact) {
            const win = window.open('', '_blank');
            win.document.write(currentArtifact.content);
            win.document.close();
        }
    }
};

window.downloadActiveAppZip = function() {
    if (!activeAppProjectId) return;
    window.location.href = `${API_BASE}/app-builder/export-zip?app_id=${encodeURIComponent(activeAppProjectId)}`;
};

window.downloadAppZipById = function(appId) {
    window.location.href = `${API_BASE}/app-builder/export-zip?app_id=${encodeURIComponent(appId)}`;
};

window.triggerAutoHealForActiveApp = async function() {
    if (!activeAppProjectId) return;
    const msgEl = document.getElementById('err-banner-msg');
    const errMsg = msgEl ? msgEl.textContent : 'Runtime error';

    try {
        const res = await fetch(`${API_BASE}/app-builder/auto-heal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: activeAppProjectId,
                file_path: activeAppFilePath || 'app.js',
                error_message: errMsg
            })
        }).then(r => r.json());

        if (res.status === 'repaired') {
            alert(`✓ AI Self-Healing Applied: ${res.message}`);
            document.getElementById('app-error-banner').style.display = 'none';
            await refreshProjectFiles();
        } else {
            quickPrompt(`Fix the following runtime error in my project ${activeAppProjectId} file ${activeAppFilePath}: ${errMsg}`);
            document.getElementById('app-error-banner').style.display = 'none';
        }
    } catch (e) {
        alert(`Auto-heal error: ${e.message}`);
    }
};

// Global Iframe Error Listener
window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'IFRAME_CONSOLE_ERROR') {
        const banner = document.getElementById('app-error-banner');
        const msgEl = document.getElementById('err-banner-msg');
        if (banner && msgEl) {
            banner.style.display = 'flex';
            msgEl.textContent = e.data.message || 'JavaScript runtime exception';
        }
    }
});

// Attach to existing initApp
const prevInitApp = window.initApp;
window.initApp = function() {
    if (typeof prevInitApp === 'function') prevInitApp();
    setupNewFeatureEventListeners();
    updateModelLabels();
};

document.addEventListener('DOMContentLoaded', window.initApp);

/* ══════════════════════════════════════════════════════════════════════════
   🎙️ LINEAR CONVERSATIONAL VOICE AGENT CONTROLLER (TTS & STT)
   ══════════════════════════════════════════════════════════════════════════ */
class VoiceAgentController {
    constructor() {
        this.active = false;
        this.isSpeaking = false;
        this.isListening = false;
        this.handsFree = localStorage.getItem('b1_voice_handsfree') !== 'false';
        this.autoSpeak = localStorage.getItem('b1_voice_autospeak') !== 'false';
        this.currentVoice = localStorage.getItem('b1_voice_persona') || 'en-US-AvaNeural';
        this.pitch = localStorage.getItem('b1_voice_pitch') || '+4Hz';
        this.rate = localStorage.getItem('b1_voice_rate') || '+5%';
        this.disfluencyLevel = localStorage.getItem('b1_voice_disfluency') || 'natural';
        this.audioEl = null;
        this.recognition = null;
        this.silenceTimer = null;
        this.currentSpokenButton = null;
        this.initRecognition();
    }

    initRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return;
        try {
            this.recognition = new SpeechRec();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateHudState('listening', 'Listening to you...');
            };

            this.recognition.onresult = (event) => {
                // Barge-in: if user starts speaking while audio is playing, halt TTS immediately
                if (this.isSpeaking) {
                    this.stopCurrentSpeech();
                }

                let interim = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                const currentText = (finalTranscript || interim).trim();
                if (currentText) {
                    const preview = document.getElementById('hud-transcript-preview');
                    if (preview) preview.textContent = `"${currentText}"`;

                    const msgInput = document.getElementById('message-input');
                    if (msgInput) {
                        msgInput.value = currentText;
                        msgInput.style.height = 'auto';
                        msgInput.style.height = Math.min(msgInput.scrollHeight, 200) + 'px';
                        const sendBtn = document.getElementById('send-button');
                        if (sendBtn) sendBtn.disabled = false;
                    }

                    // Reset VAD silence timer
                    if (this.handsFree && finalTranscript) {
                        clearTimeout(this.silenceTimer);
                        this.silenceTimer = setTimeout(() => {
                            if (!this.isSpeaking && msgInput && msgInput.value.trim().length > 0) {
                                const sendBtn = document.getElementById('send-button');
                                if (sendBtn && !sendBtn.disabled) {
                                    this.updateHudState('thinking', 'Processing query...');
                                    sendBtn.click();
                                }
                            }
                        }, 800);
                    }
                }
            };

            this.recognition.onerror = (err) => {
                console.warn('Voice recognition error:', err.error);
                if (err.error === 'not-allowed') {
                    showToast('🔒 Microphone permission blocked. Please allow mic in browser.', 'info', 4000);
                }
                this.isListening = false;
                if (this.active && !this.isSpeaking) {
                    this.updateHudState('ready', 'Click mic to speak');
                }
            };

            this.recognition.onend = () => {
                this.isListening = false;
                // Auto-restart recognition if Voice HUD is active and not currently speaking
                if (this.active && !this.isSpeaking) {
                    setTimeout(() => {
                        if (this.active && !this.isSpeaking && !this.isListening) {
                            try { this.recognition.start(); } catch(e) {}
                        }
                    }, 400);
                }
            };
        } catch(e) {
            console.warn('SpeechRecognition init error:', e);
        }
    }

    startListening() {
        if (!this.recognition) {
            showToast('⚠️ Speech recognition not supported in this browser.', 'info');
            return;
        }
        try {
            this.recognition.start();
        } catch(e) {}
    }

    stopListening() {
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e) {}
        }
        this.isListening = false;
    }

    updateHudState(state, statusText) {
        const hud = document.getElementById('voice-hud-dock');
        const topbarBtn = document.getElementById('topbar-voice-btn');
        const pill = document.getElementById('hud-status-pill');
        const preview = document.getElementById('hud-transcript-preview');
        const micBtn = document.getElementById('hud-mic-toggle-btn');

        if (hud) {
            hud.classList.remove('listening', 'speaking', 'thinking', 'ready');
            hud.classList.add(state);
        }
        if (topbarBtn) {
            topbarBtn.classList.remove('listening', 'speaking');
            if (state === 'speaking') topbarBtn.classList.add('speaking');
            else if (state === 'listening') topbarBtn.classList.add('active');
        }
        if (pill) pill.textContent = state.charAt(0).toUpperCase() + state.slice(1);
        if (preview && statusText) preview.textContent = statusText;

        if (micBtn) {
            if (this.isListening) micBtn.classList.add('active');
            else micBtn.classList.remove('active');
        }
    }

    async speakText(text, contextPrompt = '') {
        if (!text || !text.trim()) return;

        // Stop any current audio immediately
        this.stopCurrentSpeech();

        // Pause listening while speaking to prevent echo / feedback loop
        this.stopListening();

        this.isSpeaking = true;
        this.updateHudState('speaking', 'Ava speaking...');

        try {
            const resp = await fetch(`${API_BASE}/voice/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: this.currentVoice,
                    pitch: this.pitch,
                    rate: this.rate,
                    humanize: true,
                    context_prompt: contextPrompt,
                    disfluency_level: this.disfluencyLevel
                })
            });

            if (!resp.ok) throw new Error(`TTS status ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const audio = new Audio(blobUrl);
            this.audioEl = audio;

            audio.onplay = () => {
                this.updateHudState('speaking', 'Ava speaking...');
            };

            audio.onended = () => {
                this.isSpeaking = false;
                this.audioEl = null;
                URL.revokeObjectURL(blobUrl);
                if (this.currentSpokenButton) {
                    this.resetSpokenButton(this.currentSpokenButton);
                    this.currentSpokenButton = null;
                }
                if (this.active) {
                    this.updateHudState('listening', 'Listening for your reply...');
                    this.startListening();
                } else {
                    this.updateHudState('ready', 'Ready');
                }
            };

            audio.onerror = (err) => {
                console.warn('Backend TTS error, falling back to Web Speech Synthesis:', err);
                URL.revokeObjectURL(blobUrl);
                this.fallbackClientTts(text, contextPrompt);
            };

            await audio.play();
        } catch (err) {
            console.warn('Audio play error, falling back to Web Speech Synthesis:', err);
            this.fallbackClientTts(text, contextPrompt);
        }
    }

    fallbackClientTts(text, contextPrompt = '') {
        if (!('speechSynthesis' in window)) {
            this.isSpeaking = false;
            this.updateHudState('ready', 'Speech synthesis unavailable');
            return;
        }

        window.speechSynthesis.cancel();
        let spoken = text.replace(/```[\s\S]*?```/g, " I have written the code in your workspace panel. ");
        spoken = spoken.replace(/`([^`]+)`/g, '$1').replace(/[#*_~>]/g, '');
        if (this.disfluencyLevel !== 'off' && !/^(hmm|umm|oh|aha)/i.test(spoken)) {
            spoken = "Hmm... " + spoken;
        }

        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.rate = 1.05;
        utterance.pitch = 1.25;

        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google US English')));
        if (femaleVoice) utterance.voice = femaleVoice;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateHudState('speaking', 'Ava speaking...');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.currentSpokenButton) {
                this.resetSpokenButton(this.currentSpokenButton);
                this.currentSpokenButton = null;
            }
            if (this.active) {
                this.updateHudState('listening', 'Listening for your reply...');
                this.startListening();
            } else {
                this.updateHudState('ready', 'Ready');
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    stopCurrentSpeech() {
        if (this.audioEl) {
            try {
                this.audioEl.pause();
                this.audioEl.currentTime = 0;
            } catch(e) {}
            this.audioEl = null;
        }
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch(e) {}
        }
        this.isSpeaking = false;
        if (this.currentSpokenButton) {
            this.resetSpokenButton(this.currentSpokenButton);
            this.currentSpokenButton = null;
        }
        if (this.active) {
            this.updateHudState('listening', 'Listening to you...');
        } else {
            this.updateHudState('ready', 'Ready');
        }
    }

    resetSpokenButton(btn) {
        if (!btn) return;
        btn.classList.remove('playing');
        btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span>Read Aloud</span>
        `;
    }

    readMessageAloud(btn) {
        if (this.isSpeaking && this.currentSpokenButton === btn) {
            this.stopCurrentSpeech();
            return;
        }

        const row = btn.closest('.chat-row');
        if (!row) return;
        const bubble = row.querySelector('.assistant-bubble') || row.querySelector('.message-bubble');
        if (!bubble) return;

        const clone = bubble.cloneNode(true);
        clone.querySelectorAll('.thinking-accordion, .stepper-container, .msg-actions-toolbar, .visualize-offer-card, .grounding-telemetry-badge, .best-of-best-telemetry-badge').forEach(el => el.remove());
        const cleanText = clone.textContent.trim();

        if (this.currentSpokenButton) {
            this.resetSpokenButton(this.currentSpokenButton);
        }

        this.currentSpokenButton = btn;
        btn.classList.add('playing');
        btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
            <span>Stop Audio</span>
        `;

        this.speakText(cleanText, 'Read message aloud');
    }
}

// Global Singleton Instance
window.voiceAgentController = new VoiceAgentController();

// Global HUD Toggles & Handlers
window.toggleVoiceHUD = function() {
    const hud = document.getElementById('voice-hud-dock');
    const topbarBtn = document.getElementById('topbar-voice-btn');
    if (!hud) return;

    if (hud.style.display === 'none' || !hud.style.display) {
        hud.style.display = 'block';
        window.voiceAgentController.active = true;
        if (topbarBtn) topbarBtn.classList.add('active');
        window.voiceAgentController.startListening();
        showToast('🎙️ Conversational Voice Mode Active (Ava Neural Voice)', 'success', 2500);
    } else {
        window.closeVoiceHUD();
    }
};

window.closeVoiceHUD = function() {
    const hud = document.getElementById('voice-hud-dock');
    const topbarBtn = document.getElementById('topbar-voice-btn');
    if (hud) hud.style.display = 'none';
    if (topbarBtn) topbarBtn.classList.remove('active', 'speaking');
    if (window.voiceAgentController) {
        window.voiceAgentController.active = false;
        window.voiceAgentController.stopCurrentSpeech();
        window.voiceAgentController.stopListening();
    }
};

window.openVoiceSettingsModal = function() {
    const modal = document.getElementById('voice-settings-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeVoiceSettingsModal = function() {
    const modal = document.getElementById('voice-settings-modal');
    if (modal) modal.style.display = 'none';
};

window.updateVoicePersona = function(val) {
    if (!window.voiceAgentController) return;
    window.voiceAgentController.currentVoice = val;
    localStorage.setItem('b1_voice_persona', val);

    const name = val.includes('Ava') ? 'Ava' : val.includes('Ana') ? 'Ana' : val.includes('Emma') ? 'Emma' : val.includes('Jenny') ? 'Jenny' : 'Sonia';
    const ageTag = val.includes('Ana') ? 'Ana Neural' : 'Ava Neural';

    const nameEl = document.getElementById('hud-persona-name');
    if (nameEl) nameEl.textContent = name;
    const tagEl = document.getElementById('voice-persona-tag');
    if (tagEl) tagEl.textContent = ageTag;
    const badgeEl = document.getElementById('topbar-persona-badge');
    if (badgeEl) badgeEl.textContent = ageTag;

    showToast(`🎙️ Switched voice persona to ${name}`, 'info', 2000);
};

window.setDisfluencyLevel = function(level) {
    if (!window.voiceAgentController) return;
    window.voiceAgentController.disfluencyLevel = level;
    localStorage.setItem('b1_voice_disfluency', level);

    document.querySelectorAll('.voice-segment-btn').forEach(btn => {
        if (btn.dataset.level === level) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    showToast(`Fillers set to: ${level.toUpperCase()}`, 'info', 1800);
};

window.updatePitchVal = function(val) {
    if (!window.voiceAgentController) return;
    const pitchStr = `+${val}Hz`;
    window.voiceAgentController.pitch = pitchStr;
    localStorage.setItem('b1_voice_pitch', pitchStr);
    const label = document.getElementById('voice-pitch-val');
    if (label) label.textContent = `${pitchStr} (${val >= 4 ? 'Expressive' : 'Natural'})`;
};

window.updateRateVal = function(val) {
    if (!window.voiceAgentController) return;
    const rateStr = `${val >= 0 ? '+' : ''}${val}%`;
    window.voiceAgentController.rate = rateStr;
    localStorage.setItem('b1_voice_rate', rateStr);
    const label = document.getElementById('voice-rate-val');
    if (label) label.textContent = `${rateStr} (${val >= 5 ? 'Energetic' : 'Normal'})`;
};

window.toggleHandsFreeMode = function(chk) {
    if (!window.voiceAgentController) return;
    window.voiceAgentController.handsFree = chk;
    localStorage.setItem('b1_voice_handsfree', String(chk));
    showToast(`Continuous Hands-Free VAD ${chk ? 'Enabled' : 'Disabled'}`, 'info', 2000);
};

window.toggleAutoSpeak = function(chk) {
    if (!window.voiceAgentController) return;
    window.voiceAgentController.autoSpeak = chk;
    localStorage.setItem('b1_voice_autospeak', String(chk));
    showToast(`Auto-Read Aloud ${chk ? 'Enabled' : 'Disabled'}`, 'info', 2000);
};

window.testVoiceSample = function() {
    if (!window.voiceAgentController) return;
    const sampleText = "Hey Ishaan! I'm Ava, your AI voice assistant. Let's build something truly amazing together!";
    window.voiceAgentController.speakText(sampleText, 'Test voice greeting');
};

window.toggleVoiceListening = function() {
    if (!window.voiceAgentController) return;
    if (window.voiceAgentController.isListening) {
        window.voiceAgentController.stopListening();
        window.voiceAgentController.updateHudState('ready', 'Mic muted');
    } else {
        window.voiceAgentController.startListening();
    }
};

window.stopCurrentSpeech = function() {
    if (window.voiceAgentController) {
        window.voiceAgentController.stopCurrentSpeech();
    }
};

window.readMessageBubbleAloud = function(btn) {
    if (window.voiceAgentController) {
        window.voiceAgentController.readMessageAloud(btn);
    }
};
