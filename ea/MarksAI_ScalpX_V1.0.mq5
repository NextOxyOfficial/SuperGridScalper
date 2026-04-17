//+------------------------------------------------------------------+
//|                       MarksAI_ScalpX_V1.0.mq5                      |
//|                    Mark's AI ScalpX - Smart Pattern Scalper         |
//|          Confirmed candle patterns + trailing SL + auto-compound   |
//|                     www.markstrades.com                             |
//+------------------------------------------------------------------+
#property copyright "Mark's AI ScalpX V1.0 - markstrades.com"
#property version   "1.00"
#property strict
#property description "Mark's AI ScalpX - Smart Pattern Scalper"
#property description "Any Timeframe | Auto-Compound | Trailing SL | Confirmed Patterns"
#property description "Licensed Product - www.markstrades.com"

#include <Trade\Trade.mqh>

CTrade trade;

//=== LICENSE ===
input group "=== License ==="
input string    LicenseKey                = "";        // Your License Key
input bool      TesterMode                = false;     // Enable Tester Mode
input string    TesterAccountOverride     = "";        // Tester Account Override (optional)
input bool      UseCachedLicenseInTester  = true;      // Use cached license in tester
input int       CachedLicenseMaxAgeHours  = 24;        // Cache max age (hours)

//=== TRADING SETTINGS ===
input group "=== ScalpX Settings ==="
input double   ProfitPercent         = 10.0;       // Close all at X% profit of equity
input int      MaxOpenTrades         = 34;         // Max open trades at once
input int      TradesPerCandle       = 1;          // Trades per confirmed candle

input group "=== Lot Sizing ==="
input double   MarginUsePercent      = 15.0;       // Use X% of free margin (lower = softer lots)
input double   MaxLotLimit           = 6.49;       // Maximum lot size per trade

input group "=== Trailing Stop ==="
input bool     UseTrailing           = true;       // Enable trailing SL
input double   InitialSLPips         = 200.0;       // Initial SL on entry (safety net)
input double   InitialTPPips         = 400.0;       // Initial TP on entry
input double   TrailStartPips        = 6.0;        // Start trailing after X pips profit (from Lite EA)
input double   InitialLockPips       = 3.5;        // Lock X pips profit when trail starts (from Lite EA)
input double   TrailingRatio         = 0.45;       // SL follows 45% of extra price movement (from Lite EA)

input group "=== Session Filter (Optional) ==="
input bool     UseSessionFilter      = false;
input int      SessionStartHour      = 7;
input int      SessionEndHour        = 21;

input group "=== Magic Number ==="
input int      MagicNumber           = 999777;

//=== SERVER URL (Hidden) ===
string LicenseServer = "https://markstrades.com";

//=== LICENSE STATE ===
bool g_LicenseValid = false;
string g_LicenseMessage = "";
string g_PlanName = "";
int g_DaysRemaining = 0;
datetime g_LastVerification = 0;

//=== SERVER CONTROL STATE ===
double   g_ControlLotSize       = 0;      // 0 = use EA default
bool     g_ControlTargetStopped = false;  // Server says equity target hit
bool     g_ControlScheduleStopped = false; // Server says schedule stop active
bool     g_ControlSettingsLoaded = false;  // At least one successful fetch
datetime g_LastTradeDataUpdate = 0;

//=== GLOBAL VARIABLES ===
datetime lastCandleTime = 0;
int totalTradesOpened = 0;
int totalCycles = 0;
double pointValue;
int digits_;
double pipSize;

//+------------------------------------------------------------------+
int OnInit()
{
   pointValue = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   digits_ = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   
   pipSize = (digits_ == 3 || digits_ == 5) ? pointValue * 10 : pointValue;
   
   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(50);
   
   // AUTO-DETECT filling mode
   long fillType = SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   if((fillType & SYMBOL_FILLING_FOK) != 0)
      trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((fillType & SYMBOL_FILLING_IOC) != 0)
      trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      trade.SetTypeFilling(ORDER_FILLING_RETURN);
   
   //=== LICENSE VERIFICATION ON STARTUP ===
   g_LicenseValid = false;
   g_LicenseMessage = "CHECKING...";
   g_PlanName = "";
   g_DaysRemaining = 0;
   
   if(MQLInfoInteger(MQL_TESTER))
   {
      g_LicenseValid = true;
      g_LicenseMessage = "TESTER MODE - NO LICENSE REQUIRED";
      g_PlanName = "Tester";
      g_DaysRemaining = 999;
   }
   else if(StringLen(LicenseKey) == 0)
   {
      g_LicenseMessage = "NO LICENSE KEY";
      Alert("NO LICENSE KEY ENTERED!\n\nPlease enter your license key in EA settings.\n\nGet yours at: www.markstrades.com");
   }
   else
   {
      bool licenseOK = VerifyLicense();
      if(!licenseOK)
      {
         Alert("LICENSE INVALID!\n\n" + g_LicenseMessage + "\n\nEA will not trade.\n\nRenew at: www.markstrades.com");
      }
   }
   
   UpdateLicensePanel();
   
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   Print("=== MARK'S AI SCALPX V1.0 STARTED ===");
   Print("Equity: $", DoubleToString(equity, 2),
         " | Target: $", DoubleToString(equity * ProfitPercent / 100.0, 2));
   Print("Timeframe: ", EnumToString(_Period), " | Pip: ", pipSize);
   Print("Trail: ", TrailStartPips, " pips start, Lock: ", InitialLockPips, " pips, Ratio: ", TrailingRatio);
   Print("License: ", g_LicenseMessage);
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   // Clean up chart objects
   ObjectDelete(0, "SX_LicenseURL");
   ObjectDelete(0, "SX_LicenseStatus");
   ObjectDelete(0, "SX_LicensePlan");
   ObjectDelete(0, "SX_LicenseDays");
   ObjectDelete(0, "SX_LicenseWarning");
   ObjectDelete(0, "SX_EAName");
   
   Print("=== SCALPX STOPPED. Trades: ", totalTradesOpened, " Cycles: ", totalCycles, " ===");
}

