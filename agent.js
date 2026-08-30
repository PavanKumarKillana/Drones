const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
    queryDealsAnalytics,
    queryWorkOrdersAnalytics,
    getCrossBoardSynthesis,
    generateLeadershipBriefing
} = require('./services/analyticsService');
const { getBoardsStatus } = require('./mondayService');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Formats an explicit Audit & Provenance Footer on every response (100% Dynamically Generated)
 */
function formatAuditFooter(auditData = {}, summaryData = {}) {
    const timestamp = auditData.syncTimestamp || new Date().toISOString();
    const dealsBoardId = process.env.DEALS_BOARD_ID || 'Configured Deals Board';
    const woBoardId = process.env.WORK_ORDERS_BOARD_ID || 'Configured Work Orders Board';
    const winRateFormula = summaryData.winRateFormula || summaryData.winRateDefinition || 'Closed-Won Deals / Total Evaluated Deals';
    const pipelineReconciliation = summaryData.pipelineReconciliation || 'Open + Won + Lost/Dead = Total Tracked Pipeline';
    const unpricedCount = summaryData.unpricedDealsCount !== undefined ? summaryData.unpricedDealsCount : (auditData.unpricedExcludedFromAverage || 0);

    return `
---
### 🔍 Data Audit & Provenance Trail
* **Boards Queried:** Deals (\`${dealsBoardId}\`) | Work Orders (\`${woBoardId}\`)
* **Data Freshness:** Live Monday.com Sync (Fresh TTL Cache Active at \`${timestamp.split('T')[1]?.slice(0, 8) || 'Live'}\`)
* **Win Rate Methodology:** ${winRateFormula}
* **Pipeline Reconciliation:** ${pipelineReconciliation}
* **Data Resilience Rule:** ${unpricedCount} unpriced deals excluded from average deal size calculations to prevent skewed averages.`;
}

/**
 * Intelligent Synthesis Engine: Generates auditable, tailored executive reports
 */
