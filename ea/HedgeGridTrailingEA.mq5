//+------------------------------------------------------------------+
//|                                        HedgeGridTrailingEA.mq5   |
//|                      Hedging Grid with Trailing Stop EA          |
//|                          Developed by Alimul Islam               |
//|                          Contact: +8801957045438                 |
//+------------------------------------------------------------------+
#property copyright "Developed by Alimul Islam"
#property link      "+8801957045438"
#property version   "2.0"
#property strict

#include <Trade\Trade.mqh>

CTrade trade;

//--- License Input (Only visible setting)
input string    LicenseKey        = "";    // License Key

//--- Server URL (Hardcoded - not visible to user)
string    LicenseServer     = "http://127.0.0.1:8000";

//--- License Status (Global)
bool g_LicenseValid = false;
string g_LicenseMessage = "";
int g_DaysRemaining = 0;
string g_PlanName = "";
datetime g_LastVerification = 0;
bool g_SettingsLoaded = false;

//--- All Settings Loaded from Server (Hidden from user)
// BUY Grid Range Settings
double    BuyRangeStart     = 0;
double    BuyRangeEnd       = 0;
double    BuyGapPips        = 0;
int       MaxBuyOrders      = 0;

// BUY TP/SL/Trailing Settings
double    BuyTakeProfitPips    = 0;
double    BuyStopLossPips      = 0;
double    BuyTrailingStartPips = 0;
double    BuyInitialSLPips     = 0;
double    BuyTrailingRatio     = 0;
double    BuyMaxSLDistance     = 0;
double    BuyTrailingStepPips  = 0;

// SELL Grid Range Settings
double    SellRangeStart    = 0;
double    SellRangeEnd      = 0;
double    SellGapPips       = 0;
int       MaxSellOrders     = 0;

// SELL TP/SL/Trailing Settings
double    SellTakeProfitPips    = 0;
double    SellStopLossPips      = 0;
double    SellTrailingStartPips = 0;
double    SellInitialSLPips     = 0;
double    SellTrailingRatio     = 0;
double    SellMaxSLDistance     = 0;
double    SellTrailingStepPips  = 0;

// Lot & Risk
double    LotSize           = 0.01;

// Breakeven TP Settings
bool      EnableBreakevenTP    = false;
double    BreakevenBuyTPPips   = 0;
double    BreakevenSellTPPips  = 0;
bool      ManageAllTrades      = false;

// BUY Breakeven Recovery
bool      EnableBuyBERecovery       = false;
double    BuyBERecoveryLotMin       = 0;
double    BuyBERecoveryLotMax       = 0;
double    BuyBERecoveryLotIncrease  = 0;
int       MaxBuyBERecoveryOrders    = 0;

// SELL Breakeven Recovery
bool      EnableSellBERecovery      = false;
double    SellBERecoveryLotMin      = 0;
double    SellBERecoveryLotMax      = 0;
double    SellBERecoveryLotIncrease = 0;
int       MaxSellBERecoveryOrders   = 0;

// EA Internal Settings
int       MagicNumber       = 999888;
string    OrderComment      = "SGS";

//--- Global Variables
double pip = 1.0;
datetime lastCheckTime = 0;
double normalizedLotSize = 0.0;
datetime g_LastLicenseCheck = 0;
datetime g_LastTradeDataUpdate = 0;
int LICENSE_CHECK_INTERVAL = 3600; // Check license every hour (3600 seconds)
int TRADE_DATA_UPDATE_INTERVAL = 5; // Send trade data every 5 seconds

// Virtual grid tracking (no pending orders)
double nextBuyPrice = 0;
double nextSellPrice = 0;
int currentBuyCount = 0;
int currentSellCount = 0;

// Track previous position count to detect closes
int prevBuyCount = 0;
int prevSellCount = 0;

// Breakeven Recovery tracking
double nextBuyBERecoveryPrice = 0;
double nextSellBERecoveryPrice = 0;

//+------------------------------------------------------------------+
//| License Verification Function                                     |
//+------------------------------------------------------------------+
bool VerifyLicense()
{
    if(StringLen(LicenseKey) == 0)
    {
        g_LicenseMessage = "License key is required. Please enter your license key.";
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
    
    // Convert string to char array
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    // Make HTTP request
    ResetLastError();
    int timeout = 5000; // 5 seconds
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
    
    if(response == -1)
    {
        int error = GetLastError();
        if(error == 4014)
        {
            g_LicenseMessage = "Please add '" + LicenseServer + "' to allowed URLs in Tools > Options > Expert Advisors";
        }
        else
        {
            g_LicenseMessage = "License server connection failed. Error: " + IntegerToString(error);
        }
        return false;
    }
    
    // Parse response
    string responseStr = CharArrayToString(result);
    
    // Simple JSON parsing
    if(StringFind(responseStr, "\"valid\": true") >= 0 || StringFind(responseStr, "\"valid\":true") >= 0)
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
        
        g_LicenseMessage = "License valid. Plan: " + g_PlanName + " | Days remaining: " + IntegerToString(g_DaysRemaining);
        g_LastVerification = TimeCurrent();
        return true;
    }
    else
    {
        g_LicenseValid = false;
        
        // Extract error message
        int msgPos = StringFind(responseStr, "\"message\"");
        if(msgPos >= 0)
        {
            int startQuote = StringFind(responseStr, "\"", msgPos + 10);
            int endQuote = StringFind(responseStr, "\"", startQuote + 1);
            g_LicenseMessage = StringSubstr(responseStr, startQuote + 1, endQuote - startQuote - 1);
        }
        else
        {
            g_LicenseMessage = "License verification failed";
        }
        return false;
    }
}

//+------------------------------------------------------------------+
//| Load EA Settings from Server                                       |
//+------------------------------------------------------------------+
bool LoadSettingsFromServer()
{
    // Get MT5 account number
    long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
    string mt5Account = IntegerToString(accountNumber);
    
    // Build JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"mt5_account\":\"" + mt5Account + "\"";
    jsonRequest += "}";
    
    // Prepare request
    string url = LicenseServer + "/api/settings/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    // Convert string to char array
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    // Make HTTP request
    ResetLastError();
    int timeout = 5000;
    int response = WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
    
    if(response == -1)
    {
        Print("Failed to load settings from server. Using defaults.");
        return false;
    }
    
    // Parse response
    string responseStr = CharArrayToString(result);
    
    // Check if successful
    if(StringFind(responseStr, "\"success\": true") < 0 && StringFind(responseStr, "\"success\":true") < 0)
    {
        Print("Settings load failed. Using defaults.");
        return false;
    }
    
    // Parse settings - BUY Grid
    BuyRangeStart = ExtractDoubleValue(responseStr, "buy_range_start");
    BuyRangeEnd = ExtractDoubleValue(responseStr, "buy_range_end");
    BuyGapPips = ExtractDoubleValue(responseStr, "buy_gap_pips");
    MaxBuyOrders = (int)ExtractDoubleValue(responseStr, "max_buy_orders");
    
    // BUY TP/SL/Trailing
    BuyTakeProfitPips = ExtractDoubleValue(responseStr, "buy_take_profit_pips");
    BuyStopLossPips = ExtractDoubleValue(responseStr, "buy_stop_loss_pips");
    BuyTrailingStartPips = ExtractDoubleValue(responseStr, "buy_trailing_start_pips");
    BuyInitialSLPips = ExtractDoubleValue(responseStr, "buy_initial_sl_pips");
    BuyTrailingRatio = ExtractDoubleValue(responseStr, "buy_trailing_ratio");
    BuyMaxSLDistance = ExtractDoubleValue(responseStr, "buy_max_sl_distance");
    BuyTrailingStepPips = ExtractDoubleValue(responseStr, "buy_trailing_step_pips");
    
    // SELL Grid
    SellRangeStart = ExtractDoubleValue(responseStr, "sell_range_start");
    SellRangeEnd = ExtractDoubleValue(responseStr, "sell_range_end");
    SellGapPips = ExtractDoubleValue(responseStr, "sell_gap_pips");
    MaxSellOrders = (int)ExtractDoubleValue(responseStr, "max_sell_orders");
    
    // SELL TP/SL/Trailing
    SellTakeProfitPips = ExtractDoubleValue(responseStr, "sell_take_profit_pips");
    SellStopLossPips = ExtractDoubleValue(responseStr, "sell_stop_loss_pips");
    SellTrailingStartPips = ExtractDoubleValue(responseStr, "sell_trailing_start_pips");
    SellInitialSLPips = ExtractDoubleValue(responseStr, "sell_initial_sl_pips");
    SellTrailingRatio = ExtractDoubleValue(responseStr, "sell_trailing_ratio");
    SellMaxSLDistance = ExtractDoubleValue(responseStr, "sell_max_sl_distance");
    SellTrailingStepPips = ExtractDoubleValue(responseStr, "sell_trailing_step_pips");
    
    // Lot & Risk
    LotSize = ExtractDoubleValue(responseStr, "lot_size");
    
    // Breakeven TP
    EnableBreakevenTP = ExtractBoolValue(responseStr, "enable_breakeven_tp");
    BreakevenBuyTPPips = ExtractDoubleValue(responseStr, "breakeven_buy_tp_pips");
    BreakevenSellTPPips = ExtractDoubleValue(responseStr, "breakeven_sell_tp_pips");
    ManageAllTrades = ExtractBoolValue(responseStr, "manage_all_trades");
    
    // BUY Recovery
    EnableBuyBERecovery = ExtractBoolValue(responseStr, "enable_buy_be_recovery");
    BuyBERecoveryLotMin = ExtractDoubleValue(responseStr, "buy_be_recovery_lot_min");
    BuyBERecoveryLotMax = ExtractDoubleValue(responseStr, "buy_be_recovery_lot_max");
    BuyBERecoveryLotIncrease = ExtractDoubleValue(responseStr, "buy_be_recovery_lot_increase");
    MaxBuyBERecoveryOrders = (int)ExtractDoubleValue(responseStr, "max_buy_be_recovery_orders");
    
    // SELL Recovery
    EnableSellBERecovery = ExtractBoolValue(responseStr, "enable_sell_be_recovery");
    SellBERecoveryLotMin = ExtractDoubleValue(responseStr, "sell_be_recovery_lot_min");
    SellBERecoveryLotMax = ExtractDoubleValue(responseStr, "sell_be_recovery_lot_max");
    SellBERecoveryLotIncrease = ExtractDoubleValue(responseStr, "sell_be_recovery_lot_increase");
    MaxSellBERecoveryOrders = (int)ExtractDoubleValue(responseStr, "max_sell_be_recovery_orders");
    
    g_SettingsLoaded = true;
    Print("Settings loaded from server successfully!");
    Print("BuyRange: ", BuyRangeStart, " - ", BuyRangeEnd, " | SellRange: ", SellRangeStart, " - ", SellRangeEnd);
    Print("LotSize: ", LotSize, " | MaxBuy: ", MaxBuyOrders, " | MaxSell: ", MaxSellOrders);
    
    SendActionLog("MODE", "Settings loaded | Lot: " + DoubleToString(LotSize, 2) + " | BUY: " + IntegerToString(MaxBuyOrders) + " | SELL: " + IntegerToString(MaxSellOrders));
    
    return true;
}

