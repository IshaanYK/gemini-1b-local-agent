/* ── Gemini Agent Workspace — app.js ────────────────────────────────────── */
'use strict';

const API_URL      = 'http://localhost:5000/api/chat';
const GRANT_URL    = 'http://localhost:5000/api/grant-permission';
const PERM_CHK_URL = 'http://localhost:5000/api/permission-status';

// DOM refs
const messageInput    = document.getElementById('message-input');
const sendButton      = document.getElementById('send-button');
const messagesEl      = document.getElementById('messages');
const welcomeScreen   = document.getElementById('welcome-screen');
const chatViewport    = document.getElementById('chat-viewport');
const toggleSidebarBtn= document.getElementById('toggle-sidebar');
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebar-overlay');
const newChatBtn      = document.getElementById('new-chat-btn');
const modelSelector   = document.getElementById('model-selector');
const agentStatusText = document.getElementById('agent-status-text');
const composerBox     = document.getElementById('composer-box');

let chatHistory = [];

/* ── Dynamic Greeting ───────────────────────────────────────────────────── */
(function setGreeting() {
    const titleEl = document.getElementById('welcome-title');
    if (!titleEl) return;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    titleEl.textContent = greet + ', Ishaan';
})();

/* ── Permission Modal Logic ─────────────────────────────────────────────── */
const permOverlay   = document.getElementById('perm-overlay');
const permAllowBtn  = document.getElementById('perm-allow-btn');
const permDenyBtn   = document.getElementById('perm-deny-btn');
const permStatusMsg = document.getElementById('perm-status-msg');

function showPermissionModal() {
    if (permOverlay) permOverlay.style.display = 'flex';
}

function hidePermissionModal() {
    if (permOverlay) {
        permOverlay.style.opacity = '0';
        setTimeout(() => { permOverlay.style.display = 'none'; permOverlay.style.opacity = ''; }, 250);
    }
}

// Check permission status on page load
fetch(PERM_CHK_URL)
    .then(r => r.json())
    .then(data => { if (!data.granted) showPermissionModal(); })
    .catch(() => { /* backend not running yet — skip */ });

if (permAllowBtn) {
    permAllowBtn.addEventListener('click', async () => {
        permAllowBtn.disabled = true;
        permAllowBtn.textContent = 'Saving...';
        try {
            const r = await fetch(GRANT_URL, { method: 'POST' });
            const d = await r.json();
            if (d.status === 'granted') {
                if (permStatusMsg) permStatusMsg.textContent = '✅ Access granted! Agent is ready.';
                setTimeout(hidePermissionModal, 900);
            } else {
                if (permStatusMsg) permStatusMsg.textContent = '❌ Error: ' + (d.message || 'Unknown error');
                permAllowBtn.disabled = false;
                permAllowBtn.textContent = 'Allow Access';
            }
        } catch (e) {
            if (permStatusMsg) permStatusMsg.textContent = '❌ Could not connect to backend. Is it running?';
            permAllowBtn.disabled = false;
            permAllowBtn.textContent = 'Allow Access';
        }
    });
}

if (permDenyBtn) {
    permDenyBtn.addEventListener('click', () => {
        if (permStatusMsg) permStatusMsg.textContent = 'Permissions denied. Agent tools are disabled.';
        permDenyBtn.textContent = 'Denied';
        permDenyBtn.disabled = true;
        if (permAllowBtn) permAllowBtn.disabled = true;
    });
}

/* ── Sidebar Toggle ─────────────────────────────────────────────────────── */
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

