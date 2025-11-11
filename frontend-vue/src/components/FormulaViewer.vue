<template>
    <div class="formula-viewer-container">
        <!-- Left Panel: Formula List -->
        <div class="left-panel" :class="{ collapsed: leftPanelCollapsed }">
            <div class="panel-header">
                <div class="panel-title">
                    <span class="panel-icon">🧮</span>
                    <span class="panel-text">Formulas</span>
                </div>
                <button class="collapse-button" @click="toggleLeftPanel">
                    {{ leftPanelCollapsed ? "▶" : "◀" }}
                </button>
            </div>

            <div v-if="!leftPanelCollapsed" class="panel-content">
                <div class="formula-search">
                    <input
                        v-model="formulaSearchQuery"
                        type="text"
                        placeholder="Search formulas..."
                        class="search-input"
                        @input="searchFormulas"
                    />
                </div>

                <div class="formula-list">
                    <div v-if="loadingFormulas" class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Loading formulas...</div>
                    </div>

                    <div v-else-if="allFormulas.length > 0" class="formula-grid">
                        <div
                            v-for="formula in allFormulas"
                            :key="formula.id"
                            :class="[
                                'formula-item',
                                { selected: selectedFormula && selectedFormula.id === formula.id },
                            ]"
                            @click="selectFormula(formula)"
                        >
                            <div class="formula-header">
                                <div class="formula-name">{{ formula.name }}</div>
                                <div class="formula-type">{{ formula.type }}</div>
                            </div>
                            <div class="formula-description">{{ formula.description }}</div>
                        </div>
                    </div>

                    <div v-else class="empty-state">
                        <div class="empty-text">No formulas found</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Center Panel: Main Content -->
        <div class="center-panel">
            <!-- Query Configuration Header -->
            <div class="query-header">
                <div class="query-title">
                    <div class="query-status">
                        <span v-if="selectedFormula" class="status-item">
                            <span class="status-label">Formula:</span>
                            <span class="status-value">{{ selectedFormula.name }}</span>
                        </span>
                        <span v-if="selectedFutures" class="status-item">
                            <span class="status-label">Instrument:</span>
                            <span class="status-value">{{ selectedFutures.code }} ({{ selectedFutures.market }})</span>
                        </span>
                    </div>
                </div>

            </div>

            <!-- Query Configuration -->
            <div class="query-config">
                <div class="config-section">
                    <div class="section-header">
                        <h4 class="section-title">Formula Configuration</h4>
                        <div class="formula-actions">
                            <button
                                v-if="selectedFormula"
                                class="register-button"
                                @click="registerFormula"
                                :disabled="!selectedFormula || isRegistering"
                            >
                                {{ isRegistering ? "Registering..." : "Register Formula" }}
                            </button>
                            <button
                                v-if="selectedFormula"
                                class="execute-button"
                                @click="executeFormula"
                                :disabled="!canExecuteFormula || isExecuting"
                            >
                                {{ isExecuting ? "Executing..." : "Execute Formula" }}
                            </button>
                        </div>
                    </div>

                    <div v-if="selectedFormula" class="formula-details">
                        <div class="formula-info">
                            <div class="info-item">
                                <span class="info-label">Type:</span>
                                <span class="info-value">{{ selectedFormula.type }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Description:</span>
                                <span class="info-value">{{ selectedFormula.description }}</span>
                            </div>
                            <div v-if="registrationResult" class="info-item">
                                <span class="info-label">UUID:</span>
                                <span class="info-value registration-success">{{ registrationResult.uuid }}</span>
                            </div>
                            <div v-if="registrationError" class="info-item">
                                <span class="info-label">Error:</span>
                                <span class="info-value registration-error">{{ registrationError }}</span>
                            </div>
                            <div v-if="subscriptionError" class="info-item">
                                <span class="info-label">Subscription Error:</span>
                                <span class="info-value registration-error">{{ subscriptionError }}</span>
                            </div>
                        </div>

                        <div class="formula-code">
                            <label class="form-label">Formula Code</label>
                            <textarea
                                v-model="formulaCode"
                                class="form-textarea"
                                rows="4"
                                placeholder="Enter formula code..."
                            ></textarea>
                        </div>
                    </div>

                    <div v-else class="empty-state">
                        <div class="empty-text">Select a formula to configure</div>
                    </div>
                </div>

                <div class="config-section">
                    <h4 class="section-title">Time Configuration</h4>
                    <div class="time-config-grid">
                        <div class="time-field">
                            <label class="form-label">From Time</label>
                            <input
                                v-model="queryParams.fromTime"
                                type="datetime-local"
                                class="form-input datetime-input"
                            />
                        </div>
                        <div class="time-field">
                            <label class="form-label">To Time</label>
                            <input
                                v-model="queryParams.toTime"
                                type="datetime-local"
                                class="form-input datetime-input"
                            />
                        </div>
                    </div>

                    <div class="time-config-row">
                        <div class="time-field">
                            <label class="form-label">Granularity</label>
                            <select v-model="queryParams.granularity" class="form-select">
                                <option value="60">1min (60s)</option>
                                <option value="300">5min (300s)</option>
                                <option value="900">15min (900s)</option>
                                <option value="1800">30min (1800s)</option>
                                <option value="3600">1h (3600s)</option>
                                <option value="86400">1day (86400s)</option>
                            </select>
                        </div>
                        <div class="time-field">
                            <div class="subscription-option">
                                <label class="checkbox-label">
                                    <input
                                        type="checkbox"
                                        v-model="enableSubscription"
                                        :disabled="!canSubscribe"
                                        class="checkbox-input"
                                    />
                                    <span class="checkbox-text">Enable Real-time Subscription</span>
                                </label>
                                <div
                                    v-if="!canSubscribe && selectedFormula && !selectedFormula.uuid"
                                    class="subscription-warning"
                                >
                                    ⚠️ Formula must be registered first
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Results Display -->
            <div class="results-section">
                <div v-if="formulaData.length > 0" class="results-container">
                    <div class="results-header">
                        <h4 class="results-title">
                            Results ({{ formulaData.length }})
                            <span v-if="enableSubscription && isSubscribed" class="subscription-indicator">
                                🔴
                            </span>
                        </h4>
                        <div class="results-actions">
                            <div class="view-mode-toggle">
                                <button :class="['mode-button', { active: viewMode === 'table' }]" @click="viewMode = 'table'">
                                    📊
                                </button>
                                <button :class="['mode-button', { active: viewMode === 'chart' }]" @click="viewMode = 'chart'">
                                    📈
                                </button>
                            </div>
                            <button
                                v-if="enableSubscription && isSubscribed"
                                class="unsubscribe-button"
                                @click="unsubscribe"
                            >
                                ⏹️
                            </button>
                        </div>
                    </div>

                    <!-- Table View -->
                    <div v-if="viewMode === 'table'" class="table-view">
                        <div class="data-grid">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th class="data-header">
                                            Timestamp
                                            <span class="sort-indicator">↓</span>
                                        </th>
                                        <th class="data-header">Row ID</th>
                                        <th v-for="field in resultFields" :key="field" class="data-header">
                                            {{ field }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(record, index) in paginatedData" :key="index" class="data-row">
                                        <td class="data-cell">{{ new Date(record.timestamp).toLocaleString() }}</td>
                                        <td class="data-cell">{{ record.row_id }}</td>
                                        <td v-for="field in resultFields" :key="field" class="data-cell">
                                            {{ renderFieldValue(record[field]) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div v-if="totalPages > 1" class="pagination">
                            <button
                                @click="currentPage = Math.max(1, currentPage - 1)"
                                :disabled="currentPage === 1"
                                class="pagination-button"
                            >
                                Previous
                            </button>
                            <span class="pagination-info">
                                Page {{ currentPage }} of {{ totalPages }} ({{ formulaData.length }} total records)
                            </span>
                            <button
                                @click="currentPage = Math.min(totalPages, currentPage + 1)"
                                :disabled="currentPage === totalPages"
                                class="pagination-button"
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    <!-- Chart View -->
                    <div v-else-if="viewMode === 'chart'" class="chart-view">
                        <div v-if="formulaData.length === 0" class="chart-placeholder">
                            <div class="chart-icon">📈</div>
                            <div class="chart-text">No Data to Display</div>
                            <div class="chart-subtitle">Execute a formula to see the chart</div>
                        </div>
                        <div v-else class="chart-container">
                            <div class="chart-header">
                                <h3>Formula Results Chart</h3>
                                <div class="chart-legend">
                                    <div v-for="(config, key) in displayConfiguration" :key="key" class="legend-item">
                                        <div
                                            class="legend-color"
                                            :style="{ backgroundColor: config.display?.color || '#000000' }"
                                        ></div>
                                        <span class="legend-label">{{ key }}</span>
                                        <span class="legend-style">({{ config.line_style }})</span>
                                    </div>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas
                                    ref="chartCanvas"
                                    class="formula-chart"
                                    @mousemove="handleChartMouseMove"
                                    @mouseleave="handleChartMouseLeave"
                                ></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else-if="executionError" class="error-results">
                    <div class="error-icon">❌</div>
                    <div class="error-text">Formula execution failed</div>
                    <div class="error-subtitle">{{ executionError }}</div>
                </div>

                <div v-else-if="hasExecuted" class="empty-results">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">No results found for the given formula parameters.</div>
                    <div class="empty-subtitle">Try adjusting your search criteria.</div>
                </div>

                <div v-else class="empty-results">
                    <div class="empty-icon">🧮</div>
                    <div class="empty-text">Select formula and instrument, then configure parameters</div>
                    <div class="empty-subtitle">Choose formula, set time range, and execute to see results</div>
                </div>
            </div>
        </div>

        <!-- Right Panel: Futures List -->
        <div class="right-panel" :class="{ collapsed: rightPanelCollapsed }">
            <div class="panel-header">
                <div class="panel-title">
                    <span class="panel-icon">📈</span>
                    <span class="panel-text">Futures</span>
                </div>
                <button class="collapse-button" @click="toggleRightPanel">
                    {{ rightPanelCollapsed ? "◀" : "▶" }}
                </button>
            </div>

            <div v-if="!rightPanelCollapsed" class="panel-content">
                <div class="futures-search">
                    <input
                        v-model="futuresSearchQuery"
                        type="text"
                        placeholder="Search futures..."
                        class="search-input"
                        @input="searchFutures"
                    />
                </div>

                <div class="futures-list">
                    <div v-if="loadingFutures" class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Loading futures...</div>
                    </div>

                    <div v-else-if="allFutures.length > 0" class="futures-grid">
                        <div
                            v-for="future in allFutures"
                            :key="`${future.market}-${future.code}`"
                            :class="[
                                'future-item',
                                {
                                    selected:
                                        selectedFutures &&
                                        selectedFutures.code === future.code &&
                                        selectedFutures.market === future.market,
                                },
                            ]"
                            @click="selectFutures(future)"
                        >
                            <div class="future-header">
                                <div class="future-code">{{ future.code }}</div>
                                <div class="future-market">{{ future.market }}</div>
                            </div>
                            <div class="future-name">{{ future.name }}</div>
                        </div>
                    </div>

                    <div v-else class="empty-state">
                        <div class="empty-text">No futures found</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useWebSocketStore } from "../stores/websocketStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { websocketTaskService } from "../services/websocketTaskService";
import { formulaSubscriptionService, type FormulaSubscriptionConfig } from "../services/formulaSubscriptionService";
import type { QueryParams } from "@/types";
import { seedService } from "@/services/seedService";
import { FormulaChartAxisUtil } from "@/utils/FormulaChartAxisUtil";

const wsStore = useWebSocketStore();
const subscriptionStore = useSubscriptionStore();

// Panel State
const leftPanelCollapsed = ref<boolean>(false);
const rightPanelCollapsed = ref<boolean>(false);
const viewMode = ref<"table" | "chart">("table");

// Formula State
const formulaSearchQuery = ref<string>("");
const allFormulas = ref<any[]>([]);
const selectedFormula = ref<any>(null);
const loadingFormulas = ref<boolean>(false);
const formulaCode = ref<string>("");

// Futures State
const futuresSearchQuery = ref<string>("");
const allFutures = ref<any[]>([]);
const selectedFutures = ref<any>(null);
const loadingFutures = ref<boolean>(false);

// Query State
const queryParams = ref<QueryParams>({
    market: "",
    code: "",
    namespace: "",
    metaName: "",
    granularity: "86400",
    fromTime: "",
    toTime: "",
    fieldCount: 10,
    revision: "0xFFFFFFFF",
});

const formulaData = ref<any[]>([]);
const currentPage = ref<number>(1);
const pageSize = ref<number>(100);
const resultFields = ref<string[]>([]);
const isExecuting = ref<boolean>(false);
const hasExecuted = ref<boolean>(false);
const executionError = ref<string | null>(null);
const isRegistering = ref<boolean>(false);
const registrationResult = ref<any>(null);
const registrationError = ref<string | null>(null);

// Subscription State
const enableSubscription = ref<boolean>(false);
const isSubscribed = ref<boolean>(false);
const subscriberId = ref<string | null>(null);
const subscriptionError = ref<string | null>(null);

// Formula Result State
const displayConfiguration = ref<any>({});
const formulaMetadata = ref<any>({});
const chartCanvas = ref<HTMLCanvasElement | null>(null);

// Chart Interaction State
const hoveredPoint = ref<{ x: number; y: number; data: any; index: number } | null>(null);
const mousePosition = ref<{ x: number; y: number }>({ x: 0, y: 0 });
const showTooltip = ref<boolean>(false);
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 50; // 50ms 节流，约20fps更新频率

// Computed
const canExecuteFormula = computed(() => {
    return (
        selectedFormula.value &&
        selectedFutures.value &&
        queryParams.value.fromTime &&
        queryParams.value.toTime &&
        formulaCode.value.trim()
    );
});

const canSubscribe = computed(() => {
    return canExecuteFormula.value && selectedFormula.value?.uuid && !isSubscribed.value;
});

const paginatedData = computed(() => {
    // 按时间倒序排列（最新的数据在前）
    const sortedData = [...formulaData.value].sort((a, b) => {
        const timeA = a.time_tag || a.timestamp;
        const timeB = b.time_tag || b.timestamp;

        // 转换为数字时间戳进行比较
        const timestampA = typeof timeA === "string" ? parseInt(timeA) : timeA;
        const timestampB = typeof timeB === "string" ? parseInt(timeB) : timeB;

        return timestampB - timestampA; // 倒序：新的在前
    });

    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return sortedData.slice(start, end);
});

const totalPages = computed(() => {
    return Math.ceil(formulaData.value.length / pageSize.value);
});

// Methods
const toggleLeftPanel = () => {
    leftPanelCollapsed.value = !leftPanelCollapsed.value;
};

const toggleRightPanel = () => {
    rightPanelCollapsed.value = !rightPanelCollapsed.value;
};

const loadFormulas = async (searchPattern?: string) => {
    loadingFormulas.value = true;
    try {
        // Mock formula data - replace with actual API call
        const mockFormulas = [
            {
                id: -222,
                name: "builtin-macd",
                type: "Technical Indicator",
                language_id: 5,
                source_code: `variable: SHORT=0;
variable: LONG=0;
variable: M=0;
SHORT := 12;
LONG := 26;
M:=9;
DIFF: EMA(CLOSE,SHORT) - EMA(CLOSE,LONG);
DEA  : EMA(DIFF,M);
 MACD : 2*(DIFF-DEA);
l: stickline(macd>0, 0, macd, 0, 0), colorff9c00;
k: stickline(macd<=0, 0, macd, 0, 0), color2588ee;
_macd: ema( macd, 1), colorff9c00, linethick1;
_dea: ema(dea, 1), colorff0000, linethick1;
_diff: ema(diff, 1), color0000ff, linethick1;
`,
                description: "Calculate moving average over specified period",
            },
            {
                id: -333,
                name: "builtin-ma",
                type: "Technical Indicator",
                language_id: 5,
                source_code: `ema5: ema(close, 5), colorff9c00, linethick1;
ema10: ema(close, 10), color0000ff, linethick1;
ema20: ema(close, 20), colorF23456, linethick1;
ema30: ema(close, 30), color0f0ff0, linethick1;
`,
                description: "Relative Strength Index calculation",
            },
            {
                id: -111,
                name: "builtin-volume",
                type: "Technical Indicator",
                language_id: 5,
                source_code: `s:stickline(open>close, 0, volume, 0, 0), color2dbe60;
d:stickline(open<=close, 0, volume, 0, 0), colordf3737;
volume_ema18 :ema(volume, 18),colorff9c00, linethick1;
 _volume: volume, color666666 , linethick0;
`,
                description: "Price volatility bands calculation",
            },
        ];

        allFormulas.value = mockFormulas.filter(
            formula => !searchPattern || formula.name.toLowerCase().includes(searchPattern.toLowerCase())
        );
    } catch (error) {
        console.error("Error loading formulas:", error);
        allFormulas.value = [];
    } finally {
        loadingFormulas.value = false;
    }
};

const searchFormulas = () => {
    const searchPattern = formulaSearchQuery.value.trim() || undefined;
    loadFormulas(searchPattern);
};

const selectFormula = (formula: any) => {
    selectedFormula.value = formula;
    formulaCode.value =
        formula.source_code || `// ${formula.name} formula\n// ${formula.description}\n\n// Your formula code here...`;

    // Clear previous registration results
    registrationResult.value = null;
    registrationError.value = null;
};

const loadFutures = async (searchPattern?: string) => {
    loadingFutures.value = true;
    try {
        const params = searchPattern ? { pattern: searchPattern } : {};
        const result = await seedService.searchFutures(params);

        if (result.success) {
            allFutures.value = result.data;
        } else {
            console.error("Failed to load futures:", result.message);
            allFutures.value = [];
        }
    } catch (error) {
        console.error("Error loading futures:", error);
        allFutures.value = [];
    } finally {
        loadingFutures.value = false;
    }
};

let searchTimeout: number | null = null;

const searchFutures = () => {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        const searchPattern = futuresSearchQuery.value.trim() || undefined;
        loadFutures(searchPattern);
    }, 300);
};

