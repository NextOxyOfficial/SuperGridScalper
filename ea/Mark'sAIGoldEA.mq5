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
#define BuyGapPips          4.0
#define MaxBuyOrders        4
#define BuyTakeProfitPips   50.0
#define BuyStopLossPips     0.0

#define SellRangeStart      4402.0
#define SellRangeEnd        4002.0
#define SellGapPips         4.0
#define MaxSellOrders       4
#define SellTakeProfitPips  50.0
#define SellStopLossPips    0.0

#define BuyTrailingStartPips    3.0
#define BuyInitialSLPips        2.0
#define BuyTrailingRatio        0.5
#define SellTrailingStartPips   4.0
#define SellInitialSLPips       3.0
#define SellTrailingRatio       0.5

#define EnableRecovery          true
#define RecoveryTakeProfitPips  100.0
#define RecoveryTrailingStartPips 3.0
#define RecoveryInitialSLPips   2.0
#define RecoveryTrailingRatio   0.5
#define RecoveryLotIncrease     10.0
#define MaxRecoveryOrders       30

#define LotSize         0.25
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
    Print("[LICENSE] Checking license key: ", LicenseKey);
    
    if(StringLen(LicenseKey) == 0)
    {
        g_LicenseMessage = "NO LICENSE KEY";
        Alert("NO LICENSE KEY ENTERED!\n\nPlease enter your license key in EA settings.");
        Print("[LICENSE] No license key entered");
    }
    else
    {
        bool licenseOK = VerifyLicense();
        
        if(!licenseOK)
        {
            Print("[LICENSE] FAILED: ", g_LicenseMessage);
            Alert("LICENSE INVALID!\n\n" + g_LicenseMessage + "\n\nEA will not trade.");
        }
        else
        {
            Print("[LICENSE] VALID - Plan: ", g_PlanName, " | Days: ", g_DaysRemaining);
        }
    }
    
    // Update panel on startup
    UpdateLicensePanel();
    
    Print("Clean Grid EA Initialized");
    return(INIT_SUCCEEDED);
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
    
    // Determine mode
    buyInRecovery = (currentBuyPositions >= MaxBuyOrders);
    sellInRecovery = (currentSellPositions >= MaxSellOrders);
    
    // Manage grids based on mode
    if(!buyInRecovery)
        ManageNormalGrid(true);  // BUY
    else
        ManageRecoveryGrid(true); // BUY Recovery
        
    if(!sellInRecovery)
        ManageNormalGrid(false); // SELL
    else
        ManageRecoveryGrid(false); // SELL Recovery
    
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
    
    // Count filled positions (for recovery mode detection)
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        string comment = PositionGetString(POSITION_COMMENT);
        if(StringFind(comment, "Recovery") >= 0) continue; // Skip recovery positions
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if(type == POSITION_TYPE_BUY)
            currentBuyPositions++;
        else
            currentSellPositions++;
    }
    
    // Total = Positions (for grid limit)
    totalBuyOrders = currentBuyPositions;
    totalSellOrders = currentSellPositions;
    
    // Add pending orders to total (for grid limit only, NOT for recovery mode)
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
//| Manage Normal Grid (Static Grid - Pre-calculated Levels)         |
//+------------------------------------------------------------------+
void ManageNormalGrid(bool isBuy)
{
    double currentPrice = isBuy ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double rangeStart = isBuy ? MathMax(BuyRangeStart, BuyRangeEnd) : MathMax(SellRangeStart, SellRangeEnd);
    double rangeEnd = isBuy ? MathMin(BuyRangeStart, BuyRangeEnd) : MathMin(SellRangeStart, SellRangeEnd);
    double gapPips = isBuy ? BuyGapPips : SellGapPips;
    int maxOrders = isBuy ? MaxBuyOrders : MaxSellOrders;
    
    // Calculate ALL possible grid levels within range (static grid)
    double allGridLevels[];
    int gridCount = 0;
    
    // Start from rangeEnd and go up by gap until rangeStart
    double level = rangeEnd;
    while(level <= rangeStart)
    {
        ArrayResize(allGridLevels, gridCount + 1);
        allGridLevels[gridCount] = NormalizeDouble(level, _Digits);
        gridCount++;
        level += (gapPips * pip);
    }
    
    // Find the closest grid levels to current price
    // For BUY: find levels below current price (start from highest below)
    // For SELL: find levels above current price (start from lowest above)
    double targetLevels[];
    int targetCount = 0;
    
    if(isBuy)
    {
        // BUY: scan from top to bottom, take levels below current price
        for(int i = gridCount - 1; i >= 0 && targetCount < maxOrders; i--)
        {
            if(allGridLevels[i] < currentPrice)
            {
                ArrayResize(targetLevels, targetCount + 1);
                targetLevels[targetCount] = allGridLevels[i];
                targetCount++;
            }
        }
    }
    else
    {
        // SELL: scan from bottom to top, take levels above current price
        for(int i = 0; i < gridCount && targetCount < maxOrders; i++)
        {
            if(allGridLevels[i] > currentPrice)
            {
                ArrayResize(targetLevels, targetCount + 1);
                targetLevels[targetCount] = allGridLevels[i];
                targetCount++;
            }
        }
    }
    
    // If not enough levels found, return
    if(targetCount == 0) return;
    
    // Limit to maxOrders to respect position limit
    int actualOrderCount = MathMin(targetCount, maxOrders);
    
    // Get existing positions and orders at these levels
    bool levelOccupied[];
    ArrayResize(levelOccupied, actualOrderCount);
    ArrayInitialize(levelOccupied, false);
    
    // Check positions
    for(int i = 0; i < PositionsTotal(); i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        if((isBuy && type != POSITION_TYPE_BUY) || (!isBuy && type != POSITION_TYPE_SELL)) continue;
        
        double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        
        // Mark closest grid level as occupied
        for(int j = 0; j < actualOrderCount; j++)
        {
            if(MathAbs(posPrice - targetLevels[j]) < gapPips * pip * 0.4)
            {
                levelOccupied[j] = true;
                break;
            }
        }
    }
    
    // Check pending orders
    for(int i = 0; i < OrdersTotal(); i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
        if((isBuy && orderType != ORDER_TYPE_BUY_LIMIT) || (!isBuy && orderType != ORDER_TYPE_SELL_LIMIT)) continue;
        
        double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
        
        // Check if order is within valid grid range
        bool isInRange = (orderPrice >= rangeEnd && orderPrice <= rangeStart);
        
        // Check if order matches any target level
        bool matchesTarget = false;
        for(int j = 0; j < actualOrderCount; j++)
        {
            if(MathAbs(orderPrice - targetLevels[j]) < gapPips * pip * 0.4)
            {
                levelOccupied[j] = true;
                matchesTarget = true;
                break;
            }
        }
        
        // DON'T delete orders that are in valid range - let them stay
        // Only delete if order is completely outside the grid range
        if(!isInRange)
        {
            trade.OrderDelete(ticket);
            Print("[GRID] Deleted out-of-range ", isBuy ? "BUY" : "SELL", " order at ", orderPrice);
        }
        // If order is in range, mark the closest target level as occupied
        // This prevents placing duplicate orders near existing ones
        else
        {
            // Find closest target level and mark it occupied
            double minDist = 999999;
            int closestIdx = -1;
            for(int j = 0; j < actualOrderCount; j++)
            {
                double dist = MathAbs(orderPrice - targetLevels[j]);
                if(dist < minDist)
                {
                    minDist = dist;
                    closestIdx = j;
                }
            }
            if(closestIdx >= 0 && minDist < gapPips * pip * 0.8)
            {
                levelOccupied[closestIdx] = true;
            }
        }
    }
    
    // Count current total (positions + pending orders) to respect limit
    int currentTotal = isBuy ? totalBuyOrders : totalSellOrders;
    
    // Place missing orders at unoccupied levels (but don't exceed max limit)
    for(int i = 0; i < actualOrderCount; i++)
    {
        if(levelOccupied[i]) continue;
        
        // Check if we've reached max limit
        if(currentTotal >= maxOrders)
        {
            Print("[GRID] Max ", isBuy ? "BUY" : "SELL", " orders reached (", currentTotal, "/", maxOrders, ")");
            break;
        }
        
        // Check if level is within range
        if(targetLevels[i] < rangeEnd || targetLevels[i] > rangeStart) continue;
        
        // Check if level is valid (below current for BUY, above for SELL)
        if(isBuy && targetLevels[i] >= currentPrice) continue;
        if(!isBuy && targetLevels[i] <= currentPrice) continue;
        
        // Place order
        double tp = 0, sl = 0;
        if(isBuy)
        {
            tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(targetLevels[i] + (BuyTakeProfitPips * pip), _Digits) : 0;
            sl = (BuyStopLossPips > 0) ? NormalizeDouble(targetLevels[i] - (BuyStopLossPips * pip), _Digits) : 0;
            if(trade.BuyLimit(LotSize, targetLevels[i], _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
            {
                currentTotal++; // Increment count after successful placement
                AddToLog(StringFormat("BUY LIMIT @ %.2f | Lot: %.2f", targetLevels[i], LotSize), "OPEN_BUY");
            }
        }
        else
        {
            tp = (SellTakeProfitPips > 0) ? NormalizeDouble(targetLevels[i] - (SellTakeProfitPips * pip), _Digits) : 0;
            sl = (SellStopLossPips > 0) ? NormalizeDouble(targetLevels[i] + (SellStopLossPips * pip), _Digits) : 0;
            if(trade.SellLimit(LotSize, targetLevels[i], _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
            {
                currentTotal++; // Increment count after successful placement
                AddToLog(StringFormat("SELL LIMIT @ %.2f | Lot: %.2f", targetLevels[i], LotSize), "OPEN_SELL");
            }
        }
        
        Print("[GRID] Placed ", isBuy ? "BUY" : "SELL", " order at ", targetLevels[i], " (Total: ", currentTotal, "/", maxOrders, ")");
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
    
    // Count recovery orders
    int recoveryCount = 0;
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
                recoveryCount++;
        }
    }
    
    // Place recovery order if needed
    if(recoveryCount < MaxRecoveryOrders && EnableRecovery)
    {
        // Find extreme position
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
        
        // Calculate recovery order price and lot
        double gapPips = isBuy ? BuyGapPips : SellGapPips;
        double recoveryPrice = isBuy ?
            NormalizeDouble(extremePrice - (gapPips * pip), _Digits) :
            NormalizeDouble(extremePrice + (gapPips * pip), _Digits);
        
        double recoveryLot = NormalizeDouble(extremeLot * (1.0 + RecoveryLotIncrease / 100.0), 2);
        
        // Check if no order exists at this price
        bool orderExists = false;
        for(int i = 0; i < OrdersTotal(); i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket <= 0) continue;
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
            if(MathAbs(orderPrice - recoveryPrice) < pip * 0.5)
            {
                orderExists = true;
                break;
            }
        }
        
        // Place recovery order
        if(!orderExists)
        {
            if(isBuy)
                trade.BuyLimit(recoveryLot, recoveryPrice, _Symbol, 0, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_BUY");
            else
                trade.SellLimit(recoveryLot, recoveryPrice, _Symbol, 0, breakevenTP, ORDER_TIME_GTC, 0, "Recovery_SELL");
            
            Print("[RECOVERY] Placed ", isBuy ? "BUY" : "SELL", " order at ", recoveryPrice, " | Lot: ", recoveryLot);
        }
    }
}

//+------------------------------------------------------------------+
//| Apply Trailing Stop                                               |
//+------------------------------------------------------------------+
void ApplyTrailing()
{
    // Calculate average prices for recovery mode
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
        
        // Determine mode and settings
        bool inRecovery = (type == POSITION_TYPE_BUY && buyInRecovery) || (type == POSITION_TYPE_SELL && sellInRecovery);
        double basePrice = inRecovery ? (type == POSITION_TYPE_BUY ? buyAvgPrice : sellAvgPrice) : openPrice;
        
        double trailingStart = inRecovery ? RecoveryTrailingStartPips : 
            (type == POSITION_TYPE_BUY ? BuyTrailingStartPips : SellTrailingStartPips);
        double initialSL = inRecovery ? RecoveryInitialSLPips :
            (type == POSITION_TYPE_BUY ? BuyInitialSLPips : SellInitialSLPips);
        double trailingRatio = inRecovery ? RecoveryTrailingRatio :
            (type == POSITION_TYPE_BUY ? BuyTrailingRatio : SellTrailingRatio);
        
        // Calculate profit from base price
        double profitPips = type == POSITION_TYPE_BUY ?
            (currentPrice - basePrice) / pip :
            (basePrice - currentPrice) / pip;
        
        // Apply trailing if profit reached threshold
        if(profitPips >= trailingStart)
        {
            double priceMovement = profitPips - trailingStart;
            double slMovement = priceMovement * trailingRatio;
            
            double newSL = type == POSITION_TYPE_BUY ?
                NormalizeDouble(basePrice + (initialSL * pip) + (slMovement * pip), _Digits) :
                NormalizeDouble(basePrice - (initialSL * pip) - (slMovement * pip), _Digits);
            
            // Update SL if improved
            bool needsUpdate = (currentSL == 0) || 
                (type == POSITION_TYPE_BUY && newSL > currentSL + (0.5 * pip)) ||
                (type == POSITION_TYPE_SELL && newSL < currentSL - (0.5 * pip));
            
            if(needsUpdate)
            {
                trade.PositionModify(ticket, newSL, currentTP);
                string msg = StringFormat("Trailing SL: %s #%I64u | Profit: %.1f pips | New SL: %.5f",
                    type == POSITION_TYPE_BUY ? "BUY" : "SELL", ticket, profitPips, newSL);
                Print("[TRAIL] ", msg);
                AddToLog(msg, "TRAILING");
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
    
    // Calculate statistics
    double buyAvgPrice = 0, sellAvgPrice = 0;
    double buyTotalLots = 0, sellTotalLots = 0;
    double buyWeightedPrice = 0, sellWeightedPrice = 0;
    double buyTotalProfit = 0, sellTotalProfit = 0;
    
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
        }
        else
        {
            sellWeightedPrice += openPrice * lots;
            sellTotalLots += lots;
            sellTotalProfit += profit;
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
    
    // SELL Count & Lots
    string sellCountInfo = StringFormat("Orders: %d / %d | Lots: %.2f", currentSellPositions, MaxSellOrders, sellTotalLots);
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
    
    // BUY Count & Lots
    string buyCountInfo = StringFormat("Orders: %d / %d | Lots: %.2f", currentBuyPositions, MaxBuyOrders, buyTotalLots);
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
    jsonRequest += "\"pending_orders\":" + pendingJson;
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
    
    // Debug: Log response status
    if(response != 200 && response != -1)
    {
        Print("Trade data send failed: HTTP ", response);
    }
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
        Print("[LICENSE] Pending order #", ticket, " deleted - License invalid");
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
    
    // Debug: Print server response
    Print("[LICENSE] Server response: ", responseStr);
    Print("[LICENSE] HTTP code: ", response);
    
    // Convert response to lowercase for easier checking
    string lowerResp = responseStr;
    StringToLower(lowerResp);
    
    // Check if response contains "valid": true OR "valid":true
    bool hasValidTrue = (StringFind(lowerResp, "\"valid\": true") >= 0 || 
                        StringFind(lowerResp, "\"valid\":true") >= 0);
    
    // Check if response contains "valid": false OR "valid":false  
    bool hasValidFalse = (StringFind(lowerResp, "\"valid\": false") >= 0 || 
                         StringFind(lowerResp, "\"valid\":false") >= 0);
    
    Print("[LICENSE] hasValidTrue: ", hasValidTrue, " | hasValidFalse: ", hasValidFalse);
    
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
        Print("[LICENSE] Valid! Plan: ", g_PlanName, " | Days: ", g_DaysRemaining);
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
    
    Print("[LICENSE] Invalid: ", g_LicenseMessage);
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
    ObjectSetString(0, "EA_LicenseURL", OBJPROP_TEXT, "https:www.markstrades.com");
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
