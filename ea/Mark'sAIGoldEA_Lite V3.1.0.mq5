//+------------------------------------------------------------------+
//|                                                 CleanGridEA.mq5   |
//|                                  Simplified Grid Trading System   |
//+------------------------------------------------------------------+
#property copyright "Mark's AI Gold EA - Clean Version"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>
CTrade trade;

//--- License Input (Only visible to user)
input string    LicenseKey      = "";
input bool      TesterMode      = false;
input string    TesterAccountOverride = "";
input bool      UseCachedLicenseInTester = true;
#define CachedLicenseMaxAgeHours  24   // Hidden — cache expiry for tester only (live checks every 30s)

//--- Max Drawdown Protection (fixed dollar amount)
input double    MaxDrawdownAmount = 0;  // Max loss in $ to close all (0 = disabled). e.g. 500 = close all when $500 loss

//--- Per Order Stop Loss (0 = disabled)
input double    BuyStopLossPips  = 120.0;   // Buy SL in pips (0 = no SL)
input double    SellStopLossPips = 110.0;   // Sell SL in pips (0 = no SL)

//--- All Settings Hardcoded (Hidden from user)
#define BuyRangeStart       2001.0
#define BuyRangeEnd         8801.0
#define BuyGapPips          3.0
#define MaxBuyOrders        3
#define BuyTakeProfitPips   25

#define SellRangeStart      8802.0
#define SellRangeEnd        2002.0
#define SellGapPips         3.0
#define MaxSellOrders       3
#define SellTakeProfitPips  25

#define BuyRecoveryGapPips   3
#define SellRecoveryGapPips  3

// ===== TRAILING STOP SETTINGS (Normal Mode) =====
// Formula: newSL = openPrice + InitialSL + ((profit - TrailingStart) × TrailingRatio)
// 
// Example (BUY @ 2650, Current = 2656, Profit = 6 pips):
//   priceMovement = 6 - 3 = 3 pips
//   slMovement = 3 × 0.5 = 1.5 pips  
//   newSL = 2650 + 2 + 1.5 = 2653.50 (3.5 pips profit locked)
//
// | Profit | SL Position | Calculation |
// |--------|-------------|-------------|
// | 3 pip  | +2.0 pip    | Initial SL set |
// | 5 pip  | +3.0 pip    | 2 + (2 × 0.5) |
// | 10 pip | +5.5 pip    | 2 + (7 × 0.5) |
// | 20 pip | +10.5 pip   | 2 + (17 × 0.5) |

#define BuyTrailingStartPips    3.0   // Pips in profit before trailing starts
#define BuyInitialSLPips        2.5   // Initial SL lock-in pips when trailing activates
#define BuyTrailingRatio        0.5   // SL moves this ratio per 1 pip of price movement (0.5 = 50%)

#define SellTrailingStartPips   3.0   // SELL trailing activation threshold
#define SellInitialSLPips       2.5   // SELL initial SL lock-in pips
#define SellTrailingRatio       0.5   // SELL trailing ratio

// ===== RECOVERY MODE SETTINGS =====
// Recovery mode calculates from average price, not individual positions
// Recovery mode activates when positions >= MaxOrders

#define EnableRecovery          true   // Recovery mode enable/disable
#define RecoveryTakeProfitPips  25.0  // Recovery TP from average price - NOT USED for breakeven
#define RecoveryBreakevenPips   3.0  // Profit pips for breakeven close (long-distance + profitable positions)
#define RecoveryTrailingStartPips 2.5  // Recovery trailing activation threshold
#define RecoveryInitialSLPips   2.50    // Recovery initial SL lock-in pips
#define RecoveryTrailingRatio   0.5    // Recovery trailing ratio
#define RecoveryLotIncrement    0.01   // Lot size increment per recovery order (fixed)
#define MaxRecoveryLotSize      0.35    // Recovery lot cap (base 0.30 + max 5 increments = 0.35)
#define MaxRecoveryOrders       30
#define RecoveryCleanupThreshold 3  // When only recovery positions remain and count <= this, close all and restart normal mode

// ===== TREND SKIP MODE SETTINGS =====
// When one side (BUY or SELL) has positions trailing in profit,
// new grid orders on the opposite side are SKIPPED.
// Prevents accumulating positions against strong trends, protecting equity.
// Normal grid resumes when the trailing profitable side closes.

#define EnableTrendSkip         true    // Trend skip mode enable/disable
#define SkipActivationPips      1.0     // Pips in profit to skip opposite side (1 pip = very early skip)

// ===== EQUITY-BASED SKIP SETTINGS =====
// If floating loss exceeds a certain % of balance, that losing side's grid auto-pauses.
// Works as OR condition with Trend Skip — either one triggers the pause.
// Example: Balance=$1000, EquitySkipPercent=5.0 → $50 floating loss triggers skip.

#define EnableEquitySkip        true    // Equity-based skip enable/disable
#define EquitySkipPercent       5.0     // % of balance loss to trigger skip on the losing side

// ===== SPREAD FILTER =====
// High spread pauses new orders (existing position management continues)
// XAUUSD normal spread: 20-30 pts, news time: 50-100+
#define EnableSpreadFilter      true    // Block new orders during extreme spread
#define MaxSpreadPoints         400     // XAUUSD: normal 20-50, news 100+. 400 = only extreme spike block

// ===== SESSION FILTER =====
// Trade only during specific session hours. Uses broker server time.
// Check your broker's server time and adjust accordingly.
// Typically GMT+2/+3. London open = 09 (GMT+2), NY close = 23 (GMT+2)
#define EnableSessionFilter     false   // Enable session time filter (keep false initially)
#define SessionStartHour        9       // Broker server hour — session start (adjust for your broker)
#define SessionEndHour          23      // Broker server hour — session end (adjust for your broker)

// ===== ATR-BASED DYNAMIC GRID =====
// Uses ATR instead of static gap for dynamic grid spacing
// High volatility = wider gap (fewer trades, safer), Low volatility = tighter gap
#define EnableATRGrid           true    // M15 ATR-based dynamic gap — high volatility = wider gap = safer entries
#define ATRPeriod               14      // ATR calculation period
#define ATRTimeframe            PERIOD_M15  // ATR timeframe
#define ATRGridMultiplier       0.5     // Grid gap = ATR × multiplier (0.5 = half ATR)
#define MinGridGapPips          2.0     // Minimum gap (floor even if ATR is very low)
#define MaxGridGapPips          8.0     // Maximum gap (cap even if ATR is very high)

// ===== TREND DIRECTION FILTER (EMA) =====
// EMA slope detects trend direction to reduce counter-trend entries
// Complements Trend Skip — Skip is reactive, EMA is proactive
#define EnableTrendFilter       true    // M15 EMA trend follow ON — blocks counter-trend normal grid, allows with-trend
#define EMA_Period              50      // EMA period (50 = medium-term trend)
#define EMA_Timeframe           PERIOD_M15  // EMA calculation timeframe
#define EMA_SlopeMinPips        1.5     // Minimum slope (last 5 bars) to consider trending (1.5 = more sensitive)

// ===== RECOVERY SAFETY CAPS =====
// Limits total exposure in recovery mode
#define MaxTotalLotsPerSide     3.0     // Max total lots per side (normal + recovery combined)
#define MaxFloatingLossPerSide  30.0    // Max floating loss per side as % of balance (30% = $2250 on $7500). 0 = disabled
#define MinFreeMarginForRecovery 200.0  // Minimum free margin ($) required to place recovery order
#define RecoveryCooldownSeconds  30     // Wait seconds after recovery fill before next recovery order

// ===== DAILY LIMITS =====
// Pause new entries after daily profit/loss target is reached
#define EnableDailyLimits       false   // Enable daily profit/loss limits
#define DailyProfitTarget       0.0     // Daily profit target in $ to pause entries (0 = disabled)
#define DailyMaxLoss            0.0     // Daily max loss in $ to pause entries (0 = disabled)

// ===== NEWS PAUSE (Manual) =====
// Toggle manually to pause EA during news events
// Future: auto news API integration planned
input bool      PauseForNews    = false;  // true = pause all new orders (existing positions still managed)

#define LotSize         0.30
#define MagicNumber     999888
#define OrderComment    "CleanGrid"
#define ManageAllTrades false

//--- Server URL (Hidden from user)
string    LicenseServer     = "https://markstrades.com";

//--- Global Variables
double pip = 1.0;
int currentBuyPositions = 0;      // Filled positions only (for recovery mode)
int currentSellPositions = 0;     // Filled positions only (for recovery mode)
int totalBuyOrders = 0;           // Positions + Pending (for grid limit)
int totalSellOrders = 0;          // Positions + Pending (for grid limit)
bool buyInRecovery = false;
bool sellInRecovery = false;
// Multi-bundle system: each bundle has unique ID and tracks its own positions
struct BundleEntry
{
    int bundleId;
    ulong ticket;
};
BundleEntry buyBundles[];
BundleEntry sellBundles[];
int nextBuyBundleId = 1;
int nextSellBundleId = 1;

// Trend Skip Mode state
bool skipBuyGrid = false;    // true = don't place new BUY grid/recovery orders
bool skipSellGrid = false;   // true = don't place new SELL grid/recovery orders
bool buyEquitySkipped = false;  // true = BUY side skipped due to heavy floating loss (equity skip)
bool sellEquitySkipped = false; // true = SELL side skipped due to heavy floating loss (equity skip)

// Smart Filter state
bool g_NewEntriesBlocked = false;  // Master block flag (spread/session/daily/news)
string g_BlockReason = "";         // Why entries are blocked
bool g_BlockCancelPending = false; // true = pending orders are deleted when blocked (hard block only)
int g_ATRHandle = INVALID_HANDLE;  // ATR indicator handle
int g_EMAHandle = INVALID_HANDLE;  // EMA indicator handle
datetime g_LastBuyRecoveryFill = 0;  // Last BUY recovery order fill time (for cooldown)
datetime g_LastSellRecoveryFill = 0; // Last SELL recovery order fill time (for cooldown)
int g_TrendBias = 0;              // -1=bearish, 0=neutral, +1=bullish (from EMA)

// Trading Log
struct LogEntry
{
    string timestamp;
    string type;
    string message;
};
LogEntry tradingLog[];
int logMaxSize = 1;

// API Communication
datetime g_LastTradeDataUpdate = 0;

// License Verification
bool g_LicenseValid = false;
string g_LicenseMessage = "";
string g_PlanName = "";
int g_DaysRemaining = 0;
datetime g_LastVerification = 0;
datetime g_LicenseExpiry = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
    pip = 1.0; // For XAUUSD
    trade.SetExpertMagicNumber(MagicNumber);
    
    // Initialize ATR indicator
    if(EnableATRGrid)
    {
        g_ATRHandle = iATR(_Symbol, ATRTimeframe, ATRPeriod);
        if(g_ATRHandle == INVALID_HANDLE)
            Print("WARNING: Failed to create ATR indicator handle");
    }
    
    // Initialize EMA indicator
    if(EnableTrendFilter)
    {
        g_EMAHandle = iMA(_Symbol, EMA_Timeframe, EMA_Period, 0, MODE_EMA, PRICE_CLOSE);
        if(g_EMAHandle == INVALID_HANDLE)
            Print("WARNING: Failed to create EMA indicator handle");
    }
    
    // FORCE license to invalid until verified
    g_LicenseValid = false;
    g_LicenseMessage = "CHECKING...";
    g_PlanName = "";
    g_DaysRemaining = 0;
    
    // Skip license verification in Strategy Tester
    if(MQLInfoInteger(MQL_TESTER))
    {
        g_LicenseValid = true;
        g_LicenseMessage = "TESTER MODE - NO LICENSE REQUIRED";
        g_PlanName = "Tester";
        g_DaysRemaining = 999;
    }
    // MANDATORY license verification on startup (live/demo only)
    else if(StringLen(LicenseKey) == 0)
    {
        g_LicenseMessage = "NO LICENSE KEY";
        Alert("NO LICENSE KEY ENTERED!\n\nPlease enter your license key in EA settings.");
    }
    else
    {
        bool licenseOK = VerifyLicense();
        
        if(!licenseOK)
        {
            Alert("LICENSE INVALID!\n\n" + g_LicenseMessage + "\n\nEA will not trade.");
        }
        else
        {
            // Send connect log to server
            AddToLog(StringFormat("EA Connected | Account: %I64d | Symbol: %s", AccountInfoInteger(ACCOUNT_LOGIN), _Symbol), "CONNECT");
        }
    }
    
    // Update panel on startup
    UpdateLicensePanel();
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Release indicator handles
    if(g_ATRHandle != INVALID_HANDLE) IndicatorRelease(g_ATRHandle);
    if(g_EMAHandle != INVALID_HANDLE) IndicatorRelease(g_EMAHandle);
    
    // Delete all chart objects
    ObjectDelete(0, "EA_ModeStatus");
    ObjectDelete(0, "EA_SellHeader");
    ObjectDelete(0, "EA_SellMode");
    ObjectDelete(0, "EA_SellCount");
    ObjectDelete(0, "EA_SellAvg");
    ObjectDelete(0, "EA_SellBE");
    ObjectDelete(0, "EA_SellProfit");
    ObjectDelete(0, "EA_BuyHeader");
    ObjectDelete(0, "EA_BuyMode");
    ObjectDelete(0, "EA_BuyCount");
    ObjectDelete(0, "EA_BuyAvg");
    ObjectDelete(0, "EA_BuyBE");
    ObjectDelete(0, "EA_BuyProfit");
    ObjectDelete(0, "EA_PriceHeader");
    ObjectDelete(0, "EA_PriceInfo");
    ObjectDelete(0, "EA_TotalProfit");
    ObjectDelete(0, "EA_LicenseTitle");
    ObjectDelete(0, "EA_LicenseURL");
    ObjectDelete(0, "EA_LicensePlan");
    ObjectDelete(0, "EA_LicenseExpiry");
    ObjectDelete(0, "EA_LicenseDays");
    ObjectDelete(0, "EA_LicenseStatus");
    ObjectDelete(0, "EA_LicenseWarning");
    ObjectDelete(0, "EA_SkipStatus");
    ObjectDelete(0, "EA_SkipStatus2");
    ObjectDelete(0, "EA_FilterStatus");
    ObjectDelete(0, "EA_TrendInfo");
    
    // Only delete pending orders when EA is actually removed
    if(reason == REASON_REMOVE || reason == REASON_CHARTCLOSE || reason == REASON_PROGRAM)
    {
        int total = OrdersTotal();
        for(int i = total - 1; i >= 0; i--)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket > 0)
            {
                if(OrderGetString(ORDER_SYMBOL) == _Symbol && OrderGetInteger(ORDER_MAGIC) == MagicNumber)
                {
                    trade.OrderDelete(ticket);
                }
            }
        }
    }
    
    Comment("");
}

//+------------------------------------------------------------------+
//| Expert tick function                                              |
//+------------------------------------------------------------------+
void OnTick()
{
    // Re-verify license every 30 seconds (to catch suspensions/deletions & FM commands)
    static datetime lastLicenseCheck = 0;
    if(!IsTesterMode() && TimeCurrent() - lastLicenseCheck > 30) // 30 seconds
    {
        lastLicenseCheck = TimeCurrent();
        VerifyLicense();
        UpdateLicensePanel(); // Update panel only after verification
    }
    
    // Poll for pending trade commands every 10 seconds (FM close position, close all buy/sell, etc.)
    static datetime lastCommandPoll = 0;
    if(!IsTesterMode() && g_LicenseValid && TimeCurrent() - lastCommandPoll > 10)
    {
        lastCommandPoll = TimeCurrent();
        PollAndExecuteCommands();
    }
    
    // STRICT LICENSE CHECK - If license invalid, expired, suspended or deleted
    if(!g_LicenseValid)
    {
        // Close all pending orders and open positions when license is invalid
        static datetime lastCleanup = 0;
        if(TimeCurrent() - lastCleanup > 10) // Only cleanup every 10 seconds
        {
            lastCleanup = TimeCurrent();
            CloseAllPendingOrders();
            CloseAllOpenPositions();
        }
        
        // Show big warning on chart
        Comment("⛔ LICENSE INVALID ⛔\n\n" +
                "Status: " + g_LicenseMessage + "\n\n" +
                "❌ ALL TRADING DISABLED\n" +
                "❌ ALL POSITIONS CLOSED\n" +
                "❌ NEW ORDERS BLOCKED\n\n" +
                "Please renew at: www.markstrades.com");
        return; // Stop all trading completely
    }
    
    // Clear comment when license is valid
    Comment("");
    
    // Max Drawdown Protection — close all if loss exceeds limit
    if(CheckMaxDrawdown()) return;
    
    // Smart Filters — update entry block status (spread, session, daily limits, news)
    UpdateEntryBlockStatus();
    
    // Update trend bias from EMA (runs every tick, lightweight)
    UpdateTrendBias();
    
    // Count current positions
    CountPositions();
    
    // Trend Skip Detection — check if one side is profiting and should skip opposite
    DetectTrendSkip();
    
    // Debug: Log current state every 30 seconds
    static datetime lastDebugLog = 0;
    if(TimeCurrent() - lastDebugLog > 30)
    {
        double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
        string trendStr = (g_TrendBias == 1) ? "UP" : (g_TrendBias == -1) ? "DOWN" : "FLAT";
        AddToLog(StringFormat("DEBUG | Price: %.2f | BuyMode: %s | SellMode: %s | BuyPos: %d | SellPos: %d | SkipBuy: %s | SkipSell: %s | Trend: %s | Block: %s", 
            currentBid,
            buyInRecovery ? "RECOVERY" : "NORMAL",
            sellInRecovery ? "RECOVERY" : "NORMAL",
            currentBuyPositions,
            currentSellPositions,
            skipBuyGrid ? "YES" : "NO",
            skipSellGrid ? "YES" : "NO",
            trendStr,
            g_NewEntriesBlocked ? g_BlockReason : "NO"), "DEBUG");
        lastDebugLog = TimeCurrent();
    }
    
    // Track previous mode for logging mode changes
    static bool prevBuyInRecovery = false;
    static bool prevSellInRecovery = false;
    
    // Determine mode
    // Primary trigger: positions >= MaxOrders (normal grid full)
    // Secondary trigger: equity-skipped + has positions (deadlock breaker)
    //   Without this, equity skip blocks new normal orders but positions < MaxOrders
    //   means recovery never activates = stuck with losing positions forever.
    //   Recovery bypasses equity skip, so it can place averaging orders to breakeven.
    buyInRecovery = (currentBuyPositions >= MaxBuyOrders) || 
                    (buyEquitySkipped && currentBuyPositions > 0 && EnableRecovery);
    sellInRecovery = (currentSellPositions >= MaxSellOrders) || 
                     (sellEquitySkipped && currentSellPositions > 0 && EnableRecovery);
    
    // Log mode changes
    if(buyInRecovery && !prevBuyInRecovery)
    {
        string trigger = (currentBuyPositions >= MaxBuyOrders) ? "Grid Full" : "Equity Skip Deadlock";
        AddToLog(StringFormat("BUY RECOVERY MODE ACTIVATED (%s | Pos: %d)", trigger, currentBuyPositions), "MODE");
    }
    else if(!buyInRecovery && prevBuyInRecovery)
    {
        AddToLog("BUY NORMAL MODE RESTORED", "MODE");
        // Clear BUY bundles when exiting recovery mode
        ArrayFree(buyBundles);
        nextBuyBundleId = 1;
    }
    
    if(sellInRecovery && !prevSellInRecovery)
    {
        string trigger = (currentSellPositions >= MaxSellOrders) ? "Grid Full" : "Equity Skip Deadlock";
        AddToLog(StringFormat("SELL RECOVERY MODE ACTIVATED (%s | Pos: %d)", trigger, currentSellPositions), "MODE");
    }
    else if(!sellInRecovery && prevSellInRecovery)
    {
        AddToLog("SELL NORMAL MODE RESTORED", "MODE");
        // Clear SELL bundles when exiting recovery mode
        ArrayFree(sellBundles);
        nextSellBundleId = 1;
    }
    
    prevBuyInRecovery = buyInRecovery;
    prevSellInRecovery = sellInRecovery;
    
    // Clean up invalid/out-of-range orders FIRST (before grid management)
    CleanupInvalidOrders();
    
    // Auto-correction worker - ensures grid is always correct
    AutoCorrectGridOrders();
    
    // Recovery Cleanup Worker - close remaining recovery positions when normal positions gone
    // and recovery count <= threshold, allowing fresh normal mode restart
    RecoveryCleanupWorker();
    
    // Skip Enforcement Worker — safety net: delete any pending orders that violate
    // skip/EMA/block rules (catches race conditions, EA restart, mode transitions)
    SkipEnforcementWorker();
    
    // Manage grids based on mode (with Trend Skip + Smart Filter protection)
    // Priority: Master Block > Trend Skip > Trend Filter > Normal/Recovery Grid
    
    // === BUY SIDE ===
    if(buyInRecovery)
    {
        // Recovery bypasses: Equity Skip, Pip-based Trend Skip
        // Recovery WAITS for: Favorable trend (EMA bullish or neutral)
        // Recovery PAUSES: Spread spike, Session, News, Daily limit
        // Recovery Safety Caps (lots/loss/margin/cooldown) provide their own protection
        if(g_NewEntriesBlocked)
        {
            if(g_BlockCancelPending)
                DeleteAllPendingOrdersForSide(true);
            // else: spread/session = soft pause, recovery pendings stay but no new placement
        }
        else
        {
            DeleteNormalPendingOrders(true);
            // Only place NEW recovery orders when trend is favorable (bullish/neutral)
            // Counter-trend (bearish) = wait, but keep existing recovery pendings alive
            if(g_TrendBias >= 0) // Bullish or Neutral → safe to average BUY
                ManageRecoveryGrid(true); // BUY Recovery
        }
    }
    else if(g_NewEntriesBlocked)
    {
        // Soft block (spread/session) = pause new placement only, pendings stay
        // Hard block (news/daily) = delete pending orders
        if(g_BlockCancelPending)
            DeleteAllPendingOrdersForSide(true);
        // else: only ManageNormalGrid is skipped, existing pendings stay alive
    }
    else if(skipBuyGrid)
    {
        // Pip-based or equity skip → BUY normal grid PAUSE
        // Delete pending BUY orders so broker can't fill them during skip
        DeleteAllPendingOrdersForSide(true);
    }
    else if(IsTrendFiltered(true) && !skipSellGrid)
    {
        // EMA bearish → BUY pause, BUT only if SELL side is NOT equity-skipped
        // If SELL is equity-skipped (losing), BUY MUST trade to earn — bypass EMA filter
        DeleteAllPendingOrdersForSide(true);
    }
    else
    {
        ManageNormalGrid(true);  // BUY Normal Mode — trend WITH us, neutral, or opposite side equity-skipped
    }
    
    // === SELL SIDE ===
    if(sellInRecovery)
    {
        // Recovery bypasses: Equity Skip, Pip-based Trend Skip
        // Recovery WAITS for: Favorable trend (EMA bearish or neutral)
        // Recovery PAUSES: Spread spike, Session, News, Daily limit
        if(g_NewEntriesBlocked)
        {
            if(g_BlockCancelPending)
                DeleteAllPendingOrdersForSide(false);
        }
        else
        {
            DeleteNormalPendingOrders(false);
            // Only place NEW recovery orders when trend is favorable (bearish/neutral)
            // Counter-trend (bullish) = wait, but keep existing recovery pendings alive
            if(g_TrendBias <= 0) // Bearish or Neutral → safe to average SELL
                ManageRecoveryGrid(false); // SELL Recovery
        }
    }
    else if(g_NewEntriesBlocked)
    {
        if(g_BlockCancelPending)
            DeleteAllPendingOrdersForSide(false);
    }
    else if(skipSellGrid)
    {
        // Pip-based or equity skip → SELL normal grid PAUSE
        // Delete pending SELL orders so broker can't fill them during skip
        DeleteAllPendingOrdersForSide(false);
    }
    else if(IsTrendFiltered(false) && !skipBuyGrid)
    {
        // EMA bullish → SELL pause, BUT only if BUY side is NOT equity-skipped
        // If BUY is equity-skipped (losing), SELL MUST trade to earn — bypass EMA filter
        DeleteAllPendingOrdersForSide(false);
    }
    else
    {
        ManageNormalGrid(false); // SELL Normal Mode — trend WITH us, neutral, or opposite side equity-skipped
    }
    
    // CRITICAL: Recovery Mode TP Worker - runs every tick to ensure TP is at breakeven
    EnsureRecoveryModeTP();
    
    // Apply trailing stops
    ApplyTrailing();
    
    // Update info panel on chart (every 1 second to reduce load)
    static datetime lastPanelUpdate = 0;
    if(TimeCurrent() - lastPanelUpdate >= 1)
    {
        lastPanelUpdate = TimeCurrent();
        UpdateInfoPanel();
    }
    
    // Send data to API (every 10 seconds)
    static datetime lastAPIUpdate = 0;
    if(TimeCurrent() - lastAPIUpdate >= 10)
    {
        lastAPIUpdate = TimeCurrent();
        SendTradeDataToServer();
    }
}

