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
input int       CachedLicenseMaxAgeHours = 24;

//--- Max Drawdown Protection
input double    MaxDrawdownAmount = 0.0;  // Max loss in $ (0 = disabled). e.g. 200 means close all if loss >= $200

//--- Per Order Stop Loss (0 = disabled)
input double    BuyStopLossPips  = 120.0;   // Buy SL in pips (0 = no SL)
input double    SellStopLossPips = 110.0;   // Sell SL in pips (0 = no SL)

//--- All Settings Hardcoded (Hidden from user)
#define BuyRangeStart       2001.0
#define BuyRangeEnd         8801.0
#define BuyGapPips          5.0
#define MaxBuyOrders        6
#define BuyTakeProfitPips   25

#define SellRangeStart      8802.0
#define SellRangeEnd        2002.0
#define SellGapPips         6.0
#define MaxSellOrders       6
#define SellTakeProfitPips  25

#define BuyRecoveryGapPips   6
#define SellRecoveryGapPips  6

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

#define BuyTrailingStartPips    5.0   // কত pip profit হলে trailing শুরু হবে (Trailing activation threshold)
#define BuyInitialSLPips        4.0   // প্রথমে SL কত pip profit এ set হবে (Initial SL when trailing starts)
#define BuyTrailingRatio        0.5   // প্রতি 1 pip trail এ SL কত pip move করবে (0.5 = 50% of price movement)

#define SellTrailingStartPips   5.0   // SELL এর জন্য trailing শুরু threshold
#define SellInitialSLPips       4.0   // SELL এর জন্য initial SL
#define SellTrailingRatio       0.5   // SELL এর জন্য trailing ratio

// ===== RECOVERY MODE SETTINGS =====
// Recovery mode এ average price থেকে calculate হয়, individual position থেকে না
// Recovery mode activates when positions >= MaxOrders

#define EnableRecovery          true   // Recovery mode enable/disable
#define RecoveryTakeProfitPips  25.0  // Recovery mode এ TP (average price থেকে) - NOT USED for breakeven
#define RecoveryBreakevenPips   3.5  // Breakeven close এ profit pips (long-distance + profitable positions)
#define RecoveryTrailingStartPips 3.5  // Recovery mode এ trailing শুরু threshold
#define RecoveryInitialSLPips   2.75    // Recovery mode এ initial SL
#define RecoveryTrailingRatio   0.5    // Recovery mode এ trailing ratio
#define RecoveryLotIncrement    0.01   // প্রতি recovery order এ lot size বৃদ্ধি (fixed increment)
#define MaxRecoveryLotSize      0.25    // Recovery mode এ সর্বোচ্চ lot size (এর বেশি হবে না)
#define MaxRecoveryOrders       200
#define RecoveryCleanupThreshold 4  // যখন শুধু recovery positions থাকে এবং সংখ্যা এর সমান বা কম, সব close করে normal mode restart