//+------------------------------------------------------------------+
void OnTick()
{
   //=== LICENSE RE-VERIFICATION (every 30 seconds) ===
   static datetime lastLicenseCheck = 0;
   if(!IsTesterMode() && TimeCurrent() - lastLicenseCheck > 30)
   {
      lastLicenseCheck = TimeCurrent();
      VerifyLicense();
      UpdateLicensePanel();
   }
   
   //=== STRICT LICENSE CHECK ===
   if(!g_LicenseValid)
   {
      static datetime lastCleanup = 0;
      if(TimeCurrent() - lastCleanup > 10)
      {
         lastCleanup = TimeCurrent();
         CloseAllTrades("LICENSE INVALID");
      }
      
      Comment("LICENSE INVALID\n\n" +
              "Status: " + g_LicenseMessage + "\n\n" +
              "ALL TRADING DISABLED\n" +
              "ALL POSITIONS CLOSED\n\n" +
              "Please renew at: www.markstrades.com");
      return;
   }
   
   //=== SEND TRADE DATA TO SERVER (every 10 seconds) ===
   if(!MQLInfoInteger(MQL_TESTER) && TimeCurrent() - g_LastTradeDataUpdate >= 10)
   {
      SendTradeDataToServer();
   }
   
   //=== EA CONTROL: Daily Target Stop ===
   if(g_ControlSettingsLoaded && g_ControlTargetStopped)
   {
      static datetime lastTargetCleanup = 0;
      if(TimeCurrent() - lastTargetCleanup > 10)
      {
         lastTargetCleanup = TimeCurrent();
         CloseAllTrades("EQUITY TARGET REACHED");
      }
      Comment("EQUITY TARGET REACHED - EA PAUSED\n\n" +
              "All positions closed.\n" +
              "Will auto-reset next trading day.\n" +
              "Managed from: www.markstrades.com");
      return;
   }
   
   //=== EA CONTROL: Schedule Stop ===
   if(g_ControlSettingsLoaded && g_ControlScheduleStopped)
   {
      Comment("SCHEDULED STOP - EA PAUSED\n\n" +
              "Will resume after stop window ends.\n" +
              "Managed from: www.markstrades.com");
      return;
   }
   Comment("");
   
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double totalProfit = GetTotalFloatingProfit();
   int openCount = CountMyTrades();
   
   //--- Dynamic profit target
   double profitTarget = equity * ProfitPercent / 100.0;
   if(profitTarget < 0.50) profitTarget = 0.50;
   
   //--- CLOSE ALL when profit target hit
   if(openCount > 0 && totalProfit >= profitTarget)
   {
      Print("CYCLE WIN #", totalCycles + 1, "! Profit: $", DoubleToString(totalProfit, 2),
            " | Equity: $", DoubleToString(equity, 2));
      CloseAllTrades("PROFIT TARGET");
      totalCycles++;
      return;
   }
   
   //--- TRAILING STOP - run every tick for fast response
   if(UseTrailing && openCount > 0)
      ManageTrailingStop();
   
   //--- New candle detection (uses chart timeframe)
   datetime currentCandleTime = iTime(_Symbol, _Period, 0);
   if(currentCandleTime == lastCandleTime) return;
   lastCandleTime = currentCandleTime;
   
   //--- Session filter
   if(UseSessionFilter)
   {
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      if(dt.hour < SessionStartHour || dt.hour >= SessionEndHour) return;
   }
   
   //--- Wait for CONFIRMED candle pattern (no weak signals)
   int signal = AnalyzeCandles();
   if(signal == 0) return;
   
   int direction = (signal > 0) ? 1 : -1;
   int strength = MathAbs(signal);
   
   //--- Close opposite profitable trades
   CloseOppositeTrades(direction);
   
   //--- SINGLE DIRECTION: don't mix buy and sell
   int existingDir = GetExistingDirection();
   if(existingDir != 0 && existingDir != direction)
      return;
   
   //--- Check max open trades
   int currentTrades = CountMyTrades();
   if(currentTrades >= MaxOpenTrades) return;
   
   //--- Bulk entry based on signal strength
   int slotsAvailable = MaxOpenTrades - currentTrades;
   int tradesToOpen;
   if(strength >= 3)
      tradesToOpen = MathMin(slotsAvailable, TradesPerCandle);
   else if(strength >= 2)
      tradesToOpen = MathMin(slotsAvailable, TradesPerCandle * 2/3);
   else
      return;
   
   if(tradesToOpen < 1) tradesToOpen = 1;
   
   Print("SIGNAL: ", (direction > 0 ? "BUY" : "SELL"), " Strength: ", strength,
         " | Opening ", tradesToOpen, " trades");
   
   for(int i = 0; i < tradesToOpen; i++)
   {
      double lots = CalcLot();
      
      if(direction > 0)
         OpenBuy(lots);
      else
         OpenSell(lots);
   }
}