// ===== Multi-Bundle Helper Functions =====

// Check if a ticket is in ANY bundle (for this side)
bool IsTicketInAnyBundle(bool isBuy, ulong ticket)
{
    if(isBuy)
    {
        for(int i = 0; i < ArraySize(buyBundles); i++)
            if(buyBundles[i].ticket == ticket) return true;
    }
    else
    {
        for(int i = 0; i < ArraySize(sellBundles); i++)
            if(sellBundles[i].ticket == ticket) return true;
    }
    return false;
}

// Get the bundle ID for a specific ticket (-1 if not found)
int GetTicketBundleId(bool isBuy, ulong ticket)
{
    if(isBuy)
    {
        for(int i = 0; i < ArraySize(buyBundles); i++)
            if(buyBundles[i].ticket == ticket) return buyBundles[i].bundleId;
    }
    else
    {
        for(int i = 0; i < ArraySize(sellBundles); i++)
            if(sellBundles[i].ticket == ticket) return sellBundles[i].bundleId;
    }
    return -1;
}

// Add a ticket to a specific bundle
void AddTicketToBundle(bool isBuy, int bundleId, ulong ticket)
{
    if(ticket <= 0) return;
    if(IsTicketInAnyBundle(isBuy, ticket)) return; // Already in a bundle
    
    if(isBuy)
    {
        int size = ArraySize(buyBundles);
        ArrayResize(buyBundles, size + 1);
        buyBundles[size].bundleId = bundleId;
        buyBundles[size].ticket = ticket;
    }
    else
    {
        int size = ArraySize(sellBundles);
        ArrayResize(sellBundles, size + 1);
        sellBundles[size].bundleId = bundleId;
        sellBundles[size].ticket = ticket;
    }
}

// Get all unique bundle IDs for a side
int GetUniqueBundleIds(bool isBuy, int &ids[])
{
    ArrayResize(ids, 0);
    int total = isBuy ? ArraySize(buyBundles) : ArraySize(sellBundles);
    
    for(int i = 0; i < total; i++)
    {
        int bid = isBuy ? buyBundles[i].bundleId : sellBundles[i].bundleId;
        bool found = false;
        for(int j = 0; j < ArraySize(ids); j++)
        {
            if(ids[j] == bid) { found = true; break; }
        }
        if(!found)
        {
            int s = ArraySize(ids);
            ArrayResize(ids, s + 1);
            ids[s] = bid;
        }
    }
    return ArraySize(ids);
}

// Get all tickets for a specific bundle
int GetBundleTickets(bool isBuy, int bundleId, ulong &tickets[])
{
    ArrayResize(tickets, 0);
    int total = isBuy ? ArraySize(buyBundles) : ArraySize(sellBundles);
    
    for(int i = 0; i < total; i++)
    {
        int bid = isBuy ? buyBundles[i].bundleId : sellBundles[i].bundleId;
        ulong tk = isBuy ? buyBundles[i].ticket : sellBundles[i].ticket;
        if(bid == bundleId)
        {
            int s = ArraySize(tickets);
            ArrayResize(tickets, s + 1);
            tickets[s] = tk;
        }
    }
    return ArraySize(tickets);
}

// Get total number of bundled tickets for a side
int GetTotalBundledCount(bool isBuy)
{
    return isBuy ? ArraySize(buyBundles) : ArraySize(sellBundles);
}

// Create a new bundle and return its ID
int CreateNewBundle(bool isBuy)
{
    int id;
    if(isBuy)
    {
        id = nextBuyBundleId;
        nextBuyBundleId++;
    }
    else
    {
        id = nextSellBundleId;
        nextSellBundleId++;
    }
    return id;
}

// Cleanup: remove closed positions from bundles, remove empty bundles
void CleanupBundles()
{
    // Cleanup BUY bundles
    int write = 0;
    for(int i = 0; i < ArraySize(buyBundles); i++)
    {
        ulong ticket = buyBundles[i].ticket;
        if(!PositionSelectByTicket(ticket)) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != POSITION_TYPE_BUY) continue;
        
        buyBundles[write] = buyBundles[i];
        write++;
    }
    ArrayResize(buyBundles, write);
    
    // Cleanup SELL bundles
    write = 0;
    for(int i = 0; i < ArraySize(sellBundles); i++)
    {
        ulong ticket = sellBundles[i].ticket;
        if(!PositionSelectByTicket(ticket)) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != POSITION_TYPE_SELL) continue;
        
        sellBundles[write] = sellBundles[i];
        write++;
    }
    ArrayResize(sellBundles, write);
}

// Legacy compatibility wrapper
bool IsRecoveryBreakevenTrailTicket(bool isBuy, ulong ticket)
{
    return IsTicketInAnyBundle(isBuy, ticket);
}

bool IsTesterMode()
{
    return (TesterMode && (MQLInfoInteger(MQL_TESTER) != 0));
}

//+------------------------------------------------------------------+
//| SMART FILTER SYSTEM — All entry quality checks                    |
//+------------------------------------------------------------------+

// Check if spread is acceptable for new orders
bool IsSpreadOK()
{
    if(!EnableSpreadFilter) return true;
    double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double spreadPoints = (ask - bid) / _Point;
    return (spreadPoints <= MaxSpreadPoints);
}

// Check if current time is within allowed trading session (broker server time)
bool IsSessionOK()
{
    if(!EnableSessionFilter) return true;
    MqlDateTime dt;
    TimeTradeServer(dt);
    int hour = dt.hour;
    
    if(SessionStartHour < SessionEndHour)
        return (hour >= SessionStartHour && hour < SessionEndHour);
    else // Wraps midnight (e.g. 22 to 06)
        return (hour >= SessionStartHour || hour < SessionEndHour);
}

// Get ATR-based dynamic grid gap (in pips). Falls back to static gap if ATR unavailable.
double GetATRGridGap(bool isBuy)
{
    double staticGap = isBuy ? BuyGapPips : SellGapPips;
    if(!EnableATRGrid || g_ATRHandle == INVALID_HANDLE) return staticGap;
    
    double atrBuffer[];
    if(CopyBuffer(g_ATRHandle, 0, 0, 1, atrBuffer) <= 0) return staticGap;
    
    double atrValue = atrBuffer[0]; // ATR in price (e.g. 3.5 for XAUUSD = 3.5 pips)
    double atrGap = (atrValue / pip) * ATRGridMultiplier;
    
    // Clamp to min/max
    atrGap = MathMax(MinGridGapPips, MathMin(MaxGridGapPips, atrGap));
    
    return NormalizeDouble(atrGap, 1);
}

// Get trend bias from EMA slope: -1=bearish, 0=neutral, +1=bullish
void UpdateTrendBias()
{
    g_TrendBias = 0;
    if(!EnableTrendFilter || g_EMAHandle == INVALID_HANDLE) return;
    
    double emaBuffer[];
    ArraySetAsSeries(emaBuffer, true); // [0]=newest bar, [5]=5 bars ago
    if(CopyBuffer(g_EMAHandle, 0, 0, 6, emaBuffer) < 6) return;
    
    // Slope = (current EMA - EMA 5 bars ago) in pips
    double slopeValue = (emaBuffer[0] - emaBuffer[5]) / pip;
    
    if(slopeValue >= EMA_SlopeMinPips)
        g_TrendBias = 1;   // Bullish — EMA rising
    else if(slopeValue <= -EMA_SlopeMinPips)
        g_TrendBias = -1;  // Bearish — EMA falling
}

//+------------------------------------------------------------------+
//| Validate SL/TP for PENDING ORDERS (checks against order price)   |
//| For pending orders, broker checks SL/TP relative to order price   |
//| BUY: TP > orderPrice, SL < orderPrice                            |
//| SELL: TP < orderPrice, SL > orderPrice                           |
//+------------------------------------------------------------------+
void ValidateStops(bool isBuy, double orderPrice, double &sl, double &tp)
{
    int stopsLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
    if(stopsLevel <= 0) stopsLevel = 10; // Fallback minimum
    double minDist = stopsLevel * _Point;
    
    // Validate TP direction and distance (relative to order price)
    if(tp != 0)
    {
        if(isBuy)
        {
            if(tp <= orderPrice) tp = 0;
            else if(tp - orderPrice < minDist) tp = NormalizeDouble(orderPrice + minDist, _Digits);
        }
        else
        {
            if(tp >= orderPrice) tp = 0;
            else if(orderPrice - tp < minDist) tp = NormalizeDouble(orderPrice - minDist, _Digits);
        }
    }
    
    // Validate SL direction and distance (relative to order price)
    if(sl != 0)
    {
        if(isBuy)
        {
            if(sl >= orderPrice) sl = 0;
            else if(orderPrice - sl < minDist) sl = NormalizeDouble(orderPrice - minDist, _Digits);
        }
        else
        {
            if(sl <= orderPrice) sl = 0;
            else if(sl - orderPrice < minDist) sl = NormalizeDouble(orderPrice + minDist, _Digits);
        }
    }
}

//+------------------------------------------------------------------+
//| Validate SL/TP for POSITION MODIFICATIONS (against market price)  |
//| For open positions, broker checks SL/TP distance from CURRENT     |
//| market price (Bid for BUY, Ask for SELL), NOT from open price.    |
//| Trailing SL on profitable positions moves between open and market  |
//| price — this is valid and must NOT be rejected.                    |
//| BUY: SL < Bid, TP > Bid (distance from Bid >= STOPS_LEVEL)       |
//| SELL: SL > Ask, TP < Ask (distance from Ask >= STOPS_LEVEL)       |
//+------------------------------------------------------------------+
void ValidateStopsForPosition(bool isBuy, double &sl, double &tp)
{
    int stopsLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
    if(stopsLevel <= 0) stopsLevel = 10;
    double minDist = stopsLevel * _Point;
    
    double marketPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Validate TP (must be on profitable side of market price)
    if(tp != 0)
    {
        if(isBuy)
        {
            if(tp <= marketPrice) tp = 0; // TP below current Bid = already triggered or invalid
            else if(tp - marketPrice < minDist) tp = NormalizeDouble(marketPrice + minDist, _Digits);
        }
        else
        {
            if(tp >= marketPrice) tp = 0; // TP above current Ask = already triggered or invalid
            else if(marketPrice - tp < minDist) tp = NormalizeDouble(marketPrice - minDist, _Digits);
        }
    }
    
    // Validate SL (must be on loss side of market price)
    if(sl != 0)
    {
        if(isBuy)
        {
            if(sl >= marketPrice) sl = 0; // SL above Bid = would trigger immediately
            else if(marketPrice - sl < minDist) sl = NormalizeDouble(marketPrice - minDist, _Digits);
        }
        else
        {
            if(sl <= marketPrice) sl = 0; // SL below Ask = would trigger immediately
            else if(sl - marketPrice < minDist) sl = NormalizeDouble(marketPrice + minDist, _Digits);
        }
    }
}

// Check if a new NORMAL grid order should be blocked by trend filter
// Returns true if this side SHOULD be blocked
bool IsTrendFiltered(bool isBuy)
{
    if(!EnableTrendFilter) return false;
    
    // In strong uptrend: block new SELL entries (counter-trend)
    // In strong downtrend: block new BUY entries (counter-trend)
    if(isBuy && g_TrendBias == -1) return true;   // Bearish → don't open new BUY
    if(!isBuy && g_TrendBias == 1) return true;    // Bullish → don't open new SELL
    
    return false;
}

// Check if recovery is safe to place a new order for this side
bool IsRecoverySafe(bool isBuy, string &outReason)
{
    outReason = "";
    
    // Check 1: Total lots per side cap
    double totalLots = 0;
    double floatingLoss = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        totalLots += PositionGetDouble(POSITION_VOLUME);
        double profit = PositionGetDouble(POSITION_PROFIT);
        if(profit < 0) floatingLoss += MathAbs(profit);
    }
    
    if(MaxTotalLotsPerSide > 0 && totalLots >= MaxTotalLotsPerSide)
    {
        outReason = StringFormat("Lot cap (%.2f/%.2f)", totalLots, MaxTotalLotsPerSide);
        return false;
    }
    
    // Check 2: Max floating loss per side (% of balance)
    if(MaxFloatingLossPerSide > 0)
    {
        double balance = AccountInfoDouble(ACCOUNT_BALANCE);
        double lossCap = balance * MaxFloatingLossPerSide / 100.0;
        if(floatingLoss >= lossCap)
        {
            outReason = StringFormat("Loss cap ($%.0f / %.0f%% of $%.0f = $%.0f)", floatingLoss, MaxFloatingLossPerSide, balance, lossCap);
            return false;
        }
    }
    
    // Check 3: Minimum free margin
    if(MinFreeMarginForRecovery > 0)
    {
        double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
        if(freeMargin < MinFreeMarginForRecovery)
        {
            outReason = StringFormat("Low margin ($%.0f < $%.0f)", freeMargin, MinFreeMarginForRecovery);
            return false;
        }
    }
    
    // Check 4: Recovery cooldown
    if(RecoveryCooldownSeconds > 0)
    {
        datetime lastFill = isBuy ? g_LastBuyRecoveryFill : g_LastSellRecoveryFill;
        if(lastFill > 0 && (TimeCurrent() - lastFill) < RecoveryCooldownSeconds)
        {
            outReason = StringFormat("Cooldown (%ds)", RecoveryCooldownSeconds);
            return false;
        }
    }
    
    return true;
}

// Calculate today's closed P/L for daily limit check
double GetTodayClosedPnL()
{
    double todayPnL = 0;
    MqlDateTime dt;
    TimeCurrent(dt);
    datetime dayStart = StringToTime(StringFormat("%04d.%02d.%02d 00:00:00", dt.year, dt.mon, dt.day));
    
    if(!HistorySelect(dayStart, TimeCurrent())) return 0;
    
    int totalDeals = HistoryDealsTotal();
    for(int i = 0; i < totalDeals; i++)
    {
        ulong dealTicket = HistoryDealGetTicket(i);
        if(dealTicket <= 0) continue;
        if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) continue;
        if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != MagicNumber) continue;
        
        ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
        if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
            todayPnL += HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
    }
    return todayPnL;
}

// Check if daily limits are hit
bool IsDailyLimitHit()
{
    if(!EnableDailyLimits) return false;
    if(DailyProfitTarget <= 0 && DailyMaxLoss <= 0) return false;
    
    double todayPnL = GetTodayClosedPnL();
    
    if(DailyProfitTarget > 0 && todayPnL >= DailyProfitTarget) return true;
    if(DailyMaxLoss > 0 && todayPnL <= -DailyMaxLoss) return true;
    
    return false;
}

// Master check: should new entries be blocked?
// This checks spread, session, daily limits, news pause
// Does NOT check trend skip (that's separate logic)
void UpdateEntryBlockStatus()
{
    g_NewEntriesBlocked = false;
    g_BlockReason = "";
    g_BlockCancelPending = false;
    
    if(PauseForNews)
    {
        g_NewEntriesBlocked = true;
        g_BlockReason = "NEWS PAUSE (manual)";
        g_BlockCancelPending = true;
        return;
    }
    
    if(!IsSpreadOK())
    {
        g_NewEntriesBlocked = true;
        double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
        double sp = (ask - bid) / _Point;
        g_BlockReason = StringFormat("SPREAD %.0f > %d pts", sp, MaxSpreadPoints);
        g_BlockCancelPending = false;
        return;
    }
    
    if(!IsSessionOK())
    {
        g_NewEntriesBlocked = true;
        MqlDateTime dt;
        TimeTradeServer(dt);
        g_BlockReason = StringFormat("OUT OF SESSION (now=%02d, allowed=%d-%d)", dt.hour, SessionStartHour, SessionEndHour);
        g_BlockCancelPending = false;
        return;
    }
    
    if(IsDailyLimitHit())
    {
        g_NewEntriesBlocked = true;
        double pnl = GetTodayClosedPnL();
        g_BlockReason = StringFormat("DAILY LIMIT (PnL=$%.2f)", pnl);
        g_BlockCancelPending = true;
        return;
    }
}

//+------------------------------------------------------------------+
//| Trend Skip Detection (Enhanced: Early + Equity-Based)             |
//| 3 layers of protection:                                           |
//| Layer 1: Pip-based — any position profit ≥ SkipActivationPips     |
//| Layer 2: Equity-based — floating loss ≥ EquitySkipPercent% of bal |
//|          → skip the LOSING side (don't add more losing orders)    |
//| Layer 3: Both sides profit = ranging market = NO skip             |
//+------------------------------------------------------------------+
void DetectTrendSkip()
{
    skipBuyGrid = false;
    skipSellGrid = false;
    buyEquitySkipped = false;
    sellEquitySkipped = false;
    
    if(!EnableTrendSkip && !EnableEquitySkip) return;
    
    double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double threshold = SkipActivationPips * pip;
    
    // ===== LAYER 1: Pip-Based Trend Detection =====
    bool buyHasProfit = false;
    bool sellHasProfit = false;
    double buyFloatingPnL = 0.0;   // Total floating PnL for BUY side (for equity skip)
    double sellFloatingPnL = 0.0;  // Total floating PnL for SELL side (for equity skip)
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double profit = PositionGetDouble(POSITION_PROFIT);
        
        if(type == POSITION_TYPE_BUY)
        {
            buyFloatingPnL += profit;
            // Pip-based check
            if(EnableTrendSkip && (currentBid - openPrice) >= threshold)
                buyHasProfit = true;
        }
        else if(type == POSITION_TYPE_SELL)
        {
            sellFloatingPnL += profit;
            // Pip-based check
            if(EnableTrendSkip && (openPrice - currentAsk) >= threshold)
                sellHasProfit = true;
        }
    }
    
    // Both sides profit = ranging = no pip-based skip
    if(buyHasProfit && sellHasProfit)
    {
        buyHasProfit = false;
        sellHasProfit = false;
    }
    
    // Apply pip-based skip
    if(buyHasProfit && !sellHasProfit)
        skipSellGrid = true;  // Market UP → skip new SELL orders
    else if(sellHasProfit && !buyHasProfit)
        skipBuyGrid = true;   // Market DOWN → skip new BUY orders
    
    // ===== LAYER 2: Equity-Based Skip =====
    // If one side has heavy floating loss, skip adding MORE orders to that losing side
    if(EnableEquitySkip)
    {
        double balance = AccountInfoDouble(ACCOUNT_BALANCE);
        double lossThreshold = balance * EquitySkipPercent / 100.0;  // e.g. 5% of $1000 = $50
        
        // BUY side losing badly → skip BUY grid (don't add more losing BUYs)
        // AND let SELL side (which is profiting from the down move) continue
        if(buyFloatingPnL < 0.0 && MathAbs(buyFloatingPnL) >= lossThreshold)
        {
            buyEquitySkipped = true;  // Track equity-skip separately for recovery trigger
            if(!skipBuyGrid)  // Don't overwrite if pip-based already set it
            {
                skipBuyGrid = true;
                // Also ensure we don't skip SELL (it's the profitable side)
            }
        }
        
        // SELL side losing badly → skip SELL grid
        if(sellFloatingPnL < 0.0 && MathAbs(sellFloatingPnL) >= lossThreshold)
        {
            sellEquitySkipped = true;  // Track equity-skip separately for recovery trigger
            if(!skipSellGrid)
            {
                skipSellGrid = true;
            }
        }
        
        // Safety: if BOTH sides are losing heavily, skip BOTH (protect equity)
        // This is different from pip-based where both-profit = no-skip
        // Both-loss means market is volatile in both directions = pause everything
    }
    
    // Log mode changes (throttled)
    static bool prevSkipBuy = false;
    static bool prevSkipSell = false;
    
    if(skipBuyGrid && !prevSkipBuy)
    {
        string reason = "";
        if(buyFloatingPnL < 0.0)
            reason = StringFormat("EQUITY SKIP: BUY loss=%.2f", buyFloatingPnL);
        else
            reason = "TREND SKIP: Market DOWN";
        AddToLog(reason + " → BUY grid PAUSED", "SKIP");
    }
    else if(!skipBuyGrid && prevSkipBuy)
        AddToLog("SKIP OFF: BUY grid RESUMED", "SKIP");
    
    if(skipSellGrid && !prevSkipSell)
    {
        string reason = "";
        if(sellFloatingPnL < 0.0)
            reason = StringFormat("EQUITY SKIP: SELL loss=%.2f", sellFloatingPnL);
        else
            reason = "TREND SKIP: Market UP";
        AddToLog(reason + " → SELL grid PAUSED", "SKIP");
    }
    else if(!skipSellGrid && prevSkipSell)
        AddToLog("SKIP OFF: SELL grid RESUMED", "SKIP");
    
    prevSkipBuy = skipBuyGrid;
    prevSkipSell = skipSellGrid;
}

