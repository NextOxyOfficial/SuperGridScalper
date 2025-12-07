'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../context';

export default function DownloadPage() {
  const router = useRouter();
  const { selectedLicense } = useDashboard();

  useEffect(() => {
    if (!selectedLicense) {
      router.push('/dashboard');
    }
  }, [selectedLicense, router]);

  if (!selectedLicense) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8">
      <div className="space-y-6">
        {/* Download Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center">
              <span className="text-5xl">📥</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">SuperGrid Scalper EA</h2>
              <p className="text-indigo-200 mb-4">Expert Advisor for MetaTrader 5</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">v1.0.0</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">MT5 Compatible</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">Auto-Update</span>
              </div>
            </div>
            <a
              href="/ea/HedgeGridTrailingEA.ex5"
              download
              className="bg-white text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-xl font-bold text-lg transition shadow-lg"
            >
              Download EA
            </a>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-900 text-xl mb-6">Installation Guide</h3>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-indigo-600">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Download the EA file</h4>
                <p className="text-gray-600 text-sm">Click the download button above to get the .ex5 file</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-indigo-600">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Open MT5 Data Folder</h4>
                <p className="text-gray-600 text-sm">In MetaTrader 5, go to <code className="bg-gray-100 px-2 py-0.5 rounded">File → Open Data Folder</code></p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-indigo-600">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Copy to Experts folder</h4>
                <p className="text-gray-600 text-sm">Navigate to <code className="bg-gray-100 px-2 py-0.5 rounded">MQL5/Experts</code> and paste the downloaded file</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-indigo-600">4</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Restart MT5</h4>
                <p className="text-gray-600 text-sm">Close and reopen MetaTrader 5 to load the EA</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-indigo-600">5</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Attach to Chart</h4>
                <p className="text-gray-600 text-sm">Find the EA in Navigator panel, drag it to your chart (e.g., XAUUSD)</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-green-600">6</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Enter License Key</h4>
                <p className="text-gray-600 text-sm">When prompted, enter your license key:</p>
                <div className="mt-2 bg-gray-900 text-green-400 font-mono text-sm p-3 rounded-lg break-all">
                  {selectedLicense.license_key}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
            <span>⚠️</span> Important Notes
          </h3>
          <ul className="space-y-2 text-amber-700 text-sm">
            <li className="flex gap-2">
              <span>•</span>
              <span>Allow WebRequest to <code className="bg-amber-100 px-1 rounded">http://127.0.0.1:8000</code> in MT5 settings (Tools → Options → Expert Advisors)</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Enable "Allow Algo Trading" in MT5</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>The EA is bound to MT5 account: <strong>{selectedLicense.mt5_account || 'Not set'}</strong></span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Make sure your broker allows automated trading</span>
            </li>
          </ul>
        </div>

        {/* Support */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4">Need Help?</h3>
          <p className="text-gray-600 mb-4">If you encounter any issues during installation or usage, please contact support.</p>
          <div className="flex gap-4">
            <a href="mailto:support@supergridscalper.com" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">
              Contact Support
            </a>
            <a href="#" className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition">
              View Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
