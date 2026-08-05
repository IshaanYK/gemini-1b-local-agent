const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcome-screen');
const chatViewport = document.getElementById('chat-viewport');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');

let chatHistory = [];
const API_URL = 'http://localhost:5000/api/chat';

// Sidebar Toggle
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

function cleanLaTeXAndFormatting(text) {
    if (!text) return '';
    return text
        // Clean raw LaTeX text wrappers like $\text{Win} + \text{I}$ to Win + I
        .replace(/\$\\text\{([^}]+)\}\$/g, '`$1`')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\rightarrow/g, '➔')
        .replace(/\\leftarrow/g, '⬅')
        .replace(/\\Rightarrow/g, '➔')
        .replace(/\\Leftarrow/g, '⬅')
        .replace(/\$([^\$\n]+)\$/g, '$1');
}

// Load context from handoff script if available
fetch('handoff_context.json')
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            chatHistory = data;
            welcomeScreen.style.display = 'none';
            data.forEach(msg => {
                if (msg.role !== 'system') {
                    const row = document.createElement('div');
                    row.classList.add('message-row', msg.role);
                    const cleaned = cleanLaTeXAndFormatting(msg.content);
                    const content = msg.role === 'user' ? escapeHtml(msg.content) : marked.parse(cleaned);
                    row.innerHTML = `<div class="avatar"></div><div class="message-bubble">${content}</div>`;
                    messagesContainer.appendChild(row);
                }
            });
            chatViewport.scrollTop = chatViewport.scrollHeight;
        }
    })
    .catch(() => console.log("Starting fresh session."));

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Auto-resize input
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    sendButton.disabled = this.value.trim() === '';
});

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

function setInput(text) {
    messageInput.value = text;
    messageInput.dispatchEvent(new Event('input'));
    sendMessage();
}

function appendMessage(role, content) {
    welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.classList.add('message-row', role);
    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    const cleaned = cleanLaTeXAndFormatting(content);
    bubble.innerHTML = role === 'user' ? escapeHtml(content) : marked.parse(cleaned);
    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    chatViewport.scrollTop = chatViewport.scrollHeight;
    return bubble;
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;

    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const aiBubble = appendMessage('assistant', '<span style="color:var(--text-muted)">Thinking...</span>');
    let fullResponse = '';
    let thinkingLogs = [];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chatHistory,
                model: document.getElementById('model-selector').value
            })
        });

        if (!response.ok) throw new Error(`Server returned status ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.thinking) {
                            thinkingLogs.push(data.thinking);
                            renderAssistantMessage(aiBubble, thinkingLogs, fullResponse);
                        } else if (data.system) {
                            thinkingLogs.push(`⚙️ ${data.system}`);
                            renderAssistantMessage(aiBubble, thinkingLogs, fullResponse);
                        } else if (data.content) {
                            fullResponse += data.content;
                            renderAssistantMessage(aiBubble, thinkingLogs, fullResponse);
                        } else if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch (e) {
                        // ignore partial chunk parse errors
                    }
                }
            }
            chatViewport.scrollTop = chatViewport.scrollHeight;
        }

        chatHistory.push({ role: 'assistant', content: fullResponse });

    } catch (error) {
        renderAssistantMessage(aiBubble, thinkingLogs, fullResponse);
        aiBubble.innerHTML += `<div style="color: #ef4444; margin-top:8px; font-weight:600">Error: ${error.message}</div>`;
    } finally {
        sendButton.disabled = false;
        messageInput.focus();
    }
}

function renderAssistantMessage(container, logs, responseText) {
    let thinkingHtml = '';
    if (logs.length > 0) {
        thinkingHtml = `
        <details class="thinking-drawer" open>
            <summary class="thinking-summary">
                <span class="thinking-icon">🧠</span> Thought Process <span class="thinking-count">(${logs.length} steps)</span>
            </summary>
            <div class="thinking-body">
                ${logs.map(log => `<div class="thinking-log-line">${escapeHtml(log)}</div>`).join('')}
            </div>
        </details>`;
    }
    const cleaned = cleanLaTeXAndFormatting(responseText);
    const contentHtml = responseText ? marked.parse(cleaned) : '';
    container.innerHTML = thinkingHtml + (contentHtml || '<span style="color:var(--text-muted)">Thinking...</span>');
}
