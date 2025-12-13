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
input string    TesterLicenseKey = "TEST-LOCAL";

//--- All Settings Hardcoded (Hidden from user)
#define BuyRangeStart       4001.0
#define BuyRangeEnd         4401.0
#define BuyGapPips          4.0
#define MaxBuyOrders        3
#define BuyTakeProfitPips   25.0
#define BuyStopLossPips     0.0

#define SellRangeStart      4402.0
#define SellRangeEnd        4002.0
#define SellGapPips         4.0
#define MaxSellOrders       3
#define SellTakeProfitPips  25.0
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

#define BuyTrailingStartPips    3.0   // কত pip profit হলে trailing শুরু হবে (Trailing activation threshold)
#define BuyInitialSLPips        2.0   // প্রথমে SL কত pip profit এ set হবে (Initial SL when trailing starts)
#define BuyTrailingRatio        0.5   // প্রতি 1 pip trail এ SL কত pip move করবে (0.5 = 50% of price movement)

#define SellTrailingStartPips   3.0   // SELL এর জন্য trailing শুরু threshold
#define SellInitialSLPips       2.0   // SELL এর জন্য initial SL
#define SellTrailingRatio       0.5   // SELL এর জন্য trailing ratio

// ===== RECOVERY MODE SETTINGS =====
// Recovery mode এ average price থেকে calculate হয়, individual position থেকে না
// Recovery mode activates when positions >= MaxOrders

#define EnableRecovery          true   // Recovery mode enable/disable
#define RecoveryTakeProfitPips  25.0  // Recovery mode এ TP (average price থেকে)
#define RecoveryTrailingStartPips 3.0  // Recovery mode এ trailing শুরু threshold
#define RecoveryInitialSLPips   2.0    // Recovery mode এ initial SL
#define RecoveryTrailingRatio   0.5    // Recovery mode এ trailing ratio
#define RecoveryLotIncrease     10.0
#define MaxRecoveryOrders       3

// ===== SUPER MARK RECOVERY MODE SETTINGS =====
// Super Mark Recovery Mode activates when Recovery Mode hits MaxRecoveryOrders
// This is the final safety net - focuses on closing highest loss trades first
// Logic: Opens grid positions at current price to help recover the worst positions

#define EnableSuperMarkRecovery     true    // Enable/Disable Super Mark Recovery Mode
#define SuperMarkMinLot             1.0    // Minimum lot size for Super Mark grid orders
#define SuperMarkMaxLot             2.0    // Maximum lot size for Super Mark grid orders
#define SuperMarkGridGap            5.0     // Gap between Super Mark grid orders (pips)
#define SuperMarkMaxOrders          3      // Maximum Super Mark grid orders to place
#define SuperMarkBreakevenPips      2.0     // Extra profit pips on each recovery (breakeven + this amount)
#define SuperMarkLevelGap           15.0    // Gap between levels (pips) - distance from Level N last order to Level N+1 first order
#define SuperMarkActivationGap      5.0    // Gap (pips) from Recovery max hit price to Super Mark Level 1 activation
#define SuperMarkTrailingStartPips  3.0     // Super Mark trailing starts after this profit (pips)
#define SuperMarkTrailingSLPips     2.0     // Super Mark trailing stop loss distance (pips)
#define SuperMarkTrailingRatio      0.5     // Super Mark trailing ratio (0.5 = 0.5 pip SL move per 1 pip price move)
#define SuperMarkMaxTPPips          25.0    // Super Mark maximum take profit (pips)

#define LotSize         0.15
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
bool buyInSuperMarkRecovery = false;
bool sellInSuperMarkRecovery = false;
double superMarkBuyInitialBalance = 0;    // Balance when Super Mark Recovery activated for BUY
double superMarkSellInitialBalance = 0;   // Balance when Super Mark Recovery activated for SELL

