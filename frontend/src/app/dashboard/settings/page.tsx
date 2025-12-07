'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../context';

export default function SettingsPage() {
  const router = useRouter();
  const { selectedLicense, settings, setSettings, API_URL } = useDashboard();
  const [investment, setInvestment] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Fetch fresh settings on page load
  const refreshSettings = async () => {
    if (!selectedLicense) return;
    try {
      const res = await fetch(`${API_URL}/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: selectedLicense.license_key, mt5_account: '', symbol: 'BTCUSD' })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setInvestment(data.settings.investment_amount || 1000);
      }
    } catch (e) {
      console.error('Failed to refresh settings');
    }
  };

  useEffect(() => {
    if (!selectedLicense) {
      router.push('/dashboard');
      return;
    }
    
    // Fetch fresh settings from server
    refreshSettings();
  }, [selectedLicense]);
  
  useEffect(() => {
    if (settings?.investment_amount) {
      setInvestment(settings.investment_amount);
    }
  }, [settings]);

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
        // Refresh settings from server to get updated values
        const settingsRes = await fetch(`${API_URL}/settings/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: selectedLicense.license_key, mt5_account: '', symbol: 'BTCUSD' })
        });
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          setSettings(settingsData.settings);
        }
        setMessage({ type: 'success', text: 'Settings updated! EA will reload in 5 seconds.' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update' });
    }
    setSaving(false);
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  if (!selectedLicense) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8">
      <div className="space-y-6">
        {/* Investment Calculator */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div>
              <p className="text-indigo-200 text-sm mb-1">Your Investment</p>
              <p className="text-4xl font-bold">${investment.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-indigo-200 text-sm mb-1">Calculated Lot Size</p>
              <p className="text-3xl font-bold">{settings?.lot_size || (investment * 0.05 / 100).toFixed(2)}</p>
              <p className="text-xs text-indigo-200">Based on investment</p>
            </div>
            <div>
              <p className="text-indigo-200 text-sm mb-1">Recovery Lot Min</p>
              <p className="text-3xl font-bold">{settings?.buy_be_recovery_lot_min || (investment * 0.05 / 100).toFixed(2)}</p>
              <p className="text-xs text-indigo-200">Based on investment</p>
            </div>
          </div>
        </div>

        {/* Investment Slider */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4">Set Investment Amount</h3>
          <div className="space-y-4">
            <input
              type="range"
              min="100"
              max="100000"
              step="100"
              value={investment}
              onChange={(e) => setInvestment(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>$100</span>
              <span>$100,000</span>
            </div>
            <div className="flex gap-4">
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(Math.max(100, Number(e.target.value)))}
                className="flex-1 px-4 py-3 border rounded-lg text-lg font-bold"
                min="100"
              />
              <button
                onClick={updateInvestment}
                disabled={saving}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {message.text && (
              <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}
          </div>
        </div>

        {/* Current EA Settings */}
        {settings && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">Current EA Settings</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">Lot Size</p>
                <p className="text-2xl font-bold text-gray-900">{settings.lot_size}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">Max Buy Orders</p>
                <p className="text-2xl font-bold text-green-600">{settings.max_buy_orders}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">Max Sell Orders</p>
                <p className="text-2xl font-bold text-red-600">{settings.max_sell_orders}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">Investment</p>
                <p className="text-2xl font-bold text-indigo-600">${settings.investment_amount}</p>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
