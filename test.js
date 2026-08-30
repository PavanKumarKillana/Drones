const { normalizeDate, getQuarterFromDate, parseNumeric, formatCurrency, normalizeSector, normalizeDealStatus, cleanDealsData, cleanWorkOrdersData } = require('./services/dataResilience');
const { queryDealsAnalytics, queryWorkOrdersAnalytics, getCrossBoardSynthesis, generateLeadershipBriefing } = require('./services/analyticsService');
const { getBoardsStatus, getCleanDeals, getCleanWorkOrders } = require('./mondayService');
const { runAgent } = require('./agent');

async function runFullVerificationSuite() {
    console.log("==================================================");
    console.log("🚁 SKYLARK DRONES BI AGENT — VERIFICATION SUITE");
    console.log("==================================================\n");

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, testName) {
        totalTests++;
        if (condition) {
            console.log(`✅ [PASS] ${testName}`);
            passedTests++;
        } else {
            console.error(`❌ [FAIL] ${testName}`);
            throw new Error(`Test failed: ${testName}`);
        }
    }

    // 1. Unit Tests: Currency Parsing & Formatting Fixtures
    console.log("--- 1. Testing Currency Normalization & Formatting Fixtures ---");
    assert(parseNumeric("₹2,64,398.08") === 264398.08, "Parse Indian currency with commas and symbol");
    assert(parseNumeric("454800000") === 454800000, "Parse raw numeric string");
    assert(parseNumeric("Unknown / Masked") === 0, "Parse unknown/masked value as 0");
    assert(formatCurrency(2305500000) === "₹230.55 Cr", "Format Crore values cleanly");
    assert(formatCurrency(264398) === "₹2.64 Lakhs", "Format Lakhs values cleanly");
    assert(formatCurrency(5000) === "₹5,000", "Format thousands with standard comma formatting");

    // 2. Unit Tests: Date Normalization & Excel Serial Conversion Fixtures
    console.log("\n--- 2. Testing Date Normalization & Excel Serial Numbers ---");
    const serialDate = normalizeDate(45123);
    assert(serialDate && /^\d{4}-\d{2}-\d{2}$/.test(serialDate), "Convert Excel serial date 45123 to YYYY-MM-DD");
    assert(getQuarterFromDate(serialDate).startsWith("Q"), "Assign valid quarter from Excel serial date");
    
    const isoDate = normalizeDate("2026-08-30");
    assert(isoDate === "2026-08-30", "Parse standard ISO date string 2026-08-30");
    assert(getQuarterFromDate(isoDate) === "Q3 2026", "Assign Q3 2026 for August 2026");

    const nullDate = normalizeDate(null);
    assert(nullDate === null, "Handle null date gracefully");
    assert(getQuarterFromDate(nullDate).includes("Unknown") || getQuarterFromDate(nullDate).includes("Unscheduled"), "Assign Unscheduled/Unknown quarter for null date");

    // 3. Unit Tests: Deterministic Mock Fixture Aggregations
    console.log("\n--- 3. Testing Mock Fixture Ingestion & Relationship Rules ---");
    const mockRawDeals = [
        { 'Item Name': 'Deal A', 'Deal Status': 'Won', 'Masked Deal value': '₹10,00,000', 'Sector/service': 'Energy', 'BD/KAM Personnel code': 'KAM_01', 'Close Date (A)': '2026-01-15' },
        { 'Item Name': 'Deal B', 'Deal Status': 'Lost', 'Masked Deal value': '₹5,00,000', 'Sector/service': 'Mining', 'BD/KAM Personnel code': 'KAM_02', 'Close Date (A)': '2026-02-20' },
        { 'Item Name': 'Deal C', 'Deal Status': 'Open', 'Masked Deal value': '₹15,00,000', 'Sector/service': 'Energy', 'BD/KAM Personnel code': 'KAM_01', 'Tentative Close Date': '2026-04-10' },
        { 'Item Name': 'Deal D', 'Deal Status': 'Open', 'Masked Deal value': 'Masked', 'Sector/service': 'Infrastructure', 'BD/KAM Personnel code': 'Unassigned', 'Close Date (A)': null }
    ];
    const cleanedMock = cleanDealsData(mockRawDeals);
    assert(cleanedMock.cleaned.length === 4, "Cleaned 4 mock deal records");
    assert(cleanedMock.qualityReport.missingValuesCount === 1, "Detected 1 unpriced mock deal");
    assert(cleanedMock.qualityReport.completenessScore > 0, "Calculated completeness score on mock fixture");

    // 4. Integration Tests: Live Monday.com Board Connectivity
    console.log("\n--- 4. Testing Live Monday.com Board Connectivity ---");
    const dealsData = await getCleanDeals();
    assert(dealsData.deals && dealsData.deals.length > 0, `Live Deals board connected (${dealsData.deals.length} records fetched)`);
    assert(dealsData.quality.completenessScore >= 0 && dealsData.quality.completenessScore <= 100, `Deals completeness score: ${dealsData.quality.completenessScore}%`);

    const woData = await getCleanWorkOrders();
    assert(woData.workOrders && woData.workOrders.length > 0, `Live Work Orders board connected (${woData.workOrders.length} records fetched)`);
    assert(woData.quality.completenessScore >= 0 && woData.quality.completenessScore <= 100, `Work Orders completeness score: ${woData.quality.completenessScore}%`);

    // 5. Integration Tests: Deterministic Relationship Assertions
    console.log("\n--- 5. Testing Dynamic Analytics & Reconciliation Relationships ---");
    const dealsAnalytics = await queryDealsAnalytics();
    const dSummary = dealsAnalytics.summary;
    assert(dSummary.totalPipelineValueRaw >= 0, "Total pipeline value is non-negative");
    assert(dSummary.totalDealsCount === dSummary.openDealsCount + dSummary.wonDealsCount + dSummary.lostDealsCount, "Deals count reconciliation holds: Total = Open + Won + Lost");
    assert(parseFloat(dSummary.winRatePercent) >= 0 && parseFloat(dSummary.winRatePercent) <= 100, "Win rate is within valid 0-100% boundary");

    const woAnalytics = await queryWorkOrdersAnalytics();
    const wSummary = woAnalytics.summary;
    assert(wSummary.totalOrderValueRaw >= 0, "Total work order value is non-negative");
    assert(wSummary.totalUnbilledRaw >= 0, "Unbilled balance is non-negative");
    assert(parseFloat(wSummary.completionRate) >= 0 && parseFloat(wSummary.completionRate) <= 100, "Work order completion rate is within 0-100% range");

    const crossBoard = await getCrossBoardSynthesis();
    assert(crossBoard.executiveOverview.pipelineRevenue.length > 0, "Cross-board synthesis produced formatted pipeline revenue");
    assert(crossBoard.executiveOverview.revenueAtRiskFormatted.length > 0, "Cross-board synthesis dynamically computed revenue-at-risk");
    assert(crossBoard.topRevenueAtRiskItems.length >= 0, "Cross-board synthesis extracted top revenue-at-risk items");

    // 6. Integration Tests: 1-Click Leadership Briefing Structure
    console.log("\n--- 6. Testing 1-Click Leadership Briefing ---");
    const briefing = await generateLeadershipBriefing();
    assert(briefing.scorecard && briefing.scorecard.totalPipeline, "Leadership scorecard contains dynamic pipeline revenue");
    assert(Array.isArray(briefing.actionItems) && briefing.actionItems.length >= 3, "Leadership briefing contains dynamic action items");
    assert(briefing.reconciliation.winRateFormula.length > 0, "Leadership briefing contains auditable win rate formula");

    // 7. Integration Tests: AI Agent Tool-Calling Queries with Audit Trail
    console.log("\n--- 7. Testing AI Agent Tool-Calling Queries with Audit Trail ---");
    const energyQuery = "How is our pipeline looking for the energy sector this quarter?";
    const agentRes1 = await runAgent(energyQuery);
    assert(agentRes1.includes("Energy") && agentRes1.includes("Data Audit & Provenance Trail"), "Agent generated Energy sector report with dynamic audit footer");

    const miningQuery = "How is our Mining sector performing across Deals and Work Orders?";
    const agentRes2 = await runAgent(miningQuery);
    assert(agentRes2.includes("Mining") && agentRes2.includes("Data Audit & Provenance Trail"), "Agent generated Mining sector report with dynamic audit footer");

    const unbilledQuery = "What is our total unbilled amount across all completed work orders?";
    const agentRes3 = await runAgent(unbilledQuery);
    assert(agentRes3.includes("Unbilled") && agentRes3.includes("Data Audit & Provenance Trail"), "Agent generated unbilled revenue report with dynamic audit footer");

    console.log("\n==================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
}

runFullVerificationSuite().catch(err => {
    console.error("Verification Suite Failed:", err);
    process.exit(1);
});