//+------------------------------------------------------------------+
//| TRAILING STOP                                                      |
//+------------------------------------------------------------------+
void ManageTrailingStop()
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double spread = ask - bid;
   
   double trailStartDist = TrailStartPips * pipSize;
   double initialLockDist = InitialLockPips * pipSize;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      long posType = PositionGetInteger(POSITION_TYPE);
      
      if(posType == POSITION_TYPE_BUY)
      {
         double profitDist = bid - openPrice;
         
         if(profitDist >= trailStartDist)
         {
            // Smart trail: lock initial profit + spread buffer + ratio of extra movement
            double extraDist = profitDist - trailStartDist;
            double slFromOpen = spread + initialLockDist + (extraDist * TrailingRatio);
            double newSL = NormalizeDouble(openPrice + slFromOpen, digits_);
            
            // Only move SL forward, never backward
            if(newSL > currentSL + pointValue || currentSL == 0)
            {
               if(newSL > openPrice && newSL < bid)
                  trade.PositionModify(ticket, newSL, currentTP);
            }
         }
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         double profitDist = openPrice - ask;
         
         if(profitDist >= trailStartDist)
         {
            double extraDist = profitDist - trailStartDist;
            double slFromOpen = spread + initialLockDist + (extraDist * TrailingRatio);
            double newSL = NormalizeDouble(openPrice - slFromOpen, digits_);
            
            if(newSL < currentSL - pointValue || currentSL == 0)
            {
               if(newSL < openPrice && newSL > ask)
                  trade.PositionModify(ticket, newSL, currentTP);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| CONFIRMED CANDLE ANALYSIS                                          |
//+------------------------------------------------------------------+
int AnalyzeCandles()
{
   if(Bars(_Symbol, _Period) < 10) return 0;
   
   int score = 0;
   
   double o1 = iOpen(_Symbol, _Period, 1);
   double c1 = iClose(_Symbol, _Period, 1);
   double h1 = iHigh(_Symbol, _Period, 1);
   double l1 = iLow(_Symbol, _Period, 1);
   double body1 = MathAbs(c1 - o1);
   double range1 = h1 - l1;
   
   if(range1 <= 0) return 0;
   double bodyRatio1 = body1 / range1;
   if(bodyRatio1 < 0.30) return 0;
   
   //=== Momentum (last 4 candles) ===
   int bullCount = 0, bearCount = 0;
   double bullForce = 0, bearForce = 0;
   
   for(int i = 1; i <= 4; i++)
   {
      double o = iOpen(_Symbol, _Period, i);
      double c = iClose(_Symbol, _Period, i);
      double h = iHigh(_Symbol, _Period, i);
      double lw = iLow(_Symbol, _Period, i);
      double r = h - lw;
      if(r <= 0) continue;
      
      double b = MathAbs(c - o);
      double ratio = b / r;
      double weight = (5 - i) * 0.3;
      
      if(c > o) { bullCount++; bullForce += b * ratio * weight; }
      else if(c < o) { bearCount++; bearForce += b * ratio * weight; }
   }
   
   if(bullCount >= 3) score += 3;
   else if(bearCount >= 3) score -= 3;
   else if(bullCount >= 2 && bullForce > bearForce * 2.0) score += 2;
   else if(bearCount >= 2 && bearForce > bullForce * 2.0) score -= 2;
   
   //=== Engulfing ===
   double o2 = iOpen(_Symbol, _Period, 2);
   double c2 = iClose(_Symbol, _Period, 2);
   double body2 = MathAbs(c2 - o2);
   
   if(c2 < o2 && c1 > o1 && body1 > body2 * 1.3)
      score += 2;
   else if(c2 > o2 && c1 < o1 && body1 > body2 * 1.3)
      score -= 2;
   
   //=== Current candle confirmation ===
   double currentOpen  = iOpen(_Symbol, _Period, 0);
   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double currentMove  = currentPrice - currentOpen;
   
   if(score > 0 && currentMove > 0) score += 1;
   else if(score < 0 && currentMove < 0) score += -1;
   else if(score > 0 && currentMove < -body1 * 0.5) return 0;
   else if(score < 0 && currentMove > body1 * 0.5) return 0;
   
   //=== Speed burst ===
   double avgRange = 0;
   for(int i = 3; i <= 7; i++)
      avgRange += iHigh(_Symbol, _Period, i) - iLow(_Symbol, _Period, i);
   avgRange /= 5.0;
   
   if(avgRange > 0 && range1 > avgRange * 1.3 && bodyRatio1 > 0.5)
   {
      if(c1 > o1) score += 1;
      else score -= 1;
   }
   
   if(score >= 5) return 3;
   else if(score >= 3) return 2;
   else if(score <= -5) return -3;
   else if(score <= -3) return -2;
   
   return 0;
}

//+------------------------------------------------------------------+
//| Calculate lot                                                      |
//+------------------------------------------------------------------+
double CalcLot()
{
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   if(freeMargin <= 0) return 0.01;
   
   double marginFor1Lot = 0;
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   if(!OrderCalcMargin(ORDER_TYPE_BUY, _Symbol, 1.0, ask, marginFor1Lot) || marginFor1Lot <= 0)
      marginFor1Lot = 1000;
   
   double usableMargin = freeMargin * (MarginUsePercent / 100.0);
   int expectedTrades = MathMax(CountMyTrades() + TradesPerCandle, 1);
   double lots = (usableMargin / expectedTrades) / marginFor1Lot;
   
   double random = 0.9 + (MathRand() % 20) / 100.0;
   lots *= random;
   
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   
   if(lotStep <= 0) lotStep = 0.01;
   lots = MathFloor(lots / lotStep) * lotStep;
   lots = MathMax(lots, minLot);
   lots = MathMin(lots, maxLot);
   lots = MathMin(lots, MaxLotLimit);
   
   // Server lot size override (from EA Control Settings)
   if(g_ControlSettingsLoaded && g_ControlLotSize > 0)
      lots = MathMin(lots, g_ControlLotSize);
   
   if(lots < 0.01) lots = 0.01;
   
   return NormalizeDouble(lots, 2);
}

//+------------------------------------------------------------------+
void OpenBuy(double lots)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   double marginNeeded = 0;
   if(OrderCalcMargin(ORDER_TYPE_BUY, _Symbol, lots, ask, marginNeeded))
   {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(marginNeeded > freeMargin)
      {
         lots = 0.01;
         if(!OrderCalcMargin(ORDER_TYPE_BUY, _Symbol, lots, ask, marginNeeded) || marginNeeded > freeMargin)
         {
            Print("NO MARGIN! Free: $", DoubleToString(freeMargin, 2));
            return;
         }
      }
   }
   
   if(trade.Buy(lots, _Symbol, ask, 0, 0, "ScalpX_BUY"))
   {
      totalTradesOpened++;
      
      // Set initial protective SL (35 pips safety net)
      if(InitialSLPips > 0)
      {
         ulong ticket = trade.ResultOrder();
         if(ticket > 0)
         {
            double sl = NormalizeDouble(ask - (InitialSLPips * pipSize), digits_);
            double tp = (InitialTPPips > 0) ? NormalizeDouble(ask + (InitialTPPips * pipSize), digits_) : 0;
            trade.PositionModify(ticket, sl, tp);
         }
      }
      
      Print("BUY ", lots, " @ ", ask, " | SL: ", InitialSLPips, " TP: ", InitialTPPips,
            " | Open: ", CountMyTrades(),
            " | Equity: $", DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2));
   }
   else
   {
      Print("BUY FAILED! Lots: ", lots, " Err: ", GetLastError(),
            " ", trade.ResultComment());
   }
}

//+------------------------------------------------------------------+
void OpenSell(double lots)
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   double marginNeeded = 0;
   if(OrderCalcMargin(ORDER_TYPE_SELL, _Symbol, lots, bid, marginNeeded))
   {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(marginNeeded > freeMargin)
      {
         lots = 0.01;
         if(!OrderCalcMargin(ORDER_TYPE_SELL, _Symbol, lots, bid, marginNeeded) || marginNeeded > freeMargin)
         {
            Print("NO MARGIN! Free: $", DoubleToString(freeMargin, 2));
            return;
         }
      }
   }
   
   if(trade.Sell(lots, _Symbol, bid, 0, 0, "ScalpX_SELL"))
   {
      totalTradesOpened++;
      
      // Set initial protective SL
      if(InitialSLPips > 0)
      {
         ulong ticket = trade.ResultOrder();
         if(ticket > 0)
         {
            double sl = NormalizeDouble(bid + (InitialSLPips * pipSize), digits_);
            double tp = (InitialTPPips > 0) ? NormalizeDouble(bid - (InitialTPPips * pipSize), digits_) : 0;
            trade.PositionModify(ticket, sl, tp);
         }
      }
      
      Print("SELL ", lots, " @ ", bid, " | SL: ", InitialSLPips, " TP: ", InitialTPPips,
            " | Open: ", CountMyTrades(),
            " | Equity: $", DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2));
   }
   else
   {
      Print("SELL FAILED! Lots: ", lots, " Err: ", GetLastError(),
            " ", trade.ResultComment());
   }
}

