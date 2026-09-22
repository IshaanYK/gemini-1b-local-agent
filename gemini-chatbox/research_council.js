/* ══════════════════════════════════════════════════════════════════════════
   B1 Research Council — research_council.js
   Isolated Client Controller for Collaborative Multi-Agent Research Workspace
   Linear Design System Specification (design-md-linear.app)
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function() {
    const RC_BACKEND_ORIGIN = (window.location.protocol.startsWith('http') && (window.location.port === '5000' || window.location.port === ''))
        ? window.location.origin
        : 'http://127.0.0.1:5000';
    const RC_API = `${RC_BACKEND_ORIGIN}/api/research`;

    // ── Isolated Council State ─────────────────────────────────────────────
    let rcCurrentSessionId = null;
    let rcCurrentDepth = 'standard';
    let rcActiveTab = 'chamber';
    let rcDeliberationMessages = [];
    let rcEvidenceItems = [];
    let rcFinalReport = '';
    let rcActiveAgents = [];
    let rcIsRunning = false;
    let rcCachedSessions = [];

    // ── DOM Element References ─────────────────────────────────────────────
    function getElements() {
        return {
            b1ChatContainer: document.getElementById('b1-chat-container'),
            rcContainer: document.getElementById('b1-research-council-container'),
            queryWrapper: document.getElementById('rc-query-wrapper'),
            queryExpanded: document.getElementById('rc-query-expanded'),
            queryCollapsed: document.getElementById('rc-query-collapsed'),
            inquiryTitleDisplay: document.getElementById('rc-inquiry-title-display'),
            inquiryDepthDisplay: document.getElementById('rc-inquiry-depth-display'),
            queryInput: document.getElementById('rc-query-input'),
            launchBtn: document.getElementById('rc-launch-btn'),
            statusBadge: document.getElementById('rc-status-stream-badge'),
            statusText: document.getElementById('rc-status-text'),
            pulseDot: document.getElementById('rc-pulse-dot'),
            deliberationStream: document.getElementById('rc-deliberation-stream'),
            evidenceTableBody: document.getElementById('rc-evidence-tbody'),
            reportContent: document.getElementById('rc-report-content'),
            rosterGrid: document.getElementById('rc-roster-grid'),
            sessionTitle: document.getElementById('rc-session-title'),
            evidenceCountBadge: document.getElementById('rc-evidence-count-badge'),
            agentCountBadge: document.getElementById('rc-agent-count-badge'),
            historyOverlay: document.getElementById('rc-history-overlay'),
            historyDrawer: document.getElementById('rc-history-drawer'),
            historyList: document.getElementById('rc-history-list'),
            rcToggleSidebar: document.getElementById('rc-toggle-sidebar')
        };
    }

    // ── Depth Formatting Map ───────────────────────────────────────────────
    function getDepthLabel(depth) {
        if (depth === 'rapid') return '⚡ Fast Scout (5 Agents)';
        if (depth === 'deep') return '🔬 Comprehensive (16+ Agents)';
        return '⚖️ Standard Council (10 Agents)';
    }

    // ── Single-Tab Workspace View Toggling ─────────────────────────────────
    window.openResearchCouncil = function() {
        const els = getElements();
        if (els.b1ChatContainer) els.b1ChatContainer.style.display = 'none';
        if (els.rcContainer) {
            els.rcContainer.style.display = 'flex';
            loadRoster();

            // Auto-restore previous active session if available so nothing is lost
            const savedSessionId = rcCurrentSessionId || localStorage.getItem('rc_current_session_id');
            if (savedSessionId && rcDeliberationMessages.length === 0) {
                loadSession(savedSessionId);
            } else if (!savedSessionId && rcDeliberationMessages.length === 0) {
                // Check if any previous sessions exist to auto-load latest
                loadLatestSessionIfAny();
            }
        }
    };

    window.backToB1 = function() {
        const els = getElements();
        if (els.rcContainer) els.rcContainer.style.display = 'none';
        if (els.b1ChatContainer) els.b1ChatContainer.style.display = 'flex';
        toggleResearchHistory(false);
    };

    // ── Header Collapse & Expansion Management ─────────────────────────────
    window.collapseQueryBar = function(topicText, depthLabel) {
        const els = getElements();
        if (els.queryExpanded) els.queryExpanded.style.display = 'none';
        if (els.queryCollapsed) {
            els.queryCollapsed.style.display = 'flex';
            if (els.inquiryTitleDisplay) els.inquiryTitleDisplay.textContent = topicText || 'Research Inquiry';
            if (els.inquiryDepthDisplay) els.inquiryDepthDisplay.textContent = depthLabel || getDepthLabel(rcCurrentDepth);
        }
    };

    window.expandQueryBar = function() {
        const els = getElements();
        if (els.queryCollapsed) els.queryCollapsed.style.display = 'none';
        if (els.queryExpanded) {
            els.queryExpanded.style.display = 'flex';
            els.queryInput?.focus();
        }
    };

    window.newInvestigation = function() {
        const els = getElements();
        rcCurrentSessionId = null;
        localStorage.removeItem('rc_current_session_id');
        rcDeliberationMessages = [];
        rcEvidenceItems = [];
        rcFinalReport = '';

        if (els.queryInput) els.queryInput.value = '';
        if (els.sessionTitle) els.sessionTitle.textContent = 'Deliberation Chamber';
        if (els.statusText) els.statusText.textContent = 'Ready to Convene';
        if (els.pulseDot) els.pulseDot.style.display = 'none';
        if (els.evidenceCountBadge) els.evidenceCountBadge.textContent = '0';

        // Reset views to welcome state
        if (els.deliberationStream) {
            els.deliberationStream.innerHTML = `
                <div class="rc-chamber-welcome">
                    <span class="rc-welcome-badge">✦ Multi-Agent Collaborative Environment</span>
                    <h2 class="rc-chamber-title">The B1 Research Council</h2>
                    <p class="rc-chamber-desc">
                        A decentralized team of specialized AI agents working together on complex questions.
                        Agents debate, challenge one another, verify primary sources on the live web, and synthesize comprehensive findings without bias or hallucination.
                    </p>
                    <div class="rc-features-grid">
                        <div class="rc-feature-pill">
                            <strong>16 Core Specialists</strong>
                            <span>Architects, web scouts, academics, red teams & fact checkers.</span>
                        </div>
                        <div class="rc-feature-pill">
                            <strong>Dynamic Domain Experts</strong>
                            <span>Automatically spins up specialists for medicine, space, finance, or law.</span>
                        </div>
                        <div class="rc-feature-pill">
                            <strong>Live Web Verification</strong>
                            <span>Autonomous retrieval and citation of real-time public primary sources.</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if (els.evidenceTableBody) {
            els.evidenceTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;padding:32px;color:var(--rc-ink-subtle);font-style:italic;">
                        No evidence logged yet. Launch an investigation to start collecting structured claims and citations.
                    </td>
                </tr>
            `;
        }

        if (els.reportContent) {
            els.reportContent.innerHTML = `
                <div style="color:var(--rc-ink-subtle);font-style:italic;">
                    The final synthesized research report will be compiled by the Research Writer once council deliberation concludes.
                </div>
            `;
        }

        expandQueryBar();
        switchCouncilTab('chamber');
    };

    // ── Depth Selector ─────────────────────────────────────────────────────
    window.setCouncilDepth = function(depth) {
        rcCurrentDepth = depth;
        document.querySelectorAll('.rc-depth-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-depth') === depth);
        });
    };

    // ── Workspace Tab Switching ────────────────────────────────────
    window.switchCouncilTab = function(tabName) {
        rcActiveTab = tabName;
        document.querySelectorAll('.rc-tab-item').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.rc-tab-content-pane').forEach(p => {
            p.style.display = (p.id === `rc-tab-${tabName}`) ? 'block' : 'none';
        });
        if (tabName === 'roster' && rcActiveAgents.length === 0) {
            loadRoster();
        }
    };

    // ── Fetch Agents & Roster ──────────────────────────────────────────────
    async function loadRoster(query = '') {
        try {
            const resp = await fetch(`${RC_API}/agents?query=${encodeURIComponent(query)}`);
            const data = await resp.json();
            if (data.status === 'success' && data.agents) {
                rcActiveAgents = data.agents;
                renderRoster(data.agents);
            }
        } catch (e) {
            console.warn('[RC] Roster fetch error:', e);
        }
    }

    function renderRoster(agents) {
        const els = getElements();
        if (!els.rosterGrid) return;
        if (els.agentCountBadge) els.agentCountBadge.textContent = agents.length;

        els.rosterGrid.innerHTML = agents.map(a => `
            <div class="rc-roster-card">
                <div class="rc-roster-header">
                    <div class="rc-agent-avatar">${a.icon || '🤖'}</div>
                    <div>
                        <div class="rc-roster-name">${escapeHtml(a.name)}</div>
                        <div class="rc-roster-role">${escapeHtml(a.role)}</div>
                    </div>
                </div>
                <div class="rc-roster-mission">${escapeHtml(a.mission)}</div>
            </div>
        `).join('');
    }

    // ── Launch Council Deliberation ────────────────────────────────────────
    window.launchCouncil = async function() {
        const els = getElements();
        const query = els.queryInput?.value.trim();
        if (!query || rcIsRunning) return;

        rcIsRunning = true;
        if (els.launchBtn) els.launchBtn.disabled = true;
        if (els.statusText) els.statusText.textContent = 'Council Convening & Deliberating...';
        if (els.pulseDot) els.pulseDot.style.display = 'inline-block';
        if (els.sessionTitle) els.sessionTitle.textContent = query.length > 45 ? query.substring(0, 45) + '...' : query;

        // Auto-collapse query input bar so deliberation fills screen
        collapseQueryBar(query, getDepthLabel(rcCurrentDepth));

        // Reset workspace views
        rcDeliberationMessages = [];
        rcEvidenceItems = [];
        rcFinalReport = '';
        if (els.deliberationStream) els.deliberationStream.innerHTML = '';
        if (els.evidenceTableBody) els.evidenceTableBody.innerHTML = '';
        if (els.reportContent) els.reportContent.innerHTML = '<div style="color:var(--rc-ink-subtle);font-style:italic;">Synthesizing comprehensive research report across council agents...</div>';
        if (els.evidenceCountBadge) els.evidenceCountBadge.textContent = '0';

        switchCouncilTab('chamber');
        loadRoster(query);

        // Get currently selected model from B1 if available
        let activeModel = 'gemini-3.8-flash';
        const b1Selector = document.getElementById('model-selector');
        if (b1Selector && b1Selector.value) {
            activeModel = b1Selector.value;
        }

        try {
            const resp = await fetch(`${RC_API}/council/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    depth: rcCurrentDepth,
                    model: activeModel
                })
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        handleCouncilEvent(event);
                    } catch (err) {}
                }
            }

        } catch (err) {
            console.error('[RC] Deliberation error:', err);
            appendSystemNotice(`Council deliberation error: ${err.message}`);
        } finally {
            rcIsRunning = false;
            if (els.launchBtn) els.launchBtn.disabled = false;
            if (els.statusText) els.statusText.textContent = 'Council Deliberation Complete';
            if (els.pulseDot) els.pulseDot.style.display = 'none';
        }
    };

    // ── Handle Deliberation SSE Stream Events ──────────────────────────────
    function handleCouncilEvent(event) {
        const els = getElements();
        if (event.type === 'phase_progress') {
            const banner = document.createElement('div');
            banner.className = 'rc-phase-banner';
            banner.innerHTML = `
                <span>✦ Phase ${event.phase}:</span>
                <strong>${escapeHtml(event.name)}</strong>
            `;
            els.deliberationStream?.appendChild(banner);
            scrollToBottom();
        } else if (event.type === 'agent_turn') {
            rcDeliberationMessages.push(event);
            renderAgentTurnCard(event);
        } else if (event.type === 'evidence_item') {
            addEvidenceItem(event.evidence);
        } else if (event.type === 'final_report') {
            rcFinalReport = event.report;
            renderFinalReport(event.report);
            if (event.session_id) {
                rcCurrentSessionId = event.session_id;
                localStorage.setItem('rc_current_session_id', event.session_id);
            }
            renderSynthesisCallout();
        } else if (event.type === 'thinking') {
            if (els.statusText) els.statusText.textContent = `${event.agent}: ${event.text}`;
        }
    }

    function renderSynthesisCallout() {
        const els = getElements();
        if (!els.deliberationStream) return;
        
        // Remove existing callout if present
        const oldCallout = els.deliberationStream.querySelector('.rc-synthesis-callout');
        if (oldCallout) oldCallout.remove();

        const callout = document.createElement('div');
        callout.className = 'rc-synthesis-callout';
        callout.innerHTML = `
            <div class="rc-synthesis-callout-left">
                <div class="rc-synthesis-callout-icon">📋</div>
                <div class="rc-synthesis-callout-content">
                    <h4>Master Strategic Blueprint Ready</h4>
                    <p>The Council has concluded its multi-agent debate and synthesized the definitive execution blueprint.</p>
                </div>
            </div>
            <button class="rc-synthesis-view-btn" onclick="switchCouncilTab('report')">
                View Full Synthesis Report ➔
            </button>
        `;
        els.deliberationStream.appendChild(callout);
        scrollToBottom();

        // Highlight report tab
        const reportTabBtn = document.querySelector('.rc-segmented-btn[data-tab="report"]');
        if (reportTabBtn) {
            reportTabBtn.style.color = '#828fff';
            reportTabBtn.style.fontWeight = '700';
        }
    }

    function renderAgentTurnCard(evt) {
        const els = getElements();
        if (!els.deliberationStream) return;

        const a = evt.agent || { name: 'Council Agent', role: 'Specialist', icon: '🤖' };
        const isChallenge = evt.is_challenge || evt.action?.toLowerCase().includes('challenge') || evt.action?.toLowerCase().includes('adversarial') || evt.action?.toLowerCase().includes('attack');
        const card = document.createElement('div');
        card.className = `rc-agent-card ${isChallenge ? 'challenge' : ''}`;

        const citations = evt.citations || [];
        const citationsHtml = (citations.length > 0)
            ? `<div class="rc-citations-box">
                ${citations.map(c => `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener" class="rc-citation-chip">🔗 ${escapeHtml(c.title)}</a>`).join('')}
               </div>`
            : '';

        let formattedBody = '';
        if (window.marked && typeof marked.parse === 'function') {
            try {
                if (typeof marked.setOptions === 'function') {
                    marked.setOptions({ gfm: true, breaks: true });
                }
                formattedBody = marked.parse(evt.content || '');
            } catch (e) {
                formattedBody = escapeHtml(evt.content || '').replace(/\n/g, '<br>');
            }
        } else {
            formattedBody = escapeHtml(evt.content || '').replace(/\n/g, '<br>');
        }

        card.innerHTML = `
            <div class="rc-agent-header">
                <div class="rc-agent-meta">
                    <div class="rc-agent-avatar">${a.icon || '🤖'}</div>
                    <span class="rc-agent-name">${escapeHtml(a.name)}</span>
                    <span class="rc-agent-role-pill">${escapeHtml(a.role || '')}</span>
                </div>
                <span class="rc-agent-action-badge ${isChallenge ? 'challenge' : ''}">${escapeHtml(evt.action || 'Analysis')}</span>
            </div>
            <div class="rc-agent-body">${formattedBody}</div>
            ${citationsHtml}
        `;

        els.deliberationStream.appendChild(card);
        scrollToBottom();
    }

    function addEvidenceItem(ev) {
        const els = getElements();
        if (!els.evidenceTableBody) return;

        rcEvidenceItems.push(ev);
        if (els.evidenceCountBadge) els.evidenceCountBadge.textContent = rcEvidenceItems.length;

        // Remove empty state row if present
        const emptyRow = els.evidenceTableBody.querySelector('td[colspan]');
        if (emptyRow) emptyRow.parentElement.remove();

        const statusLower = (ev.status || 'supported').toLowerCase();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(ev.claim)}</strong></td>
            <td>${escapeHtml(ev.evidence || 'Direct observation in retrieved primary sources.')}</td>
            <td style="color:${ev.counter_evidence ? 'var(--rc-danger)' : 'var(--rc-ink-subtle)'};">${escapeHtml(ev.counter_evidence || 'None identified.')}</td>
            <td><strong>${Math.round((ev.confidence || 0.85) * 100)}%</strong></td>
            <td><span class="rc-status-tag ${statusLower}">${escapeHtml(ev.status || 'SUPPORTED')}</span></td>
        `;
        els.evidenceTableBody.appendChild(tr);
    }

    function renderFinalReport(markdownText) {
        const els = getElements();
        if (!els.reportContent) return;

        let html = '';
        if (window.marked && typeof marked.parse === 'function') {
            try {
                if (typeof marked.setOptions === 'function') {
                    marked.setOptions({ gfm: true, breaks: true });
                }
                html = marked.parse(markdownText || '');
            } catch (e) {
                html = escapeHtml(markdownText || '').replace(/\n/g, '<br>');
            }
        } else {
            html = escapeHtml(markdownText || '').replace(/\n/g, '<br>');
        }
        els.reportContent.innerHTML = html;
    }

    function appendSystemNotice(text) {
        const els = getElements();
        if (!els.deliberationStream) return;
        const notice = document.createElement('div');
        notice.style.cssText = 'padding:8px 12px; background:var(--rc-surface-2); border-radius:var(--rc-radius-md); font-size:12px; color:var(--rc-danger);';
        notice.textContent = text;
        els.deliberationStream.appendChild(notice);
    }

    function scrollToBottom() {
        const container = document.querySelector('.rc-content-viewport');
        if (container) container.scrollTop = container.scrollHeight;
    }

    // ── Persistent Session Loading ─────────────────────────────────────────
    window.loadSession = async function(sessionId) {
        if (!sessionId) return;
        const els = getElements();
        if (els.statusText) els.statusText.textContent = 'Loading Saved Investigation...';

        try {
            const resp = await fetch(`${RC_API}/session/${encodeURIComponent(sessionId)}`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.status !== 'success' || !data.session) return;

            const s = data.session;
            rcCurrentSessionId = s.id;
            localStorage.setItem('rc_current_session_id', s.id);
            rcCurrentDepth = s.depth || 'standard';

            if (els.sessionTitle) els.sessionTitle.textContent = s.title || s.query;
            if (els.queryInput) els.queryInput.value = s.query || '';

            // Collapse query bar to give space
            collapseQueryBar(s.query, getDepthLabel(s.depth));

            // Populate deliberation messages
            rcDeliberationMessages = [];
            if (els.deliberationStream) {
                els.deliberationStream.innerHTML = '';
                const messages = data.messages || [];
                messages.forEach(m => {
                    const evt = {
                        agent: {
                            id: m.agent_id,
                            name: m.agent_name,
                            role: m.agent_role,
                            icon: m.agent_icon
                        },
                        action: m.action_type,
                        content: m.content,
                        citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : [],
                        is_challenge: m.action_type?.toLowerCase().includes('challenge')
                    };
                    rcDeliberationMessages.push(evt);
                    renderAgentTurnCard(evt);
                });
            }

            // Populate evidence items
            rcEvidenceItems = [];
            if (els.evidenceTableBody) {
                els.evidenceTableBody.innerHTML = '';
                const evList = data.evidence || [];
                if (evList.length === 0) {
                    els.evidenceTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align:center;padding:32px;color:var(--rc-ink-subtle);font-style:italic;">
                                No evidence logged for this investigation.
                            </td>
                        </tr>
                    `;
                } else {
                    evList.forEach(ev => addEvidenceItem(ev));
                }
                if (els.evidenceCountBadge) els.evidenceCountBadge.textContent = evList.length;
            }

            // Populate final report
            if (s.report) {
                rcFinalReport = s.report;
                renderFinalReport(s.report);
                renderSynthesisCallout();
            }

            if (els.statusText) els.statusText.textContent = 'Investigation Loaded';
            switchCouncilTab('chamber');

        } catch (err) {
            console.error('[RC] Failed to load session:', err);
        }
    };

    async function loadLatestSessionIfAny() {
        try {
            const resp = await fetch(`${RC_API}/sessions`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.status === 'success' && data.sessions && data.sessions.length > 0) {
                loadSession(data.sessions[0].id);
            }
        } catch (e) {}
    }

    // ── Saved Past Investigations Modal / Drawer ───────────────────────────
    window.toggleResearchHistory = function(show) {
        const els = getElements();
        const isOpen = els.historyDrawer?.style.display === 'flex';
        const shouldShow = (typeof show === 'boolean') ? show : !isOpen;

        if (els.historyOverlay) els.historyOverlay.style.display = shouldShow ? 'block' : 'none';
        if (els.historyDrawer) els.historyDrawer.style.display = shouldShow ? 'flex' : 'none';

        if (shouldShow) {
            loadResearchHistoryList();
        }
    };

    async function loadResearchHistoryList() {
        const els = getElements();
        if (!els.historyList) return;
        els.historyList.innerHTML = '<div style="color:var(--rc-ink-subtle);font-size:12px;padding:12px;">Loading investigations...</div>';

        try {
            const resp = await fetch(`${RC_API}/sessions`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.status === 'success' && data.sessions) {
                rcCachedSessions = data.sessions;
                renderHistoryItems(data.sessions);
            }
        } catch (e) {
            els.historyList.innerHTML = '<div style="color:var(--rc-danger);font-size:12px;padding:12px;">Failed to load saved investigations.</div>';
        }
    }

    function renderHistoryItems(sessions) {
        const els = getElements();
        if (!els.historyList) return;

        if (!sessions || sessions.length === 0) {
            els.historyList.innerHTML = '<div style="color:var(--rc-ink-subtle);font-size:12px;padding:24px;text-align:center;">No saved investigations yet. Launch one from the query bar!</div>';
            return;
        }

        els.historyList.innerHTML = sessions.map(s => {
            const isActive = s.id === rcCurrentSessionId;
            const dateStr = s.created_at ? new Date(s.created_at).toLocaleString() : '';
            return `
                <div class="rc-history-item ${isActive ? 'active' : ''}" onclick="selectResearchSession('${escapeHtml(s.id)}')">
                    <div class="rc-history-item-top">
                        <span class="rc-history-item-title">${escapeHtml(s.title || s.query)}</span>
                        <span class="rc-history-item-depth">${getDepthLabel(s.depth).split(' ')[0]}</span>
                    </div>
                    <div class="rc-history-item-date">${escapeHtml(dateStr)} • ${s.status === 'completed' ? '✓ Complete' : 'In Progress'}</div>
                </div>
            `;
        }).join('');
    }

    window.filterResearchHistory = function(query) {
        const q = (query || '').toLowerCase().trim();
        if (!q) {
            renderHistoryItems(rcCachedSessions);
            return;
        }
        const filtered = rcCachedSessions.filter(s =>
            (s.title && s.title.toLowerCase().includes(q)) ||
            (s.query && s.query.toLowerCase().includes(q))
        );
        renderHistoryItems(filtered);
    };

    window.selectResearchSession = function(sessionId) {
        toggleResearchHistory(false);
        loadSession(sessionId);
    };

    // ── Export Research Report ─────────────────────────────────────────────
    window.exportCouncilReport = function() {
        if (!rcFinalReport) {
            alert('No finalized research report available to export yet. Please launch a research deliberation first.');
            return;
        }
        const els = getElements();
        const title = els.queryInput?.value.trim() || 'b1_research_report';
        const filename = `${title.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').substring(0, 40)}_council_report.md`;

        const blob = new Blob([rcFinalReport], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Keyboard shortcut & event bindings ─────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('rc-query-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    launchCouncil();
                }
            });
        }

        // Wire sidebar toggle inside Research Council
        const rcSidebarBtn = document.getElementById('rc-toggle-sidebar');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (rcSidebarBtn && sidebar) {
            rcSidebarBtn.addEventListener('click', () => {
                const isCollapsed = sidebar.classList.toggle('collapsed');
                sidebar.classList.toggle('open');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.toggle('active', !isCollapsed && window.innerWidth <= 768);
                }
            });
        }
    });

})();
