//+------------------------------------------------------------------+
//|                                    ManualScalpingEA_Fixed.mq5 |
//|                        Copyright 2026, Manual Scalping Trader |
//|                                             https://mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Manual Scalping Trader"
#property link      "https://mql5.com"
#property version   "1.00"
#property description "Manual Scalping EA with 1-click trading buttons"

#include <Trade\Trade.mqh>

//--- Input parameters
input double   LotSize = 0.02;           // Lot size for trades
input int      TakeProfitPips = 50;      // Take profit in pips
input int      StopLossPips = 50;        // Stop loss in pips
input bool     UseStopLoss = true;      // Enable stop loss
input color    ButtonColorBuy = clrGreen;    // Buy button color
input color    ButtonColorSell = clrRed;     // Sell button color
input color    ButtonColorBoth = clrBlue;    // Both button color
input int      MagicNumber = 12345;      // Magic number for trades

//--- Global variables
string ButtonBuy = "BtnBuy";
string ButtonSell = "BtnSell";
string ButtonBoth = "BtnBoth";
string ButtonClose = "BtnClose";
string LabelInfo = "InfoLabel";
string LabelPrice = "LblPrice";
string LabelCredit = "LblCredit";
string PanelBg = "PanelBg";
string EditLot = "EditLot";
string EditTP = "EditTP";
string LabelLot = "LblLot";
string LabelTP = "LblTP";

double CurrentLot = 0.0;
int CurrentTakeProfitPips = 0;

CTrade trade;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   CurrentLot = LotSize;
   CurrentTakeProfitPips = TakeProfitPips;
   ObjectDelete(0, "BtnApply");
   CreateButtons();
   CreateInfoLabel();
   CreateControls();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   DeleteButtons();
   DeleteInfoLabel();
   DeleteControls();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   UpdateInfoLabel();
}

//+------------------------------------------------------------------+
//| Chart event function                                             |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_ENDEDIT)
   {
      if(sparam == EditLot || sparam == EditTP)
         ApplyRuntimeSettingsFromUI();
   }

   if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == ButtonBuy)
      {
         ExecuteBuyOrder();
         ObjectSetInteger(0, ButtonBuy, OBJPROP_STATE, false);
      }
      else if(sparam == ButtonSell)
      {
         ExecuteSellOrder();
         ObjectSetInteger(0, ButtonSell, OBJPROP_STATE, false);
      }
      else if(sparam == ButtonBoth)
      {
         ExecuteBothOrders();
         ObjectSetInteger(0, ButtonBoth, OBJPROP_STATE, false);
      }
      else if(sparam == ButtonClose)
      {
         CloseAllOrders();
         ObjectSetInteger(0, ButtonClose, OBJPROP_STATE, false);
      }
   }
}

//+------------------------------------------------------------------+
//| Create trading buttons                                           |
//+------------------------------------------------------------------+
void CreateButtons()
{
   int x_start = 20;
   int y_start = 70;
   int button_width = 100;
   int button_height = 30;
   int button_spacing = 35;
   
   // Buy button
   ObjectCreate(0, ButtonBuy, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_XDISTANCE, x_start);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_YDISTANCE, y_start);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_YSIZE, button_height);
   ObjectSetString(0, ButtonBuy, OBJPROP_TEXT, "BUY");
   ObjectSetInteger(0, ButtonBuy, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_BGCOLOR, ButtonColorBuy);
   ObjectSetInteger(0, ButtonBuy, OBJPROP_FONTSIZE, 12);
   ObjectSetString(0, ButtonBuy, OBJPROP_FONT, "Arial Bold");
   
   // Sell button
   ObjectCreate(0, ButtonSell, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, ButtonSell, OBJPROP_XDISTANCE, x_start);
   ObjectSetInteger(0, ButtonSell, OBJPROP_YDISTANCE, y_start + button_spacing);
   ObjectSetInteger(0, ButtonSell, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, ButtonSell, OBJPROP_YSIZE, button_height);
   ObjectSetString(0, ButtonSell, OBJPROP_TEXT, "SELL");
   ObjectSetInteger(0, ButtonSell, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, ButtonSell, OBJPROP_BGCOLOR, ButtonColorSell);
   ObjectSetInteger(0, ButtonSell, OBJPROP_FONTSIZE, 12);
   ObjectSetString(0, ButtonSell, OBJPROP_FONT, "Arial Bold");
   
   // Both button
   ObjectCreate(0, ButtonBoth, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_XDISTANCE, x_start);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_YDISTANCE, y_start + button_spacing * 2);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_YSIZE, button_height);
   ObjectSetString(0, ButtonBoth, OBJPROP_TEXT, "HEDGE");
   ObjectSetInteger(0, ButtonBoth, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_BGCOLOR, ButtonColorBoth);
   ObjectSetInteger(0, ButtonBoth, OBJPROP_FONTSIZE, 12);
   ObjectSetString(0, ButtonBoth, OBJPROP_FONT, "Arial Bold");
   
   // Close All button
   ObjectCreate(0, ButtonClose, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, ButtonClose, OBJPROP_XDISTANCE, x_start);
   ObjectSetInteger(0, ButtonClose, OBJPROP_YDISTANCE, y_start + button_spacing * 3);
   ObjectSetInteger(0, ButtonClose, OBJPROP_XSIZE, button_width);
   ObjectSetInteger(0, ButtonClose, OBJPROP_YSIZE, button_height);
   ObjectSetString(0, ButtonClose, OBJPROP_TEXT, "CLOSE ALL");
   ObjectSetInteger(0, ButtonClose, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, ButtonClose, OBJPROP_BGCOLOR, clrOrange);
   ObjectSetInteger(0, ButtonClose, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, ButtonClose, OBJPROP_FONT, "Arial Bold");
}