//+------------------------------------------------------------------+
void CloseAllTrades(string reason)
{
   int closed = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      
      if(trade.PositionClose(ticket, 50))
         closed++;
   }
   Print("CLOSED ", closed, " trades. Reason: ", reason,
         " | Equity: $", DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2));
}

//+------------------------------------------------------------------+
void CloseOppositeTrades(int newDirection)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      
      long posType = PositionGetInteger(POSITION_TYPE);
      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      
      if(profit <= 0) continue;
      
      if(newDirection < 0 && posType == POSITION_TYPE_BUY)
         trade.PositionClose(ticket, 50);
      else if(newDirection > 0 && posType == POSITION_TYPE_SELL)
         trade.PositionClose(ticket, 50);
   }
}

//+------------------------------------------------------------------+
double GetTotalFloatingProfit()
{
   double total = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      
      total += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }
   return total;
}

//+------------------------------------------------------------------+
int CountMyTrades()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      count++;
   }
   return count;
}

//+------------------------------------------------------------------+
int GetExistingDirection()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      
      long posType = PositionGetInteger(POSITION_TYPE);
      if(posType == POSITION_TYPE_BUY) return 1;
      if(posType == POSITION_TYPE_SELL) return -1;
   }
   return 0;
}

//+------------------------------------------------------------------+
//|                    TRADE DATA REPORTING + SERVER CONTROL            |
//+------------------------------------------------------------------+
void SendTradeDataToServer()
{
   if(StringLen(LicenseKey) == 0) return;
   if(MQLInfoInteger(MQL_TESTER)) return;
   
   g_LastTradeDataUpdate = TimeCurrent();
   
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   int buyCount = 0, sellCount = 0;
   double totalBuyLots = 0, totalSellLots = 0;
   double totalBuyProfit = 0, totalSellProfit = 0;
   
   // Build positions array
   string positionsJson = "[";
   int posCount = 0;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      
      long posType = PositionGetInteger(POSITION_TYPE);
      double lots = PositionGetDouble(POSITION_VOLUME);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      
      if(posType == POSITION_TYPE_BUY)
      { buyCount++; totalBuyLots += lots; totalBuyProfit += profit; }
      else
      { sellCount++; totalSellLots += lots; totalSellProfit += profit; }
      
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
   
   // Build closed positions (last 24h)
   string closedJson = "[";
   int closedCount = 0;
   datetime fromTime = TimeCurrent() - 86400;
   
   if(HistorySelect(fromTime, TimeCurrent()))
   {
      int totalDeals = HistoryDealsTotal();
      for(int i = totalDeals - 1; i >= 0 && closedCount < 50; i--)
      {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket <= 0) continue;
         if(HistoryDealGetString(dealTicket, DEAL_SYMBOL) != _Symbol) continue;
         if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
         if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != MagicNumber) continue;
         
         ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
         if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;
         
         double dealLots = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
         double dealPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
         double dealProfit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
         datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
         
         ulong posTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
         double openPrice = 0;
         for(int j = 0; j < totalDeals; j++)
         {
            ulong openDealTicket = HistoryDealGetTicket(j);
            if(openDealTicket <= 0) continue;
            if((ulong)HistoryDealGetInteger(openDealTicket, DEAL_POSITION_ID) == posTicket &&
               (ENUM_DEAL_ENTRY)HistoryDealGetInteger(openDealTicket, DEAL_ENTRY) == DEAL_ENTRY_IN)
            {
               openPrice = HistoryDealGetDouble(openDealTicket, DEAL_PRICE);
               break;
            }
         }
         
         if(closedCount > 0) closedJson += ",";
         closedJson += "{";
         closedJson += "\"ticket\":" + IntegerToString(dealTicket) + ",";
         closedJson += "\"symbol\":\"" + _Symbol + "\",";
         closedJson += "\"type\":\"" + (dealType == DEAL_TYPE_SELL ? "BUY" : "SELL") + "\",";
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
   
   bool skipBuy = (!g_LicenseValid || g_ControlTargetStopped || g_ControlScheduleStopped);
   bool skipSell = skipBuy;
   string filterStatus = "Active";
   if(g_ControlTargetStopped) filterStatus = "Target Reached - Paused";
   else if(g_ControlScheduleStopped) filterStatus = "Schedule Stop - Paused";
   else if(!g_LicenseValid) filterStatus = "License Invalid";
   
   // Build JSON
   string jsonRequest = "{";
   jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
   jsonRequest += "\"account_balance\":" + DoubleToString(balance, 2) + ",";
   jsonRequest += "\"account_equity\":" + DoubleToString(equity, 2) + ",";
   jsonRequest += "\"account_profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
   jsonRequest += "\"account_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   jsonRequest += "\"account_free_margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   jsonRequest += "\"total_buy_positions\":" + IntegerToString(buyCount) + ",";
   jsonRequest += "\"total_sell_positions\":" + IntegerToString(sellCount) + ",";
   jsonRequest += "\"total_buy_lots\":" + DoubleToString(totalBuyLots, 2) + ",";
   jsonRequest += "\"total_sell_lots\":" + DoubleToString(totalSellLots, 2) + ",";
   jsonRequest += "\"total_buy_profit\":" + DoubleToString(totalBuyProfit, 2) + ",";
   jsonRequest += "\"total_sell_profit\":" + DoubleToString(totalSellProfit, 2) + ",";
   jsonRequest += "\"total_pending_orders\":0,";
   jsonRequest += "\"trading_mode\":\"ScalpX Pattern Scalper\",";
   jsonRequest += "\"symbol\":\"" + _Symbol + "\",";
   jsonRequest += "\"current_price\":" + DoubleToString(bid, digits) + ",";
   jsonRequest += "\"trend_direction\":\"N/A\",";
   jsonRequest += "\"filter_status\":\"" + filterStatus + "\",";
   jsonRequest += "\"atr_gap_buy\":0,";
   jsonRequest += "\"atr_gap_sell\":0,";
   jsonRequest += "\"spread\":" + DoubleToString((SymbolInfoDouble(_Symbol, SYMBOL_ASK) - bid) / _Point, 1) + ",";
   jsonRequest += "\"skip_buy\":" + (skipBuy ? "true" : "false") + ",";
   jsonRequest += "\"skip_sell\":" + (skipSell ? "true" : "false") + ",";
   jsonRequest += "\"buy_mode\":\"NORMAL\",";
   jsonRequest += "\"sell_mode\":\"NORMAL\",";
   jsonRequest += "\"drawdown_amount\":0,";
   jsonRequest += "\"drawdown_percent\":0,";
   jsonRequest += "\"drawdown_limit\":0,";
   jsonRequest += "\"equity_skip_percent\":0,";
   jsonRequest += "\"max_recovery_lot\":0,";
   jsonRequest += "\"lot_size\":" + DoubleToString(MaxLotLimit, 2) + ",";
   jsonRequest += "\"open_positions\":" + positionsJson + ",";
   jsonRequest += "\"pending_orders\":[],";
   jsonRequest += "\"closed_positions\":" + closedJson;
   jsonRequest += "}";
   
   string url = LicenseServer + "/api/trade-data/update/";
   string headers = "Content-Type: application/json\r\n";
   char postData[];
   char result[];
   string resultHeaders;
   
   StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
   
   int response = WebRequest("POST", url, headers, 2000, postData, result, resultHeaders);
   
   if(response == 200 && ArraySize(result) > 0)
   {
      string responseStr = CharArrayToString(result);
      ParseEAControlFromResponse(responseStr);
   }
}

