'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from './context';

export default function DashboardHome() {
  const router = useRouter();
  const { user, licenses, selectedLicense, selectLicense, settings, API_URL } = useDashboard();
  
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
        // Refresh page to get new licenses
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

  // If license selected, show overview
  if (selectedLicense) {
    return (
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-500 text-sm">Status</p>
              <p className={`text-xl font-bold ${selectedLicense.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {selectedLicense.status?.toUpperCase()}
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-500 text-sm">Days Remaining</p>
              <p className="text-xl font-bold text-gray-900">{getDaysRemaining(selectedLicense)}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-500 text-sm">Plan</p>
              <p className="text-xl font-bold text-indigo-600">{selectedLicense.plan}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-500 text-sm">MT5 Account</p>
              <p className="text-xl font-bold text-gray-900">{selectedLicense.mt5_account || 'Not Set'}</p>
            </div>
          </div>

          {/* License Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">License Details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">License Key</p>
                <p className="font-mono text-sm bg-gray-50 p-2 rounded mt-1 break-all">{selectedLicense.license_key}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Expires</p>
                <p className="font-medium mt-1">
                  {selectedLicense.expires_at ? new Date(selectedLicense.expires_at).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Current Settings Summary */}
          {settings && (
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
              <h3 className="font-bold mb-4">Current EA Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-indigo-200 text-sm">Investment</p>
                  <p className="text-2xl font-bold">${settings.investment_amount}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Lot Size</p>
                  <p className="text-2xl font-bold">{settings.lot_size}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Max Buy</p>
                  <p className="text-2xl font-bold">{settings.max_buy_orders}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-sm">Max Sell</p>
                  <p className="text-2xl font-bold">{settings.max_sell_orders}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-4">
            <a href="/dashboard/trading" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition group">
              <div className="text-3xl mb-2">📊</div>
              <h4 className="font-bold text-gray-900 group-hover:text-indigo-600">Trading</h4>
              <p className="text-sm text-gray-500">View live positions and logs</p>
            </a>
            <a href="/dashboard/settings" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition group">
              <div className="text-3xl mb-2">⚙️</div>
              <h4 className="font-bold text-gray-900 group-hover:text-indigo-600">Settings</h4>
              <p className="text-sm text-gray-500">Configure investment amount</p>
            </a>
            <a href="/dashboard/download" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition group">
              <div className="text-3xl mb-2">⬇️</div>
              <h4 className="font-bold text-gray-900 group-hover:text-indigo-600">Download EA</h4>
              <p className="text-sm text-gray-500">Get the MT5 Expert Advisor</p>
            </a>
          </div>
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
