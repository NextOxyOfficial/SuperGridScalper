'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../context';

const POLLING_INTERVAL = 3000;

export default function TradingPage() {
  const router = useRouter();
  const { selectedLicense, API_URL } = useDashboard();
  const [tradeData, setTradeData] = useState<any>(null);
  const [actionLogs, setActionLogs] = useState<{time: string, type: string, message: string}[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedLicense) {
      router.push('/dashboard');
      return;
    }

    // Initial fetch
    fetchTradeData(selectedLicense.license_key);
    
    // Start polling
    pollingRef.current = setInterval(() => {
      if (isPolling) {
        fetchTradeData(selectedLicense.license_key);
      }
    }, POLLING_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [selectedLicense, isPolling]);

  const fetchTradeData = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/trade-data/?license_key=${licenseKey}`);
      const data = await res.json();
      if (data.success) {
        setTradeData(data.data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch trade data');
    }
    fetchActionLogs(licenseKey);
  };

  const fetchActionLogs = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/action-logs/?license_key=${licenseKey}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setActionLogs(data.logs);
        setTimeout(() => {
          if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
          }
        }, 50);
      }
    } catch (e) {
      console.error('Failed to fetch action logs');
    }
  };

  if (!selectedLicense) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8">
      <div className="space-y-6">
        {/* Polling Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-4 py-2 rounded-lg font-medium ${
                isPolling ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isPolling ? '● Live' : '○ Paused'}
            </button>
            {lastUpdate && (
              <span className="text-sm text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            onClick={() => selectedLicense && fetchTradeData(selectedLicense.license_key)}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
          >
            ↻ Refresh
          </button>
        </div>

        {tradeData ? (
          <>
            {/* Account Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Balance</p>
                <p className="text-xl font-bold text-gray-900">${tradeData.account_balance?.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Equity</p>
                <p className="text-xl font-bold text-gray-900">${tradeData.account_equity?.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Floating P/L</p>
                <p className={`text-xl font-bold ${tradeData.account_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tradeData.account_profit >= 0 ? '+' : ''}${tradeData.account_profit?.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Buy Positions</p>
                <p className="text-xl font-bold text-green-600">{tradeData.total_buy_positions || 0}</p>
                <p className="text-xs text-gray-400">{tradeData.total_buy_lots?.toFixed(2)} lots</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Sell Positions</p>
                <p className="text-xl font-bold text-red-600">{tradeData.total_sell_positions || 0}</p>
                <p className="text-xs text-gray-400">{tradeData.total_sell_lots?.toFixed(2)} lots</p>
              </div>
            </div>

            {/* Open Positions */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Open Positions</h3>
                <span className="text-sm text-gray-500">{tradeData.symbol} @ {tradeData.current_price}</span>
              </div>
              {tradeData.open_positions?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ticket</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Lots</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Open Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">SL</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">TP</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tradeData.open_positions.map((pos: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">{pos.ticket}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              pos.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{pos.lots}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono">{pos.open_price}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-red-600">{pos.sl || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-green-600">{pos.tp || '-'}</td>
                          <td className={`px-4 py-3 text-sm text-right font-bold ${
                            pos.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {pos.profit >= 0 ? '+' : ''}{pos.profit?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-2xl mb-2">📭</p>
                  <p>No open positions</p>
                </div>
              )}
            </div>

            {/* EA Trading Log Terminal */}
            <div className="bg-black rounded-xl shadow-lg overflow-hidden border border-gray-800">
              <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-green-400 text-sm font-mono">EA Trading Log</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                  <span className="text-gray-500 text-xs font-mono">{isPolling ? 'LIVE' : 'PAUSED'}</span>
                </div>
              </div>
              <div 
                ref={logContainerRef}
                className="h-72 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
                style={{ scrollbarWidth: 'thin', background: '#0a0a0a' }}
              >
                {actionLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-green-500 mb-1">Waiting for EA connection...</p>
                    <p className="text-gray-700 text-xs">Trading logs will appear when EA starts</p>
                  </div>
                ) : (
                  actionLogs.map((log: any, i: number) => (
                    <div key={i} className="flex gap-2 py-0.5 hover:bg-gray-900/50 border-l-2 pl-2 mb-0.5" style={{
                      borderColor: 
                        log.type === 'CONNECT' ? '#22c55e' :
                        log.type === 'DISCONNECT' ? '#ef4444' :
                        log.type === 'MODE' ? '#8b5cf6' :
                        log.type === 'OPEN_BUY' ? '#22c55e' :
                        log.type === 'OPEN_SELL' ? '#ef4444' :
                        log.type === 'CLOSE_BUY' ? '#86efac' :
                        log.type === 'CLOSE_SELL' ? '#fca5a5' :
                        log.type === 'TRAILING' ? '#f59e0b' :
                        log.type === 'BREAKEVEN' ? '#06b6d4' :
                        log.type === 'RECOVERY' ? '#a855f7' :
                        log.type === 'GRID' ? '#3b82f6' :
                        log.type === 'SIGNAL' ? '#eab308' :
                        log.type === 'ERROR' ? '#dc2626' :
                        log.type === 'WARNING' ? '#f97316' :
                        '#374151'
                    }}>
                      <span className="text-gray-600 select-none w-16 flex-shrink-0">{log.time}</span>
                      <span className={`w-20 flex-shrink-0 font-bold ${
                        log.type === 'CONNECT' ? 'text-green-400' :
                        log.type === 'DISCONNECT' ? 'text-red-400' :
                        log.type === 'MODE' ? 'text-purple-400' :
                        log.type === 'OPEN_BUY' ? 'text-green-400' :
                        log.type === 'OPEN_SELL' ? 'text-red-400' :
                        log.type === 'CLOSE_BUY' ? 'text-green-300' :
                        log.type === 'CLOSE_SELL' ? 'text-red-300' :
                        log.type === 'TRAILING' ? 'text-amber-400' :
                        log.type === 'BREAKEVEN' ? 'text-cyan-400' :
                        log.type === 'RECOVERY' ? 'text-purple-400' :
                        log.type === 'GRID' ? 'text-blue-400' :
                        log.type === 'SIGNAL' ? 'text-yellow-400' :
                        log.type === 'ERROR' ? 'text-red-500' :
                        log.type === 'WARNING' ? 'text-orange-400' :
                        'text-gray-400'
                      }`}>
                        {log.type}
                      </span>
                      <span className="text-gray-300 flex-1">{log.message}</span>
                    </div>
                  ))
                )}
                <div className="text-green-500 animate-pulse mt-1">_</div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-gray-500">Start the EA to see trade data</p>
          </div>
        )}
      </div>
    </div>
  );
}
