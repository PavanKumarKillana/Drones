const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

/**
 * Data Resilience & Normalization Engine for Skylark Drones BI Agent
 * 
 * Handles real-world messy data:
 * - Parsing multiple date formats and Excel timestamps
 * - Cleaning noisy strings, masked values, currencies, numbers
 * - Normalizing sectors, statuses, and stages
 * - Computing comprehensive Data Quality Diagnostics
 */

// Common date formats found in messy business exports
const DATE_FORMATS = [
    'YYYY-MM-DD',
    'DD-MM-YYYY',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'YYYY/MM/DD',
    'DD-MMM-YYYY',
    'MMM YYYY',
    'MMMM YYYY',
    'YYYY-MM',
    'YYYY'
];

/**
 * Robust date parser that handles string formats, Excel serial numbers, and ISO strings
 */
function normalizeDate(rawDate) {
    if (!rawDate || rawDate === 'Unknown' || rawDate === 'null' || rawDate === 'N/A' || rawDate === 'None' || rawDate === '') {
        return null;
    }

    const str = String(rawDate).trim();

    // Check for Excel serial date numbers (e.g. 45123)
    if (/^\d{5}$/.test(str)) {
        const serial = parseInt(str, 10);
        // Excel base date is Dec 30, 1899
        const date = new Date((serial - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return dayjs(date).format('YYYY-MM-DD');
        }
    }

    // Try parsing standard ISO first
    let d = dayjs(str);
    if (d.isValid() && d.year() > 2000 && d.year() < 2100) {
        return d.format('YYYY-MM-DD');
    }

    // Try custom formats
    for (const fmt of DATE_FORMATS) {
        d = dayjs(str, fmt);
        if (d.isValid() && d.year() > 2000 && d.year() < 2100) {
            return d.format('YYYY-MM-DD');
        }
    }

    return null;
}

/**
 * Determine Financial Quarter from a date (e.g., "Q1 2026")
 */
function getQuarterFromDate(dateStr) {
    if (!dateStr) return 'Unscheduled / Unknown';
    const d = dayjs(dateStr);
    if (!d.isValid()) return 'Unscheduled / Unknown';
    const month = d.month() + 1; // 1-12
    const quarter = Math.ceil(month / 3);
    return `Q${quarter} ${d.year()}`;
}

/**
 * Clean and parse numeric values from currency strings, masked numbers, etc.
 */
function parseNumeric(val, fallback = 0) {
    if (val === undefined || val === null || val === 'Unknown' || val === 'N/A' || val === '' || val === 'None') {
        return fallback;
    }
    if (typeof val === 'number') return isNaN(val) ? fallback : val;

    // Remove currency symbols, commas, spaces, text
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
}

/**
 * Format currency into readable Indian Lakhs / Crores or Standard Currency
 */
function formatCurrency(amount, currency = '₹') {
    const num = Number(amount) || 0;
    if (num >= 10000000) {
        return `${currency}${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
        return `${currency}${(num / 100000).toFixed(2)} Lakhs`;
    }
    return `${currency}${num.toLocaleString('en-IN')}`;
}

/**
 * Normalize Sector naming conventions across both boards
 */
function normalizeSector(sectorStr) {
    if (!sectorStr || sectorStr === 'Unknown' || sectorStr === 'N/A') return 'Other / Unassigned';
    const lower = String(sectorStr).toLowerCase().trim();

    if (lower.includes('energy') || lower.includes('power') || lower.includes('solar') || lower.includes('wind') || lower.includes('renewable')) {
        return 'Energy & Utilities';
    }
    if (lower.includes('mining') || lower.includes('coal') || lower.includes('mineral')) {
        return 'Mining';
    }
    if (lower.includes('infra') || lower.includes('road') || lower.includes('rail') || lower.includes('highway') || lower.includes('construction') || lower.includes('urban')) {
        return 'Infrastructure';
    }
    if (lower.includes('agri') || lower.includes('farm') || lower.includes('crop')) {
        return 'Agriculture';
    }
    if (lower.includes('defence') || lower.includes('defense') || lower.includes('gov') || lower.includes('survey')) {
        return 'Government & Defense';
    }
    return sectorStr.trim();
}

/**
 * Normalize Deal Status & Probability
 */
function normalizeDealStatus(status) {
    if (!status || status === 'Unknown') return 'Open';
    const lower = String(status).toLowerCase().trim();
    if (lower.includes('won') || lower.includes('closed won')) return 'Won';
    if (lower.includes('lost') || lower.includes('closed lost') || lower.includes('drop')) return 'Lost';
    if (lower.includes('open') || lower.includes('progress') || lower.includes('pipeline')) return 'Open';
    return status.trim();
}

/**
 * Normalize Work Order Execution Status
 */
function normalizeExecutionStatus(status) {
    if (!status || status === 'Unknown') return 'Pending / Unassigned';
    const lower = String(status).toLowerCase().trim();
    if (lower.includes('complet') || lower.includes('delivered') || lower.includes('done')) return 'Completed';
    if (lower.includes('hold') || lower.includes('pause') || lower.includes('blocked')) return 'On Hold';
    if (lower.includes('delay') || lower.includes('overdue')) return 'Delayed';
    if (lower.includes('progress') || lower.includes('wip') || lower.includes('ongoing') || lower.includes('active')) return 'In Progress';
    if (lower.includes('cancel') || lower.includes('dropped')) return 'Cancelled';
    return status.trim();
}

/**
 * Clean and normalize a full list of raw Deals rows from Monday.com
 */
function cleanDealsData(rawDeals) {
    let missingValueCount = 0;
    let missingCloseDateCount = 0;
    let missingOwnerCount = 0;

    const cleaned = rawDeals.map((deal, idx) => {
        const rawValue = deal['Masked Deal value'] || deal['Deal Value'] || deal['Value'];
        const dealValue = parseNumeric(rawValue, 0);
        if (dealValue === 0) missingValueCount++;

        const tentativeDate = normalizeDate(deal['Tentative Close Date']);
        const closeDate = normalizeDate(deal['Close Date (A)']);
        const primaryDate = closeDate || tentativeDate || normalizeDate(deal['Created Date']);
        if (!closeDate && !tentativeDate) missingCloseDateCount++;

        const owner = deal['Owner code'] || deal['BD/KAM Personnel code'] || 'Unassigned';
        if (owner === 'Unassigned' || owner === 'Unknown') missingOwnerCount++;

        const sector = normalizeSector(deal['Sector/service'] || deal['Sector']);
        const status = normalizeDealStatus(deal['Deal Status']);
        const probability = deal['Closure Probability'] || 'Medium';

        const quarter = getQuarterFromDate(primaryDate);

        return {
            id: deal['id'] || `deal_${idx + 1}`,
            name: deal['Item Name'] || `Deal #${idx + 1}`,
            clientCode: deal['Client Code'] || 'Unknown Client',
            ownerCode: owner,
            dealStatus: status,
            closureProbability: probability,
            dealValueRaw: rawValue || '0',
            dealValue: dealValue,
            dealValueFormatted: formatCurrency(dealValue),
            closeDateActual: closeDate,
            tentativeCloseDate: tentativeDate,
            effectiveDate: primaryDate,
            quarter: quarter,
            dealStage: deal['Deal Stage'] || 'Unknown Stage',
            product: deal['Product deal'] || 'Standard Drone Service',
            sector: sector,
            createdDate: normalizeDate(deal['Created Date']),
            _original: deal
        };
    });

    const total = cleaned.length;
    const qualityReport = {
        totalRecords: total,
        completenessScore: total > 0 ? Math.round(((total * 3 - (missingValueCount + missingCloseDateCount + missingOwnerCount)) / (total * 3)) * 100) : 100,
        missingValuesCount: missingValueCount,
        missingDatesCount: missingCloseDateCount,
        missingOwnersCount: missingOwnerCount,
        caveats: [
            missingValueCount > 0 ? `${missingValueCount} deals (${Math.round((missingValueCount/total)*100)}%) have masked/missing deal values.` : null,
            missingCloseDateCount > 0 ? `${missingCloseDateCount} deals lack verified tentative or actual close dates.` : null,
            missingOwnerCount > 0 ? `${missingOwnerCount} deals do not have an assigned BD/KAM owner code.` : null
        ].filter(Boolean)
    };

    return { cleaned, qualityReport };
}