//+------------------------------------------------------------------+
//| Send Trade Data to Server                                          |
//+------------------------------------------------------------------+
void SendTradeDataToServer()
{
    // Collect account info
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double profit = AccountInfoDouble(ACCOUNT_PROFIT);
    double margin = AccountInfoDouble(ACCOUNT_MARGIN);
    double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
    
    // Collect position data
    int buyPositions = 0, sellPositions = 0;
    double buyLots = 0, sellLots = 0;
    double buyProfit = 0, sellProfit = 0;
    string positionsJson = "[";
    bool firstPosition = true;
    
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            string posSymbol = PositionGetString(POSITION_SYMBOL);
            if(posSymbol != _Symbol) continue;
            
            long posType = PositionGetInteger(POSITION_TYPE);
            double posLots = PositionGetDouble(POSITION_VOLUME);
            double posProfit = PositionGetDouble(POSITION_PROFIT);
            double posOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double posSL = PositionGetDouble(POSITION_SL);
            double posTP = PositionGetDouble(POSITION_TP);
            
            if(posType == POSITION_TYPE_BUY)
            {
                buyPositions++;
                buyLots += posLots;
                buyProfit += posProfit;
            }
            else
            {
                sellPositions++;
                sellLots += posLots;
                sellProfit += posProfit;
            }
            
            // Add to positions JSON
            if(!firstPosition) positionsJson += ",";
            firstPosition = false;
            
            positionsJson += "{";
            positionsJson += "\"ticket\":" + IntegerToString(ticket) + ",";
            positionsJson += "\"type\":\"" + (posType == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
            positionsJson += "\"lots\":" + DoubleToString(posLots, 2) + ",";
            positionsJson += "\"open_price\":" + DoubleToString(posOpenPrice, 5) + ",";
            positionsJson += "\"sl\":" + DoubleToString(posSL, 5) + ",";
            positionsJson += "\"tp\":" + DoubleToString(posTP, 5) + ",";
            positionsJson += "\"profit\":" + DoubleToString(posProfit, 2);
            positionsJson += "}";
        }
    }
    positionsJson += "]";
    
    // Build JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"account_balance\":" + DoubleToString(balance, 2) + ",";
    jsonRequest += "\"account_equity\":" + DoubleToString(equity, 2) + ",";
    jsonRequest += "\"account_profit\":" + DoubleToString(profit, 2) + ",";
    jsonRequest += "\"account_margin\":" + DoubleToString(margin, 2) + ",";
    jsonRequest += "\"account_free_margin\":" + DoubleToString(freeMargin, 2) + ",";
    jsonRequest += "\"total_buy_positions\":" + IntegerToString(buyPositions) + ",";
    jsonRequest += "\"total_sell_positions\":" + IntegerToString(sellPositions) + ",";
    jsonRequest += "\"total_buy_lots\":" + DoubleToString(buyLots, 2) + ",";
    jsonRequest += "\"total_sell_lots\":" + DoubleToString(sellLots, 2) + ",";
    jsonRequest += "\"total_buy_profit\":" + DoubleToString(buyProfit, 2) + ",";
    jsonRequest += "\"total_sell_profit\":" + DoubleToString(sellProfit, 2) + ",";
    jsonRequest += "\"symbol\":\"" + _Symbol + "\",";
    jsonRequest += "\"current_price\":" + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), 5) + ",";
    jsonRequest += "\"open_positions\":" + positionsJson;
    jsonRequest += "}";
    
    // Send to server
    string url = LicenseServer + "/api/trade-data/update/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    ResetLastError();
    int response = WebRequest("POST", url, headers, 2000, postData, result, resultHeaders);
    
    if(response == -1)
    {
        // Silent fail - don't spam logs
    }
}

