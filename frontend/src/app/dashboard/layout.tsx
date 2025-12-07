'use client';

import { DashboardProvider, useDashboard } from './context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function DashboardNav() {
  const { user, selectedLicense, logout, clearSelectedLicense } = useDashboard();
  const pathname = usePathname();
  
  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Simple nav for license selection page
  if (!selectedLicense && pathname === '/dashboard') {
    return (
      <nav className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white font-bold text-lg hover:text-purple-300 transition">
              SuperGrid Scalper
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-purple-300 text-sm hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-purple-300 hover:text-white text-sm px-3 py-1.5 hover:bg-purple-500/20 rounded-lg transition">
              Logout
            </button>
          </div>
        </div>
      </nav>
    );
  }

  const isDownloadPage = pathname === '/dashboard/download';

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-purple-500/20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Left: Back + License Info */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => clearSelectedLicense()}
            className="text-purple-300 hover:text-white text-sm flex items-center gap-1 transition"
          >
            ← Back
          </button>
          {selectedLicense && (
            <>
              <div className="h-5 w-px bg-purple-500/30"></div>
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">{selectedLicense.plan}</span>
                <span className="text-purple-400 text-xs font-mono hidden sm:inline bg-purple-500/10 px-2 py-0.5 rounded">
                  {selectedLicense.license_key?.slice(0, 12)}...
                </span>
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-500/30">
                  {getDaysRemaining(selectedLicense)} days
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Nav Links + User */}
        <div className="flex items-center gap-3">
          {selectedLicense && (
            <>
              <Link
                href="/dashboard"
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  !isDownloadPage 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-300 hover:text-white hover:bg-purple-500/20'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/download"
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  isDownloadPage 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-300 hover:text-white hover:bg-purple-500/20'
                }`}
              >
                ↓ Download EA
              </Link>
              <div className="h-5 w-px bg-purple-500/30 mx-1"></div>
            </>
          )}
          <span className="text-purple-300 text-sm hidden sm:inline">{user?.email}</span>
          <button 
            onClick={logout} 
            className="text-purple-300 hover:text-white text-sm px-3 py-1.5 hover:bg-purple-500/20 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        {children}
      </div>
    </DashboardProvider>
  );
}