datetime LicenseCacheNow()
{
    return (datetime)TimeLocal();
}

uint Fnv1aHash(string s)
{
    uint h = 2166136261;
    int len = StringLen(s);
    for(int i = 0; i < len; i++)
    {
        h ^= (uint)(uchar)StringGetCharacter(s, i);
        h *= 16777619;
    }
    return h;
}

string LicenseCachePrefix(string mt5Account)
{
    uint h = Fnv1aHash(LicenseKey + "|" + mt5Account);
    return "LIC_" + StringFormat("%08X", h);
}

string LicenseCacheFileName(string mt5Account)
{
    uint h = Fnv1aHash(LicenseKey + "|" + mt5Account);
    return StringFormat("license_cache_%08X.bin", h);
}

bool TryLoadCachedLicenseCommon(string mt5Account)
{
    if(!IsTesterMode()) return false;
    if(!UseCachedLicenseInTester) return false;

    string fn = LicenseCacheFileName(mt5Account);
    int fh = FileOpen(fn, FILE_COMMON|FILE_READ|FILE_BIN);
    if(fh == INVALID_HANDLE) return false;

    int valid = (int)FileReadInteger(fh, INT_VALUE);
    long ts = (long)FileReadLong(fh);
    int days = (int)FileReadInteger(fh, INT_VALUE);
    FileClose(fh);

    if(valid != 1) return false;

    datetime last = (datetime)ts;
    datetime now = LicenseCacheNow();
    if(CachedLicenseMaxAgeHours > 0)
    {
        if((now - last) > (CachedLicenseMaxAgeHours * 3600)) return false;
    }

    g_LicenseValid = true;
    g_LicenseMessage = "ACTIVE (CACHED)";
    g_PlanName = "";
    g_DaysRemaining = days;
    g_LastVerification = TimeCurrent();
    return true;
}

void SaveCachedLicenseCommon(string mt5Account)
{
    string fn = LicenseCacheFileName(mt5Account);
    int fh = FileOpen(fn, FILE_COMMON|FILE_WRITE|FILE_BIN);
    if(fh == INVALID_HANDLE) return;

    FileWriteInteger(fh, g_LicenseValid ? 1 : 0, INT_VALUE);
    FileWriteLong(fh, (long)LicenseCacheNow());
    FileWriteInteger(fh, g_DaysRemaining, INT_VALUE);
    FileClose(fh);
}

bool TryLoadCachedLicense(string mt5Account)
{
    if(!IsTesterMode()) return false;
    if(!UseCachedLicenseInTester) return false;

    string p = LicenseCachePrefix(mt5Account);
    string v = p + "_V";
    string t = p + "_T";
    string d = p + "_D";

    if(!GlobalVariableCheck(v) || !GlobalVariableCheck(t)) return false;

    double valid = GlobalVariableGet(v);
    if(valid < 0.5) return false;

    datetime last = (datetime)GlobalVariableGet(t);
    datetime now = LicenseCacheNow();
    if(CachedLicenseMaxAgeHours > 0)
    {
        if((now - last) > (CachedLicenseMaxAgeHours * 3600)) return false;
    }

    g_LicenseValid = true;
    g_LicenseMessage = "ACTIVE (CACHED)";
    g_PlanName = "";
    g_DaysRemaining = GlobalVariableCheck(d) ? (int)GlobalVariableGet(d) : 0;
    g_LastVerification = TimeCurrent();
    return true;
}

void SaveCachedLicense(string mt5Account)
{
    string p = LicenseCachePrefix(mt5Account);
    GlobalVariableSet(p + "_V", g_LicenseValid ? 1.0 : 0.0);
    GlobalVariableSet(p + "_T", (double)LicenseCacheNow());
    GlobalVariableSet(p + "_D", (double)g_DaysRemaining);

    SaveCachedLicenseCommon(mt5Account);
}

double GetRecoveryBreakevenGroupProfitAtPrice(bool isBuy, double closePrice, ulong longDistanceTicket)
{
    ENUM_ORDER_TYPE orderType = isBuy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
    double totalProfit = 0.0;
    double totalLots = 0.0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;

        if(ticket != longDistanceTicket)
        {
            double floatingProfit = PositionGetDouble(POSITION_PROFIT);
            if(floatingProfit <= 0.0) continue;
        }
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        totalLots += lots;
        
        double profit = 0.0;
        if(OrderCalcProfit(orderType, _Symbol, lots, openPrice, closePrice, profit))
            totalProfit += profit;
    }
    
    // Add target profit based on RecoveryBreakevenPips
    // This ensures we close at a small profit instead of exact breakeven
    double targetProfit = RecoveryBreakevenPips * pip * totalLots * 100; // Approximate profit in account currency
    
    return totalProfit - targetProfit; // Return difference from target
}

double FindRecoveryBreakevenClosePrice(bool isBuy, ulong longDistanceTicket)
{
    if(longDistanceTicket <= 0) return 0.0;
    if(!PositionSelectByTicket(longDistanceTicket)) return 0.0;
    
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double longDistanceOpen = PositionGetDouble(POSITION_PRICE_OPEN);

    double baseRange = 20.0 * pip;
    double low = MathMin(currentPrice, longDistanceOpen) - baseRange;
    double high = MathMax(currentPrice, longDistanceOpen) + baseRange;
    
    double fLow = GetRecoveryBreakevenGroupProfitAtPrice(isBuy, low, longDistanceTicket);
    double fHigh = GetRecoveryBreakevenGroupProfitAtPrice(isBuy, high, longDistanceTicket);
    
    int expand = 0;
    while(fLow * fHigh > 0.0 && expand < 12)
    {
        baseRange *= 2.0;
        low = MathMin(currentPrice, longDistanceOpen) - baseRange;
        high = MathMax(currentPrice, longDistanceOpen) + baseRange;
        fLow = GetRecoveryBreakevenGroupProfitAtPrice(isBuy, low, longDistanceTicket);
        fHigh = GetRecoveryBreakevenGroupProfitAtPrice(isBuy, high, longDistanceTicket);
        expand++;
    }
    
    if(fLow * fHigh > 0.0) return 0.0;
    
    double mid = 0.0;
    double fMid = 0.0;
    for(int iter = 0; iter < 40; iter++)
    {
        mid = (low + high) * 0.5;
        fMid = GetRecoveryBreakevenGroupProfitAtPrice(isBuy, mid, longDistanceTicket);
        
        if(MathAbs(fMid) <= 0.05) break;
        
        if(fLow * fMid <= 0.0)
        {
            high = mid;
            fHigh = fMid;
        }
        else
        {
            low = mid;
            fLow = fMid;
        }
    }

    int stopsLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
    double minDist = stopsLevel * _Point;
    
    if(isBuy)
    {
        double minTP = currentPrice + minDist;
        if(mid < minTP) mid = minTP;
    }
    else
    {
        double maxTP = currentPrice - minDist;
        if(mid > maxTP) mid = maxTP;
    }
    
    return NormalizeDouble(mid, _Digits);
}

//+------------------------------------------------------------------+
//| Count Current Positions and Orders                                |
//+------------------------------------------------------------------+
void CountPositions()
{
    currentBuyPositions = 0;
    currentSellPositions = 0;
    totalBuyOrders = 0;
    totalSellOrders = 0;
    
    int normalBuyCount = 0;
    int normalSellCount = 0;
    int recoveryBuyCount = 0;
    int recoverySellCount = 0;
    
    // Count ALL filled positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        bool isRecovery = (StringFind(comment, "Recovery") >= 0);
        
        if(type == POSITION_TYPE_BUY)
        {
            if(isRecovery)
                recoveryBuyCount++;
            else
                normalBuyCount++;
        }
        else
        {
            if(isRecovery)
                recoverySellCount++;
            else
                normalSellCount++;
        }
    }
    
    // Recovery mode logic:
    // - Enter recovery when normal positions >= MaxOrders
    // - Stay in recovery as long as ANY position exists (normal OR recovery)
    // - Exit recovery only when ALL positions are closed
    
    int totalBuyPositions = normalBuyCount + recoveryBuyCount;
    int totalSellPositions = normalSellCount + recoverySellCount;
    
    // For recovery mode detection:
    // If we have recovery positions, we're still in recovery mode
    // If we only have normal positions >= max, enter recovery mode
    if(recoveryBuyCount > 0 || normalBuyCount >= MaxBuyOrders)
        currentBuyPositions = MaxBuyOrders; // Force recovery mode
    else
        currentBuyPositions = normalBuyCount;
    
    if(recoverySellCount > 0 || normalSellCount >= MaxSellOrders)
        currentSellPositions = MaxSellOrders; // Force recovery mode
    else
        currentSellPositions = normalSellCount;
    
    // Debug log every 30 seconds
    static datetime lastCountLog = 0;
    if(TimeCurrent() - lastCountLog > 30)
    {
        AddToLog(StringFormat("Position Count | BUY: Normal=%d Recovery=%d (Mode=%s) | SELL: Normal=%d Recovery=%d (Mode=%s)", 
            normalBuyCount, recoveryBuyCount, (currentBuyPositions >= MaxBuyOrders) ? "RECOVERY" : "NORMAL",
            normalSellCount, recoverySellCount, (currentSellPositions >= MaxSellOrders) ? "RECOVERY" : "NORMAL"), "COUNT");
        lastCountLog = TimeCurrent();
    }
    
    // Total = Normal positions only (for grid limit in normal mode)
    totalBuyOrders = normalBuyCount;
    totalSellOrders = normalSellCount;
    
    // Add normal pending orders to total (for grid limit only)
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue; // Skip recovery orders
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if(type == ORDER_TYPE_BUY_LIMIT)
            totalBuyOrders++;
        else if(type == ORDER_TYPE_SELL_LIMIT)
            totalSellOrders++;
    }
}

//+------------------------------------------------------------------+
//| Delete Normal Pending Orders (when entering recovery mode)        |
//+------------------------------------------------------------------+
void DeleteNormalPendingOrders(bool isBuy)
{
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue; // Keep recovery orders
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            trade.OrderDelete(ticket);
    }
}

//+------------------------------------------------------------------+
//| Delete ALL Pending Orders for a Side (Normal + Recovery)           |
//| Used by Trend Skip Mode to clear the skipped side completely       |
//+------------------------------------------------------------------+
void DeleteAllPendingOrdersForSide(bool isBuy)
{
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if(isBuy && (type == ORDER_TYPE_BUY_LIMIT || type == ORDER_TYPE_BUY_STOP))
            trade.OrderDelete(ticket);
        else if(!isBuy && (type == ORDER_TYPE_SELL_LIMIT || type == ORDER_TYPE_SELL_STOP))
            trade.OrderDelete(ticket);
    }
}

//+------------------------------------------------------------------+
//| Cleanup Invalid/Out-of-Range Orders                               |
//+------------------------------------------------------------------+
void CleanupInvalidOrders()
{
    double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Range settings
    double buyRangeHigh = MathMax(BuyRangeStart, BuyRangeEnd);
    double buyRangeLow = MathMin(BuyRangeStart, BuyRangeEnd);
    double sellRangeHigh = MathMax(SellRangeStart, SellRangeEnd);
    double sellRangeLow = MathMin(SellRangeStart, SellRangeEnd);
    
    int deletedCount = 0;
    
    // CRITICAL: Only delete orders that are in WRONG mode
    // This runs BEFORE grid management, so it cleans up old orders from previous mode
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        bool isRecovery = (StringFind(comment, "Recovery") >= 0);
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        
        bool shouldDelete = false;
        string reason = "";
        
        // Check BUY orders - delete ONLY if mode mismatch
        if(type == ORDER_TYPE_BUY_LIMIT)
        {
            // In NORMAL mode: Delete recovery orders (they're from old recovery mode)
            if(!buyInRecovery && isRecovery)
            {
                shouldDelete = true;
                reason = "Recovery order while in normal mode";
            }
            // In RECOVERY mode: Delete normal orders (they're from old normal mode)
            // This is already handled by DeleteNormalPendingOrders(), so skip here
            // to avoid double deletion
        }
        // Check SELL orders - delete ONLY if mode mismatch
        else if(type == ORDER_TYPE_SELL_LIMIT)
        {
            // In NORMAL mode: Delete recovery orders (they're from old recovery mode)
            if(!sellInRecovery && isRecovery)
            {
                shouldDelete = true;
                reason = "Recovery order while in normal mode";
            }
            // In RECOVERY mode: Delete normal orders (they're from old normal mode)
            // This is already handled by DeleteNormalPendingOrders(), so skip here
        }
        
        if(shouldDelete)
        {
            if(trade.OrderDelete(ticket))
            {
                AddToLog(StringFormat("Mode cleanup: Deleted %s %s order #%I64u - %s", 
                    isRecovery ? "RECOVERY" : "NORMAL",
                    (type == ORDER_TYPE_BUY_LIMIT) ? "BUY" : "SELL", 
                    ticket, reason), "CLEANUP");
                deletedCount++;
            }
        }
    }
    
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
        string comment = OrderGetString(ORDER_COMMENT);
        bool isRecovery = (StringFind(comment, "Recovery") >= 0);
        bool shouldDelete = false;
        string reason = "";
        
        // Check BUY LIMIT orders
        if(type == ORDER_TYPE_BUY_LIMIT)
        {
            // Normal buy orders: must be within buy range
            if(!isRecovery)
            {
                if(orderPrice < buyRangeLow || orderPrice > buyRangeHigh)
                {
                    shouldDelete = true;
                    reason = "Outside buy range";
                }
                // BUY LIMIT should be BELOW current price - if it's AT or ABOVE (within 0.5 pip), it will execute immediately
                // So we DON'T delete orders that are slightly above - they're valid pending orders
                // Only delete if order is somehow way above current price (shouldn't happen normally)
            }
            // Recovery orders: allow them to stay as long as they're reasonable
        }
        // Check SELL LIMIT orders
        else if(type == ORDER_TYPE_SELL_LIMIT)
        {
            // Normal sell orders: must be within sell range
            if(!isRecovery)
            {
                if(orderPrice < sellRangeLow || orderPrice > sellRangeHigh)
                {
                    shouldDelete = true;
                    reason = "Outside sell range";
                }
                // SELL LIMIT should be ABOVE current price - if it's AT or BELOW (within 0.5 pip), it will execute immediately
                // So we DON'T delete orders that are slightly below - they're valid pending orders
                // Only delete if order is somehow way below current price (shouldn't happen normally)
            }
            // Recovery orders: allow them to stay as long as they're reasonable
        }
        
        // Delete invalid order
        if(shouldDelete)
        {
            if(trade.OrderDelete(ticket))
            {
                AddToLog(StringFormat("Deleted invalid %s order #%I64u @ %.2f - %s", 
                    (type == ORDER_TYPE_BUY_LIMIT) ? "BUY" : "SELL", 
                    ticket, orderPrice, reason), "CLEANUP");
                deletedCount++;
            }
        }
    }
    
    // Check for duplicate orders (same price, same type)
    for(int i = 0; i < OrdersTotal() - 1; i++)
    {
        ulong ticket1 = OrderGetTicket(i);
        if(ticket1 <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE type1 = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        double price1 = OrderGetDouble(ORDER_PRICE_OPEN);
        
        // Check against all other orders
        for(int j = i + 1; j < OrdersTotal(); j++)
        {
            ulong ticket2 = OrderGetTicket(j);
            if(ticket2 <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            ENUM_ORDER_TYPE type2 = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            double price2 = OrderGetDouble(ORDER_PRICE_OPEN);
            
            // If same type and very close price (within 0.5 pips), delete the newer one
            if(type1 == type2 && MathAbs(price1 - price2) < 0.5 * pip)
            {
                if(trade.OrderDelete(ticket2))
                {
                    AddToLog(StringFormat("Deleted duplicate order #%I64u @ %.2f (duplicate of #%I64u)", 
                        ticket2, price2, ticket1), "CLEANUP");
                    deletedCount++;
                }
            }
        }
    }
    
    // Enforce max order limits - delete excess orders
    // Count normal orders for each side
    int normalBuyOrderCount = 0;
    int normalSellOrderCount = 0;
    
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue; // Skip recovery orders
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if(type == ORDER_TYPE_BUY_LIMIT) normalBuyOrderCount++;
        else if(type == ORDER_TYPE_SELL_LIMIT) normalSellOrderCount++;
    }
    
    // Count normal positions for each side
    int normalBuyPosCount = 0;
    int normalSellPosCount = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue; // Skip recovery positions
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if(type == POSITION_TYPE_BUY) normalBuyPosCount++;
        else if(type == POSITION_TYPE_SELL) normalSellPosCount++;
    }
    
    // Delete excess BUY orders (if total > max)
    int totalBuy = normalBuyPosCount + normalBuyOrderCount;
    if(totalBuy > MaxBuyOrders)
    {
        int toDelete = totalBuy - MaxBuyOrders;
        for(int i = OrdersTotal() - 1; i >= 0 && toDelete > 0; i--)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_BUY_LIMIT)
            {
                if(trade.OrderDelete(ticket))
                {
                    AddToLog(StringFormat("Deleted excess BUY order #%I64u (total=%d, max=%d)", 
                        ticket, totalBuy, MaxBuyOrders), "CLEANUP");
                    deletedCount++;
                    toDelete--;
                }
            }
        }
    }
    
    // Delete excess SELL orders (if total > max)
    int totalSell = normalSellPosCount + normalSellOrderCount;
    if(totalSell > MaxSellOrders)
    {
        int toDelete = totalSell - MaxSellOrders;
        for(int i = OrdersTotal() - 1; i >= 0 && toDelete > 0; i--)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_SELL_LIMIT)
            {
                if(trade.OrderDelete(ticket))
                {
                    AddToLog(StringFormat("Deleted excess SELL order #%I64u (total=%d, max=%d)", 
                        ticket, totalSell, MaxSellOrders), "CLEANUP");
                    deletedCount++;
                    toDelete--;
                }
            }
        }
    }
    
    // Log cleanup summary (only if orders were deleted)
    if(deletedCount > 0)
    {
        AddToLog(StringFormat("Cleanup completed: %d invalid orders deleted", deletedCount), "CLEANUP");
    }
}

//+------------------------------------------------------------------+
//| Recovery Cleanup Worker - Close remaining recovery positions      |
//| when normal positions are all gone and recovery count <= threshold|
//| This allows normal mode to restart fresh from 0.10 lot           |
//+------------------------------------------------------------------+
void RecoveryCleanupWorker()
{
    // Check BUY side
    RecoveryCleanupForSide(true);
    // Check SELL side
    RecoveryCleanupForSide(false);
}

void RecoveryCleanupForSide(bool isBuy)
{
    // Count normal and recovery positions for this side
    int normalCount = 0;
    int recoveryCount = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0)
            recoveryCount++;
        else
            normalCount++;
    }
    
    // Condition: NO normal positions left AND only recovery positions remain at or below threshold
    if(normalCount == 0 && recoveryCount > 0 && recoveryCount <= RecoveryCleanupThreshold)
    {
        // Profit-aware cleanup: calculate basket P/L before closing
        double basketProfit = 0;
        for(int j = 0; j < PositionsTotal(); j++)
        {
            ulong t = PositionGetTicket(j);
            if(t <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            ENUM_POSITION_TYPE pt = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && pt != POSITION_TYPE_BUY) || (!isBuy && pt != POSITION_TYPE_SELL)) continue;
            string c = PositionGetString(POSITION_COMMENT);
            if(StringFind(c, "Recovery") >= 0)
                basketProfit += PositionGetDouble(POSITION_PROFIT);
        }
        
        // Only close if basket is near breakeven or profitable (loss <= $5 acceptable)
        // This prevents forced negative cleanup — let trailing/TP handle it instead
        if(basketProfit < -5.0)
        {
            static datetime lastSkipLog = 0;
            if(TimeCurrent() - lastSkipLog > 30)
            {
                AddToLog(StringFormat("%s Recovery Cleanup SKIPPED: Basket P/L=$%.2f (waiting for near-breakeven)", 
                    isBuy ? "BUY" : "SELL", basketProfit), "CLEANUP");
                lastSkipLog = TimeCurrent();
            }
            return; // Don't close at a loss — wait for price to improve
        }
        
        AddToLog(StringFormat("%s Recovery Cleanup: Normal=%d, Recovery=%d (threshold=%d) BasketPnL=$%.2f - CLOSING to restart normal mode", 
            isBuy ? "BUY" : "SELL", normalCount, recoveryCount, RecoveryCleanupThreshold, basketProfit), "CLEANUP");
        
        // First: Delete all recovery pending orders for this side
        for(int i = OrdersTotal() - 1; i >= 0; i--)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") < 0) continue;
            
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if((isBuy && orderType == ORDER_TYPE_BUY_LIMIT) || (!isBuy && orderType == ORDER_TYPE_SELL_LIMIT))
            {
                if(trade.OrderDelete(ticket))
                {
                    AddToLog(StringFormat("%s Recovery Cleanup: Deleted pending order #%I64u", 
                        isBuy ? "BUY" : "SELL", ticket), "CLEANUP");
                }
            }
        }
        
        // Then: Close all recovery positions for this side
        for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "Recovery") >= 0)
            {
                double posLot = PositionGetDouble(POSITION_VOLUME);
                double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                double posProfit = PositionGetDouble(POSITION_PROFIT);
                
                if(trade.PositionClose(ticket))
                {
                    AddToLog(StringFormat("%s Recovery Cleanup: Closed position #%I64u | Lot=%.2f | Price=%.2f | Profit=%.2f", 
                        isBuy ? "BUY" : "SELL", ticket, posLot, posPrice, posProfit), "CLEANUP");
                }
            }
        }
        
        AddToLog(StringFormat("%s Recovery Cleanup COMPLETE - Normal mode will restart with fresh 0.10 lot grid", 
            isBuy ? "BUY" : "SELL"), "CLEANUP");
    }
}