//+------------------------------------------------------------------+
void ParseEAControlFromResponse(string json)
{
   // Parse is_target_stopped
   int tsPos = StringFind(json, "\"is_target_stopped\"");
   if(tsPos >= 0)
   {
      int colonPos = StringFind(json, ":", tsPos);
      if(colonPos >= 0)
      {
         string val = StringSubstr(json, colonPos + 1, 10);
         StringTrimLeft(val);
         StringTrimRight(val);
         g_ControlTargetStopped = (StringFind(val, "true") == 0);
      }
   }
   
   // Parse is_schedule_stopped
   int ssPos = StringFind(json, "\"is_schedule_stopped\"");
   if(ssPos >= 0)
   {
      int colonPos = StringFind(json, ":", ssPos);
      if(colonPos >= 0)
      {
         string val = StringSubstr(json, colonPos + 1, 10);
         StringTrimLeft(val);
         StringTrimRight(val);
         g_ControlScheduleStopped = (StringFind(val, "true") == 0);
      }
   }
   
   // Parse lot_size (server override)
   int lsPos = StringFind(json, "\"lot_size\"");
   if(lsPos >= 0)
   {
      int colonPos = StringFind(json, ":", lsPos);
      if(colonPos >= 0)
      {
         string rest = StringSubstr(json, colonPos + 1, 20);
         StringTrimLeft(rest);
         int endIdx = 0;
         for(int c = 0; c < StringLen(rest); c++)
         {
            ushort ch = StringGetCharacter(rest, c);
            if((ch >= '0' && ch <= '9') || ch == '.') endIdx = c + 1;
            else if(endIdx > 0) break;
         }
         if(endIdx > 0)
         {
            string numStr = StringSubstr(rest, 0, endIdx);
            double lotVal = StringToDouble(numStr);
            g_ControlLotSize = MathMax(0.0, lotVal);
         }
      }
   }
   
   g_ControlSettingsLoaded = true;
}