/**
 * Clean and normalize a full list of raw Work Orders rows from Monday.com
 */
function cleanWorkOrdersData(rawOrders) {
    let missingDeliveryDateCount = 0;
    let missingBillingCount = 0;
    let overdueCount = 0;
    const today = dayjs().format('YYYY-MM-DD');

    const cleaned = rawOrders.map((wo, idx) => {
        const orderAmount = parseNumeric(wo['Amount in Rupees (Excl of GST) (Masked)'] || wo['Amount in Rupees (Incl of GST) (Masked)'], 0);
        const billedAmount = parseNumeric(wo['Billed Value in Rupees (Excl of GST.) (Masked)'] || wo['Billed Value in Rupees (Incl of GST.) (Masked)'], 0);
        const collectedAmount = parseNumeric(wo['Collected Amount in Rupees (Incl of GST.) (Masked)'], 0);
        const amountToBeBilled = parseNumeric(wo['Amount to be billed in Rs. (Exl. of GST) (Masked)'] || wo['Amount to be billed in Rs. (Incl. of GST) (Masked)'], 0);
        const amountReceivable = parseNumeric(wo['Amount Receivable (Masked)'], 0);

        const deliveryDate = normalizeDate(wo['Data Delivery Date']);
        const startDate = normalizeDate(wo['Probable Start Date']);
        const endDate = normalizeDate(wo['Probable End Date']);
        const poDate = normalizeDate(wo['Date of PO/LOI']);

        if (!deliveryDate && !endDate) missingDeliveryDateCount++;
        if (billedAmount === 0 && orderAmount > 0) missingBillingCount++;

        const executionStatus = normalizeExecutionStatus(wo['Execution Status']);
        const sector = normalizeSector(wo['Sector']);

        // Delay detection: If not completed and delivery date is past today
        const targetDate = deliveryDate || endDate;
        const isOverdue = targetDate && targetDate < today && executionStatus !== 'Completed';
        if (isOverdue) overdueCount++;

        return {
            id: wo['id'] || `wo_${idx + 1}`,
            name: wo['Item Name'] || `Work Order #${idx + 1}`,
            customerCode: wo['Customer Name Code'] || 'Unknown Customer',
            serialNumber: wo['Serial #'] || 'N/A',
            natureOfWork: wo['Nature of Work'] || 'One time Project',
            executionStatus: executionStatus,
            deliveryDate: deliveryDate,
            startDate: startDate,
            endDate: endDate,
            poDate: poDate,
            ownerCode: wo['BD/KAM Personnel code'] || 'Unassigned',
            sector: sector,
            typeOfWork: wo['Type of Work'] || 'Drone Survey / Inspection',
            softwareDeliverable: wo['Is any Skylark software platform part of the client deliverables in this deal?'] || 'NONE',
            orderAmount: orderAmount,
            orderAmountFormatted: formatCurrency(orderAmount),
            billedAmount: billedAmount,
            billedAmountFormatted: formatCurrency(billedAmount),
            collectedAmount: collectedAmount,
            collectedAmountFormatted: formatCurrency(collectedAmount),
            amountToBeBilled: amountToBeBilled || Math.max(0, orderAmount - billedAmount),
            amountToBeBilledFormatted: formatCurrency(amountToBeBilled || Math.max(0, orderAmount - billedAmount)),
            unbilledAmount: amountToBeBilled || Math.max(0, orderAmount - billedAmount),
            unbilledAmountFormatted: formatCurrency(amountToBeBilled || Math.max(0, orderAmount - billedAmount)),
            amountReceivable: amountReceivable,
            billingStatus: wo['Billing Status'] || 'Pending',
            isOverdue: !!isOverdue,
            deliveryQuarter: getQuarterFromDate(targetDate),
            _original: wo
        };
    });

    const total = cleaned.length;
    const qualityReport = {
        totalRecords: total,
        completenessScore: total > 0 ? Math.round(((total * 3 - (missingDeliveryDateCount + missingBillingCount)) / (total * 3)) * 100) : 100,
        missingDeliveryDateCount: missingDeliveryDateCount,
        missingBillingCount: missingBillingCount,
        overdueCount: overdueCount,
        caveats: [
            missingDeliveryDateCount > 0 ? `${missingDeliveryDateCount} work orders lack confirmed delivery dates.` : null,
            missingBillingCount > 0 ? `${missingBillingCount} active work orders have unrecorded or 0 billed values.` : null,
            overdueCount > 0 ? `${overdueCount} work orders are flagged as overdue/at-risk past their target delivery date.` : null
        ].filter(Boolean)
    };

    return { cleaned, qualityReport };
}

module.exports = {
    normalizeDate,
    getQuarterFromDate,
    parseNumeric,
    formatCurrency,
    normalizeSector,
    normalizeDealStatus,
    normalizeExecutionStatus,
    cleanDealsData,
    cleanWorkOrdersData
};
