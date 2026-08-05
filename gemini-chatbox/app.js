const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesContainer = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcome-screen');
const chatContainer = document.getElementById('chat-container');

let chatHistory = [];
const API_URL = 'http://localhost:5000/api/chat';

// Load context from handoff script if available
fetch('handoff_context.json')
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            chatHistory = data;
            welcomeScreen.style.display = 'none';
            // Render previous messages
            data.forEach(msg => {
                if(msg.role !== 'system') {
                    const div = document.createElement('div');
                    div.classList.add('message', msg.role);
                    const content = msg.role === 'user' ? msg.content : marked.parse(msg.content);
                    div.innerHTML = `<div class="avatar"></div><div class="message-content">${content}</div>`;
                    messagesContainer.appendChild(div);
                }
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    })
    .catch(e => console.log("No previous handoff context found. Starting fresh."));

// Auto-resize textarea
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
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = role === 'user' ? content : marked.parse(content);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentDiv;
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;
    
    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const aiMessageContentDiv = appendMessage('assistant', '<span style="color:var(--text-secondary)">Thinking...</span>');
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

        if (!response.ok) throw new Error(`Server returned ${response.status}`);

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
                            renderAssistantMessage(aiMessageContentDiv, thinkingLogs, fullResponse);
                        } else if (data.system) {
                            thinkingLogs.push(`⚙️ ${data.system}`);
                            renderAssistantMessage(aiMessageContentDiv, thinkingLogs, fullResponse);
                        } else if (data.content) {
                            fullResponse += data.content;
                            renderAssistantMessage(aiMessageContentDiv, thinkingLogs, fullResponse);
                        } else if (data.error) {
                            throw new Error(data.error);
                        }
                    } catch (e) {
                        // ignore malformed JSON or partial chunks
                    }
                }
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        chatHistory.push({ role: 'assistant', content: fullResponse });
        
    } catch (error) {
        renderAssistantMessage(aiMessageContentDiv, thinkingLogs, fullResponse);
        aiMessageContentDiv.innerHTML += `<div style="color: #ff5555; margin-top:8px">Error: ${error.message}</div>`;
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
                ${logs.map(log => `<div class="thinking-log-line">${log}</div>`).join('')}
            </div>
        </details>`;
    }
    const contentHtml = responseText ? marked.parse(responseText) : '';
    container.innerHTML = thinkingHtml + (contentHtml || '<span style="color:var(--text-secondary)">Thinking...</span>');
}
