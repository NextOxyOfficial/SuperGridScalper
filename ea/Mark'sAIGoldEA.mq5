//+------------------------------------------------------------------+
//|                                           Mark's AI 3.0 EA.mq5   |
//|                         Mark's AI 3.0 - Smart Grid EA            |
//|                            https://markstrades.com               |
//+------------------------------------------------------------------+
#property copyright "Mark's AI 3.0 - https://markstrades.com"
#property link      "https://markstrades.com"
#property version   "3.0"
#property strict

#include <Trade\Trade.mqh>

CTrade trade;

//--- License Settings (VISIBLE TO USER)
input string    LicenseKey        = "";    // License Key

//=============================================================================
// HIDDEN TRADING PARAMETERS - Not visible in EA settings UI
// These are hardcoded values that users cannot modify
//=============================================================================

//--- BUY Grid Range Settings (HIDDEN)
double    BuyRangeStart     = 4400;
double    BuyRangeEnd       = 4000;
double    BuyGapPips        = 4.0;
int       MaxBuyOrders      = 4;

//--- BUY TP/SL/Trailing Settings (HIDDEN)
double    BuyTakeProfitPips    = 50.0;
double    BuyStopLossPips      = 0.0;
double    BuyTrailingStartPips = 3.0;
double    BuyInitialSLPips     = 2.0;
double    BuyTrailingRatio     = 0.5;
double    BuyMaxSLDistance     = 15.0;
double    BuyTrailingStepPips  = 0.5;

//--- SELL Grid Range Settings (HIDDEN)
double    SellRangeStart    = 4400;
double    SellRangeEnd      = 4000;
double    SellGapPips       = 4.0;
int       MaxSellOrders     = 4;

//--- SELL TP/SL/Trailing Settings (HIDDEN)
double    SellTakeProfitPips    = 50.0;
double    SellStopLossPips      = 0.0;
double    SellTrailingStartPips = 4.0;
double    SellInitialSLPips     = 3.0;
double    SellTrailingRatio     = 0.5;
double    SellMaxSLDistance     = 15.0;
double    SellTrailingStepPips  = 0.5;

//--- Lot & Risk (HIDDEN)
double    LotSize           = 0.25;
bool      ManageAllTrades   = true;

//--- BUY Breakeven Recovery (HIDDEN)
bool      EnableBuyBERecovery       = true;
double    BuyBERecoveryLotMin       = 0.25;
double    BuyBERecoveryLotMax       = 5.00;
double    BuyBERecoveryLotIncrease  = 10.0;
int       MaxBuyBERecoveryOrders    = 30;

//--- SELL Breakeven Recovery (HIDDEN)
bool      EnableSellBERecovery      = true;
double    SellBERecoveryLotMin      = 0.25;
double    SellBERecoveryLotMax      = 5.00;
double    SellBERecoveryLotIncrease = 10.0;
int       MaxSellBERecoveryOrders   = 30;

//--- Recovery Mode Trailing Settings (HIDDEN)
double    RecoveryTakeProfitPips    = 100.0;
double    RecoveryTrailingStartPips = 3.0;
double    RecoveryTrailingRatio     = 0.5;
double    RecoveryMaxSLDistance     = 12.0;
double    RecoveryInitialSLPips     = 2.0;

//--- EA Settings (HIDDEN)
int       MagicNumber       = 999888;
string    OrderComment      = "MarksAI";

//--- Demo/Trial Mode (VISIBLE - User can enable for testing)
input bool    EnableDemoMode = true;  // Enable Demo Mode (No License Required)

//--- Server URL (Hidden from user)
string    LicenseServer     = "https://markstrades.com";

//--- License Status (Global)
bool g_LicenseValid = false;
string g_LicenseMessage = "";
int g_DaysRemaining = 0;
string g_PlanName = "";
datetime g_LastVerification = 0;
datetime g_LastLicenseCheck = 0;
int LICENSE_CHECK_INTERVAL = 3600; // Check license every hour (3600 seconds)

//--- Demo Mode Tracking
datetime g_DemoStartTime = 0;
int g_DemoTradesCount = 0;

//--- Global Variables
double pip = 1.0;
double normalizedLotSize = 0.0;

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

// Average prices for recovery mode trailing (calculated in ApplyBreakevenTP)
double buyAvgPrice = 0;
double sellAvgPrice = 0;

// Trading Log (keeps last 100 entries, oldest auto-deleted)
#define MAX_LOG_ENTRIES 100
string g_TradingLog[MAX_LOG_ENTRIES];
int g_LogCount = 0;

//+------------------------------------------------------------------+
//| Add entry to trading log                                          |
//+------------------------------------------------------------------+
void AddToLog(string message, string logType = "INFO")
{
    // Shift existing entries down
    for(int i = MAX_LOG_ENTRIES - 1; i > 0; i--)
    {
        g_TradingLog[i] = g_TradingLog[i-1];
    }
    
    // Add new entry at top with timestamp
    string timeStr = TimeToString(TimeCurrent(), TIME_MINUTES|TIME_SECONDS);
    g_TradingLog[0] = timeStr + " | " + message;
    
    if(g_LogCount < MAX_LOG_ENTRIES) g_LogCount++;
    
    // Also print to Experts tab
    Print(message);
    
    // Send log to backend server
    SendLogToServer(message, logType);
}