//+------------------------------------------------------------------+
//| IsSideBlocked — single source of truth for skip/filter rules     |
//| Returns true if this side should have NO pending orders           |
//| Must mirror the exact same logic as OnTick grid branches          |
//| outReason is set to the reason for blocking (for logging)         |
//+------------------------------------------------------------------+
bool IsSideBlocked(bool isBuy, string &outReason)
{
    outReason = "";
    bool inRecovery = isBuy ? buyInRecovery : sellInRecovery;
    
    // Recovery mode bypasses equity skip & pip-based skip
    // But NOW waits for favorable trend (EMA) before placing new orders
    if(inRecovery)
    {
        if(g_NewEntriesBlocked && g_BlockCancelPending)
        {
            outReason = "Recovery hard block (" + g_BlockReason + ")";
            return true;
        }
        // Recovery waits for favorable trend — don't delete existing pendings though
        // IsSideBlocked is used by SkipEnforcementWorker which deletes pendings
        // We return false here because we want to KEEP existing recovery pendings alive
        // (ManageRecoveryGrid just won't place NEW ones during counter-trend)
        return false;
    }
    
    // Normal mode checks (in priority order, matching OnTick branches)
    
    // 1. Master block with cancel pending (hard block)
    if(g_NewEntriesBlocked && g_BlockCancelPending)
    {
        outReason = "Hard block (" + g_BlockReason + ")";
        return true;
    }
    
    // 2. Master block without cancel (soft block) — pendings stay alive
    if(g_NewEntriesBlocked)
        return false; // Soft block = pendings stay
    
    // 3. Trend skip (pip-based or equity-based)
    if(isBuy && skipBuyGrid)
    {
        outReason = "BUY skip active (trend/equity)";
        return true;
    }
    if(!isBuy && skipSellGrid)
    {
        outReason = "SELL skip active (trend/equity)";
        return true;
    }
    
    // 4. EMA trend filter (with equity-skip bypass)
    if(isBuy && IsTrendFiltered(true) && !skipSellGrid)
    {
        outReason = "EMA bearish — BUY filtered";
        return true;
    }
    if(!isBuy && IsTrendFiltered(false) && !skipBuyGrid)
    {
        outReason = "EMA bullish — SELL filtered";
        return true;
    }
    
    return false; // Side is clear to trade
}

//+------------------------------------------------------------------+
//| Skip Enforcement Worker — safety net for pending order cleanup    |
//| Runs every tick AFTER all state flags are set.                    |
//| Deletes any pending orders that violate current skip/EMA/block    |
//| rules. Acts as a catch-all in case the main grid branches miss    |
//| a deletion (e.g. race conditions, EA restart, mode transitions).  |
//+------------------------------------------------------------------+
void SkipEnforcementWorker()
{
    string buyReason = "", sellReason = "";
    bool buyBlocked = IsSideBlocked(true, buyReason);
    bool sellBlocked = IsSideBlocked(false, sellReason);
    
    // Nothing to enforce if both sides are clear
    if(!buyBlocked && !sellBlocked) return;
    
    int deletedBuy = 0, deletedSell = 0;
    
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        
        // BUY side blocked — delete all BUY pending orders
        if(buyBlocked && (type == ORDER_TYPE_BUY_LIMIT || type == ORDER_TYPE_BUY_STOP))
        {
            if(trade.OrderDelete(ticket))
                deletedBuy++;
        }
        // SELL side blocked — delete all SELL pending orders
        else if(sellBlocked && (type == ORDER_TYPE_SELL_LIMIT || type == ORDER_TYPE_SELL_STOP))
        {
            if(trade.OrderDelete(ticket))
                deletedSell++;
        }
    }
    
    // Log enforcement actions (throttled to avoid spam)
    static datetime lastEnforceLog = 0;
    if((deletedBuy > 0 || deletedSell > 0) && TimeCurrent() - lastEnforceLog > 5)
    {
        lastEnforceLog = TimeCurrent();
        if(deletedBuy > 0)
            AddToLog(StringFormat("ENFORCE: Deleted %d BUY pending(s) — %s", deletedBuy, buyReason), "ENFORCE");
        if(deletedSell > 0)
            AddToLog(StringFormat("ENFORCE: Deleted %d SELL pending(s) — %s", deletedSell, sellReason), "ENFORCE");
    }
}

//+------------------------------------------------------------------+
//| Self-Healing Grid Worker - Detects and fixes grid issues         |
//| after reconnect, EA restart, or any disruption                   |
//+------------------------------------------------------------------+
void AutoCorrectGridOrders()
{
    // Run every 5 seconds to avoid overloading (not every tick)
    static datetime lastHealCheck = 0;
    if(TimeCurrent() - lastHealCheck < 5) return;
    lastHealCheck = TimeCurrent();
    
    double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // ===== FIX 1: Delete invalid pending orders (wrong side of market) =====
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
        
        bool invalid = false;
        string reason = "";
        
        // BUY LIMIT must be BELOW current ask
        if(type == ORDER_TYPE_BUY_LIMIT && orderPrice > currentAsk + 50 * pip)
        {
            invalid = true;
            reason = StringFormat("BUY LIMIT @ %.2f is way above Ask %.2f", orderPrice, currentAsk);
        }
        // SELL LIMIT must be ABOVE current bid
        if(type == ORDER_TYPE_SELL_LIMIT && orderPrice < currentBid - 50 * pip)
        {
            invalid = true;
            reason = StringFormat("SELL LIMIT @ %.2f is way below Bid %.2f", orderPrice, currentBid);
        }
        
        if(invalid)
        {
            if(trade.OrderDelete(ticket))
            {
                AddToLog(StringFormat("SelfHeal: Deleted invalid order #%I64u - %s", ticket, reason), "HEAL");
            }
        }
    }
    
    // ===== FIX 2: Normal mode - ensure correct number of pending orders =====
    GridHealthCheckNormal(true,  currentBid, currentAsk);  // BUY side
    GridHealthCheckNormal(false, currentBid, currentAsk);  // SELL side
    
    // ===== FIX 3: Recovery mode - ensure recovery pending order exists =====
    GridHealthCheckRecovery(true,  currentBid, currentAsk);  // BUY side
    GridHealthCheckRecovery(false, currentBid, currentAsk);  // SELL side
    
    // ===== FIX 4: Ensure all recovery positions have correct TP =====
    FixMissingRecoveryTP(true);   // BUY side
    FixMissingRecoveryTP(false);  // SELL side
}

//+------------------------------------------------------------------+
//| Normal mode health check - detect and log missing orders         |
//+------------------------------------------------------------------+
void GridHealthCheckNormal(bool isBuy, double currentBid, double currentAsk)
{
    bool inRecovery = isBuy ? buyInRecovery : sellInRecovery;
    if(inRecovery) return;  // Skip if in recovery mode
    
    // Don't report missing orders if this side is intentionally blocked
    string blockReason = "";
    if(IsSideBlocked(isBuy, blockReason)) return;
    
    int maxOrders = isBuy ? MaxBuyOrders : MaxSellOrders;
    double rangeHigh = isBuy ? MathMax(BuyRangeStart, BuyRangeEnd) : MathMax(SellRangeStart, SellRangeEnd);
    double rangeLow  = isBuy ? MathMin(BuyRangeStart, BuyRangeEnd) : MathMin(SellRangeStart, SellRangeEnd);
    double checkPrice = isBuy ? currentAsk : currentBid;
    
    if(checkPrice < rangeLow || checkPrice > rangeHigh) return; // Outside range
    
    // Count normal positions
    int normalPosCount = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
            normalPosCount++;
    }
    
    // Count normal pending orders
    int normalOrderCount = 0;
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            normalOrderCount++;
    }
    
    int totalGrid = normalPosCount + normalOrderCount;
    int expectedOrders = maxOrders - normalPosCount;
    
    // If orders are missing, log it - ManageNormalGrid will fix on next tick
    if(normalOrderCount < expectedOrders && expectedOrders > 0)
    {
        static datetime lastBuyNormalHeal = 0;
        static datetime lastSellNormalHeal = 0;
        datetime lastHeal = isBuy ? lastBuyNormalHeal : lastSellNormalHeal;
        
        if(TimeCurrent() - lastHeal > 15)
        {
            AddToLog(StringFormat("%s SelfHeal: Grid incomplete - Pos:%d Orders:%d Total:%d/%d - ManageNormalGrid will re-place %d orders", 
                isBuy ? "BUY" : "SELL", normalPosCount, normalOrderCount, totalGrid, maxOrders, 
                expectedOrders - normalOrderCount), "HEAL");
            
            if(isBuy) lastBuyNormalHeal = TimeCurrent();
            else lastSellNormalHeal = TimeCurrent();
        }
    }
}

//+------------------------------------------------------------------+
//| Recovery mode health check - detect missing recovery orders      |
//+------------------------------------------------------------------+
void GridHealthCheckRecovery(bool isBuy, double currentBid, double currentAsk)
{
    bool inRecovery = isBuy ? buyInRecovery : sellInRecovery;
    if(!inRecovery) return;  // Skip if not in recovery mode
    if(!EnableRecovery) return;
    
    // Don't report missing recovery orders if hard-blocked
    string blockReason = "";
    if(IsSideBlocked(isBuy, blockReason)) return;
    
    // Count recovery pending orders
    int recoveryOrderCount = 0;
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") < 0) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            recoveryOrderCount++;
    }
    
    // Count total positions this side
    int totalPositions = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
            totalPositions++;
    }
    
    // If no recovery pending order exists and we haven't hit max, log it
    // ManageRecoveryGrid will place the order on next tick
    if(recoveryOrderCount == 0 && totalPositions < MaxRecoveryOrders)
    {
        static datetime lastBuyRecHeal = 0;
        static datetime lastSellRecHeal = 0;
        datetime lastHeal = isBuy ? lastBuyRecHeal : lastSellRecHeal;
        
        if(TimeCurrent() - lastHeal > 15)
        {
            AddToLog(StringFormat("%s SelfHeal: Recovery mode but NO pending order! Positions:%d/%d - ManageRecoveryGrid will re-place", 
                isBuy ? "BUY" : "SELL", totalPositions, MaxRecoveryOrders), "HEAL");
            
            if(isBuy) lastBuyRecHeal = TimeCurrent();
            else lastSellRecHeal = TimeCurrent();
        }
    }
}