/* ── New Chat ────────────────────────────────────────────────────────────── */
newChatBtn.addEventListener('click', () => {
    chatHistory = [];
    messagesEl.innerHTML = '';
    welcomeScreen.style.display = '';
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;
    messageInput.focus();
    // Close mobile sidebar if open
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

/* ── Textarea Auto-resize & Send Enable ─────────────────────────────────── */
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    sendButton.disabled = this.value.trim().length === 0;
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

/* ── Quick Action Cards ─────────────────────────────────────────────────── */
function setInput(text) {
    messageInput.value = text;
    messageInput.dispatchEvent(new Event('input'));
    // Small delay so the user sees the input populate, then send
    setTimeout(() => sendMessage(), 80);
}

/* ── Load Context (handoff) ─────────────────────────────────────────────── */
fetch('handoff_context.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
        if (!data || !Array.isArray(data) || data.length === 0) return;
        chatHistory = data;
        welcomeScreen.style.display = 'none';
        data.forEach(msg => {
            if (msg.role !== 'system') {
                renderStaticMessage(msg.role, msg.content);
            }
        });
        scrollToBottom();
    })
    .catch(() => { /* fresh session — that's fine */ });

/* ── Helpers ────────────────────────────────────────────────────────────── */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
        .replace(/\\times/g, '×')
        .replace(/\\cdot/g, '·')
        .replace(/\\rightarrow/g, '→')
        .replace(/\\leftarrow/g, '←')
        .replace(/\\Rightarrow/g, '⇒')
        .replace(/_\{([0-9a-zA-Z]+)\}/g, '<sub>$1</sub>')
        .replace(/\^\{([0-9a-zA-Z]+)\}/g, '<sup>$1</sup>')
        .replace(/\\left\(/g, '(')
        .replace(/\\right\)/g, ')')
        .replace(/\\left\[/g, '[')
        .replace(/\\right\]/g, ']')
        .replace(/\$\\text\{([^}]+)\}\$/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\$([^\$\n]+)\$/g, '$1');
}

function scrollToBottom() {
    chatViewport.scrollTop = chatViewport.scrollHeight;
}

/* ── Code Block Enhancement ─────────────────────────────────────────────── */
function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.querySelector('.code-header-bar')) return; // already done
        const lang = pre.querySelector('code')?.className?.replace('language-', '') || 'code';
        const header = document.createElement('div');
        header.className = 'code-header-bar';
        header.innerHTML = `
            <span>${escapeHtml(lang)}</span>
            <button class="copy-btn" type="button">Copy</button>
        `;
        header.querySelector('.copy-btn').addEventListener('click', function () {
            const code = pre.querySelector('code')?.innerText ?? pre.innerText;
            navigator.clipboard.writeText(code).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => this.textContent = 'Copy', 2000);
            }).catch(() => {
                this.textContent = 'Error';
                setTimeout(() => this.textContent = 'Copy', 2000);
            });
        });
        pre.insertBefore(header, pre.firstChild);
    });
}

/* ── Message Rendering ──────────────────────────────────────────────────── */
function renderStaticMessage(role, content) {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
        bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
    } else {
        bubble.innerHTML = marked.parse(cleanText(content));
        enhanceCodeBlocks(bubble);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    return bubble;
}

function createAssistantRow() {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'message-row assistant';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<span style="color:var(--ink-tertiary);font-style:italic">Thinking...</span>';

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
    return bubble;
}

function renderAssistantBubble(bubble, thinkingLogs, responseText) {
    let html = '';

    if (thinkingLogs.length > 0) {
        const logLines = thinkingLogs
            .map(l => `<div class="thinking-log-line">${escapeHtml(l)}</div>`)
            .join('');
        html += `
        <details class="thinking-drawer" open>
            <summary class="thinking-summary">
                <span class="thinking-icon">🧠</span>
                Thought Process
                <span class="thinking-count">${thinkingLogs.length} steps</span>
            </summary>
            <div class="thinking-body">${logLines}</div>
        </details>`;
    }

    if (responseText) {
        html += marked.parse(cleanText(responseText));
    } else if (thinkingLogs.length === 0) {
        html += '<span style="color:var(--ink-tertiary);font-style:italic">Thinking...</span>';
    }

    bubble.innerHTML = html;
    enhanceCodeBlocks(bubble);
    scrollToBottom();
}