//+------------------------------------------------------------------+
//|                    LICENSE VERIFICATION SYSTEM                      |
//+------------------------------------------------------------------+
bool IsTesterMode()
{
   return (TesterMode && (MQLInfoInteger(MQL_TESTER) != 0));
}

//+------------------------------------------------------------------+
datetime LicenseCacheNow()
{
   return (datetime)TimeLocal();
}

//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
string LicenseCachePrefix(string mt5Account)
{
   uint h = Fnv1aHash(LicenseKey + "|" + mt5Account);
   return "LIC_SX_" + StringFormat("%08X", h);
}

//+------------------------------------------------------------------+
string LicenseCacheFileName(string mt5Account)
{
   uint h = Fnv1aHash(LicenseKey + "|" + mt5Account);
   return StringFormat("scalpx_cache_%08X.bin", h);
}

//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
void SaveCachedLicense(string mt5Account)
{
   string p = LicenseCachePrefix(mt5Account);
   GlobalVariableSet(p + "_V", g_LicenseValid ? 1.0 : 0.0);
   GlobalVariableSet(p + "_T", (double)LicenseCacheNow());
   GlobalVariableSet(p + "_D", (double)g_DaysRemaining);
   
   SaveCachedLicenseCommon(mt5Account);
}

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
   
   if(StringLen(LicenseKey) == 0)
   {
      g_LicenseMessage = "NO LICENSE KEY ENTERED";
      g_LicenseValid = false;
      g_PlanName = "";
      g_DaysRemaining = 0;
      return false;
   }
   
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
   
   string url = LicenseServer + "/api/verify/";
   string headers = "Content-Type: application/json\r\n";
   char postData[];
   char result[];
   string resultHeaders;
   
   StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
   
   ResetLastError();
   int response = WebRequest("POST", url, headers, 5000, postData, result, resultHeaders);
   
   // Connection failed
   if(response == -1)
   {
      int error = GetLastError();
      if(error == 4014)
         g_LicenseMessage = "URL NOT ALLOWED - Add '" + LicenseServer + "' to Tools > Options > Expert Advisors";
      else if(IsTesterMode() && accountNumber == 0 && StringLen(TesterAccountOverride) == 0)
         g_LicenseMessage = "TESTER ACCOUNT=0 - Set TesterAccountOverride";
      else
         g_LicenseMessage = "SERVER CONNECTION FAILED (Error: " + IntegerToString(error) + ")";
      
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
   string lowerResp = responseStr;
   StringToLower(lowerResp);
   
   bool hasValidTrue = (StringFind(lowerResp, "\"valid\": true") >= 0 || 
                       StringFind(lowerResp, "\"valid\":true") >= 0);
   bool hasValidFalse = (StringFind(lowerResp, "\"valid\": false") >= 0 || 
                        StringFind(lowerResp, "\"valid\":false") >= 0);
   
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
   
   // Invalid
   g_LicenseValid = false;
   g_PlanName = "";
   g_DaysRemaining = 0;
   g_LastVerification = TimeCurrent();
   
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
//| LICENSE PANEL ON CHART                                             |
//+------------------------------------------------------------------+
void UpdateLicensePanel()
{
   ObjectDelete(0, "SX_EAName");
   ObjectDelete(0, "SX_LicenseURL");
   ObjectDelete(0, "SX_LicenseStatus");
   ObjectDelete(0, "SX_LicensePlan");
   ObjectDelete(0, "SX_LicenseDays");
   ObjectDelete(0, "SX_LicenseWarning");
   
   int yPos = 15;
   int rightX = 220;
   
   // EA Name
   ObjectCreate(0, "SX_EAName", OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, "SX_EAName", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, "SX_EAName", OBJPROP_XDISTANCE, rightX);
   ObjectSetInteger(0, "SX_EAName", OBJPROP_YDISTANCE, yPos);
   ObjectSetString(0, "SX_EAName", OBJPROP_TEXT, "Mark's AI ScalpX V1.0");
   ObjectSetInteger(0, "SX_EAName", OBJPROP_COLOR, clrGold);
   ObjectSetInteger(0, "SX_EAName", OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, "SX_EAName", OBJPROP_FONT, "Arial Bold");
   yPos += 18;
   
   // Website URL
   ObjectCreate(0, "SX_LicenseURL", OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, "SX_LicenseURL", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, "SX_LicenseURL", OBJPROP_XDISTANCE, rightX);
   ObjectSetInteger(0, "SX_LicenseURL", OBJPROP_YDISTANCE, yPos);
   ObjectSetString(0, "SX_LicenseURL", OBJPROP_TEXT, "www.markstrades.com");
   ObjectSetInteger(0, "SX_LicenseURL", OBJPROP_COLOR, clrDodgerBlue);
   ObjectSetInteger(0, "SX_LicenseURL", OBJPROP_FONTSIZE, 8);
   ObjectSetString(0, "SX_LicenseURL", OBJPROP_FONT, "Arial");
   yPos += 16;
   
   // License Status
   string statusText = g_LicenseValid ? "LICENSE: ACTIVE" : "LICENSE: INVALID";
   color statusColor = g_LicenseValid ? clrLime : clrRed;
   
   ObjectCreate(0, "SX_LicenseStatus", OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, "SX_LicenseStatus", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, "SX_LicenseStatus", OBJPROP_XDISTANCE, rightX);
   ObjectSetInteger(0, "SX_LicenseStatus", OBJPROP_YDISTANCE, yPos);
   ObjectSetString(0, "SX_LicenseStatus", OBJPROP_TEXT, statusText);
   ObjectSetInteger(0, "SX_LicenseStatus", OBJPROP_COLOR, statusColor);
   ObjectSetInteger(0, "SX_LicenseStatus", OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, "SX_LicenseStatus", OBJPROP_FONT, "Arial Bold");
   yPos += 16;
   
   if(g_LicenseValid)
   {
      // Plan Name
      ObjectCreate(0, "SX_LicensePlan", OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, "SX_LicensePlan", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(0, "SX_LicensePlan", OBJPROP_XDISTANCE, rightX);
      ObjectSetInteger(0, "SX_LicensePlan", OBJPROP_YDISTANCE, yPos);
      ObjectSetString(0, "SX_LicensePlan", OBJPROP_TEXT, "Plan: " + g_PlanName);
      ObjectSetInteger(0, "SX_LicensePlan", OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, "SX_LicensePlan", OBJPROP_FONTSIZE, 9);
      ObjectSetString(0, "SX_LicensePlan", OBJPROP_FONT, "Arial");
      yPos += 14;
      
      // Days Remaining
      string daysText = "Days Left: " + IntegerToString(g_DaysRemaining);
      color daysColor = clrLime;
      if(g_DaysRemaining <= 7) daysColor = clrOrange;
      if(g_DaysRemaining <= 3) daysColor = clrRed;
      
      ObjectCreate(0, "SX_LicenseDays", OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, "SX_LicenseDays", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(0, "SX_LicenseDays", OBJPROP_XDISTANCE, rightX);
      ObjectSetInteger(0, "SX_LicenseDays", OBJPROP_YDISTANCE, yPos);
      ObjectSetString(0, "SX_LicenseDays", OBJPROP_TEXT, daysText);
      ObjectSetInteger(0, "SX_LicenseDays", OBJPROP_COLOR, daysColor);
      ObjectSetInteger(0, "SX_LicenseDays", OBJPROP_FONTSIZE, 9);
      ObjectSetString(0, "SX_LicenseDays", OBJPROP_FONT, "Arial Bold");
      yPos += 14;
      
      if(g_DaysRemaining <= 7)
      {
         string warningText = g_DaysRemaining <= 3 ? "!! RENEW NOW !!" : "! Renew Soon !";
         ObjectCreate(0, "SX_LicenseWarning", OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
         ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_XDISTANCE, rightX);
         ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_YDISTANCE, yPos);
         ObjectSetString(0, "SX_LicenseWarning", OBJPROP_TEXT, warningText);
         ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_COLOR, g_DaysRemaining <= 3 ? clrRed : clrOrange);
         ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_FONTSIZE, 10);
         ObjectSetString(0, "SX_LicenseWarning", OBJPROP_FONT, "Arial Bold");
      }
   }
   else
   {
      ObjectCreate(0, "SX_LicenseWarning", OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_XDISTANCE, rightX);
      ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_YDISTANCE, yPos);
      ObjectSetString(0, "SX_LicenseWarning", OBJPROP_TEXT, "TRADING DISABLED");
      ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_COLOR, clrRed);
      ObjectSetInteger(0, "SX_LicenseWarning", OBJPROP_FONTSIZE, 10);
      ObjectSetString(0, "SX_LicenseWarning", OBJPROP_FONT, "Arial Bold");
   }
}

//+------------------------------------------------------------------+
