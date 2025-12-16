//+------------------------------------------------------------------+
//|                                          TradeCommandHandler.mqh |
//|                     Backend Trade Command Execution System       |
//+------------------------------------------------------------------+
#property copyright "Mark's Trades"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| Trade Command Handler Class                                      |
//+------------------------------------------------------------------+
class CTradeCommandHandler
{
private:
    string m_LicenseKey;
    string m_ServerURL;
    datetime m_LastCommandCheck;
    int m_CheckIntervalSeconds;
    
public:
    CTradeCommandHandler(string licenseKey, string serverURL = "https://markstrades.com")
    {
        m_LicenseKey = licenseKey;
        m_ServerURL = serverURL;
        m_LastCommandCheck = 0;
        m_CheckIntervalSeconds = 10; // Check every 10 seconds
    }
    
    //+------------------------------------------------------------------+
    //| Check and execute pending commands                               |
    //+------------------------------------------------------------------+
    void CheckAndExecuteCommands()
    {
        // Only check at specified interval
        if(TimeCurrent() - m_LastCommandCheck < m_CheckIntervalSeconds)
            return;
        
        m_LastCommandCheck = TimeCurrent();
        
        // Get pending commands from server
        string commands = GetPendingCommands();
        if(commands == "")
            return;
        
        // Parse and execute commands
        ExecuteCommands(commands);
    }
    
    //+------------------------------------------------------------------+
    //| Get pending commands from server                                 |
    //+------------------------------------------------------------------+
    string GetPendingCommands()
    {
        string url = m_ServerURL + "/api/trade-commands/pending/?license_key=" + m_LicenseKey;
        
        char post[], result[];
        string headers = "Content-Type: application/json\r\n";
        
        int timeout = 5000;
        int res = WebRequest("GET", url, headers, timeout, post, result, headers);
        
        if(res == -1)
        {
            int error = GetLastError();
            Print("WebRequest error: ", error);
            return "";
        }
        
        return CharArrayToString(result);
    }
    
    //+------------------------------------------------------------------+
    //| Execute commands from JSON response                              |
    //+------------------------------------------------------------------+
    void ExecuteCommands(string jsonResponse)
    {
        // Simple JSON parsing (you may need a proper JSON library for complex cases)
        // This is a basic implementation
        
        if(StringFind(jsonResponse, "\"success\":true") == -1)
            return;
        
        if(StringFind(jsonResponse, "\"commands\":[]") != -1)
            return; // No commands
        
        // Extract commands array (basic parsing)
        int commandsStart = StringFind(jsonResponse, "\"commands\":[");
        if(commandsStart == -1)
            return;
        
        // Parse each command
        // For production, use a proper JSON parser
        // This is a simplified version
        
        Print("Pending commands found, executing...");
    }
    
    //+------------------------------------------------------------------+
    //| Close single position by ticket                                  |
    //+------------------------------------------------------------------+
    bool ClosePosition(ulong ticket, int commandId)
    {
        if(!PositionSelectByTicket(ticket))
        {
            UpdateCommandStatus(commandId, "failed", "Position not found");
            return false;
        }
        
        CTrade trade;
        bool result = trade.PositionClose(ticket);
        
        if(result)
        {
            UpdateCommandStatus(commandId, "executed", 
                StringFormat("Position %I64u closed successfully", ticket));
            Print("✅ Position closed: ", ticket);
        }
        else
        {
            UpdateCommandStatus(commandId, "failed", 
                StringFormat("Failed to close position %I64u: %s", ticket, trade.ResultRetcodeDescription()));
            Print("❌ Failed to close position: ", ticket);
        }
        
        return result;
    }
    
    //+------------------------------------------------------------------+
    //| Close multiple positions                                         |
    //+------------------------------------------------------------------+
    int CloseBulkPositions(ulong &tickets[], int commandId)
    {
        int closedCount = 0;
        int failedCount = 0;
        string closedTickets = "";
        string failedTickets = "";
        
        CTrade trade;
        
        for(int i = 0; i < ArraySize(tickets); i++)
        {
            if(PositionSelectByTicket(tickets[i]))
            {
                if(trade.PositionClose(tickets[i]))
                {
                    closedCount++;
                    closedTickets += IntegerToString(tickets[i]) + ",";
                }
                else
                {
                    failedCount++;
                    failedTickets += IntegerToString(tickets[i]) + ",";
                }
            }
            else
            {
                failedCount++;
                failedTickets += IntegerToString(tickets[i]) + ",";
            }
        }
        
        string resultMsg = StringFormat("Closed: %d, Failed: %d", closedCount, failedCount);
        UpdateCommandStatus(commandId, closedCount > 0 ? "executed" : "failed", resultMsg);
        
        Print("Bulk close result: ", resultMsg);
        return closedCount;
    }
    