/* ── Send Message ───────────────────────────────────────────────────────── */
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // Reset input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;

    // Show user message
    renderStaticMessage('user', text);
    chatHistory.push({ role: 'user', content: text });
    scrollToBottom();

    // Create assistant placeholder
    const aiBubble = createAssistantRow();
    let fullResponse = '';
    let thinkingLogs = [];

    // Update status pill
    agentStatusText.textContent = 'Agent Running…';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chatHistory,
                model: modelSelector.value,
                target_folder: document.getElementById('target-folder-input')?.value.trim() || ''
            })
        });

        if (!response.ok) {
            throw new Error(`Backend returned HTTP ${response.status}. Is agent_backend.py running on port 5000?`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
                if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.needs_permission) {
                        // Show permission modal and abort streaming
                        showPermissionModal();
                        thinkingLogs.push('⚠️ Agent paused — waiting for your permission.');
                        renderAssistantBubble(aiBubble, thinkingLogs, '');
                        return; // exit generate() early
                    } else if (data.thinking) {
                        thinkingLogs.push(data.thinking);
                        renderAssistantBubble(aiBubble, thinkingLogs, fullResponse);
                    } else if (data.system) {
                        thinkingLogs.push(`⚙️ ${data.system}`);
                        renderAssistantBubble(aiBubble, thinkingLogs, fullResponse);
                    } else if (data.content) {
                        fullResponse += data.content;
                        renderAssistantBubble(aiBubble, thinkingLogs, fullResponse);
                    } else if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (parseErr) {
                    // Ignore partial/invalid JSON chunks
                }
            }
        }

        if (fullResponse) {
            chatHistory.push({ role: 'assistant', content: fullResponse });
        }

    } catch (error) {
        const errMsg = error.message || 'Unknown error';
        thinkingLogs.push(`❌ Error: ${errMsg}`);
        renderAssistantBubble(aiBubble, thinkingLogs, '');
        aiBubble.innerHTML += `
            <div style="
                margin-top:12px;
                padding:10px 14px;
                background:rgba(224,108,117,0.1);
                border:1px solid rgba(224,108,117,0.3);
                border-radius:var(--r-md);
                color:#e06c75;
                font-size:13px;
            ">
                <strong>Error:</strong> ${escapeHtml(errMsg)}
                <br><br>
                <span style="color:var(--ink-tertiary)">Make sure <code>agent_backend.py</code> is running on port 5000 and <code>gemini_web2api.py</code> is on port 8081.</span>
            </div>`;
    } finally {
        sendButton.disabled = messageInput.value.trim().length === 0;
        agentStatusText.textContent = '10-Step Agent Loop Active';
        messageInput.focus();
        scrollToBottom();
    }
}

/* ── Playground Space Logic ─────────────────────────────────────────────── */
const openPgBtn       = document.getElementById('open-playground-btn');
const closePgBtn      = document.getElementById('close-pg-modal');
const pgOverlay       = document.getElementById('pg-modal-overlay');
const tabFilesBtn     = document.getElementById('tab-files-btn');
const tabHistoryBtn   = document.getElementById('tab-history-btn');
const tabFiles        = document.getElementById('tab-files');
const tabHistory      = document.getElementById('tab-history');
const pgFilesList     = document.getElementById('pg-files-list');
const pgHistoryList   = document.getElementById('pg-history-list');
const pgDirPath       = document.getElementById('pg-dir-path');
const pgViewer        = document.getElementById('pg-viewer');
const pgViewerTitle   = document.getElementById('pg-viewer-title');
const pgCodePreview   = document.getElementById('pg-code-preview');
const pgRunFileBtn    = document.getElementById('pg-run-file-btn');
const pgCloseViewerBtn= document.getElementById('pg-close-viewer-btn');
const pgOutputBox     = document.getElementById('pg-output-box');
const pgOutputText    = document.getElementById('pg-output-text');

let activePgFile = '';

if (openPgBtn) {
    openPgBtn.addEventListener('click', () => {
        pgOverlay.classList.add('active');
        loadPlaygroundData();
    });
}

if (closePgBtn) {
    closePgBtn.addEventListener('click', () => {
        pgOverlay.classList.remove('active');
    });
}

if (pgOverlay) {
    pgOverlay.addEventListener('click', (e) => {
        if (e.target === pgOverlay) pgOverlay.classList.remove('active');
    });
}

// Tab Switching
if (tabFilesBtn && tabHistoryBtn) {
    tabFilesBtn.addEventListener('click', () => {
        tabFilesBtn.classList.add('active');
        tabHistoryBtn.classList.remove('active');
        tabFiles.classList.add('active');
        tabHistory.classList.remove('active');
    });

    tabHistoryBtn.addEventListener('click', () => {
        tabHistoryBtn.classList.add('active');
        tabFilesBtn.classList.remove('active');
        tabHistory.classList.add('active');
        tabFiles.classList.remove('active');
    });
}