const selectFutures = (future: any) => {
    selectedFutures.value = future;
    queryParams.value.market = future.market;
    queryParams.value.code = future.code;

    // Auto-set time range based on tradeDay
    if (future.tradeDay) {
        // Convert tradeDay (YYYYMMDD format) to UTC date
        const tradeDayStr = future.tradeDay.toString();
        const year = parseInt(tradeDayStr.substring(0, 4));
        const month = parseInt(tradeDayStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(tradeDayStr.substring(6, 8));

        // Set To Time to tradeDay at 23:59:59 UTC
        const toTime = new Date(year, month, day, 23, 59, 59);
        queryParams.value.toTime = toTime.toISOString().slice(0, 16); // Format for datetime-local input

        // Set From Time to tradeDay - 1 day at 00:00:00 UTC
        const fromTime = new Date(year, month, day - 1, 0, 0, 0);
        queryParams.value.fromTime = fromTime.toISOString().slice(0, 16); // Format for datetime-local input

        console.log(`📅 Auto-set time range for ${future.code}:`, {
            tradeDay: future.tradeDay,
            fromTime: queryParams.value.fromTime,
            toTime: queryParams.value.toTime,
        });
    } else {
        console.log(`⚠️ No tradeDay found for ${future.code}, time range not auto-set`);
    }
};

const registerFormula = async () => {
    if (!selectedFormula.value || isRegistering.value) return;

    isRegistering.value = true;
    registrationError.value = null;
    registrationResult.value = null;

    const params = {
        formulaId: selectedFormula.value.id,
        sourceCode: formulaCode.value,
        languageId: selectedFormula.value.language_id || 5,
    };

    console.log("Registering formula:", params);

    try {
        // 使用 task service 发送注册请求
        const response = await websocketTaskService.sendTask(
            {
                type: "register_formula",
                ...params,
            },
            {
                timeout: 15000, // 15 秒超时
                retries: 1,
                retryDelay: 2000,
            }
        );

        if (response.success && response.data) {
            registrationResult.value = response.data;
            // 更新公式的UUID为注册后返回的UUID
            selectedFormula.value.uuid = response.data.uuid;
            registrationError.value = null;
            console.log("✅ Formula registration successful:", {
                uuid: response.data.uuid,
                formulaId: response.data.formulaId,
            });
        } else {
            registrationError.value = response.error || "Formula registration failed";
            registrationResult.value = null;
            console.error("❌ Formula registration failed:", response.error);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Registration timeout";
        registrationError.value = errorMessage;
        registrationResult.value = null;
        console.error("❌ Formula registration error:", errorMessage);
    } finally {
        isRegistering.value = false;
    }
};

const executeFormula = async () => {
    if (!canExecuteFormula.value || isExecuting.value) return;

    isExecuting.value = true;
    hasExecuted.value = true;
    currentPage.value = 1;
    executionError.value = null;

    // Convert datetime-local to UTC milliseconds timestamp for formula execution
    const fromTimestamp = new Date(queryParams.value.fromTime || "").getTime();
    const toTimestamp = new Date(queryParams.value.toTime || "").getTime();

    console.log("🧮 Starting formula execution process...");

    try {
        // Step 1: Register the formula first to get UUID
        console.log("📝 Step 1: Registering formula...");
        const registerParams = {
            formulaId: selectedFormula.value?.id,
            sourceCode: formulaCode.value,
            languageId: selectedFormula.value?.language_id || 5,
        };

        const registerResponse = await websocketTaskService.sendTask(
            {
                type: "register_formula",
                ...registerParams,
            },
            {
                timeout: 15000, // 15 秒超时
                retries: 1,
                retryDelay: 2000,
            }
        );

        if (!registerResponse.success || !registerResponse.data) {
            throw new Error(`Formula registration failed: ${registerResponse.error || "Unknown error"}`);
        }

        const formulaUuid = registerResponse.data.uuid;
        // 更新公式的UUID为注册后返回的UUID
        selectedFormula.value.uuid = formulaUuid;
        console.log("✅ Formula registration successful:", {
            uuid: formulaUuid,
            formulaId: registerResponse.data.formulaId,
        });

        // Step 2: Calculate the formula using the registered UUID
        console.log("🧮 Step 2: Calculating formula...");
        const calculateParams = {
            uuid: formulaUuid,
            market: queryParams.value.market,
            code: queryParams.value.code,
            fromTime: fromTimestamp,
            toTime: toTimestamp,
            granularity: parseInt(queryParams.value.granularity || "86400"),
            isRealTime: enableSubscription.value,
        };

        const calculateResponse = await websocketTaskService.sendTask(
            {
                type: "calculate_formula",
                ...calculateParams,
            },
            {
                timeout: 30000, // 30 秒超时
                retries: 1,
                retryDelay: 3000,
            }
        );

        if (!calculateResponse.success || !calculateResponse.data) {
            throw new Error(`Formula calculation failed: ${calculateResponse.error || "Unknown error"}`);
        }

        const responseData = calculateResponse.data;
        console.log("📊 Processing formula calculation response:", responseData);

        // Process the unified data structure from backend
        // The actual data is nested: responseData.data.data
        const actualData = responseData.data?.data;
        if (!actualData || !Array.isArray(actualData)) {
            throw new Error("Invalid response data structure: missing data array");
        }

        const processedData = actualData.map((record: any, index: number) => {
            const flatRecord = {
                ...record,
                row_id: index + 1,
                timestamp: record.time_tag
                    ? new Date(parseInt(record.time_tag)).toISOString()
                    : new Date().toISOString(),
                // Preserve original time_tag for chart rendering
                time_tag: record.time_tag || record.timestamp,
            };

            // Remove the header prefix from field names for display
            const cleanRecord = { ...flatRecord };
            Object.keys(cleanRecord).forEach(key => {
                if (key.startsWith("__wolverine_header_")) {
                    const cleanKey = key.replace("__wolverine_header_", "");
                    if (cleanKey !== "time_tag") {
                        cleanRecord[cleanKey] = cleanRecord[key];
                    }
                    delete cleanRecord[key];
                }
            });

            return cleanRecord;
        });

        // Store display configuration for chart rendering
        if (responseData.data?.displayConfiguration) {
            displayConfiguration.value = responseData.data.displayConfiguration;
            console.log("📈 Display configuration loaded:", responseData.data.displayConfiguration);
        }

        // Store metadata
        if (responseData.data?.metadata) {
            formulaMetadata.value = responseData.data.metadata;
            console.log("📋 Metadata loaded:", responseData.data.metadata);
        }

        formulaData.value = processedData;
        resultFields.value =
            processedData.length > 0
                ? Object.keys(processedData[0]).filter(
                      key => key !== "timestamp" && key !== "row_id" && key !== "time_tag"
                  )
                : [];
        currentPage.value = 1;

        console.log("✅ Formula execution successful:", {
            recordCount: processedData.length,
            fieldCount: resultFields.value.length,
            formulaUuid: formulaUuid,
        });

        // If subscription is enabled, start real-time subscription
        if (enableSubscription.value) {
            console.log("📡 Starting real-time subscription...");
            await subscribeToRealTimeData();
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Execution timeout";
        console.error("❌ Formula execution error:", errorMessage);
        formulaData.value = [];
        executionError.value = errorMessage;
    } finally {
        isExecuting.value = false;
    }
};

const subscribeToRealTimeData = async () => {
    if (!selectedFutures.value || !selectedFormula.value) {
        console.warn("⚠️ Cannot subscribe: missing futures or formula selection");
        return;
    }

    // 检查公式是否有UUID
    if (!selectedFormula.value.uuid) {
        subscriptionError.value = "Formula must be registered first. Please register the formula before subscribing.";
        console.error("❌ Cannot subscribe: formula has no UUID");
        return;
    }

    try {
        subscriptionError.value = null;

        const config: FormulaSubscriptionConfig = {
            formulaId: selectedFormula.value.id,
            formulaName: selectedFormula.value.name,
            formulaCode: formulaCode.value,
            market: selectedFutures.value.market,
            code: selectedFutures.value.code,
            granularity: 0, // 实时订阅固定使用0
            // namespace: "global", // 后端不支持namespace参数，移除
            languageId: selectedFormula.value.language_id || 5,
            registeredUuid: selectedFormula.value.uuid, // 使用公式的UUID
        };

        const dataCallback = (result: any) => {
            if (result.uuid) {
                subscriberId.value = result.uuid;
                isSubscribed.value = true;
                console.log(`📡 Formula subscription created: ${result.uuid}`);
            } else if (result.data) {
                // 处理推送数据
                handleFormulaPushData(result.data);
            }
        };

        const subscriptionId = await formulaSubscriptionService.subscribe(config, dataCallback);

        subscriberId.value = subscriptionId;
        isSubscribed.value = true;

        console.log(`📡 Formula subscription created: ${subscriptionId}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Subscription failed";
        subscriptionError.value = errorMessage;
        console.error("❌ Formula subscription failed:", errorMessage);
    }
};

const handleFormulaPushData = (data: any) => {
    console.log("📡 Formula push data received:", data);

    // 解析推送数据，支持多种数据格式
    let recordsToProcess: any[] = [];

    if (Array.isArray(data)) {
        recordsToProcess = data;
    } else if (data.rawData?.data && Array.isArray(data.rawData.data)) {
        // 处理包含 rawData 嵌套结构的数据
        recordsToProcess = data.rawData.data;

        // 更新 display configuration（如果有）
        if (data.rawData.displayConfiguration) {
            displayConfiguration.value = data.rawData.displayConfiguration;
            console.log("📈 Updated display configuration from push data");
        }
    } else if (data.data && Array.isArray(data.data)) {
        recordsToProcess = data.data;
    }

    if (recordsToProcess.length === 0) {
        console.warn("⚠️ No valid records to process in push data");
        return;
    }

    // 处理实时数据记录
    const newData = recordsToProcess.map((record: any, index: number) => {
        const flatRecord = {
            ...record,
            row_id: index + 1, // 临时ID，后续会重新分配
            timestamp: record.time_tag
                ? new Date(record.time_tag).toISOString()
                : new Date().toISOString(),
            // Preserve original time_tag for chart rendering
            time_tag: record.time_tag || record.__wolverine_header_time_tag || Date.now(),
        };

        // 移除 __wolverine_header_ 前缀的字段
        Object.keys(flatRecord).forEach(key => {
            if (key.startsWith("__wolverine_header_")) {
                const cleanKey = key.replace("__wolverine_header_", "");
                if (cleanKey !== "time_tag") {
                    flatRecord[cleanKey] = flatRecord[key];
                }
                delete flatRecord[key];
            }
        });

        return flatRecord;
    });

    // 归一化时间戳到分钟级别（最小粒度）
    const normalizeToMinute = (timeTag: number) => {
        return Math.floor(timeTag / 60000) * 60000; // 60000ms = 1分钟
    };

    // 合并新数据：如果存在相同分钟的数据，用新数据覆盖
    const updatedData = [...formulaData.value];

    for (const newRecord of newData) {
        const newTimeMinute = normalizeToMinute(newRecord.time_tag);

        // 查找是否存在相同分钟的数据
        const existingIndex = updatedData.findIndex(existing => {
            const existingTimeMinute = normalizeToMinute(existing.time_tag);
            return existingTimeMinute === newTimeMinute;
        });

        if (existingIndex !== -1) {
            // 覆盖旧数据
            updatedData[existingIndex] = { ...newRecord };
            console.log(`🔄 Updated existing record at minute ${new Date(newTimeMinute).toISOString()}`);
        } else {
            // 添加新数据到开头
            updatedData.unshift(newRecord);
            console.log(`➕ Added new record at minute ${new Date(newTimeMinute).toISOString()}`);
        }
    }

    formulaData.value = updatedData;

    // 重新分配 row_id（确保连续性）
    formulaData.value = formulaData.value.map((item, index) => ({
        ...item,
        row_id: index + 1
    }));

    console.log(`✅ Processed ${newData.length} records, total data count: ${formulaData.value.length}`);

    // 跳转到第一页以显示最新数据
    if (viewMode.value === "table") {
        currentPage.value = 1;
    }

    // Update result fields if new fields are introduced
    if (newData.length > 0) {
        const newFields = Object.keys(newData[0]).filter(
            key => key !== "timestamp" && key !== "row_id" && key !== "time_tag"
        );
        resultFields.value = [...new Set([...resultFields.value, ...newFields])];
    }
};

const unsubscribe = async () => {
    console.log("🔍 Unsubscribe clicked, current state:", {
        subscriberId: subscriberId.value,
        isSubscribed: isSubscribed.value,
        enableSubscription: enableSubscription.value
    });

    if (!subscriberId.value) {
        console.warn("⚠️ No active subscription to cancel");
        return;
    }

    try {
        subscriptionError.value = null;

        const currentSubscriptionId = subscriberId.value;
        console.log("📞 Calling formulaSubscriptionService.unsubscribe with ID:", currentSubscriptionId);
        const success = await formulaSubscriptionService.unsubscribe(currentSubscriptionId);

        if (success) {
            isSubscribed.value = false;
            subscriberId.value = null;
            enableSubscription.value = false;
            console.log(`⏹️ Formula subscription cancelled: ${currentSubscriptionId}`);
        } else {
            throw new Error("Failed to cancel subscription");
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unsubscription failed";
        subscriptionError.value = errorMessage;
        console.error("❌ Formula unsubscription failed:", errorMessage);

        // Reset state even if unsubscription failed to avoid UI inconsistency
        isSubscribed.value = false;
        subscriberId.value = null;
        enableSubscription.value = false;
    }
};

const renderFieldValue = (value: any): string => {
    if (value === null || value === undefined) {
        return "null";
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "[]";
        }

        const preview = value
            .slice(0, 3)
            .map(item => (typeof item === "number" ? item.toFixed(3) : String(item)))
            .join(", ");

        const suffix = value.length > 3 ? `, ...${value.length - 3} more` : "";
        return `[${preview}${suffix}]`;
    }

    if (typeof value === "object") {
        return "{...}";
    }

    if (typeof value === "number") {
        return value.toFixed(4);
    }

    if (typeof value === "string" && value.length > 50) {
        return value.substring(0, 50) + "...";
    }

    return String(value);
};


// Tooltip drawing function
const drawTooltip = (
    ctx: CanvasRenderingContext2D,
    point: { x: number; y: number; data: any; index: number },
    margin: any,
    chartWidth: number,
    chartHeight: number
) => {
    const { x, y, data, index } = point;

    // Tooltip dimensions
    const padding = 8;
    const lineHeight = 16;
    const maxWidth = 200;

    // Prepare tooltip content - 确保使用正确的数字时间戳
    const timestamp = data.time_tag || data.timestamp;
    const numericTimestamp = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
    const date = new Date(numericTimestamp);
    const timeStr = date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

    const lines = [`时间: ${timeStr}`, `索引: ${index + 1}`];

    // Add formula values
    Object.keys(displayConfiguration.value).forEach(key => {
        const value = data[key];
        if (value !== null && value !== undefined) {
            const formattedValue = typeof value === "number" ? value.toFixed(4) : String(value);
            lines.push(`${key}: ${formattedValue}`);
        }
    });

    // Calculate tooltip dimensions
    ctx.font = "12px Arial";
    const textWidths = lines.map(line => ctx.measureText(line).width);
    const tooltipWidth = Math.min(maxWidth, Math.max(...textWidths) + padding * 2);
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Position tooltip (avoid going off screen)
    let tooltipX = x + 10;
    let tooltipY = y - tooltipHeight / 2;

    if (tooltipX + tooltipWidth > margin.left + chartWidth) {
        tooltipX = x - tooltipWidth - 10;
    }
    if (tooltipY < margin.top) {
        tooltipY = margin.top + 10;
    }
    if (tooltipY + tooltipHeight > margin.top + chartHeight) {
        tooltipY = margin.top + chartHeight - tooltipHeight - 10;
    }

    // Draw tooltip background - 使用浅色背景
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Draw tooltip border
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Draw tooltip text - 使用深色文字
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";

    lines.forEach((line, i) => {
        const textY = tooltipY + padding + (i + 1) * lineHeight - 2;

        // Color the formula value lines
        if (i >= 2) {
            const key = line.split(":")[0];
            const config = displayConfiguration.value[key];
            if (config?.display?.color) {
                ctx.fillStyle = config.display.color;
            } else {
                ctx.fillStyle = "#333";
            }
        } else {
            ctx.fillStyle = "#333";
        }

        ctx.fillText(line, tooltipX + padding, textY);
    });

    // Draw crosshair - 使用深色线条在浅色背景下更清晰
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + chartHeight);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // Draw point highlight - 使用深色填充在浅色背景下更清晰
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.stroke();
};

// Mouse event handlers for chart interaction
const handleChartMouseMove = (event: MouseEvent) => {
    if (!chartCanvas.value || viewMode.value !== "chart" || formulaData.value.length === 0) {
        showTooltip.value = false;
        return;
    }

    const canvas = chartCanvas.value;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mousePosition.value = { x, y };

    // 使用节流机制减少更新频率
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_THROTTLE) {
        return;
    }
    lastUpdateTime = now;

    // Chart dimensions
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = rect.width - margin.left - margin.right;
    const chartHeight = rect.height - margin.top - margin.bottom;

    // Check if mouse is within chart area
    if (x < margin.left || x > margin.left + chartWidth || y < margin.top || y > margin.top + chartHeight) {
        showTooltip.value = false;
        return;
    }

    // Find closest data point
    const data = formulaData.value;
    const xScale = (index: number) => margin.left + (index / (data.length - 1)) * chartWidth;

    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < data.length; i++) {
        const pointX = xScale(i);
        const distance = Math.abs(x - pointX);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    // Only show tooltip if close enough to a point
    if (minDistance < 20) {
        const pointX = xScale(closestIndex);
        const pointData = data[closestIndex];

        // Calculate Y position based on the first formula value
        const firstKey = Object.keys(displayConfiguration.value)[0];
        if (firstKey && pointData[firstKey] !== null && pointData[firstKey] !== undefined) {
            // Find min/max values for scaling
            let minValue = Infinity;
            let maxValue = -Infinity;

            Object.keys(displayConfiguration.value).forEach(key => {
                data.forEach(d => {
                    const value = parseFloat(d[key]) || 0;
                    minValue = Math.min(minValue, value);
                    maxValue = Math.max(maxValue, value);
                });
            });

            const range = maxValue - minValue;
            minValue -= range * 0.1;
            maxValue += range * 0.1;

            const yScale = (value: number) => margin.top + ((value - minValue) / (maxValue - minValue)) * chartHeight;
            const pointY = yScale(parseFloat(pointData[firstKey]) || 0);

            // 只有当数据点真正改变时才更新
            const newHoveredPoint = {
                x: pointX,
                y: pointY,
                data: pointData,
                index: closestIndex,
            };

            // 检查是否需要更新
            const needsUpdate =
                !hoveredPoint.value ||
                hoveredPoint.value.index !== closestIndex ||
                Math.abs(hoveredPoint.value.x - pointX) > 1 ||
                Math.abs(hoveredPoint.value.y - pointY) > 1;

            if (needsUpdate) {
                hoveredPoint.value = newHoveredPoint;
                showTooltip.value = true;

                // 直接更新，因为已经使用了节流机制
                nextTick(() => {
                    renderChart();
                });
            }
        }
    } else {
        if (showTooltip.value) {
            showTooltip.value = false;
            nextTick(() => {
                renderChart();
            });
        }
    }
};

const handleChartMouseLeave = () => {
    showTooltip.value = false;
    hoveredPoint.value = null;

    if (viewMode.value === "chart") {
        nextTick(() => {
            renderChart();
        });
    }
};

// Smart timestamp formatting using the axis utility
const formatTimestamp = (
    timestamp: string | number,
    granularity: number,
    dataLength: number,
    index: number
): string => {
    const previousRecord = index > 0 ? formulaData.value[index - 1] : undefined;
    const previousTimestamp = previousRecord ? previousRecord.time_tag || previousRecord.timestamp : undefined;

    // 确保时间戳是数字格式
    const numericTimestamp = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;

    return FormulaChartAxisUtil.formatTimestamp(numericTimestamp, {
        granularity,
        dataLength,
        index,
        previousTimestamp: previousTimestamp
            ? typeof previousTimestamp === "string"
                ? parseInt(previousTimestamp)
                : previousTimestamp
            : undefined,
        timezone: -(new Date().getTimezoneOffset() / 60), // Local timezone offset
        locale: "zh-CN",
    });
};

// 现在使用 callback 机制，不再需要监听 WebSocket 消息
// 只保留实时数据的监听，因为实时数据是广播消息，不是请求-响应模式
watch(
    () => wsStore.lastMessage,
    newMessage => {
        if (!newMessage) return;

        if (newMessage.type === "real_time_data") {
            console.log("📡 Real-time formula data received:", newMessage);

            if (newMessage.data && Array.isArray(newMessage.data)) {
                // Append new real-time data to existing data
                const newData = newMessage.data.map((record: any, index: number) => {
                    const flatRecord = {
                        ...record,
                        row_id: formulaData.value.length + index + 1,
                        timestamp: record.timestamp
                            ? new Date(parseInt(record.timestamp)).toISOString()
                            : new Date().toISOString(),
                        // Preserve original time_tag for chart rendering
                        time_tag: record.timestamp || record.time_tag,
                    };

                    if (record.fields && typeof record.fields === "object") {
                        Object.assign(flatRecord, record.fields);
                    }

                    return flatRecord;
                });

                formulaData.value = [...formulaData.value, ...newData];

                // 跳转到第一页以显示最新数据
                if (viewMode.value === "table") {
                    currentPage.value = 1;
                }

                // Update result fields if new fields are introduced
                if (newData.length > 0) {
                    const newFields = Object.keys(newData[0]).filter(
                        key => key !== "timestamp" && key !== "row_id" && key !== "time_tag"
                    );
                    resultFields.value = [...new Set([...resultFields.value, ...newFields])];
                }
            }
        }
    },
    { immediate: true }
);

// Chart rendering function
const renderChart = () => {
    if (!chartCanvas.value || formulaData.value.length === 0) return;

    const canvas = chartCanvas.value;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get the actual container dimensions
    const container = canvas.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Set canvas size with high DPI support
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Chart dimensions
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Get data
    const data = formulaData.value;

    // Find min/max values for scaling
    let minValue = Infinity;
    let maxValue = -Infinity;

    Object.keys(displayConfiguration.value).forEach(key => {
        data.forEach(d => {
            const value = parseFloat(d[key]) || 0;
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
        });
    });

    // Add some padding
    const range = maxValue - minValue;
    minValue -= range * 0.1;
    maxValue += range * 0.1;

    // Scale functions
    const xScale = (index: number) => margin.left + (index / (data.length - 1)) * chartWidth;
    const yScale = (value: number) => margin.top + ((value - minValue) / (maxValue - minValue)) * chartHeight;

    // Draw axes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + chartHeight - (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + chartWidth, y);
        ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i < data.length; i += Math.max(1, Math.floor(data.length / 10))) {
        const x = xScale(i);
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + chartHeight);
        ctx.stroke();
    }

    // Draw data lines
    Object.keys(displayConfiguration.value).forEach(key => {
        const config = displayConfiguration.value[key];
        const color = config.display?.color || "#000000";
        const lineWidth = config.display?.width || 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        let firstPoint = true;
        data.forEach((d, index) => {
            const value = parseFloat(d[key]) || 0;
            const x = xScale(index);
            const y = yScale(value);

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    });

    // Draw Y-axis labels
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";

    for (let i = 0; i <= 5; i++) {
        const value = minValue + (i / 5) * (maxValue - minValue);
        const y = margin.top + chartHeight - (i / 5) * chartHeight;
        ctx.fillText(value.toFixed(2), margin.left - 10, y + 4);
    }

    // Draw X-axis labels with smart formatting using the axis utility
    ctx.textAlign = "center";
    const granularity = parseInt(queryParams.value.granularity || "86400");

    // Generate tick configuration using the axis utility
    const tickConfig = FormulaChartAxisUtil.generateTickConfiguration(data, granularity, {
        timezone: -(new Date().getTimezoneOffset() / 60),
        maxTicks: 8,
        chartWidth,
    });

    // Draw tick labels
    tickConfig.tickValues.forEach(tickIndex => {
        const x = xScale(tickIndex);
        // 优先使用 time_tag（数字时间戳），如果没有则使用 timestamp
        const timestamp = data[tickIndex].time_tag || data[tickIndex].timestamp;
        const formatter = tickConfig.tickFormatters[tickIndex];
        const label = formatter
            ? formatter(timestamp)
            : formatTimestamp(timestamp, granularity, data.length, tickIndex);

        ctx.fillText(label, x, margin.top + chartHeight + 20);
    });

    // Draw tooltip if hovering over a point
    if (showTooltip.value && hoveredPoint.value) {
        drawTooltip(ctx, hoveredPoint.value, margin, chartWidth, chartHeight);
    }
};

// Watch for data changes to re-render chart
watch(
    [formulaData, displayConfiguration],
    () => {
        if (viewMode.value === "chart") {
            nextTick(() => {
                renderChart();
            });
        }
    },
    { deep: true }
);

// Watch for view mode changes
watch(viewMode, newMode => {
    if (newMode === "chart") {
        nextTick(() => {
            renderChart();
        });
    }
});

// Handle window resize for chart
const handleResize = () => {
    if (viewMode.value === "chart") {
        nextTick(() => {
            renderChart();
        });
    }
};

// Watch for subscription checkbox changes
watch(enableSubscription, async (newValue, oldValue) => {
    if (newValue && !oldValue) {
        // Checkbox was checked - subscribe if we can subscribe
        if (canSubscribe.value) {
            await subscribeToRealTimeData();
        } else {
            // Reset checkbox if cannot subscribe
            enableSubscription.value = false;
            if (selectedFormula.value && !selectedFormula.value.uuid) {
                subscriptionError.value =
                    "Formula must be registered first. Please register the formula before subscribing.";
            }
        }
    } else if (!newValue && oldValue) {
        // Checkbox was unchecked - unsubscribe
        if (isSubscribed.value && subscriberId.value) {
            await unsubscribe();
        }
    }
});

// Watch for real-time data from subscription store
watch(
    () => subscriptionStore.realTimeData,
    newData => {
        if (subscriberId.value && newData.has(subscriberId.value)) {
            const subscriptionData = newData.get(subscriberId.value) || [];

            // Convert subscription data to formula data format
            const newFormulaData = subscriptionData.map((record, index) => ({
                ...record.fields,
                row_id: formulaData.value.length + index + 1,
                timestamp: record.timestamp,
                time_tag: record.timestamp,
            }));

            // Append to existing formula data
            formulaData.value = [...formulaData.value, ...newFormulaData];

            // 跳转到第一页以显示最新数据
            if (viewMode.value === "table") {
                currentPage.value = 1;
            }

            // Update result fields
            if (newFormulaData.length > 0) {
                const newFields = Object.keys(newFormulaData[0]).filter(
                    key => key !== "timestamp" && key !== "row_id" && key !== "time_tag"
                );
                resultFields.value = [...new Set([...resultFields.value, ...newFields])];
            }
        }
    },
    { deep: true }
);

// Lifecycle
onMounted(() => {
    loadFormulas();
    loadFutures();

    // Initialize subscription store
    subscriptionStore.initialize();

    // Initialize websocket task service
    websocketTaskService.initialize(wsStore);

    // Initialize formula subscription service with WebSocket handlers
    const unwatch = formulaSubscriptionService.initializeWebSocketHandlers(wsStore);

    // Store cleanup function
    if (unwatch) {
        // Store for cleanup in onUnmounted
    }

    // Add resize listener for chart
    window.addEventListener("resize", handleResize);
});

onUnmounted(async () => {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Remove resize listener
    window.removeEventListener("resize", handleResize);

    // Clean up all formula subscriptions
    try {
        await formulaSubscriptionService.unsubscribeAllFormulas();
    } catch (error) {
        console.error("Error cleaning up formula subscriptions:", error);
    }
});
</script>

<style scoped>
/* Main Container - Three Column Layout */
.formula-viewer-container {
    display: flex;
    height: 100vh;
    background: #f8f9fa;
    gap: 1px;
}

/* Left Panel - Formula List */
.left-panel {
    width: 320px;
    background: white;
    border-right: 1px solid #dee2e6;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
}

.left-panel.collapsed {
    width: 50px;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
    min-height: 48px;
}

.panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #495057;
    font-size: 14px;
}

.panel-icon {
    font-size: 16px;
}

.panel-text {
    transition: opacity 0.3s ease;
}

.left-panel.collapsed .panel-text {
    opacity: 0;
    width: 0;
    overflow: hidden;
}

.collapse-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: #6c757d;
    font-size: 12px;
    transition: all 0.2s ease;
}

.collapse-button:hover {
    background: #e9ecef;
    color: #495057;
}

.panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.left-panel.collapsed .panel-content {
    display: none;
}

/* Center Panel - Main Content */
.center-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    overflow: scroll;
}

/* Query Header */
.query-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.query-title h3 {
    margin: 0 0 8px 0;
    color: #495057;
    font-size: 18px;
    font-weight: 600;
}

.query-status {
    display: flex;
    gap: 16px;
    font-size: 13px;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.status-label {
    color: #6c757d;
    font-weight: 500;
}

.status-value {
    color: #495057;
    font-weight: 600;
}

.view-mode-toggle {
    display: flex;
    gap: 4px;
    background: white;
    border-radius: 6px;
    padding: 2px;
    border: 1px solid #dee2e6;
}

.mode-button {
    padding: 4px 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    color: #6c757d;
    transition: all 0.2s ease;
    min-width: 28px;
}

.mode-button:hover {
    background: #f8f9fa;
    color: #495057;
}

.mode-button.active {
    background: #0066cc;
    color: white;
}

/* Query Configuration */
.query-config {
    padding: 20px;
    border-bottom: 1px solid #dee2e6;
    background: #fafbfc;
}

.config-section {
    margin-bottom: 24px;
}

.config-section:last-child {
    margin-bottom: 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.section-title {
    margin: 0;
    color: #495057;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Time Configuration */
.time-config-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    align-items: end;
    margin-bottom: 16px;
}

.time-config-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: end;
}

.time-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-label {
    font-size: 12px;
    font-weight: 500;
    color: #495057;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.form-input,
.form-select {
    padding: 10px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    font-size: 14px;
    color: #495057;
    transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
    border-color: #0066cc;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.datetime-input {
    font-family: "SF Mono", "Monaco", monospace;
    font-size: 13px;
}

/* Results Section */
.results-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 400px; /* 确保在Mac笔记本上有足够的显示高度 */
}

.results-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.results-title {
    margin: 0;
    color: #495057;
    font-size: 16px;
    font-weight: 600;
}

.results-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}


/* Table View */
.table-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 300px; /* 确保表格有足够的显示高度 */
}

.data-grid {
    flex: 1;
    overflow: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.data-header {
    background: #f8f9fa;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 2px solid #dee2e6;
    font-weight: 600;
    color: #495057;
    position: sticky;
    top: 0;
    white-space: nowrap;
}

.sort-indicator {
    color: #0066cc;
    font-size: 12px;
    margin-left: 4px;
    font-weight: bold;
}

.data-row:nth-child(even) {
    background: #f9f9f9;
}

.data-row:hover {
    background: #e3f2fd;
}

.data-cell {
    padding: 10px 16px;
    border-bottom: 1px solid #f1f3f4;
    vertical-align: top;
    font-family: "SF Mono", "Monaco", monospace;
    font-size: 11px;
    color: #495057;
}

/* Chart View */
.chart-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fafbfc;
    min-height: 350px; /* 确保图表有足够的显示高度 */
}

.chart-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #6c757d;
    padding: 40px 20px;
}

.chart-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
}

.chart-text {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #495057;
}

.chart-subtitle {
    font-size: 14px;
    color: #6c757d;
}

.chart-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 8px;
    margin: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    min-height: 0; /* Important for flex child to shrink */
}

.chart-header {
    flex-shrink: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #e9ecef;
    background: #f8f9fa;
}

.chart-header h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 16px;
    font-weight: 600;
}

.chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    max-height: 60px;
    overflow-y: auto;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    flex-shrink: 0;
}

.legend-color {
    width: 12px;
    height: 2px;
    border-radius: 1px;
    flex-shrink: 0;
}

.legend-label {
    font-weight: 500;
    color: #333;
    white-space: nowrap;
}

.legend-style {
    color: #666;
    font-size: 10px;
    white-space: nowrap;
}

.chart-content {
    flex: 1;
    position: relative;
    min-height: 0; /* Important for flex child to shrink */
    border: 1px solid #e9ecef;
    border-top: none;
    background: #fafafa;
    overflow: hidden;
}

.formula-chart {
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #f8f9fa;
    border-top: 1px solid #dee2e6;
}

.pagination-button {
    padding: 8px 16px;
    border: 1px solid #dee2e6;
    background: white;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    transition: background-color 0.2s;
}

.pagination-button:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
    opacity: 0.6;
}

.pagination-button:hover:not(:disabled) {
    background: #f8f9fa;
}

.pagination-info {
    font-size: 14px;
    color: #6c757d;
}

/* Right Panel - Futures */
.right-panel {
    width: 260px;
    background: white;
    border-left: 1px solid #dee2e6;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
}

.right-panel.collapsed {
    width: 50px;
}

.right-panel.collapsed .panel-text {
    opacity: 0;
    width: 0;
    overflow: hidden;
}

.right-panel.collapsed .panel-content {
    display: none;
}

/* Futures Search */
.futures-search {
    padding: 12px 16px;
    border-bottom: 1px solid #dee2e6;
}

/* Futures List */
.futures-list {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #6c757d;
}

.loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.loading-text {
    font-size: 14px;
    color: #6c757d;
}

.futures-grid {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.future-item {
    padding: 8px 10px;
    margin-bottom: 4px;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.future-item:hover {
    border-color: #0066cc;
    background: #f8f9fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.future-item.selected {
    border-color: #0066cc;
    background: #e3f2fd;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.future-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.future-code {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
    line-height: 1.2;
    flex: 1;
}

.future-name {
    color: #6c757d;
    font-size: 11px;
    line-height: 1.2;
    opacity: 0.8;
}

.future-market {
    color: #28a745;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.7;
    flex-shrink: 0;
}

/* Empty States */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #6c757d;
    text-align: center;
}

.empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.6;
}

.empty-text {
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 8px;
}

.empty-subtitle {
    font-size: 12px;
    color: #9ca3af;
}

.empty-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: #6c757d;
    text-align: center;
    padding: 40px 20px;
}

.error-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: #dc3545;
    text-align: center;
    padding: 40px 20px;
}

.error-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.8;
}

.error-text {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #dc3545;
}

.error-subtitle {
    font-size: 14px;
    color: #6c757d;
    max-width: 400px;
    line-height: 1.4;
}

/* Additional Formula-specific styles */
.formula-search {
    padding: 12px 16px;
    border-bottom: 1px solid #dee2e6;
}

.search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
    background: white;
}

.search-input:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.formula-list {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.formula-grid {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.formula-item {
    padding: 8px 10px;
    margin-bottom: 4px;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.formula-item:hover {
    border-color: #0066cc;
    background: #f8f9fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.formula-item.selected {
    border-color: #0066cc;
    background: #e3f2fd;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.formula-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.formula-name {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
    line-height: 1.2;
    flex: 1;
}

.formula-type {
    color: #28a745;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.7;
    flex-shrink: 0;
}

.formula-description {
    color: #6c757d;
    font-size: 11px;
    line-height: 1.2;
    opacity: 0.8;
}

.formula-actions {
    display: flex;
    gap: 8px;
}

.register-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
}

.register-button:hover:not(:disabled) {
    background: #0056b3;
}

.register-button:disabled {
    background: #6c757d;
    cursor: not-allowed;
}

.execute-button {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
}

.execute-button:hover:not(:disabled) {
    background: #218838;
}

.execute-button:disabled {
    background: #6c757d;
    cursor: not-allowed;
}

.formula-details {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 16px;
}

.formula-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-label {
    font-size: 12px;
    font-weight: 500;
    color: #6c757d;
    min-width: 80px;
}

.info-value {
    font-size: 13px;
    color: #495057;
}

.registration-success {
    color: #28a745;
    font-weight: 600;
    font-family: "SF Mono", "Monaco", monospace;
    font-size: 12px;
}

.registration-error {
    color: #dc3545;
    font-weight: 500;
}

.formula-code {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-textarea {
    padding: 10px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    font-size: 13px;
    color: #495057;
    font-family: "SF Mono", "Monaco", monospace;
    resize: vertical;
    min-height: 80px;
}

.form-textarea:focus {
    border-color: #0066cc;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.subscription-option {
    display: flex;
    align-items: center;
    gap: 8px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #495057;
}

.checkbox-input {
    margin: 0;
    width: 16px;
    height: 16px;
}

.checkbox-text {
    font-weight: 500;
}

.subscription-warning {
    font-size: 11px;
    color: #dc3545;
    margin-top: 4px;
    font-weight: 500;
}

.subscription-indicator {
    background: #dc3545;
    color: white;
    padding: 1px 4px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    margin-left: 6px;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        opacity: 1;
    }
    50% {
        opacity: 0.7;
    }
    100% {
        opacity: 1;
    }
}

.unsubscribe-button {
    background: #dc3545;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    min-width: 28px;
}

.unsubscribe-button:hover {
    background: #c82333;
}
</style>