// Dynamic Super Mark Levels - can go to infinity (1, 2, 3, 4...)
int superMarkBuyLevel = 0;                // Current Super Mark level for BUY (0 = not active)
int superMarkSellLevel = 0;               // Current Super Mark level for SELL (0 = not active)
double superMarkBuyLevelPrices[];         // Price when each level was activated (for downgrade detection)
double superMarkSellLevelPrices[];        // Price when each level was activated (for downgrade detection)
double recoveryMaxHitBuyPrice = 0;        // Price when Recovery Mode hit max orders (for BUY)
double recoveryMaxHitSellPrice = 0;       // Price when Recovery Mode hit max orders (for SELL)
bool recoveryMaxHitBuy = false;           // Flag: Recovery max hit, waiting for activation gap
bool recoveryMaxHitSell = false;          // Flag: Recovery max hit, waiting for activation gap
bool superMarkBuyGridPlaced = false;      // Flag: Super Mark BUY grid orders already placed for current level
bool superMarkSellGridPlaced = false;     // Flag: Super Mark SELL grid orders already placed for current level

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

    // Strategy Tester auto-bypass - no license needed in tester
    bool isTester = (bool)MQLInfoInteger(MQL_TESTER);
    if(isTester)
    {
        g_LicenseValid = true;
        g_LicenseMessage = "TEST MODE";
        g_PlanName = "Tester";
        g_DaysRemaining = 9999;
        g_LastVerification = TimeCurrent();
        UpdateLicensePanel();
        return(INIT_SUCCEEDED);
    }
    
    // MANDATORY license verification on startup (Live only)
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
    // Strategy Tester auto-bypass - no license needed in tester
    bool isTester = (bool)MQLInfoInteger(MQL_TESTER);
    if(isTester)
    {
        g_LicenseValid = true;
        g_LicenseMessage = "TEST MODE";
    }

    // Re-verify license every 2 minutes (to catch suspensions/deletions) - Live only
    static datetime lastLicenseCheck = 0;
    if(!isTester && TimeCurrent() - lastLicenseCheck > 120) // 2 minutes
    {
        lastLicenseCheck = TimeCurrent();
        VerifyLicense();
        UpdateLicensePanel(); // Update panel only after verification
    }
    
    // STRICT LICENSE CHECK - If license invalid, expired, suspended or deleted (Live only)
    if(!isTester && !g_LicenseValid)
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
    static bool prevBuyInSuperMarkRecovery = false;
    static bool prevSellInSuperMarkRecovery = false;
    
    // Count total positions for Super Mark Recovery detection (excluding Super Mark positions)
    int totalBuyPositionsCount = 0;
    int totalSellPositionsCount = 0;
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        // Skip Super Mark positions - they should not trigger Super Mark activation
        if(StringFind(comment, "SuperMark") >= 0) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if(type == POSITION_TYPE_BUY) totalBuyPositionsCount++;
        else totalSellPositionsCount++;
    }
    
    // Determine mode
    buyInRecovery = (currentBuyPositions >= MaxBuyOrders);
    sellInRecovery = (currentSellPositions >= MaxSellOrders);
    
    // Super Mark Recovery Mode activation - Dynamic Levels (1, 2, 3, 4... infinity)
    // Level upgrades when max orders hit, downgrades when price moves back
    if(EnableSuperMarkRecovery)
    {
        double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
        double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        
        // ===== BUY SUPER MARK LOGIC =====
        // Count Super Mark positions and orders for current level
        int buySmPositions = 0, buySmPending = 0;
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            if(PositionGetInteger(POSITION_TYPE) != POSITION_TYPE_BUY) continue;
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0) buySmPositions++;
        }
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            if(OrderGetInteger(ORDER_TYPE) != ORDER_TYPE_BUY_LIMIT) continue;
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0) buySmPending++;
        }
        int totalBuySuperMark = buySmPositions + buySmPending;
        
        // Initial activation: Total positions (Normal + Recovery) >= MaxBuyOrders + MaxRecoveryOrders
        // Step 1: Record the price when max positions hit (3 normal + 6 recovery = 9 total)
        int totalRequiredForSuperMark = MaxBuyOrders + MaxRecoveryOrders;
        if(buyInRecovery && totalBuyPositionsCount >= totalRequiredForSuperMark && !buyInSuperMarkRecovery && !recoveryMaxHitBuy)
        {
            recoveryMaxHitBuy = true;
            recoveryMaxHitBuyPrice = currentBid;
            AddToLog(StringFormat("BUY RECOVERY MAX HIT | Positions: %d/%d | Price: %.2f | Waiting for %.0f pips gap to activate Super Mark", 
                totalBuyPositionsCount, totalRequiredForSuperMark, currentBid, SuperMarkActivationGap), "SUPERMARK");
        }
        
        // Step 2: Activate Super Mark when price moves down by activation gap
        if(recoveryMaxHitBuy && !buyInSuperMarkRecovery)
        {
            double activationPrice = recoveryMaxHitBuyPrice - (SuperMarkActivationGap * pip);
            if(currentBid <= activationPrice)
            {
                buyInSuperMarkRecovery = true;
                superMarkBuyLevel = 1;
                superMarkBuyGridPlaced = false;  // Reset grid placed flag for new level
                superMarkBuyInitialBalance = AccountInfoDouble(ACCOUNT_BALANCE);
                ArrayResize(superMarkBuyLevelPrices, 1);
                superMarkBuyLevelPrices[0] = currentBid;
                AddToLog(StringFormat("BUY SUPER MARK LEVEL 1 ACTIVATED | Price: %.2f | Gap: %.0f pips from %.2f | Balance: %.2f", 
                    currentBid, SuperMarkActivationGap, recoveryMaxHitBuyPrice, superMarkBuyInitialBalance), "SUPERMARK");
            }
        }
        
        // Reset recovery max hit flag when Super Mark deactivates
        if(!buyInSuperMarkRecovery && !buyInRecovery)
        {
            recoveryMaxHitBuy = false;
            recoveryMaxHitBuyPrice = 0;
        }
        
        // Level UPGRADE: Current level max orders hit, market going further down
        if(buyInSuperMarkRecovery && totalBuySuperMark >= SuperMarkMaxOrders)
        {
            // Check if we need to upgrade to next level
            double lastLevelPrice = superMarkBuyLevelPrices[superMarkBuyLevel - 1];
            // Level range = grid orders range + level gap between levels
            double levelGridRange = SuperMarkGridGap * SuperMarkMaxOrders * pip;
            double levelGapDistance = SuperMarkLevelGap * pip;
            double totalLevelDistance = levelGridRange + levelGapDistance;
            
            // If price moved down by total distance (grid range + level gap), upgrade
            if(currentBid <= lastLevelPrice - totalLevelDistance)
            {
                superMarkBuyLevel++;
                superMarkBuyGridPlaced = false;  // Reset grid placed flag for new level
                ArrayResize(superMarkBuyLevelPrices, superMarkBuyLevel);
                superMarkBuyLevelPrices[superMarkBuyLevel - 1] = currentBid;
                AddToLog(StringFormat("BUY SUPER MARK LEVEL %d ACTIVATED | Price: %.2f | Gap from L%d: %.0f pips", 
                    superMarkBuyLevel, currentBid, superMarkBuyLevel - 1, SuperMarkLevelGap), "SUPERMARK");
            }
        }
        
        // Level DOWNGRADE: Price moved back up to previous level range
        if(buyInSuperMarkRecovery && superMarkBuyLevel > 1)
        {
            double prevLevelPrice = superMarkBuyLevelPrices[superMarkBuyLevel - 2];
            // If price moved back up to previous level price, downgrade
            if(currentBid >= prevLevelPrice)
            {
                superMarkBuyLevel--;
                superMarkBuyGridPlaced = false;  // Reset flag for downgraded level
                ArrayResize(superMarkBuyLevelPrices, superMarkBuyLevel);
                AddToLog(StringFormat("BUY SUPER MARK DOWNGRADED TO LEVEL %d | Price: %.2f", 
                    superMarkBuyLevel, currentBid), "SUPERMARK");
            }
        }
        
        // Deactivate Super Mark and return to Recovery Mode when:
        // 1. Level becomes 0 (Level 1 completed breakeven)
        // 2. Total positions dropped below Super Mark activation threshold
        if(buyInSuperMarkRecovery && (superMarkBuyLevel == 0 || totalBuyPositionsCount < totalRequiredForSuperMark))
        {
            buyInSuperMarkRecovery = false;
            superMarkBuyLevel = 0;
            superMarkBuyInitialBalance = 0;
            ArrayResize(superMarkBuyLevelPrices, 0);
            AddToLog(StringFormat("BUY SUPER MARK DEACTIVATED - Returning to Recovery Mode | Positions: %d/%d", 
                totalBuyPositionsCount, totalRequiredForSuperMark), "SUPERMARK");
        }
        
        // Full deactivation when ALL positions closed
        if(buyInSuperMarkRecovery && totalBuyPositionsCount == 0)
        {
            buyInSuperMarkRecovery = false;
            buyInRecovery = false;
            superMarkBuyLevel = 0;
            superMarkBuyInitialBalance = 0;
            ArrayResize(superMarkBuyLevelPrices, 0);
            AddToLog("BUY SUPER MARK RECOVERY COMPLETED - All positions closed", "SUPERMARK");
        }
        
        // ===== SELL SUPER MARK LOGIC =====
        int sellSmPositions = 0, sellSmPending = 0;
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            if(PositionGetInteger(POSITION_TYPE) != POSITION_TYPE_SELL) continue;
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0) sellSmPositions++;
        }
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            if(OrderGetInteger(ORDER_TYPE) != ORDER_TYPE_SELL_LIMIT) continue;
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0) sellSmPending++;
        }
        int totalSellSuperMark = sellSmPositions + sellSmPending;
        
        // Initial activation: Total positions (Normal + Recovery) >= MaxSellOrders + MaxRecoveryOrders
        // Step 1: Record the price when max positions hit (3 normal + 6 recovery = 9 total)
        int totalRequiredForSuperMarkSell = MaxSellOrders + MaxRecoveryOrders;
        if(sellInRecovery && totalSellPositionsCount >= totalRequiredForSuperMarkSell && !sellInSuperMarkRecovery && !recoveryMaxHitSell)
        {
            recoveryMaxHitSell = true;
            recoveryMaxHitSellPrice = currentAsk;
            AddToLog(StringFormat("SELL RECOVERY MAX HIT | Positions: %d/%d | Price: %.2f | Waiting for %.0f pips gap to activate Super Mark", 
                totalSellPositionsCount, totalRequiredForSuperMarkSell, currentAsk, SuperMarkActivationGap), "SUPERMARK");
        }
        
        // Step 2: Activate Super Mark when price moves up by activation gap
        if(recoveryMaxHitSell && !sellInSuperMarkRecovery)
        {
            double activationPrice = recoveryMaxHitSellPrice + (SuperMarkActivationGap * pip);
            if(currentAsk >= activationPrice)
            {
                sellInSuperMarkRecovery = true;
                superMarkSellLevel = 1;
                superMarkSellGridPlaced = false;  // Reset grid placed flag for new level
                superMarkSellInitialBalance = AccountInfoDouble(ACCOUNT_BALANCE);
                ArrayResize(superMarkSellLevelPrices, 1);
                superMarkSellLevelPrices[0] = currentAsk;
                AddToLog(StringFormat("SELL SUPER MARK LEVEL 1 ACTIVATED | Price: %.2f | Gap: %.0f pips from %.2f | Balance: %.2f", 
                    currentAsk, SuperMarkActivationGap, recoveryMaxHitSellPrice, superMarkSellInitialBalance), "SUPERMARK");
            }
        }
        
        // Reset recovery max hit flag when Super Mark deactivates
        if(!sellInSuperMarkRecovery && !sellInRecovery)
        {
            recoveryMaxHitSell = false;
            recoveryMaxHitSellPrice = 0;
        }
        
        // Level UPGRADE for SELL
        if(sellInSuperMarkRecovery && totalSellSuperMark >= SuperMarkMaxOrders)
        {
            double lastLevelPrice = superMarkSellLevelPrices[superMarkSellLevel - 1];
            // Level range = grid orders range + level gap between levels
            double levelGridRange = SuperMarkGridGap * SuperMarkMaxOrders * pip;
            double levelGapDistance = SuperMarkLevelGap * pip;
            double totalLevelDistance = levelGridRange + levelGapDistance;
            
            if(currentAsk >= lastLevelPrice + totalLevelDistance)
            {
                superMarkSellLevel++;
                superMarkSellGridPlaced = false;  // Reset grid placed flag for new level
                ArrayResize(superMarkSellLevelPrices, superMarkSellLevel);
                superMarkSellLevelPrices[superMarkSellLevel - 1] = currentAsk;
                AddToLog(StringFormat("SELL SUPER MARK LEVEL %d ACTIVATED | Price: %.2f | Gap from L%d: %.0f pips", 
                    superMarkSellLevel, currentAsk, superMarkSellLevel - 1, SuperMarkLevelGap), "SUPERMARK");
            }
        }
        
        // Level DOWNGRADE for SELL
        if(sellInSuperMarkRecovery && superMarkSellLevel > 1)
        {
            double prevLevelPrice = superMarkSellLevelPrices[superMarkSellLevel - 2];
            if(currentAsk <= prevLevelPrice)
            {
                superMarkSellLevel--;
                superMarkSellGridPlaced = false;  // Reset flag for downgraded level
                ArrayResize(superMarkSellLevelPrices, superMarkSellLevel);
                AddToLog(StringFormat("SELL SUPER MARK DOWNGRADED TO LEVEL %d | Price: %.2f", 
                    superMarkSellLevel, currentAsk), "SUPERMARK");
            }
        }
        
        // Deactivate Super Mark and return to Recovery Mode when:
        // 1. Level becomes 0 (Level 1 completed breakeven)
        // 2. Total positions dropped below Super Mark activation threshold
        if(sellInSuperMarkRecovery && (superMarkSellLevel == 0 || totalSellPositionsCount < totalRequiredForSuperMarkSell))
        {
            sellInSuperMarkRecovery = false;
            superMarkSellLevel = 0;
            superMarkSellInitialBalance = 0;
            ArrayResize(superMarkSellLevelPrices, 0);
            AddToLog(StringFormat("SELL SUPER MARK DEACTIVATED - Returning to Recovery Mode | Positions: %d/%d", 
                totalSellPositionsCount, totalRequiredForSuperMarkSell), "SUPERMARK");
        }
        
        // Full deactivation when ALL positions closed
        if(sellInSuperMarkRecovery && totalSellPositionsCount == 0)
        {
            sellInSuperMarkRecovery = false;
            sellInRecovery = false;
            superMarkSellLevel = 0;
            superMarkSellInitialBalance = 0;
            ArrayResize(superMarkSellLevelPrices, 0);
            AddToLog("SELL SUPER MARK RECOVERY COMPLETED - All positions closed", "SUPERMARK");
        }
    }
    
    // Log mode changes
    if(buyInSuperMarkRecovery && !prevBuyInSuperMarkRecovery)
    {
        AddToLog(">>> BUY SUPER MARK RECOVERY MODE ACTIVATED <<<", "MODE");
    }
    else if(!buyInSuperMarkRecovery && prevBuyInSuperMarkRecovery)
    {
        AddToLog("BUY SUPER MARK RECOVERY MODE DEACTIVATED", "MODE");
    }
    else if(buyInRecovery && !prevBuyInRecovery && !buyInSuperMarkRecovery)
    {
        AddToLog("BUY RECOVERY MODE ACTIVATED", "MODE");
    }
    else if(!buyInRecovery && prevBuyInRecovery && !buyInSuperMarkRecovery)
    {
        AddToLog("BUY NORMAL MODE RESTORED", "MODE");
    }
    
    if(sellInSuperMarkRecovery && !prevSellInSuperMarkRecovery)
    {
        AddToLog(">>> SELL SUPER MARK RECOVERY MODE ACTIVATED <<<", "MODE");
    }
    else if(!sellInSuperMarkRecovery && prevSellInSuperMarkRecovery)
    {
        AddToLog("SELL SUPER MARK RECOVERY MODE DEACTIVATED", "MODE");
    }
    else if(sellInRecovery && !prevSellInRecovery && !sellInSuperMarkRecovery)
    {
        AddToLog("SELL RECOVERY MODE ACTIVATED", "MODE");
    }
    else if(!sellInRecovery && prevSellInRecovery && !sellInSuperMarkRecovery)
    {
        AddToLog("SELL NORMAL MODE RESTORED", "MODE");
    }
    
    prevBuyInRecovery = buyInRecovery;
    prevSellInRecovery = sellInRecovery;
    prevBuyInSuperMarkRecovery = buyInSuperMarkRecovery;
    prevSellInSuperMarkRecovery = sellInSuperMarkRecovery;
    
    // Clean up invalid/out-of-range orders FIRST (before grid management)
    CleanupInvalidOrders();
    
    // Auto-correction worker - ensures grid is always correct
    AutoCorrectGridOrders();
    
    // Manage grids based on mode
    // Priority: Super Mark Recovery > Recovery > Normal
    if(buyInSuperMarkRecovery)
    {
        // Super Mark Recovery Mode - disable all other modes
        DeleteNormalPendingOrders(true);
        DeleteRecoveryPendingOrders(true);
        ManageSuperMarkRecovery(true);
    }
    else if(!buyInRecovery)
    {
        ManageNormalGrid(true);  // BUY Normal Mode
    }
    else
    {
        // BUY Recovery Mode - delete normal pending orders first
        DeleteNormalPendingOrders(true);
        ManageRecoveryGrid(true); // BUY Recovery
    }
        
    if(sellInSuperMarkRecovery)
    {
        // Super Mark Recovery Mode - disable all other modes
        DeleteNormalPendingOrders(false);
        DeleteRecoveryPendingOrders(false);
        ManageSuperMarkRecovery(false);
    }
    else if(!sellInRecovery)
    {
        ManageNormalGrid(false); // SELL Normal Mode
    }
    else
    {
        // SELL Recovery Mode - delete normal pending orders first
        DeleteNormalPendingOrders(false);
        ManageRecoveryGrid(false); // SELL Recovery
    }
    
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
    
    // Count ALL filled positions (excluding Super Mark)
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        // Skip Super Mark positions - they are managed separately
        if(StringFind(comment, "SuperMark") >= 0) continue;
        
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
        if(StringFind(comment, "SuperMark") >= 0) continue; // Skip SuperMark orders
        
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
        if(StringFind(comment, "SuperMark") >= 0) continue; // Keep Super Mark orders
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            trade.OrderDelete(ticket);
    }
}

