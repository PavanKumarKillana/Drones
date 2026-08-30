# 🚁 Skylark Drones — Monday.com Business Intelligence AI Agent

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render.com-00c853?style=for-the-badge&logo=render&logoColor=white)](https://skylark-drone-bi-agent.onrender.com/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/PavanKumarKillana/Drones)
[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![GraphQL](https://img.shields.io/badge/Monday.com-GraphQL%20v2-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://monday.com)
[![Tests](https://img.shields.io/badge/Tests-29%2F29%20Passing-brightgreen?style=for-the-badge)](https://github.com/PavanKumarKillana/Drones)

An executive-tier **Business Intelligence AI Agent** built for founders and leadership at **Skylark Drones**. The system connects dynamically to live **Monday.com** GraphQL API boards (*Deals* and *Work Orders*), normalizes messy real-world business data, executes deterministic cross-board mathematical syntheses, detects **Revenue-at-Risk**, and formulates actionable executive updates with multi-channel leadership briefing exports (**Markdown, PDF, and Audio**).

---

## 🔗 Quick Evaluator Links
* 🌐 **Live Hosted Prototype:** [https://skylark-drone-bi-agent.onrender.com/](https://skylark-drone-bi-agent.onrender.com/)
* 📂 **Public GitHub Repository:** [https://github.com/PavanKumarKillana/Drones](https://github.com/PavanKumarKillana/Drones)
* 📑 **2-Page Executive Decision Log:** [`DECISION_LOG.md`](./DECISION_LOG.md)
* 🧪 **Automated Verification Suite:** Run `npm test` (29/29 tests pass)

---

## ⏱️ 2-Minute Evaluator Demo Script

Follow this 5-step test sequence on the live web app ([https://skylark-drone-bi-agent.onrender.com/](https://skylark-drone-bi-agent.onrender.com/)):

1. **Test Revenue at Risk:**  
   Click the `🚨 Operational Delivery Risks` shortcut in the sidebar or ask:  
   👉 *"Which work orders are overdue or in danger of delivery delays?"*  
   *Result:* Surfaces 47 overdue projects (**₹3.46 Cr Revenue-at-Risk**) and isolates *Project Sakura* with COMPANY197.
2. **Test Sector Deep Dive & Win Rates:**  
   Click `⛏️ Mining Sector` or ask:  
   👉 *"How is our Mining sector performing across Deals and Work Orders?"*  
   *Result:* Summarizes 106 Mining deals (**₹45.48 Cr pipeline**), top accounts (*Luffy*, *Naruto*, *Sasuke*), and unbilled balances.
3. **Test Invoicing & Unbilled Revenue:**  
   Ask: 👉 *"What is our total unbilled amount across all completed work orders?"*  
   *Result:* Reconciles **₹10.43 Cr unbilled balance** (₹5.82 Cr on completed orders awaiting immediate billing vs ₹3.95 Cr WIP).
4. **Test Audit Provenance:**  
   Notice the **Data Audit & Provenance Trail** at the bottom of every response displaying boards queried, record counts, and pipeline reconciliation equations.
5. **Test 1-Click Leadership Briefing:**  
   Click the blue `📋 Generate Leadership Briefing` button in the top bar.  
   *Result:* Opens the executive modal. Test **Export Markdown**, **Print / Save as PDF**, and **Listen (Audio Text-to-Speech)**.

---

## 📊 Sample Board Ground Truth (Sample Live Snapshot — August 2026 Ingestion)

> [!NOTE]
> The figures below represent a dated sample snapshot from the initial Monday.com board import. All runtime metrics, scorecards, win rates, and revenue-at-risk calculations are executed **purely dynamically** from the live Monday.com GraphQL API upon every request.

| Business Metric | Sample Snapshot Value | Breakdown / Context |
| :--- | :--- | :--- |
| **Total Tracked Sales Pipeline** | **₹230.55 Cr** | 346 opportunities across Energy, Mining, Infra & Tenders |
| **Active Open Opportunities** | **₹68.82 Cr** | 50 high-value enterprise deals |
| **Closed-Won Revenue** | **₹9.50 Cr** | 165 deals won (**47.7% Commercial Win Rate** by volume) |
| **Serviced Work Orders** | **₹21.16 Cr** | 176 field operational orders (119 Completed, 45 WIP, 12 On Hold) |
| **Invoiced Billed Revenue** | **₹10.74 Cr** | Invoiced to enterprise clients to date |
| **Unbilled Work Order Balance** | **₹10.43 Cr** | **₹5.82 Cr** on completed orders awaiting immediate invoice dispatch |
| **Cash Collections Realized** | **₹9.04 Cr** | Cash collected (leaving **₹1.70 Cr** in pending accounts receivable) |
| **Identified Revenue-at-Risk** | **₹3.46 Cr** | Driven by 47 overdue work orders & *Project Sakura* (COMPANY197: ₹30.59 Cr) |
| **Board Completeness Health** | **74% / 86%** | Audits 52% masked values, 75 unverified close dates, 19 unspecified delivery dates |

---

## 📋 Exact Monday.com Board Column Mappings

### 1. Deals Board (`Deal funnel Data` — ID: `5030967591`)
| Raw Monday Column Title | Data Type | Normalized Entity Property | Handling / Resilience Rule |
| :--- | :--- | :--- | :--- |
| `Item Name` | Text | `dealName` | Sanitized project name / deal identifier |
| `Client Code` | Text | `clientCode` | Unique customer account code (`COMPANY_XXX`) |
| `BD/KAM Personnel code` | Text | `ownerCode` | Unassigned records flagged in audit caveats |
| `Sector/service` | Dropdown | `sector` | Normalized into 5 verticals (Energy, Mining, Infra, Ag, Defense) |
| `Deal Stage` | Status | `dealStage` | Pipeline funnel phase |
| `Deal Status` | Status | `dealStatus` | Normalized into `Won`, `Lost`, `Open` |
| `Closure Probability` | Status | `closureProbability` | Low, Medium, High |
| `Masked Deal value` | Number/Text | `dealValue` | Cleaned currency string; unpriced leads excluded from avg calculations |
| `Tentative Close Date` | Date/Text | `tentativeCloseDate` | Parses Excel serials (`45123`), ISO, and months into `YYYY-MM-DD` |
| `Close Date (A)` | Date/Text | `closeDateActual` | Primary close date; assigns Financial Quarters (`Q1 2026`, etc.) |

### 2. Work Orders Board (`Work_Order_Tracker Data` — ID: `5030967561`)
| Raw Monday Column Title | Data Type | Normalized Entity Property | Handling / Resilience Rule |
| :--- | :--- | :--- | :--- |
| `Item Name` | Text | `orderName` | Operational project work order name |
| `Customer Name Code` | Text | `customerCode` | Correlated with Deals `clientCode` for cross-board join |
| `Execution Status` | Status | `executionStatus` | Normalized to `Completed`, `In Progress`, `On Hold`, `Delayed` |
| `Sector` | Dropdown | `sector` | Standardized industry sector |
| `Amount in Rupees (Excl of GST)` | Number/Text | `orderAmount` | Sanitized total contract amount |
| `Billed Value in Rupees` | Number/Text | `billedAmount` | Amount invoiced to client |
| `Amount to be billed in Rs.` | Number/Text | `unbilledAmount` | Unbilled balance (or `orderAmount - billedAmount`) |
| `Collected Amount in Rupees` | Number/Text | `collectedAmount` | Actual cash collected |
| `Data Delivery Date` | Date/Text | `deliveryDate` | Overdue flag triggered if `deliveryDate < today` and not completed |

---

## 🏗️ System Architecture

```
                                  ┌──────────────────────────────┐
                                  │      Monday.com Boards       │
                                  │  - Deals Board (5030967591)  │
                                  │  - Work Orders (5030967561)  │
                                  └──────────────┬───────────────┘
                                                 │ GraphQL API v2 (Cursor Pagination)
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │       mondayService.js       │
                                  │  (60s TTL Cache & Sync Fall) │
                                  └──────────────┬───────────────┘
                                                 │ Raw Messy Rows
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │   services/dataResilience.js │
                                  │ - Date Normalizer (Excel/ISO)│
                                  │ - Currency & Sector Parsing  │
                                  │ - Data Quality Diagnostics   │
                                  └──────────────┬───────────────┘
                                                 │ Normalized Entities
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │ services/analyticsService.js │
                                  │ - Deterministic Math Engine  │
                                  │ - Cross-Board Entity Matcher │
                                  │ - Revenue-at-Risk Detector   │
                                  └──────────────┬───────────────┘
                                                 │ Pure Analytical State
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │           agent.js           │
                                  │ - Intent Classifier & Router │
                                  │ - Granular Sector Synthesizer│
                                  │ - Audit Provenance Appender  │
                                  └──────────────┬───────────────┘
                                                 │ Executive Response + Audit Trail
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │       public/ Dashboard      │
                                  │ - Glassmorphism Dark Mode UI │
                                  │ - Top Live KPI Scorecard     │
                                  │ - 1-Click Leadership Briefing│
                                  │ - Markdown / PDF / TTS Audio │
                                  └──────────────────────────────┘
```

---

## ⚙️ Environment Variables (Render.com & Local)

| Variable Name | Required | Description | Sample / Production Value |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | HTTP Web Server Port | `3000` |
| `MONDAY_API_TOKEN` | Yes | Monday.com Personal API Token | `eyJhbGciOi...` (Monday GraphQL API v2 access) |
| `DEALS_BOARD_ID` | Yes | Monday Deals Board ID | `5030967591` |
| `WORK_ORDERS_BOARD_ID` | Yes | Monday Work Orders Board ID | `5030967561` |
| `GEMINI_API_KEY` | Optional | Google AI Studio Key (`AIzaSy...`) | Enables LLM generative rephrasing |

---

## ⚡ 30-Second Quick Start (Local Run)

```bash
# 1. Clone Repository
git clone https://github.com/PavanKumarKillana/Drones.git
cd Drones

# 2. Install Dependencies
npm install

# 3. Configure Environment
cp .env.example .env

# 4. Run Automated Test Suite (29/29 Passing)
npm test

# 5. Start Development Server
npm start
```
Open **`http://localhost:3000`** in your browser!

---

**Developed for Skylark Drones Technical Assignment**  
*Author:* Pavan Kumar Killana  
*Live Application:* [https://skylark-drone-bi-agent.onrender.com/](https://skylark-drone-bi-agent.onrender.com/)