//+------------------------------------------------------------------+
//| Send log entry to backend server                                  |
//+------------------------------------------------------------------+
void SendLogToServer(string message, string logType)
{
    // Skip if no license key
    if(StringLen(LicenseKey) == 0) return;
    
    // Build JSON request
    string jsonRequest = "{";
    jsonRequest += "\"license_key\":\"" + LicenseKey + "\",";
    jsonRequest += "\"log_type\":\"" + logType + "\",";
    jsonRequest += "\"message\":\"" + message + "\",";
    jsonRequest += "\"details\":{\"symbol\":\"" + _Symbol + "\",\"account\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"}";
    jsonRequest += "}";
    
    // Prepare request
    string url = LicenseServer + "/api/action-log/";
    string headers = "Content-Type: application/json\r\n";
    char postData[];
    char result[];
    string resultHeaders;
    
    // Convert string to char array
    StringToCharArray(jsonRequest, postData, 0, StringLen(jsonRequest));
    
    // Make HTTP request (async - don't wait for response)
    int timeout = 1000; // 1 second timeout
    WebRequest("POST", url, headers, timeout, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Send trade data to backend server                                 |
//+------------------------------------------------------------------+
datetime g_LastTradeDataUpdate = 0;

void SendTradeDataToServer()
{
    // Skip if no license key
    if(StringLen(LicenseKey) == 0) 
    {
        Print("Trade data not sent: No license key");
        return;
    }
    
    // Only send every 5 seconds to avoid overloading
    if(TimeCurrent() - g_LastTradeDataUpdate < 5) return;
    g_LastTradeDataUpdate = TimeCurrent();
    
    Print("Sending trade data to server...");
    
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
    
    // Build closed positions array (last 100 from history, sorted by close time)
    string closedJson = "[";
    int closedCount = 0;
    
    // Select history for last 30 days
    datetime fromDate = TimeCurrent() - 30 * 24 * 60 * 60;
    datetime toDate = TimeCurrent();
    
    if(HistorySelect(fromDate, toDate))
    {
        int totalDeals = HistoryDealsTotal();
        // Get last 100 closed deals (iterate from end - most recent first)
        for(int i = totalDeals - 1; i >= 0 && closedCount < 100; i--)
        {
            ulong dealTicket = HistoryDealGetTicket(i);
            if(dealTicket <= 0) continue;
            
            // Only get deals for current symbol
            string dealSymbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
            if(dealSymbol != _Symbol) continue;
            
            // Only get exit deals (DEAL_ENTRY_OUT)
            ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
            if(dealEntry != DEAL_ENTRY_OUT) continue;
            
            ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;
            
            double lots = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
            double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
            double closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
            ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
            
            // Get open price from position history
            double openPrice = 0;
            if(HistorySelectByPosition(positionId))
            {
                int posDeals = HistoryDealsTotal();
                for(int j = 0; j < posDeals; j++)
                {
                    ulong entryTicket = HistoryDealGetTicket(j);
                    if(entryTicket > 0)
                    {
                        ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(entryTicket, DEAL_ENTRY);
                        if(entry == DEAL_ENTRY_IN)
                        {
                            openPrice = HistoryDealGetDouble(entryTicket, DEAL_PRICE);
                            break;
                        }
                    }
                }
                // Re-select full history
                HistorySelect(fromDate, toDate);
            }
            
            // Determine original position type (opposite of exit deal type)
            string posTypeStr = (dealType == DEAL_TYPE_SELL) ? "BUY" : "SELL";
            
            if(closedCount > 0) closedJson += ",";
            closedJson += "{";
            closedJson += "\"ticket\":" + IntegerToString(positionId) + ",";
            closedJson += "\"symbol\":\"" + dealSymbol + "\",";
            closedJson += "\"type\":\"" + posTypeStr + "\",";
            closedJson += "\"lots\":" + DoubleToString(lots, 2) + ",";
            closedJson += "\"open_price\":" + DoubleToString(openPrice, digits) + ",";
            closedJson += "\"close_price\":" + DoubleToString(closePrice, digits) + ",";
            closedJson += "\"profit\":" + DoubleToString(profit, 2) + ",";
            closedJson += "\"close_time\":\"" + TimeToString(closeTime, TIME_DATE|TIME_MINUTES) + "\"";
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
    
    // Determine trading mode
    bool buyInRecovery = (EnableBuyBERecovery && currentBuyCount >= MaxBuyOrders);
    bool sellInRecovery = (EnableSellBERecovery && currentSellCount >= MaxSellOrders);
    string tradingMode = "Normal Mode Running";
    if(buyInRecovery && sellInRecovery) tradingMode = "Buy & Sell Recovery Mode Activated!";
    else if(buyInRecovery) tradingMode = "Buy Recovery Mode Activated!";
    else if(sellInRecovery) tradingMode = "Sell Recovery Mode Activated!";
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
    
    // Debug: Log response status
    if(response != 200)
    {
        Print("Trade data send failed: HTTP ", response, " | URL: ", url);
    }
    else
    {
        string responseStr = CharArrayToString(result);
        if(StringFind(responseStr, "success") < 0)
        {
            Print("Trade data send error: ", responseStr);
        }
    }
}

//+------------------------------------------------------------------+
//| Update trading log display on chart                               |
//+------------------------------------------------------------------+
void UpdateTradingLogDisplay()
{
    int startY = 400; // Starting Y position
    int xPos = 10;    // X position (left side)
    
    // Create header
    string headerName = "EA_LogHeader";
    ObjectCreate(0, headerName, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, headerName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, headerName, OBJPROP_XDISTANCE, xPos);
    ObjectSetInteger(0, headerName, OBJPROP_YDISTANCE, startY);
    ObjectSetString(0, headerName, OBJPROP_TEXT, "═══ TRADING LOG ═══");
    ObjectSetInteger(0, headerName, OBJPROP_COLOR, clrGold);
    ObjectSetInteger(0, headerName, OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, headerName, OBJPROP_FONT, "Consolas");
    
    startY += 16;
    
    // Display log entries
    for(int i = 0; i < MAX_LOG_ENTRIES; i++)
    {
        string objName = "EA_Log_" + IntegerToString(i);
        ObjectCreate(0, objName, OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, xPos);
        ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, startY + (i * 14));
        
        string logText = (i < g_LogCount) ? g_TradingLog[i] : "";
        ObjectSetString(0, objName, OBJPROP_TEXT, logText);
        
        // Color based on content
        color logColor = clrWhite;
        if(StringFind(logText, "BUY") >= 0) logColor = clrLime;
        else if(StringFind(logText, "SELL") >= 0) logColor = clrCoral;
        else if(StringFind(logText, "TRAIL") >= 0) logColor = clrYellow;
        else if(StringFind(logText, "FAILED") >= 0 || StringFind(logText, "ERROR") >= 0) logColor = clrRed;
        else if(StringFind(logText, "TP HIT") >= 0 || StringFind(logText, "PROFIT") >= 0) logColor = clrAqua;
        
        ObjectSetInteger(0, objName, OBJPROP_COLOR, logColor);
        ObjectSetInteger(0, objName, OBJPROP_FONTSIZE, 8);
        ObjectSetString(0, objName, OBJPROP_FONT, "Consolas");
    }
}

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
//| Create License Status Panel on Chart (Top Right Corner)           |
//+------------------------------------------------------------------+
void CreateLicenseLabel()
{
    // Delete old license objects
    ObjectDelete(0, "EA_LicenseTitle");
    ObjectDelete(0, "EA_LicenseStatus");
    ObjectDelete(0, "EA_LicenseAccount");
    
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
        ObjectSetString(0, "EA_LicenseTitle", OBJPROP_TEXT, "MARK'S AI 3.0");
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_COLOR, clrGold);
        ObjectSetInteger(0, "EA_LicenseTitle", OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
        
        // Status Line
        color daysColor = clrLime;
        string statusLine = "";
        
        if(EnableDemoMode)
        {
            // Demo mode display
            statusLine = "DEMO MODE | Full Features | No License";
            daysColor = clrCyan;
        }
        else
        {
            // Licensed mode display
            if(g_DaysRemaining <= 7) daysColor = clrOrange;
            if(g_DaysRemaining <= 3) daysColor = clrRed;
            statusLine = "ACTIVE | " + g_PlanName + " | " + IntegerToString(g_DaysRemaining) + "d";
        }
        
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
    trade.SetExpertMagicNumber(MagicNumber);
    
    // Auto-detect pip value based on symbol digits
    // For XAUUSD: price 4000.00 (2 digits) -> 1 pip = 1.0 (4000 to 4001 = 1 pip)
    // For XAUUSD: price 4000.00 (2 digits) -> 1 pip = 0.1 if broker uses 2 decimal places for cents
    // For Forex: EURUSD 1.12345 (5 digits) -> 1 pip = 0.0001
    // For JPY pairs: USDJPY 150.123 (3 digits) -> 1 pip = 0.01
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    string symbolName = _Symbol;
    
    // Check if it's a gold/metal symbol
    // XAUUSDc: 4188.00 to 4189.00 = 1 pip, so pip = 1.0
    // Gold always uses 1 pip = $1 movement regardless of decimal places
    if(StringFind(symbolName, "XAU") >= 0 || StringFind(symbolName, "GOLD") >= 0)
    {
        // For Gold: 1 pip = 1.0 (4188 to 4189 = 1 pip)
        pip = 1.0;
    }
    else if(StringFind(symbolName, "XAG") >= 0 || StringFind(symbolName, "SILVER") >= 0)
    {
        // For Silver: 1 pip = 0.01
        pip = 0.01;
    }
    else if(digits == 2)
    {
        // 2 decimal places (like some indices): 1 pip = 0.1
        pip = 0.1;
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
    
    Print("=== PIP CALCULATION ===");
    Print("Symbol: ", symbolName, " | Digits: ", digits, " | Pip Value: ", DoubleToString(pip, digits));
    Print("Example: 1 pip movement = ", DoubleToString(pip, digits), " price change");
    
    // === LICENSE VERIFICATION ===
    if(EnableDemoMode)
    {
        // DEMO MODE - No license required
        Print("=== DEMO MODE ENABLED ===");
        Print("EA running in DEMO mode - No license verification");
        Print("Demo mode allows full functionality for testing");
        g_LicenseValid = true;
        g_LicenseMessage = "DEMO MODE";
        g_PlanName = "Demo";
        g_DaysRemaining = 999;
        g_DemoStartTime = TimeCurrent();
        g_DemoTradesCount = 0;
        CreateLicenseLabel();
    }
    else
    {
        // LICENSED MODE - Verify license
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
        g_LastLicenseCheck = TimeCurrent();
    }
    // === END LICENSE VERIFICATION ===
    
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
    
    // Use defaults if broker info not available yet
    if(minLot <= 0) minLot = 0.01;
    if(maxLot <= 0) maxLot = 100.0;
    if(lotStep <= 0) lotStep = 0.01;
    
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
    
    // Final safety check - ensure lot size is never 0
    if(normalizedLotSize <= 0)
    {
        normalizedLotSize = 0.01;
        Print("WARNING: Lot size was 0, set to default 0.01");
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
    Print("Manage All: ", ManageAllTrades ? "YES" : "NO", " | Recovery Trailing: ENABLED");
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
    // Only delete orders when EA is actually being removed, not on timeframe change
    if(reason == REASON_REMOVE || reason == REASON_CHARTCLOSE || reason == REASON_PROGRAM)
    {
        Print("=== EA Removed - Deleting pending orders ===");
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
    }
    else
    {
        Print("=== EA Reinitialized (Timeframe change) - Keeping orders ===");
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
    
    // Delete license panel objects
    ObjectDelete(0, "EA_LicenseTitle");
    ObjectDelete(0, "EA_LicenseStatus");
    ObjectDelete(0, "EA_LicenseAccount");
    
    // Delete trading log objects
    ObjectDelete(0, "EA_LogHeader");
    for(int i = 0; i < MAX_LOG_ENTRIES; i++)
    {
        ObjectDelete(0, "EA_Log_" + IntegerToString(i));
    }
    
    Print("=== Mark's AI 3.0 EA Stopped ===");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // Check if running in Strategy Tester
    bool isTesting = MQLInfoInteger(MQL_TESTER);
    
    // === PERIODIC LICENSE CHECK ===
    if(!EnableDemoMode) // Skip license check in demo mode
    {
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
            
            CreateLicenseLabel();
        }
        
        // === CHECK LICENSE BEFORE TRADING ===
        if(!g_LicenseValid)
        {
            Comment("LICENSE INVALID - EA STOPPED\n", g_LicenseMessage);
            return; // Don't trade if license invalid
        }
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
    
    // Check if in recovery mode
    bool buyInRecovery = (EnableBuyBERecovery && currentBuyCount >= MaxBuyOrders);
    bool sellInRecovery = (EnableSellBERecovery && currentSellCount >= MaxSellOrders);
    
    // Track mode changes and log them
    static bool prevBuyInRecovery = false;
    static bool prevSellInRecovery = false;
    
    if(buyInRecovery != prevBuyInRecovery)
    {
        if(buyInRecovery)
            AddToLog("BUY RECOVERY MODE ACTIVATED! Max orders reached.", "MODE_CHANGE");
        else
            AddToLog("BUY NORMAL MODE RESUMED. Recovery completed.", "MODE_CHANGE");
        prevBuyInRecovery = buyInRecovery;
    }
    
    if(sellInRecovery != prevSellInRecovery)
    {
        if(sellInRecovery)
            AddToLog("SELL RECOVERY MODE ACTIVATED! Max orders reached.", "MODE_CHANGE");
        else
            AddToLog("SELL NORMAL MODE RESUMED. Recovery completed.", "MODE_CHANGE");
        prevSellInRecovery = sellInRecovery;
    }
    
    // ===== MODE-BASED PENDING ORDER MANAGEMENT =====
    // Normal Mode: Place grid pending orders
    // Recovery Mode: Delete normal pending orders, place only 1 recovery pending order
    
    if(!buyInRecovery)
    {
        // BUY Normal Mode - manage grid pending orders
        ManageBuyPendingGrid();
    }
    else
    {
        // BUY Recovery Mode - delete normal pending orders (recovery orders handled separately)
        DeletePendingOrders(ORDER_TYPE_BUY_LIMIT);
    }
    
    if(!sellInRecovery)
    {
        // SELL Normal Mode - manage grid pending orders
        ManageSellPendingGrid();
    }
    else
    {
        // SELL Recovery Mode - delete normal pending orders (recovery orders handled separately)
        DeletePendingOrders(ORDER_TYPE_SELL_LIMIT);
    }
    
    // Check breakeven recovery orders (after max trades hit)
    // This places only 1 recovery pending order at a time
    if(EnableBuyBERecovery || EnableSellBERecovery)
    {
        CheckBERecoveryOrders();
    }
    
    // Apply breakeven TP (only in recovery mode)
    // This must be called BEFORE ApplyTrailingStop to set TP first
    if(buyInRecovery || sellInRecovery)
    {
        ApplyBreakevenTP();
    }
    
    // Apply trailing stop to positions
    // Normal Mode: Uses individual BUY/SELL trailing settings
    // Recovery Mode: Uses Recovery trailing settings
    // This is called AFTER ApplyBreakevenTP so trailing SL is applied correctly
    ApplyTrailingStop();
    
    // Update on-screen display
    UpdateInfoPanel();
    
    // Update trading log display
    UpdateTradingLogDisplay();
    
    // Send trade data to backend (for frontend dashboard)
    static datetime lastDebugTime = 0;
    if(TimeCurrent() - lastDebugTime > 30) // Debug every 30 seconds
    {
        lastDebugTime = TimeCurrent();
        Print("DEBUG: License Key Length = ", StringLen(LicenseKey), " | Server = ", LicenseServer);
    }
    SendTradeDataToServer();
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
//| Manage BUY Pending Orders Grid (Normal Mode Only)                 |
//| DYNAMIC GRID: Orders update with market price movement            |
//+------------------------------------------------------------------+
void ManageBuyPendingGrid()
{
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    double buyGapPrice = BuyGapPips * pip;
    double buyStart = MathMax(BuyRangeStart, BuyRangeEnd);
    double buyEnd = MathMin(BuyRangeStart, BuyRangeEnd);
    
    // Count existing pending orders
    int buyLimitCount = 0;
    int sellLimitCount = 0;
    CountPendingOrders(buyLimitCount, sellLimitCount);
    
    // Total orders = positions + pending
    int totalBuyOrders = currentBuyCount + buyLimitCount;
    
    // Only place if we have room and price is in range
    bool buyInRange = (bidPrice <= buyStart && bidPrice >= buyEnd);
    bool buyHasRoom = (currentBuyCount < MaxBuyOrders);
    
    // Debug every 30 seconds
    static datetime lastDebug = 0;
    if(TimeCurrent() - lastDebug > 30)
    {
        lastDebug = TimeCurrent();
        Print("=== BUY NORMAL MODE ===");
        Print("Bid=", bidPrice, " | BuyRange=", buyEnd, "-", buyStart, " | InRange=", buyInRange ? "YES" : "NO");
        Print("BuyPos=", currentBuyCount, "/", MaxBuyOrders, " | BuyPending=", buyLimitCount);
    }
    
    // DYNAMIC GRID UPDATE: Modify existing pending orders if price moved significantly
    // This keeps grid orders always at fixed distance from current price
    int ordTotal = OrdersTotal();
    for(int i = ordTotal - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) != ORDER_TYPE_BUY_LIMIT) continue;
        
        double currentOrderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
        
        // Calculate what the order price SHOULD be based on current market
        // Find the grid level this order should be at
        double priceDiffFromBid = bidPrice - currentOrderPrice;
        int gridLevel = (int)MathRound(priceDiffFromBid / buyGapPrice);
        
        // Only update if grid level is valid (1 to MaxBuyOrders)
        if(gridLevel >= 1 && gridLevel <= MaxBuyOrders)
        {
            double targetOrderPrice = NormalizeDouble(bidPrice - (gridLevel * buyGapPrice), digits);
            
            // Only modify if price difference is significant (more than half a gap)
            if(MathAbs(targetOrderPrice - currentOrderPrice) > buyGapPrice * 0.5)
            {
                // Check if target price is within range and no position/order exists there
                if(targetOrderPrice >= buyEnd && targetOrderPrice <= buyStart)
                {
                    if(!PositionExistsAtPrice(targetOrderPrice, POSITION_TYPE_BUY) &&
                       !OrderExistsAtPrice(targetOrderPrice, ORDER_TYPE_BUY_LIMIT))
                    {
                        double sl = (BuyStopLossPips > 0) ? NormalizeDouble(targetOrderPrice - (BuyStopLossPips * pip), digits) : 0;
                        double tp = (BuyTakeProfitPips > 0) ? NormalizeDouble(targetOrderPrice + (BuyTakeProfitPips * pip), digits) : 0;
                        
                        // Modify the order to new price
                        if(trade.OrderModify(ticket, targetOrderPrice, sl, tp, ORDER_TIME_GTC, 0))
                        {
                            Print("[DYNAMIC GRID] BUY order #", ticket, " updated: ", 
                                  DoubleToString(currentOrderPrice, digits), " -> ", DoubleToString(targetOrderPrice, digits));
                        }
                    }
                    else
                    {
                        // Target price already has order/position, delete this duplicate
                        trade.OrderDelete(ticket);
                    }
                }
                else
                {
                    // Order moved out of range, delete it
                    trade.OrderDelete(ticket);
                }
            }
        }
        else if(gridLevel > MaxBuyOrders || priceDiffFromBid < 0)
        {
            // Order is too far or above current price, delete it
            trade.OrderDelete(ticket);
        }
    }
    
    if(buyHasRoom && buyInRange)
    {
        int ordersNeeded = MaxBuyOrders - totalBuyOrders;
        
        if(ordersNeeded > 0 && normalizedLotSize > 0)
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
                        AddToLog("BUY LIMIT @ " + DoubleToString(buyLimitPrice, digits) + " | Lot: " + DoubleToString(normalizedLotSize, 2), "OPEN_BUY");
                        nextBuyPrice = buyLimitPrice;
                        placed++;
                    }
                }
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Manage SELL Pending Orders Grid (Normal Mode Only)                |
//| DYNAMIC GRID: Orders update with market price movement            |
//+------------------------------------------------------------------+
void ManageSellPendingGrid()
{
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    
    double sellGapPrice = SellGapPips * pip;
    double sellStart = MathMin(SellRangeStart, SellRangeEnd);
    double sellEnd = MathMax(SellRangeStart, SellRangeEnd);
    
    // Count existing pending orders
    int buyLimitCount = 0;
    int sellLimitCount = 0;
    CountPendingOrders(buyLimitCount, sellLimitCount);
    
    // Total orders = positions + pending
    int totalSellOrders = currentSellCount + sellLimitCount;
    
    // Only place if we have room and price is in range
    bool sellInRange = (askPrice >= sellStart && askPrice <= sellEnd);
    bool sellHasRoom = (currentSellCount < MaxSellOrders);
    
    // Debug every 30 seconds
    static datetime lastDebugSell = 0;
    if(TimeCurrent() - lastDebugSell > 30)
    {
        lastDebugSell = TimeCurrent();
        Print("=== SELL NORMAL MODE ===");
        Print("Ask=", askPrice, " | SellRange=", sellStart, "-", sellEnd, " | InRange=", sellInRange ? "YES" : "NO");
        Print("SellPos=", currentSellCount, "/", MaxSellOrders, " | SellPending=", sellLimitCount);
    }
    
    // DYNAMIC GRID UPDATE: Modify existing pending orders if price moved significantly
    // This keeps grid orders always at fixed distance from current price
    int ordTotal = OrdersTotal();
    for(int i = ordTotal - 1; i >= 0; i--)
    {
        ulong ticket = OrderGetTicket(i);
        if(ticket <= 0) continue;
        if(OrderGetString(ORDER_SYMBOL) != _Symbol) continue;
        if(OrderGetInteger(ORDER_MAGIC) != MagicNumber) continue;
        if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) != ORDER_TYPE_SELL_LIMIT) continue;
        
        double currentOrderPrice = OrderGetDouble(ORDER_PRICE_OPEN);
        
        // Calculate what the order price SHOULD be based on current market
        // Find the grid level this order should be at
        double priceDiffFromAsk = currentOrderPrice - askPrice;
        int gridLevel = (int)MathRound(priceDiffFromAsk / sellGapPrice);
        
        // Only update if grid level is valid (1 to MaxSellOrders)
        if(gridLevel >= 1 && gridLevel <= MaxSellOrders)
        {
            double targetOrderPrice = NormalizeDouble(askPrice + (gridLevel * sellGapPrice), digits);
            
            // Only modify if price difference is significant (more than half a gap)
            if(MathAbs(targetOrderPrice - currentOrderPrice) > sellGapPrice * 0.5)
            {
                // Check if target price is within range and no position/order exists there
                if(targetOrderPrice >= sellStart && targetOrderPrice <= sellEnd)
                {
                    if(!PositionExistsAtPrice(targetOrderPrice, POSITION_TYPE_SELL) &&
                       !OrderExistsAtPrice(targetOrderPrice, ORDER_TYPE_SELL_LIMIT))
                    {
                        double sl = (SellStopLossPips > 0) ? NormalizeDouble(targetOrderPrice + (SellStopLossPips * pip), digits) : 0;
                        double tp = (SellTakeProfitPips > 0) ? NormalizeDouble(targetOrderPrice - (SellTakeProfitPips * pip), digits) : 0;
                        
                        // Modify the order to new price
                        if(trade.OrderModify(ticket, targetOrderPrice, sl, tp, ORDER_TIME_GTC, 0))
                        {
                            Print("[DYNAMIC GRID] SELL order #", ticket, " updated: ", 
                                  DoubleToString(currentOrderPrice, digits), " -> ", DoubleToString(targetOrderPrice, digits));
                        }
                    }
                    else
                    {
                        // Target price already has order/position, delete this duplicate
                        trade.OrderDelete(ticket);
                    }
                }
                else
                {
                    // Order moved out of range, delete it
                    trade.OrderDelete(ticket);
                }
            }
        }
        else if(gridLevel > MaxSellOrders || priceDiffFromAsk < 0)
        {
            // Order is too far or below current price, delete it
            trade.OrderDelete(ticket);
        }
    }
    
    if(sellHasRoom && sellInRange)
    {
        int ordersNeeded = MaxSellOrders - totalSellOrders;
        
        if(ordersNeeded > 0 && normalizedLotSize > 0)
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
                        AddToLog("SELL LIMIT @ " + DoubleToString(sellLimitPrice, digits) + " | Lot: " + DoubleToString(normalizedLotSize, 2), "OPEN_SELL");
                        nextSellPrice = sellLimitPrice;
                        placed++;
                    }
                }
            }
        }
    }
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
        
        // Move furthest order to closest available grid level (only if more than 3 gaps away)
        if(furthestBuyTicket > 0 && maxBuyDistance > buyGap * 3.0)
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
        
        // Move furthest order to closest available grid level (only if more than 3 gaps away)
        if(furthestSellTicket > 0 && maxSellDistance > sellGap * 3.0)
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
        // Calculate recovery TP for all BUY positions (use RecoveryTakeProfitPips from average)
        double buyBE_TP = NormalizeDouble(buyAvgPrice + (RecoveryTakeProfitPips * pip), digits);
        
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
        
        // If price has moved down significantly, place recovery order below current bid price
        // This ensures recovery orders are always placed where they can be triggered
        if(correctRecoveryPrice >= bidPrice)
        {
            // Place recovery order at current bid - gap (so it can be triggered when price goes down)
            correctRecoveryPrice = NormalizeDouble(bidPrice - buyGapPrice, digits);
        }
        
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
        // Calculate recovery TP for all SELL positions (use RecoveryTakeProfitPips from average)
        double sellBE_TP = NormalizeDouble(sellAvgPrice - (RecoveryTakeProfitPips * pip), digits);
        
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
        
        // If price has moved up significantly, place recovery order above current ask price
        // This ensures recovery orders are always placed where they can be triggered
        if(correctRecoveryPrice <= askPrice)
        {
            // Place recovery order at current ask + gap (so it can be triggered when price goes up)
            correctRecoveryPrice = NormalizeDouble(askPrice + sellGapPrice, digits);
        }
        
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
//| Apply Trailing Stop to Open Positions                            |
//| NORMAL MODE: Use BUY/SELL individual trailing settings           |
//| RECOVERY MODE: Use Recovery trailing settings                    |
//+------------------------------------------------------------------+
void ApplyTrailingStop()
{
    // Check if in recovery mode
    bool buyInRecovery = (EnableBuyBERecovery && currentBuyCount >= MaxBuyOrders);
    bool sellInRecovery = (EnableSellBERecovery && currentSellCount >= MaxSellOrders);
    
    int totalPositions = PositionsTotal();
    
    for(int i = 0; i < totalPositions; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket <= 0) continue;
        
        if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
        
        // Check magic number only if not managing all trades
        long posMagic = PositionGetInteger(POSITION_MAGIC);
        if(!ManageAllTrades && posMagic != MagicNumber) continue;
        
        ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
        
        double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
        double currentSL = PositionGetDouble(POSITION_SL);
        double currentTP = PositionGetDouble(POSITION_TP);
        
        double currentPrice = (posType == POSITION_TYPE_BUY) ? 
                              SymbolInfoDouble(_Symbol, SYMBOL_BID) : 
                              SymbolInfoDouble(_Symbol, SYMBOL_ASK);
        
        // Select trailing settings based on position type and mode
        double trailingStartPips, initialSLPips, trailingRatio, maxSLDistance, trailingStepPips;
        bool isRecoveryMode = false;
        string modeStr = "";
        
        if(posType == POSITION_TYPE_BUY)
        {
            if(buyInRecovery)
            {
                // BUY in Recovery Mode - use recovery settings
                trailingStartPips = RecoveryTrailingStartPips;
                initialSLPips = RecoveryInitialSLPips;
                trailingRatio = RecoveryTrailingRatio;
                maxSLDistance = RecoveryMaxSLDistance;
                trailingStepPips = 0.5;
                isRecoveryMode = true;
                modeStr = "RECOVERY";
            }
            else
            {
                // BUY in Normal Mode - use BUY individual settings
                trailingStartPips = BuyTrailingStartPips;
                initialSLPips = BuyInitialSLPips;
                trailingRatio = BuyTrailingRatio;
                maxSLDistance = BuyMaxSLDistance;
                trailingStepPips = BuyTrailingStepPips;
                modeStr = "NORMAL";
            }
        }
        else // SELL
        {
            if(sellInRecovery)
            {
                // SELL in Recovery Mode - use recovery settings
                trailingStartPips = RecoveryTrailingStartPips;
                initialSLPips = RecoveryInitialSLPips;
                trailingRatio = RecoveryTrailingRatio;
                maxSLDistance = RecoveryMaxSLDistance;
                trailingStepPips = 0.5;
                isRecoveryMode = true;
                modeStr = "RECOVERY";
            }
            else
            {
                // SELL in Normal Mode - use SELL individual settings
                trailingStartPips = SellTrailingStartPips;
                initialSLPips = SellInitialSLPips;
                trailingRatio = SellTrailingRatio;
                maxSLDistance = SellMaxSLDistance;
                trailingStepPips = SellTrailingStepPips;
                modeStr = "NORMAL";
            }
        }
        
        // Calculate profit in pips
        // RECOVERY MODE: Use profit from AVERAGE BREAKEVEN price (not individual position)
        // NORMAL MODE: Use profit from individual position open price
        double profitPips = 0;
        double priceDiff = 0;
        
        if(isRecoveryMode)
        {
            // In recovery mode, calculate profit from average breakeven price
            double avgPrice = 0;
            if(posType == POSITION_TYPE_BUY)
            {
                avgPrice = buyAvgPrice; // Use global average
                priceDiff = currentPrice - avgPrice;
                profitPips = priceDiff / pip;
            }
            else
            {
                avgPrice = sellAvgPrice; // Use global average
                priceDiff = avgPrice - currentPrice;
                profitPips = priceDiff / pip;
            }
        }
        else
        {
            // Normal mode: use individual position profit
            if(posType == POSITION_TYPE_BUY)
            {
                priceDiff = currentPrice - openPrice;
                profitPips = priceDiff / pip;
            }
            else
            {
                priceDiff = openPrice - currentPrice;
                profitPips = priceDiff / pip;
            }
        }
        
        // Debug trailing every 30 seconds
        static datetime lastTrailDebug = 0;
        if(TimeCurrent() - lastTrailDebug > 30)
        {
            lastTrailDebug = TimeCurrent();
            string posTypeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            Print("=== TRAILING DEBUG [", modeStr, "] ===");
            Print("Position: ", posTypeStr, " #", ticket);
            Print("Open: ", DoubleToString(openPrice, 2), " | Current: ", DoubleToString(currentPrice, 2));
            Print("Profit Pips: ", DoubleToString(profitPips, 2), " | Start Threshold: ", trailingStartPips);
            Print("Current SL: ", DoubleToString(currentSL, 2));
        }
        
        // Check if profit reached trailing start threshold
        if(profitPips >= trailingStartPips)
        {
            double newSL = 0;
            bool needsUpdate = false;
            
            if(posType == POSITION_TYPE_BUY)
            {
                // For BUY: Initial SL calculation
                // Recovery Mode: Use average breakeven price as base
                // Normal Mode: Use individual position open price as base
                double basePrice = isRecoveryMode ? buyAvgPrice : openPrice;
                
                double priceMovement = currentPrice - (basePrice + (trailingStartPips * pip));
                if(priceMovement < 0) priceMovement = 0;
                
                double slMovement = priceMovement * trailingRatio;
                newSL = basePrice + (initialSLPips * pip) + slMovement;
                
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
                // For SELL: Initial SL calculation
                // Recovery Mode: Use average breakeven price as base
                // Normal Mode: Use individual position open price as base
                double basePrice = isRecoveryMode ? sellAvgPrice : openPrice;
                
                double priceMovement = (basePrice - (trailingStartPips * pip)) - currentPrice;
                if(priceMovement < 0) priceMovement = 0;
                
                double slMovement = priceMovement * trailingRatio;
                newSL = basePrice - (initialSLPips * pip) - slMovement;
                
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
                    AddToLog(modeStr + " TRAIL " + posTypeStr + " SL: " + DoubleToString(newSL, 2) + " | +" + DoubleToString(profitPips, 1) + " pips", "TRAILING");
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
    ObjectSetString(0, "EA_DevCredit", OBJPROP_TEXT, "Mark's AI 3.0 - https://markstrades.com");
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_COLOR, clrLime);
    ObjectSetInteger(0, "EA_DevCredit", OBJPROP_FONTSIZE, 10);
    ObjectSetString(0, "EA_DevCredit", OBJPROP_FONT, "Arial Bold");
    
    // Create contact info label
    ObjectCreate(0, "EA_DevContact", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_DevContact", OBJPROP_YDISTANCE, 40);
    ObjectSetString(0, "EA_DevContact", OBJPROP_TEXT, "Mark's AI 3.0 | VIRTUAL GRID MODE");
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
        buyAvgPrice = buyWeightedPrice / buyTotalLots; // Store in global variable for trailing
        double buyBreakevenTP = NormalizeDouble(buyAvgPrice + (RecoveryTakeProfitPips * pip), digits);
        
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
                }
            }
        }
    }
    else
    {
        // Not in BUY recovery mode - reset average
        buyAvgPrice = 0;
    }
    
    // Calculate breakeven TP for SELL positions - ONLY if max orders reached
    if(sellCount >= MaxSellOrders && sellTotalLots > 0)
    {
        sellAvgPrice = sellWeightedPrice / sellTotalLots; // Store in global variable for trailing
        double sellBreakevenTP = NormalizeDouble(sellAvgPrice - (RecoveryTakeProfitPips * pip), digits);
        
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
                }
            }
        }
    }
    else
    {
        // Not in SELL recovery mode - reset average
        sellAvgPrice = 0;
    }
}