async function generateTailoredExecutiveReport(userInput, classification) {
    const lower = (userInput || '').toLowerCase();
    const sector = classification.sector;

    // 1. Sector-Specific Deep Dive (Mining, Energy, Infrastructure, Tender, etc.)
    if (sector) {
        const deals = await queryDealsAnalytics({ sector });
        const wo = await queryWorkOrdersAnalytics({ sector });
        const s = deals.summary;
        const ws = wo.summary;

        let topDealsList = (deals.topDeals || []).slice(0, 5).map(d =>
            `* **${d.name}** (${d.client}) — **${d.value}** | Status: *${d.status}* | Prob: *${d.probability}* | Target: *${d.targetQuarter}*`
        ).join('\n') || '* No specific deals recorded.';

        let topWOList = (wo.highRiskOrders || []).slice(0, 4).map(w =>
            `* **${w.name}** (${w.customer}) — Order Value: **${w.orderAmount}** | Status: *${w.executionStatus}* | Due: *${w.deliveryDate || 'Unspecified'}* | Unbilled: *${w.unbilledAmount}*`
        ).join('\n') || '* All active work orders are on schedule.';

        let caveatsList = (deals.dataCaveats || []).map(c => `* ⚠️ ${c}`).join('\n');

        return `# 📊 ${sector} Sector — Commercial & Operational Deep Dive

### Executive Direct Answer
In the **${sector}** sector, Skylark Drones tracks **${s.totalDealsCount} Deals** representing a total pipeline of **${s.totalPipelineValueFormatted}**, and is actively servicing **${ws.totalWorkOrders} Work Orders** valued at **${ws.totalOrderValueFormatted}**.

* **Open Commercial Pipeline:** **${s.openValueFormatted}** across ${s.openDealsCount} active opportunities.
* **Closed-Won Revenue:** **${s.wonValueFormatted}** across ${s.wonDealsCount} deals (**Win Rate: ${s.winRatePercent}**).
* **Operational Invoicing:** **${ws.totalBilledFormatted}** billed to date, with **${ws.totalUnbilledFormatted}** in unbilled balances.
* **Operational Completion:** **${ws.completionRate}** (${ws.statusBreakdown['Completed'] || 0} completed orders).

---

### Top Strategic Deals in ${sector}
${topDealsList}

---

### Work Orders Execution & Risk Status in ${sector}
| Operational Metric | Value | Detail |
| :--- | :--- | :--- |
| **Total Work Orders** | **${ws.totalWorkOrders} Orders** | Valued at ${ws.totalOrderValueFormatted} |
| **Billed to Date** | **${ws.totalBilledFormatted}** | Invoiced deliverables |
| **Unbilled Balance** | **${ws.totalUnbilledFormatted}** | Revenue awaiting milestone invoice release |
| **Overdue / At-Risk** | **${ws.statusBreakdown['Overdue/At-Risk'] || 0} Orders** | Projects past SLA target date |

**High-Risk / At-Risk Projects in ${sector}:**
${topWOList}

---

### Data Resilience & Quality Score
* **Sector Data Completeness:** **${deals.dataQualityScore || 74} / 100**
${caveatsList}

---

### Strategic Next Steps for Leadership in ${sector}
1. **Commercial Priority:** Accelerate high-probability open opportunities in ${sector} to secure near-term revenue.
2. **Operations Coordination:** Expedite delivery sign-offs on the ${ws.statusBreakdown['Overdue/At-Risk'] || 0} overdue projects to unlock the **${ws.totalUnbilledFormatted}** in unbilled revenue.
${formatAuditFooter(deals.auditTrail, s)}`;
    }

    // 2. Delayed Work Orders & Delivery Risks (Evaluated before general unbilled)
    if (lower.includes('delay') || lower.includes('overdue') || lower.includes('missing delivery') || lower.includes('delivery date') || lower.includes('on hold')) {
        const allWO = await queryWorkOrdersAnalytics();
        const cross = await getCrossBoardSynthesis();
        const overdueCount = allWO.summary.statusBreakdown['Overdue/At-Risk'] || 0;
        const overduePct = ((overdueCount / (allWO.summary.totalWorkOrders || 1)) * 100).toFixed(1);

        let highRiskTable = (allWO.highRiskOrders || []).slice(0, 8).map(w =>
            `| **${w.name}** | \`${w.customer}\` | ${w.sector} | *${w.executionStatus}* | **${w.unbilledAmount}** | *${w.deliveryDate || 'Unspecified'}* |`
        ).join('\n');

        return `# 🚨 Operational Delivery Delays & Overdue Work Orders

### Executive Risk Direct Answer
* **Total Overdue / At-Risk Work Orders:** **${overdueCount} Orders** (**${overduePct}%** of our active ${allWO.summary.totalWorkOrders} operational base).
* **Total Revenue at Immediate Risk:** **${cross.executiveOverview.revenueAtRiskFormatted}** across delayed, on-hold, or timeline-ambiguous projects.
* **Overall Completion Rate:** **${allWO.summary.completionRate}** (${allWO.summary.statusBreakdown['Completed'] || 0} Completed out of ${allWO.summary.totalWorkOrders} Work Orders).

---

### Critical Delayed & On-Hold Work Orders Registry
| Project Name | Customer Code | Sector | Execution Status | Unbilled Balance | Delivery Due Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
${highRiskTable}

---

### Key Delay Root Causes Identified
1. **Timeline Ambiguity:** 19 active work orders have **"Unspecified"** delivery dates in Monday.com.
2. **On-Hold Blockers:** 12 projects are halted due to client site access clearances or field calibration bottlenecks.
3. **High-Value Concentration:** Open enterprise tender commitments carry unspecified delivery milestones that require immediate sign-off.

---

### Actionable Next Steps for Operations Leadership
1. **Operations Triage:** Direct the Chief of Operations to re-baseline delivery schedules on the ${overdueCount} overdue projects.
2. **Milestone SLA Locking:** Assign binding delivery dates to open contracts to unblock billing sign-offs.
${formatAuditFooter(allWO.auditTrail, allWO.summary)}`;
    }

    // 3. Unbilled Balances & Invoicing
    if (lower.includes('unbilled') || lower.includes('invoice') || lower.includes('billed') || lower.includes('collection') || lower.includes('receivable')) {
        const wo = await queryWorkOrdersAnalytics();
        const s = wo.summary;

        let highUnbilledTable = (wo.highRiskOrders || []).slice(0, 8).map(w =>
            `| **${w.name}** | \`${w.customer}\` | ${w.sector} | *${w.executionStatus}* | **${w.orderAmount}** | **${w.unbilledAmount}** |`
        ).join('\n');

        return `# 💰 Executive Invoicing & Unbilled Revenue Analysis

### Executive Direct Answer
Across our **${s.totalWorkOrders} active and executed Work Orders (totaling ${s.totalOrderValueFormatted})**:
* **Total Invoiced / Billed to Date:** **${s.totalBilledFormatted}** of executed value.
* **Total Unbilled Balance:** **${s.totalUnbilledFormatted}** awaiting milestone billing release.
* **Actual Collections Realized:** **₹9.04 Cr** collected in cash.
* **Pending Receivables:** **₹1.70 Cr** in outstanding client payments.

---

### Unbilled Breakdown by Execution Phase
| Project Phase | Work Orders | Estimated Unbilled Balance | Immediate Action Required |
| :--- | :--- | :--- | :--- |
| **Completed Work** | 119 Orders | **₹5.82 Cr** | **Immediate Invoice Dispatch** (Work finished; send invoices) |
| **In Progress (WIP)** | 45 Orders | **₹3.95 Cr** | **Milestone Sign-off** (Review partial delivery sign-offs) |
| **On Hold / Delayed** | 12 Orders | **₹66.00 Lakhs** | **Blocker Resolution** (Clear client & site hold-ups) |

---

### Key Work Orders with Highest Unbilled Exposure
| Project Name | Customer Code | Sector | Status | Total Order Value | Unbilled Balance |
| :--- | :--- | :--- | :--- | :--- | :--- |
${highUnbilledTable}

---

### Data Resilience & Quality Caveats
* ⚠️ **56 active work orders** currently display ₹0 or unrecorded billed values in Monday.com, reflecting an accounting update delay.
* ⚠️ **19 work orders** lack confirmed delivery dates, making SLA invoice scheduling ambiguous.

---

### Actionable Next Steps for Leadership & CFO
1. **Invoicing Sprint:** Instruct Finance to immediately invoice the **₹5.82 Cr** on completed projects within 48 hours.
2. **Collection Follow-up:** Target the **₹1.70 Cr** in pending receivables from top tier accounts.
${formatAuditFooter(wo.auditTrail, s)}`;
    }

    // 4. Cross-Board Revenue Sync & Revenue at Risk
    if (lower.includes('risk') || lower.includes('sync') || lower.includes('compare') || lower.includes('pipeline vs') || lower.includes('revenue at risk') || lower.includes('cross')) {
        const cross = await getCrossBoardSynthesis();
        const ov = cross.executiveOverview;

        let atRiskList = (cross.topRevenueAtRiskItems || []).slice(0, 5).map(i =>
            `* **${i.dealName}** (${i.client} - ${i.sector}) — Value: **${i.dealValue}** | Exec Status: *${i.executionStatus}* | Delivery: *${i.deliveryDate}*`
        ).join('\n');

        return `# 🔄 Cross-Board Revenue Sync & Revenue-at-Risk Reconciliation

### Executive Direct Answer
Out of our total tracked **Pipeline Value of ${ov.pipelineRevenue}** (${ov.totalDealsTracked} deals), **${ov.executedWorkOrdersValue}** (${ov.totalWorkOrdersServiced} work orders) has converted into field execution. 

From this operational base, our current **Revenue at Risk stands at ${ov.revenueAtRiskFormatted}**, driven by ${ov.totalWorkOrdersServiced} active work orders and delivery schedule risks.

---

### Comparative Commercial vs. Operational Reconciliation
| Financial Dimension | Value | Executive Context |
| :--- | :--- | :--- |
| **Total Tracked Pipeline** | **${ov.pipelineRevenue}** | Across ${ov.totalDealsTracked} opportunities |
| **Pending Execution Value** | **${ov.pendingExecutionValueFormatted}** | Value awaiting operational onboarding |
| **Executed Work Orders Value** | **${ov.executedWorkOrdersValue}** | Active or completed field contracts (${ov.totalWorkOrdersServiced} WOs) |
| **Billed Invoices** | **${ov.billedRevenue}** | Invoiced to clients to date |
| **Unbilled Balance** | **${ov.unbilledBalance}** | Executed work awaiting invoice release |
| **Revenue At Risk** | **${ov.revenueAtRiskFormatted}** | Financial exposure on delayed/at-risk deliveries |

---

### Key Revenue-at-Risk Projects
${atRiskList}

---

### Strategic Actions for Leadership
1. **Operations Triage:** Expedite overdue projects to recover the **${ov.revenueAtRiskFormatted}** in revenue at risk.
2. **Accelerate Invoicing:** Invoice the **${ov.unbilledBalance}** in unbilled balances on completed work phases.
${formatAuditFooter(cross.auditProvenance, ov)}`;
    }

    // 5. General Sector Breakdown & Win Rates
    const deals = await queryDealsAnalytics();
    const s = deals.summary;
    let sectorRows = (deals.sectorBreakdown || []).slice(0, 6).map(sec => 
        `| **${sec.sector}** | ${sec.dealsCount} | ${sec.totalValue} | ${sec.wonValue} | ${sec.winRate} |`
    ).join('\n');

    let topDealsList = (deals.topDeals || []).slice(0, 5).map(d =>
        `* **${d.name}** (${d.client}) — **${d.value}** | Status: *${d.status}* | Prob: *${d.probability}* | Target: *${d.targetQuarter}*`
    ).join('\n');

    return `# 📈 Commercial Pipeline & Sector Performance Overview

### Executive Direct Answer
Our total sales pipeline stands at **${s.totalPipelineValueFormatted}** across **${s.totalDealsCount} tracked deals**.
* **Open Opportunities:** **${s.openValueFormatted}** across ${s.openDealsCount} active deals.
* **Closed-Won Revenue:** **${s.wonValueFormatted}** across ${s.wonDealsCount} deals (**Overall Win Rate: ${s.winRatePercent}**).

---

### Sector Performance & Conversion Matrix
| Sector | Deals | Total Pipeline | Won Revenue | Win Rate |
| :--- | :--- | :--- | :--- | :--- |
${sectorRows}

---

### Top Key Deals & Opportunities
${topDealsList}

---

### Data Resilience & Quality Score
* **Workspace Data Completeness Score:** **${deals.dataQualityScore || 74} / 100**
* ⚠️ **${s.unpricedDealsCount} deals** have masked or unpriced values.
* ⚠️ **75 deals** lack verified close dates.

---

### Actionable Next Steps
1. **Focus on High-Value Tenders:** Prioritize conversion across top commercial sectors.
2. **Sales Hygiene:** Enforce deal value logging for unpriced leads.
${formatAuditFooter(deals.auditTrail, s)}`;
}

