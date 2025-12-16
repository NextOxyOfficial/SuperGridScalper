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

//--- All Settings Hardcoded (Hidden from user)
#define BuyRangeStart       4001.0
#define BuyRangeEnd         4401.0
#define BuyGapPips          2.0
#define MaxBuyOrders        3
#define BuyTakeProfitPips   3.5
#define BuyStopLossPips     0.0

#define SellRangeStart      4402.0
#define SellRangeEnd        4002.0
#define SellGapPips         6.0
#define MaxSellOrders       4
#define SellTakeProfitPips  5.0
#define SellStopLossPips    0.0

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

#define BuyTrailingStartPips    2.0   // কত pip profit হলে trailing শুরু হবে (Trailing activation threshold)
#define BuyInitialSLPips        1.25   // প্রথমে SL কত pip profit এ set হবে (Initial SL when trailing starts)
#define BuyTrailingRatio        0.5   // প্রতি 1 pip trail এ SL কত pip move করবে (0.5 = 50% of price movement)

#define SellTrailingStartPips   2.0   // SELL এর জন্য trailing শুরু threshold
#define SellInitialSLPips       1.25   // SELL এর জন্য initial SL
#define SellTrailingRatio       0.5   // SELL এর জন্য trailing ratio

// ===== RECOVERY MODE SETTINGS =====
// Recovery mode এ average price থেকে calculate হয়, individual position থেকে না
// Recovery mode activates when positions >= MaxOrders

#define EnableRecovery          true   // Recovery mode enable/disable
#define RecoveryTakeProfitPips  5.0  // Recovery mode এ TP (average price থেকে)
#define RecoveryTrailingStartPips 2.0  // Recovery mode এ trailing শুরু threshold
#define RecoveryInitialSLPips   1.25    // Recovery mode এ initial SL
#define RecoveryTrailingRatio   0.5    // Recovery mode এ trailing ratio
#define RecoveryLotIncrement    0.01   // প্রতি recovery order এ lot size বৃদ্ধি (fixed increment)
#define MaxRecoveryOrders       18

#define LotSize         0.08
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