    //+------------------------------------------------------------------+
    //| Close all BUY positions                                          |
    //+------------------------------------------------------------------+
    int CloseAllBuyPositions(int commandId, int magicNumber = 0)
    {
        int closedCount = 0;
        CTrade trade;
        
        for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0)
            {
                if(PositionGetString(POSITION_SYMBOL) == _Symbol)
                {
                    if(magicNumber == 0 || PositionGetInteger(POSITION_MAGIC) == magicNumber)
                    {
                        if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                        {
                            if(trade.PositionClose(ticket))
                                closedCount++;
                        }
                    }
                }
            }
        }
        
        string resultMsg = StringFormat("Closed %d BUY positions", closedCount);
        UpdateCommandStatus(commandId, "executed", resultMsg);
        Print(resultMsg);
        
        return closedCount;
    }
    
    //+------------------------------------------------------------------+
    //| Close all SELL positions                                         |
    //+------------------------------------------------------------------+
    int CloseAllSellPositions(int commandId, int magicNumber = 0)
    {
        int closedCount = 0;
        CTrade trade;
        
        for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0)
            {
                if(PositionGetString(POSITION_SYMBOL) == _Symbol)
                {
                    if(magicNumber == 0 || PositionGetInteger(POSITION_MAGIC) == magicNumber)
                    {
                        if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
                        {
                            if(trade.PositionClose(ticket))
                                closedCount++;
                        }
                    }
                }
            }
        }
        
        string resultMsg = StringFormat("Closed %d SELL positions", closedCount);
        UpdateCommandStatus(commandId, "executed", resultMsg);
        Print(resultMsg);
        
        return closedCount;
    }
    
    //+------------------------------------------------------------------+
    //| Close all positions                                              |
    //+------------------------------------------------------------------+
    int CloseAllPositions(int commandId, int magicNumber = 0)
    {
        int closedCount = 0;
        CTrade trade;
        
        for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0)
            {
                if(PositionGetString(POSITION_SYMBOL) == _Symbol)
                {
                    if(magicNumber == 0 || PositionGetInteger(POSITION_MAGIC) == magicNumber)
                    {
                        if(trade.PositionClose(ticket))
                            closedCount++;
                    }
                }
            }
        }
        
        string resultMsg = StringFormat("Closed %d positions", closedCount);
        UpdateCommandStatus(commandId, "executed", resultMsg);
        Print(resultMsg);
        
        return closedCount;
    }
    
    //+------------------------------------------------------------------+
    //| Update command status on server                                  |
    //+------------------------------------------------------------------+
    void UpdateCommandStatus(int commandId, string status, string resultMessage)
    {
        string url = m_ServerURL + "/api/trade-commands/update-status/";
        
        string jsonData = StringFormat(
            "{\"license_key\":\"%s\",\"command_id\":%d,\"status\":\"%s\",\"result_message\":\"%s\"}",
            m_LicenseKey, commandId, status, resultMessage
        );
        
        char post[], result[];
        StringToCharArray(jsonData, post, 0, StringLen(jsonData));
        
        string headers = "Content-Type: application/json\r\n";
        int timeout = 5000;
        
        int res = WebRequest("POST", url, headers, timeout, post, result, headers);
        
        if(res == -1)
        {
            Print("Failed to update command status: ", GetLastError());
        }
    }
};

//+------------------------------------------------------------------+
//| Global instance (optional)                                        |
//+------------------------------------------------------------------+
CTradeCommandHandler *g_CommandHandler = NULL;

//+------------------------------------------------------------------+
//| Initialize command handler                                        |
//+------------------------------------------------------------------+
void InitTradeCommandHandler(string licenseKey, string serverURL = "https://markstrades.com")
{
    if(g_CommandHandler != NULL)
        delete g_CommandHandler;
    
    g_CommandHandler = new CTradeCommandHandler(licenseKey, serverURL);
    Print("Trade Command Handler initialized");
}

//+------------------------------------------------------------------+
//| Cleanup command handler                                           |
//+------------------------------------------------------------------+
void DeinitTradeCommandHandler()
{
    if(g_CommandHandler != NULL)
    {
        delete g_CommandHandler;
        g_CommandHandler = NULL;
    }
}

//+------------------------------------------------------------------+
//| Check for commands (call from OnTick)                            |
//+------------------------------------------------------------------+
void CheckTradeCommands()
{
    if(g_CommandHandler != NULL)
        g_CommandHandler.CheckAndExecuteCommands();
}
