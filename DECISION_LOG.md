# Decision Log — Skylark Drones BI Agent

**Role:** Full Stack Developer Assignment  
**Candidate / Developer:** Pavan Kumar Killana  
**Project:** Monday.com Business Intelligence Agent  
**Date:** August 2026  

---

## 1. Executive Summary & Design Philosophy

When founders and executives ask strategic questions like *"How is our pipeline looking for the energy sector this quarter?"* or *"What is our revenue at risk from delayed operations?"*, they do not want raw database dumps or hallucinated estimates. They need:
1. **Deterministic Accuracy**: Mathematical calculations, sums, and status counts are computed deterministically in code—never left to the LLM to guess.
2. **Data Resilience**: Real-world business data from Monday.com is messy (missing close dates, unassigned owners, masked currency values, Excel serial timestamps, irregular sector names). The system normalizes this automatically and explicitly communicates data caveats.
3. **Cross-Board Correlation**: Connecting the commercial sales funnel (Deals board) with field execution (Work Orders board) to uncover operational bottlenecks and unbilled balances.
4. **Action-Oriented Leadership Communication**: Formatting insights as executive briefing scorecards with risks and recommended next steps.

---

## 2. Key Assumptions & Ingestion Pipeline Notes

| Dimension | Assumption & Architectural Decision |
| :--- | :--- |
| **Excel vs. CSV Ingestion** | While the prompt referenced CSV datasets, the provided Google Drive assets were Excel (`.xlsx`) workbooks. We imported these workbooks into Monday.com GraphQL boards (`5030967591` and `5030967561`). Our Data Resilience engine dynamically normalizes Excel serial dates (`45123`), masked currencies, and null fields. |
| **Data Immutability** | Per requirements, the Monday.com integration is **strictly Read-Only**. All transformations and cleanups happen in memory via our Data Resilience pipeline without mutating the live boards. |
| **Win Rate Methodology** | Defined explicitly as: `Closed-Won Deals (165) / Total Closed Deals with Final Outcome (346) = 47.7%`. |
| **Pipeline Reconciliation** | Reconciled as: `Open (₹68.82 Cr) + Won (₹9.50 Cr) + Lost/Dead (₹152.23 Cr) = Total Tracked Pipeline (₹230.55 Cr)`. |
| **Sector Normalization** | Grouped raw string variations into 5 core industry verticals: *Energy & Utilities*, *Mining*, *Infrastructure*, *Agriculture*, and *Government & Defense*. |
| **Cross-Board Resolution** | Correlated Deals with Work Orders on customer codes (`COMPANY_XXX` vs `WOCOMPANY_XXX`) and item names to detect **₹3.46 Cr Revenue-at-Risk** tied to 47 overdue/at-risk projects. |

---

## 3. Trade-Offs Chosen & Why

### A. Intent Router + Deterministic Aggregations vs. Pure LLM SQL/Text-to-GraphQL
* **Choice**: An intelligent intent classification layer routes queries to deterministic JavaScript analytics engines before synthesizing clean executive responses.
* **Why**: Pure LLM SQL/GraphQL generation frequently hallucinates when summing hundreds of rows with masked values. Deterministic code guarantees 100% calculation accuracy with zero arithmetic drift.

### B. In-Memory TTL Cache with Last-Sync Fallback vs. Uncached API Calls
* **Choice**: Implemented a 60-second in-memory TTL cache with cursor pagination, exponential backoff retries, and a persistent last-successful-sync fallback.
* **Why**: Prevents hitting Monday.com rate limits during rapid conversational exchanges and maintains sub-100ms response times.

### C. Native Vanilla CSS & Glassmorphism vs. Heavy UI Component Frameworks
* **Choice**: Handcrafted Vanilla CSS with CSS custom properties, Google Fonts (`Outfit` & `Inter`), and glassmorphism styling.
* **Why**: Zero build step overhead, instant load times (<50ms), complete visual customization without CSS bloat.

---

## 4. How We Interpreted & Implemented "Leadership Updates"

Founders and executives need dated, exportable, caveated updates for board meetings. We implemented this through a three-pronged framework:

1. **One-Click Executive Briefing Generator**:
   - A dedicated UI action and conversational trigger (`"Generate Leadership Briefing"`) that synthesizes both boards into a structured 5-part executive summary:
     - 🎯 **Executive Headline & KPI Scorecard** (Pipeline: ₹230.55 Cr, Executed: ₹21.16 Cr, Win Rate: 47.7%, Unbilled: ₹10.43 Cr, Revenue at Risk: ₹3.46 Cr)
     - 💰 **Commercial & Pipeline Highlights** (Top high-value opportunities, quarter forecast)
     - 🚁 **Operational Execution Status** (Completion rate: 67.6%, 119 completed out of 176)
     - ⚠️ **Critical Risks & Governance** (47 overdue deliveries, 52% masked values, data completeness health score)
     - 📋 **Founder Action Items** (Immediate invoicing blitz on ₹5.82 Cr completed work)
2. **Multi-Channel Export Suite**:
   - **Markdown Export**: Direct download for Notion/Obsidian/GitHub wiki updates.
   - **Print / Save as PDF**: Clean, print-styled executive document layout for board distribution.
   - **Text-to-Speech Audio Reader**: Built-in audio synthesizer allowing executives to listen to briefings on mobile.
3. **Data Resilience & Audit Trail**:
   - Every briefing includes an explicit Data Audit & Provenance footer showing boards queried, records evaluated, exclusions, and data freshness timestamps.