if (pgCloseViewerBtn) {
    pgCloseViewerBtn.addEventListener('click', () => {
        pgViewer.style.display = 'none';
        pgOutputBox.style.display = 'none';
    });
}

async function loadPlaygroundData() {
    try {
        pgFilesList.innerHTML = '<div class="pg-loading">Loading workspace files...</div>';
        pgHistoryList.innerHTML = '<div class="pg-loading">Loading history log...</div>';

        const res = await fetch('http://localhost:5000/api/playground');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.playground_dir) {
            pgDirPath.textContent = data.playground_dir;
        }

        // Render Files
        if (!data.files || data.files.length === 0) {
            pgFilesList.innerHTML = '<div class="pg-loading" style="color:var(--ink-tertiary)">No playground files created yet. Ask the agent to write or create a file!</div>';
        } else {
            pgFilesList.innerHTML = data.files.map(f => `
                <div class="pg-file-item">
                    <div class="pg-file-info">
                        <span class="pg-file-name">📄 ${escapeHtml(f.name)}</span>
                        <span class="pg-file-size">${(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div class="pg-file-actions">
                        <button class="pg-act-btn" onclick="viewPlaygroundFile('${escapeHtml(f.name)}')">View Code</button>
                        <button class="pg-act-btn run" onclick="runPlaygroundFile('${escapeHtml(f.name)}')">▶ Run</button>
                    </div>
                </div>
            `).join('');
        }

        // Render History
        if (!data.history || data.history.length === 0) {
            pgHistoryList.innerHTML = '<div class="pg-loading" style="color:var(--ink-tertiary)">No code changes logged yet.</div>';
        } else {
            pgHistoryList.innerHTML = data.history.map(h => `
                <div class="pg-history-item">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="pg-history-action ${escapeHtml(h.action)}">${escapeHtml(h.action)}</span>
                            <span class="pg-file-name" style="font-size:12px;">${escapeHtml(h.filename || h.filepath)}</span>
                        </div>
                        <div class="pg-history-meta" style="margin-top:4px;">${escapeHtml(h.meta || '')}</div>
                    </div>
                    <span class="pg-history-meta">${escapeHtml(h.timestamp)}</span>
                </div>
            `).join('');
        }

    } catch (err) {
        pgFilesList.innerHTML = `<div class="pg-loading" style="color:#e06c75">Error loading playground: ${escapeHtml(err.message)}</div>`;
    }
}

window.viewPlaygroundFile = async function (filename) {
    try {
        activePgFile = filename;
        pgViewerTitle.textContent = filename;
        pgCodePreview.querySelector('code').textContent = 'Loading content...';
        pgOutputBox.style.display = 'none';
        pgViewer.style.display = 'flex';

        const res = await fetch('http://localhost:5000/api/playground/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.status === 'success') {
            pgCodePreview.querySelector('code').textContent = data.content;
        } else {
            pgCodePreview.querySelector('code').textContent = `Error: ${data.message}`;
        }
    } catch (e) {
        pgCodePreview.querySelector('code').textContent = `Error reading file: ${e.message}`;
    }
};

window.runPlaygroundFile = async function (filename) {
    try {
        activePgFile = filename;
        pgViewerTitle.textContent = filename;
        pgOutputText.textContent = 'Executing script on local system...';
        pgOutputBox.style.display = 'block';
        pgViewer.style.display = 'flex';

        // Load code if not visible
        if (pgCodePreview.querySelector('code').textContent === '' || activePgFile !== filename) {
            viewPlaygroundFile(filename);
        }

        const res = await fetch('http://localhost:5000/api/playground/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.status === 'success') {
            pgOutputText.textContent = `$ ${data.command}\n\n${data.output}`;
        } else {
            pgOutputText.textContent = `Error running script: ${data.message}`;
        }

        // Refresh history timeline
        setTimeout(loadPlaygroundData, 1000);
    } catch (e) {
        pgOutputText.textContent = `Execution failed: ${e.message}`;
    }
};

if (pgRunFileBtn) {
    pgRunFileBtn.addEventListener('click', () => {
        if (activePgFile) runPlaygroundFile(activePgFile);
    });
}