//+------------------------------------------------------------------+
//| Create info label                                                |
//+------------------------------------------------------------------+
void CreateInfoLabel()
{
   ObjectCreate(0, LabelInfo, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, LabelInfo, OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, LabelInfo, OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, LabelInfo, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, LabelInfo, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, LabelInfo, OBJPROP_FONT, "Arial");

   ObjectCreate(0, LabelPrice, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, LabelPrice, OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, LabelPrice, OBJPROP_YDISTANCE, 40);
   ObjectSetInteger(0, LabelPrice, OBJPROP_COLOR, clrAqua);
   ObjectSetInteger(0, LabelPrice, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, LabelPrice, OBJPROP_FONT, "Arial Bold");

   ObjectCreate(0, LabelCredit, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, LabelCredit, OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, LabelCredit, OBJPROP_YDISTANCE, 210);
   ObjectSetInteger(0, LabelCredit, OBJPROP_COLOR, clrSilver);
   ObjectSetInteger(0, LabelCredit, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, LabelCredit, OBJPROP_FONT, "Arial");
   ObjectSetString(0, LabelCredit, OBJPROP_TEXT, "Developed by Alimul Islam");
}

void CreateControls()
{
   ObjectCreate(0, PanelBg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, PanelBg, OBJPROP_XDISTANCE, 10);
   ObjectSetInteger(0, PanelBg, OBJPROP_YDISTANCE, 10);
   ObjectSetInteger(0, PanelBg, OBJPROP_XSIZE, 235);
   ObjectSetInteger(0, PanelBg, OBJPROP_YSIZE, 235);
   ObjectSetInteger(0, PanelBg, OBJPROP_COLOR, clrBlack);
   ObjectSetInteger(0, PanelBg, OBJPROP_BGCOLOR, clrBlack);
   ObjectSetInteger(0, PanelBg, OBJPROP_BACK, true);

   int x = 140;
   int y = 70;
   int lbl_w = 55;
   int edit_w = 80;
   int h = 22;
   int gap = 28;
 
   ObjectCreate(0, LabelLot, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, LabelLot, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, LabelLot, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, LabelLot, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, LabelLot, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, LabelLot, OBJPROP_FONT, "Arial");
   ObjectSetString(0, LabelLot, OBJPROP_TEXT, "LOT");
 
   ObjectCreate(0, EditLot, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, EditLot, OBJPROP_XDISTANCE, x + lbl_w);
   ObjectSetInteger(0, EditLot, OBJPROP_YDISTANCE, y - 2);
   ObjectSetInteger(0, EditLot, OBJPROP_XSIZE, edit_w);
   ObjectSetInteger(0, EditLot, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, EditLot, OBJPROP_COLOR, clrBlack);
   ObjectSetInteger(0, EditLot, OBJPROP_BGCOLOR, clrWhite);
   ObjectSetString(0, EditLot, OBJPROP_TEXT, DoubleToString(CurrentLot, 2));
 
   ObjectCreate(0, LabelTP, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, LabelTP, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, LabelTP, OBJPROP_YDISTANCE, y + gap);
   ObjectSetInteger(0, LabelTP, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, LabelTP, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, LabelTP, OBJPROP_FONT, "Arial");
   ObjectSetString(0, LabelTP, OBJPROP_TEXT, "TP");
 
   ObjectCreate(0, EditTP, OBJ_EDIT, 0, 0, 0);
   ObjectSetInteger(0, EditTP, OBJPROP_XDISTANCE, x + lbl_w);
   ObjectSetInteger(0, EditTP, OBJPROP_YDISTANCE, y + gap - 2);
   ObjectSetInteger(0, EditTP, OBJPROP_XSIZE, edit_w);
   ObjectSetInteger(0, EditTP, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, EditTP, OBJPROP_COLOR, clrBlack);
   ObjectSetInteger(0, EditTP, OBJPROP_BGCOLOR, clrWhite);
   ObjectSetString(0, EditTP, OBJPROP_TEXT, IntegerToString(CurrentTakeProfitPips));
}

void DeleteControls()
{
   ObjectDelete(0, PanelBg);
   ObjectDelete(0, LabelLot);
   ObjectDelete(0, EditLot);
   ObjectDelete(0, LabelTP);
   ObjectDelete(0, EditTP);
}

