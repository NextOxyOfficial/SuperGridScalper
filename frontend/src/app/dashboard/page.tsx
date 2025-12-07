'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = 'http://127.0.0.1:8000/api';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [tradeData, setTradeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [investment, setInvestment] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const licensesData = localStorage.getItem('licenses');
    
    if (!userData) {
      router.push('/');
      return;
    }
    
    setUser(JSON.parse(userData));
    
    if (licensesData) {
      const lics = JSON.parse(licensesData);
      setLicenses(lics);
      if (lics.length === 1) {
        selectLicense(lics[0]);
      }
    }
    
    setLoading(false);
  }, []);

  const selectLicense = (lic: any) => {
    setSelectedLicense(lic);
    if (lic.ea_settings) {
      setSettings(lic.ea_settings);
      setInvestment(lic.ea_settings.investment_amount || 1000);
    }
    fetchSettings(lic.license_key);
    fetchTradeData(lic.license_key);
  };

  const fetchSettings = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, mt5_account: '' })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setInvestment(data.settings.investment_amount || 1000);
      }
    } catch (e) {
      console.error('Failed to fetch settings');
    }
  };

  const fetchTradeData = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/trade-data/?license_key=${licenseKey}`);
      const data = await res.json();
      if (data.success) {
        setTradeData(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch trade data');
    }
  };

  const updateInvestment = async () => {
    if (!selectedLicense) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/update-investment/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          license_key: selectedLicense.license_key, 
          investment_amount: investment 
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setMessage({ type: 'success', text: 'Settings updated!' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update' });
    }
    setSaving(false);
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('licenses');
    router.push('/');
  };

  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // License Selection Screen
  if (!selectedLicense && licenses.length > 1) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-gradient-to-r from-indigo-600 to-indigo-800 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Super Grid Scalper</h1>
            <div className="flex items-center gap-4">
              <span className="text-indigo-200">{user?.email}</span>
              <button onClick={logout} className="text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg">Logout</button>
            </div>
          </div>
        </nav>
        
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Select a License</h2>
          <div className="grid gap-4">
            {licenses.map((lic, idx) => (
              <div 
                key={idx}
                onClick={() => selectLicense(lic)}
                className="bg-white rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md transition border-2 border-transparent hover:border-indigo-500"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm text-gray-500 mb-1">{lic.license_key}</p>
                    <p className="text-lg font-bold text-gray-900">{lic.plan}</p>
                    <p className="text-sm text-gray-500">MT5: {lic.mt5_account || 'Not Set'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      lic.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {lic.status?.toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-500 mt-2">{getDaysRemaining(lic)} days left</p>
                    {lic.ea_settings && (
                      <p className="text-sm font-semibold text-indigo-600 mt-1">
                        ${lic.ea_settings.investment_amount} invested
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(selectedLicense);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-indigo-600 to-indigo-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {licenses.length > 1 && (
              <button onClick={() => setSelectedLicense(null)} className="text-white/70 hover:text-white">
                ← Back
              </button>
            )}
            <h1 className="text-xl font-bold text-white">Super Grid Scalper</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-indigo-200">{user?.email}</span>
            <button onClick={logout} className="text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg">Logout</button>
          </div>
        </div>
      </nav>

      {message.text && (
        <div className={`fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm overflow-x-auto">
          {['overview', 'trading', 'settings', 'download'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-medium transition capitalize whitespace-nowrap ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <p className="text-gray-500 text-sm">Status</p>
                <p className={`text-xl font-bold ${selectedLicense?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedLicense?.status?.toUpperCase()}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <p className="text-gray-500 text-sm">Days Left</p>
                <p className="text-xl font-bold">{daysRemaining}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <p className="text-gray-500 text-sm">Investment</p>
                <p className="text-xl font-bold">${settings?.investment_amount || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <p className="text-gray-500 text-sm">Plan</p>
                <p className="text-xl font-bold">{selectedLicense?.plan}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">License Key</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm flex justify-between items-center">
                <span className="truncate">{selectedLicense?.license_key}</span>
                <button onClick={() => copyToClipboard(selectedLicense?.license_key)} className="ml-2 bg-white/10 px-3 py-1 rounded text-white text-xs">
                  Copy
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div><span className="text-gray-500">MT5:</span> {selectedLicense?.mt5_account || 'Not Set'}</div>
                <div><span className="text-gray-500">Activated:</span> {selectedLicense?.activated_at ? new Date(selectedLicense.activated_at).toLocaleDateString() : '-'}</div>
                <div><span className="text-gray-500">Expires:</span> {selectedLicense?.expires_at ? new Date(selectedLicense.expires_at).toLocaleDateString() : '-'}</div>
              </div>
            </div>

            {tradeData && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-gray-900 mb-4">Account Summary</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500 text-sm">Balance</p>
                    <p className="text-xl font-bold">${tradeData.account_balance?.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500 text-sm">Equity</p>
                    <p className="text-xl font-bold">${tradeData.account_equity?.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500 text-sm">Profit</p>
                    <p className={`text-xl font-bold ${tradeData.account_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${tradeData.account_profit?.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500 text-sm">Positions</p>
                    <p className="text-xl font-bold">{(tradeData.total_buy_positions || 0) + (tradeData.total_sell_positions || 0)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trading */}
        {activeTab === 'trading' && (
          <div className="space-y-6">
            {tradeData ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Balance', value: `$${tradeData.account_balance?.toFixed(2)}`, color: 'text-blue-600' },
                    { label: 'Equity', value: `$${tradeData.account_equity?.toFixed(2)}`, color: 'text-purple-600' },
                    { label: 'Profit', value: `$${tradeData.account_profit?.toFixed(2)}`, color: tradeData.account_profit >= 0 ? 'text-green-600' : 'text-red-600' },
                    { label: 'Margin', value: `$${tradeData.account_margin?.toFixed(2)}`, color: 'text-orange-600' },
                    { label: 'Free Margin', value: `$${tradeData.account_free_margin?.toFixed(2)}`, color: 'text-gray-900' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm text-center">
                      <p className="text-gray-500 text-sm">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-green-700 mb-4">📈 BUY Positions</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-gray-500 text-sm">Count</p><p className="text-xl font-bold text-green-600">{tradeData.total_buy_positions}</p></div>
                      <div><p className="text-gray-500 text-sm">Lots</p><p className="text-xl font-bold">{tradeData.total_buy_lots?.toFixed(2)}</p></div>
                      <div><p className="text-gray-500 text-sm">Profit</p><p className={`text-xl font-bold ${tradeData.total_buy_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${tradeData.total_buy_profit?.toFixed(2)}</p></div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-red-700 mb-4">📉 SELL Positions</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-gray-500 text-sm">Count</p><p className="text-xl font-bold text-red-600">{tradeData.total_sell_positions}</p></div>
                      <div><p className="text-gray-500 text-sm">Lots</p><p className="text-xl font-bold">{tradeData.total_sell_lots?.toFixed(2)}</p></div>
                      <div><p className="text-gray-500 text-sm">Profit</p><p className={`text-xl font-bold ${tradeData.total_sell_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${tradeData.total_sell_profit?.toFixed(2)}</p></div>
                    </div>
                  </div>
                </div>

                {tradeData.open_positions?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b"><h3 className="font-bold">Open Positions</h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Ticket', 'Type', 'Lots', 'Price', 'SL', 'TP', 'Profit'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tradeData.open_positions.map((pos: any, i: number) => (
                            <tr key={i}>
                              <td className="px-4 py-3 font-mono text-sm">{pos.ticket}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${pos.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{pos.type}</span></td>
                              <td className="px-4 py-3">{pos.lots}</td>
                              <td className="px-4 py-3 font-mono">{pos.open_price}</td>
                              <td className="px-4 py-3 font-mono">{pos.sl || '-'}</td>
                              <td className="px-4 py-3 font-mono">{pos.tp || '-'}</td>
                              <td className={`px-4 py-3 font-semibold ${pos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${pos.profit?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <p className="text-4xl mb-4">📊</p>
                <p className="text-gray-500">Start the EA to see trade data</p>
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Investment Settings</h3>
              <div className="bg-indigo-600 text-white p-6 rounded-xl text-center mb-6">
                <p className="text-indigo-200 text-sm">Your Investment</p>
                <p className="text-3xl font-bold">${investment.toLocaleString()}</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
                <input
                  type="number"
                  value={investment}
                  onChange={(e) => setInvestment(Number(e.target.value))}
                  min="100"
                  step="100"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-sm text-gray-500 mt-1">Min: $100</p>
              </div>
              <button
                onClick={updateInvestment}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Current EA Settings</h3>
              {settings ? (
                <div className="space-y-3">
                  {[
                    { label: 'Lot Size', value: settings.lot_size },
                    { label: 'Max Buy Orders', value: settings.max_buy_orders },
                    { label: 'Max Sell Orders', value: settings.max_sell_orders },
                    { label: 'Buy Gap (Pips)', value: settings.buy_gap_pips },
                    { label: 'Sell Gap (Pips)', value: settings.sell_gap_pips },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No settings yet</p>
              )}
            </div>
          </div>
        )}

        {/* Download */}
        {activeTab === 'download' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold mb-2">Super Grid Scalper EA</h3>
              <p className="text-gray-500 mb-6">Download and install in MT5. Settings load from server automatically.</p>
              
              {selectedLicense?.status === 'active' ? (
                <a href={`${API_URL.replace('/api', '')}/download-ea/`} className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg">
                  ⬇️ Download EA
                </a>
              ) : (
                <button disabled className="bg-gray-300 text-gray-500 px-8 py-4 rounded-xl font-semibold cursor-not-allowed">
                  License Expired
                </button>
              )}
            </div>

            <div className="border-t pt-6">
              <h4 className="font-bold mb-4">Installation:</h4>
              <ol className="space-y-2 text-gray-600">
                <li>1. Download the EA file</li>
                <li>2. Open MT5 → File → Open Data Folder</li>
                <li>3. Go to MQL5 → Experts</li>
                <li>4. Copy EA file there</li>
                <li>5. Restart MT5</li>
                <li>6. Drag EA to chart, enter license key</li>
              </ol>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
              <strong>Important:</strong> Add <code className="bg-yellow-100 px-1 rounded">http://127.0.0.1:8000</code> to MT5 WebRequest URLs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
