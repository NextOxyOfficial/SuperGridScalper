//+------------------------------------------------------------------+
//|                                              SimpleBTC_EA.mq5     |
//|                          Simple BTC Grid EA - Testing Version     |
//|                          Developed by Alimul Islam               |
//+------------------------------------------------------------------+
#property copyright "Alimul Islam"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input double   LotSize = 0.01;           // Lot Size
input double   BuyRangeTop = 110000;     // BUY Range Top (place orders below price)
input double   BuyRangeBottom = 90000;   // BUY Range Bottom
input double   SellRangeBottom = 90000;  // SELL Range Bottom (place orders above price)
input double   SellRangeTop = 110000;    // SELL Range Top
input double   GapPips = 30;             // Gap between orders (pips)
input double   TakeProfitPips = 50;      // Take Profit (pips)
input int      MaxOrders = 4;            // Max orders per side

//--- Global Variables
CTrade trade;
double pip = 10.0;  // BTC pip = $10 (99000 -> 99010 = 1 pip)
int MagicNumber = 123456;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    trade.SetExpertMagicNumber(MagicNumber);
    
    // Validate lot size
    double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    
    Print("=== Simple BTC EA Started ===");
    Print("Symbol: ", _Symbol);
    Print("Lot Size: ", LotSize, " | Min: ", minLot, " | Max: ", maxLot);
    Print("BUY Range: ", BuyRangeBottom, " - ", BuyRangeTop);
    Print("SELL Range: ", SellRangeBottom, " - ", SellRangeTop);
    Print("Gap: ", GapPips, " pips = $", GapPips * pip);
    Print("TP: ", TakeProfitPips, " pips = $", TakeProfitPips * pip);
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Count existing orders and positions
    int buyCount = 0, sellCount = 0;
    int buyPending = 0, sellPending = 0;
    
    // Count positions
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        if(PositionGetTicket(i) > 0 && PositionGetString(POSITION_SYMBOL) == _Symbol)
        {
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) buyCount++;
            else sellCount++;
        }
    }
    
    // Count pending orders
    for(int i = OrdersTotal() - 1; i >= 0; i--)
    {
        if(OrderGetTicket(i) > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol)
        {
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_BUY_LIMIT) buyPending++;
            else if(type == ORDER_TYPE_SELL_LIMIT) sellPending++;
        }
    }
    
    // Debug every 10 seconds
    static datetime lastDebug = 0;
    if(TimeCurrent() - lastDebug > 10)
    {
        lastDebug = TimeCurrent();
        Print("--- Status ---");
        Print("BID: ", bid, " | ASK: ", ask);
        Print("BUY: ", buyCount, " positions + ", buyPending, " pending = ", buyCount + buyPending, "/", MaxOrders);
        Print("SELL: ", sellCount, " positions + ", sellPending, " pending = ", sellCount + sellPending, "/", MaxOrders);
    }
    
    double gapPrice = GapPips * pip;
    double tpPrice = TakeProfitPips * pip;
    
    // ===== PLACE BUY LIMIT ORDERS =====
    // BUY LIMIT = placed BELOW current price, triggers when price drops
    if(buyCount + buyPending < MaxOrders && bid >= BuyRangeBottom && bid <= BuyRangeTop)
    {
        int needed = MaxOrders - (buyCount + buyPending);
        
        for(int i = 1; i <= needed; i++)
        {
            double price = NormalizeDouble(bid - (i * gapPrice), digits);
            
            if(price < BuyRangeBottom) break;
            
            // Check if order already exists at this price
            bool exists = false;
            for(int j = OrdersTotal() - 1; j >= 0; j--)
            {
                if(OrderGetTicket(j) > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol)
                {
                    if(MathAbs(OrderGetDouble(ORDER_PRICE_OPEN) - price) < gapPrice / 2)
                    {
                        exists = true;
                        break;
                    }
                }
            }
            
            if(!exists)
            {
                double tp = NormalizeDouble(price + tpPrice, digits);
                
                Print(">>> Placing BUY LIMIT @ ", price, " | TP: ", tp, " | Lot: ", LotSize);
                
                if(trade.BuyLimit(LotSize, price, _Symbol, 0, tp, ORDER_TIME_GTC, 0, "BTC_EA"))
                {
                    Print(">>> SUCCESS: BUY LIMIT placed @ ", price);
                }
                else
                {
                    Print(">>> FAILED: BUY LIMIT @ ", price, " | Error: ", GetLastError(), " | ", trade.ResultRetcodeDescription());
                }
            }
        }
    }
    
    // ===== PLACE SELL LIMIT ORDERS =====
    // SELL LIMIT = placed ABOVE current price, triggers when price rises
    if(sellCount + sellPending < MaxOrders && ask >= SellRangeBottom && ask <= SellRangeTop)
    {
        int needed = MaxOrders - (sellCount + sellPending);
        
        for(int i = 1; i <= needed; i++)
        {
            double price = NormalizeDouble(ask + (i * gapPrice), digits);
            
            if(price > SellRangeTop) break;
            
            // Check if order already exists at this price
            bool exists = false;
            for(int j = OrdersTotal() - 1; j >= 0; j--)
            {
                if(OrderGetTicket(j) > 0 && OrderGetString(ORDER_SYMBOL) == _Symbol)
                {
                    if(MathAbs(OrderGetDouble(ORDER_PRICE_OPEN) - price) < gapPrice / 2)
                    {
                        exists = true;
                        break;
                    }
                }
            }
            
            if(!exists)
            {
                double tp = NormalizeDouble(price - tpPrice, digits);
                
                Print(">>> Placing SELL LIMIT @ ", price, " | TP: ", tp, " | Lot: ", LotSize);
                
                if(trade.SellLimit(LotSize, price, _Symbol, 0, tp, ORDER_TIME_GTC, 0, "BTC_EA"))
                {
                    Print(">>> SUCCESS: SELL LIMIT placed @ ", price);
                }
                else
                {
                    Print(">>> FAILED: SELL LIMIT @ ", price, " | Error: ", GetLastError(), " | ", trade.ResultRetcodeDescription());
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("=== Simple BTC EA Stopped ===");
}
