// NovaMetrics Interactive SaaS Engine
const mockEvents = [
    { name: "Acme Corp · Enterprise Tier", plan: "Enterprise", amount: "$4,200/mo", status: "success", time: "2 mins ago" },
    { name: "Vercel Sync · Team Seat", plan: "Pro", amount: "$149/mo", status: "success", time: "14 mins ago" },
    { name: "Stripe Webhook · Automatic Charge", plan: "Standard", amount: "$49/mo", status: "success", time: "1 hour ago" },
    { name: "Supabase DB · Capacity Upgrade", plan: "Add-on", amount: "$250/mo", status: "pending", time: "3 hours ago" },
    { name: "Raycast Workflow · Team License", plan: "Pro", amount: "$120/mo", status: "success", time: "5 hours ago" },
    { name: "Linear API · Seat Sync", plan: "Enterprise", amount: "$1,800/mo", status: "success", time: "1 day ago" }
];

function renderTable(data = mockEvents) {
    const tbody = document.getElementById('events-tbody');
    if (!tbody) return;
    tbody.innerHTML = data.map(item => `
        <tr>
            <td><strong>${item.name}</strong></td>
            <td><code>${item.plan}</code></td>
            <td>${item.amount}</td>
            <td><span class="status-pill ${item.status}">${item.status.toUpperCase()}</span></td>
            <td style="color:var(--text-secondary);font-size:12px;">${item.time}</td>
        </tr>
    `).join('');
    const countEl = document.getElementById('event-count');
    if (countEl) countEl.textContent = `${data.length} items`;
}

document.addEventListener('DOMContentLoaded', () => {
    renderTable();

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'linear-dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            themeBtn.textContent = next === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
        });
    }

    // Search Filter
    const searchIn = document.getElementById('search-input');
    if (searchIn) {
        searchIn.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = mockEvents.filter(ev => 
                ev.name.toLowerCase().includes(q) || 
                ev.plan.toLowerCase().includes(q) ||
                ev.status.toLowerCase().includes(q)
            );
            renderTable(filtered);
        });
    }

    // New Report Action
    const newReportBtn = document.getElementById('new-report-btn');
    if (newReportBtn) {
        newReportBtn.addEventListener('click', () => {
            const newRev = Math.floor(124500 + Math.random() * 5000);
            document.getElementById('val-rev').textContent = `$${newRev.toLocaleString()}`;
            mockEvents.unshift({
                name: `Custom Event · Run #${Math.floor(Math.random()*900 + 100)}`,
                plan: "Pro",
                amount: `$${Math.floor(Math.random()*300 + 50)}/mo`,
                status: "success",
                time: "Just now"
            });
            renderTable();
        });
    }
});