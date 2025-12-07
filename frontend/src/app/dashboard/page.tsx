'use client';

import { useState, useEffect, useRef } from 'react';
import { useDashboard } from './context';

const POLLING_INTERVAL = 3000;

export default function DashboardHome() {
  const { user, licenses, selectedLicense, selectLicense, settings, API_URL } = useDashboard();
  
  // Trading state
  const [tradeData, setTradeData] = useState<any>(null);
  const [actionLogs, setActionLogs] = useState<{time: string, type: string, message: string}[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Purchase state
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [mt5Account, setMt5Account] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchPlans();
  }, []);

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

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/plans/`);
      const data = await res.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (e) {
      console.error('Failed to fetch plans');
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
    
    try {
      const res = await fetch(`${API_URL}/subscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          password: 'existing_user',
          plan_id: selectedPlan.id,
          mt5_account: mt5Account.trim()
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setPurchaseSuccess(data.license);
        localStorage.setItem('licenses', JSON.stringify(data.licenses));
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: data.message || 'Purchase failed' });
      }
    } catch (e) {
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
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="space-y-6">
          {/* Live Status Bar */}
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

          {/* Account Stats - Show trade data if available, otherwise license info */}
          {tradeData ? (
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
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Status</p>
                <p className={`text-xl font-bold ${selectedLicense.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedLicense.status?.toUpperCase()}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Days Remaining</p>
                <p className="text-xl font-bold text-gray-900">{getDaysRemaining(selectedLicense)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">Plan</p>
                <p className="text-xl font-bold text-indigo-600">{selectedLicense.plan}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs">MT5 Account</p>
                <p className="text-xl font-bold text-gray-900">{selectedLicense.mt5_account || 'Not Set'}</p>
              </div>
            </div>
          )}

          {/* Open Positions Table */}
          {tradeData && (
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
          )}

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
              className="h-64 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
              style={{ scrollbarWidth: 'thin', background: '#0a0a0a' }}
            >
              {actionLogs.length === 0 ? (
                <div className="text-center py-8">
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

          {/* License Info (collapsible) */}
          <details className="bg-white rounded-xl shadow-sm">
            <summary className="p-4 cursor-pointer font-bold text-gray-900 hover:bg-gray-50 rounded-xl">
              License Details
            </summary>
            <div className="px-4 pb-4 border-t">
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div>
                  <p className="text-gray-500 text-sm">License Key</p>
                  <p className="font-mono text-xs bg-gray-50 p-2 rounded mt-1 break-all">{selectedLicense.license_key}</p>
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
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.name || user?.email}</h2>
        <p className="text-gray-500">Select a license to access your dashboard</p>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">Your Licenses</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{licenses.length} license(s)</span>
      </div>
      
      {licenses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-5xl mb-4">🔑</p>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Licenses Found</h3>
          <p className="text-gray-500 mb-6">Purchase a plan below to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {licenses.map((lic, idx) => (
            <div 
              key={idx}
              onClick={() => handleSelectLicense(lic)}
              className="bg-white rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-indigo-500 group"
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      lic.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {lic.status?.toUpperCase()}
                    </span>
                    <span className="text-lg font-bold text-gray-900">{lic.plan}</span>
                  </div>
                  
                  <p className="font-mono text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg mb-3 truncate">
                    {lic.license_key}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">MT5 Account</p>
                      <p className="font-medium text-gray-700">{lic.mt5_account || 'Not Set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Days Left</p>
                      <p className={`font-medium ${getDaysRemaining(lic) <= 7 ? 'text-orange-600' : 'text-gray-700'}`}>
                        {getDaysRemaining(lic)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Expires</p>
                      <p className="font-medium text-gray-700">
                        {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {lic.ea_settings && (
                    <div className="text-right bg-indigo-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-indigo-600">Investment</p>
                      <p className="text-xl font-bold text-indigo-700">${lic.ea_settings.investment_amount}</p>
                      <p className="text-xs text-indigo-500">Lot: {lic.ea_settings.lot_size}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-800 font-medium">
                    Open Dashboard
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Purchase New License Section */}
      <div className="mt-12 border-t pt-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Purchase New License</h3>
        
        {purchaseSuccess ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h4 className="text-xl font-bold text-green-800 mb-2">License Purchased!</h4>
            <p className="text-green-600 mb-4">Your new license has been created</p>
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">License Key</p>
              <p className="font-mono text-sm text-gray-800">{purchaseSuccess.license_key}</p>
            </div>
            <button
              onClick={() => setPurchaseSuccess(null)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
            >
              Purchase Another
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <h4 className="font-bold text-gray-900">{plan.name}</h4>
                  <p className="text-2xl font-bold text-indigo-600">${plan.price}</p>
                  <p className="text-sm text-gray-500">{plan.duration_days} days</p>
                </div>
              ))}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">MT5 Account Number</label>
              <input
                type="text"
                value={mt5Account}
                onChange={(e) => setMt5Account(e.target.value)}
                placeholder="Enter your MT5 account number"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">License will be bound to this account only</p>
            </div>
            
            {message.type === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {message.text}
              </div>
            )}
            
            <button
              onClick={handlePurchase}
              disabled={purchasing || !selectedPlan}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition"
            >
              {purchasing ? 'Processing...' : `Purchase ${selectedPlan?.name || 'License'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