void ApplyRuntimeSettingsFromUI()
{
   string lot_text = ObjectGetString(0, EditLot, OBJPROP_TEXT);
   string tp_text = ObjectGetString(0, EditTP, OBJPROP_TEXT);

   double newLot = StringToDouble(lot_text);
   int newTP = (int)StringToInteger(tp_text);

   if(newLot <= 0.0 || newTP <= 0)
   {
      ObjectSetString(0, EditLot, OBJPROP_TEXT, DoubleToString(CurrentLot, 2));
      ObjectSetString(0, EditTP, OBJPROP_TEXT, IntegerToString(CurrentTakeProfitPips));
      return;
   }

   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double vstep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(vstep > 0.0)
      newLot = MathFloor(newLot / vstep) * vstep;
   if(vmin > 0.0)
      newLot = MathMax(vmin, newLot);
   if(vmax > 0.0)
      newLot = MathMin(vmax, newLot);

   CurrentLot = newLot;
   CurrentTakeProfitPips = newTP;

   ObjectSetString(0, EditLot, OBJPROP_TEXT, DoubleToString(CurrentLot, 2));
   ObjectSetString(0, EditTP, OBJPROP_TEXT, IntegerToString(CurrentTakeProfitPips));
}

//+------------------------------------------------------------------+
//| Update info label                                                |
//+------------------------------------------------------------------+
void UpdateInfoLabel()
{
   int spread_points = (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   string info = StringFormat("Lot: %.2f | TP: %d pips | SL: %s | Spread: %d", 
                             CurrentLot, CurrentTakeProfitPips, 
                             UseStopLoss ? IntegerToString(StopLossPips) + " pips" : "OFF",
                             spread_points);
   ObjectSetString(0, LabelInfo, OBJPROP_TEXT, info);

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   string price = "BID: " + DoubleToString(bid, digits) + "  ASK: " + DoubleToString(ask, digits);
   ObjectSetString(0, LabelPrice, OBJPROP_TEXT, price);
}

//+------------------------------------------------------------------+
//| Execute buy order                                                |
//+------------------------------------------------------------------+
void ExecuteBuyOrder()
{
   ApplyRuntimeSettingsFromUI();

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   double pipMultiplier = (digits == 5 || digits == 3) ? 10.0 : 1.0;
   
   double tp = ask + (CurrentTakeProfitPips * point * pipMultiplier);
   double sl = UseStopLoss ? ask - (StopLossPips * point * pipMultiplier) : 0.0;
   
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   
   bool result = trade.Buy(CurrentLot, _Symbol, 0.0, sl, tp, "Manual Scalp Buy");
   
   if(result)
   {
      Print("Buy order executed successfully. Ticket: ", trade.ResultOrder());
   }
   else
   {
      Print("Buy order failed. Error: ", trade.ResultRetcode());
   }
}

//+------------------------------------------------------------------+
//| Execute sell order                                               |
//+------------------------------------------------------------------+
void ExecuteSellOrder()
{
   ApplyRuntimeSettingsFromUI();

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   double pipMultiplier = (digits == 5 || digits == 3) ? 10.0 : 1.0;
   
   double tp = bid - (CurrentTakeProfitPips * point * pipMultiplier);
   double sl = UseStopLoss ? bid + (StopLossPips * point * pipMultiplier) : 0.0;
   
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   
   bool result = trade.Sell(CurrentLot, _Symbol, 0.0, sl, tp, "Manual Scalp Sell");
   
   if(result)
   {
      Print("Sell order executed successfully. Ticket: ", trade.ResultOrder());
   }
   else
   {
      Print("Sell order failed. Error: ", trade.ResultRetcode());
   }
}

//+------------------------------------------------------------------+
//| Execute both buy and sell orders                                 |
//+------------------------------------------------------------------+
void ExecuteBothOrders()
{
   ApplyRuntimeSettingsFromUI();

   ExecuteBuyOrder();
   Sleep(100);
   ExecuteSellOrder();
}

//+------------------------------------------------------------------+
//| Close all orders                                                 |
//+------------------------------------------------------------------+
void CloseAllOrders()
{
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) == _Symbol && 
            PositionGetInteger(POSITION_MAGIC) == MagicNumber)
         {
            bool result = trade.PositionClose(ticket);
            if(result)
            {
               Print("Position closed: ", ticket);
            }
            else
            {
               Print("Failed to close position: ", ticket, " Error: ", trade.ResultRetcode());
            }
         }
      }
   }
   Print("All positions processed");
}

//+------------------------------------------------------------------+
//| Delete buttons                                                   |
//+------------------------------------------------------------------+
void DeleteButtons()
{
   ObjectDelete(0, ButtonBuy);
   ObjectDelete(0, ButtonSell);
   ObjectDelete(0, ButtonBoth);
   ObjectDelete(0, ButtonClose);
}

//+------------------------------------------------------------------+
//| Delete info label                                                |
//+------------------------------------------------------------------+
void DeleteInfoLabel()
{
   ObjectDelete(0, LabelInfo);
   ObjectDelete(0, LabelPrice);
   ObjectDelete(0, LabelCredit);
}