//+------------------------------------------------------------------+
//| Fix missing TP on recovery positions                             |
//+------------------------------------------------------------------+
void FixMissingRecoveryTP(bool isBuy)
{
    bool inRecovery = isBuy ? buyInRecovery : sellInRecovery;
    if(!inRecovery) return;
    
    // Calculate breakeven TP
    double avgPrice = 0, totalLots = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        avgPrice += PositionGetDouble(POSITION_PRICE_OPEN) * PositionGetDouble(POSITION_VOLUME);
        totalLots += PositionGetDouble(POSITION_VOLUME);
    }
    
    if(totalLots == 0) return;
    avgPrice = avgPrice / totalLots;
    double breakevenTP = isBuy ? 
        NormalizeDouble(avgPrice + (RecoveryTakeProfitPips * pip), _Digits) :
        NormalizeDouble(avgPrice - (RecoveryTakeProfitPips * pip), _Digits);
    
    // Check each NON-BUNDLED recovery position for missing/wrong TP
    // Bundled positions have their own TP managed by the bundle system
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        // SKIP bundled positions - they have bundle-specific TP
        if(IsTicketInAnyBundle(isBuy, ticket)) continue;
        
        double currentTP = PositionGetDouble(POSITION_TP);
        
        // If TP is missing (0) or significantly wrong (>1 pip difference)
        if(currentTP == 0 || MathAbs(currentTP - breakevenTP) > 1.0 * pip)
        {
            double currentSL = PositionGetDouble(POSITION_SL);
            double valSL = currentSL, valTP = breakevenTP;
            ValidateStopsForPosition(isBuy, valSL, valTP);
            if(valTP > 0 && trade.PositionModify(ticket, valSL, valTP))
            {
                AddToLog(StringFormat("%s SelfHeal: Fixed TP on position #%I64u | Old TP=%.2f | New TP=%.2f", 
                    isBuy ? "BUY" : "SELL", ticket, currentTP, valTP), "HEAL");
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Manage Normal Grid - STRICT GAP ENFORCEMENT                       |
//+------------------------------------------------------------------+
void ManageNormalGrid(bool isBuy)
{
    // SAFETY CHECK: Should not be called in recovery mode
    bool inRecoveryMode = isBuy ? buyInRecovery : sellInRecovery;
    if(inRecoveryMode)
    {
        AddToLog(StringFormat("ERROR: ManageNormalGrid called while in %s recovery mode!", isBuy ? "BUY" : "SELL"), "ERROR");
        return;
    }
    
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
    
    // Range settings
    double rangeHigh = isBuy ? MathMax(BuyRangeStart, BuyRangeEnd) : MathMax(SellRangeStart, SellRangeEnd);
    double rangeLow = isBuy ? MathMin(BuyRangeStart, BuyRangeEnd) : MathMin(SellRangeStart, SellRangeEnd);
    double gapPips = GetATRGridGap(isBuy); // ATR-based dynamic gap (falls back to static if disabled)
    int maxOrders = isBuy ? MaxBuyOrders : MaxSellOrders;
    double gapPrice = gapPips * pip;
    double minGap = gapPrice * 0.8; // Minimum 80% of gap required between positions/orders
    
    // Check if current price is within trading range
    if(currentPrice < rangeLow || currentPrice > rangeHigh)
    {
        AddToLog(StringFormat("%s Grid: Price %.2f outside range [%.2f - %.2f]", 
            isBuy ? "BUY" : "SELL", currentPrice, rangeLow, rangeHigh), "GRID");
        return;
    }
    
    AddToLog(StringFormat("%s Grid: Price %.2f in range, managing grid...", 
        isBuy ? "BUY" : "SELL", currentPrice), "GRID");
    
    // ===== STEP 1: Collect ONLY NORMAL positions for this side =====
    double positionPrices[];
    int normalPositionCount = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && posType != POSITION_TYPE_BUY) || (!isBuy && posType != POSITION_TYPE_SELL)) continue;
        
        // ONLY count NORMAL positions (skip recovery positions)
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue;
        
        ArrayResize(positionPrices, normalPositionCount + 1);
        positionPrices[normalPositionCount] = PositionGetDouble(POSITION_PRICE_OPEN);
        normalPositionCount++;
    }
    
    // If already at max NORMAL positions, delete all normal pending orders and return
    if(normalPositionCount >= maxOrders)
    {
        for(int i = OrdersTotal() - 1; i >= 0; i--)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if((isBuy && orderType == ORDER_TYPE_BUY_LIMIT) || (!isBuy && orderType == ORDER_TYPE_SELL_LIMIT))
            {
                trade.OrderDelete(ticket);
            }
        }
        return;
    }
    
    // ===== STEP 2: Collect existing pending orders and check if they need modification =====
    ulong existingOrderTickets[];
    double existingOrderPrices[];
    double existingOrderLots[];
    int existingOrderCount = 0;
    
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue;
        
        ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && orderType != ORDER_TYPE_BUY_LIMIT) || (!isBuy && orderType != ORDER_TYPE_SELL_LIMIT)) continue;
        
        ArrayResize(existingOrderTickets, existingOrderCount + 1);
        ArrayResize(existingOrderPrices, existingOrderCount + 1);
        ArrayResize(existingOrderLots, existingOrderCount + 1);
        existingOrderTickets[existingOrderCount] = ticket;
        existingOrderPrices[existingOrderCount] = OrderGetDouble(ORDER_PRICE_OPEN);
        existingOrderLots[existingOrderCount] = OrderGetDouble(ORDER_VOLUME_CURRENT);
        existingOrderCount++;
    }

    // Expected lot for normal pending orders (self-heal lot mismatch)
    double expectedMinLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double expectedMaxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double expectedLotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    if(expectedMinLot <= 0) expectedMinLot = 0.01;
    if(expectedMaxLot <= 0) expectedMaxLot = 100.0;
    if(expectedLotStep <= 0) expectedLotStep = 0.01;
    double expectedNormalLot = LotSize;
    expectedNormalLot = MathFloor(expectedNormalLot / expectedLotStep) * expectedLotStep;
    expectedNormalLot = MathMax(expectedMinLot, MathMin(expectedMaxLot, expectedNormalLot));
    
    // Delete orders that are too close to NORMAL positions
    for(int i = existingOrderCount - 1; i >= 0; i--)
    {
        bool tooClose = false;
        for(int j = 0; j < normalPositionCount; j++)
        {
            if(MathAbs(existingOrderPrices[i] - positionPrices[j]) < minGap)
            {
                tooClose = true;
                break;
            }
        }
        
        if(tooClose)
        {
            trade.OrderDelete(existingOrderTickets[i]);
            // Remove from arrays
            for(int k = i; k < existingOrderCount - 1; k++)
            {
                existingOrderTickets[k] = existingOrderTickets[k + 1];
                existingOrderPrices[k] = existingOrderPrices[k + 1];
            }
            existingOrderCount--;
        }
    }
    
    // ===== STEP 3: Calculate valid grid levels using FIXED LATTICE =====
    // Grid is a fixed lattice: rangeLow, rangeLow+gap, rangeLow+2*gap, ...
    // We pick levels on the correct side of price, not occupied by positions.
    // This prevents target levels from shifting every tick and causing order escaping.
    
    // Build all fixed grid levels within range
    double allGridLevels[];
    int allGridCount = 0;
    for(double lvl = rangeLow; lvl <= rangeHigh + gapPrice * 0.1; lvl += gapPrice)
    {
        double gridLvl = NormalizeDouble(lvl, _Digits);
        if(gridLvl < rangeLow || gridLvl > rangeHigh) continue;
        
        // Must be on the correct side of current price
        if(isBuy && gridLvl >= currentPrice) continue;   // BUY LIMIT must be below price
        if(!isBuy && gridLvl <= currentPrice) continue;   // SELL LIMIT must be above price
        
        // Must not be too close to any existing NORMAL position
        bool tooCloseToPos = false;
        for(int p = 0; p < normalPositionCount; p++)
        {
            if(MathAbs(gridLvl - positionPrices[p]) < minGap)
            {
                tooCloseToPos = true;
                break;
            }
        }
        if(tooCloseToPos) continue;
        
        ArrayResize(allGridLevels, allGridCount + 1);
        allGridLevels[allGridCount] = gridLvl;
        allGridCount++;
    }
    
    // Sort by distance to market (closest first)
    for(int i = 0; i < allGridCount - 1; i++)
    {
        for(int j = i + 1; j < allGridCount; j++)
        {
            double distI = MathAbs(allGridLevels[i] - currentPrice);
            double distJ = MathAbs(allGridLevels[j] - currentPrice);
            if(distJ < distI)
            {
                double tmp = allGridLevels[i];
                allGridLevels[i] = allGridLevels[j];
                allGridLevels[j] = tmp;
            }
        }
    }
    
    // Take up to (maxOrders - normalPositionCount) closest levels as targets
    int slotsNeeded = maxOrders - normalPositionCount;
    if(slotsNeeded < 0) slotsNeeded = 0;
    int targetCount = MathMin(slotsNeeded, allGridCount);
    
    double targetLevels[];
    ArrayResize(targetLevels, targetCount);
    for(int i = 0; i < targetCount; i++)
    {
        targetLevels[i] = allGridLevels[i];
    }
    
    int maxTargets = targetCount;  // actual number of targets (replaces maxOrders in loops below)
    
    // ===== STEP 4: Match existing orders to target levels =====
    // With fixed lattice, orders at grid points stay put. Only match/modify if needed.
    bool targetOccupied[];
    ArrayResize(targetOccupied, maxTargets);
    ArrayInitialize(targetOccupied, false);
    
    bool orderUsed[];
    ArrayResize(orderUsed, existingOrderCount);
    ArrayInitialize(orderUsed, false);
    
    // Match existing orders to targets (closest pairing)
    for(int i = 0; i < maxTargets; i++)
    {
        double targetPrice = targetLevels[i];
        
        // Find closest unused order to this target
        int closestOrderIdx = -1;
        double closestDistance = 999999;
        
        for(int j = 0; j < existingOrderCount; j++)
        {
            if(orderUsed[j]) continue;
            double distance = MathAbs(existingOrderPrices[j] - targetPrice);
            if(distance < closestDistance)
            {
                closestDistance = distance;
                closestOrderIdx = j;
            }
        }
        
        if(closestOrderIdx < 0) continue;
        
        // Order is already at correct grid level (within tolerance) — keep it
        if(closestDistance < minGap)
        {
            bool lotAligned = MathAbs(existingOrderLots[closestOrderIdx] - expectedNormalLot) <= expectedLotStep * 0.5;
            if(lotAligned)
            {
                targetOccupied[i] = true;
                orderUsed[closestOrderIdx] = true;
            }
        }
    }
    
    // Cleanup: delete unused orders that are NOT on a valid fixed grid point,
    // or have wrong side/range/lot. Orders sitting on a valid grid point on the
    // correct side are kept even if not in targetLevels (price moved toward them).
    double furthestTargetDistance = -1.0;
    if(maxTargets > 0)
    {
        furthestTargetDistance = MathAbs(targetLevels[maxTargets - 1] - currentPrice);
    }
    for(int i = 0; i < existingOrderCount; i++)
    {
        if(orderUsed[i]) continue;
        
        double orderPrice = existingOrderPrices[i];
        double orderLot = existingOrderLots[i];
        bool validSide = isBuy ? (orderPrice <= currentPrice + (_Point * 0.5)) : (orderPrice >= currentPrice - (_Point * 0.5));
        bool inRange = (orderPrice >= rangeLow && orderPrice <= rangeHigh);
        bool lotAligned = MathAbs(orderLot - expectedNormalLot) <= expectedLotStep * 0.5;
        double orderDistance = MathAbs(orderPrice - currentPrice);
        
        // Check if order sits on ANY fixed grid point (not just current targets)
        bool onGridPoint = false;
        double remainder = MathMod(MathAbs(orderPrice - rangeLow), gapPrice);
        if(remainder < minGap * 0.5 || MathAbs(remainder - gapPrice) < minGap * 0.5)
            onGridPoint = true;
        
        bool insideCurrentTargetBand = (maxTargets > 0 && orderDistance <= furthestTargetDistance + (_Point * 0.5));
        
        // Also check it's not too close to a position
        bool tooCloseToPos = false;
        for(int p = 0; p < normalPositionCount; p++)
        {
            if(MathAbs(orderPrice - positionPrices[p]) < minGap)
            {
                tooCloseToPos = true;
                break;
            }
        }
        
        if(!validSide || !inRange || !lotAligned || tooCloseToPos)
        {
            trade.OrderDelete(existingOrderTickets[i]);
            string reason = !validSide ? "wrong side" : (!inRange ? "out of range" : (!lotAligned ? "lot mismatch" : "too close to position"));
            AddToLog(StringFormat("%s order #%I64u deleted - %s (price=%.2f)", isBuy ? "BUY" : "SELL",
                existingOrderTickets[i], reason, orderPrice), "MODIFY");
        }
        else if(onGridPoint && insideCurrentTargetBand)
        {
            // Order is on-grid and still within the current target band — keep it.
            // This protects near-price orders while still allowing far stale orders to migrate closer.
            orderUsed[i] = true;
            AddToLog(StringFormat("%s order #%I64u kept at %.2f (on-grid, awaiting trigger)", 
                isBuy ? "BUY" : "SELL", existingOrderTickets[i], orderPrice), "GRID");
        }
        else if(onGridPoint)
        {
            trade.OrderDelete(existingOrderTickets[i]);
            AddToLog(StringFormat("%s order #%I64u deleted - stale far grid order (price=%.2f)", isBuy ? "BUY" : "SELL",
                existingOrderTickets[i], orderPrice), "MODIFY");
        }
        else
        {
            // Off-grid order — delete so it can be re-placed correctly
            trade.OrderDelete(existingOrderTickets[i]);
            AddToLog(StringFormat("%s order #%I64u deleted - off-grid (price=%.2f)", isBuy ? "BUY" : "SELL",
                existingOrderTickets[i], orderPrice), "MODIFY");
        }
    }
    
    // ===== STEP 5: Count ALL surviving valid orders (matched + kept-on-grid) =====
    // This prevents churn: if we already have enough on-grid orders, don't place more
    // even if the exact target set shifted due to price movement.
    int survivingOrderCount = 0;
    for(int i = 0; i < existingOrderCount; i++)
    {
        if(orderUsed[i]) survivingOrderCount++;
    }
    
    int ordersNeeded = slotsNeeded - survivingOrderCount;
    
    if(ordersNeeded <= 0) 
    {
        AddToLog(StringFormat("%s Normal Grid: %d positions, %d surviving orders, %d slots needed, no new orders needed", 
            isBuy ? "BUY" : "SELL", normalPositionCount, survivingOrderCount, slotsNeeded), "GRID");
        return;
    }
    
    AddToLog(StringFormat("%s Normal Grid: %d positions, %d surviving orders, %d slots needed, placing %d new orders", 
        isBuy ? "BUY" : "SELL", normalPositionCount, survivingOrderCount, slotsNeeded, ordersNeeded), "GRID");
    
    // ===== STEP 6: Place new orders at unoccupied target levels =====
    int ordersPlaced = 0;
    
    for(int i = 0; i < maxTargets && ordersPlaced < ordersNeeded; i++)
    {
        // Skip if this target is already occupied
        if(targetOccupied[i]) continue;
        
        double targetPrice = targetLevels[i];
        
        // Skip if any surviving on-grid order is already near this target
        // (covers the case where an order was kept-on-grid but not matched to THIS target)
        bool nearbyOrderExists = false;
        for(int j = 0; j < existingOrderCount; j++)
        {
            if(!orderUsed[j]) continue; // only check surviving orders
            if(MathAbs(existingOrderPrices[j] - targetPrice) < minGap)
            {
                nearbyOrderExists = true;
                break;
            }
        }
        if(nearbyOrderExists) continue;
        
        // ===== All checks passed - Place the order =====
        double lotToUse = LotSize;
        double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
        double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
        double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
        if(minLot <= 0) minLot = 0.01;
        if(maxLot <= 0) maxLot = 100.0;
        if(lotStep <= 0) lotStep = 0.01;
        lotToUse = MathFloor(lotToUse / lotStep) * lotStep;
        lotToUse = MathMax(minLot, MathMin(maxLot, lotToUse));
        
        double tp = 0, sl = 0;
        
        if(isBuy)
        {
            tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(targetPrice + (BuyTakeProfitPips * pip), _Digits) : 0;
            sl = (BuyStopLossPips > 0) ? NormalizeDouble(targetPrice - (BuyStopLossPips * pip), _Digits) : 0;
            ValidateStops(true, targetPrice, sl, tp);
            if(trade.BuyLimit(lotToUse, targetPrice, _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
            {
                AddToLog(StringFormat("BUY LIMIT @ %.2f | Lot: %.2f", targetPrice, lotToUse), "OPEN_BUY");
                ordersPlaced++;
            }
        }
        else
        {
            tp = (SellTakeProfitPips > 0) ? NormalizeDouble(targetPrice - (SellTakeProfitPips * pip), _Digits) : 0;
            sl = (SellStopLossPips > 0) ? NormalizeDouble(targetPrice + (SellStopLossPips * pip), _Digits) : 0;
            ValidateStops(false, targetPrice, sl, tp);
            if(trade.SellLimit(lotToUse, targetPrice, _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
            {
                AddToLog(StringFormat("SELL LIMIT @ %.2f | Lot: %.2f", targetPrice, lotToUse), "OPEN_SELL");
                ordersPlaced++;
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Manage Recovery Grid                                              |
//+------------------------------------------------------------------+
void ManageRecoveryGrid(bool isBuy)
{
    // Calculate average price and breakeven TP
    double avgPrice = 0, totalLots = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        
        avgPrice += openPrice * lots;
        totalLots += lots;
    }
    
    if(totalLots == 0) return;
    
    avgPrice = avgPrice / totalLots;
    double breakevenTP = isBuy ? 
        NormalizeDouble(avgPrice + (RecoveryTakeProfitPips * pip), _Digits) :
        NormalizeDouble(avgPrice - (RecoveryTakeProfitPips * pip), _Digits);
    
    // Count recovery FILLED positions
    int recoveryFilledCount = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0)
        {
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
                recoveryFilledCount++;
        }
    }
    
    // Find CLOSEST position to current market price for pending order validation
    double currentPriceForCheck = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double closestPriceForCheck = 0;
    double closestDistForCheck = 999999;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double dist = MathAbs(openPrice - currentPriceForCheck);
        
        if(dist < closestDistForCheck)
        {
            closestDistForCheck = dist;
            closestPriceForCheck = openPrice;
        }
    }
    
    double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    if(lotStep <= 0) lotStep = 0.01;
    
    // Calculate expected recovery price based on CLOSEST position
    // Then find first empty slot (skip prices where positions already exist)
    // Use ATR-based gap for recovery too (wider gap in volatile markets)
    double gapPips = GetATRGridGap(isBuy);
    double expectedRecoveryPrice = isBuy ?
        NormalizeDouble(closestPriceForCheck - (gapPips * pip), _Digits) :
        NormalizeDouble(closestPriceForCheck + (gapPips * pip), _Digits);
    
    // Adjust if expected price is invalid
    if(isBuy && expectedRecoveryPrice >= currentPriceForCheck)
        expectedRecoveryPrice = NormalizeDouble(currentPriceForCheck - (gapPips * pip), _Digits);
    if(!isBuy && expectedRecoveryPrice <= currentPriceForCheck)
        expectedRecoveryPrice = NormalizeDouble(currentPriceForCheck + (gapPips * pip), _Digits);
    
    // Find first empty slot (skip prices where positions already exist)
    double gapPriceForSlot = gapPips * pip;
    for(int slotAttempt = 0; slotAttempt < 50; slotAttempt++)
    {
        bool occupied = false;
        for(int p = 0; p < PositionsTotal(); p++)
        {
            ulong pTicket = PositionGetTicket(p);
            if(pTicket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && pType != POSITION_TYPE_BUY) || (!isBuy && pType != POSITION_TYPE_SELL)) continue;
            if(MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - expectedRecoveryPrice) < gapPriceForSlot * 0.5)
            {
                occupied = true;
                break;
            }
        }
        if(!occupied) break;
        if(isBuy) expectedRecoveryPrice = NormalizeDouble(expectedRecoveryPrice - gapPriceForSlot, _Digits);
        else expectedRecoveryPrice = NormalizeDouble(expectedRecoveryPrice + gapPriceForSlot, _Digits);
    }

    // Calculate what recovery pending lot SHOULD be for current expected slot
    double expectedMinLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double expectedMaxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    if(expectedMinLot <= 0) expectedMinLot = 0.01;
    if(expectedMaxLot <= 0) expectedMaxLot = 100.0;
    double expectedEffectiveMaxLot = MathMin(expectedMaxLot, MaxRecoveryLotSize);

    double adjacentLotForExpected = LotSize;
    double adjacentDistForExpected = 999999;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;

        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;

        double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double posLot = PositionGetDouble(POSITION_VOLUME);

        if(isBuy && posPrice > expectedRecoveryPrice)
        {
            double d = posPrice - expectedRecoveryPrice;
            if(d < adjacentDistForExpected)
            {
                adjacentDistForExpected = d;
                adjacentLotForExpected = posLot;
            }
        }
        else if(!isBuy && posPrice < expectedRecoveryPrice)
        {
            double d = expectedRecoveryPrice - posPrice;
            if(d < adjacentDistForExpected)
            {
                adjacentDistForExpected = d;
                adjacentLotForExpected = posLot;
            }
        }
    }

    double correctRecoveryLot = adjacentLotForExpected + RecoveryLotIncrement;
    correctRecoveryLot = MathFloor(correctRecoveryLot / lotStep) * lotStep;
    correctRecoveryLot = MathMax(expectedMinLot, MathMin(expectedEffectiveMaxLot, correctRecoveryLot));
    
    // Count recovery PENDING orders AND relocate if too far from expected price
    int recoveryPendingCount = 0;
    double gapPipsForRelocate = GetATRGridGap(isBuy); // ATR-aware relocation threshold
    double relocateThreshold = gapPipsForRelocate * pip * 0.6; // Keep pending tightly snapped to grid
    
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") >= 0)
        {
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            {
                double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                double orderLot = OrderGetDouble(ORDER_VOLUME_CURRENT);

                // Recovery pending must stay on valid side of market
                bool validSide = isBuy ? (orderPrice <= currentPriceForCheck + (_Point * 0.5)) : (orderPrice >= currentPriceForCheck - (_Point * 0.5));
                if(!validSide)
                {
                    trade.OrderDelete(ticket);
                    AddToLog(StringFormat("%s Recovery DELETED order #%I64u (wrong side of market @ %.2f, will re-place)",
                        isBuy ? "BUY" : "SELL", ticket, orderPrice), "RECOVERY");
                    continue;
                }

                // Recovery pending lot must match current expected lot profile
                if(MathAbs(orderLot - correctRecoveryLot) > lotStep * 0.5)
                {
                    trade.OrderDelete(ticket);
                    AddToLog(StringFormat("%s Recovery DELETED order #%I64u (lot mismatch %.2f vs expected %.2f, will re-place)",
                        isBuy ? "BUY" : "SELL", ticket, orderLot, correctRecoveryLot), "RECOVERY");
                    continue;
                }
                
                // Check if this pending order is too far from expected recovery price
                double distFromExpected = MathAbs(orderPrice - expectedRecoveryPrice);
                
                if(distFromExpected > relocateThreshold)
                {
                    // Order is stale/far away - relocate it to the correct price
                    double newPrice = expectedRecoveryPrice;
                    
                    // Validate new price for pending order
                    if(isBuy && newPrice >= currentPriceForCheck)
                        newPrice = NormalizeDouble(currentPriceForCheck - (gapPipsForRelocate * pip), _Digits);
                    if(!isBuy && newPrice <= currentPriceForCheck)
                        newPrice = NormalizeDouble(currentPriceForCheck + (gapPipsForRelocate * pip), _Digits);
                    
                    // Recalculate TP based on new avg if positions changed
                    double newTP = breakevenTP;
                    
                    // Calculate SL for relocated recovery order
                    double relocSL = 0;
                    if(isBuy && BuyStopLossPips > 0)
                        relocSL = NormalizeDouble(newPrice - (BuyStopLossPips * pip), _Digits);
                    else if(!isBuy && SellStopLossPips > 0)
                        relocSL = NormalizeDouble(newPrice + (SellStopLossPips * pip), _Digits);
                    
                    ValidateStops(isBuy, newPrice, relocSL, newTP);
                    
                    if(trade.OrderModify(ticket, newPrice, relocSL, newTP, ORDER_TIME_GTC, 0))
                    {
                        AddToLog(StringFormat("%s Recovery RELOCATED pending order #%I64u: %.2f -> %.2f (was %.1f pips from expected)", 
                            isBuy ? "BUY" : "SELL", ticket, orderPrice, newPrice, distFromExpected / pip), "RECOVERY");
                    }
                    else
                    {
                        // If modify fails (e.g. price too close to market), delete and let it re-place
                        int err = GetLastError();
                        if(err == 10016 || err == 10015 || err == 10014) // Invalid stops/price
                        {
                            trade.OrderDelete(ticket);
                            AddToLog(StringFormat("%s Recovery DELETED stale order #%I64u (modify failed err=%d, will re-place)", 
                                isBuy ? "BUY" : "SELL", ticket, err), "RECOVERY");
                            continue; // Don't count this deleted order
                        }
                    }
                }
                
                recoveryPendingCount++;
            }
        }
    }
    
    int totalRecoveryCount = recoveryFilledCount + recoveryPendingCount;
    
    // Count ALL positions (normal + recovery) for this side
    int totalPositionsThisSide = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
            totalPositionsThisSide++;
    }
    
    // Debug: Log recovery status every 10 seconds
    static datetime lastBuyStatusLog = 0;
    static datetime lastSellStatusLog = 0;
    datetime lastStatusLog = isBuy ? lastBuyStatusLog : lastSellStatusLog;
    if(TimeCurrent() - lastStatusLog > 10)
    {
        AddToLog(StringFormat("%s Recovery Status | Positions: %d/%d | Pending: %d | Enabled: %s", 
            isBuy ? "BUY" : "SELL", totalPositionsThisSide, MaxRecoveryOrders, 
            recoveryPendingCount, EnableRecovery ? "YES" : "NO"), "RECOVERY");
        if(isBuy) lastBuyStatusLog = TimeCurrent();
        else lastSellStatusLog = TimeCurrent();
    }
    
    // Place recovery order if needed (only 1 pending at a time, max total positions = MaxRecoveryOrders)
    // Added: IsRecoverySafe() checks lots cap, floating loss cap, margin, cooldown
    string safetyReason = "";
    if(totalPositionsThisSide < MaxRecoveryOrders && recoveryPendingCount == 0 && EnableRecovery && IsRecoverySafe(isBuy, safetyReason))
    {
        double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
        double gapPips = GetATRGridGap(isBuy); // ATR-based dynamic gap for recovery placement too
        
        // ===== NEW LOGIC =====
        // 1. Find TOP DISTANCE LOSS position (highest BUY price / lowest SELL price - most loss)
        // 2. Find CLOSEST position to current market price
        // 3. Place recovery order below/above the CLOSEST position
        // 4. Lot = closest position's lot + increment
        // This ensures grid continues from where market is, targeting top loss position
        
        double topDistancePrice = isBuy ? 0 : 999999;  // Top loss position (furthest from profit)
        double closestPrice = isBuy ? 999999 : 0;      // Closest to current market
        double closestDistance = 999999;
        
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
            
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            
            // Find TOP DISTANCE position (highest loss)
            // BUY: highest price = most loss when price goes down
            // SELL: lowest price = most loss when price goes up
            if((isBuy && openPrice > topDistancePrice) || (!isBuy && openPrice < topDistancePrice))
            {
                topDistancePrice = openPrice;
            }
            
            // Find CLOSEST position to current market price
            double distance = MathAbs(openPrice - currentPrice);
            if(distance < closestDistance)
            {
                closestDistance = distance;
                closestPrice = openPrice;
            }
        }
        
        // Safety check
        if((isBuy && topDistancePrice <= 0) || (!isBuy && topDistancePrice >= 999999))
        {
            AddToLog(StringFormat("%s Recovery SKIPPED - no positions found", isBuy ? "BUY" : "SELL"), "RECOVERY");
            return;
        }
        
        // Calculate recovery price based on CLOSEST position (not top distance)
        // This ensures recovery order is placed near current market, following the grid
        double recoveryPrice = isBuy ?
            NormalizeDouble(closestPrice - (gapPips * pip), _Digits) :
            NormalizeDouble(closestPrice + (gapPips * pip), _Digits);
        
        // Validate recovery price is valid for pending order
        // BUY LIMIT must be below current price, SELL LIMIT must be above current price
        if(isBuy && recoveryPrice >= currentPrice)
        {
            // If closest position's recovery price is invalid, use current price - gap
            recoveryPrice = NormalizeDouble(currentPrice - (gapPips * pip), _Digits);
        }
        if(!isBuy && recoveryPrice <= currentPrice)
        {
            // If closest position's recovery price is invalid, use current price + gap
            recoveryPrice = NormalizeDouble(currentPrice + (gapPips * pip), _Digits);
        }
        
        // ===== FIND EMPTY SLOT for recovery order =====
        // If recoveryPrice already has a position/order, keep moving further until empty slot found
        double gapPrice = gapPips * pip;
        int maxAttempts = 50; // Safety limit
        
        for(int attempt = 0; attempt < maxAttempts; attempt++)
        {
            bool slotOccupied = false;
            
            // Check recovery pending orders at this price
            for(int k = 0; k < OrdersTotal(); k++)
            {
                ulong ticket = OrderGetTicket(k);
                if(ticket <= 0) continue;
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                
                string comment = OrderGetString(ORDER_COMMENT);
                if(StringFind(comment, "Recovery") < 0) continue;
                
                ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
                if((isBuy && type != ORDER_TYPE_BUY_LIMIT) || (!isBuy && type != ORDER_TYPE_SELL_LIMIT)) continue;
                
                double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                if(MathAbs(orderPrice - recoveryPrice) < gapPrice * 0.5)
                {
                    slotOccupied = true;
                    break;
                }
            }
            
            // Check all positions at this price
            if(!slotOccupied)
            {
                for(int k = 0; k < PositionsTotal(); k++)
                {
                    ulong ticket = PositionGetTicket(k);
                    if(ticket <= 0) continue;
                    if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
                    if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
                    
                    ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                    if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
                    
                    double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                    if(MathAbs(posPrice - recoveryPrice) < gapPrice * 0.5)
                    {
                        slotOccupied = true;
                        break;
                    }
                }
            }
            
            if(!slotOccupied)
                break; // Found empty slot
            
            // Move to next slot: BUY goes lower, SELL goes higher
            if(isBuy)
                recoveryPrice = NormalizeDouble(recoveryPrice - gapPrice, _Digits);
            else
                recoveryPrice = NormalizeDouble(recoveryPrice + gapPrice, _Digits);
        }
        
        // Re-validate recovery price after slot search
        if(isBuy && recoveryPrice >= currentPrice)
        {
            AddToLog(StringFormat("BUY Recovery: No valid slot found below price %.2f", currentPrice), "RECOVERY");
            return;
        }
        if(!isBuy && recoveryPrice <= currentPrice)
        {
            AddToLog(StringFormat("SELL Recovery: No valid slot found above price %.2f", currentPrice), "RECOVERY");
            return;
        }
        
        // ===== FIND ADJACENT POSITION to recovery price for correct lot calculation =====
        // For BUY recovery: find position just ABOVE recoveryPrice (next position in grid going up)
        // For SELL recovery: find position just BELOW recoveryPrice (next position in grid going down)
        // Recovery lot = adjacent position's lot + increment (ensures sequential: 0.10, 0.11, 0.12...)
        double adjacentLot = LotSize;  // Default to base lot if no adjacent found
        double adjacentDist = 999999;
        
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
            
            double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double posLot = PositionGetDouble(POSITION_VOLUME);
            
            // For BUY: adjacent = position just ABOVE recovery price (price > recoveryPrice, closest)
            // For SELL: adjacent = position just BELOW recovery price (price < recoveryPrice, closest)
            if(isBuy && posPrice > recoveryPrice)
            {
                double dist = posPrice - recoveryPrice;
                if(dist < adjacentDist)
                {
                    adjacentDist = dist;
                    adjacentLot = posLot;
                }
            }
            else if(!isBuy && posPrice < recoveryPrice)
            {
                double dist = recoveryPrice - posPrice;
                if(dist < adjacentDist)
                {
                    adjacentDist = dist;
                    adjacentLot = posLot;
                }
            }
        }
        
        // Debug log
        AddToLog(StringFormat("%s Recovery: TopLoss=%.2f | Closest=%.2f | Target=%.2f | Current=%.2f | AdjLot=%.2f", 
            isBuy ? "BUY" : "SELL", topDistancePrice, closestPrice, recoveryPrice, currentPrice, adjacentLot), "RECOVERY");
        
        // Recovery lot = adjacent position's lot + increment
        // This ensures sequential lot increase: 0.10 -> 0.11 -> 0.12 -> ...
        double recoveryLot = adjacentLot + RecoveryLotIncrement;
        
        // Ensure lot is within broker limits AND MaxRecoveryLotSize
        double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
        double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
        if(minLot <= 0) minLot = 0.01;
        if(maxLot <= 0) maxLot = 100.0;
        
        // Apply MaxRecoveryLotSize limit
        double effectiveMaxLot = MathMin(maxLot, MaxRecoveryLotSize);
        
        recoveryLot = MathFloor(recoveryLot / lotStep) * lotStep;
        recoveryLot = MathMax(minLot, MathMin(effectiveMaxLot, recoveryLot));
        
        // Calculate SL for recovery orders (same as normal mode SL for safety)
        double recoverySL = 0;
        if(isBuy && BuyStopLossPips > 0)
            recoverySL = NormalizeDouble(recoveryPrice - (BuyStopLossPips * pip), _Digits);
        else if(!isBuy && SellStopLossPips > 0)
            recoverySL = NormalizeDouble(recoveryPrice + (SellStopLossPips * pip), _Digits);
        
        // Validate SL/TP before placement
        ValidateStops(isBuy, recoveryPrice, recoverySL, breakevenTP);
        
        // Place recovery order
        AddToLog(StringFormat("Attempting to place %s recovery order | Price: %.2f | Lot: %.2f | TP: %.2f | SL: %.2f", 
            isBuy ? "BUY" : "SELL", recoveryPrice, recoveryLot, breakevenTP, recoverySL), "RECOVERY");
            
        if(isBuy)
        {
            if(trade.BuyLimit(recoveryLot, recoveryPrice, _Symbol, recoverySL, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_BUY"))
            {
                g_LastBuyRecoveryFill = TimeCurrent(); // Cooldown timer
                AddToLog(StringFormat("✅ Recovery BUY placed @ %.2f | Lot: %.2f | TP: %.2f | SL: %.2f", recoveryPrice, recoveryLot, breakevenTP, recoverySL), "RECOVERY");
            }
            else
            {
                AddToLog(StringFormat("❌ Failed to place recovery BUY | Error: %d | RetCode: %d", 
                    GetLastError(), trade.ResultRetcode()), "RECOVERY");
            }
        }
        else
        {
            if(trade.SellLimit(recoveryLot, recoveryPrice, _Symbol, recoverySL, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_SELL"))
            {
                g_LastSellRecoveryFill = TimeCurrent(); // Cooldown timer
                AddToLog(StringFormat("✅ Recovery SELL placed @ %.2f | Lot: %.2f | TP: %.2f | SL: %.2f", recoveryPrice, recoveryLot, breakevenTP, recoverySL), "RECOVERY");
            }
            else
            {
                AddToLog(StringFormat("❌ Failed to place recovery SELL | Error: %d | RetCode: %d", 
                    GetLastError(), trade.ResultRetcode()), "RECOVERY");
            }
        }
    }
    else
    {
        string reason = "";
        if(totalPositionsThisSide >= MaxRecoveryOrders)
            reason = StringFormat("Max positions (%d/%d)", totalPositionsThisSide, MaxRecoveryOrders);
        else if(recoveryPendingCount > 0)
            reason = StringFormat("Pending exists (%d)", recoveryPendingCount);
        else if(!EnableRecovery)
            reason = "Recovery disabled";
        else if(safetyReason != "")
            reason = safetyReason;
        else
            reason = "Unknown";
            
        AddToLog(StringFormat("%s Recovery NOT placed | %s", isBuy ? "BUY" : "SELL", reason), "RECOVERY");
    }
}

//+------------------------------------------------------------------+
//| Ensure Recovery Mode TP - Worker Function                         |
//| In Recovery Mode, when long-distance + profitable basket hits       |
//| breakeven, arms trailing instead of closing (specific tickets only). |
//+------------------------------------------------------------------+
void EnsureRecoveryModeTP()
{
    // Keep tracked recovery bundles clean (remove already-closed tickets)
    CleanupBundles();

    // BUY Recovery Mode Management
    if(buyInRecovery)
    {
        CheckAndCloseRecoveryBreakeven(true);
    }
    
    // SELL Recovery Mode Management
    if(sellInRecovery)
    {
        CheckAndCloseRecoveryBreakeven(false);
    }
}

//+------------------------------------------------------------------+
//| Check and Arm Recovery Breakeven Bundles (Multi-Bundle)           |
//| Algorithm (Approach B):                                           |
//| 1. Find TOP LOSS (farthest unbundled position = most loss)        |
//| 2. Collect all unbundled PROFITABLE positions                     |
//| 3. Add profitable positions (most profitable first) to top loss   |
//| 4. When net profit (loss + profits) >= target → ARM bundle        |
//| 5. Common TP/SL based on weighted avg of bundle positions         |
//| 6. Loop: next top loss + remaining profitable = next bundle       |
//| 7. Prediction log shows status before breakeven is reached        |
//+------------------------------------------------------------------+

// Struct for position data used in bundle calculations
struct PositionInfo
{
    ulong ticket;
    double openPrice;
    double lots;
    double floatingProfit;
    double dist; // distance from current price
};

void CheckAndCloseRecoveryBreakeven(bool isBuy)
{
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // ===== Step 1: Collect ALL unbundled positions for this side =====
    PositionInfo allPos[];
    int posCount = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        // SKIP if already in any active bundle
        if(IsTicketInAnyBundle(isBuy, ticket)) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        double dist = MathAbs(openPrice - currentPrice);
        double profit = PositionGetDouble(POSITION_PROFIT);
        
        ArrayResize(allPos, posCount + 1);
        allPos[posCount].ticket = ticket;
        allPos[posCount].openPrice = openPrice;
        allPos[posCount].lots = lots;
        allPos[posCount].floatingProfit = profit;
        allPos[posCount].dist = dist;
        posCount++;
    }
    
    if(posCount < 2) return; // Need at least 2 unbundled positions
    
    // ===== Step 2: Separate into LOSS positions (sorted by distance DESC) 
    //               and PROFITABLE positions (sorted by profit DESC) =====
    PositionInfo lossPos[];
    PositionInfo profitPos[];
    int lossCount = 0, profitCount = 0;
    
    for(int i = 0; i < posCount; i++)
    {
        if(allPos[i].floatingProfit > 0.0)
        {
            ArrayResize(profitPos, profitCount + 1);
            profitPos[profitCount] = allPos[i];
            profitCount++;
        }
        else
        {
            ArrayResize(lossPos, lossCount + 1);
            lossPos[lossCount] = allPos[i];
            lossCount++;
        }
    }
    
    // Sort loss positions by distance DESCENDING (farthest = top loss first)
    for(int i = 0; i < lossCount - 1; i++)
    {
        for(int j = i + 1; j < lossCount; j++)
        {
            if(lossPos[j].dist > lossPos[i].dist)
            {
                PositionInfo temp = lossPos[i];
                lossPos[i] = lossPos[j];
                lossPos[j] = temp;
            }
        }
    }
    
    // Sort profitable positions by profit DESCENDING (most profitable first)
    for(int i = 0; i < profitCount - 1; i++)
    {
        for(int j = i + 1; j < profitCount; j++)
        {
            if(profitPos[j].floatingProfit > profitPos[i].floatingProfit)
            {
                PositionInfo temp = profitPos[i];
                profitPos[i] = profitPos[j];
                profitPos[j] = temp;
            }
        }
    }
    
    if(lossCount == 0 || profitCount == 0) return; // Need at least 1 loss + 1 profit
    
    // Calculate pip value for target calculation
    double pipValue = 0.0;
    double testOpen = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double testClose = isBuy ? testOpen + pip : testOpen - pip;
    if(!OrderCalcProfit(isBuy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, _Symbol, 1.0, testOpen, testClose, pipValue))
        pipValue = 10.0;
    if(pipValue <= 0) pipValue = 10.0;
    
    // ===== Step 3: Build bundles — TOP LOSS + PROFITABLE positions =====
    // Track which profitable positions are "consumed" by a bundle
    bool profitUsed[];
    ArrayResize(profitUsed, profitCount);
    ArrayInitialize(profitUsed, false);
    
    int activeBundleIds[];
    int activeBundleCount = GetUniqueBundleIds(isBuy, activeBundleIds);
    
    for(int topIdx = 0; topIdx < lossCount; topIdx++)
    {
        // This is our top loss candidate (farthest loss position)
        double topLossProfit = lossPos[topIdx].floatingProfit; // Negative
        double bundleLots = lossPos[topIdx].lots;
        double bundleWeightedOpen = lossPos[topIdx].openPrice * lossPos[topIdx].lots;
        double profitSum = 0.0;
        
        // Collect bundle tickets
        ulong bundleTickets[];
        ArrayResize(bundleTickets, 1);
        bundleTickets[0] = lossPos[topIdx].ticket;
        int bundleSize = 1;
        
        // Add profitable positions one by one (most profitable first)
        bool bundleArmed = false;
        for(int p = 0; p < profitCount; p++)
        {
            if(profitUsed[p]) continue;
            
            // Add this profitable position
            profitSum += profitPos[p].floatingProfit;
            bundleLots += profitPos[p].lots;
            bundleWeightedOpen += profitPos[p].openPrice * profitPos[p].lots;
            ArrayResize(bundleTickets, bundleSize + 1);
            bundleTickets[bundleSize] = profitPos[p].ticket;
            bundleSize++;
            
            // Check: net profit (top loss + profitable) >= target?
            double netProfit = topLossProfit + profitSum;
            double targetProfit = RecoveryBreakevenPips * bundleLots * pipValue;
            
            if(netProfit >= targetProfit)
            {
                // ===== BREAKEVEN HIT — Arm this bundle NOW =====
                int newBundleId = CreateNewBundle(isBuy);
                double avgPrice = bundleWeightedOpen / bundleLots;
                
                // Mark profitable positions as consumed
                for(int b = 1; b < bundleSize; b++) // b=0 is top loss
                {
                    for(int pp = 0; pp < profitCount; pp++)
                    {
                        if(profitPos[pp].ticket == bundleTickets[b]) { profitUsed[pp] = true; break; }
                    }
                }
                
                // Add all tickets to this bundle
                for(int b = 0; b < bundleSize; b++)
                    AddTicketToBundle(isBuy, newBundleId, bundleTickets[b]);
                
                // Set common SL and TP on all bundle positions
                double commonSL = isBuy ?
                    NormalizeDouble(avgPrice - (RecoveryInitialSLPips * pip), _Digits) :
                    NormalizeDouble(avgPrice + (RecoveryInitialSLPips * pip), _Digits);
                double commonTP = isBuy ?
                    NormalizeDouble(avgPrice + (RecoveryBreakevenPips * pip), _Digits) :
                    NormalizeDouble(avgPrice - (RecoveryBreakevenPips * pip), _Digits);
                
                for(int b = 0; b < bundleSize; b++)
                {
                    if(!PositionSelectByTicket(bundleTickets[b])) continue;
                    double posSL = commonSL, posTP = commonTP;
                    ValidateStopsForPosition(isBuy, posSL, posTP);
                    trade.PositionModify(bundleTickets[b], posSL, posTP);
                }
                
                AddToLog(StringFormat("%s BUNDLE #%d ARMED! %d pos (1 loss + %d profit) | TopLoss@%.2f | Net=%.2f >= Target=%.2f | Avg=%.2f | TP=%.2f | SL=%.2f", 
                    isBuy ? "BUY" : "SELL", newBundleId, bundleSize, bundleSize - 1,
                    lossPos[topIdx].openPrice, netProfit, targetProfit,
                    avgPrice, commonTP, commonSL), "BUNDLE");
                
                bundleArmed = true;
                break; // This top loss is done, move to next
            }
        }
        
        // If NOT armed, log prediction for this top loss (every 10 seconds)
        if(!bundleArmed)
        {
            static datetime lastBuyPredLog = 0;
            static datetime lastSellPredLog = 0;
            datetime lastPredLog = isBuy ? lastBuyPredLog : lastSellPredLog;
            
            if(TimeCurrent() - lastPredLog > 10)
            {
                double netProfit = topLossProfit + profitSum;
                double targetProfit = RecoveryBreakevenPips * bundleLots * pipValue;
                double stillNeeded = targetProfit - netProfit;
                
                AddToLog(StringFormat("%s PREDICT: TopLoss@%.2f(%.2f lot, PnL=%.2f) + %d profitable = Net %.2f / Target %.2f | Need $%.2f more | Active Bundles=%d", 
                    isBuy ? "BUY" : "SELL", 
                    lossPos[topIdx].openPrice, lossPos[topIdx].lots, topLossProfit,
                    bundleSize - 1, netProfit, targetProfit, stillNeeded,
                    activeBundleCount), "PREDICT");
                
                if(isBuy) lastBuyPredLog = TimeCurrent();
                else lastSellPredLog = TimeCurrent();
            }
            break; // Only predict for the first unarmed top loss — don't predict multiple
        }
    }
}

//+------------------------------------------------------------------+
//| Apply Recovery Breakeven Trailing (per-bundle, independent)       |
//| Each bundle trails independently with its own base price and SL   |
//+------------------------------------------------------------------+
void ApplyRecoveryBreakevenTrailingForSide(bool isBuy)
{
    // Get all unique bundle IDs for this side
    int bundleIds[];
    int bundleCount = GetUniqueBundleIds(isBuy, bundleIds);
    if(bundleCount <= 0) return;
    
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Trail EACH bundle independently
    for(int b = 0; b < bundleCount; b++)
    {
        int bundleId = bundleIds[b];
        
        // Get tickets for this specific bundle
        ulong tickets[];
        int ticketCount = GetBundleTickets(isBuy, bundleId, tickets);
        if(ticketCount <= 0) continue;
        
        // Calculate weighted average open price for THIS bundle only
        double weightedOpen = 0.0;
        double totalLots = 0.0;
        
        for(int i = 0; i < ticketCount; i++)
        {
            ulong ticket = tickets[i];
            if(!PositionSelectByTicket(ticket)) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
            
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double lots = PositionGetDouble(POSITION_VOLUME);
            weightedOpen += openPrice * lots;
            totalLots += lots;
        }
        
        if(totalLots <= 0.0) continue;
        
        double basePrice = weightedOpen / totalLots;
        double profitPips = isBuy ?
            (currentPrice - basePrice) / pip :
            (basePrice - currentPrice) / pip;
        
        if(profitPips < RecoveryTrailingStartPips) continue;
        
        double priceMovement = profitPips - RecoveryTrailingStartPips;
        double slMovement = priceMovement * RecoveryTrailingRatio;
        double newSL = isBuy ?
            NormalizeDouble(basePrice + (RecoveryInitialSLPips * pip) + (slMovement * pip), _Digits) :
            NormalizeDouble(basePrice - (RecoveryInitialSLPips * pip) - (slMovement * pip), _Digits);
        
        int updateCount = 0;
        for(int i = 0; i < ticketCount; i++)
        {
            ulong ticket = tickets[i];
            if(!PositionSelectByTicket(ticket)) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
            
            double currentSL = PositionGetDouble(POSITION_SL);
            double currentTP = PositionGetDouble(POSITION_TP);
            
            bool needsUpdate = (currentSL == 0) ||
                (isBuy && newSL > currentSL + (0.5 * pip)) ||
                (!isBuy && newSL < currentSL - (0.5 * pip));
            
            if(needsUpdate)
            {
                double valSL = newSL, valTP = currentTP;
                ValidateStopsForPosition(isBuy, valSL, valTP);
                if(valSL > 0 && trade.PositionModify(ticket, valSL, valTP))
                    updateCount++;
            }
        }
        
        if(updateCount > 0)
        {
            AddToLog(StringFormat("%s Bundle #%d Trail: Updated %d/%d positions | Profit: %.1f pips | SL: %.2f",
                isBuy ? "BUY" : "SELL", bundleId, updateCount, ticketCount, profitPips, newSL), "TRAILING");
        }
    }
}

//+------------------------------------------------------------------+
//| Apply Trailing Stop                                               |
//| Trailing Stop Logic:                                                |
//| 1. Normal Mode: calculated from each position's open price          |
//| 2. Recovery Mode: calculated from average price of all positions    |
//|                                                                    |
//| Formula: newSL = basePrice + InitialSL + (priceMovement × Ratio)  |
//| where priceMovement = currentProfit - TrailingStart                 |
//+------------------------------------------------------------------+
void ApplyTrailing()
{
    CleanupBundles();

    // Calculate average price for recovery mode
    // Because in recovery mode all positions close together
    double buyAvgPrice = 0, sellAvgPrice = 0;
    double buyTotalLots = 0, sellTotalLots = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

        bool isTrackedTicket = (type == POSITION_TYPE_BUY) ?
            IsRecoveryBreakevenTrailTicket(true, ticket) :
            IsRecoveryBreakevenTrailTicket(false, ticket);
        if(isTrackedTicket) continue;
        
        if(type == POSITION_TYPE_BUY)
        {
            buyAvgPrice += openPrice * lots;
            buyTotalLots += lots;
        }
        else
        {
            sellAvgPrice += openPrice * lots;
            sellTotalLots += lots;
        }
    }
    
    if(buyTotalLots > 0) buyAvgPrice /= buyTotalLots;
    if(sellTotalLots > 0) sellAvgPrice /= sellTotalLots;
    
    // Apply trailing to each position
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

        bool isTrackedTicket = (type == POSITION_TYPE_BUY) ?
            IsRecoveryBreakevenTrailTicket(true, ticket) :
            IsRecoveryBreakevenTrailTicket(false, ticket);
        if(isTrackedTicket) continue;

        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double currentPrice = type == POSITION_TYPE_BUY ? 
            SymbolInfoDouble(_Symbol, SYMBOL_BID) : 
            SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        double currentSL = PositionGetDouble(POSITION_SL);
        double currentTP = PositionGetDouble(POSITION_TP);
        
        // ===== Mode and Settings Selection =====
        // Recovery mode uses average price, otherwise individual open price
        bool inRecovery = (type == POSITION_TYPE_BUY && buyInRecovery) || (type == POSITION_TYPE_SELL && sellInRecovery);
        double basePrice = inRecovery ? (type == POSITION_TYPE_BUY ? buyAvgPrice : sellAvgPrice) : openPrice;
        
        // Select settings based on mode
        double trailingStart = inRecovery ? RecoveryTrailingStartPips : 
            (type == POSITION_TYPE_BUY ? BuyTrailingStartPips : SellTrailingStartPips);
        double initialSL = inRecovery ? RecoveryInitialSLPips :
            (type == POSITION_TYPE_BUY ? BuyInitialSLPips : SellInitialSLPips);
        double trailingRatio = inRecovery ? RecoveryTrailingRatio :
            (type == POSITION_TYPE_BUY ? BuyTrailingRatio : SellTrailingRatio);
        
        // ===== Profit Calculate =====
        // BUY: currentPrice - basePrice (profit when price rises)
        // SELL: basePrice - currentPrice (profit when price falls)
        double profitPips = type == POSITION_TYPE_BUY ?
            (currentPrice - basePrice) / pip :
            (basePrice - currentPrice) / pip;
        
        // ===== Safety SL: Ensure every position has at least initial SL =====
        // If position has NO SL (SL=0), set safety SL based on individual open price
        // This protects recovery positions that were placed without SL before this fix
        if(currentSL == 0)
        {
            double safetySL = 0;
            if(type == POSITION_TYPE_BUY && BuyStopLossPips > 0)
                safetySL = NormalizeDouble(openPrice - (BuyStopLossPips * pip), _Digits);
            else if(type == POSITION_TYPE_SELL && SellStopLossPips > 0)
                safetySL = NormalizeDouble(openPrice + (SellStopLossPips * pip), _Digits);
            
            if(safetySL > 0)
            {
                bool isBuyPos = (type == POSITION_TYPE_BUY);
                double valTP = currentTP;
                ValidateStopsForPosition(isBuyPos, safetySL, valTP);
                if(safetySL > 0)
                {
                    trade.PositionModify(ticket, safetySL, valTP);
                    AddToLog(StringFormat("Safety SL set: %s #%I64u | Open: %.2f | SL: %.2f", 
                        isBuyPos ? "BUY" : "SELL", ticket, openPrice, safetySL), "TRAILING");
                }
            }
        }
        
        // ===== Trailing Apply =====
        // Trailing only starts when profit >= trailingStart
        if(profitPips >= trailingStart)
        {
            // priceMovement = how many pips moved beyond threshold
            double priceMovement = profitPips - trailingStart;
            
            // slMovement = ratio portion of priceMovement applied to SL
            // e.g. ratio=0.5 means if price moves 2 pips, SL moves 1 pip
            double slMovement = priceMovement * trailingRatio;
            
            // ===== New SL Calculate =====
            // BUY: basePrice + initialSL + slMovement (moves up)
            // SELL: basePrice - initialSL - slMovement (moves down)
            double newSL = type == POSITION_TYPE_BUY ?
                NormalizeDouble(basePrice + (initialSL * pip) + (slMovement * pip), _Digits) :
                NormalizeDouble(basePrice - (initialSL * pip) - (slMovement * pip), _Digits);
            
            // ===== SL Update Check =====
            // Only update if SL improves (0.5 pip minimum change)
            bool needsUpdate = (currentSL == 0) || 
                (type == POSITION_TYPE_BUY && newSL > currentSL + (0.5 * pip)) ||
                (type == POSITION_TYPE_SELL && newSL < currentSL - (0.5 * pip));
            
            if(needsUpdate)
            {
                bool isBuyPos = (type == POSITION_TYPE_BUY);
                double valTP = currentTP;
                ValidateStopsForPosition(isBuyPos, newSL, valTP);
                if(newSL > 0)
                {
                    trade.PositionModify(ticket, newSL, valTP);
                    AddToLog(StringFormat("Trailing SL: %s | Profit: %.1f pips", 
                        isBuyPos ? "BUY" : "SELL", profitPips), "TRAILING");
                }
            }
        }
    }

    // Apply isolated trailing for breakeven-selected recovery baskets
    ApplyRecoveryBreakevenTrailingForSide(true);
    ApplyRecoveryBreakevenTrailingForSide(false);
}

