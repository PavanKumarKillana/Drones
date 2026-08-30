const axios = require('axios');
const { cleanDealsData, cleanWorkOrdersData } = require('./services/dataResilience');
require('dotenv').config();

const MONDAY_API_URL = "https://api.monday.com/v2";

// In-memory cache with Last Successful Sync preservation
const cache = {
    deals: { data: null, quality: null, timestamp: 0, lastSuccessfulSync: null },
    workOrders: { data: null, quality: null, timestamp: 0, lastSuccessfulSync: null }
};

const CACHE_TTL_MS = 60 * 1000; // 60-second fresh TTL

/**
 * Executes a GraphQL query against Monday.com API v2 with Exponential Backoff & Retry
 */
async function queryMonday(query, variables = {}, retries = 3, backoffMs = 1000) {
    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
        throw new Error("MONDAY_API_TOKEN is missing in environment variables.");
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(
                MONDAY_API_URL,
                { query, variables },
                {
                    headers: {
                        'Authorization': token,
                        'API-Version': '2024-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: 12000 // 12-second timeout
                }
            );

            if (response.data.errors && response.data.errors.length > 0) {
                const errDetails = response.data.errors.map(e => e.message).join('; ');
                // If rate limited (Complexity budget exceeded or 429), retry with backoff
                if (errDetails.toLowerCase().includes('complexity') || errDetails.toLowerCase().includes('rate limit')) {
                    if (attempt < retries) {
                        console.warn(`[Monday API Rate Limit] Attempt ${attempt} failed. Retrying in ${backoffMs}ms...`);
                        await new Promise(r => setTimeout(r, backoffMs));
                        backoffMs *= 2;
                        continue;
                    }
                }
                throw new Error(`Monday.com API Error: ${errDetails}`);
            }

            return response.data.data;
        } catch (error) {
            const isRateLimit = error.response && (error.response.status === 429 || error.response.status >= 500);
            if (isRateLimit && attempt < retries) {
                console.warn(`[Monday API Network Error] Status ${error.response.status}. Retrying in ${backoffMs}ms...`);
                await new Promise(r => setTimeout(r, backoffMs));
                backoffMs *= 2;
                continue;
            }
            if (attempt === retries) {
                if (error.response) {
                    throw new Error(`Monday API status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
                }
                throw error;
            }
        }
    }
}

/**
 * Fetches raw items from a Monday.com board with full Cursor Pagination support
 */
async function fetchBoardData(boardId) {
    if (!boardId) {
        throw new Error("Board ID is missing.");
    }

    let allItems = [];
    let boardName = "";
    let cursor = null;
    let hasMore = true;

    // Initial page query
    const initialQuery = `
    query {
      boards(ids: ${boardId}) {
        id
        name
        description
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            state
            column_values {
              id
              text
              value
              type
              column {
                title
              }
              ... on MirrorValue {
                display_value
              }
            }
          }
        }
      }
    }`;

    const initialData = await queryMonday(initialQuery);
    if (!initialData.boards || initialData.boards.length === 0) {
        throw new Error(`Board ${boardId} not found or no permissions.`);
    }

    const board = initialData.boards[0];
    boardName = board.name;
    const page = board.items_page;
    allItems = [...(page.items || [])];
    cursor = page.cursor;

    // Cursor pagination loop if items exceed limit
    while (cursor && hasMore) {
        const nextQuery = `
        query($cursor: String!) {
          next_items_page(limit: 500, cursor: $cursor) {
            cursor
            items {
              id
              name
              state
              column_values {
                id
                text
                value
                type
                column {
                  title
                }
                ... on MirrorValue {
                  display_value
                }
              }
            }
          }
        }`;

        try {
            const nextData = await queryMonday(nextQuery, { cursor });
            if (nextData.next_items_page && nextData.next_items_page.items) {
                allItems.push(...nextData.next_items_page.items);
                cursor = nextData.next_items_page.cursor;
                if (!cursor || nextData.next_items_page.items.length === 0) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        } catch (err) {
            console.warn(`Cursor pagination stopped at ${allItems.length} items:`, err.message);
            hasMore = false;
        }
    }

    // Transform column values to friendly key-value pairs
    const transformedItems = allItems.map(item => {
        const row = {
            id: item.id,
            name: item.name,
            state: item.state,
            'Item Name': item.name
        };

        item.column_values.forEach(cv => {
            const val = cv.display_value || cv.text || cv.value || '';
            row[cv.id] = val;
            if (cv.column && cv.column.title) {
                row[cv.column.title] = val;
            }
        });

        return row;
    });

    return {
        boardId,
        boardName,
        totalRawCount: transformedItems.length,
        items: transformedItems,
        fetchedAt: new Date().toISOString()
    };
}

/**
 * Cleaned Deals Board Ingestion with Last-Successful-Sync Fallback
 */
async function getCleanDeals(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.deals.data && (now - cache.deals.timestamp < CACHE_TTL_MS)) {
        return {
            deals: cache.deals.data,
            quality: cache.deals.quality,
            isCached: true,
            syncTimestamp: cache.deals.lastSuccessfulSync
        };
    }

    const boardId = process.env.DEALS_BOARD_ID;
    if (!boardId) {
        throw new Error("DEALS_BOARD_ID environment variable is required.");
    }
    try {
        const rawData = await fetchBoardData(boardId);
        const { cleaned, qualityReport } = cleanDealsData(rawData.items);

        cache.deals.data = cleaned;
        cache.deals.quality = qualityReport;
        cache.deals.timestamp = now;
        cache.deals.lastSuccessfulSync = rawData.fetchedAt;

        return {
            deals: cleaned,
            quality: qualityReport,
            isCached: false,
            syncTimestamp: rawData.fetchedAt
        };
    } catch (err) {
        // Last Successful Sync Fallback
        if (cache.deals.data) {
            console.warn(`Monday Deals API call failed (${err.message}). Using last successful sync snapshot.`);
            return {
                deals: cache.deals.data,
                quality: cache.deals.quality,
                isCached: true,
                isFallback: true,
                syncTimestamp: cache.deals.lastSuccessfulSync
            };
        }
        throw err;
    }
}

/**
 * Cleaned Work Orders Board Ingestion with Last-Successful-Sync Fallback
 */
async function getCleanWorkOrders(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.workOrders.data && (now - cache.workOrders.timestamp < CACHE_TTL_MS)) {
        return {
            workOrders: cache.workOrders.data,
            quality: cache.workOrders.quality,
            isCached: true,
            syncTimestamp: cache.workOrders.lastSuccessfulSync
        };
    }

    const boardId = process.env.WORK_ORDERS_BOARD_ID;
    if (!boardId) {
        throw new Error("WORK_ORDERS_BOARD_ID environment variable is required.");
    }
    try {
        const rawData = await fetchBoardData(boardId);
        const { cleaned, qualityReport } = cleanWorkOrdersData(rawData.items);

        cache.workOrders.data = cleaned;
        cache.workOrders.quality = qualityReport;
        cache.workOrders.timestamp = now;
        cache.workOrders.lastSuccessfulSync = rawData.fetchedAt;

        return {
            workOrders: cleaned,
            quality: qualityReport,
            isCached: false,
            syncTimestamp: rawData.fetchedAt
        };
    } catch (err) {
        // Last Successful Sync Fallback
        if (cache.workOrders.data) {
            console.warn(`Monday Work Orders API call failed (${err.message}). Using last successful sync snapshot.`);
            return {
                workOrders: cache.workOrders.data,
                quality: cache.workOrders.quality,
                isCached: true,
                isFallback: true,
                syncTimestamp: cache.workOrders.lastSuccessfulSync
            };
        }
        throw err;
    }
}

/**
 * Board Status & Completeness Diagnostic
 */
async function getBoardsStatus() {
    const dealsResult = await getCleanDeals();
    const woResult = await getCleanWorkOrders();

    return {
        timestamp: new Date().toISOString(),
        dealsBoard: {
            id: process.env.DEALS_BOARD_ID || '5030967591',
            name: 'Deal funnel Data',
            totalItems: dealsResult.deals.length,
            completenessScore: dealsResult.quality.completenessScore,
            caveats: dealsResult.quality.caveats,
            syncTimestamp: dealsResult.syncTimestamp
        },
        workOrdersBoard: {
            id: process.env.WORK_ORDERS_BOARD_ID || '5030967561',
            name: 'Work_Order_Tracker Data',
            totalItems: woResult.workOrders.length,
            completenessScore: woResult.quality.completenessScore,
            caveats: woResult.quality.caveats,
            syncTimestamp: woResult.syncTimestamp
        }
    };
}

module.exports = {
    fetchBoardData,
    getCleanDeals,
    getCleanWorkOrders,
    getBoardsStatus
};
