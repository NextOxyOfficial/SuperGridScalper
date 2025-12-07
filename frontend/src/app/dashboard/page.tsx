'use client';

import { useState, useEffect, useRef } from 'react';
import { useDashboard } from './context';

const POLLING_INTERVAL = 2000; // Faster polling for real-time updates

export default function DashboardHome() {
  const { user, licenses, selectedLicense, selectLicense, settings, API_URL } = useDashboard();
  
  // Trading state
  const [tradeData, setTradeData] = useState<any>(null);
  const [allTradeData, setAllTradeData] = useState<{[key: string]: any}>({});
  const [actionLogs, setActionLogs] = useState<{time: string, type: string, message: string}[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [eaConnected, setEaConnected] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Purchase state
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [mt5Account, setMt5Account] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const allLicensesPollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPlans();
    // Fetch trade data for all licenses initially
    fetchAllLicensesTradeData();
    
    // Start polling for all licenses data (only when no license is selected)
    if (!selectedLicense && licenses.length > 0) {
      allLicensesPollingRef.current = setInterval(() => {
        fetchAllLicensesTradeData();
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (allLicensesPollingRef.current) {
        clearInterval(allLicensesPollingRef.current);
      }
    };
  }, [licenses, selectedLicense]);
  
  const fetchAllLicensesTradeData = async () => {
    if (!licenses || licenses.length === 0) return;
    
    const dataMap: {[key: string]: any} = {};
    await Promise.all(licenses.map(async (lic) => {
      try {
        const res = await fetch(`${API_URL}/trade-data/?license_key=${lic.license_key}`);
        const data = await res.json();
        if (data.success && data.data) {
          dataMap[lic.license_key] = data.data;
        }
      } catch (e) {
        console.error('Failed to fetch trade data for', lic.license_key);
      }
    }));
    setAllTradeData(dataMap);
  };

  // Polling for trade data when license is selected
  useEffect(() => {
    if (!selectedLicense) return;

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
      if (data.success && data.data) {
        setTradeData(data.data);
        setLastUpdate(new Date());
        // Check if EA is connected
        if (data.data.last_update) {
          const lastUpdated = new Date(data.data.last_update);
          const now = new Date();
          const diffSeconds = Math.abs(now.getTime() - lastUpdated.getTime()) / 1000;
          console.log('EA Connection Check:', { 
            lastUpdated: lastUpdated.toISOString(), 
            now: now.toISOString(), 
            diffSeconds, 
            connected: diffSeconds < 15 
          });
          setEaConnected(diffSeconds < 15); // 15 seconds timeout
        } else {
          // If we have recent data with symbol, assume connected
          const hasRecentData = data.data.symbol && (data.data.account_balance > 0 || data.data.total_buy_positions > 0 || data.data.total_sell_positions > 0);
          console.log('EA Connection Fallback:', { hasRecentData, symbol: data.data.symbol });
          setEaConnected(hasRecentData);
        }
      } else {
        setEaConnected(false);
      }
    } catch (e) {
      console.error('Failed to fetch trade data');
      setEaConnected(false);
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

  const fetchPlans = async () => {
    try {
      console.log('Fetching plans from:', `${API_URL}/plans/`);
      const res = await fetch(`${API_URL}/plans/`);
      const data = await res.json();
      console.log('Plans response:', data);
      if (data.success) {
        setPlans(data.plans);
      } else {
        console.error('Plans fetch failed:', data);
      }
    } catch (e) {
      console.error('Failed to fetch plans:', e);
    }
  };

  const handleSelectLicense = (lic: any) => {
    selectLicense(lic);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !mt5Account.trim()) {
      setMessage({ type: 'error', text: 'Please select a plan and enter MT5 account number' });
      return;
    }
    
    setPurchasing(true);
    setMessage({ type: '', text: '' });
    
    const requestBody = {
      email: user?.email,
      password: 'existing_user',
      plan_id: selectedPlan.id,
      mt5_account: mt5Account.trim()
    };
    
    console.log('Purchase request:', requestBody);
    
    try {
      const res = await fetch(`${API_URL}/subscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await res.json();
      console.log('Purchase response:', data);
      
      if (data.success) {
        setPurchaseSuccess(data.license);
        localStorage.setItem('licenses', JSON.stringify(data.licenses));
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: data.message || 'Purchase failed' });
      }
    } catch (e) {
      console.error('Purchase error:', e);
      setMessage({ type: 'error', text: 'Connection error. Please try again.' });
    } finally {
      setPurchasing(false);
    }
  };

  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // If license selected, show dashboard with trading
  if (selectedLicense) {
    return (
      <div className="max-w-7xl mx-auto pt-5 px-4 pb-8">
        <div className="space-y-4">
          {/* Compact Header Bar */}
          <div className="bg-white rounded-lg shadow-sm px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPolling(!isPolling)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  isPolling ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
                {isPolling ? 'Live' : 'Paused'}
              </button>
              {tradeData?.trading_mode && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  tradeData.trading_mode === 'Normal' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-amber-500 text-white'
                }`}>
                  {tradeData.trading_mode}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
            <button
              onClick={() => selectedLicense && fetchTradeData(selectedLicense.license_key)}
              className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {/* EA Connection Status Banner + Trading Log */}
          <div className={`rounded-xl overflow-hidden ${eaConnected ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-gray-600 to-gray-700'}`}>
            {/* Status Header */}
            <div className="p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${eaConnected ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></div>
                  <div>
                    <p className="font-bold">{eaConnected ? 'EA Connected' : 'EA Disconnected'}</p>
                    <p className="text-sm opacity-80">
                      {eaConnected 
                        ? `${tradeData?.symbol || 'N/A'} @ ${tradeData?.current_price || '-'}`
                        : 'Waiting for EA to connect...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{tradeData?.total_pending_orders || 0}</p>
                    <p className="text-xs opacity-80">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{(tradeData?.total_buy_positions || 0) + (tradeData?.total_sell_positions || 0)}</p>
                    <p className="text-xs opacity-80">Open</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Trading Log (inside banner) */}
            <div className="bg-black/90 border-t border-white/10">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-xs font-mono">Trading Log</span>
                  <span className="text-gray-600 text-xs">|</span>
                  <span className="text-gray-500 text-xs font-mono">{tradeData?.symbol || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActionLogs([])}
                    className="text-gray-500 hover:text-red-400 text-xs font-mono px-1.5 py-0.5 hover:bg-gray-800 rounded"
                  >
                    Clear
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                </div>
              </div>
              <div 
                ref={logContainerRef}
                className="overflow-y-auto p-2 font-mono text-xs leading-relaxed"
                style={{ scrollbarWidth: 'thin', height: '220px' }}
              >
                {(() => {
                  const relevantTypes = ['OPEN', 'OPEN_BUY', 'OPEN_SELL', 'CLOSE', 'CLOSE_BUY', 'CLOSE_SELL', 
                                         'MODIFY', 'TRAILING', 'RECOVERY', 'MODE', 'GRID', 'BREAKEVEN'];
                  const filteredLogs = actionLogs
                    .filter((log: any) => relevantTypes.includes(log.type))
                    .slice(-15);
                  
                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-xs">Waiting for trading activity...</p>
                      </div>
                    );
                  }
                  
                  return filteredLogs.map((log: any, i: number) => (
                    <div key={i} className="flex gap-2 py-0.5 border-l-2 pl-2 mb-0.5" style={{
                      borderColor: 
                        log.type === 'OPEN_BUY' ? '#22c55e' :
                        log.type === 'OPEN_SELL' ? '#ef4444' :
                        log.type === 'TRAILING' ? '#f59e0b' :
                        '#374151'
                    }}>
                      <span className="text-gray-600 w-14 flex-shrink-0">{log.time}</span>
                      <span className={`w-16 flex-shrink-0 font-bold ${
                        log.type === 'OPEN_BUY' ? 'text-green-400' :
                        log.type === 'OPEN_SELL' ? 'text-red-400' :
                        log.type === 'TRAILING' ? 'text-amber-400' :
                        'text-gray-400'
                      }`}>{log.type}</span>
                      <span className="text-gray-300 flex-1 truncate">{log.message}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">Balance</p>
              <p className="text-sm font-bold text-gray-900">${tradeData?.account_balance?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">Equity</p>
              <p className="text-sm font-bold text-gray-900">${tradeData?.account_equity?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">Floating P/L</p>
              <p className={`text-sm font-bold ${(tradeData?.account_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(tradeData?.account_profit || 0) >= 0 ? '+' : ''}${tradeData?.account_profit?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">BUY</p>
              <p className="text-sm font-bold text-green-600">{tradeData?.total_buy_positions || 0} <span className="text-xs font-normal text-gray-400">({tradeData?.total_buy_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">SELL</p>
              <p className="text-sm font-bold text-red-600">{tradeData?.total_sell_positions || 0} <span className="text-xs font-normal text-gray-400">({tradeData?.total_sell_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">BUY P/L</p>
              <p className={`text-sm font-bold ${(tradeData?.total_buy_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${tradeData?.total_buy_profit?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">SELL P/L</p>
              <p className={`text-sm font-bold ${(tradeData?.total_sell_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${tradeData?.total_sell_profit?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-gray-400 text-xs">License</p>
              <p className="text-sm font-bold text-indigo-600">{getDaysRemaining(selectedLicense)}d</p>
            </div>
          </div>

          {/* Open Positions Table */}
          {tradeData && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">Open Positions</h3>
                <span className="text-xs text-gray-500">{tradeData.symbol} @ {tradeData.current_price}</span>
              </div>
              {tradeData.open_positions?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ticket</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Lots</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Open</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">SL</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">TP</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tradeData.open_positions.map((pos: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{pos.ticket}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              pos.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{pos.lots}</td>
                          <td className="px-3 py-2 text-right font-mono">{pos.open_price}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-600">{pos.sl || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono text-green-600">{pos.tp || '-'}</td>
                          <td className={`px-3 py-2 text-right font-bold ${
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
                <div className="p-4 text-center text-gray-400 text-sm">
                  No open positions
                </div>
              )}
            </div>
          )}

          {/* Pending Orders Table */}
          {tradeData && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-2 border-b flex justify-between items-center bg-amber-50">
                <h3 className="font-semibold text-amber-800 text-sm">Pending Orders</h3>
                <span className="text-xs text-amber-600">{tradeData.pending_orders?.length || 0} orders</span>
              </div>
              {tradeData.pending_orders?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Ticket</th>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Type</th>
                        <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500">Lots</th>
                        <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500">Price</th>
                        <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500">SL</th>
                        <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500">TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tradeData.pending_orders?.map((order: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5 font-mono">{order.ticket}</td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              order.type?.includes('BUY') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{order.type?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">{order.lots}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{order.price}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-red-600">{order.sl || '-'}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-green-600">{order.tp || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 text-center text-gray-400 text-sm">
                  No pending orders
                </div>
              )}
            </div>
          )}

          {/* License Info (collapsible) */}
          <details className="bg-white rounded-xl shadow-sm">
            <summary className="p-4 cursor-pointer font-bold text-gray-900 hover:bg-gray-50 rounded-xl">
              License Details
            </summary>
            <div className="px-4 pb-4 border-t">
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div>
                  <p className="text-gray-500 text-sm">License Key</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-xs bg-gray-50 p-2 rounded break-all flex-1">{selectedLicense.license_key}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLicense.license_key);
                        const btn = document.getElementById('copy-license-btn');
                        if (btn) {
                          btn.textContent = '✓ Copied';
                          setTimeout(() => btn.textContent = '📋 Copy', 1500);
                        }
                      }}
                      id="copy-license-btn"
                      className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors whitespace-nowrap"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">MT5 Account</p>
                  <p className="font-medium mt-1">{selectedLicense.mt5_account || 'Not Set'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Expires</p>
                  <p className="font-medium mt-1">
                    {selectedLicense.expires_at ? new Date(selectedLicense.expires_at).toLocaleDateString() : '-'}
                    <span className="text-gray-400 ml-2">({getDaysRemaining(selectedLicense)} days left)</span>
                  </p>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // License Selection Screen
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {user?.name || user?.email}</h2>
        <p className="text-gray-500 text-sm">Select a license to access your dashboard</p>
      </div>

      {/* Purchase New License Section - Now at top */}
      <details className="bg-white rounded-xl shadow-sm mb-6" open={licenses.length === 0}>
        <summary className="p-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50 rounded-xl flex items-center justify-between">
          <span>➕ Purchase New License</span>
          <span className="text-xs text-gray-400">Click to expand</span>
        </summary>
        <div className="px-4 pb-4 border-t">
          {purchaseSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mt-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✓</span>
              </div>
              <h4 className="text-lg font-bold text-green-800 mb-1">License Purchased!</h4>
              <p className="text-green-600 text-sm mb-3">Your new license has been created</p>
              <div className="bg-white rounded p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">License Key</p>
                <p className="font-mono text-xs text-gray-800">{purchaseSuccess.license_key}</p>
              </div>
              <button
                onClick={() => setPurchaseSuccess(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm"
              >
                Purchase Another
              </button>
            </div>
          ) : (
            <div className="pt-4">
              {plans.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">Loading plans...</p>
                  <button 
                    onClick={fetchPlans}
                    className="mt-2 text-indigo-600 text-sm hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        selectedPlan?.id === plan.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <h4 className="font-semibold text-gray-900 text-sm">{plan.name}</h4>
                      <p className="text-xl font-bold text-indigo-600">${plan.price}</p>
                      <p className="text-xs text-gray-500">{plan.duration_days} days</p>
                    </div>
                  ))}
                </div>
              )}
              
              {plans.length > 0 && (
                <>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">MT5 Account Number</label>
                    <input
                      type="text"
                      value={mt5Account}
                      onChange={(e) => setMt5Account(e.target.value)}
                      placeholder="Enter your MT5 account number"
                      className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">License will be bound to this account only</p>
                  </div>
                  
                  {message.type === 'error' && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
                      {message.text}
                    </div>
                  )}
                  
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !selectedPlan || !mt5Account.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded font-medium text-sm transition"
                  >
                    {purchasing ? 'Processing...' : `Purchase ${selectedPlan?.name || 'License'}`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </details>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">Your Licenses</h3>
          <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{licenses.length} license(s)</span>
      </div>
      
      {licenses.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-4xl mb-3">🔑</p>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Licenses Found</h3>
          <p className="text-gray-500 text-sm">Purchase a plan below to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...licenses].sort((a, b) => {
            // Check if EA is online for each license
            const aTradeData = allTradeData[a.license_key];
            const bTradeData = allTradeData[b.license_key];
            const aOnline = aTradeData && aTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(aTradeData.last_update).getTime()) / 1000) < 15;
            const bOnline = bTradeData && bTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(bTradeData.last_update).getTime()) / 1000) < 15;
            
            // Online EAs first
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            
            // Then active licenses
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            
            // Then by expiry date
            const aExpiry = new Date(a.expires_at || 0).getTime();
            const bExpiry = new Date(b.expires_at || 0).getTime();
            return bExpiry - aExpiry;
          }).map((lic, idx) => {
            const licTradeData = allTradeData[lic.license_key];
            const balance = licTradeData?.account_balance;
            const profit = licTradeData?.account_profit;
            const symbol = licTradeData?.symbol;
            const currentPrice = licTradeData?.current_price;
            const totalPositions = (licTradeData?.total_buy_positions || 0) + (licTradeData?.total_sell_positions || 0);
            const isConnected = licTradeData && licTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(licTradeData.last_update).getTime()) / 1000) < 15;
            
            return (
            <div 
              key={idx}
              onClick={() => handleSelectLicense(lic)}
              className="bg-white rounded-xl shadow-sm cursor-pointer hover:shadow-lg transition-all border border-gray-100 hover:border-indigo-400 group overflow-hidden"
            >
              {/* Header Row */}
              <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    lic.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {lic.status?.toUpperCase()}
                  </span>
                  <span className="font-bold text-gray-900">{lic.plan}</span>
                  {symbol && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                      {symbol} {currentPrice ? `@ ${currentPrice}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-800 font-semibold text-sm">
                  <span>Open Dashboard</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
              
              {/* License Key Row */}
              <div className="px-5 py-2 bg-gray-50/50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">License:</span>
                  <code className="text-xs font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {lic.license_key}
                  </code>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(lic.license_key);
                      const btn = e.currentTarget;
                      btn.textContent = '✓';
                      setTimeout(() => btn.textContent = '📋', 1500);
                    }}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-200 transition-colors"
                    title="Copy license key"
                  >
                    📋
                  </button>
                  <span className="text-xs text-gray-400 ml-2">MT5:</span>
                  <span className="text-xs font-medium text-gray-700">{lic.mt5_account || '-'}</span>
                </div>
              </div>
              
              {/* Stats Row */}
              <div className="px-5 py-4 grid grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Balance</p>
                  <p className="text-lg font-bold text-gray-900">${balance?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Floating P/L</p>
                  <p className={`text-lg font-bold ${(profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {profit !== undefined ? `${profit >= 0 ? '+' : ''}$${profit?.toFixed(2)}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Positions</p>
                  <p className="text-lg font-bold text-gray-900">{totalPositions}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className={`text-lg font-bold ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Expires</p>
                  <p className={`text-lg font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-600' : 'text-indigo-600'}`}>
                    {getDaysRemaining(lic)} days
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