#define LotSize         0.10
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
    
    // Count current positions
    CountPositions();
    
    // Debug: Log current state every 30 seconds
    static datetime lastDebugLog = 0;
    if(TimeCurrent() - lastDebugLog > 30)
    {
        double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
        AddToLog(StringFormat("DEBUG | Price: %.2f | BuyMode: %s | SellMode: %s | BuyPos: %d | SellPos: %d", 
            currentBid,
            buyInRecovery ? "RECOVERY" : "NORMAL",
            sellInRecovery ? "RECOVERY" : "NORMAL",
            currentBuyPositions,
            currentSellPositions), "DEBUG");
        lastDebugLog = TimeCurrent();
    }
    
    // Track previous mode for logging mode changes
    static bool prevBuyInRecovery = false;
    static bool prevSellInRecovery = false;
    
    // Determine mode
    buyInRecovery = (currentBuyPositions >= MaxBuyOrders);
    sellInRecovery = (currentSellPositions >= MaxSellOrders);
    
    // Log mode changes
    if(buyInRecovery && !prevBuyInRecovery)
    {
        AddToLog("BUY RECOVERY MODE ACTIVATED", "MODE");
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
        AddToLog("SELL RECOVERY MODE ACTIVATED", "MODE");
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
    
    // Manage grids based on mode
    if(!buyInRecovery)
    {
        ManageNormalGrid(true);  // BUY Normal Mode
    }
    else
    {
        // BUY Recovery Mode - delete normal pending orders first
        DeleteNormalPendingOrders(true);
        ManageRecoveryGrid(true); // BUY Recovery
    }
        
    if(!sellInRecovery)
    {
        ManageNormalGrid(false); // SELL Normal Mode
    }
    else
    {
        // SELL Recovery Mode - delete normal pending orders first
        DeleteNormalPendingOrders(false);
        ManageRecoveryGrid(false); // SELL Recovery
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
        AddToLog(StringFormat("%s Recovery Cleanup: Normal=%d, Recovery=%d (threshold=%d) - CLOSING ALL to restart normal mode", 
            isBuy ? "BUY" : "SELL", normalCount, recoveryCount, RecoveryCleanupThreshold), "CLEANUP");
        
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
    
    int maxOrders = isBuy ? MaxBuyOrders : MaxSellOrders;
    double rangeHigh = isBuy ? MathMax(BuyRangeStart, BuyRangeEnd) : MathMax(SellRangeStart, SellRangeEnd);
    double rangeLow  = isBuy ? MathMin(BuyRangeStart, BuyRangeEnd) : MathMin(SellRangeStart, SellRangeEnd);
    double checkPrice = isBuy ? currentBid : currentAsk;
    
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
            if(trade.PositionModify(ticket, currentSL, breakevenTP))
            {
                AddToLog(StringFormat("%s SelfHeal: Fixed TP on position #%I64u | Old TP=%.2f | New TP=%.2f", 
                    isBuy ? "BUY" : "SELL", ticket, currentTP, breakevenTP), "HEAL");
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
    
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Range settings
    double rangeHigh = isBuy ? MathMax(BuyRangeStart, BuyRangeEnd) : MathMax(SellRangeStart, SellRangeEnd);
    double rangeLow = isBuy ? MathMin(BuyRangeStart, BuyRangeEnd) : MathMin(SellRangeStart, SellRangeEnd);
    double gapPips = isBuy ? BuyGapPips : SellGapPips;
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
    
    // ===== STEP 3: Calculate valid grid levels =====
    // Grid levels are calculated from CURRENT PRICE, not from positions
    // This ensures pending orders are always placed correctly relative to market
    double targetLevels[];
    ArrayResize(targetLevels, maxOrders);
    
    // Calculate grid levels from current price
    double baseLevel = rangeLow + MathFloor((currentPrice - rangeLow) / gapPrice) * gapPrice;
    
    if(isBuy)
    {
        // For BUY: pending orders go BELOW current price
        double startLevel = baseLevel;
        if(startLevel >= currentPrice) startLevel -= gapPrice;
        
        // If we have positions, start from the LOWEST position instead
        if(normalPositionCount > 0)
        {
            double lowestPos = positionPrices[0];
            for(int i = 1; i < normalPositionCount; i++)
            {
                if(positionPrices[i] < lowestPos)
                    lowestPos = positionPrices[i];
            }
            // Next pending should be below the lowest position
            double nextLevel = NormalizeDouble(lowestPos - gapPrice, _Digits);
            // Only use this if it's below current price (valid for BUY LIMIT)
            if(nextLevel < currentPrice)
                startLevel = nextLevel;
            
            AddToLog(StringFormat("BUY Grid: Lowest pos=%.2f | Next level=%.2f | Current=%.2f", 
                lowestPos, nextLevel, currentPrice), "GRID");
        }
        
        for(int i = 0; i < maxOrders; i++)
        {
            targetLevels[i] = NormalizeDouble(startLevel - (i * gapPrice), _Digits);
        }
    }
    else
    {
        // For SELL: pending orders go ABOVE current price
        double startLevel = baseLevel + gapPrice;
        if(startLevel <= currentPrice) startLevel += gapPrice;
        
        // If we have positions, start from the HIGHEST position instead
        if(normalPositionCount > 0)
        {
            double highestPos = positionPrices[0];
            for(int i = 1; i < normalPositionCount; i++)
            {
                if(positionPrices[i] > highestPos)
                    highestPos = positionPrices[i];
            }
            // Next pending should be above the highest position
            double nextLevel = NormalizeDouble(highestPos + gapPrice, _Digits);
            // Only use this if it's above current price (valid for SELL LIMIT)
            if(nextLevel > currentPrice)
                startLevel = nextLevel;
            
            AddToLog(StringFormat("SELL Grid: Highest pos=%.2f | Next level=%.2f | Current=%.2f", 
                highestPos, nextLevel, currentPrice), "GRID");
        }
        
        for(int i = 0; i < maxOrders; i++)
        {
            targetLevels[i] = NormalizeDouble(startLevel + (i * gapPrice), _Digits);
        }
    }
    
    // ===== STEP 4: MODIFY existing orders to match target levels (if far from current price) =====
    bool targetOccupied[];
    ArrayResize(targetOccupied, maxOrders);
    ArrayInitialize(targetOccupied, false);
    
    bool orderUsed[];
    ArrayResize(orderUsed, existingOrderCount);
    ArrayInitialize(orderUsed, false);
    
    // First, mark targets occupied by NORMAL positions
    for(int i = 0; i < normalPositionCount; i++)
    {
        for(int j = 0; j < maxOrders; j++)
        {
            if(MathAbs(positionPrices[i] - targetLevels[j]) < minGap)
            {
                targetOccupied[j] = true;
            }
        }
    }
    
    // Try to match existing orders to target levels
    for(int i = 0; i < maxOrders; i++)
    {
        if(targetOccupied[i]) continue;
        
        double targetPrice = targetLevels[i];
        
        // Validate target
        if(targetPrice < rangeLow || targetPrice > rangeHigh) continue;
        
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
        
        // If found an order, check if it needs modification
        if(closestOrderIdx >= 0)
        {
            bool targetValidForPending = isBuy ? (targetPrice < currentPrice) : (targetPrice > currentPrice);
            double absDistToMarket = MathAbs(existingOrderPrices[closestOrderIdx] - currentPrice);
            bool nearExecution = (absDistToMarket <= (gapPrice * 0.5));

            // If order is already at correct level (within 50% of gap), keep it
            if(closestDistance < gapPrice * 0.5)
            {
                bool lotAligned = MathAbs(existingOrderLots[closestOrderIdx] - expectedNormalLot) <= expectedLotStep * 0.5;
                if(lotAligned)
                {
                    targetOccupied[i] = true;
                    orderUsed[closestOrderIdx] = true;
                }
            }
            // If order needs adjustment (more than 50% of gap away), modify it
            else if(closestDistance >= gapPrice * 0.5)
            {
                if(!targetValidForPending || nearExecution)
                {
                    // Don't consume this target with a stale order.
                    // Leave order unused so strict cleanup can delete/reopen if misaligned.
                    continue;
                }

                // DIRECTION GUARD: Only modify if target moves order CLOSER to market price
                // For SELL LIMIT: closer means lower price (toward market below)
                // For BUY LIMIT: closer means higher price (toward market above)
                double currentOrderDist = MathAbs(existingOrderPrices[closestOrderIdx] - currentPrice);
                double newTargetDist = MathAbs(targetPrice - currentPrice);
                
                if(newTargetDist > currentOrderDist)
                {
                    // Target would move order AWAY from market - keep order where it is
                    targetOccupied[i] = true;
                    orderUsed[closestOrderIdx] = true;
                    AddToLog(StringFormat("%s order #%I64u kept at %.2f (target %.2f would move away from market %.2f)", 
                        isBuy ? "BUY" : "SELL", existingOrderTickets[closestOrderIdx], 
                        existingOrderPrices[closestOrderIdx], targetPrice, currentPrice), "GRID");
                    continue;
                }

                double tp = 0, sl = 0;
                if(isBuy)
                {
                    tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(targetPrice + (BuyTakeProfitPips * pip), _Digits) : 0;
                    sl = (BuyStopLossPips > 0) ? NormalizeDouble(targetPrice - (BuyStopLossPips * pip), _Digits) : 0;
                }
                else
                {
                    tp = (SellTakeProfitPips > 0) ? NormalizeDouble(targetPrice - (SellTakeProfitPips * pip), _Digits) : 0;
                    sl = (SellStopLossPips > 0) ? NormalizeDouble(targetPrice + (SellStopLossPips * pip), _Digits) : 0;
                }
                
                if(trade.OrderModify(existingOrderTickets[closestOrderIdx], targetPrice, sl, tp, ORDER_TIME_GTC, 0))
                {
                    AddToLog(StringFormat("%s order #%I64u modified: %.2f -> %.2f (%.1f pips, closer to market)", 
                        isBuy ? "BUY" : "SELL", existingOrderTickets[closestOrderIdx], 
                        existingOrderPrices[closestOrderIdx], targetPrice, closestDistance/pip), "MODIFY");
                    targetOccupied[i] = true;
                    orderUsed[closestOrderIdx] = true;
                }
                else
                {
                    // Modification failed - keep order at current price and mark as used
                    orderUsed[closestOrderIdx] = true;
                }
            }
        }
    }
    
    // Delete any unused orders that are invalid OR not aligned with grid targets
    for(int i = 0; i < existingOrderCount; i++)
    {
        if(!orderUsed[i])
        {
            double orderPrice = existingOrderPrices[i];
            double orderLot = existingOrderLots[i];
            bool validSide = isBuy ? (orderPrice < currentPrice) : (orderPrice > currentPrice);
            bool inRange = (orderPrice >= rangeLow && orderPrice <= rangeHigh);
            bool lotAligned = MathAbs(orderLot - expectedNormalLot) <= expectedLotStep * 0.5;
            bool alignedToTarget = false;
            int alignedTargetIdx = -1;

            for(int j = 0; j < maxOrders; j++)
            {
                // Alignment tolerance is half gap to keep grid strict but stable
                if(MathAbs(orderPrice - targetLevels[j]) < gapPrice * 0.5)
                {
                    alignedToTarget = true;
                    alignedTargetIdx = j;
                    break;
                }
            }

            // Strict cleanup: remove stale/misaligned orders so they can be re-opened correctly
            // But DON'T delete orders that are on correct side and closer to market than nearest target
            // (these are orders that would have been moved away - we want to keep them)
            if(!validSide || !inRange || !lotAligned)
            {
                trade.OrderDelete(existingOrderTickets[i]);
                string reason = !validSide ? "wrong side" : (!inRange ? "out of range" : "lot mismatch");
                AddToLog(StringFormat("%s order #%I64u deleted - %s", isBuy ? "BUY" : "SELL",
                    existingOrderTickets[i], reason), "MODIFY");
            }
            else if(!alignedToTarget)
            {
                // Order is misaligned but on correct side, in range, and lot OK
                // Only delete if it's further from market than nearest target level
                double orderDistToMarket = MathAbs(orderPrice - currentPrice);
                double nearestTargetDist = 999999;
                int nearestTargetIdx = -1;
                for(int j = 0; j < maxOrders; j++)
                {
                    if(!targetOccupied[j])
                    {
                        double td = MathAbs(targetLevels[j] - currentPrice);
                        if(td < nearestTargetDist)
                        {
                            nearestTargetDist = td;
                            nearestTargetIdx = j;
                        }
                    }
                }
                
                if(orderDistToMarket <= nearestTargetDist || nearestTargetIdx < 0)
                {
                    // Order is closer to market than any free target - keep it (direction guard)
                    AddToLog(StringFormat("%s order #%I64u kept at %.2f (closer to market than target)", 
                        isBuy ? "BUY" : "SELL", existingOrderTickets[i], orderPrice), "GRID");
                }
                else
                {
                    trade.OrderDelete(existingOrderTickets[i]);
                    AddToLog(StringFormat("%s order #%I64u deleted - misaligned with grid", isBuy ? "BUY" : "SELL",
                        existingOrderTickets[i]), "MODIFY");
                }
            }
            else
            {
                // Valid and aligned order occupies its matched target slot
                if(alignedTargetIdx >= 0)
                    targetOccupied[alignedTargetIdx] = true;
            }
        }
    }
    
    // ===== STEP 5: Count occupied targets and calculate orders needed =====
    int occupiedCount = 0;
    for(int i = 0; i < maxOrders; i++)
    {
        if(targetOccupied[i]) occupiedCount++;
    }
    
    // Total slots = maxOrders - NORMAL positions
    // Occupied slots = occupiedCount (orders already at target levels)
    // Need to place = (maxOrders - NORMAL positions) - occupiedCount
    int totalSlots = maxOrders - normalPositionCount;
    int ordersNeeded = totalSlots - occupiedCount;
    
    if(ordersNeeded <= 0) 
    {
        AddToLog(StringFormat("%s Normal Grid: %d positions, %d occupied, no orders needed", 
            isBuy ? "BUY" : "SELL", normalPositionCount, occupiedCount), "GRID");
        return;
    }
    
    // Debug log
    AddToLog(StringFormat("%s Normal Grid: %d positions, %d slots, %d occupied, placing %d orders", 
        isBuy ? "BUY" : "SELL", normalPositionCount, totalSlots, occupiedCount, ordersNeeded), "GRID");
    
    // ===== STEP 6: Place new orders at unoccupied target levels =====
    int ordersPlaced = 0;
    
    for(int i = 0; i < maxOrders && ordersPlaced < ordersNeeded; i++)
    {
        // Skip if this target is already occupied
        if(targetOccupied[i]) continue;
        
        double targetPrice = targetLevels[i];
        
        // Validate level is within range
        if(targetPrice < rangeLow || targetPrice > rangeHigh) continue;
        if(isBuy && targetPrice >= currentPrice) continue;
        if(!isBuy && targetPrice <= currentPrice) continue;
        
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
    double currentPriceForCheck = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
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
    double gapPips = isBuy ? BuyRecoveryGapPips : SellRecoveryGapPips;
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
    double gapPipsForRelocate = isBuy ? BuyRecoveryGapPips : SellRecoveryGapPips;
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
                bool validSide = isBuy ? (orderPrice < currentPriceForCheck) : (orderPrice > currentPriceForCheck);
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
    if(totalPositionsThisSide < MaxRecoveryOrders && recoveryPendingCount == 0 && EnableRecovery)
    {
        double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        double gapPips = isBuy ? BuyRecoveryGapPips : SellRecoveryGapPips;
        
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
        
        // Place recovery order
        AddToLog(StringFormat("Attempting to place %s recovery order | Price: %.2f | Lot: %.2f | TP: %.2f | SL: %.2f", 
            isBuy ? "BUY" : "SELL", recoveryPrice, recoveryLot, breakevenTP, recoverySL), "RECOVERY");
            
        if(isBuy)
        {
            if(trade.BuyLimit(recoveryLot, recoveryPrice, _Symbol, recoverySL, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_BUY"))
            {
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
            reason = StringFormat("Max positions reached (%d/%d)", totalPositionsThisSide, MaxRecoveryOrders);
        else if(recoveryPendingCount > 0)
            reason = StringFormat("Recovery order already pending (%d)", recoveryPendingCount);
        else if(!EnableRecovery)
            reason = "Recovery disabled";
        else
            reason = "Unknown";
            
        AddToLog(StringFormat("%s Recovery NOT placed | %s", isBuy ? "BUY" : "SELL", reason), "RECOVERY");
    }
}

//+------------------------------------------------------------------+
//| Ensure Recovery Mode TP - Worker Function                         |
//| Recovery Mode এ long-distance + profitable basket breakeven hit    |
//| করলে close না করে trailing-এ arm করা হয় (specific tickets only)। |
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
                    trade.PositionModify(bundleTickets[b], commonSL, commonTP);
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
            
            if(needsUpdate && trade.PositionModify(ticket, newSL, currentTP))
                updateCount++;
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
//| ট্রেইলিং স্টপ লজিক:                                                  |
//| 1. Normal Mode: প্রতিটি position এর open price থেকে calculate      |
//| 2. Recovery Mode: সব positions এর average price থেকে calculate    |
//|                                                                    |
//| Formula: newSL = basePrice + InitialSL + (priceMovement × Ratio)  |
//| যেখানে priceMovement = currentProfit - TrailingStart              |
//+------------------------------------------------------------------+
void ApplyTrailing()
{
    CleanupBundles();

    // Recovery mode এ average price calculate করি
    // কারণ recovery mode এ সব positions একসাথে close হবে
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
        
        // ===== Mode এবং Settings নির্ধারণ =====
        // Recovery mode হলে average price ব্যবহার হবে, না হলে individual open price
        bool inRecovery = (type == POSITION_TYPE_BUY && buyInRecovery) || (type == POSITION_TYPE_SELL && sellInRecovery);
        double basePrice = inRecovery ? (type == POSITION_TYPE_BUY ? buyAvgPrice : sellAvgPrice) : openPrice;
        
        // Mode অনুযায়ী settings select করি
        double trailingStart = inRecovery ? RecoveryTrailingStartPips : 
            (type == POSITION_TYPE_BUY ? BuyTrailingStartPips : SellTrailingStartPips);
        double initialSL = inRecovery ? RecoveryInitialSLPips :
            (type == POSITION_TYPE_BUY ? BuyInitialSLPips : SellInitialSLPips);
        double trailingRatio = inRecovery ? RecoveryTrailingRatio :
            (type == POSITION_TYPE_BUY ? BuyTrailingRatio : SellTrailingRatio);
        
        // ===== Profit Calculate =====
        // BUY: currentPrice - basePrice (price বাড়লে profit)
        // SELL: basePrice - currentPrice (price কমলে profit)
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
                trade.PositionModify(ticket, safetySL, currentTP);
                AddToLog(StringFormat("Safety SL set: %s #%I64u | Open: %.2f | SL: %.2f", 
                    type == POSITION_TYPE_BUY ? "BUY" : "SELL", ticket, openPrice, safetySL), "TRAILING");
            }
        }
        
        // ===== Trailing Apply =====
        // শুধুমাত্র profit >= trailingStart হলে trailing শুরু হবে
        if(profitPips >= trailingStart)
        {
            // priceMovement = threshold এর পরে কত pip move করেছে
            double priceMovement = profitPips - trailingStart;
            
            // slMovement = priceMovement এর ratio অংশ SL move করবে
            // যেমন: ratio=0.5 মানে price 2 pip move করলে SL 1 pip move করবে
            double slMovement = priceMovement * trailingRatio;
            
            // ===== New SL Calculate =====
            // BUY: basePrice + initialSL + slMovement (উপরে move)
            // SELL: basePrice - initialSL - slMovement (নিচে move)
            double newSL = type == POSITION_TYPE_BUY ?
                NormalizeDouble(basePrice + (initialSL * pip) + (slMovement * pip), _Digits) :
                NormalizeDouble(basePrice - (initialSL * pip) - (slMovement * pip), _Digits);
            
            // ===== SL Update Check =====
            // শুধুমাত্র SL improve হলে update করবে (0.5 pip minimum change)
            bool needsUpdate = (currentSL == 0) || 
                (type == POSITION_TYPE_BUY && newSL > currentSL + (0.5 * pip)) ||
                (type == POSITION_TYPE_SELL && newSL < currentSL - (0.5 * pip));
            
            if(needsUpdate)
            {
                trade.PositionModify(ticket, newSL, currentTP);
                AddToLog(StringFormat("Trailing SL: %s | Profit: %.1f pips", 
                    type == POSITION_TYPE_BUY ? "BUY" : "SELL", profitPips), "TRAILING");
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
    string sellModeText = sellInRecovery ? ">> RECOVERY MODE <<" : "Normal Grid Mode";
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
    string buyModeText = buyInRecovery ? ">> RECOVERY MODE <<" : "Normal Grid Mode";
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
    
    // Determine trading mode
    string tradingMode = "Normal Mode Running";
    if(buyInRecovery && sellInRecovery) tradingMode = "Buy & Sell Recovery Mode Activated!";
    else if(buyInRecovery) tradingMode = "Buy Recovery Mode Activated!";
    else if(sellInRecovery) tradingMode = "Sell Recovery Mode Activated!";
    
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
    jsonRequest += "\"closed_positions\":" + closedJson;
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
        AddToLog(StringFormat("MAX DRAWDOWN HIT: Loss=%.2f / Limit=%.2f | Balance=%.2f Equity=%.2f — Closing all positions",
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