//+------------------------------------------------------------------+
//| Send Action Log to Server                                          |
//+------------------------------------------------------------------+
void SendActionLog(string logType, string message, string details = "{}")
{
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"log_type\":\"" + logType + "\",";
    jsonRequest += "\"message\":\"" + message + "\",";
    jsonRequest += "\"details\":" + details;
    jsonRequest += "}";
    
    string url = LicenseServer + "/api/action-log/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    ResetLastError();
    WebRequest("POST", url, headers, 1000, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Extract double value from JSON                                     |
//+------------------------------------------------------------------+
double ExtractDoubleValue(string json, string key)
{
    string searchKey = "\"" + key + "\"";
    int keyPos = StringFind(json, searchKey);
    if(keyPos < 0) return 0;
    
    int colonPos = StringFind(json, ":", keyPos);
    if(colonPos < 0) return 0;
    
    int endPos = StringFind(json, ",", colonPos);
    if(endPos < 0) endPos = StringFind(json, "}", colonPos);
    
    string valueStr = StringSubstr(json, colonPos + 1, endPos - colonPos - 1);
    StringTrimLeft(valueStr);
    StringTrimRight(valueStr);
    
    return StringToDouble(valueStr);
}

//+------------------------------------------------------------------+
//| Extract bool value from JSON                                       |
//+------------------------------------------------------------------+
bool ExtractBoolValue(string json, string key)
{
    string searchKey = "\"" + key + "\"";
    int keyPos = StringFind(json, searchKey);
    if(keyPos < 0) return false;
    
    int colonPos = StringFind(json, ":", keyPos);
    if(colonPos < 0) return false;
    
    int endPos = StringFind(json, ",", colonPos);
    if(endPos < 0) endPos = StringFind(json, "}", colonPos);
    
    string valueStr = StringSubstr(json, colonPos + 1, endPos - colonPos - 1);
    StringTrimLeft(valueStr);
    StringTrimRight(valueStr);
    
    return (valueStr == "true" || valueStr == "True" || valueStr == "1");
}

//+------------------------------------------------------------------+
//| Create License Status Panel on Chart (Top Right Corner)           |
//+------------------------------------------------------------------+
void CreateLicenseLabel()
{
    // Delete old license objects
    ObjectDelete(0, "EA_LicenseTitle");
    ObjectDelete(0, "EA_LicenseStatus");
    ObjectDelete(0, "EA_LicensePlan");
    ObjectDelete(0, "EA_LicenseDays");
    ObjectDelete(0, "EA_LicenseAccount");
    ObjectDelete(0, "EA_LicenseKey");
    
    int xPos = 10;
    int yStart = 20;
    int lineHeight = 16;
    
    // Get MT5 account
    long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
    string mt5Account = IntegerToString(accountNumber);
    
    if(g_LicenseValid)
    {
        // Title Bar
        ObjectCreate(0, "EA_LicenseTitle", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_YDISTANCE, yStart);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_LicenseTitle", OBJPROP_FONT, "Arial Bold");
        ObjectSetString(0, "EA_LicenseTitle", OBJPROP_TEXT, "SUPER GRID SCALPER");
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_COLOR, clrGold);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
        
        // Status Line
        color daysColor = clrLime;
        if(g_DaysRemaining <= 7) daysColor = clrOrange;
        if(g_DaysRemaining <= 3) daysColor = clrRed;
        
        string statusLine = "ACTIVE | " + g_PlanName + " | " + IntegerToString(g_DaysRemaining) + "d";
        ObjectCreate(0, "EA_LicenseStatus", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_YDISTANCE, yStart + lineHeight);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_LicenseStatus", OBJPROP_FONT, "Arial");
        ObjectSetString(0, "EA_LicenseStatus", OBJPROP_TEXT, statusLine);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_COLOR, daysColor);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
        
        // Account
        ObjectCreate(0, "EA_LicenseAccount", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_YDISTANCE, yStart + lineHeight * 2);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_LicenseAccount", OBJPROP_FONT, "Arial");
        ObjectSetString(0, "EA_LicenseAccount", OBJPROP_TEXT, "MT5: " + mt5Account);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_COLOR, clrSilver);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
    }
    else
    {
        // Error Title
        ObjectCreate(0, "EA_LicenseTitle", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_YDISTANCE, yStart);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_FONTSIZE, 10);
        ObjectSetString(0, "EA_LicenseTitle", OBJPROP_FONT, "Arial Bold");
        ObjectSetString(0, "EA_LicenseTitle", OBJPROP_TEXT, "LICENSE ERROR");
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_COLOR, clrRed);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
        
        // Error Message
        ObjectCreate(0, "EA_LicenseStatus", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_YDISTANCE, yStart + lineHeight);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_LicenseStatus", OBJPROP_FONT, "Arial");
        ObjectSetString(0, "EA_LicenseStatus", OBJPROP_TEXT, g_LicenseMessage);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_COLOR, clrOrange);
        ObjectSetInteger(0, "EA_LicenseStatus", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
        
        // Trading Stopped
        ObjectCreate(0, "EA_LicenseAccount", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_CORNER, CORNER_RIGHT_UPPER);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_YDISTANCE, yStart + lineHeight * 2);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_LicenseAccount", OBJPROP_FONT, "Arial Bold");
        ObjectSetString(0, "EA_LicenseAccount", OBJPROP_TEXT, "TRADING STOPPED");
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_COLOR, clrRed);
        ObjectSetInteger(0, "EA_LicenseAccount", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
    }
    
    ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // === LICENSE VERIFICATION ===
    Print("=== Verifying License ===");
    
    if(!VerifyLicense())
    {
        Print("LICENSE ERROR: ", g_LicenseMessage);
        Alert("License Error: ", g_LicenseMessage);
        CreateLicenseLabel();
        return(INIT_FAILED);
    }
    
    Print("LICENSE VERIFIED: ", g_LicenseMessage);
    CreateLicenseLabel();
    
    // Send connection log
    SendActionLog("CONNECT", "EA connected to " + _Symbol + " | Account: " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)));
    
    // === LOAD SETTINGS FROM SERVER ===
    Print("=== Loading Settings from Server ===");
    if(!LoadSettingsFromServer())
    {
        Print("WARNING: Could not load settings from server. Using default values.");
    }
    
    // Initialize license check timer
    g_LastLicenseCheck = TimeCurrent();
    // === END LICENSE VERIFICATION ===
    
    trade.SetExpertMagicNumber(MagicNumber);
    
    // Auto-detect pip value based on symbol digits
    // For XAUUSD: price 4000.00 (2 digits) -> 1 pip = 1.0 (4000 to 4001 = 1 pip)
    // For XAUUSD: price 4000.00 (2 digits) -> 1 pip = 0.1 if broker uses 2 decimal places for cents
    // For Forex: EURUSD 1.12345 (5 digits) -> 1 pip = 0.0001
    // For JPY pairs: USDJPY 150.123 (3 digits) -> 1 pip = 0.01
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    string symbolName = _Symbol;
    
    // Check if it's a gold/metal symbol
    if(StringFind(symbolName, "XAU") >= 0 || StringFind(symbolName, "GOLD") >= 0)
    {
        // For Gold: 1 pip = 1.0 (4000 to 4001 = 1 pip)
        pip = 1.0;
    }
    else if(StringFind(symbolName, "XAG") >= 0 || StringFind(symbolName, "SILVER") >= 0)
    {
        // For Silver: 1 pip = 0.01
        pip = 0.01;
    }
    else if(digits == 2)
    {
        // 2 decimal places (like some indices or metals): 1 pip = 1.0
        pip = 1.0;
    }
    else if(digits == 3)
    {
        // 3 decimal places (JPY pairs): 1 pip = 0.01
        pip = 0.01;
    }
    else if(digits == 4)
    {
        // 4 decimal places: 1 pip = 0.0001
        pip = 0.0001;
    }
    else if(digits == 5)
    {
        // 5 decimal places (most forex): 1 pip = 0.0001 (last digit is pipette)
        pip = 0.0001;
    }
    else
    {
        // Default fallback based on digits
        pip = MathPow(10, -(digits - 1));
    }
    
    Print("Symbol: ", symbolName, " | Digits: ", digits, " | Pip Value: ", DoubleToString(pip, digits));
    
    // Validate input parameters first
    if(BuyGapPips <= 0 || SellGapPips <= 0)
    {
        Print("ERROR: Gap must be greater than 0! BuyGap=", BuyGapPips, " SellGap=", SellGapPips);
        return(INIT_PARAMETERS_INCORRECT);
    }
    
    if(MaxBuyOrders <= 0 || MaxSellOrders <= 0)
    {
        Print("ERROR: Max orders must be greater than 0!");
        return(INIT_PARAMETERS_INCORRECT);
    }
    
    if(BuyTrailingStartPips <= 0 || BuyInitialSLPips < 0 || BuyMaxSLDistance <= 0)
    {
        Print("ERROR: BUY Trailing parameters must be positive!");
        return(INIT_PARAMETERS_INCORRECT);
    }
    
    if(SellTrailingStartPips <= 0 || SellInitialSLPips < 0 || SellMaxSLDistance <= 0)
    {
        Print("ERROR: SELL Trailing parameters must be positive!");
        return(INIT_PARAMETERS_INCORRECT);
    }
    
    if(BuyTrailingRatio <= 0 || BuyTrailingRatio > 1.0 || SellTrailingRatio <= 0 || SellTrailingRatio > 1.0)
    {
        Print("ERROR: TrailingRatio must be between 0 and 1!");
        return(INIT_PARAMETERS_INCORRECT);
    }
    
    // Normalize and validate lot size
    double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    
    if(lotStep <= 0)
    {
        Print("ERROR: Invalid lot step from broker: ", lotStep);
        return(INIT_FAILED);
    }
    
    // Normalize lot size to broker's lot step
    normalizedLotSize = MathFloor(LotSize / lotStep) * lotStep;
    
    // Validate lot size
    if(normalizedLotSize < minLot)
    {
        normalizedLotSize = minLot;
        Print("WARNING: Lot size adjusted from ", LotSize, " to minimum allowed: ", normalizedLotSize);
    }
    else if(normalizedLotSize > maxLot)
    {
        normalizedLotSize = maxLot;
        Print("WARNING: Lot size adjusted from ", LotSize, " to maximum allowed: ", normalizedLotSize);
    }
    else if(normalizedLotSize != LotSize)
    {
        Print("INFO: Lot size normalized from ", LotSize, " to ", normalizedLotSize, " (Lot Step: ", lotStep, ")");
    }
    
    // Create on-chart developer credit
    CreateDeveloperLabel();
    
    Print("=== Hedge Grid Trailing EA Started ===");
    Print("Symbol: ", _Symbol, " | Digits: ", digits, " | Pip Value: ", pip);
    Print("Lot Size: ", normalizedLotSize, " | Min: ", minLot, " | Max: ", maxLot, " | Step: ", lotStep);
    Print("BUY Range: ", BuyRangeStart, " to ", BuyRangeEnd, " | Gap: ", BuyGapPips, " pips | Max: ", MaxBuyOrders);
    Print("BUY TP: ", BuyTakeProfitPips, " | SL: ", BuyStopLossPips, " | Trail Start: ", BuyTrailingStartPips);
    Print("SELL Range: ", SellRangeStart, " to ", SellRangeEnd, " | Gap: ", SellGapPips, " pips | Max: ", MaxSellOrders);
    Print("SELL TP: ", SellTakeProfitPips, " | SL: ", SellStopLossPips, " | Trail Start: ", SellTrailingStartPips);
    Print("Breakeven TP: ", EnableBreakevenTP ? "ENABLED" : "DISABLED", " | Manage All: ", ManageAllTrades ? "YES" : "NO");
    Print("Mode: PENDING ORDERS (Buy Limit / Sell Limit - No slippage)");
    
    // Scan for existing positions
    ScanExistingTrades();
    
    // Initialize virtual grid levels
    InitializeVirtualGrid();
    
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    // Log disconnection
    string reasonStr = "";
    switch(reason)
    {
        case REASON_PROGRAM: reasonStr = "EA removed"; break;
        case REASON_REMOVE: reasonStr = "EA removed from chart"; break;
        case REASON_RECOMPILE: reasonStr = "EA recompiled"; break;
        case REASON_CHARTCHANGE: reasonStr = "Symbol/timeframe changed"; break;
        case REASON_CHARTCLOSE: reasonStr = "Chart closed"; break;
        case REASON_PARAMETERS: reasonStr = "Parameters changed"; break;
        case REASON_ACCOUNT: reasonStr = "Account changed"; break;
        case REASON_TEMPLATE: reasonStr = "Template applied"; break;
        case REASON_INITFAILED: reasonStr = "Init failed"; break;
        case REASON_CLOSE: reasonStr = "Terminal closed"; break;
        default: reasonStr = "Unknown reason"; break;
    }
    SendActionLog("DISCONNECT", "EA disconnected: " + reasonStr);
    
    // Delete all pending orders placed by this EA
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
    
    // Remove all chart objects
    ObjectDelete(0, "EA_DevCredit");
    ObjectDelete(0, "EA_DevContact");
    ObjectDelete(0, "EA_BuyHeader");
    ObjectDelete(0, "EA_BuyCount");
    ObjectDelete(0, "EA_BuyAvg");
    ObjectDelete(0, "EA_BuyBE");
    ObjectDelete(0, "EA_BuyNext");
    ObjectDelete(0, "EA_BuyProfit");
    ObjectDelete(0, "EA_BuyRecovery");
    ObjectDelete(0, "EA_SellHeader");
    ObjectDelete(0, "EA_SellCount");
    ObjectDelete(0, "EA_SellAvg");
    ObjectDelete(0, "EA_SellBE");
    ObjectDelete(0, "EA_SellNext");
    ObjectDelete(0, "EA_SellProfit");
    ObjectDelete(0, "EA_SellRecovery");
    ObjectDelete(0, "EA_PriceHeader");
    ObjectDelete(0, "EA_PriceInfo");
    ObjectDelete(0, "EA_TotalProfit");
    
    Print("=== Hedge Grid Trailing EA Stopped (Pending orders deleted) ===");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // === PERIODIC LICENSE CHECK ===
    if(TimeCurrent() - g_LastLicenseCheck > LICENSE_CHECK_INTERVAL)
    {
        g_LastLicenseCheck = TimeCurrent();
        Print("=== Periodic License Check ===");
        
        if(!VerifyLicense())
        {
            g_LicenseValid = false;
            Print("LICENSE EXPIRED OR INVALID: ", g_LicenseMessage);
            CreateLicenseLabel();
            Comment("LICENSE EXPIRED - EA STOPPED\n", g_LicenseMessage);
            return; // Stop processing
        }
        
        // Also reload settings in case admin changed them
        LoadSettingsFromServer();
        CreateLicenseLabel();
    }
    
    // === CHECK LICENSE BEFORE TRADING ===
    if(!g_LicenseValid)
    {
        Comment("LICENSE INVALID - EA STOPPED\n", g_LicenseMessage);
        return; // Don't trade if license invalid
    }
    
    // === SEND TRADE DATA TO SERVER ===
    if(TimeCurrent() - g_LastTradeDataUpdate > TRADE_DATA_UPDATE_INTERVAL)
    {
        g_LastTradeDataUpdate = TimeCurrent();
        SendTradeDataToServer();
    }
    
    // Count current positions
    CountOpenPositions();
    
    // Detect if a position was closed - reposition pending orders
    if(currentBuyCount < prevBuyCount || currentSellCount < prevSellCount)
    {
        // A position was closed - reposition pending orders to current price grid
        if(currentBuyCount < prevBuyCount && currentBuyCount < MaxBuyOrders)
        {
            Print("[POSITION CLOSED] BUY positions: ", prevBuyCount, " -> ", currentBuyCount, " | Repositioning grid...");
            RepositionPendingOrders(ORDER_TYPE_BUY_LIMIT);
        }
        if(currentSellCount < prevSellCount && currentSellCount < MaxSellOrders)
        {
            Print("[POSITION CLOSED] SELL positions: ", prevSellCount, " -> ", currentSellCount, " | Repositioning grid...");
            RepositionPendingOrders(ORDER_TYPE_SELL_LIMIT);
        }
    }
    
    // Update previous counts for next tick
    prevBuyCount = currentBuyCount;
    prevSellCount = currentSellCount;
    
    // Manage pending orders grid (Buy Limit / Sell Limit)
    ManagePendingGrid();
    
    // Check breakeven recovery orders (after max trades hit)
    if(EnableBuyBERecovery || EnableSellBERecovery)
    {
        CheckBERecoveryOrders();
    }
    
    // Apply trailing stop to positions (regular orders)
    ApplyTrailingStop();
    
    // Apply breakeven TP if enabled
    if(EnableBreakevenTP)
    {
        ApplyBreakevenTP();
    }
    
    // Update on-screen display
    UpdateInfoPanel();
}