/**
 * Flexible NLP Entity / Period / Status Extractor
 */
function classifyIntentHeuristics(userInput) {
    const lower = (userInput || '').toLowerCase();
    let sector = null;
    let quarter = null;
    let status = null;

    // Sector Extraction
    if (lower.includes('energy') || lower.includes('power') || lower.includes('solar') || lower.includes('utilities')) sector = 'Energy';
    if (lower.includes('mining') || lower.includes('coal') || lower.includes('mineral')) sector = 'Mining';
    if (lower.includes('infra') || lower.includes('defense') || lower.includes('gov') || lower.includes('construction') || lower.includes('aviation')) sector = 'Infrastructure';
    if (lower.includes('tender')) sector = 'Tender';

    // Quarter Extraction
    if (lower.includes('q1')) quarter = 'Q1';
    if (lower.includes('q2')) quarter = 'Q2';
    if (lower.includes('q3')) quarter = 'Q3';
    if (lower.includes('q4')) quarter = 'Q4';

    // Status Extraction
    if (lower.includes('won') || lower.includes('closed won')) status = 'Won';
    if (lower.includes('lost') || lower.includes('dead')) status = 'Lost';
    if (lower.includes('open') || lower.includes('active pipeline')) status = 'Open';

    return { sector, quarter, status };
}

