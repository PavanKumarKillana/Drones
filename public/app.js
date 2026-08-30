// Frontend Application Logic for Skylark BI Agent

const chatContainer = document.getElementById('chatContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const leadershipModal = document.getElementById('leadershipModal');
const modalBriefingContent = document.getElementById('modalBriefingContent');

let conversationHistory = [];
let currentBriefingMarkdown = '';

/**
 * Initialize Dashboard & Load Live Monday.com Board Metrics
 */
async function initDashboard() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        if (data.dealsBoard && data.workOrdersBoard) {
            const dealsRowsEl = document.getElementById('dealsBoardRows');
            const woRowsEl = document.getElementById('woBoardRows');
            const healthBadgeEl = document.getElementById('healthScoreBadge');
            
            if (dealsRowsEl) dealsRowsEl.textContent = `${data.dealsBoard.totalItems} Deals`;
            if (woRowsEl) woRowsEl.textContent = `${data.workOrdersBoard.totalItems} Work Orders`;
            if (healthBadgeEl) {
                const avgHealth = Math.round((data.dealsBoard.completenessScore + data.workOrdersBoard.completenessScore) / 2);
                healthBadgeEl.textContent = `${avgHealth}% Health`;
            }
        }

        // Fetch cross board summary to populate KPI top bar
        const crossRes = await fetch('/api/cross-board-summary');
        const crossData = await crossRes.json();

        if (crossData.executiveOverview) {
            const ov = crossData.executiveOverview;
            const kpiPipeEl = document.getElementById('kpiPipeline');
            const kpiDealsSubEl = document.getElementById('kpiDealsSubtext');
            const kpiWoEl = document.getElementById('kpiActiveWO');
            const kpiWinEl = document.getElementById('kpiWinRate');
            const kpiRiskEl = document.getElementById('kpiRisk');

            if (kpiPipeEl) kpiPipeEl.textContent = ov.pipelineRevenue || 'N/A';
            if (kpiDealsSubEl) kpiDealsSubEl.textContent = `${ov.totalDealsTracked || 0} Total Deals`;
            if (kpiWoEl) kpiWoEl.textContent = `${ov.totalWorkOrdersServiced || 0} Orders`;
            if (kpiWinEl) kpiWinEl.textContent = ov.dealWinRate || 'N/A';
            if (kpiRiskEl) kpiRiskEl.textContent = ov.revenueAtRiskFormatted || 'N/A';
        }
    } catch (err) {
        console.warn("Error loading live board metrics:", err);
    }
}

/**
 * Helper to safely sanitize and render markdown
 */
function renderSafeMarkdown(markdownText) {
    const rawHtml = typeof marked !== 'undefined' ? marked.parse(markdownText || '') : (markdownText || '');
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
}

/**
 * Append Message to Chat Container
 */