//+------------------------------------------------------------------+
//| Delete Recovery Pending Orders (when entering Super Mark mode)    |
//+------------------------------------------------------------------+
void DeleteRecoveryPendingOrders(bool isBuy)
{
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "Recovery") < 0) continue; // Only delete recovery orders
        if(StringFind(comment, "SuperMark") >= 0) continue; // Keep Super Mark orders
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
        {
            trade.OrderDelete(ticket);
            AddToLog(StringFormat("Deleted Recovery %s order for Super Mark mode", isBuy ? "BUY" : "SELL"), "SUPERMARK");
        }
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
        bool isSuperMark = (StringFind(comment, "SuperMark") >= 0);
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        
        bool shouldDelete = false;
        string reason = "";
        
        // Check BUY orders - delete ONLY if mode mismatch
        if(type == ORDER_TYPE_BUY_LIMIT)
        {
            // SuperMark orders have their own lifecycle/range rules
            if(isSuperMark) continue;
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
            // SuperMark orders have their own lifecycle/range rules
            if(isSuperMark) continue;
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
        bool isSuperMark = (StringFind(comment, "SuperMark") >= 0);
        bool shouldDelete = false;
        string reason = "";

        // SuperMark pending orders are allowed to exist outside normal buy/sell ranges
        // and are validated/managed by ManageSuperMarkRecovery().
        if(isSuperMark) continue;
        
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
                // Must be below current price
                else if(orderPrice >= currentBid)
                {
                    shouldDelete = true;
                    reason = "Above current price";
                }
            }
            // Recovery orders: just check if above current price
            else if(orderPrice >= currentBid)
            {
                shouldDelete = true;
                reason = "Recovery order above price";
            }
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
                // Must be above current price
                else if(orderPrice <= currentAsk)
                {
                    shouldDelete = true;
                    reason = "Below current price";
                }
            }
            // Recovery orders: just check if below current price
            else if(orderPrice <= currentAsk)
            {
                shouldDelete = true;
                reason = "Recovery order below price";
            }
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
    
    // Check for duplicate orders (same price, same type) - Skip Super Mark orders
    for(int i = 0; i < OrdersTotal() - 1; i++)
    {
        ulong ticket1 = OrderGetTicket(i);
        if(ticket1 <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment1 = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment1, "SuperMark") >= 0) continue;  // Skip Super Mark orders
        
        ENUM_ORDER_TYPE type1 = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        double price1 = OrderGetDouble(ORDER_PRICE_OPEN);
        
        // Check against all other orders
        for(int j = i + 1; j < OrdersTotal(); j++)
        {
            ulong ticket2 = OrderGetTicket(j);
            if(ticket2 <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment2 = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment2, "SuperMark") >= 0) continue;  // Skip Super Mark orders
            
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
        if(StringFind(comment, "SuperMark") >= 0) continue; // Skip Super Mark orders
        
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
        if(StringFind(comment, "SuperMark") >= 0) continue; // Skip SuperMark positions
        
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
            if(StringFind(comment, "SuperMark") >= 0) continue;  // Skip Super Mark orders
            
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
            if(StringFind(comment, "SuperMark") >= 0) continue;  // Skip Super Mark orders
            
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
    
    // Check BUY side (skip if in Super Mark mode)
    if(!buyInRecovery && !buyInSuperMarkRecovery)
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
    
    // Check SELL side (skip if in Super Mark mode)
    if(!sellInRecovery && !sellInSuperMarkRecovery)
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
    
    // Check recovery mode orders (skip if in Super Mark mode)
    if(buyInRecovery && !buyInSuperMarkRecovery)
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
    
    if(sellInRecovery && !sellInSuperMarkRecovery)
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
    
    // Check Super Mark mode orders
    if(buyInSuperMarkRecovery)
    {
        int superMarkBuyOrders = 0;
        int superMarkBuyPositions = 0;
        string levelTag = StringFormat("_L%d", superMarkBuyLevel);
        
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, levelTag) >= 0)
            {
                ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                if(type == POSITION_TYPE_BUY) superMarkBuyPositions++;
            }
        }
        
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, levelTag) >= 0)
            {
                ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
                if(type == ORDER_TYPE_BUY_LIMIT) superMarkBuyOrders++;
            }
        }
        
        static datetime lastBuySMCheck = 0;
        if(TimeCurrent() - lastBuySMCheck > 30)
        {
            AddToLog(StringFormat("BUY SuperMark L%d Worker: Positions=%d Orders=%d Total=%d/%d", 
                superMarkBuyLevel, superMarkBuyPositions, superMarkBuyOrders, 
                superMarkBuyPositions + superMarkBuyOrders, SuperMarkMaxOrders), "WORKER");
            lastBuySMCheck = TimeCurrent();
        }
    }
    
    if(sellInSuperMarkRecovery)
    {
        int superMarkSellOrders = 0;
        int superMarkSellPositions = 0;
        string levelTag = StringFormat("_L%d", superMarkSellLevel);
        
        for(int i = 0; i < PositionsTotal(); i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, levelTag) >= 0)
            {
                ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                if(type == POSITION_TYPE_SELL) superMarkSellPositions++;
            }
        }
        
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, levelTag) >= 0)
            {
                ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
                if(type == ORDER_TYPE_SELL_LIMIT) superMarkSellOrders++;
            }
        }
        
        static datetime lastSellSMCheck = 0;
        if(TimeCurrent() - lastSellSMCheck > 30)
        {
            AddToLog(StringFormat("SELL SuperMark L%d Worker: Positions=%d Orders=%d Total=%d/%d", 
                superMarkSellLevel, superMarkSellPositions, superMarkSellOrders, 
                superMarkSellPositions + superMarkSellOrders, SuperMarkMaxOrders), "WORKER");
            lastSellSMCheck = TimeCurrent();
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
            if(StringFind(comment, "SuperMark") >= 0) continue;  // Skip Super Mark orders
            
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
        if(StringFind(comment, "SuperMark") >= 0) continue;  // Skip Super Mark orders
        
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
        double startLevel = baseLevel;
        if(startLevel >= currentPrice) startLevel -= gapPrice;
        
        for(int i = 0; i < maxOrders; i++)
        {
            targetLevels[i] = NormalizeDouble(startLevel - (i * gapPrice), _Digits);
        }
    }
    else
    {
        double startLevel = baseLevel + gapPrice;
        if(startLevel <= currentPrice) startLevel += gapPrice;
        
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
        AddToLog(StringFormat("%s Recovery Status | Total Positions: %d | Recovery Orders: %d/%d | Pending: %d | Enabled: %s", 
            isBuy ? "BUY" : "SELL", totalPositionsThisSide, totalRecoveryCount, MaxRecoveryOrders, 
            recoveryPendingCount, EnableRecovery ? "YES" : "NO"), "RECOVERY");
        lastStatusLog = TimeCurrent();
    }
    
    // Place recovery order if needed (only 1 pending at a time, max RECOVERY orders = MaxRecoveryOrders)
    // This allows 3 normal + 6 recovery = 9 total positions
    if(totalRecoveryCount < MaxRecoveryOrders && recoveryPendingCount == 0 && EnableRecovery)
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
        
        double recoveryLot = extremeLot * (1.0 + RecoveryLotIncrease / 100.0);
        
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
//| Manage Super Mark Recovery Mode                                    |
//| সবচেয়ে বেশি loss এর trade টার্গেট করে breakeven এ close করে        |
//| Super Mark positions এর profit = top loss হলে সব একসাথে close    |
//+------------------------------------------------------------------+
void ManageSuperMarkRecovery(bool isBuy)
{
    // Cooldown to prevent too frequent order placement (minimum 5 seconds between orders)
    static datetime lastBuyOrderTime = 0;
    static datetime lastSellOrderTime = 0;
    datetime lastOrderTime = isBuy ? lastBuyOrderTime : lastSellOrderTime;
    
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // ===== STEP 1: Find the highest loss position (furthest from current price) =====
    ulong highestLossTicket = 0;
    double highestLossAmount = 0;
    double highestLossOpenPrice = 0;
    double highestLossLots = 0;
    
    // Collect all positions for this side (excluding Super Mark positions)
    int totalPositionsThisSide = 0;
    double totalLots = 0;
    double weightedPrice = 0;
    
    // Get current level for filtering Super Mark positions
    int currentLevel = isBuy ? superMarkBuyLevel : superMarkSellLevel;
    string currentLevelTag = StringFormat("_L%d", currentLevel);
    
    // Collect Super Mark positions for CURRENT LEVEL ONLY
    int superMarkPositionCount = 0;
    double superMarkTotalProfit = 0;
    double superMarkTotalLots = 0;
    ulong superMarkTickets[];
    ArrayResize(superMarkTickets, 0);
    
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
        double profit = PositionGetDouble(POSITION_PROFIT);
        string comment = PositionGetString(POSITION_COMMENT);
        
        // Check if this is a Super Mark position for CURRENT LEVEL
        if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, currentLevelTag) >= 0)
        {
            // Only count positions for current level
            superMarkPositionCount++;
            superMarkTotalProfit += profit;
            superMarkTotalLots += lots;
            int size = ArraySize(superMarkTickets);
            ArrayResize(superMarkTickets, size + 1);
            superMarkTickets[size] = ticket;
        }
        else if(StringFind(comment, "SuperMark") < 0)
        {
            // Non-SuperMark positions (Normal + Recovery)
            totalPositionsThisSide++;
            totalLots += lots;
            weightedPrice += openPrice * lots;
            
            // Find highest loss (most negative profit) among non-SuperMark positions
            if(profit < highestLossAmount)
            {
                highestLossAmount = profit;
                highestLossTicket = ticket;
                highestLossOpenPrice = openPrice;
                highestLossLots = lots;
            }
        }
        // Note: Super Mark positions from OTHER levels are ignored in this calculation
    }
    
    if(totalPositionsThisSide == 0 && superMarkPositionCount == 0) return;
    
    double avgPrice = totalLots > 0 ? weightedPrice / totalLots : 0;
    
    // ===== STEP 2: Check if Super Mark positions profit >= top loss + breakeven pips =====
    // যখন Super Mark positions এর total profit >= |top loss| + extra pips
    // তখন top loss trade + সব Super Mark trades একসাথে close করব
    if(superMarkPositionCount > 0 && highestLossTicket > 0)
    {
        double pointValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE) / SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
        double extraProfitNeeded = SuperMarkBreakevenPips * pip * superMarkTotalLots * pointValue;
        double targetProfit = MathAbs(highestLossAmount) + extraProfitNeeded;
        
        // Log status periodically
        static datetime lastStatusLog = 0;
        int currentLvl = isBuy ? superMarkBuyLevel : superMarkSellLevel;
        if(TimeCurrent() - lastStatusLog > 10)
        {
            AddToLog(StringFormat("SuperMark L%d %s | TopLoss: %.2f | SM Profit: %.2f | Target: %.2f | SM Positions: %d",
                currentLvl, isBuy ? "BUY" : "SELL", highestLossAmount, superMarkTotalProfit, targetProfit, superMarkPositionCount), "SUPERMARK");
            lastStatusLog = TimeCurrent();
        }
        
        // Check if Super Mark profit covers the top loss + extra pips
        if(superMarkTotalProfit >= targetProfit)
        {
            AddToLog(StringFormat("SuperMark %s Level %d: BREAKEVEN REACHED! SM Profit: %.2f >= Target: %.2f",
                isBuy ? "BUY" : "SELL", currentLevel, superMarkTotalProfit, targetProfit), "SUPERMARK");
            
            // Close the highest loss trade first
            if(trade.PositionClose(highestLossTicket))
            {
                AddToLog(StringFormat("✅ Closed TOP LOSS %s #%I64u @ %.2f | Loss: %.2f",
                    isBuy ? "BUY" : "SELL", highestLossTicket, highestLossOpenPrice, highestLossAmount), "SUPERMARK");
            }
            
            // Close all Super Mark positions
            for(int i = 0; i < ArraySize(superMarkTickets); i++)
            {
                if(trade.PositionClose(superMarkTickets[i]))
                {
                    AddToLog(StringFormat("✅ Closed SuperMark %s #%I64u", 
                        isBuy ? "BUY" : "SELL", superMarkTickets[i]), "SUPERMARK");
                }
            }
            
            // Delete CURRENT LEVEL's Super Mark pending orders only
            for(int i = OrdersTotal() - 1; i >= 0; i--)
            {
                ulong ticket = OrderGetTicket(i);
                if(ticket <= 0) continue;
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                
                string comment = OrderGetString(ORDER_COMMENT);
                // Only delete orders for current level
                if(StringFind(comment, "SuperMark") >= 0 && StringFind(comment, currentLevelTag) >= 0)
                {
                    trade.OrderDelete(ticket);
                    AddToLog(StringFormat("Deleted SuperMark L%d pending order #%I64u", currentLevel, ticket), "SUPERMARK");
                }
            }
            
            // Decrement level after successful recovery
            // If level becomes 0, Super Mark mode will deactivate and return to Recovery Mode
            if(isBuy)
            {
                superMarkBuyLevel--;
                superMarkBuyGridPlaced = false;  // Reset flag for downgraded level
                if(superMarkBuyLevel > 0)
                {
                    ArrayResize(superMarkBuyLevelPrices, superMarkBuyLevel);
                    AddToLog(StringFormat("✅ SuperMark BUY Level %d Complete! Downgrading to Level %d", 
                        currentLevel, superMarkBuyLevel), "SUPERMARK");
                }
                else
                {
                    // Level 0 means return to Recovery Mode
                    AddToLog("✅ SuperMark BUY Level 1 Complete! Returning to RECOVERY MODE", "SUPERMARK");
                }
            }
            else
            {
                superMarkSellLevel--;
                superMarkSellGridPlaced = false;  // Reset flag for downgraded level
                if(superMarkSellLevel > 0)
                {
                    ArrayResize(superMarkSellLevelPrices, superMarkSellLevel);
                    AddToLog(StringFormat("✅ SuperMark SELL Level %d Complete! Downgrading to Level %d", 
                        currentLevel, superMarkSellLevel), "SUPERMARK");
                }
                else
                {
                    AddToLog("✅ SuperMark SELL Level 1 Complete! Returning to RECOVERY MODE", "SUPERMARK");
                }
            }
            return;
        }
    }
    
    // ===== STEP 3: Count existing Super Mark orders FOR CURRENT LEVEL ONLY =====
    // Each level has its own grid range - only count orders within current level's range
    // Note: currentLevel and currentLevelTag already defined above
    double levelStartPrice = 0;
    double levelEndPrice = 0;
    double gapPrice = SuperMarkGridGap * pip;
    double levelRange = SuperMarkGridGap * SuperMarkMaxOrders * pip;
    
    // Get current level's price range
    if(isBuy)
    {
        if(currentLevel > 0 && ArraySize(superMarkBuyLevelPrices) >= currentLevel)
        {
            levelStartPrice = superMarkBuyLevelPrices[currentLevel - 1];
            levelEndPrice = levelStartPrice - levelRange;
        }
    }
    else
    {
        if(currentLevel > 0 && ArraySize(superMarkSellLevelPrices) >= currentLevel)
        {
            levelStartPrice = superMarkSellLevelPrices[currentLevel - 1];
            levelEndPrice = levelStartPrice + levelRange;
        }
    }
    
    // Count positions and pending orders ONLY for current level's price range
    int currentLevelPositions = 0;
    int currentLevelPending = 0;
    string levelTag = StringFormat("_L%d", currentLevel);
    
    // Count current level positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "SuperMark") < 0) continue;
        if(StringFind(comment, levelTag) < 0) continue; // Only count current level
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
            currentLevelPositions++;
    }
    
    // Count current level pending orders
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "SuperMark") < 0) continue;
        if(StringFind(comment, levelTag) < 0) continue; // Only count current level
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
            currentLevelPending++;
    }
    
    int totalCurrentLevelOrders = currentLevelPositions + currentLevelPending;
    
    // ===== STEP 4: Place Super Mark grid orders for CURRENT LEVEL =====
    if(totalCurrentLevelOrders >= SuperMarkMaxOrders)
    {
        AddToLog(StringFormat("SuperMark L%d: Max orders reached (%d/%d)", 
            currentLevel, totalCurrentLevelOrders, SuperMarkMaxOrders), "SUPERMARK");
        return; // Already have max orders for this level
    }
    
    if(highestLossTicket == 0)
    {
        AddToLog("SuperMark: No highest loss ticket found, skipping order placement", "SUPERMARK");
        return;
    }
    
    if(currentLevel == 0)
    {
        AddToLog("SuperMark: Current level is 0, skipping order placement", "SUPERMARK");
        return;
    }
    
    // Check if grid orders already placed for this level - don't re-place
    bool gridAlreadyPlaced = isBuy ? superMarkBuyGridPlaced : superMarkSellGridPlaced;
    if(gridAlreadyPlaced && currentLevelPending > 0)
    {
        AddToLog(StringFormat("SuperMark L%d: Grid already placed, waiting for fills (%d pending)", 
            currentLevel, currentLevelPending), "SUPERMARK");
        return; // Grid already placed, wait for orders to fill
    }
    
    AddToLog(StringFormat("SuperMark L%d: Starting order placement | Current: %d/%d | GridPlaced: %s", 
        currentLevel, totalCurrentLevelOrders, SuperMarkMaxOrders, gridAlreadyPlaced ? "YES" : "NO"), "SUPERMARK");
    
    // ===== Calculate NEXT GRID LEVEL based on existing orders/positions =====
    // Grid is FIXED from levelStartPrice with SuperMarkGridGap spacing
    // We find the NEXT empty grid slot, not nearest to current price
    
    // First, collect all occupied grid levels (positions + pending orders)
    double occupiedPrices[];
    ArrayResize(occupiedPrices, 0);
    
    // Collect Super Mark position prices for current level
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "SuperMark") < 0) continue;
        if(StringFind(comment, levelTag) < 0) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type == POSITION_TYPE_BUY) || (!isBuy && type == POSITION_TYPE_SELL))
        {
            int size = ArraySize(occupiedPrices);
            ArrayResize(occupiedPrices, size + 1);
            occupiedPrices[size] = PositionGetDouble(POSITION_PRICE_OPEN);
        }
    }
    
    // Collect Super Mark pending order prices for current level
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "SuperMark") < 0) continue;
        if(StringFind(comment, levelTag) < 0) continue;
        
        ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && type == ORDER_TYPE_BUY_LIMIT) || (!isBuy && type == ORDER_TYPE_SELL_LIMIT))
        {
            int size = ArraySize(occupiedPrices);
            ArrayResize(occupiedPrices, size + 1);
            occupiedPrices[size] = OrderGetDouble(ORDER_PRICE_OPEN);
        }
    }
    
    // Debug log for grid calculation
    static datetime lastGridDebug = 0;
    if(TimeCurrent() - lastGridDebug > 30)
    {
        AddToLog(StringFormat("SuperMark Grid Debug: Level=%d | StartPrice=%.2f | EndPrice=%.2f | Gap=%.2f | CurrentPrice=%.2f | Occupied=%d",
            currentLevel, levelStartPrice, levelEndPrice, gapPrice, currentPrice, ArraySize(occupiedPrices)), "DEBUG");
        lastGridDebug = TimeCurrent();
    }
    
    // ===== PLACE ALL MISSING GRID ORDERS AT ONCE =====
    // Iterate through ALL grid levels and place orders for empty slots
    int ordersPlaced = 0;
    
    for(int step = 1; step <= SuperMarkMaxOrders; step++)
    {
        double gridPrice = 0;
        if(isBuy)
            gridPrice = NormalizeDouble(levelStartPrice - (step * gapPrice), _Digits);
        else
            gridPrice = NormalizeDouble(levelStartPrice + (step * gapPrice), _Digits);
        
        // Validate grid price is within level range
        if(isBuy && gridPrice < levelEndPrice)
            continue;
        if(!isBuy && gridPrice > levelEndPrice)
            continue;
        
        // Check if this grid level is already occupied
        bool isOccupied = false;
        for(int j = 0; j < ArraySize(occupiedPrices); j++)
        {
            if(MathAbs(occupiedPrices[j] - gridPrice) < gapPrice * 0.3)
            {
                isOccupied = true;
                break;
            }
        }
        
        if(isOccupied)
            continue;
        
        // Calculate lot size - scale between min and max based on step number
        double lotRatio = (double)(step - 1) / (double)SuperMarkMaxOrders;
        double lotSize = SuperMarkMinLot + (SuperMarkMaxLot - SuperMarkMinLot) * lotRatio;
        
        // Normalize lot size
        double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
        double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
        double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
        if(minLot <= 0) minLot = 0.01;
        if(maxLot <= 0) maxLot = 100.0;
        if(lotStep <= 0) lotStep = 0.01;
        lotSize = MathFloor(lotSize / lotStep) * lotStep;
        lotSize = MathMax(minLot, MathMin(maxLot, lotSize));
        
        // Place the Super Mark order with LEVEL TAG in comment
        string comment = isBuy ? 
            StringFormat("SuperMark_BUY_L%d", currentLevel) : 
            StringFormat("SuperMark_SELL_L%d", currentLevel);
        
        bool orderSuccess = false;
        if(isBuy)
            orderSuccess = trade.BuyLimit(lotSize, gridPrice, _Symbol, 0, 0, ORDER_TIME_GTC, 0, comment);
        else
            orderSuccess = trade.SellLimit(lotSize, gridPrice, _Symbol, 0, 0, ORDER_TIME_GTC, 0, comment);
        
        if(orderSuccess)
        {
            ordersPlaced++;
            AddToLog(StringFormat("✅ SuperMark L%d %s placed @ %.2f | Lot: %.2f | Step: %d", 
                currentLevel, isBuy ? "BUY" : "SELL", gridPrice, lotSize, step), "SUPERMARK");
            
            // Add to occupied prices to prevent duplicate in same tick
            int size = ArraySize(occupiedPrices);
            ArrayResize(occupiedPrices, size + 1);
            occupiedPrices[size] = gridPrice;
        }
        else
        {
            AddToLog(StringFormat("❌ SuperMark %s failed @ %.2f | Error: %d | RetCode: %d",
                isBuy ? "BUY" : "SELL", gridPrice, GetLastError(), trade.ResultRetcode()), "SUPERMARK");
        }
        
        // Small delay between orders to avoid broker rejection
        Sleep(100);
    }
    
    if(ordersPlaced > 0)
    {
        // Set grid placed flag - orders won't be re-placed until level changes
        if(isBuy)
            superMarkBuyGridPlaced = true;
        else
            superMarkSellGridPlaced = true;
            
        AddToLog(StringFormat("SuperMark L%d: Placed %d %s grid orders (Grid Locked)", 
            currentLevel, ordersPlaced, isBuy ? "BUY" : "SELL"), "SUPERMARK");
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
        // Check if position is Super Mark
        string posComment = PositionGetString(POSITION_COMMENT);
        bool isSuperMark = (StringFind(posComment, "SuperMark") >= 0);
        
        // Recovery mode হলে average price ব্যবহার হবে, না হলে individual open price
        bool inRecovery = (type == POSITION_TYPE_BUY && buyInRecovery) || (type == POSITION_TYPE_SELL && sellInRecovery);
        bool inSuperMark = (type == POSITION_TYPE_BUY && buyInSuperMarkRecovery) || (type == POSITION_TYPE_SELL && sellInSuperMarkRecovery);
        
        // Super Mark positions use their own average price
        double basePrice = inRecovery ? (type == POSITION_TYPE_BUY ? buyAvgPrice : sellAvgPrice) : openPrice;
        
        // Mode অনুযায়ী settings select করি
        double trailingStart, initialSL, trailingRatio;
        
        if(isSuperMark && inSuperMark)
        {
            // Super Mark trailing settings
            trailingStart = SuperMarkTrailingStartPips;  // 3 pips
            initialSL = SuperMarkTrailingSLPips;          // 2 pips SL distance
            trailingRatio = SuperMarkTrailingRatio;       // 0.5 = 0.5 pip SL move per 1 pip price move
        }
        else if(inRecovery)
        {
            trailingStart = RecoveryTrailingStartPips;
            initialSL = RecoveryInitialSLPips;
            trailingRatio = RecoveryTrailingRatio;
        }
        else
        {
            trailingStart = (type == POSITION_TYPE_BUY ? BuyTrailingStartPips : SellTrailingStartPips);
            initialSL = (type == POSITION_TYPE_BUY ? BuyInitialSLPips : SellInitialSLPips);
            trailingRatio = (type == POSITION_TYPE_BUY ? BuyTrailingRatio : SellTrailingRatio);
        }
        
        // ===== Profit Calculate =====
        // BUY: currentPrice - basePrice (price বাড়লে profit)
        // SELL: basePrice - currentPrice (price কমলে profit)
        double profitPips = type == POSITION_TYPE_BUY ?
            (currentPrice - basePrice) / pip :
            (basePrice - currentPrice) / pip;
        
        // ===== Super Mark Max TP Check =====
        // Super Mark positions close at max TP (25 pips)
        if(isSuperMark && inSuperMark && profitPips >= SuperMarkMaxTPPips)
        {
            if(trade.PositionClose(ticket))
            {
                AddToLog(StringFormat("✅ SuperMark MAX TP: %s closed @ %.1f pips profit", 
                    type == POSITION_TYPE_BUY ? "BUY" : "SELL", profitPips), "SUPERMARK");
            }
            continue;  // Skip to next position
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
                string modeStr = isSuperMark ? "SuperMark" : (inRecovery ? "Recovery" : "Normal");
                AddToLog(StringFormat("Trailing SL: %s %s | Profit: %.1f pips | SL: %.2f", 
                    modeStr, type == POSITION_TYPE_BUY ? "BUY" : "SELL", profitPips, newSL), "TRAILING");
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
void SendLogToServer(string message, string type)
{
    // Skip if no license key
    if(StringLen(LicenseKey) == 0) return;
    
    // Build JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"log_type\":\"" + type + "\",";
    jsonRequest += "\"message\":\"" + message + "\"";
    jsonRequest += "}";
    
    // Prepare request
    string url = LicenseServer + "/api/action-log/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    int timeout = 1000; // Short timeout for logs
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
    
    // Don't print errors for logs to avoid spam
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
    
    // Priority: Super Mark > Recovery > Normal
    if(buyInSuperMarkRecovery || sellInSuperMarkRecovery)
    {
        if(buyInSuperMarkRecovery && sellInSuperMarkRecovery)
            modeText = StringFormat(">>> BUY (L%d) & SELL (L%d) SUPER MARK MODE <<<", superMarkBuyLevel, superMarkSellLevel);
        else if(buyInSuperMarkRecovery)
            modeText = StringFormat(">>> BUY SUPER MARK LEVEL %d <<<", superMarkBuyLevel);
        else
            modeText = StringFormat(">>> SELL SUPER MARK LEVEL %d <<<", superMarkSellLevel);
        modeColor = clrMagenta;
    }
    else if(buyInRecovery || sellInRecovery)
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
    string sellModeText = "Normal Grid Mode";
    color sellModeColor = clrLime;
    if(sellInSuperMarkRecovery)
    {
        sellModeText = StringFormat(">> SUPER MARK L%d <<", superMarkSellLevel);
        sellModeColor = clrMagenta;
    }
    else if(sellInRecovery)
    {
        sellModeText = ">> RECOVERY MODE <<";
        sellModeColor = clrOrangeRed;
    }
    ObjectCreate(0, "EA_SellMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellMode", OBJPROP_TEXT, sellModeText);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_COLOR, sellModeColor);
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
    color buyModeColor = clrLime;
    if(buyInSuperMarkRecovery)
    {
        buyModeText = StringFormat(">> SUPER MARK L%d <<", superMarkBuyLevel);
        buyModeColor = clrMagenta;
    }
    else if(buyInRecovery)
    {
        buyModeText = ">> RECOVERY MODE <<";
        buyModeColor = clrOrangeRed;
    }
    ObjectCreate(0, "EA_BuyMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyMode", OBJPROP_TEXT, buyModeText);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_COLOR, buyModeColor);
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
    
    // Determine trading mode with Super Mark level info
    string tradingMode = "Normal Mode Running";
    if(buyInSuperMarkRecovery && sellInSuperMarkRecovery) 
        tradingMode = StringFormat("Buy (L%d) & Sell (L%d) Super Mark Recovery!", superMarkBuyLevel, superMarkSellLevel);
    else if(buyInSuperMarkRecovery) 
        tradingMode = StringFormat("Buy Super Mark Recovery Level %d!", superMarkBuyLevel);
    else if(sellInSuperMarkRecovery) 
        tradingMode = StringFormat("Sell Super Mark Recovery Level %d!", superMarkSellLevel);
    else if(recoveryMaxHitBuy && !buyInSuperMarkRecovery)
        tradingMode = "Buy Recovery Max Hit - Waiting for Super Mark Activation!";
    else if(recoveryMaxHitSell && !sellInSuperMarkRecovery)
        tradingMode = "Sell Recovery Max Hit - Waiting for Super Mark Activation!";
    else if(buyInRecovery && sellInRecovery) 
        tradingMode = "Buy & Sell Recovery Mode Activated!";
    else if(buyInRecovery) 
        tradingMode = "Buy Recovery Mode Activated!";
    else if(sellInRecovery) 
        tradingMode = "Sell Recovery Mode Activated!";
    
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