// Trading Log
struct LogEntry
{
    string timestamp;
    string type;
    string message;
};
LogEntry tradingLog[];
int logMaxSize = 100;

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
    
    // MANDATORY license verification on startup
    if(StringLen(LicenseKey) == 0)
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
    // Re-verify license every 2 minutes (to catch suspensions/deletions)
    static datetime lastLicenseCheck = 0;
    if(TimeCurrent() - lastLicenseCheck > 120) // 2 minutes
    {
        lastLicenseCheck = TimeCurrent();
        VerifyLicense();
        UpdateLicensePanel(); // Update panel only after verification
    }
    
    // STRICT LICENSE CHECK - If license invalid, expired, suspended or deleted
    if(!g_LicenseValid)
    {
        // Close all pending orders immediately when license is invalid
        static datetime lastCleanup = 0;
        if(TimeCurrent() - lastCleanup > 10) // Only cleanup every 10 seconds
        {
            lastCleanup = TimeCurrent();
            CloseAllPendingOrders();
        }
        
        // Show big warning on chart
        Comment("⛔ LICENSE INVALID ⛔\n\n" +
                "Status: " + g_LicenseMessage + "\n\n" +
                "❌ ALL TRADING DISABLED\n" +
                "❌ NEW ORDERS BLOCKED\n\n" +
                "Please renew at: www.markstrades.com");
        return; // Stop all trading completely
    }
    
    // Clear comment when license is valid
    Comment("");
    
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
    }
    
    if(sellInRecovery && !prevSellInRecovery)
    {
        AddToLog("SELL RECOVERY MODE ACTIVATED", "MODE");
    }
    else if(!sellInRecovery && prevSellInRecovery)
    {
        AddToLog("SELL NORMAL MODE RESTORED", "MODE");
    }
    
    prevBuyInRecovery = buyInRecovery;
    prevSellInRecovery = sellInRecovery;
    
    // Clean up invalid/out-of-range orders FIRST (before grid management)
    CleanupInvalidOrders();
    
    // Auto-correction worker - ensures grid is always correct
    AutoCorrectGridOrders();
    
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
//| Auto-Correction Worker - Ensures Grid is Always Correct          |
//+------------------------------------------------------------------+
void AutoCorrectGridOrders()
{
    // This worker runs every tick and ensures:
    // 1. Correct number of orders exist
    // 2. Orders are at correct grid levels
    // 3. Orders match current mode (normal/recovery)
    // 4. No gaps in the grid
    
    double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Check BUY side
    if(!buyInRecovery)
    {
        // Normal mode: Should have (MaxBuyOrders - positions) pending orders
        int normalBuyPos = 0;
        int normalBuyOrders = 0;
        
        // Count normal positions
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(type == POSITION_TYPE_BUY) normalBuyPos++;
        }
        
        // Count normal pending orders
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_BUY_LIMIT) normalBuyOrders++;
        }
        
        int expectedOrders = MaxBuyOrders - normalBuyPos;
        int currentTotal = normalBuyPos + normalBuyOrders;
        
        // Check if we're within buy range
        double buyRangeHigh = MathMax(BuyRangeStart, BuyRangeEnd);
        double buyRangeLow = MathMin(BuyRangeStart, BuyRangeEnd);
        bool inBuyRange = (currentBid >= buyRangeLow && currentBid <= buyRangeHigh);
        
        // Log correction status every 60 seconds
        static datetime lastBuyCorrection = 0;
        if(TimeCurrent() - lastBuyCorrection > 60)
        {
            if(inBuyRange && currentTotal < MaxBuyOrders)
            {
                AddToLog(StringFormat("BUY Auto-Correct: Have %d/%d (Pos:%d Orders:%d) - Need %d more orders", 
                    currentTotal, MaxBuyOrders, normalBuyPos, normalBuyOrders, expectedOrders - normalBuyOrders), "WORKER");
                lastBuyCorrection = TimeCurrent();
            }
            else if(!inBuyRange)
            {
                AddToLog(StringFormat("BUY Auto-Correct: Price %.2f outside range [%.2f-%.2f]", 
                    currentBid, buyRangeLow, buyRangeHigh), "WORKER");
                lastBuyCorrection = TimeCurrent();
            }
        }
    }
    
    // Check SELL side
    if(!sellInRecovery)
    {
        // Normal mode: Should have (MaxSellOrders - positions) pending orders
        int normalSellPos = 0;
        int normalSellOrders = 0;
        
        // Count normal positions
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(type == POSITION_TYPE_SELL) normalSellPos++;
        }
        
        // Count normal pending orders
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") >= 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_SELL_LIMIT) normalSellOrders++;
        }
        
        int expectedOrders = MaxSellOrders - normalSellPos;
        int currentTotal = normalSellPos + normalSellOrders;
        
        // Check if we're within sell range
        double sellRangeHigh = MathMax(SellRangeStart, SellRangeEnd);
        double sellRangeLow = MathMin(SellRangeStart, SellRangeEnd);
        bool inSellRange = (currentAsk >= sellRangeLow && currentAsk <= sellRangeHigh);
        
        // Log correction status every 60 seconds
        static datetime lastSellCorrection = 0;
        if(TimeCurrent() - lastSellCorrection > 60)
        {
            if(inSellRange && currentTotal < MaxSellOrders)
            {
                AddToLog(StringFormat("SELL Auto-Correct: Have %d/%d (Pos:%d Orders:%d) - Need %d more orders", 
                    currentTotal, MaxSellOrders, normalSellPos, normalSellOrders, expectedOrders - normalSellOrders), "WORKER");
                lastSellCorrection = TimeCurrent();
            }
            else if(!inSellRange)
            {
                AddToLog(StringFormat("SELL Auto-Correct: Price %.2f outside range [%.2f-%.2f]", 
                    currentAsk, sellRangeLow, sellRangeHigh), "WORKER");
                lastSellCorrection = TimeCurrent();
            }
        }
    }
    
    // Check recovery mode orders
    if(buyInRecovery)
    {
        int recoveryBuyOrders = 0;
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") < 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_BUY_LIMIT) recoveryBuyOrders++;
        }
        
        static datetime lastBuyRecoveryCheck = 0;
        if(TimeCurrent() - lastBuyRecoveryCheck > 60)
        {
            if(recoveryBuyOrders == 0)
            {
                AddToLog("BUY Recovery Mode: No recovery orders found - will create", "WORKER");
            }
            lastBuyRecoveryCheck = TimeCurrent();
        }
    }
    
    if(sellInRecovery)
    {
        int recoverySellOrders = 0;
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") < 0) continue;
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_SELL_LIMIT) recoverySellOrders++;
        }
        
        static datetime lastSellRecoveryCheck = 0;
        if(TimeCurrent() - lastSellRecoveryCheck > 60)
        {
            if(recoverySellOrders == 0)
            {
                AddToLog("SELL Recovery Mode: No recovery orders found - will create", "WORKER");
            }
            lastSellRecoveryCheck = TimeCurrent();
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
        existingOrderTickets[existingOrderCount] = ticket;
        existingOrderPrices[existingOrderCount] = OrderGetDouble(ORDER_PRICE_OPEN);
        existingOrderCount++;
    }
    
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
    double targetLevels[];
    ArrayResize(targetLevels, maxOrders);
    
    double baseLevel = rangeLow + MathFloor((currentPrice - rangeLow) / gapPrice) * gapPrice;
    
    if(isBuy)
    {
        // BUY orders should be BELOW current price with proper gap
        double startLevel = currentPrice - (gapPrice * 2); // Start 2 gaps below current price
        
        for(int i = 0; i < maxOrders; i++)
        {
            targetLevels[i] = NormalizeDouble(startLevel - (i * gapPrice), _Digits);
            // Ensure within range
            if(targetLevels[i] < rangeLow) targetLevels[i] = rangeLow + (i * gapPrice * 0.5);
        }
    }
    else
    {
        // SELL orders should be ABOVE current price with proper gap
        double startLevel = currentPrice + (gapPrice * 2); // Start 2 gaps above current price
        
        for(int i = 0; i < maxOrders; i++)
        {
            targetLevels[i] = NormalizeDouble(startLevel + (i * gapPrice), _Digits);
            // Ensure within range
            if(targetLevels[i] > rangeHigh) targetLevels[i] = rangeHigh - (i * gapPrice * 0.5);
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
        if(isBuy && targetPrice >= currentPrice) continue;
        if(!isBuy && targetPrice <= currentPrice) continue;
        
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
            // If order is already at correct level (within 50% of gap), keep it
            if(closestDistance < gapPrice * 0.5)
            {
                targetOccupied[i] = true;
                orderUsed[closestOrderIdx] = true;
            }
            // If order needs adjustment (more than 50% of gap away), modify it
            else if(closestDistance >= gapPrice * 0.5)
            {
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
                    AddToLog(StringFormat("%s order #%I64u modified: %.2f -> %.2f (%.1f pips)", 
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
    
    // Delete any unused orders (orders that don't match any target)
    for(int i = 0; i < existingOrderCount; i++)
    {
        if(!orderUsed[i])
        {
            trade.OrderDelete(existingOrderTickets[i]);
            AddToLog(StringFormat("%s order deleted - out of range", isBuy ? "BUY" : "SELL"), "MODIFY");
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
    
    // Set breakeven TP for all positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        double currentTP = PositionGetDouble(POSITION_TP);
        double currentSL = PositionGetDouble(POSITION_SL);
        
        if(MathAbs(currentTP - breakevenTP) > pip * 0.1)
        {
            trade.PositionModify(ticket, currentSL, breakevenTP);
        }
    }
    
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
    
    // Count recovery PENDING orders
    int recoveryPendingCount = 0;
    for(int i = 0; i < OrdersTotal(); i++)
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
                recoveryPendingCount++;
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
    static datetime lastStatusLog = 0;
    if(TimeCurrent() - lastStatusLog > 10)
    {
        AddToLog(StringFormat("%s Recovery Status | Positions: %d/%d | Pending: %d | Enabled: %s", 
            isBuy ? "BUY" : "SELL", totalPositionsThisSide, MaxRecoveryOrders, 
            recoveryPendingCount, EnableRecovery ? "YES" : "NO"), "RECOVERY");
        lastStatusLog = TimeCurrent();
    }
    
    // Place recovery order if needed (only 1 pending at a time, max total positions = MaxRecoveryOrders)
    if(totalPositionsThisSide < MaxRecoveryOrders && recoveryPendingCount == 0 && EnableRecovery)
    {
        // Find extreme position (lowest BUY or highest SELL)
        double extremePrice = isBuy ? 999999 : 0;
        double extremeLot = LotSize;
        
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
            
            if((isBuy && openPrice < extremePrice) || (!isBuy && openPrice > extremePrice))
            {
                extremePrice = openPrice;
                extremeLot = lots;
            }
        }
        
        // Safety check - if no extreme found, skip
        if((isBuy && extremePrice >= 999999) || (!isBuy && extremePrice <= 0)) return;
        
        // Calculate recovery order price and lot
        double gapPips = isBuy ? BuyGapPips : SellGapPips;
        double recoveryPrice = isBuy ?
            NormalizeDouble(extremePrice - (gapPips * pip), _Digits) :
            NormalizeDouble(extremePrice + (gapPips * pip), _Digits);
        
        // Debug log
        AddToLog(StringFormat("%s Recovery: Extreme=%.2f | Target=%.2f | Gap=%.1f pips", 
            isBuy ? "BUY" : "SELL", extremePrice, recoveryPrice, gapPips), "RECOVERY");
        
        // Validate recovery price is valid for pending order
        double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        
        // BUY LIMIT must be below current price, SELL LIMIT must be above current price
        // More lenient check - only skip if price is actually invalid for limit order
        if(isBuy && recoveryPrice >= currentPrice) 
        {
            AddToLog(StringFormat("Recovery order skipped - price %.2f >= current %.2f (will adjust)", recoveryPrice, currentPrice), "RECOVERY");
            // Adjust price to be below current price
            recoveryPrice = NormalizeDouble(currentPrice - (gapPips * pip), _Digits);
            AddToLog(StringFormat("Adjusted recovery price to %.2f", recoveryPrice), "RECOVERY");
        }
        if(!isBuy && recoveryPrice <= currentPrice)
        {
            AddToLog(StringFormat("Recovery order skipped - price %.2f <= current %.2f (will adjust)", recoveryPrice, currentPrice), "RECOVERY");
            // Adjust price to be above current price
            recoveryPrice = NormalizeDouble(currentPrice + (gapPips * pip), _Digits);
            AddToLog(StringFormat("Adjusted recovery price to %.2f", recoveryPrice), "RECOVERY");
        }
        
        // ===== DUPLICATE CHECK for recovery order =====
        double gapPrice = gapPips * pip;
        bool duplicateExists = false;
        
        // Check ONLY recovery pending orders (ignore normal orders as they will be deleted)
        for(int k = 0; k < OrdersTotal(); k++)
        {
            ulong ticket = OrderGetTicket(k);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "Recovery") < 0) continue; // Skip normal orders
            
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if((isBuy && type != ORDER_TYPE_BUY_LIMIT) || (!isBuy && type != ORDER_TYPE_SELL_LIMIT)) continue;
            
            double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
            if(MathAbs(orderPrice - recoveryPrice) < gapPrice * 0.5)
            {
                duplicateExists = true;
                AddToLog(StringFormat("%s Recovery order already exists @ %.2f", isBuy ? "BUY" : "SELL", orderPrice), "RECOVERY");
                break;
            }
        }
        
        // Check all positions (to avoid placing order too close to existing position)
        if(!duplicateExists)
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
                    duplicateExists = true;
                    AddToLog(StringFormat("%s Recovery skipped - position exists @ %.2f", isBuy ? "BUY" : "SELL", posPrice), "RECOVERY");
                    break;
                }
            }
        }
        
        // Skip if duplicate found
        if(duplicateExists) return;
        
        // Fixed increment logic: add 0.01 to previous lot size
        double recoveryLot = extremeLot + RecoveryLotIncrement;
        
        // Ensure lot is within broker limits and properly normalized
        double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
        double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
        double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
        if(minLot <= 0) minLot = 0.01;
        if(maxLot <= 0) maxLot = 100.0;
        if(lotStep <= 0) lotStep = 0.01;
        recoveryLot = MathFloor(recoveryLot / lotStep) * lotStep;
        recoveryLot = MathMax(minLot, MathMin(maxLot, recoveryLot));
        
        // Place recovery order
        AddToLog(StringFormat("Attempting to place %s recovery order | Price: %.2f | Lot: %.2f | TP: %.2f", 
            isBuy ? "BUY" : "SELL", recoveryPrice, recoveryLot, breakevenTP), "RECOVERY");
            
        if(isBuy)
        {
            if(trade.BuyLimit(recoveryLot, recoveryPrice, _Symbol, 0, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_BUY"))
            {
                AddToLog(StringFormat("✅ Recovery BUY placed @ %.2f | Lot: %.2f | TP: %.2f", recoveryPrice, recoveryLot, breakevenTP), "RECOVERY");
            }
            else
            {
                AddToLog(StringFormat("❌ Failed to place recovery BUY | Error: %d | RetCode: %d", 
                    GetLastError(), trade.ResultRetcode()), "RECOVERY");
            }
        }
        else
        {
            if(trade.SellLimit(recoveryLot, recoveryPrice, _Symbol, 0, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_SELL"))
            {
                AddToLog(StringFormat("✅ Recovery SELL placed @ %.2f | Lot: %.2f | TP: %.2f", recoveryPrice, recoveryLot, breakevenTP), "RECOVERY");
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
//| প্রতি tick এ ensure করে যে Recovery Mode এ সব positions এর TP      |
//| breakeven এ আছে (average price + RecoveryTakeProfitPips)         |
//+------------------------------------------------------------------+
void EnsureRecoveryModeTP()
{
    // BUY Recovery Mode TP Management
    if(buyInRecovery)
    {
        double buyAvgPrice = 0, buyTotalLots = 0;
        
        // Calculate average price for BUY positions
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(type != POSITION_TYPE_BUY) continue;
            
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double lots = PositionGetDouble(POSITION_VOLUME);
            
            buyAvgPrice += openPrice * lots;
            buyTotalLots += lots;
        }
        
        if(buyTotalLots > 0)
        {
            buyAvgPrice = buyAvgPrice / buyTotalLots;
            double buyBreakevenTP = NormalizeDouble(buyAvgPrice + (RecoveryTakeProfitPips * pip), _Digits);
            
            // Update TP for all BUY positions
            for(int i = 0; i < PositionsTotal(); i++)
            {
                ulong ticket = PositionGetTicket(i);
                if(ticket <= 0) continue;
                if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
                if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
                
                ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                if(type != POSITION_TYPE_BUY) continue;
                
                double currentTP = PositionGetDouble(POSITION_TP);
                double currentSL = PositionGetDouble(POSITION_SL);
                
                // Force update TP to breakeven if different
                if(MathAbs(currentTP - buyBreakevenTP) > pip * 0.1)
                {
                    trade.PositionModify(ticket, currentSL, buyBreakevenTP);
                }
            }
        }
    }
    
    // SELL Recovery Mode TP Management
    if(sellInRecovery)
    {
        double sellAvgPrice = 0, sellTotalLots = 0;
        
        // Calculate average price for SELL positions
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(type != POSITION_TYPE_SELL) continue;
            
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double lots = PositionGetDouble(POSITION_VOLUME);
            
            sellAvgPrice += openPrice * lots;
            sellTotalLots += lots;
        }
        
        if(sellTotalLots > 0)
        {
            sellAvgPrice = sellAvgPrice / sellTotalLots;
            double sellBreakevenTP = NormalizeDouble(sellAvgPrice - (RecoveryTakeProfitPips * pip), _Digits);
            
            // Update TP for all SELL positions
            for(int i = 0; i < PositionsTotal(); i++)
            {
                ulong ticket = PositionGetTicket(i);
                if(ticket <= 0) continue;
                if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
                if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
                
                ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                if(type != POSITION_TYPE_SELL) continue;
                
                double currentTP = PositionGetDouble(POSITION_TP);
                double currentSL = PositionGetDouble(POSITION_SL);
                
                // Force update TP to breakeven if different
                if(MathAbs(currentTP - sellBreakevenTP) > pip * 0.1)
                {
                    trade.PositionModify(ticket, currentSL, sellBreakevenTP);
                }
            }
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
//| Verify License with Server                                        |
//+------------------------------------------------------------------+
bool VerifyLicense()
{
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
        else
        {
            g_LicenseMessage = "SERVER CONNECTION FAILED (Error: " + IntegerToString(error) + ")";
        }
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