//+------------------------------------------------------------------+
//| Initialize Pending Orders Grid                                    |
//+------------------------------------------------------------------+
void InitializeVirtualGrid()
{
    Print("Initializing PENDING ORDERS grid...");
    
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    double buyGapPrice = BuyGapPips * pip;
    double sellGapPrice = SellGapPips * pip;
    double buyStart = MathMax(BuyRangeStart, BuyRangeEnd);
    double buyEnd = MathMin(BuyRangeStart, BuyRangeEnd);
    double sellStart = MathMin(SellRangeStart, SellRangeEnd);
    double sellEnd = MathMax(SellRangeStart, SellRangeEnd);
    
    Print("Current Price - Bid: ", DoubleToString(bidPrice, digits), " | Ask: ", DoubleToString(askPrice, digits));
    Print("BUY Grid: Start=", buyStart, " End=", buyEnd, " Gap=", buyGapPrice, " | Pip=", pip);
    Print("SELL Grid: Start=", sellStart, " End=", sellEnd, " Gap=", sellGapPrice, " | Pip=", pip);
    Print("Using PENDING ORDERS (Buy Limit / Sell Limit) - No slippage!");
    
    // Initial levels will be set by ManagePendingGrid on first tick
    nextBuyPrice = 0;
    nextSellPrice = 0;
}

//+------------------------------------------------------------------+
//| Count Open Positions                                              |
//+------------------------------------------------------------------+
void CountOpenPositions()
{
    currentBuyCount = 0;
    currentSellCount = 0;
    
    int total = PositionsTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            
            // Check magic number only if not managing all trades
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(posType == POSITION_TYPE_BUY)
                currentBuyCount++;
            else if(posType == POSITION_TYPE_SELL)
                currentSellCount++;
        }
    }
}

//+------------------------------------------------------------------+
//| Manage Pending Orders Grid                                        |
//+------------------------------------------------------------------+
void ManagePendingGrid()
{
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    double buyGapPrice = BuyGapPips * pip;
    double sellGapPrice = SellGapPips * pip;
    double buyStart = MathMax(BuyRangeStart, BuyRangeEnd);
    double buyEnd = MathMin(BuyRangeStart, BuyRangeEnd);
    double sellStart = MathMin(SellRangeStart, SellRangeEnd);
    double sellEnd = MathMax(SellRangeStart, SellRangeEnd);
    
    // Count existing pending orders
    int buyLimitCount = 0;
    int sellLimitCount = 0;
    CountPendingOrders(buyLimitCount, sellLimitCount);
    
    // Total orders = positions + pending
    int totalBuyOrders = currentBuyCount + buyLimitCount;
    int totalSellOrders = currentSellCount + sellLimitCount;
    
    // ===== BUY LIMIT ORDERS =====
    // Only place if we have room and price is in range
    if(currentBuyCount < MaxBuyOrders && bidPrice <= buyStart && bidPrice >= buyEnd)
    {
        int ordersNeeded = MaxBuyOrders - totalBuyOrders;
        
        if(ordersNeeded > 0)
        {
            // Find the LOWEST existing buy position/order to base new orders from
            double lowestBuyLevel = bidPrice;
            
            // Check existing positions
            int posTotal = PositionsTotal();
            for(int i = 0; i < posTotal; i++)
            {
                ulong ticket = PositionGetTicket(i);
                if(ticket <= 0) continue;
                if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
                if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
                if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                {
                    double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                    if(posPrice < lowestBuyLevel) lowestBuyLevel = posPrice;
                }
            }
            
            // Check existing pending orders
            int ordTotal = OrdersTotal();
            for(int i = 0; i < ordTotal; i++)
            {
                ulong ticket = OrderGetTicket(i);
                if(ticket <= 0) continue;
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_LIMIT)
                {
                    double ordPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                    if(ordPrice < lowestBuyLevel) lowestBuyLevel = ordPrice;
                }
            }
            
            // Place new orders below the lowest existing level
            int placed = 0;
            for(int level = 1; level <= ordersNeeded + 5 && placed < ordersNeeded; level++)
            {
                double buyLimitPrice = NormalizeDouble(lowestBuyLevel - (level * buyGapPrice), digits);
                
                // Check if within range
                if(buyLimitPrice < buyEnd) break;
                
                // Check if order/position already exists at this price
                if(!OrderExistsAtPrice(buyLimitPrice, ORDER_TYPE_BUY_LIMIT) && 
                   !PositionExistsAtPrice(buyLimitPrice, POSITION_TYPE_BUY))
                {
                    double sl = (BuyStopLossPips > 0) ? NormalizeDouble(buyLimitPrice - (BuyStopLossPips * pip), digits) : 0;
                    double tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(buyLimitPrice + (BuyTakeProfitPips * pip), digits) : 0;
                    
                    if(trade.BuyLimit(normalizedLotSize, buyLimitPrice, _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
                    {
                        Print("[BUY LIMIT] @ ", DoubleToString(buyLimitPrice, digits), 
                              " | Gap from ", DoubleToString(lowestBuyLevel, digits));
                        SendActionLog("GRID", "BUY LIMIT placed @ " + DoubleToString(buyLimitPrice, digits) + " | Lot: " + DoubleToString(normalizedLotSize, 2));
                        nextBuyPrice = buyLimitPrice;
                        placed++;
                    }
                }
            }
        }
    }
    else if(currentBuyCount >= MaxBuyOrders)
    {
        // Max positions reached - delete any remaining buy limit orders
        DeletePendingOrders(ORDER_TYPE_BUY_LIMIT);
        nextBuyPrice = 0;
    }
    
    // ===== SELL LIMIT ORDERS =====
    // Only place if we have room and price is in range
    if(currentSellCount < MaxSellOrders && askPrice >= sellStart && askPrice <= sellEnd)
    {
        int ordersNeeded = MaxSellOrders - totalSellOrders;
        
        if(ordersNeeded > 0)
        {
            // Find the HIGHEST existing sell position/order to base new orders from
            double highestSellLevel = askPrice;
            
            // Check existing positions
            int posTotal = PositionsTotal();
            for(int i = 0; i < posTotal; i++)
            {
                ulong ticket = PositionGetTicket(i);
                if(ticket <= 0) continue;
                if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
                if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
                if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
                {
                    double posPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                    if(posPrice > highestSellLevel) highestSellLevel = posPrice;
                }
            }
            
            // Check existing pending orders
            int ordTotal = OrdersTotal();
            for(int i = 0; i < ordTotal; i++)
            {
                ulong ticket = OrderGetTicket(i);
                if(ticket <= 0) continue;
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT)
                {
                    double ordPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                    if(ordPrice > highestSellLevel) highestSellLevel = ordPrice;
                }
            }
            
            // Place new orders above the highest existing level
            int placed = 0;
            for(int level = 1; level <= ordersNeeded + 5 && placed < ordersNeeded; level++)
            {
                double sellLimitPrice = NormalizeDouble(highestSellLevel + (level * sellGapPrice), digits);
                
                // Check if within range
                if(sellLimitPrice > sellEnd) break;
                
                // Check if order/position already exists at this price
                if(!OrderExistsAtPrice(sellLimitPrice, ORDER_TYPE_SELL_LIMIT) &&
                   !PositionExistsAtPrice(sellLimitPrice, POSITION_TYPE_SELL))
                {
                    double sl = (SellStopLossPips > 0) ? NormalizeDouble(sellLimitPrice + (SellStopLossPips * pip), digits) : 0;
                    double tp = (SellTakeProfitPips > 0) ? NormalizeDouble(sellLimitPrice - (SellTakeProfitPips * pip), digits) : 0;
                    
                    if(trade.SellLimit(normalizedLotSize, sellLimitPrice, _Symbol, sl, tp, ORDER_TIME_GTC, 0, OrderComment))
                    {
                        Print("[SELL LIMIT] @ ", DoubleToString(sellLimitPrice, digits), 
                              " | Gap from ", DoubleToString(highestSellLevel, digits));
                        SendActionLog("GRID", "SELL LIMIT placed @ " + DoubleToString(sellLimitPrice, digits) + " | Lot: " + DoubleToString(normalizedLotSize, 2));
                        nextSellPrice = sellLimitPrice;
                        placed++;
                    }
                }
            }
        }
    }
    else if(currentSellCount >= MaxSellOrders)
    {
        // Max positions reached - delete any remaining sell limit orders
        DeletePendingOrders(ORDER_TYPE_SELL_LIMIT);
        nextSellPrice = 0;
    }
    
    // Modify existing orders to be at correct grid levels (instead of delete/recreate)
    ModifyPendingOrdersToGrid(bidPrice, askPrice, buyGapPrice, sellGapPrice, digits);
}

//+------------------------------------------------------------------+
//| Count Pending Orders (GRID orders only, not recovery)             |
//+------------------------------------------------------------------+
void CountPendingOrders(int &buyLimitCount, int &sellLimitCount)
{
    buyLimitCount = 0;
    sellLimitCount = 0;
    
    int total = OrdersTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            // Only count GRID orders, not recovery orders
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0) continue; // Skip recovery orders
            
            ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(orderType == ORDER_TYPE_BUY_LIMIT)
                buyLimitCount++;
            else if(orderType == ORDER_TYPE_SELL_LIMIT)
                sellLimitCount++;
        }
    }
}

//+------------------------------------------------------------------+
//| Delete Pending Orders by Type (GRID orders only)                  |
//+------------------------------------------------------------------+
void DeletePendingOrders(ENUM_ORDER_TYPE orderType)
{
    int total = OrdersTotal();
    for(int i = total - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            // Only delete GRID orders, not recovery orders
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0) continue; // Skip recovery orders
            
            if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == orderType)
            {
                trade.OrderDelete(ticket);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Reposition Pending Orders to Current Price Grid                   |
//+------------------------------------------------------------------+
void RepositionPendingOrders(ENUM_ORDER_TYPE orderType)
{
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Delete ALL existing grid pending orders of this type
    // ManagePendingGrid will place new orders at correct levels relative to current price
    int total = OrdersTotal();
    int deleted = 0;
    
    for(int i = total - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0) continue; // Skip recovery orders
            
            if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == orderType)
            {
                double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                Print("[REPOSITION] Deleting ", 
                      (orderType == ORDER_TYPE_BUY_LIMIT ? "BUY" : "SELL"),
                      " LIMIT @ ", DoubleToString(orderPrice, digits));
                trade.OrderDelete(ticket);
                deleted++;
            }
        }
    }
    
    if(deleted > 0)
    {
        Print("[REPOSITION] Deleted ", deleted, " orders. New orders will be placed at current price levels.");
    }
}