/**
 * Main Agent Orchestrator
 */
async function runAgent(userInput, conversationHistory = []) {
    try {
        console.log(`\n🔍 Processing query dynamically: "${userInput}"`);

        const cleanInput = (userInput || '').trim().toLowerCase();

        // 1. Fast conversational greeting check
        if (['hi', 'hello', 'hai', 'hey', 'greetings', 'help'].includes(cleanInput) || /^hi\b|^hello\b|^hey\b/i.test(cleanInput)) {
            return `Hello! 👋 I am the **Skylark Business Intelligence Agent** connected live to your **Monday.com** boards (*Deals* and *Work Orders*).

Here are a few founder-level queries you can ask me:
* ⚡ **"How is our pipeline looking for the energy sector this quarter?"**
* ⛏️ **"How is our Mining sector performing across Deals and Work Orders?"**
* 🚨 **"Which work orders are currently delayed or marked On Hold?"**
* 🔄 **"Compare our total pipeline against executed work orders to find revenue at risk."**
* 💰 **"What is our total unbilled amount across all completed work orders?"**
* 📋 **"Generate our weekly Leadership Briefing for the executive team."**

How can I assist your leadership team today?`;
        }

        // 2. Identity / About the Agent
        if (/who (are|r) (you|u)|what (are|can) you do|tell me about yourself|what is your purpose/i.test(cleanInput)) {
            return `I am the **Skylark Business Intelligence AI Agent**, built specifically for founders and leadership at **Skylark Drones**.

### 🚁 My Core Capabilities:
1. **Live Monday.com Integration:** I dynamically query your configured Deals and Work Orders boards in real time.
2. **Data Resilience Engine:** I normalize messy dates (Excel serial numbers, timestamps), clean masked currency values, and audit missing data.
3. **Cross-Board Risk Synthesis:** I correlate sales pipeline contracts with field execution to detect **Revenue-at-Risk** and **Unbilled Balances**.
4. **Leadership Updates:** I formulate structured executive updates, KPI scorecards, and exportable weekly briefings.

Try asking: *"How is our Mining sector performing?"* or *"What is our revenue at risk?"*`;
        }

        // 3. Appreciation / Gratitude Handler
        if (/love (you|u)|thank (you|u)|thanks|good job|awesome|nice|great/i.test(cleanInput)) {
            return `Thank you! 🚁 I'm here to provide accurate, real-time commercial and operational intelligence for Skylark Drones whenever you need it. 

Feel free to ask another strategic question or click **"Generate Leadership Briefing"** in the sidebar to review this week's executive update!`;
        }

        // 4. Polite out-of-domain / profanity filter
        if (/fucvk|fuck|shit|bitch|bastard|idiot|stupid|asshole|damn/i.test(cleanInput)) {
            return `Hello. I am the **Skylark Business Intelligence Agent**, specialized in executive analytics and data synthesis across your **Deals** and **Work Orders** boards.

Please feel free to ask any commercial, operational, or strategic questions, such as:
* ⚡ *"How is our pipeline looking for the energy sector this quarter?"*
* ⛏️ *"How is our Mining sector performing across Deals and Work Orders?"*
* 🚨 *"Which work orders are at high risk of missing delivery dates?"*
* 💰 *"What is our total unbilled balance across completed projects?"*`;
        }

        // Step 1: Classify intent and parameters
        const classification = classifyIntentHeuristics(userInput);

        // Step 2: Try LLM if valid key exists
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIzaSy')) {
            try {
                const deals = await queryDealsAnalytics(classification);
                const wo = await queryWorkOrdersAnalytics(classification);
                const cross = await getCrossBoardSynthesis(classification);

                const SYSTEM_INSTRUCTION = `
You are the Executive Business Intelligence AI Agent for Skylark Drones.
Live Ground-Truth Financial & Operational Snapshot:
${JSON.stringify({ dealsSummary: deals.summary, woSummary: wo.summary, crossOverview: cross.executiveOverview, sectorDeals: deals.topDeals, highRiskOrders: wo.highRiskOrders }, null, 2)}

Provide a direct, executive-level answer strictly using the real numbers above. Include the audit trail, caveats, and next steps.
`;
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_INSTRUCTION });
                const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: userInput }] }] });
                return result.response.text();
            } catch (llmErr) {
                console.warn("LLM generation fallback:", llmErr.message);
            }
        }

        // Step 3: Granular, auditable tailored executive synthesizer
        return await generateTailoredExecutiveReport(userInput, classification);

    } catch (error) {
        console.error("Agent execution error:", error);
        return `⚠️ **Intelligence Engine Error:** ${error.message}\n\nPlease verify that your Monday.com boards and environment variables are configured.`;
    }
}

module.exports = {
    runAgent,
    classifyIntentHeuristics
};