function appendMessage(text, role = 'bot') {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${role}`;
    avatar.innerHTML = role === 'user' ? '👤' : '🚁';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'user') {
        bubble.textContent = text;
    } else {
        bubble.innerHTML = renderSafeMarkdown(text);

        // Add action toolbar to bot replies (Copy, Read Aloud)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'msg-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-chip';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text);
            copyBtn.innerHTML = '✅ Copied!';
            setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
        };

        const speakBtn = document.createElement('button');
        speakBtn.className = 'action-chip';
        speakBtn.innerHTML = '🔊 Listen';
        speakBtn.onclick = () => speakText(text);

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(speakBtn);
        bubble.appendChild(actionsDiv);
    }

    if (role === 'user') {
        wrapper.appendChild(bubble);
        wrapper.appendChild(avatar);
    } else {
        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Chat Form Submission Handler
 */
async function handleChatSubmit(event) {
    if (event) event.preventDefault();

    const query = chatInput.value.trim();
    if (!query) return;

    // Append User Message
    appendMessage(query, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show Typing Indicator
    typingIndicator.style.display = 'flex';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: query,
                history: conversationHistory
            })
        });

        const data = await response.json();
        typingIndicator.style.display = 'none';

        if (data.reply) {
            appendMessage(data.reply, 'bot');
            conversationHistory.push({ role: 'user', content: query });
            conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
            appendMessage(`⚠️ ${data.error || 'Unable to process query.'}`, 'bot');
        }
    } catch (error) {
        typingIndicator.style.display = 'none';
        appendMessage('⚠️ Network connection failed. Please check if your server is running.', 'bot');
    }
}

/**
 * Quick-Prompt Pill Trigger
 */
function sendQuickPrompt(promptText) {
    chatInput.value = promptText;
    handleChatSubmit();
}

/**
 * Handle Enter Key in Textarea
 */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleChatSubmit();
    }
}

/**
 * Open Leadership Briefing Modal
 */
async function openLeadershipModal() {
    leadershipModal.style.display = 'flex';
    modalBriefingContent.innerHTML = `
        <div style="text-align:center; padding:3rem 0; color:var(--text-muted);">
            <div class="pulse-dot" style="margin:0 auto 1rem; width:12px; height:12px;"></div>
            Synthesizing cross-board executive briefing from live Monday.com data...
        </div>
    `;

    try {
        const res = await fetch('/api/leadership-briefing');
        const data = await res.json();

        if (data.scorecard) {
            const sc = data.scorecard;
            document.getElementById('briefingDate').textContent = `Generated: ${data.date || 'Today'}`;

            let sectorsMd = (data.sectorHighlights || []).map(s => 
                `| **${s.sector}** | ${s.dealsCount} | ${s.totalValue} | ${s.wonValue} | ${s.winRate} |`
            ).join('\n');

            let risksMd = (data.criticalRisks || []).map(r =>
                `* **${r.dealName}** (${r.client}) — **${r.dealValue}** | Status: *${r.executionStatus}* | Due: *${r.deliveryDate}*`
            ).join('\n');

            let actionsMd = (data.actionItems || []).map((a, i) => `${i+1}. ${a}`).join('\n');

            currentBriefingMarkdown = `# Skylark Drones — Executive Leadership Briefing
**Date:** ${data.date}

### 🎯 Key Performance Scorecard
* **Total Tracked Pipeline:** **${sc.totalPipeline}**
* **Active Serviced Orders:** **${sc.executedOrders}**
* **Overall Win Rate:** **${sc.winRate}**
* **Unbilled Balance:** **${sc.unbilledBalance}**
* **Revenue at Risk:** **${sc.revenueAtRisk}**
* **Work Order Completion:** **${sc.completionRate}**

---

### 💰 Commercial & Sector Highlights
| Sector | Deals | Total Pipeline | Won Revenue | Win Rate |
| :--- | :--- | :--- | :--- | :--- |
${sectorsMd}

---

### 🚨 Critical Operational Risks & Delays
${risksMd}

---

### 📋 Founder & Executive Action Items
${actionsMd}
`;

            modalBriefingContent.innerHTML = renderSafeMarkdown(currentBriefingMarkdown);
        } else {
            modalBriefingContent.innerHTML = `<div style="color:var(--accent-rose);">⚠️ ${data.error || 'Failed to load briefing.'}</div>`;
        }
    } catch (err) {
        modalBriefingContent.innerHTML = `<div style="color:var(--accent-rose);">⚠️ Error connecting to briefing endpoint.</div>`;
    }
}

function closeLeadershipModal() {
    leadershipModal.style.display = 'none';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function downloadBriefingMarkdown() {
    if (!currentBriefingMarkdown) return;
    const blob = new Blob([currentBriefingMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Skylark-Leadership-Briefing-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function printBriefing() {
    window.print();
}

function copyModalBriefing() {
    if (!currentBriefingMarkdown) return;
    navigator.clipboard.writeText(currentBriefingMarkdown);
    alert("✅ Leadership Briefing copied to clipboard!");
}

function speakText(text) {
    if (!window.speechSynthesis) {
        alert("Text-to-speech is not supported in this browser.");
        return;
    }
    window.speechSynthesis.cancel();
    // Clean markdown symbols for natural speech
    const cleanText = text.replace(/[*#`_\[\]()|>-]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function speakModalBriefing() {
    speakText(currentBriefingMarkdown);
}

// Auto-grow textarea on input
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
});

// Load live dashboard metrics on startup
document.addEventListener('DOMContentLoaded', initDashboard);
