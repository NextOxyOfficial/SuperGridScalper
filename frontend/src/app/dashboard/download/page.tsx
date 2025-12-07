'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../context';

export default function DownloadPage() {
  const router = useRouter();
  const { selectedLicense } = useDashboard();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedLicense) {
      router.push('/dashboard');
    }
  }, [selectedLicense, router]);

  const copyLicenseKey = () => {
    navigator.clipboard.writeText(selectedLicense?.license_key || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!selectedLicense) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto pt-4 px-4 pb-8">
      <div className="space-y-4">
        {/* Compact Download Card */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📥</span>
              </div>
              <div>
                <h2 className="text-lg font-bold">SuperGrid Scalper EA</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">v1.0.0</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">MT5</span>
                </div>
              </div>
            </div>
            <a
              href="/ea/HedgeGridTrailingEA.ex5"
              download
              className="bg-white text-indigo-600 hover:bg-indigo-50 px-5 py-2.5 rounded-lg font-bold text-sm transition shadow-lg flex items-center gap-2"
            >
              <span>↓</span> Download
            </a>
          </div>
        </div>

        {/* License Key Card */}
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Your License Key</p>
              <p className="text-green-400 font-mono text-sm break-all">{selectedLicense.license_key}</p>
            </div>
            <button
              onClick={copyLicenseKey}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                copied ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-4 text-xs">
            <span className="text-gray-500">MT5 Account:</span>
            <span className="text-gray-300 font-mono">{selectedLicense.mt5_account || 'Not bound'}</span>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Installation Steps */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-100 rounded flex items-center justify-center text-xs text-indigo-600">?</span>
              Quick Setup
            </h3>
            <ol className="space-y-2 text-sm">
              {[
                'Download the EA file above',
                'MT5 → File → Open Data Folder',
                'Copy to MQL5/Experts folder',
                'Restart MetaTrader 5',
                'Drag EA to chart (XAUUSD/BTCUSD)',
                'Enter your license key'
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-500 flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-600">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Important Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
              <span>⚠️</span> Important
            </h3>
            <ul className="space-y-2 text-amber-700 text-xs">
              <li className="flex gap-2">
                <span>•</span>
                <span>Allow WebRequest to <code className="bg-amber-100 px-1 rounded">http://127.0.0.1:8000</code></span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Enable "Allow Algo Trading" in MT5</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Tools → Options → Expert Advisors</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Broker must allow automated trading</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Support Row */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Need Help?</h3>
            <p className="text-gray-500 text-xs">Contact support for installation issues</p>
          </div>
          <div className="flex gap-2">
            <a href="mailto:support@supergridscalper.com" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs transition">
              Contact Support
            </a>
            <a href="#" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-xs transition">
              Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
