'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
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
  
  // Positions tab state
  const [positionsTab, setPositionsTab] = useState<'open' | 'closed'>('open');
  const closedPositionsRef = useRef<HTMLDivElement>(null);

  const allLicensesPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Scroll closed positions to bottom when tab changes or data updates
  useEffect(() => {
    if (positionsTab === 'closed' && closedPositionsRef.current) {
      closedPositionsRef.current.scrollTop = closedPositionsRef.current.scrollHeight;
    }
  }, [positionsTab, tradeData?.closed_positions]);

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
    const isRecoveryModeDetails = tradeData?.trading_mode?.toLowerCase().includes('recovery');
    return (
      <div className="max-w-7xl mx-auto pt-3 sm:pt-5 px-2 sm:px-4 pb-6 sm:pb-8">
        <div className="space-y-3 sm:space-y-4">
          {/* Compact Header Bar */}
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg px-2 sm:px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setIsPolling(!isPolling)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium ${
                  isPolling ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-400'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-black animate-pulse' : 'bg-gray-500'}`}></span>
                {isPolling ? 'LIVE' : 'PAUSED'}
              </button>
              {tradeData?.trading_mode && (
                <span className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium border ${
                  isRecoveryModeDetails 
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <svg 
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                    style={{ animation: isRecoveryModeDetails ? 'spin 0.5s linear infinite' : 'spin 3s linear infinite' }}
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <circle cx="12" cy="4" r="2" fill="currentColor" />
                  </svg>
                  {tradeData?.trading_mode || 'Normal'}
                </span>
              )}
              <span className="text-[10px] sm:text-xs text-gray-500">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
          </div>

          {/* EA Connection Status Banner + Trading Log */}
          <div className={`rounded-xl overflow-hidden border ${eaConnected ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 border-cyan-500/30' : 'bg-[#12121a] border-gray-700'}`}>
            {/* Status Header */}
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${eaConnected ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-gray-600'}`}></div>
                  <div>
                    <p className="font-bold text-white text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{eaConnected ? 'AI CONNECTED' : 'AI DISCONNECTED'}</p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {eaConnected 
                        ? `${tradeData?.symbol || 'N/A'} @ ${tradeData?.current_price || '-'}`
                        : 'Waiting for AI...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{tradeData?.total_pending_orders || 0}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{(tradeData?.total_buy_positions || 0) + (tradeData?.total_sell_positions || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Open</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Trading Log (inside banner) */}
            <div className="bg-[#0a0a0f] border-t border-cyan-500/10">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-cyan-500/10">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 text-xs" style={{ fontFamily: 'Orbitron, sans-serif' }}>TRADING LOG</span>
                  <span className="text-gray-700 text-xs">|</span>
                  <span className="text-yellow-400 text-xs font-mono">{tradeData?.symbol || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActionLogs([])}
                    className="text-gray-600 hover:text-red-400 text-xs font-mono px-1.5 py-0.5 hover:bg-gray-800 rounded"
                  >
                    Clear
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></span>
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
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Balance</p>
              <p className="text-xs sm:text-sm font-bold text-white">${tradeData?.account_balance?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Equity</p>
              <p className="text-xs sm:text-sm font-bold text-white">${tradeData?.account_equity?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.account_profit || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {(tradeData?.account_profit || 0) >= 0 ? '+' : ''}${tradeData?.account_profit?.toFixed(0) || '0'}
              </p>
            </div>
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Expires</p>
              <p className="text-xs sm:text-sm font-bold text-yellow-400">{getDaysRemaining(selectedLicense)}d</p>
            </div>
          </div>
          {/* Second Stats Row - Desktop only or collapsible */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">BUY</p>
              <p className="text-xs sm:text-sm font-bold text-green-400">{tradeData?.total_buy_positions || 0} <span className="text-[10px] sm:text-xs font-normal text-gray-600">({tradeData?.total_buy_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">SELL</p>
              <p className="text-xs sm:text-sm font-bold text-red-400">{tradeData?.total_sell_positions || 0} <span className="text-[10px] sm:text-xs font-normal text-gray-600">({tradeData?.total_sell_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">BUY P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.total_buy_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradeData?.total_buy_profit?.toFixed(0) || '0'}
              </p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">SELL P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.total_sell_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradeData?.total_sell_profit?.toFixed(0) || '0'}
              </p>
            </div>
          </div>

          {/* Positions Tabs (Open & Closed) */}
          {tradeData && (
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b border-cyan-500/10">
                <button
                  onClick={() => setPositionsTab('open')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all ${
                    positionsTab === 'open'
                      ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  OPEN POSITIONS
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    positionsTab === 'open' ? 'bg-cyan-500/30' : 'bg-gray-700'
                  }`}>
                    {tradeData.open_positions?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => setPositionsTab('closed')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all ${
                    positionsTab === 'closed'
                      ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  CLOSED
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    positionsTab === 'closed' ? 'bg-purple-500/30' : 'bg-gray-700'
                  }`}>
                    {tradeData.closed_positions?.length || 0}
                  </span>
                </button>
              </div>

              {/* Open Positions Tab Content */}
              {positionsTab === 'open' && (
                <>
                  <div className="p-2 border-b border-cyan-500/10 flex justify-end">
                    <span className="text-[10px] sm:text-xs text-cyan-400">{tradeData.symbol} @ {tradeData.current_price}</span>
                  </div>
                  {tradeData.open_positions?.length > 0 ? (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-[10px] sm:text-sm">
                        <thead className="bg-[#0a0a0f] sticky top-0">
                          <tr>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Open</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">SL</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">TP</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {tradeData.open_positions.map((pos: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono text-[10px] sm:text-xs text-gray-400">{pos.ticket}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-yellow-400 font-medium">{pos.symbol || tradeData.symbol}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2">
                                <span className={`px-1 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                                  pos.type === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {pos.type}
                                </span>
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">{pos.lots}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300">{pos.open_price}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-red-400 hidden sm:table-cell">{pos.sl || '-'}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-green-400 hidden sm:table-cell">{pos.tp || '-'}</td>
                              <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-bold ${
                                pos.profit >= 0 ? 'text-cyan-400' : 'text-red-400'
                              }`}>
                                {pos.profit >= 0 ? '+' : ''}{pos.profit?.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
                      No open positions
                    </div>
                  )}
                </>
              )}

              {/* Closed Positions Tab Content */}
              {positionsTab === 'closed' && (
                <>
                  {tradeData.closed_positions?.length > 0 ? (
                    <div ref={closedPositionsRef} className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-[10px] sm:text-sm">
                        <thead className="bg-[#0a0a0f] sticky top-0 z-10">
                          <tr>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">Open</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">Close</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Profit</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden md:table-cell">Close Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {tradeData.closed_positions.slice(0, 100).map((pos: any, idx: number) => (
                            <tr key={pos.ticket || idx} className="hover:bg-white/5">
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono text-[10px] sm:text-xs text-gray-400">{pos.ticket}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-yellow-400 font-medium">{pos.symbol || '-'}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2">
                                <span className={`px-1 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                                  pos.type?.toLowerCase().includes('buy') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {pos.type}
                                </span>
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">{pos.lots?.toFixed(2)}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300 hidden sm:table-cell">{pos.open_price?.toFixed(2)}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300 hidden sm:table-cell">{pos.close_price?.toFixed(2)}</td>
                              <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-bold ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.profit >= 0 ? '+' : ''}${pos.profit?.toFixed(2)}
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-500 hidden md:table-cell text-[10px]">{pos.close_time || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {tradeData.closed_positions.length > 100 && (
                        <div className="p-2 text-center text-purple-400/70 text-xs border-t border-purple-500/10">
                          Showing 100 of {tradeData.closed_positions.length} closed positions
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
                      No closed positions yet
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Pending Orders Table */}
          {tradeData && (
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-lg overflow-hidden">
              <div className="p-2 border-b border-yellow-500/10 flex justify-between items-center">
                <h3 className="font-semibold text-yellow-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>PENDING ORDERS</h3>
                <span className="text-[10px] sm:text-xs text-yellow-400/70">{tradeData.pending_orders?.length || 0} orders</span>
              </div>
              {tradeData.pending_orders?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead className="bg-[#0a0a0f]">
                      <tr>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">Price</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">SL</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {tradeData.pending_orders?.map((order: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 font-mono text-gray-400">{order.ticket}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-[10px] sm:text-xs text-yellow-400 font-medium">{order.symbol || tradeData.symbol}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5">
                            <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                              order.type?.includes('BUY') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className="hidden sm:inline">{order.type?.replace('_', ' ')}</span>
                              <span className="sm:hidden">{order.type?.includes('BUY') ? 'BUY' : 'SELL'}</span>
                            </span>
                          </td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-gray-300">{order.lots}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-gray-300">{order.price}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-red-400 hidden sm:table-cell">{order.sl || '-'}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-green-400">{order.tp || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-2 sm:p-3 text-center text-gray-500 text-xs sm:text-sm">
                  No pending orders
                </div>
              )}
            </div>
          )}

          {/* License Info (collapsible) */}
          <details className="bg-[#12121a] border border-cyan-500/20 rounded-xl overflow-hidden">
            <summary className="p-3 sm:p-4 cursor-pointer font-bold text-white hover:bg-white/5 rounded-xl text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              ▼ LICENSE DETAILS
            </summary>
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-cyan-500/10">
              <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
                {/* License Key */}
                <div>
                  <p className="text-gray-500 text-[10px] sm:text-xs mb-1.5">License Key</p>
                  <div className="flex items-start sm:items-center gap-2">
                    <p className="font-mono text-[10px] sm:text-xs bg-[#0a0a0f] text-cyan-400 p-2 sm:p-2.5 rounded-lg border border-cyan-500/20 break-all flex-1 leading-relaxed">{selectedLicense.license_key}</p>
                    <button
                      onClick={(e) => {
                        navigator.clipboard.writeText(selectedLicense.license_key);
                        const btn = e.currentTarget;
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 1500);
                      }}
                      className="group flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-2.5 py-1.5 sm:py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all whitespace-nowrap border border-cyan-500/30 [&.copied]:bg-green-500/20 [&.copied]:text-green-400 [&.copied]:border-green-500/30"
                    >
                      <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-[.copied]:hidden" />
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden group-[.copied]:block" />
                      <span className="group-[.copied]:hidden">Copy</span>
                      <span className="hidden group-[.copied]:inline">Copied</span>
                    </button>
                  </div>
                </div>
                
                {/* MT5 Account & Expires - Side by side */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-[#0a0a0f]/50 rounded-lg p-2.5 sm:p-3 border border-cyan-500/10">
                    <p className="text-gray-500 text-[10px] sm:text-xs mb-1">MT5 Account</p>
                    <p className="font-semibold text-white text-sm sm:text-base">{selectedLicense.mt5_account || 'Not Set'}</p>
                  </div>
                  <div className={`bg-[#0a0a0f]/50 rounded-lg p-2.5 sm:p-3 border ${getDaysRemaining(selectedLicense) <= 0 ? 'border-red-500/30' : getDaysRemaining(selectedLicense) <= 3 ? 'border-yellow-500/30' : 'border-cyan-500/10'}`}>
                    <p className="text-gray-500 text-[10px] sm:text-xs mb-1">Expires</p>
                    <p className="font-semibold text-white text-sm sm:text-base">
                      {selectedLicense.expires_at ? new Date(selectedLicense.expires_at).toLocaleDateString() : '-'}
                    </p>
                    <p className={`text-[10px] sm:text-xs mt-0.5 ${getDaysRemaining(selectedLicense) <= 0 ? 'text-red-400' : getDaysRemaining(selectedLicense) <= 3 ? 'text-yellow-400' : 'text-yellow-400'}`}>
                      {getDaysRemaining(selectedLicense) <= 0 ? 'Expired!' : `(${getDaysRemaining(selectedLicense)} days left)`}
                    </p>
                  </div>
                </div>
                
                {/* Extend Subscription - Show when expired or about to expire */}
                {getDaysRemaining(selectedLicense) <= 3 && (
                  <div className={`rounded-lg p-3 sm:p-4 border ${getDaysRemaining(selectedLicense) <= 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className={`font-semibold text-sm sm:text-base ${getDaysRemaining(selectedLicense) <= 0 ? 'text-red-400' : 'text-yellow-400'}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                          {getDaysRemaining(selectedLicense) <= 0 ? '⚠️ License Expired!' : '⏰ License Expiring Soon!'}
                        </p>
                        <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
                          {getDaysRemaining(selectedLicense) <= 0 
                            ? 'Your license has expired. Extend now to continue trading.' 
                            : `Only ${getDaysRemaining(selectedLicense)} day(s) remaining. Extend to avoid interruption.`}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          selectLicense(null);
                          // Scroll to purchase section
                          setTimeout(() => {
                            const details = document.querySelector('details');
                            if (details) {
                              details.open = true;
                              details.scrollIntoView({ behavior: 'smooth' });
                            }
                          }, 100);
                        }}
                        className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                          getDaysRemaining(selectedLicense) <= 0 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white shadow-lg shadow-red-500/20' 
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-lg shadow-yellow-500/20'
                        }`}
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        <span>🔄</span>
                        EXTEND LICENSE
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // License Selection Screen
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Welcome,</h2>
        <h2 className="text-sm sm:text-xl font-bold text-cyan-400 mb-1 break-all px-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{user?.name || user?.email}</h2>
        <p className="text-gray-500 text-xs sm:text-sm">Select a license to access your AI trading dashboard</p>
      </div>

      {/* Purchase New License Section - Now at top */}
      <details className="bg-[#12121a] border border-cyan-500/20 rounded-xl mb-4 sm:mb-6 overflow-hidden" open={licenses.length === 0}>
        <summary className="p-3 sm:p-4 cursor-pointer font-semibold text-white hover:bg-white/5 rounded-xl flex items-center justify-between gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-lg">+</span>
            <span className="text-xs sm:text-sm">PURCHASE NEW LICENSE</span>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Click to expand</span>
        </summary>
        <div className="px-3 sm:px-4 pb-4 border-t border-cyan-500/10">
          {purchaseSuccess ? (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center mt-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-cyan-400">✓</span>
              </div>
              <h4 className="text-lg font-bold text-cyan-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>License Activated!</h4>
              <p className="text-gray-400 text-sm mb-3">Your new AI license has been created</p>
              <div className="bg-[#0a0a0f] rounded p-3 mb-3 border border-cyan-500/20">
                <p className="text-xs text-gray-500 mb-1">License Key</p>
                <p className="font-mono text-xs text-cyan-400">{purchaseSuccess.license_key}</p>
              </div>
              <button
                onClick={() => setPurchaseSuccess(null)}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-1.5 rounded text-sm font-bold"
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
                    className="mt-2 text-cyan-400 text-sm hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        selectedPlan?.id === plan.id
                          ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                          : 'border-gray-700 hover:border-cyan-500/50 bg-[#0a0a0f]'
                      }`}
                    >
                      <h4 className="font-semibold text-white text-[10px] sm:text-sm truncate" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h4>
                      <p className="text-sm sm:text-xl font-bold text-cyan-400 my-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plan.price}</p>
                      <p className="text-[9px] sm:text-xs text-gray-500">{plan.duration_days} days</p>
                    </div>
                  ))}
                </div>
              )}
              
              {plans.length > 0 && (
                <>
                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">MT5 Account Number</label>
                    <input
                      type="text"
                      value={mt5Account}
                      onChange={(e) => setMt5Account(e.target.value)}
                      placeholder="Enter MT5 account"
                      className="w-full px-3 py-2 sm:py-2.5 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs sm:text-sm text-white placeholder-gray-600"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">License will be bound to this account only</p>
                  </div>
                  
                  {message.type === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs sm:text-sm mb-3">
                      {message.text}
                    </div>
                  )}
                  
                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !selectedPlan || !mt5Account.trim()}
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {purchasing ? 'PROCESSING...' : `ACTIVATE ${selectedPlan?.name || 'LICENSE'}`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </details>
      
      <div className="flex justify-between items-center mb-3 mt-10 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm sm:text-lg font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>YOUR LICENSES</h3>
          <span className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-cyan-400 bg-cyan-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-cyan-500/30">
            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>
        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">{licenses.length} license(s)</span>
      </div>
      
      {licenses.length === 0 ? (
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4 sm:p-8 text-center">
          <p className="text-2xl sm:text-4xl mb-2 sm:mb-3">🔑</p>
          <h3 className="text-sm sm:text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>No Licenses Found</h3>
          <p className="text-gray-500 text-xs sm:text-sm">Purchase a plan above to get started.</p>
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
            const tradingMode = licTradeData?.trading_mode || 'Normal';
            const isRecoveryMode = tradingMode?.toLowerCase().includes('recovery');
            
            return (
            <div 
              key={idx}
              onClick={() => handleSelectLicense(lic)}
              className="bg-[#12121a] rounded-xl cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10 transition-all border border-cyan-500/20 hover:border-cyan-400/50 group overflow-hidden"
            >
              {/* Header Row - Plan + Open Button */}
              <div className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-cyan-500/5 to-transparent border-b border-cyan-500/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-gray-600'}`}></div>
                  <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                    lic.status === 'active' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {lic.status?.toUpperCase()}
                  </span>
                  <span className="font-bold text-white text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{lic.plan}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-cyan-400 group-hover:text-cyan-300 font-semibold text-xs sm:text-sm">
                  <span>Open</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
              
              {/* Trading Mode Row */}
              {isConnected && (
                <div className="px-3 sm:px-5 py-2 border-b border-cyan-500/10">
                  <span className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border ${
                    isRecoveryMode 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}>
                    <svg 
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4`}
                      style={{ animation: isRecoveryMode ? 'spin 0.5s linear infinite' : 'spin 3s linear infinite' }}
                      viewBox="0 0 24 24" 
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      <circle cx="12" cy="4" r="2" fill="currentColor" />
                    </svg>
                    {tradingMode}
                  </span>
                </div>
              )}
              
              {/* Symbol & Price Row */}
              {symbol && (
                <div className="px-3 sm:px-5 py-2 bg-gradient-to-r from-yellow-500/5 to-transparent border-b border-yellow-500/10">
                  <span className="text-xs sm:text-sm text-yellow-400 font-semibold">
                    {symbol} @ {currentPrice || ''}
                  </span>
                </div>
              )}
              
              {/* License Key Row - Simplified for mobile */}
              <div className="px-3 sm:px-5 py-2 bg-[#0a0a0f]/50 border-b border-cyan-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-500">License:</span>
                    <code className="text-[10px] sm:text-xs font-mono text-cyan-400 bg-[#0a0a0f] px-1.5 sm:px-2 py-0.5 rounded border border-cyan-500/20 truncate max-w-[150px] sm:max-w-none">
                      {lic.license_key}
                    </code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(lic.license_key);
                        const btn = e.currentTarget;
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 1500);
                      }}
                      className="group p-1 rounded hover:bg-cyan-500/20 transition-all text-gray-400 hover:text-cyan-400 [&.copied]:text-green-400 [&.copied]:bg-green-500/20"
                      title="Copy license key"
                    >
                      <Copy className="w-3.5 h-3.5 group-[.copied]:hidden" />
                      <Check className="w-3.5 h-3.5 hidden group-[.copied]:block" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-500">MT5:</span>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400">{lic.mt5_account || '-'}</span>
                  </div>
                </div>
              </div>
              
              {/* Stats Row - 3 cols on mobile, 5 on desktop */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Balance</p>
                  <p className="text-sm sm:text-lg font-bold text-white">${balance?.toLocaleString() || '-'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">P/L</p>
                  <p className={`text-sm sm:text-lg font-bold ${(profit || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {profit !== undefined ? `${profit >= 0 ? '+' : ''}$${profit?.toFixed(0)}` : '-'}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Pos</p>
                  <p className="text-sm sm:text-lg font-bold text-white">{totalPositions}</p>
                </div>
                <div className="text-center sm:text-left hidden sm:block">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Status</p>
                  <p className={`text-sm sm:text-lg font-bold ${isConnected ? 'text-cyan-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="text-center sm:text-left hidden sm:block">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Expires</p>
                  <p className={`text-sm sm:text-lg font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {getDaysRemaining(lic)} days
                  </p>
                </div>
              </div>
              {/* Mobile-only: Status & Expires row */}
              <div className="sm:hidden px-3 pb-3 grid grid-cols-2 gap-2 border-t border-cyan-500/10 pt-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">Status</p>
                  <p className={`text-sm font-bold ${isConnected ? 'text-cyan-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">Expires</p>
                  <p className={`text-sm font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
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