//+------------------------------------------------------------------+
//| Add to Trading Log                                                |
//+------------------------------------------------------------------+
void AddToLog(string message, string type)
{
    int size = ArraySize(tradingLog);
    
    // Remove oldest if exceeds max size
    if(size >= logMaxSize)
    {
        for(int i = 0; i < size - 1; i++)
        {
            tradingLog[i] = tradingLog[i + 1];
        }
        size = logMaxSize - 1;
    }
    
    // Add new entry
    ArrayResize(tradingLog, size + 1);
    tradingLog[size].timestamp = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);
    tradingLog[size].type = type;
    tradingLog[size].message = message;
    
    // Send log to backend server
    SendLogToServer(message, type);
}

//+------------------------------------------------------------------+
//| Send Log to Backend Server                                        |
//+------------------------------------------------------------------+
// Batch logging to reduce server load
struct PendingLog {
    string message;
    string type;
};
PendingLog pendingLogs[];
int pendingLogCount = 0;

void SendLogToServer(string message, string type)
{
    // Skip if no license key
    if(StringLen(LicenseKey) == 0) return;

    if(IsTesterMode()) return;
    
    // Add to pending batch
    ArrayResize(pendingLogs, pendingLogCount + 1);
    pendingLogs[pendingLogCount].message = message;
    pendingLogs[pendingLogCount].type = type;
    pendingLogCount++;
    
    // Send batch every 10 seconds
    static datetime lastBatchSend = 0;
    if(TimeCurrent() - lastBatchSend < 10) return;
    
    lastBatchSend = TimeCurrent();
    
    // Send only last 3 logs to minimize data
    int logsToSend = MathMin(pendingLogCount, 3);
    if(logsToSend == 0) return;
    
    // Build batch JSON
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"logs\":[";
    
    for(int i = pendingLogCount - logsToSend; i < pendingLogCount; i++)
    {
        if(i > pendingLogCount - logsToSend) jsonRequest += ",";
        jsonRequest += "{";
        jsonRequest += "\"log_type\":\"" + pendingLogs[i].type + "\",";
        jsonRequest += "\"message\":\"" + pendingLogs[i].message + "\"";
        jsonRequest += "}";
    }
    
    jsonRequest += "]}";
    
    // Clear batch
    ArrayResize(pendingLogs, 0);
    pendingLogCount = 0;
    
    // Send request
    string url = LicenseServer + "/api/action-log/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    int timeout = 2000;
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Update Info Panel on Chart (Same as Old EA)                       |
//+------------------------------------------------------------------+
void UpdateInfoPanel()
{
    // Delete old objects (including old simplified version objects)
    ObjectDelete(0, "EA_ModeStatus");
    ObjectDelete(0, "EA_SellHeader");
    ObjectDelete(0, "EA_SellMode");
    ObjectDelete(0, "EA_SellCount");
    ObjectDelete(0, "EA_SellAvg");
    ObjectDelete(0, "EA_SellBE");
    ObjectDelete(0, "EA_SellProfit");
    ObjectDelete(0, "EA_BuyHeader");
    ObjectDelete(0, "EA_BuyMode");
    ObjectDelete(0, "EA_BuyCount");
    ObjectDelete(0, "EA_BuyAvg");
    ObjectDelete(0, "EA_BuyBE");
    ObjectDelete(0, "EA_BuyProfit");
    ObjectDelete(0, "EA_PriceHeader");
    ObjectDelete(0, "EA_PriceInfo");
    ObjectDelete(0, "EA_TotalProfit");
    ObjectDelete(0, "EA_SkipStatus");
    ObjectDelete(0, "EA_SkipStatus2");
    ObjectDelete(0, "EA_FilterStatus");
    ObjectDelete(0, "EA_TrendInfo");
    // Delete old simplified version objects
    ObjectDelete(0, "EA_Title");
    ObjectDelete(0, "EA_Mode");
    ObjectDelete(0, "EA_BuyInfo");
    ObjectDelete(0, "EA_SellInfo");
    ObjectDelete(0, "EA_Profit");
    ObjectDelete(0, "EA_Status");
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Calculate statistics - count ALL positions for display
    double buyAvgPrice = 0, sellAvgPrice = 0;
    double buyTotalLots = 0, sellTotalLots = 0;
    double buyWeightedPrice = 0, sellWeightedPrice = 0;
    double buyTotalProfit = 0, sellTotalProfit = 0;
    int actualBuyCount = 0, actualSellCount = 0;
    
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        double profit = PositionGetDouble(POSITION_PROFIT);
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        if(type == POSITION_TYPE_BUY)
        {
            buyWeightedPrice += openPrice * lots;
            buyTotalLots += lots;
            buyTotalProfit += profit;
            actualBuyCount++;
        }
        else
        {
            sellWeightedPrice += openPrice * lots;
            sellTotalLots += lots;
            sellTotalProfit += profit;
            actualSellCount++;
        }
    }
    
    if(buyTotalLots > 0) buyAvgPrice = buyWeightedPrice / buyTotalLots;
    if(sellTotalLots > 0) sellAvgPrice = sellWeightedPrice / sellTotalLots;
    
    int yPos = 20; // Start from top
    
    // ===== MODE STATUS =====
    string modeText = "";
    color modeColor = clrLime;
    
    if(buyInRecovery || sellInRecovery)
    {
        if(buyInRecovery && sellInRecovery)
            modeText = ">>> BUY & SELL BOTH RECOVERY MODE ACTIVATED <<<";
        else if(buyInRecovery)
            modeText = ">>> BUY RECOVERY MODE ACTIVATED <<<";
        else
            modeText = ">>> SELL RECOVERY MODE ACTIVATED <<<";
        modeColor = clrOrangeRed;
    }
    else
    {
        modeText = "=== MARK'S AI 3.0 PILOT RUNNING ... ===";
        modeColor = clrLime;
    }
    
    ObjectCreate(0, "EA_ModeStatus", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_ModeStatus", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_ModeStatus", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_ModeStatus", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_ModeStatus", OBJPROP_TEXT, modeText);
    ObjectSetInteger(0, "EA_ModeStatus", OBJPROP_COLOR, modeColor);
    ObjectSetInteger(0, "EA_ModeStatus", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_ModeStatus", OBJPROP_FONT, "Arial Bold");
    yPos += 22;
    
    // ===== SKIP STATUS (Trend + Equity) =====
    ObjectDelete(0, "EA_SkipStatus");
    ObjectDelete(0, "EA_SkipStatus2");
    if(skipBuyGrid || skipSellGrid)
    {
        string skipText = "";
        if(skipBuyGrid && skipSellGrid)
        {
            if(buyInRecovery && sellInRecovery)
                skipText = ">>> BOTH SIDES: RECOVERY ACTIVE (Averaging to breakeven) <<<";
            else if(buyInRecovery)
                skipText = ">>> BUY: RECOVERY | SELL: PAUSED <<<";
            else if(sellInRecovery)
                skipText = ">>> BUY: PAUSED | SELL: RECOVERY <<<";
            else
                skipText = ">>> BOTH GRIDS PAUSED (Heavy loss both sides) <<<";
        }
        else if(skipBuyGrid)
            skipText = buyInRecovery ? ">>> BUY: RECOVERY ACTIVE <<<" : ">>> BUY GRID PAUSED <<<";
        else
            skipText = sellInRecovery ? ">>> SELL: RECOVERY ACTIVE <<<" : ">>> SELL GRID PAUSED <<<";
        
        ObjectCreate(0, "EA_SkipStatus", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_SkipStatus", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_SkipStatus", OBJPROP_XDISTANCE, 10);
        ObjectSetInteger(0, "EA_SkipStatus", OBJPROP_YDISTANCE, yPos);
        ObjectSetString(0, "EA_SkipStatus", OBJPROP_TEXT, skipText);
        ObjectSetInteger(0, "EA_SkipStatus", OBJPROP_COLOR, (skipBuyGrid && skipSellGrid) ? clrOrangeRed : clrYellow);
        ObjectSetInteger(0, "EA_SkipStatus", OBJPROP_FONTSIZE, 10);
        ObjectSetString(0, "EA_SkipStatus", OBJPROP_FONT, "Arial Bold");
        yPos += 22;
        
        // Show equity info if equity skip is active
        if(EnableEquitySkip)
        {
            double bal = AccountInfoDouble(ACCOUNT_BALANCE);
            double eq = AccountInfoDouble(ACCOUNT_EQUITY);
            double dd = bal - eq;
            double ddPct = (bal > 0) ? (dd / bal * 100.0) : 0.0;
            string eqText = StringFormat("Equity: %.2f | DD: %.2f (%.1f%%) | Skip@%.1f%%", eq, dd, ddPct, EquitySkipPercent);
            
            ObjectCreate(0, "EA_SkipStatus2", OBJ_LABEL, 0, 0, 0);
            ObjectSetInteger(0, "EA_SkipStatus2", OBJPROP_CORNER, CORNER_LEFT_UPPER);
            ObjectSetInteger(0, "EA_SkipStatus2", OBJPROP_XDISTANCE, 10);
            ObjectSetInteger(0, "EA_SkipStatus2", OBJPROP_YDISTANCE, yPos);
            ObjectSetString(0, "EA_SkipStatus2", OBJPROP_TEXT, eqText);
            ObjectSetInteger(0, "EA_SkipStatus2", OBJPROP_COLOR, clrOrange);
            ObjectSetInteger(0, "EA_SkipStatus2", OBJPROP_FONTSIZE, 9);
            ObjectSetString(0, "EA_SkipStatus2", OBJPROP_FONT, "Arial");
            yPos += 18;
        }
    }
    
    // ===== SMART FILTER STATUS =====
    ObjectDelete(0, "EA_FilterStatus");
    ObjectDelete(0, "EA_TrendInfo");
    if(g_NewEntriesBlocked || g_TrendBias != 0)
    {
        if(g_NewEntriesBlocked)
        {
            ObjectCreate(0, "EA_FilterStatus", OBJ_LABEL, 0, 0, 0);
            ObjectSetInteger(0, "EA_FilterStatus", OBJPROP_CORNER, CORNER_LEFT_UPPER);
            ObjectSetInteger(0, "EA_FilterStatus", OBJPROP_XDISTANCE, 10);
            ObjectSetInteger(0, "EA_FilterStatus", OBJPROP_YDISTANCE, yPos);
            ObjectSetString(0, "EA_FilterStatus", OBJPROP_TEXT, "ENTRIES BLOCKED: " + g_BlockReason);
            ObjectSetInteger(0, "EA_FilterStatus", OBJPROP_COLOR, clrOrangeRed);
            ObjectSetInteger(0, "EA_FilterStatus", OBJPROP_FONTSIZE, 9);
            ObjectSetString(0, "EA_FilterStatus", OBJPROP_FONT, "Arial Bold");
            yPos += 18;
        }
        
        // Show trend + ATR info
        string trendStr = (g_TrendBias == 1) ? "BULLISH" : (g_TrendBias == -1) ? "BEARISH" : "NEUTRAL";
        double atrGap = GetATRGridGap(true);
        string infoText = StringFormat("Trend: %s | ATR Gap: %.1f pip | Spread: %.0f pts", 
            trendStr, atrGap, (SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID)) / _Point);
        
        ObjectCreate(0, "EA_TrendInfo", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_TrendInfo", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_TrendInfo", OBJPROP_XDISTANCE, 10);
        ObjectSetInteger(0, "EA_TrendInfo", OBJPROP_YDISTANCE, yPos);
        ObjectSetString(0, "EA_TrendInfo", OBJPROP_TEXT, infoText);
        ObjectSetInteger(0, "EA_TrendInfo", OBJPROP_COLOR, (g_TrendBias == 1) ? clrLime : (g_TrendBias == -1) ? clrOrangeRed : clrGray);
        ObjectSetInteger(0, "EA_TrendInfo", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_TrendInfo", OBJPROP_FONT, "Arial");
        yPos += 18;
    }
    
    // ===== SELL SECTION (LEFT SIDE) =====
    int sellYPos = yPos;
    
    // SELL Header
    ObjectCreate(0, "EA_SellHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellHeader", OBJPROP_TEXT, "======= SELL ORDERS =======");
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_COLOR, clrOrangeRed);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellHeader", OBJPROP_FONT, "Arial Bold");
    sellYPos += 16;
    
    // SELL Mode
    string sellModeText = "Normal Grid Mode";
    if(sellInRecovery)
        sellModeText = (g_TrendBias <= 0) ? ">> RECOVERY MODE <<" : ">> RECOVERY (Waiting Trend) <<";
    ObjectCreate(0, "EA_SellMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellMode", OBJPROP_TEXT, sellModeText);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_COLOR, sellInRecovery ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellMode", OBJPROP_FONT, "Arial Bold");
    sellYPos += 16;
    
    // SELL Count & Lots (show actual count, not recovery-adjusted count)
    string sellCountInfo = StringFormat("Positions: %d | Lots: %.2f", actualSellCount, sellTotalLots);
    ObjectCreate(0, "EA_SellCount", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellCount", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellCount", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellCount", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellCount", OBJPROP_TEXT, sellCountInfo);
    ObjectSetInteger(0, "EA_SellCount", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_SellCount", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellCount", OBJPROP_FONT, "Arial");
    sellYPos += 14;
    
    // SELL Average Price
    string sellAvgInfo = StringFormat("Avg Entry: %s", sellAvgPrice > 0 ? DoubleToString(sellAvgPrice, digits) : "No positions");
    ObjectCreate(0, "EA_SellAvg", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellAvg", OBJPROP_TEXT, sellAvgInfo);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellAvg", OBJPROP_FONT, "Arial");
    sellYPos += 14;
    
    // SELL Recovery TP Target
    double sellBE_TP = (sellAvgPrice > 0) ? sellAvgPrice - (RecoveryTakeProfitPips * pip) : 0;
    string sellBEInfo = StringFormat("Recovery TP: %s (-%.0f pips)", 
        sellBE_TP > 0 ? DoubleToString(sellBE_TP, digits) : "N/A", RecoveryTakeProfitPips);
    ObjectCreate(0, "EA_SellBE", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellBE", OBJPROP_TEXT, sellBEInfo);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_COLOR, sellInRecovery ? clrLime : clrGray);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellBE", OBJPROP_FONT, "Arial");
    sellYPos += 14;
    
    // SELL Profit
    string sellProfitInfo = StringFormat("Profit: %.2f", sellTotalProfit);
    ObjectCreate(0, "EA_SellProfit", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellProfit", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellProfit", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellProfit", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellProfit", OBJPROP_TEXT, sellProfitInfo);
    ObjectSetInteger(0, "EA_SellProfit", OBJPROP_COLOR, sellTotalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_SellProfit", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellProfit", OBJPROP_FONT, "Arial");
    
    // ===== BUY SECTION (RIGHT SIDE) =====
    int buyYPos = yPos;
    int rightX = 220;
    
    // BUY Header
    ObjectCreate(0, "EA_BuyHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyHeader", OBJPROP_TEXT, "======= BUY ORDERS =======");
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_COLOR, clrDodgerBlue);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyHeader", OBJPROP_FONT, "Arial Bold");
    buyYPos += 16;
    
    // BUY Mode
    string buyModeText = "Normal Grid Mode";
    if(buyInRecovery)
        buyModeText = (g_TrendBias >= 0) ? ">> RECOVERY MODE <<" : ">> RECOVERY (Waiting Trend) <<";
    ObjectCreate(0, "EA_BuyMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyMode", OBJPROP_TEXT, buyModeText);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_COLOR, buyInRecovery ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyMode", OBJPROP_FONT, "Arial Bold");
    buyYPos += 16;
    
    // BUY Count & Lots (show actual count, not recovery-adjusted count)
    string buyCountInfo = StringFormat("Positions: %d | Lots: %.2f", actualBuyCount, buyTotalLots);
    ObjectCreate(0, "EA_BuyCount", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyCount", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyCount", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyCount", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyCount", OBJPROP_TEXT, buyCountInfo);
    ObjectSetInteger(0, "EA_BuyCount", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_BuyCount", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyCount", OBJPROP_FONT, "Arial");
    buyYPos += 14;
    
    // BUY Average Price
    string buyAvgInfo = StringFormat("Avg Entry: %s", buyAvgPrice > 0 ? DoubleToString(buyAvgPrice, digits) : "No positions");
    ObjectCreate(0, "EA_BuyAvg", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyAvg", OBJPROP_TEXT, buyAvgInfo);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyAvg", OBJPROP_FONT, "Arial");
    buyYPos += 14;
    
    // BUY Recovery TP Target
    double buyBE_TP = (buyAvgPrice > 0) ? buyAvgPrice + (RecoveryTakeProfitPips * pip) : 0;
    string buyBEInfo = StringFormat("Recovery TP: %s (+%.0f pips)", 
        buyBE_TP > 0 ? DoubleToString(buyBE_TP, digits) : "N/A", RecoveryTakeProfitPips);
    ObjectCreate(0, "EA_BuyBE", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyBE", OBJPROP_TEXT, buyBEInfo);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_COLOR, buyInRecovery ? clrLime : clrGray);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyBE", OBJPROP_FONT, "Arial");
    buyYPos += 14;
    
    // BUY Profit
    string buyProfitInfo = StringFormat("Profit: %.2f", buyTotalProfit);
    ObjectCreate(0, "EA_BuyProfit", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyProfit", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyProfit", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyProfit", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyProfit", OBJPROP_TEXT, buyProfitInfo);
    ObjectSetInteger(0, "EA_BuyProfit", OBJPROP_COLOR, buyTotalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_BuyProfit", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyProfit", OBJPROP_FONT, "Arial");
    buyYPos += 20;
    
    // ===== PRICE INFO =====
    yPos = buyYPos + 10;
    
    ObjectCreate(0, "EA_PriceHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_PriceHeader", OBJPROP_TEXT, "======= PRICE INFO =======");
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_COLOR, clrGold);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_PriceHeader", OBJPROP_FONT, "Arial Bold");
    yPos += 16;
    
    string priceInfo = StringFormat("Bid: %.2f | Ask: %.2f | Spread: %.1f",
        SymbolInfoDouble(_Symbol, SYMBOL_BID),
        SymbolInfoDouble(_Symbol, SYMBOL_ASK),
        (SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID)) / pip);
    
    ObjectCreate(0, "EA_PriceInfo", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_PriceInfo", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_PriceInfo", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_PriceInfo", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_PriceInfo", OBJPROP_TEXT, priceInfo);
    ObjectSetInteger(0, "EA_PriceInfo", OBJPROP_COLOR, clrYellow);
    ObjectSetInteger(0, "EA_PriceInfo", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_PriceInfo", OBJPROP_FONT, "Arial Bold");
    yPos += 18;
    
    // Total Profit
    double totalProfit = buyTotalProfit + sellTotalProfit;
    string totalProfitInfo = StringFormat("TOTAL PROFIT: %.2f", totalProfit);
    ObjectCreate(0, "EA_TotalProfit", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_TotalProfit", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_TotalProfit", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_TotalProfit", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_TotalProfit", OBJPROP_TEXT, totalProfitInfo);
    ObjectSetInteger(0, "EA_TotalProfit", OBJPROP_COLOR, totalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_TotalProfit", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_TotalProfit", OBJPROP_FONT, "Arial Bold");
}