//+------------------------------------------------------------------+
//| Modify ONLY the Furthest Pending Order to Closest Grid Level      |
//+------------------------------------------------------------------+
void ModifyPendingOrdersToGrid(double bidPrice, double askPrice, double buyGap, double sellGap, int digits)
{
    int total = OrdersTotal();
    if(total == 0) return;
    
    // ===== BUY LIMIT ORDERS =====
    // Only modify in NORMAL mode (not recovery mode)
    if(currentBuyCount < MaxBuyOrders)
    {
        ulong furthestBuyTicket = 0;
        double furthestBuyPrice = 0;
        double maxBuyDistance = 0;
        
        // Find the furthest buy limit from current price
        for(int i = 0; i < total; i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket > 0)
            {
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                
                string comment = OrderGetString(ORDER_COMMENT);
                if(StringFind(comment, "BE_Recovery") >= 0) continue;
                
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY_LIMIT)
                {
                    double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                    double distance = bidPrice - orderPrice; // Distance below bid
                    
                    if(distance > maxBuyDistance && distance > 0)
                    {
                        maxBuyDistance = distance;
                        furthestBuyTicket = ticket;
                        furthestBuyPrice = orderPrice;
                    }
                }
            }
        }
        
        // Move furthest order to closest available grid level (if more than 1 gap away)
        if(furthestBuyTicket > 0 && maxBuyDistance > buyGap * 1.0)
        {
            // Try to find an available level starting from closest
            bool foundLevel = false;
            for(int level = 1; level <= 5; level++)
            {
                double targetLevel = NormalizeDouble(bidPrice - (level * buyGap), digits);
                
                // Skip if too close to current price or below range
                if(targetLevel <= 0) continue;
                if(targetLevel < MathMin(BuyRangeStart, BuyRangeEnd)) continue;
                
                bool orderExists = OrderExistsAtPrice(targetLevel, ORDER_TYPE_BUY_LIMIT);
                bool posExists = PositionExistsAtPrice(targetLevel, POSITION_TYPE_BUY);
                
                // Check if this level is available
                if(!orderExists && !posExists)
                {
                    double sl = (BuyStopLossPips > 0) ? NormalizeDouble(targetLevel - (BuyStopLossPips * pip), digits) : 0;
                    double tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(targetLevel + (BuyTakeProfitPips * pip), digits) : 0;
                    
                    if(trade.OrderModify(furthestBuyTicket, targetLevel, sl, tp, ORDER_TIME_GTC, 0))
                    {
                        Print("[MODIFY BUY] #", furthestBuyTicket, " | ", 
                              DoubleToString(furthestBuyPrice, digits), " -> ", 
                              DoubleToString(targetLevel, digits), 
                              " | Bid: ", DoubleToString(bidPrice, digits));
                        foundLevel = true;
                    }
                    else
                    {
                        Print("[MODIFY BUY FAILED] #", furthestBuyTicket, " Error: ", GetLastError());
                    }
                    break; // Done, move only one order
                }
            }
        }
    }
    
    // ===== SELL LIMIT ORDERS =====
    // Only modify in NORMAL mode (not recovery mode)
    if(currentSellCount < MaxSellOrders)
    {
        ulong furthestSellTicket = 0;
        double furthestSellPrice = 0;
        double maxSellDistance = 0;
        
        // Find the furthest sell limit from current price
        for(int i = 0; i < total; i++)
        {
            ulong ticket = OrderGetTicket(i);
            if(ticket > 0)
            {
                if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
                if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
                
                string comment = OrderGetString(ORDER_COMMENT);
                if(StringFind(comment, "BE_Recovery") >= 0) continue;
                
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL_LIMIT)
                {
                    double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                    double distance = orderPrice - askPrice; // Distance above ask
                    
                    if(distance > maxSellDistance && distance > 0)
                    {
                        maxSellDistance = distance;
                        furthestSellTicket = ticket;
                        furthestSellPrice = orderPrice;
                    }
                }
            }
        }
        
        // Move furthest order to closest available grid level (if more than 1 gap away)
        if(furthestSellTicket > 0 && maxSellDistance > sellGap * 1.0)
        {
            // Try to find an available level starting from closest
            for(int level = 1; level <= 5; level++)
            {
                double targetLevel = NormalizeDouble(askPrice + (level * sellGap), digits);
                
                // Skip if above range
                if(targetLevel > MathMax(SellRangeStart, SellRangeEnd)) continue;
                
                bool orderExists = OrderExistsAtPrice(targetLevel, ORDER_TYPE_SELL_LIMIT);
                bool posExists = PositionExistsAtPrice(targetLevel, POSITION_TYPE_SELL);
                
                // Check if this level is available
                if(!orderExists && !posExists)
                {
                    double sl = (SellStopLossPips > 0) ? NormalizeDouble(targetLevel + (SellStopLossPips * pip), digits) : 0;
                    double tp = (SellTakeProfitPips > 0) ? NormalizeDouble(targetLevel - (SellTakeProfitPips * pip), digits) : 0;
                    
                    if(trade.OrderModify(furthestSellTicket, targetLevel, sl, tp, ORDER_TIME_GTC, 0))
                    {
                        Print("[MODIFY SELL] #", furthestSellTicket, " | ", 
                              DoubleToString(furthestSellPrice, digits), " -> ", 
                              DoubleToString(targetLevel, digits),
                              " | Ask: ", DoubleToString(askPrice, digits));
                    }
                    else
                    {
                        Print("[MODIFY SELL FAILED] #", furthestSellTicket, " Error: ", GetLastError());
                    }
                    break; // Done, move only one order
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Set All Positions TP to Breakeven (and remove SL in recovery)     |
//+------------------------------------------------------------------+
void SetAllPositionsTP(ENUM_POSITION_TYPE posType, double newTP)
{
    int total = PositionsTotal();
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    double tolerance = MathPow(10, -digits);  // Proper tolerance for price comparison
    
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == posType)
        {
            double currentTP = PositionGetDouble(POSITION_TP);
            double currentSL = PositionGetDouble(POSITION_SL);
            
            // In recovery mode: TP must be breakeven, SL must be 0
            bool needsTPChange = MathAbs(currentTP - newTP) > tolerance;
            bool needsSLRemoval = (currentSL > 0.0001);  // Any SL > 0 needs removal
            
            // Only modify if something actually needs to change
            if(needsTPChange || needsSLRemoval)
            {
                if(trade.PositionModify(ticket, 0, newTP))  // SL = 0 in recovery mode
                {
                    if(needsSLRemoval)
                        Print("[RECOVERY] Removed SL from position #", ticket, " | New TP: ", DoubleToString(newTP, digits));
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Update Recovery Pending Orders TP to match Breakeven              |
//+------------------------------------------------------------------+
void UpdateRecoveryOrdersTP(ENUM_ORDER_TYPE orderType, double newTP)
{
    int total = OrdersTotal();
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    double tolerance = MathPow(10, -digits);  // Proper tolerance for price comparison
    
    for(int i = 0; i < total; i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        
        string comment = OrderGetString(ORDER_COMMENT);
        if(StringFind(comment, "BE_Recovery") >= 0)
        {
            if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == orderType)
            {
                double orderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
                double currentTP = OrderGetDouble(ORDER_TP);
                double currentSL = OrderGetDouble(ORDER_SL);
                
                // Check if modification is needed
                bool needsTPChange = MathAbs(currentTP - newTP) > tolerance;
                bool needsSLRemoval = (currentSL > 0.0001);  // Any SL > 0 needs removal
                
                // Only modify if something actually needs to change
                if(needsTPChange || needsSLRemoval)
                {
                    trade.OrderModify(ticket, orderPrice, 0, newTP, ORDER_TIME_GTC, 0);  // SL = 0
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Count Recovery Pending Orders                                      |
//+------------------------------------------------------------------+
int CountRecoveryPendingOrders(ENUM_ORDER_TYPE orderType)
{
    int count = 0;
    int total = OrdersTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0)
            {
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == orderType)
                    count++;
            }
        }
    }
    return count;
}

//+------------------------------------------------------------------+
//| Count Recovery Positions (filled recovery orders)                  |
//+------------------------------------------------------------------+
int CountRecoveryPositions(ENUM_POSITION_TYPE posType)
{
    int count = 0;
    int total = PositionsTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0)
            {
                if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == posType)
                    count++;
            }
        }
    }
    return count;
}

//+------------------------------------------------------------------+
//| Delete Recovery Pending Orders                                     |
//+------------------------------------------------------------------+
void DeleteRecoveryPendingOrders(ENUM_ORDER_TYPE orderType)
{
    int total = OrdersTotal();
    for(int i = total - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            string comment = OrderGetString(ORDER_COMMENT);
            if(StringFind(comment, "BE_Recovery") >= 0)
            {
                if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) == orderType)
                {
                    trade.OrderDelete(ticket);
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Check and Execute Breakeven Recovery Orders                       |
//+------------------------------------------------------------------+
void CheckBERecoveryOrders()
{
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Calculate average prices
    double buyAvgPrice = 0, sellAvgPrice = 0;
    double buyTotalLots = 0, sellTotalLots = 0;
    double buyWeightedPrice = 0, sellWeightedPrice = 0;
    
    int total = PositionsTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        if(posType == POSITION_TYPE_BUY)
        {
            buyWeightedPrice += openPrice * lots;
            buyTotalLots += lots;
        }
        else
        {
            sellWeightedPrice += openPrice * lots;
            sellTotalLots += lots;
        }
    }
    
    if(buyTotalLots > 0) buyAvgPrice = buyWeightedPrice / buyTotalLots;
    if(sellTotalLots > 0) sellAvgPrice = sellWeightedPrice / sellTotalLots;
    
    // ===== BUY BREAKEVEN RECOVERY =====
    // Only activate when enabled, max buy orders reached and we have positions
    if(EnableBuyBERecovery && currentBuyCount >= MaxBuyOrders && buyAvgPrice > 0)
    {
        // Calculate breakeven TP for all BUY positions
        double buyBE_TP = NormalizeDouble(buyAvgPrice + (BreakevenBuyTPPips * pip), digits);
        
        // Set ALL existing BUY positions to breakeven TP
        SetAllPositionsTP(POSITION_TYPE_BUY, buyBE_TP);
        
        // Also update any pending recovery orders to have the same breakeven TP
        UpdateRecoveryOrdersTP(ORDER_TYPE_BUY_LIMIT, buyBE_TP);
        
        // Find the LOWEST buy position price and its lot size (for BUY recovery, we go lower)
        // This ensures recovery orders are always placed below all existing positions
        double lowestBuyPrice = 999999999;
        double lastBuyLot = BuyBERecoveryLotMin;
        for(int i = 0; i < total; i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(posType == POSITION_TYPE_BUY)
            {
                double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                if(openPrice < lowestBuyPrice)
                {
                    lowestBuyPrice = openPrice;
                    lastBuyLot = PositionGetDouble(POSITION_VOLUME);
                }
            }
        }
        
        // Count existing recovery orders (both pending and filled)
        int buyRecoveryPendingCount = CountRecoveryPendingOrders(ORDER_TYPE_BUY_LIMIT);
        int buyRecoveryFilledCount = CountRecoveryPositions(POSITION_TYPE_BUY);
        int totalBuyRecoveryCount = buyRecoveryPendingCount + buyRecoveryFilledCount;
        
        // Calculate recovery price based on LOWEST position - same grid gap as normal orders
        // Recovery order is placed at: lowestPrice - BuyGapPips (always below all positions)
        double buyGapPrice = BuyGapPips * pip;
        double correctRecoveryPrice = NormalizeDouble(lowestBuyPrice - buyGapPrice, digits);
        
        // Always use the correct calculated price
        nextBuyBERecoveryPrice = correctRecoveryPrice;
        
        
        // Place recovery pending orders if needed
        if(totalBuyRecoveryCount < MaxBuyBERecoveryOrders)
        {
            if(buyRecoveryPendingCount == 0) // Only place if no pending recovery order exists
            {
                // Calculate lot size: last position lot + increase percentage
                double recoveryLot = lastBuyLot * (1.0 + BuyBERecoveryLotIncrease / 100.0);
                
                double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
                recoveryLot = MathRound(recoveryLot / lotStep) * lotStep;
                recoveryLot = MathMax(BuyBERecoveryLotMin, MathMin(BuyBERecoveryLotMax, recoveryLot));
                
                // Only place if price is below current bid and no position exists at that price
                if(nextBuyBERecoveryPrice < bidPrice && nextBuyBERecoveryPrice > 0)
                {
                    if(!OrderExistsAtPrice(nextBuyBERecoveryPrice, ORDER_TYPE_BUY_LIMIT) &&
                       !PositionExistsAtPrice(nextBuyBERecoveryPrice, POSITION_TYPE_BUY))
                    {
                        // Recovery orders have NO SL, only breakeven TP
                        if(trade.BuyLimit(recoveryLot, nextBuyBERecoveryPrice, _Symbol, 0, buyBE_TP, ORDER_TIME_GTC, 0, "BE_Recovery_BUY"))
                        {
                            Print("[BUY RECOVERY] @ ", DoubleToString(nextBuyBERecoveryPrice, digits),
                                  " | Lot: ", DoubleToString(recoveryLot, 2), " (from ", DoubleToString(lastBuyLot, 2), " +", BuyBERecoveryLotIncrease, "%)");
                            SendActionLog("RECOVERY", "BUY Recovery @ " + DoubleToString(nextBuyBERecoveryPrice, digits) + " | Lot: " + DoubleToString(recoveryLot, 2));
                        }
                    }
                }
            }
        }
        else
        {
            // Max recovery orders reached - delete any pending recovery orders
            DeleteRecoveryPendingOrders(ORDER_TYPE_BUY_LIMIT);
        }
    }
    else
    {
        // Not in recovery mode - clean up
        nextBuyBERecoveryPrice = 0;
        DeleteRecoveryPendingOrders(ORDER_TYPE_BUY_LIMIT);
    }
    
    // Additional cleanup: Always delete recovery pending orders if no BUY positions exist
    if(currentBuyCount == 0)
    {
        DeleteRecoveryPendingOrders(ORDER_TYPE_BUY_LIMIT);
    }
    
    // ===== SELL BREAKEVEN RECOVERY =====
    // Only activate when enabled, max sell orders reached and we have positions
    if(EnableSellBERecovery && currentSellCount >= MaxSellOrders && sellAvgPrice > 0)
    {
        // Calculate breakeven TP for all SELL positions
        double sellBE_TP = NormalizeDouble(sellAvgPrice - (BreakevenSellTPPips * pip), digits);
        
        // Set ALL existing SELL positions to breakeven TP
        SetAllPositionsTP(POSITION_TYPE_SELL, sellBE_TP);
        
        // Also update any pending recovery orders to have the same breakeven TP
        UpdateRecoveryOrdersTP(ORDER_TYPE_SELL_LIMIT, sellBE_TP);
        
        // Find the HIGHEST sell position price and its lot size (for SELL recovery, we go higher)
        // This ensures recovery orders are always placed above all existing positions
        double highestSellPrice = 0;
        double lastSellLot = SellBERecoveryLotMin;
        for(int i = 0; i < total; i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(posType == POSITION_TYPE_SELL)
            {
                double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
                if(openPrice > highestSellPrice)
                {
                    highestSellPrice = openPrice;
                    lastSellLot = PositionGetDouble(POSITION_VOLUME);
                }
            }
        }
        
        // Count existing recovery orders (both pending and filled)
        int sellRecoveryPendingCount = CountRecoveryPendingOrders(ORDER_TYPE_SELL_LIMIT);
        int sellRecoveryFilledCount = CountRecoveryPositions(POSITION_TYPE_SELL);
        int totalSellRecoveryCount = sellRecoveryPendingCount + sellRecoveryFilledCount;
        
        // Calculate recovery price based on HIGHEST position + same grid gap as normal orders
        // Recovery order is placed at: highestPrice + SellGapPips (always above all positions)
        double sellGapPrice = SellGapPips * pip;
        double correctRecoveryPrice = NormalizeDouble(highestSellPrice + sellGapPrice, digits);
        
        // Always use the correct calculated price
        nextSellBERecoveryPrice = correctRecoveryPrice;
        
        
        // Place recovery pending orders if needed
        if(totalSellRecoveryCount < MaxSellBERecoveryOrders)
        {
            if(sellRecoveryPendingCount == 0) // Only place if no pending recovery order exists
            {
                // Calculate lot size: last position lot + increase percentage
                double recoveryLot = lastSellLot * (1.0 + SellBERecoveryLotIncrease / 100.0);
                
                double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
                recoveryLot = MathRound(recoveryLot / lotStep) * lotStep;
                recoveryLot = MathMax(SellBERecoveryLotMin, MathMin(SellBERecoveryLotMax, recoveryLot));
                
                // Only place if price is above current ask and no position exists at that price
                if(nextSellBERecoveryPrice > askPrice && nextSellBERecoveryPrice > 0)
                {
                    if(!OrderExistsAtPrice(nextSellBERecoveryPrice, ORDER_TYPE_SELL_LIMIT) &&
                       !PositionExistsAtPrice(nextSellBERecoveryPrice, POSITION_TYPE_SELL))
                    {
                        // Recovery orders have NO SL, only breakeven TP
                        if(trade.SellLimit(recoveryLot, nextSellBERecoveryPrice, _Symbol, 0, sellBE_TP, ORDER_TIME_GTC, 0, "BE_Recovery_SELL"))
                        {
                            Print("[SELL RECOVERY] @ ", DoubleToString(nextSellBERecoveryPrice, digits),
                                  " | Lot: ", DoubleToString(recoveryLot, 2), " (from ", DoubleToString(lastSellLot, 2), " +", SellBERecoveryLotIncrease, "%)");
                            SendActionLog("RECOVERY", "SELL Recovery @ " + DoubleToString(nextSellBERecoveryPrice, digits) + " | Lot: " + DoubleToString(recoveryLot, 2));
                        }
                    }
                }
            }
        }
        else
        {
            // Max recovery orders reached - delete any pending recovery orders
            DeleteRecoveryPendingOrders(ORDER_TYPE_SELL_LIMIT);
        }
    }
    else
    {
        // Not in recovery mode - clean up
        nextSellBERecoveryPrice = 0;
        DeleteRecoveryPendingOrders(ORDER_TYPE_SELL_LIMIT);
    }
    
    // Additional cleanup: Always delete recovery pending orders if no SELL positions exist
    if(currentSellCount == 0)
    {
        DeleteRecoveryPendingOrders(ORDER_TYPE_SELL_LIMIT);
    }
}

//+------------------------------------------------------------------+
//| Apply Trailing Stop to Open Positions (Separate BUY/SELL)        |
//+------------------------------------------------------------------+
void ApplyTrailingStop()
{
    // Skip trailing stop in recovery mode - no SL allowed during recovery
    bool buyInRecovery = (EnableBuyBERecovery && currentBuyCount >= MaxBuyOrders);
    bool sellInRecovery = (EnableSellBERecovery && currentSellCount >= MaxSellOrders);
    
    int totalPositions = PositionsTotal();
    
    for(int i = 0; i < totalPositions; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        
        // Check magic number only if not managing all trades
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        // Skip trailing stop for positions in recovery mode
        if(posType == POSITION_TYPE_BUY && buyInRecovery) continue;
        if(posType == POSITION_TYPE_SELL && sellInRecovery) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double currentSL = PositionGetDouble(POSITION_SL);
        double currentTP = PositionGetDouble(POSITION_TP);
        
        double currentPrice = (posType == POSITION_TYPE_BUY) ? 
                              SymbolInfoDouble(_Symbol, SYMBOL_BID) : 
                              SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        
        // Get settings based on position type
        double trailingStartPips = (posType == POSITION_TYPE_BUY) ? BuyTrailingStartPips : SellTrailingStartPips;
        double initialSLPips = (posType == POSITION_TYPE_BUY) ? BuyInitialSLPips : SellInitialSLPips;
        double trailingRatio = (posType == POSITION_TYPE_BUY) ? BuyTrailingRatio : SellTrailingRatio;
        double maxSLDistance = (posType == POSITION_TYPE_BUY) ? BuyMaxSLDistance : SellMaxSLDistance;
        double trailingStepPips = (posType == POSITION_TYPE_BUY) ? BuyTrailingStepPips : SellTrailingStepPips;
        
        // Calculate profit in pips
        double profitPips = 0;
        if(posType == POSITION_TYPE_BUY)
        {
            profitPips = (currentPrice - openPrice) / pip;
        }
        else
        {
            profitPips = (openPrice - currentPrice) / pip;
        }
        
        // Check if profit reached trailing start threshold
        if(profitPips >= trailingStartPips)
        {
            double newSL = 0;
            bool needsUpdate = false;
            
            if(posType == POSITION_TYPE_BUY)
            {
                // For BUY: Initial SL at entry + InitialSLPips when profit reaches TrailingStartPips
                double priceMovement = currentPrice - (openPrice + (trailingStartPips * pip));
                if(priceMovement < 0) priceMovement = 0;
                
                double slMovement = priceMovement * trailingRatio;
                newSL = openPrice + (initialSLPips * pip) + slMovement;
                
                // Enforce maximum SL distance from current price
                double minAllowedSL = currentPrice - (maxSLDistance * pip);
                if(newSL < minAllowedSL) newSL = minAllowedSL;
                
                newSL = NormalizeDouble(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                
                if(currentSL == 0 || newSL > currentSL + (trailingStepPips * pip))
                {
                    needsUpdate = true;
                }
            }
            else // SELL
            {
                // For SELL: Initial SL at entry - InitialSLPips when profit reaches TrailingStartPips
                double priceMovement = (openPrice - (trailingStartPips * pip)) - currentPrice;
                if(priceMovement < 0) priceMovement = 0;
                
                double slMovement = priceMovement * trailingRatio;
                newSL = openPrice - (initialSLPips * pip) - slMovement;
                
                // Enforce maximum SL distance from current price
                double maxAllowedSL = currentPrice + (maxSLDistance * pip);
                if(newSL > maxAllowedSL) newSL = maxAllowedSL;
                
                newSL = NormalizeDouble(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                
                if(currentSL == 0 || newSL < currentSL - (trailingStepPips * pip))
                {
                    needsUpdate = true;
                }
            }
            
            if(needsUpdate)
            {
                if(trade.PositionModify(ticket, newSL, currentTP))
                {
                    string posTypeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
                    Print("Trailing SL applied to ", posTypeStr, " #", ticket, 
                          " | SL: ", DoubleToString(newSL, 2), 
                          " | Profit: ", DoubleToString(profitPips, 2), " pips");
                    SendActionLog("TRAILING", posTypeStr + " #" + IntegerToString(ticket) + " SL moved to " + DoubleToString(newSL, 2) + " | +" + DoubleToString(profitPips, 1) + " pips");
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Check if pending order exists at specific price                  |
//+------------------------------------------------------------------+
bool OrderExistsAtPrice(double price, ENUM_ORDER_TYPE orderType)
{
    int total = OrdersTotal();
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Normalize the target price to symbol digits
    double normalizedPrice = NormalizeDouble(price, digits);
    
    // Use full gap as tolerance to ensure proper spacing between orders
    double buyGapPrice = BuyGapPips * pip;
    double sellGapPrice = SellGapPips * pip;
    double tolerance = (orderType == ORDER_TYPE_BUY_LIMIT) ? buyGapPrice * 0.9 : sellGapPrice * 0.9;
    
    for(int i = 0; i < total; i++)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket > 0)
        {
            if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
            
            // Check magic number only if not managing all trades
            if(!ManageAllTrades && OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
            
            if(OrderGetInteger(ORDER_TYPE) == orderType)
            {
                double orderPrice = NormalizeDouble(OrderGetDouble(ORDER_PRICE_OPEN), digits);
                double priceDiff = MathAbs(orderPrice - normalizedPrice);
                
                if(priceDiff < tolerance)
                {
                    return true; // Order exists nearby
                }
            }
        }
    }
    
    return false;
}

//+------------------------------------------------------------------+
//| Check if position exists at specific price                       |
//+------------------------------------------------------------------+
bool PositionExistsAtPrice(double price, ENUM_POSITION_TYPE posType)
{
    int total = PositionsTotal();
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Normalize the target price to symbol digits
    double normalizedPrice = NormalizeDouble(price, digits);
    
    // Use full gap as tolerance to ensure proper spacing between positions
    double buyGapPrice = BuyGapPips * pip;
    double sellGapPrice = SellGapPips * pip;
    double tolerance = (posType == POSITION_TYPE_BUY) ? buyGapPrice * 0.9 : sellGapPrice * 0.9;
    
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            
            // Check magic number only if not managing all trades
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            if(PositionGetInteger(POSITION_TYPE) == posType)
            {
                double openPrice = NormalizeDouble(PositionGetDouble(POSITION_PRICE_OPEN), digits);
                double priceDiff = MathAbs(openPrice - normalizedPrice);
                
                if(priceDiff < tolerance)
                {
                    return true; // Position exists nearby
                }
            }
        }
    }
    
    return false;
}

//+------------------------------------------------------------------+
//| Scan Existing Positions and Orders on Startup                    |
//+------------------------------------------------------------------+
void ScanExistingTrades()
{
    int existingBuyPositions = 0;
    int existingSellPositions = 0;
    
    // Count existing positions
    int totalPositions = PositionsTotal();
    for(int i = 0; i < totalPositions; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0)
        {
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            
            // Check magic number only if not managing all trades
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            // Log position details
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double currentSL = PositionGetDouble(POSITION_SL);
            double currentTP = PositionGetDouble(POSITION_TP);
            string typeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            long magic = PositionGetInteger(POSITION_MAGIC);
            
            if(posType == POSITION_TYPE_BUY)
                existingBuyPositions++;
            else
                existingSellPositions++;
            
            Print("Found ", typeStr, " #", ticket, " | Magic: ", magic, " | Price: ", DoubleToString(openPrice, 2), 
                  " | SL: ", DoubleToString(currentSL, 2), " | TP: ", DoubleToString(currentTP, 2));
        }
    }
    
    if(existingBuyPositions > 0 || existingSellPositions > 0)
    {
        Print("========================================");
        Print("EXISTING POSITIONS DETECTED:");
        Print("BUY Positions: ", existingBuyPositions);
        Print("SELL Positions: ", existingSellPositions);
        Print("Manage All Trades: ", ManageAllTrades ? "YES (all magic numbers)" : "NO (only magic ", MagicNumber, ")");
        Print("========================================");
        
        // Update counters
        currentBuyCount = existingBuyPositions;
        currentSellCount = existingSellPositions;
    }
    else
    {
        Print("No existing positions found. Starting fresh.");
    }
}

//+------------------------------------------------------------------+
//| Create Developer Credit Label on Chart                           |
//+------------------------------------------------------------------+
void CreateDeveloperLabel()
{
    // Create EA name and developer credit label
    ObjectCreate(0, "EA_DevCredit", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_YDISTANCE, 20);
    ObjectSetString(0, "EA_DevCredit", OBJPROP_TEXT, "Hedge Grid Trailing EA - Developed by Alimul Islam");
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_COLOR, clrLime);
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_DevCredit", OBJPROP_FONT, "Arial Bold");
    
    // Create contact info label
    ObjectCreate(0, "EA_DevContact", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_YDISTANCE, 40);
    ObjectSetString(0, "EA_DevContact", OBJPROP_TEXT, "Contact: +8801957045438 | VIRTUAL GRID MODE");
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_COLOR, clrYellow);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_DevContact", OBJPROP_FONT, "Arial");
}

//+------------------------------------------------------------------+
//| Apply Breakeven TP to All Trades (ONLY when max orders reached)   |
//+------------------------------------------------------------------+
void ApplyBreakevenTP()
{
    // ONLY apply breakeven TP when max orders are reached (recovery mode)
    // Before max orders, each position keeps its individual TP from grid settings
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    // Calculate average price and total lots for BUY positions
    double buyTotalLots = 0;
    double buyWeightedPrice = 0;
    int buyCount = 0;
    
    // Calculate average price and total lots for SELL positions
    double sellTotalLots = 0;
    double sellWeightedPrice = 0;
    int sellCount = 0;
    
    int total = PositionsTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        
        // If ManageAllTrades is false, only manage our magic number
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        if(posType == POSITION_TYPE_BUY)
        {
            buyWeightedPrice += openPrice * lots;
            buyTotalLots += lots;
            buyCount++;
        }
        else if(posType == POSITION_TYPE_SELL)
        {
            sellWeightedPrice += openPrice * lots;
            sellTotalLots += lots;
            sellCount++;
        }
    }
    
    // Calculate breakeven TP for BUY positions - ONLY if max orders reached
    if(buyCount >= MaxBuyOrders && buyTotalLots > 0)
    {
        double buyAvgPrice = buyWeightedPrice / buyTotalLots;
        double buyBreakevenTP = NormalizeDouble(buyAvgPrice + (BreakevenBuyTPPips * pip), digits);
        
        // Apply to all BUY positions
        for(int i = 0; i < total; i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(posType != POSITION_TYPE_BUY) continue;
            
            double currentTP = PositionGetDouble(POSITION_TP);
            double currentSL = PositionGetDouble(POSITION_SL);
            
            // Only update if TP is different
            if(MathAbs(currentTP - buyBreakevenTP) > pip * 0.1)
            {
                if(trade.PositionModify(ticket, currentSL, buyBreakevenTP))
                {
                    Print("[BREAKEVEN TP] BUY #", ticket, " | Avg: ", DoubleToString(buyAvgPrice, 2), 
                          " | TP: ", DoubleToString(buyBreakevenTP, 2));
                    SendActionLog("BREAKEVEN", "BUY positions TP set to " + DoubleToString(buyBreakevenTP, 2) + " | Avg: " + DoubleToString(buyAvgPrice, 2));
                }
            }
        }
    }
    
    // Calculate breakeven TP for SELL positions - ONLY if max orders reached
    if(sellCount >= MaxSellOrders && sellTotalLots > 0)
    {
        double sellAvgPrice = sellWeightedPrice / sellTotalLots;
        double sellBreakevenTP = NormalizeDouble(sellAvgPrice - (BreakevenSellTPPips * pip), digits);
        
        // Apply to all SELL positions
        for(int i = 0; i < total; i++)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket <= 0) continue;
            
            if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
            if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
            
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            if(posType != POSITION_TYPE_SELL) continue;
            
            double currentTP = PositionGetDouble(POSITION_TP);
            double currentSL = PositionGetDouble(POSITION_SL);
            
            // Only update if TP is different
            if(MathAbs(currentTP - sellBreakevenTP) > pip * 0.1)
            {
                if(trade.PositionModify(ticket, currentSL, sellBreakevenTP))
                {
                    Print("[BREAKEVEN TP] SELL #", ticket, " | Avg: ", DoubleToString(sellAvgPrice, 2), 
                          " | TP: ", DoubleToString(sellBreakevenTP, 2));
                    SendActionLog("BREAKEVEN", "SELL positions TP set to " + DoubleToString(sellBreakevenTP, 2) + " | Avg: " + DoubleToString(sellAvgPrice, 2));
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Update Info Panel on Chart - Professional Clean Design            |
//+------------------------------------------------------------------+
void UpdateInfoPanel()
{
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Calculate position data
    double buyAvgPrice = 0, sellAvgPrice = 0;
    double buyTotalLots = 0, sellTotalLots = 0;
    double buyWeightedPrice = 0, sellWeightedPrice = 0;
    double buyTotalProfit = 0, sellTotalProfit = 0;
    
    int total = PositionsTotal();
    for(int i = 0; i < total; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        if(!ManageAllTrades && PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double lots = PositionGetDouble(POSITION_VOLUME);
        double profit = PositionGetDouble(POSITION_PROFIT);
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        if(posType == POSITION_TYPE_BUY)
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
    
    bool buyRecoveryActive = (currentBuyCount >= MaxBuyOrders);
    bool sellRecoveryActive = (currentSellCount >= MaxSellOrders);
    double totalProfit = buyTotalProfit + sellTotalProfit;
    
    // Layout settings
    int leftX = 15;
    int rightX = 200;
    int yStart = 70;  // Start lower to avoid chart header
    int rowH = 15;
    int sectionGap = 8;
    
    // Delete old header objects
    ObjectDelete(0, "EA_Header");
    ObjectDelete(0, "EA_Mode");
    
    int y = yStart;
    
    // ========== PRICE BAR ==========
    string priceText = StringFormat("BID: %s  |  ASK: %s  |  SPREAD: %.1f", 
        DoubleToString(bidPrice, digits), 
        DoubleToString(askPrice, digits),
        (askPrice - bidPrice) / pip);
    ObjectCreate(0, "EA_Price", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_Price", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_Price", OBJPROP_XDISTANCE, leftX);
    ObjectSetInteger(0, "EA_Price", OBJPROP_YDISTANCE, y);
    ObjectSetString(0, "EA_Price", OBJPROP_TEXT, priceText);
    ObjectSetInteger(0, "EA_Price", OBJPROP_COLOR, clrYellow);
    ObjectSetInteger(0, "EA_Price", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_Price", OBJPROP_FONT, "Consolas");
    
    y += rowH + sectionGap;
    
    // ========== SELL SECTION ==========
    int sellY = y;
    
    // SELL Title
    ObjectCreate(0, "EA_SellTitle", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellTitle", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellTitle", OBJPROP_XDISTANCE, leftX);
    ObjectSetInteger(0, "EA_SellTitle", OBJPROP_YDISTANCE, sellY);
    ObjectSetString(0, "EA_SellTitle", OBJPROP_TEXT, "SELL");
    ObjectSetInteger(0, "EA_SellTitle", OBJPROP_COLOR, clrOrangeRed);
    ObjectSetInteger(0, "EA_SellTitle", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_SellTitle", OBJPROP_FONT, "Arial Bold");
    
    // SELL Mode Badge
    string sellBadge = sellRecoveryActive ? "[REC]" : "[GRID]";
    ObjectCreate(0, "EA_SellBadge", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellBadge", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellBadge", OBJPROP_XDISTANCE, leftX + 45);
    ObjectSetInteger(0, "EA_SellBadge", OBJPROP_YDISTANCE, sellY);
    ObjectSetString(0, "EA_SellBadge", OBJPROP_TEXT, sellBadge);
    ObjectSetInteger(0, "EA_SellBadge", OBJPROP_COLOR, sellRecoveryActive ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_SellBadge", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_SellBadge", OBJPROP_FONT, "Arial");
    sellY += rowH;
    
    // SELL Orders
    string sellOrders = StringFormat("Orders: %d/%d  Lots: %.2f", currentSellCount, MaxSellOrders, sellTotalLots);
    ObjectCreate(0, "EA_SellOrders", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellOrders", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellOrders", OBJPROP_XDISTANCE, leftX);
    ObjectSetInteger(0, "EA_SellOrders", OBJPROP_YDISTANCE, sellY);
    ObjectSetString(0, "EA_SellOrders", OBJPROP_TEXT, sellOrders);
    ObjectSetInteger(0, "EA_SellOrders", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_SellOrders", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_SellOrders", OBJPROP_FONT, "Arial");
    sellY += rowH;
    
    // SELL Avg & Profit
    string sellAvg = StringFormat("Avg: %s  P/L: ", sellAvgPrice > 0 ? DoubleToString(sellAvgPrice, digits) : "---");
    ObjectCreate(0, "EA_SellAvg", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_XDISTANCE, leftX);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_YDISTANCE, sellY);
    ObjectSetString(0, "EA_SellAvg", OBJPROP_TEXT, sellAvg);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_COLOR, clrSilver);
    ObjectSetInteger(0, "EA_SellAvg", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_SellAvg", OBJPROP_FONT, "Arial");
    
    // SELL Profit value
    string sellPL = StringFormat("%.2f", sellTotalProfit);
    ObjectCreate(0, "EA_SellPL", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellPL", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellPL", OBJPROP_XDISTANCE, leftX + 115);
    ObjectSetInteger(0, "EA_SellPL", OBJPROP_YDISTANCE, sellY);
    ObjectSetString(0, "EA_SellPL", OBJPROP_TEXT, sellPL);
    ObjectSetInteger(0, "EA_SellPL", OBJPROP_COLOR, sellTotalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_SellPL", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_SellPL", OBJPROP_FONT, "Arial Bold");
    sellY += rowH;
    
    // SELL Next/Recovery
    if(sellRecoveryActive && EnableSellBERecovery)
    {
        int sellRecFilled = CountRecoveryPositions(POSITION_TYPE_SELL);
        string sellRec = StringFormat("Rec: %d/%d  Next: %s", sellRecFilled, MaxSellBERecoveryOrders,
            nextSellBERecoveryPrice > 0 ? DoubleToString(nextSellBERecoveryPrice, digits) : "---");
        ObjectCreate(0, "EA_SellNext", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_XDISTANCE, leftX);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_YDISTANCE, sellY);
        ObjectSetString(0, "EA_SellNext", OBJPROP_TEXT, sellRec);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_COLOR, clrMagenta);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_SellNext", OBJPROP_FONT, "Arial");
    }
    else
    {
        string sellNext = StringFormat("Next: %s", nextSellPrice > 0 ? DoubleToString(nextSellPrice, digits) : "---");
        ObjectCreate(0, "EA_SellNext", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_XDISTANCE, leftX);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_YDISTANCE, sellY);
        ObjectSetString(0, "EA_SellNext", OBJPROP_TEXT, sellNext);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_COLOR, clrCyan);
        ObjectSetInteger(0, "EA_SellNext", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_SellNext", OBJPROP_FONT, "Arial");
    }
    
    // ========== BUY SECTION ==========
    int buyY = y;
    
    // BUY Title
    ObjectCreate(0, "EA_BuyTitle", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyTitle", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyTitle", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyTitle", OBJPROP_YDISTANCE, buyY);
    ObjectSetString(0, "EA_BuyTitle", OBJPROP_TEXT, "BUY");
    ObjectSetInteger(0, "EA_BuyTitle", OBJPROP_COLOR, clrDodgerBlue);
    ObjectSetInteger(0, "EA_BuyTitle", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_BuyTitle", OBJPROP_FONT, "Arial Bold");
    
    // BUY Mode Badge
    string buyBadge = buyRecoveryActive ? "[REC]" : "[GRID]";
    ObjectCreate(0, "EA_BuyBadge", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyBadge", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyBadge", OBJPROP_XDISTANCE, rightX + 35);
    ObjectSetInteger(0, "EA_BuyBadge", OBJPROP_YDISTANCE, buyY);
    ObjectSetString(0, "EA_BuyBadge", OBJPROP_TEXT, buyBadge);
    ObjectSetInteger(0, "EA_BuyBadge", OBJPROP_COLOR, buyRecoveryActive ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_BuyBadge", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_BuyBadge", OBJPROP_FONT, "Arial");
    buyY += rowH;
    
    // BUY Orders
    string buyOrders = StringFormat("Orders: %d/%d  Lots: %.2f", currentBuyCount, MaxBuyOrders, buyTotalLots);
    ObjectCreate(0, "EA_BuyOrders", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyOrders", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyOrders", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyOrders", OBJPROP_YDISTANCE, buyY);
    ObjectSetString(0, "EA_BuyOrders", OBJPROP_TEXT, buyOrders);
    ObjectSetInteger(0, "EA_BuyOrders", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_BuyOrders", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_BuyOrders", OBJPROP_FONT, "Arial");
    buyY += rowH;
    
    // BUY Avg & Profit
    string buyAvg = StringFormat("Avg: %s  P/L: ", buyAvgPrice > 0 ? DoubleToString(buyAvgPrice, digits) : "---");
    ObjectCreate(0, "EA_BuyAvg", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_YDISTANCE, buyY);
    ObjectSetString(0, "EA_BuyAvg", OBJPROP_TEXT, buyAvg);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_COLOR, clrSilver);
    ObjectSetInteger(0, "EA_BuyAvg", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_BuyAvg", OBJPROP_FONT, "Arial");
    
    // BUY Profit value
    string buyPL = StringFormat("%.2f", buyTotalProfit);
    ObjectCreate(0, "EA_BuyPL", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyPL", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyPL", OBJPROP_XDISTANCE, rightX + 115);
    ObjectSetInteger(0, "EA_BuyPL", OBJPROP_YDISTANCE, buyY);
    ObjectSetString(0, "EA_BuyPL", OBJPROP_TEXT, buyPL);
    ObjectSetInteger(0, "EA_BuyPL", OBJPROP_COLOR, buyTotalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_BuyPL", OBJPROP_FONTSIZE, 8);
    ObjectSetString(0, "EA_BuyPL", OBJPROP_FONT, "Arial Bold");
    buyY += rowH;
    
    // BUY Next/Recovery
    if(buyRecoveryActive && EnableBuyBERecovery)
    {
        int buyRecFilled = CountRecoveryPositions(POSITION_TYPE_BUY);
        string buyRec = StringFormat("Rec: %d/%d  Next: %s", buyRecFilled, MaxBuyBERecoveryOrders,
            nextBuyBERecoveryPrice > 0 ? DoubleToString(nextBuyBERecoveryPrice, digits) : "---");
        ObjectCreate(0, "EA_BuyNext", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_YDISTANCE, buyY);
        ObjectSetString(0, "EA_BuyNext", OBJPROP_TEXT, buyRec);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_COLOR, clrMagenta);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_BuyNext", OBJPROP_FONT, "Arial");
    }
    else
    {
        string buyNext = StringFormat("Next: %s", nextBuyPrice > 0 ? DoubleToString(nextBuyPrice, digits) : "---");
        ObjectCreate(0, "EA_BuyNext", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_YDISTANCE, buyY);
        ObjectSetString(0, "EA_BuyNext", OBJPROP_TEXT, buyNext);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_COLOR, clrCyan);
        ObjectSetInteger(0, "EA_BuyNext", OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, "EA_BuyNext", OBJPROP_FONT, "Arial");
    }
    
    // ========== TOTAL PROFIT ==========
    int finalY = MathMax(sellY, buyY) + sectionGap + 5;
    
    string totalText = StringFormat("TOTAL P/L: %.2f", totalProfit);
    ObjectCreate(0, "EA_Total", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_Total", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_Total", OBJPROP_XDISTANCE, leftX);
    ObjectSetInteger(0, "EA_Total", OBJPROP_YDISTANCE, finalY);
    ObjectSetString(0, "EA_Total", OBJPROP_TEXT, totalText);
    ObjectSetInteger(0, "EA_Total", OBJPROP_COLOR, totalProfit >= 0 ? clrLime : clrRed);
    ObjectSetInteger(0, "EA_Total", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_Total", OBJPROP_FONT, "Arial Bold");
    
    // Delete old objects that are no longer used
    ObjectDelete(0, "EA_ModeStatus");
    ObjectDelete(0, "EA_SellHeader");
    ObjectDelete(0, "EA_SellMode");
    ObjectDelete(0, "EA_SellCount");
    ObjectDelete(0, "EA_SellBE");
    ObjectDelete(0, "EA_SellProfit");
    ObjectDelete(0, "EA_SellRecovery");
    ObjectDelete(0, "EA_BuyHeader");
    ObjectDelete(0, "EA_BuyMode");
    ObjectDelete(0, "EA_BuyCount");
    ObjectDelete(0, "EA_BuyBE");
    ObjectDelete(0, "EA_BuyProfit");
    ObjectDelete(0, "EA_BuyRecovery");
    ObjectDelete(0, "EA_PriceHeader");
    ObjectDelete(0, "EA_PriceInfo");
    ObjectDelete(0, "EA_TotalProfit");
}

//+------------------------------------------------------------------+