//+------------------------------------------------------------------+
//| Update Info Panel on Chart                                        |
//+------------------------------------------------------------------+
void UpdateInfoPanel()
{
    // Delete panel objects (not license/dev labels)
    ObjectDelete(0, "EA_ModeStatus");
    ObjectDelete(0, "EA_SellHeader");
    ObjectDelete(0, "EA_SellMode");
    ObjectDelete(0, "EA_SellCount");
    ObjectDelete(0, "EA_SellAvg");
    ObjectDelete(0, "EA_SellBE");
    ObjectDelete(0, "EA_SellNext");
    ObjectDelete(0, "EA_SellProfit");
    ObjectDelete(0, "EA_SellRecovery");
    ObjectDelete(0, "EA_BuyHeader");
    ObjectDelete(0, "EA_BuyMode");
    ObjectDelete(0, "EA_BuyCount");
    ObjectDelete(0, "EA_BuyAvg");
    ObjectDelete(0, "EA_BuyBE");
    ObjectDelete(0, "EA_BuyNext");
    ObjectDelete(0, "EA_BuyProfit");
    ObjectDelete(0, "EA_BuyRecovery");
    ObjectDelete(0, "EA_PriceHeader");
    ObjectDelete(0, "EA_PriceInfo");
    ObjectDelete(0, "EA_TotalProfit");
    
    int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
    double bidPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double askPrice = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    
    // Calculate average prices for display
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
    
    int yPos = 60;
    
    // ===== MODE STATUS =====
    bool buyRecoveryActive = (currentBuyCount >= MaxBuyOrders);
    bool sellRecoveryActive = (currentSellCount >= MaxSellOrders);
    
    string modeText = "";
    color modeColor = clrLime;
    
    if(buyRecoveryActive || sellRecoveryActive)
    {
        if(buyRecoveryActive && sellRecoveryActive)
            modeText = ">>> BUY & SELL BOTH RECOVERY MODE ACTIVATED <<<";
        else if(buyRecoveryActive)
            modeText = ">>> BUY RECOVERY MODE ACTIVATED <<<";
        else
            modeText = ">>> SELL RECOVERY MODE ACTIVATED <<<";
        modeColor = clrOrangeRed;
    }
    else
    {
        modeText = "=== NORMAL GRID TRADING MODE ===";
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
    string sellHeader = "======= SELL ORDERS =======";
    ObjectCreate(0, "EA_SellHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellHeader", OBJPROP_TEXT, sellHeader);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_COLOR, clrOrangeRed);
    ObjectSetInteger(0, "EA_SellHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellHeader", OBJPROP_FONT, "Arial Bold");
    sellYPos += 16;
    
    // SELL Mode
    string sellModeText = sellRecoveryActive ? ">> RECOVERY MODE <<" : "Normal Grid Mode";
    ObjectCreate(0, "EA_SellMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellMode", OBJPROP_TEXT, sellModeText);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_COLOR, sellRecoveryActive ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_SellMode", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellMode", OBJPROP_FONT, "Arial Bold");
    sellYPos += 16;
    
    // SELL Count & Lots
    string sellCountInfo = StringFormat("Orders: %d / %d | Lots: %.2f", currentSellCount, MaxSellOrders, sellTotalLots);
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
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_COLOR, sellRecoveryActive ? clrLime : clrGray);
    ObjectSetInteger(0, "EA_SellBE", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellBE", OBJPROP_FONT, "Arial");
    sellYPos += 14;
    
    // SELL Next Order
    string sellNextInfo = StringFormat("Next SELL @ %s", nextSellPrice > 0 && !sellRecoveryActive ? DoubleToString(nextSellPrice, digits) : "---");
    ObjectCreate(0, "EA_SellNext", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_SellNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_SellNext", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_SellNext", OBJPROP_YDISTANCE, sellYPos);
    ObjectSetString(0, "EA_SellNext", OBJPROP_TEXT, sellNextInfo);
    ObjectSetInteger(0, "EA_SellNext", OBJPROP_COLOR, !sellRecoveryActive ? clrCyan : clrGray);
    ObjectSetInteger(0, "EA_SellNext", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_SellNext", OBJPROP_FONT, "Arial");
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
    sellYPos += 14;
    
    // SELL Recovery Info
    if(EnableSellBERecovery && sellRecoveryActive)
    {
        int sellRecFilled = CountRecoveryPositions(POSITION_TYPE_SELL);
        string sellRecInfo = StringFormat("Recovery: %d/%d | Next @ %s", 
            sellRecFilled, MaxSellBERecoveryOrders,
            nextSellBERecoveryPrice > 0 ? DoubleToString(nextSellBERecoveryPrice, digits) : "N/A");
        ObjectCreate(0, "EA_SellRecovery", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_SellRecovery", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_SellRecovery", OBJPROP_XDISTANCE, 10);
        ObjectSetInteger(0, "EA_SellRecovery", OBJPROP_YDISTANCE, sellYPos);
        ObjectSetString(0, "EA_SellRecovery", OBJPROP_TEXT, sellRecInfo);
        ObjectSetInteger(0, "EA_SellRecovery", OBJPROP_COLOR, clrMagenta);
        ObjectSetInteger(0, "EA_SellRecovery", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_SellRecovery", OBJPROP_FONT, "Arial Bold");
    }
    else
    {
        ObjectDelete(0, "EA_SellRecovery");
    }
    
    // ===== BUY SECTION (RIGHT SIDE) =====
    int buyYPos = yPos;
    int rightX = 220; // X position for right side
    
    // BUY Header
    string buyHeader = "======= BUY ORDERS =======";
    ObjectCreate(0, "EA_BuyHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyHeader", OBJPROP_TEXT, buyHeader);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_COLOR, clrDodgerBlue);
    ObjectSetInteger(0, "EA_BuyHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyHeader", OBJPROP_FONT, "Arial Bold");
    buyYPos += 16;
    
    // BUY Mode
    string buyModeText = buyRecoveryActive ? ">> RECOVERY MODE <<" : "Normal Grid Mode";
    ObjectCreate(0, "EA_BuyMode", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyMode", OBJPROP_TEXT, buyModeText);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_COLOR, buyRecoveryActive ? clrOrangeRed : clrLime);
    ObjectSetInteger(0, "EA_BuyMode", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyMode", OBJPROP_FONT, "Arial Bold");
    buyYPos += 16;
    
    // BUY Count & Lots
    string buyCountInfo = StringFormat("Orders: %d / %d | Lots: %.2f", currentBuyCount, MaxBuyOrders, buyTotalLots);
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
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_COLOR, buyRecoveryActive ? clrLime : clrGray);
    ObjectSetInteger(0, "EA_BuyBE", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyBE", OBJPROP_FONT, "Arial");
    buyYPos += 14;
    
    // BUY Next Order
    string buyNextInfo = StringFormat("Next BUY @ %s", nextBuyPrice > 0 && !buyRecoveryActive ? DoubleToString(nextBuyPrice, digits) : "---");
    ObjectCreate(0, "EA_BuyNext", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_BuyNext", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_BuyNext", OBJPROP_XDISTANCE, rightX);
    ObjectSetInteger(0, "EA_BuyNext", OBJPROP_YDISTANCE, buyYPos);
    ObjectSetString(0, "EA_BuyNext", OBJPROP_TEXT, buyNextInfo);
    ObjectSetInteger(0, "EA_BuyNext", OBJPROP_COLOR, !buyRecoveryActive ? clrCyan : clrGray);
    ObjectSetInteger(0, "EA_BuyNext", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_BuyNext", OBJPROP_FONT, "Arial");
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
    buyYPos += 14;
    
    // BUY Recovery Info
    if(EnableBuyBERecovery && buyRecoveryActive)
    {
        int buyRecFilled = CountRecoveryPositions(POSITION_TYPE_BUY);
        string buyRecInfo = StringFormat("Recovery: %d/%d | Next @ %s", 
            buyRecFilled, MaxBuyBERecoveryOrders,
            nextBuyBERecoveryPrice > 0 ? DoubleToString(nextBuyBERecoveryPrice, digits) : "N/A");
        ObjectCreate(0, "EA_BuyRecovery", OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, "EA_BuyRecovery", OBJPROP_CORNER, CORNER_LEFT_UPPER);
        ObjectSetInteger(0, "EA_BuyRecovery", OBJPROP_XDISTANCE, rightX);
        ObjectSetInteger(0, "EA_BuyRecovery", OBJPROP_YDISTANCE, buyYPos);
        ObjectSetString(0, "EA_BuyRecovery", OBJPROP_TEXT, buyRecInfo);
        ObjectSetInteger(0, "EA_BuyRecovery", OBJPROP_COLOR, clrMagenta);
        ObjectSetInteger(0, "EA_BuyRecovery", OBJPROP_FONTSIZE, 9);
        ObjectSetString(0, "EA_BuyRecovery", OBJPROP_FONT, "Arial Bold");
    }
    else
    {
        ObjectDelete(0, "EA_BuyRecovery");
    }
    
    // Update yPos for remaining elements
    yPos = MathMax(sellYPos, buyYPos) + 10;
    yPos += 6;
    
    // ===== PRICE INFO =====
    string priceHeader = "========== CURRENT PRICE ==========";
    ObjectCreate(0, "EA_PriceHeader", OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_YDISTANCE, yPos);
    ObjectSetString(0, "EA_PriceHeader", OBJPROP_TEXT, priceHeader);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_COLOR, clrWhite);
    ObjectSetInteger(0, "EA_PriceHeader", OBJPROP_FONTSIZE, 9);
    ObjectSetString(0, "EA_PriceHeader", OBJPROP_FONT, "Arial Bold");
    yPos += 18;
    
    string priceInfo = StringFormat("Bid: %s | Ask: %s", DoubleToString(bidPrice, digits), DoubleToString(askPrice, digits));
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