//+------------------------------------------------------------------+
//| Send trade data to backend server                                 |
//+------------------------------------------------------------------+
void SendTradeDataToServer()
{
    // Skip if no license key
    if(StringLen(LicenseKey) == 0) return;

    if(IsTesterMode()) return;
    
    // Only send every 5 seconds to avoid overloading
    if(TimeCurrent() - g_LastTradeDataUpdate < 5) return;
    g_LastTradeDataUpdate = TimeCurrent();
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Build positions array
    string positionsJson = "[";
    int posCount = 0;
    int total = PositionsTotal();
    
    double totalBuyLots = 0, totalSellLots = 0;
    double totalBuyProfit = 0, totalSellProfit = 0;
    int buyCount = 0, sellCount = 0;
    
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        double lots = PositionGetDouble(POSITION_VOLUME);
        double profit = PositionGetDouble(POSITION_PROFIT);
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double sl = PositionGetDouble(POSITION_SL);
        double tp = PositionGetDouble(POSITION_TP);
        
        if(posType == POSITION_TYPE_BUY)
        {
            buyCount++;
            totalBuyLots += lots;
            totalBuyProfit += profit;
        }
        else
        {
            sellCount++;
            totalSellLots += lots;
            totalSellProfit += profit;
        }
        
        if(posCount > 0) positionsJson += ",";
        positionsJson += "{";
        positionsJson += "\"ticket\":" + IntegerToString(ticket) + ",";
        positionsJson += "\"type\":\"" + (posType == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
        positionsJson += "\"lots\":" + DoubleToString(lots, 2) + ",";
        positionsJson += "\"open_price\":" + DoubleToString(openPrice, digits) + ",";
        positionsJson += "\"sl\":" + DoubleToString(sl, digits) + ",";
        positionsJson += "\"tp\":" + DoubleToString(tp, digits) + ",";
        positionsJson += "\"profit\":" + DoubleToString(profit, 2);
        positionsJson += "}";
        posCount++;
    }
    positionsJson += "]";
    
    // Build pending orders array
    string pendingJson = "[";
    int pendingCount = 0;
    int totalOrders = OrdersTotal();
    
    for(int i = 0; i < totalOrders; i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        double lots = OrderGetDouble(ORDER_VOLUME_CURRENT);
        double price = OrderGetDouble(ORDER_PRICE_OPEN);
        double sl = OrderGetDouble(ORDER_SL);
        double tp = OrderGetDouble(ORDER_TP);
        
        string typeStr = "";
        if(orderType == ORDER_TYPE_BUY_LIMIT) typeStr = "BUY_LIMIT";
        else if(orderType == ORDER_TYPE_SELL_LIMIT) typeStr = "SELL_LIMIT";
        else if(orderType == ORDER_TYPE_BUY_STOP) typeStr = "BUY_STOP";
        else if(orderType == ORDER_TYPE_SELL_STOP) typeStr = "SELL_STOP";
        else continue;
        
        if(pendingCount > 0) pendingJson += ",";
        pendingJson += "{";
        pendingJson += "\"ticket\":" + IntegerToString(ticket) + ",";
        pendingJson += "\"type\":\"" + typeStr + "\",";
        pendingJson += "\"lots\":" + DoubleToString(lots, 2) + ",";
        pendingJson += "\"price\":" + DoubleToString(price, digits) + ",";
        pendingJson += "\"sl\":" + DoubleToString(sl, digits) + ",";
        pendingJson += "\"tp\":" + DoubleToString(tp, digits);
        pendingJson += "}";
        pendingCount++;
    }
    pendingJson += "]";
    
    // Determine trading mode with full status
    string tradingMode = "Normal Mode Running";
    if(buyInRecovery && sellInRecovery) tradingMode = "Buy & Sell Recovery Mode Activated!";
    else if(buyInRecovery) tradingMode = "Buy Recovery Mode Activated!";
    else if(sellInRecovery) tradingMode = "Sell Recovery Mode Activated!";
    
    // Build smart filter status for website
    string trendStr = (g_TrendBias == 1) ? "BULLISH" : (g_TrendBias == -1) ? "BEARISH" : "NEUTRAL";
    string filterStatus = "";
    if(g_NewEntriesBlocked)
        filterStatus = "BLOCKED: " + g_BlockReason;
    else if(skipBuyGrid && skipSellGrid)
        filterStatus = "BOTH GRIDS PAUSED (Equity/Trend Skip)";
    else if(skipBuyGrid)
        filterStatus = "BUY GRID PAUSED (Trend/Equity Skip)";
    else if(skipSellGrid)
        filterStatus = "SELL GRID PAUSED (Trend/Equity Skip)";
    else if(IsTrendFiltered(true) && IsTrendFiltered(false))
        filterStatus = "BOTH SIDES TREND FILTERED";
    else if(IsTrendFiltered(true))
        filterStatus = "BUY FILTERED (EMA Bearish)";
    else if(IsTrendFiltered(false))
        filterStatus = "SELL FILTERED (EMA Bullish)";
    else
        filterStatus = "ALL CLEAR";
    
    double atrGapBuy = GetATRGridGap(true);
    double atrGapSell = GetATRGridGap(false);
    double currentSpread = (SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID)) / _Point;
    
    // Build closed positions array (last 24 hours)
    string closedJson = "[";
    int closedCount = 0;
    datetime fromTime = TimeCurrent() - 86400; // Last 24 hours
    
    if(HistorySelect(fromTime, TimeCurrent()))
    {
        int totalDeals = HistoryDealsTotal();
        for(int i = totalDeals - 1; i >= 0 && closedCount < 100; i--)
        {
            ulong dealTicket = HistoryDealGetTicket(i);
            if(dealTicket <= 0) continue;
            
            string dealSymbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
            if(dealSymbol != _Symbol) continue;
            
            ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
            if(dealEntry != DEAL_ENTRY_OUT) continue; // Only closed deals
            
            long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
            if(!ManageAllTrades && dealMagic != MagicNumber) continue;
            
            ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;
            
            double dealLots = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
            double dealPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            double dealProfit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
            datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
            
            // Get position ticket for open price
            ulong posTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
            double openPrice = 0;
            
            // Find the opening deal for this position
            for(int j = 0; j < totalDeals; j++)
            {
                ulong openDealTicket = HistoryDealGetTicket(j);
                if(openDealTicket <= 0) continue;
                ulong openPosId = HistoryDealGetInteger(openDealTicket, DEAL_POSITION_ID);
                if(openPosId == posTicket)
                {
                    ENUM_DEAL_ENTRY openEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(openDealTicket, DEAL_ENTRY);
                    if(openEntry == DEAL_ENTRY_IN)
                    {
                        openPrice = HistoryDealGetDouble(openDealTicket, DEAL_PRICE);
                        break;
                    }
                }
            }
            
            if(closedCount > 0) closedJson += ",";
            closedJson += "{";
            closedJson += "\"ticket\":" + IntegerToString(dealTicket) + ",";
            closedJson += "\"symbol\":\"" + dealSymbol + "\",";
            closedJson += "\"type\":\"" + (dealType == DEAL_TYPE_SELL ? "BUY" : "SELL") + "\","; // Reversed because closing deal
            closedJson += "\"lots\":" + DoubleToString(dealLots, 2) + ",";
            closedJson += "\"open_price\":" + DoubleToString(openPrice, digits) + ",";
            closedJson += "\"close_price\":" + DoubleToString(dealPrice, digits) + ",";
            closedJson += "\"profit\":" + DoubleToString(dealProfit, 2) + ",";
            closedJson += "\"close_time\":\"" + TimeToString(dealTime, TIME_DATE|TIME_MINUTES) + "\"";
            closedJson += "}";
            closedCount++;
        }
    }
    closedJson += "]";
    
    // Build main JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"account_balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
    jsonRequest += "\"account_equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
    jsonRequest += "\"account_profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
    jsonRequest += "\"account_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
    jsonRequest += "\"account_free_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
    jsonRequest += "\"total_buy_positions\":" + IntegerToString(buyCount) + ",";
    jsonRequest += "\"total_sell_positions\":" + IntegerToString(sellCount) + ",";
    jsonRequest += "\"total_buy_lots\":" + DoubleToString(totalBuyLots, 2) + ",";
    jsonRequest += "\"total_sell_lots\":" + DoubleToString(totalSellLots, 2) + ",";
    jsonRequest += "\"total_buy_profit\":" + DoubleToString(totalBuyProfit, 2) + ",";
    jsonRequest += "\"total_sell_profit\":" + DoubleToString(totalSellProfit, 2) + ",";
    jsonRequest += "\"total_pending_orders\":" + IntegerToString(pendingCount) + ",";
    jsonRequest += "\"trading_mode\":\"" + tradingMode + "\",";
    jsonRequest += "\"symbol\":\"" + _Symbol + "\",";
    jsonRequest += "\"current_price\":" + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), digits) + ",";
    jsonRequest += "\"open_positions\":" + positionsJson + ",";
    jsonRequest += "\"pending_orders\":" + pendingJson + ",";
    jsonRequest += "\"closed_positions\":" + closedJson + ",";
    // Smart filter & trend data for website dashboard
    jsonRequest += "\"trend_direction\":\"" + trendStr + "\",";
    jsonRequest += "\"filter_status\":\"" + filterStatus + "\",";
    jsonRequest += "\"atr_gap_buy\":" + DoubleToString(atrGapBuy, 1) + ",";
    jsonRequest += "\"atr_gap_sell\":" + DoubleToString(atrGapSell, 1) + ",";
    jsonRequest += "\"spread\":" + DoubleToString(currentSpread, 0) + ",";
    jsonRequest += "\"skip_buy\":" + (skipBuyGrid ? "true" : "false") + ",";
    jsonRequest += "\"skip_sell\":" + (skipSellGrid ? "true" : "false") + ",";
    jsonRequest += "\"buy_mode\":\"" + (buyInRecovery ? "RECOVERY" : "NORMAL") + "\",";
    jsonRequest += "\"sell_mode\":\"" + (sellInRecovery ? "RECOVERY" : "NORMAL") + "\"";
    jsonRequest += "}";
    
    // Prepare request
    string url = LicenseServer + "/api/trade-data/update/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    int timeout = 2000;
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
    
}

