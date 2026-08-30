const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { runAgent } = require('./agent');
const { getBoardsStatus, getCleanDeals, getCleanWorkOrders } = require('./mondayService');
const { generateLeadershipBriefing, getCrossBoardSynthesis } = require('./services/analyticsService');

const app = express();
const port = process.env.PORT || 3000;

// CORS Configuration
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
    origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map(s => s.trim())
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // Serve frontend files

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

/**
 * Health check & board status endpoint
 */
app.get('/api/status', async (req, res) => {
    try {
        const status = await getBoardsStatus();
        res.json(status);
    } catch (error) {
        console.error("Status check internal error:", error);
        res.status(500).json({ error: "Failed to retrieve board status. Please verify your Monday.com credentials." });
    }
});

/**
 * Executive Leadership Briefing endpoint
 */
app.get('/api/leadership-briefing', async (req, res) => {
    try {
        const briefing = await generateLeadershipBriefing();
        res.json(briefing);
    } catch (error) {
        console.error("Leadership briefing internal error:", error);
        res.status(500).json({ error: "Failed to generate leadership briefing. Please verify Monday.com board configuration." });
    }
});

/**
 * Cross-Board Analytics Snapshot
 */
app.get('/api/cross-board-summary', async (req, res) => {
    try {
        const summary = await getCrossBoardSynthesis();
        res.json(summary);
    } catch (error) {
        console.error("Cross board summary internal error:", error);
        res.status(500).json({ error: "Failed to generate cross-board summary. Please check your data connection." });
    }
});

/**
 * Main Conversational Chat endpoint
 */
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "A valid message string is required." });
    }

    try {
        console.log(`\n💬 User Question: "${message}"`);
        const reply = await runAgent(message, history || []);
        res.json({ reply });
    } catch (error) {
        console.error("Chat API Internal Error:", error);
        res.status(500).json({ 
            error: "Failed to process chat query. Please try again later."
        });
    }
});

app.listen(port, () => {
    console.log(`🚀 Skylark BI Agent running at http://localhost:${port}`);
    console.log(`Open http://localhost:${port} in your browser to access the Executive Dashboard.`);
});