//+------------------------------------------------------------------+
//| Max Drawdown Protection                                           |
//| Returns true if drawdown limit hit (caller should return early)   |
//+------------------------------------------------------------------+
bool CheckMaxDrawdown()
{
    if(MaxDrawdownAmount <= 0.0) return false; // Disabled

    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    double drawdown = balance - equity; // Positive = loss

    if(drawdown < MaxDrawdownAmount) return false; // Limit not hit

    // --- Drawdown limit hit ---
    static datetime lastDrawdownLog = 0;
    if(TimeCurrent() - lastDrawdownLog > 5)
    {
        lastDrawdownLog = TimeCurrent();
        AddToLog(StringFormat("MAX DRAWDOWN HIT: Loss=$%.2f / Limit=$%.2f | Balance=$%.2f | Equity=%.2f — Closing all",
            drawdown, MaxDrawdownAmount, balance, equity), "DRAWDOWN");
    }

    // Close all pending orders first
    int totalOrders = OrdersTotal();
    for(int i = totalOrders - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        trade.OrderDelete(ticket);
    }

    // Close all open positions
    int totalPositions = PositionsTotal();
    for(int i = totalPositions - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        trade.PositionClose(ticket);
    }

    // Reset recovery bundle tracking
    ArrayFree(buyBundles);
    ArrayFree(sellBundles);
    nextBuyBundleId = 1;
    nextSellBundleId = 1;

    return true; // Signal caller to skip trading this tick
}

//+------------------------------------------------------------------+
//| Close All Pending Orders (when license invalid)                   |
//+------------------------------------------------------------------+
void CloseAllPendingOrders()
{
    int totalOrders = OrdersTotal();
    for(int i = totalOrders - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        trade.OrderDelete(ticket);
    }
}

//+------------------------------------------------------------------+
//| Close All Open Positions (when license deactivated/expired)       |
//+------------------------------------------------------------------+
void CloseAllOpenPositions()
{
    int totalPositions = PositionsTotal();
    for(int i = totalPositions - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        if(!trade.PositionClose(ticket))
        {
            AddToLog(StringFormat("Failed to close position #%I64u: %s", ticket, trade.ResultComment()), "ERROR");
        }
        else
        {
            AddToLog(StringFormat("Closed position #%I64u (license invalid)", ticket), "LICENSE");
        }
    }
}

//+------------------------------------------------------------------+
//| Poll and Execute Pending Trade Commands from Server                |
//+------------------------------------------------------------------+
void PollAndExecuteCommands()
{
    if(IsTesterMode()) return;
    if(StringLen(LicenseKey) == 0) return;
    
    string url = LicenseServer + "/api/trade-commands/pending/";
    string headers = "Content-Type: application/json\r\n";
    string jsonRequest = "{\"license_key\":\"" + LicenseKey + "\"}";
    
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    ResetLastError();
    int response = WebRequest("POST", url, headers, 3000, postData, result, resultHeaders);
    
    if(response == -1 || response != 200) return;
    
    string responseStr = CharArrayToString(result);
    
    // Check success
    if(StringFind(responseStr, "\"success\": true") < 0 && StringFind(responseStr, "\"success\":true") < 0) return;
    
    // Parse commands array — simple JSON parsing
    int cmdStart = StringFind(responseStr, "\"commands\"");
    if(cmdStart < 0) return;
    
    // Find array start
    int arrStart = StringFind(responseStr, "[", cmdStart);
    if(arrStart < 0) return;
    int arrEnd = StringFind(responseStr, "]", arrStart);
    if(arrEnd < 0) return;
    
    string commandsStr = StringSubstr(responseStr, arrStart, arrEnd - arrStart + 1);
    
    // If empty array, nothing to do
    if(commandsStr == "[]") return;
    
    // Parse each command object
    int searchPos = 0;
    while(true)
    {
        int objStart = StringFind(commandsStr, "{", searchPos);
        if(objStart < 0) break;
        int objEnd = StringFind(commandsStr, "}", objStart);
        if(objEnd < 0) break;
        
        string cmdObj = StringSubstr(commandsStr, objStart, objEnd - objStart + 1);
        searchPos = objEnd + 1;
        
        // Extract command_id
        int cmdId = ExtractJsonInt(cmdObj, "id");
        string cmdType = ExtractJsonString(cmdObj, "command_type");
        
        if(cmdId <= 0 || StringLen(cmdType) == 0) continue;
        
        // Extract ticket from parameters if present
        int paramStart = StringFind(cmdObj, "\"parameters\"");
        long ticket = 0;
        if(paramStart >= 0)
        {
            int paramObjStart = StringFind(cmdObj, "{", paramStart);
            if(paramObjStart >= 0)
            {
                int paramObjEnd = StringFind(cmdObj, "}", paramObjStart);
                if(paramObjEnd >= 0)
                {
                    string paramStr = StringSubstr(cmdObj, paramObjStart, paramObjEnd - paramObjStart + 1);
                    ticket = (long)ExtractJsonInt(paramStr, "ticket");
                }
            }
        }
        
        // Execute command
        string resultMsg = "";
        bool success = false;
        
        if(cmdType == "CLOSE_POSITION")
        {
            success = ExecuteClosePosition((ulong)ticket, resultMsg);
        }
        else if(cmdType == "CLOSE_ALL_BUY")
        {
            success = ExecuteCloseAllByType(POSITION_TYPE_BUY, resultMsg);
        }
        else if(cmdType == "CLOSE_ALL_SELL")
        {
            success = ExecuteCloseAllByType(POSITION_TYPE_SELL, resultMsg);
        }
        else if(cmdType == "CLOSE_ALL")
        {
            success = ExecuteCloseAll(resultMsg);
        }
        else if(cmdType == "EA_ON" || cmdType == "EA_OFF")
        {
            // EA ON/OFF handled by license verification, just acknowledge
            success = true;
            resultMsg = cmdType + " acknowledged";
        }
        
        // Report status back to server
        ReportCommandStatus(cmdId, success ? "executed" : "failed", resultMsg);
        
        AddToLog(StringFormat("FM Command %s (id=%d): %s — %s", cmdType, cmdId, success ? "OK" : "FAIL", resultMsg), "INFO");
    }
}

bool ExecuteClosePosition(ulong ticket, string &resultMsg)
{
    if(ticket <= 0)
    {
        resultMsg = "Invalid ticket number";
        return false;
    }
    
    if(!PositionSelectByTicket(ticket))
    {
        resultMsg = StringFormat("Position #%I64u not found", ticket);
        return false;
    }
    
    if(PositionGetString(POSITION_SYMBOL) != _Symbol)
    {
        resultMsg = StringFormat("Position #%I64u is on different symbol", ticket);
        return false;
    }
    
    if(trade.PositionClose(ticket))
    {
        resultMsg = StringFormat("Closed position #%I64u successfully", ticket);
        return true;
    }
    else
    {
        resultMsg = StringFormat("Failed to close #%I64u: %s", ticket, trade.ResultComment());
        return false;
    }
}

bool ExecuteCloseAllByType(ENUM_POSITION_TYPE posType, string &resultMsg)
{
    int closed = 0;
    int failed = 0;
    string typeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
    
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != posType) continue;
        
        if(trade.PositionClose(ticket))
            closed++;
        else
            failed++;
    }
    
    resultMsg = StringFormat("Close all %s: %d closed, %d failed", typeStr, closed, failed);
    return (failed == 0);
}

bool ExecuteCloseAll(string &resultMsg)
{
    int closed = 0;
    int failed = 0;
    
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        if(trade.PositionClose(ticket))
            closed++;
        else
            failed++;
    }
    
    resultMsg = StringFormat("Close all: %d closed, %d failed", closed, failed);
    return (failed == 0);
}

void ReportCommandStatus(int cmdId, string status, string resultMessage)
{
    string url = LicenseServer + "/api/trade-commands/update-status/";
    string headers = "Content-Type: application/json\r\n";
    
    // Escape quotes in result message
    StringReplace(resultMessage, "\"", "'");
    
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"command_id\":" + IntegerToString(cmdId) + ",";
    jsonRequest += "\"status\":\"" + status + "\",";
    jsonRequest += "\"result_message\":\"" + resultMessage + "\"";
    jsonRequest += "}";
    
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    WebRequest("POST", url, headers, 3000, postData, result, resultHeaders);
}

string ExtractJsonString(string json, string key)
{
    string searchKey = "\"" + key + "\"";
    int keyPos = StringFind(json, searchKey);
    if(keyPos < 0) return "";
    
    int colonPos = StringFind(json, ":", keyPos + StringLen(searchKey));
    if(colonPos < 0) return "";
    
    int quoteStart = StringFind(json, "\"", colonPos + 1);
    if(quoteStart < 0) return "";
    
    int quoteEnd = StringFind(json, "\"", quoteStart + 1);
    if(quoteEnd < 0) return "";
    
    return StringSubstr(json, quoteStart + 1, quoteEnd - quoteStart - 1);
}

int ExtractJsonInt(string json, string key)
{
    string searchKey = "\"" + key + "\"";
    int keyPos = StringFind(json, searchKey);
    if(keyPos < 0) return 0;
    
    int colonPos = StringFind(json, ":", keyPos + StringLen(searchKey));
    if(colonPos < 0) return 0;
    
    // Skip whitespace
    int valStart = colonPos + 1;
    while(valStart < StringLen(json) && (StringGetCharacter(json, valStart) == ' ' || StringGetCharacter(json, valStart) == '\t'))
        valStart++;
    
    // Read digits
    string numStr = "";
    for(int i = valStart; i < StringLen(json); i++)
    {
        ushort ch = StringGetCharacter(json, i);
        if(ch >= '0' && ch <= '9')
            numStr += CharToString((uchar)ch);
        else
            break;
    }
    
    if(StringLen(numStr) == 0) return 0;
    return (int)StringToInteger(numStr);
}

//+------------------------------------------------------------------+
//| Verify License with Server                                        |
//+------------------------------------------------------------------+
bool VerifyLicense()
{
    // Auto-pass in Strategy Tester
    if(MQLInfoInteger(MQL_TESTER))
    {
        g_LicenseValid = true;
        g_LicenseMessage = "TESTER MODE";
        g_PlanName = "Tester";
        g_DaysRemaining = 999;
        return true;
    }
    
    // Check if license key is empty
    if(StringLen(LicenseKey) == 0)
    {
        g_LicenseMessage = "NO LICENSE KEY ENTERED";
        g_LicenseValid = false;
        g_PlanName = "";
        g_DaysRemaining = 0;
        return false;
    }
    
    // Get MT5 account number
    long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
    string mt5Account = IntegerToString(accountNumber);
    if(IsTesterMode() && StringLen(TesterAccountOverride) > 0)
        mt5Account = TesterAccountOverride;
    else if(IsTesterMode() && accountNumber == 0)
        mt5Account = "0";
    
    // Build JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"mt5_account\":\"" + mt5Account + "\",";
    jsonRequest += "\"hardware_id\":\"" + TerminalInfoString(TERMINAL_CPU_NAME) + "\"";
    jsonRequest += "}";
    
    // Prepare request
    string url = LicenseServer + "/api/verify/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    // Make HTTP request
    ResetLastError();
    int timeout = 5000;
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
    
    // Connection failed
    if(response == -1)
    {
        int error = GetLastError();
        if(error == 4014)
        {
            g_LicenseMessage = "URL NOT ALLOWED - Add '" + LicenseServer + "' to Tools > Options > Expert Advisors";
        }
        else if(IsTesterMode() && accountNumber == 0 && StringLen(TesterAccountOverride) == 0)
        {
            g_LicenseMessage = "TESTER ACCOUNT=0 - Set TesterAccountOverride to your licensed account number";
        }
        else
        {
            g_LicenseMessage = "SERVER CONNECTION FAILED (Error: " + IntegerToString(error) + ")";
        }

        if(TryLoadCachedLicense(mt5Account))
            return true;
        if(TryLoadCachedLicenseCommon(mt5Account))
            return true;

        g_LicenseValid = false;
        g_PlanName = "";
        g_DaysRemaining = 0;
        g_LastVerification = TimeCurrent();
        return false;
    }
    
    // Parse response
    string responseStr = CharArrayToString(result);
    
    // Convert response to lowercase for easier checking
    string lowerResp = responseStr;
    StringToLower(lowerResp);
    
    // Check if response contains "valid": true OR "valid":true
    bool hasValidTrue = (StringFind(lowerResp, "\"valid\": true") >= 0 || 
                        StringFind(lowerResp, "\"valid\":true") >= 0);
    
    // Check if response contains "valid": false OR "valid":false  
    bool hasValidFalse = (StringFind(lowerResp, "\"valid\": false") >= 0 || 
                         StringFind(lowerResp, "\"valid\":false") >= 0);
    
    // Only valid if explicitly "valid": true
    if(hasValidTrue && !hasValidFalse)
    {
        g_LicenseValid = true;
        
        // Extract days remaining
        int daysPos = StringFind(responseStr, "\"days_remaining\"");
        if(daysPos >= 0)
        {
            int colonPos = StringFind(responseStr, ":", daysPos);
            int commaPos = StringFind(responseStr, ",", colonPos);
            if(commaPos < 0) commaPos = StringFind(responseStr, "}", colonPos);
            string daysStr = StringSubstr(responseStr, colonPos + 1, commaPos - colonPos - 1);
            StringTrimLeft(daysStr);
            StringTrimRight(daysStr);
            g_DaysRemaining = (int)StringToInteger(daysStr);
        }
        
        // Extract plan name
        int planPos = StringFind(responseStr, "\"plan\"");
        if(planPos >= 0)
        {
            int startQuote = StringFind(responseStr, "\"", planPos + 7);
            int endQuote = StringFind(responseStr, "\"", startQuote + 1);
            g_PlanName = StringSubstr(responseStr, startQuote + 1, endQuote - startQuote - 1);
        }
        
        g_LicenseMessage = "ACTIVE";
        g_LastVerification = TimeCurrent();
        SaveCachedLicense(mt5Account);
        return true;
    }
    
    // If we reach here, license is invalid
    g_LicenseValid = false;
    g_PlanName = "";
    g_DaysRemaining = 0;
    g_LastVerification = TimeCurrent();
    
    // Try to extract error message
    int msgPos = StringFind(responseStr, "\"message\"");
    if(msgPos >= 0)
    {
        int startQuote = StringFind(responseStr, "\"", msgPos + 10);
        int endQuote = StringFind(responseStr, "\"", startQuote + 1);
        g_LicenseMessage = StringSubstr(responseStr, startQuote + 1, endQuote - startQuote - 1);
    }
    else
    {
        g_LicenseMessage = "LICENSE INVALID";
    }
    
    return false;
}

//+------------------------------------------------------------------+
//| Update License Panel (Right Side)                                 |
//+------------------------------------------------------------------+
void UpdateLicensePanel()
{
    // Delete old objects
    ObjectDelete(0, "EA_LicenseTitle");
    ObjectDelete(0, "EA_LicenseURL");
    ObjectDelete(0, "EA_LicensePlan");
    ObjectDelete(0, "EA_LicenseExpiry");
    ObjectDelete(0, "EA_LicenseDays");
    ObjectDelete(0, "EA_LicenseStatus");
    ObjectDelete(0, "EA_LicenseWarning");
    
    int yPos = 20;
    int rightX = 200; // Distance from right edge (enough padding for long URL)
    
    // Website URL
    ObjectCreate(0, "EA_LicenseURL", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_LicenseURL", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
    ObjectSetInteger(0, "EA_LicenseURL", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_LicenseURL", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_LicenseURL", OBJPROP_TEXT, "https://www.markstrades.com");
    ObjectSetInteger(0, "EA_LicenseURL", OBJPROP_COLOR, clrGold);
    ObjectSetInteger(0, "EA_LicenseURL", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_LicenseURL", OBJPROP_FONT, "Arial Bold");
    yPos += 16;
    
    // License Status
    string statusText = g_LicenseValid ? "LICENSE: ACTIVE" : "LICENSE: INVALID";
    color statusColor = g_LicenseValid ? clrLime : clrRed;
    
    ObjectCreate(0, "EA_LicenseStatus", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
    ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_LicenseStatus", OBJPROP_TEXT, statusText);
    ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_COLOR, statusColor);
    ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_LicenseStatus", OBJPROP_FONT, "Arial Bold");
    yPos += 16;
    
    if(g_LicenseValid)
    {
        // Plan Name
        ObjectCreate(0, "EA_LicensePlan", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicensePlan", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicensePlan", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_LicensePlan", OBJPROP_YDISTANCE, yPos);
        ObjectSetString(0, "EA_LicensePlan", OBJPROP_TEXT, "Plan: " + g_PlanName);
        ObjectSetInteger(0, "EA_LicensePlan", OBJPROP_COLOR, clrWhite);
        ObjectSetInteger(0, "EA_LicensePlan", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_LicensePlan", OBJPROP_FONT, "Arial");
        yPos += 14;
        
        // Days Remaining (from backend)
        string daysText = "Days Left: " + IntegerToString(g_DaysRemaining);
        color daysColor = clrLime;
        if(g_DaysRemaining <= 7) daysColor = clrOrange;
        if(g_DaysRemaining <= 3) daysColor = clrRed;
        
        ObjectCreate(0, "EA_LicenseDays", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseDays", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseDays", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_LicenseDays", OBJPROP_YDISTANCE, yPos);
        ObjectSetString(0, "EA_LicenseDays", OBJPROP_TEXT, daysText);
        ObjectSetInteger(0, "EA_LicenseDays", OBJPROP_COLOR, daysColor);
        ObjectSetInteger(0, "EA_LicenseDays", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_LicenseDays", OBJPROP_FONT, "Arial Bold");
        yPos += 14;
        
        // Warning if expiring soon
        if(g_DaysRemaining <= 7)
        {
            string warningText = g_DaysRemaining <= 3 ? "!! RENEW NOW !!" : "! Renew Soon !";
            ObjectCreate(0, "EA_LicenseWarning", OBJ_LABEL, 0, 0, 0);
            ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
            ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_XDISTANCE, rightX);
            ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_YDISTANCE, yPos);
            ObjectSetString(0, "EA_LicenseWarning", OBJPROP_TEXT, warningText);
            ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_COLOR, g_DaysRemaining <= 3 ? clrRed : clrOrange);
            ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_FONTSIZE, 10);
            ObjectSetString(0, "EA_LicenseWarning", OBJPROP_FONT, "Arial Bold");
        }
    }
    else
    {
        // Show error message
        ObjectCreate(0, "EA_LicenseWarning", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_YDISTANCE, yPos);
        ObjectSetString(0, "EA_LicenseWarning", OBJPROP_TEXT, "TRADING DISABLED");
        ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_COLOR, clrRed);
        ObjectSetInteger(0, "EA_LicenseWarning", OBJPROP_FONTSIZE, 10);
        ObjectSetString(0, "EA_LicenseWarning", OBJPROP_FONT, "Arial Bold");
    }
}

//+------------------------------------------------------------------+
