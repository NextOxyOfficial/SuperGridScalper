'use client';

import { DashboardProvider, useDashboard } from './context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Store } from 'lucide-react';

function DashboardNav() {
  const { user, selectedLicense, logout, clearSelectedLicense } = useDashboard();
  const pathname = usePathname();
  
  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Simple nav for license selection page or EA store without license
  if (!selectedLicense && (pathname === '/dashboard' || pathname === '/dashboard/ea-store')) {
    return (
      <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
            </Link>
            <div className="h-5 w-px bg-cyan-500/30 mx-2"></div>
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname === '/dashboard' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/ea-store"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                pathname === '/dashboard/ea-store' 
                  ? 'bg-yellow-500 text-black' 
                  : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Store className="w-4 h-4" /> EA Store
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-cyan-300 text-sm hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-cyan-300 hover:text-white text-sm px-3 py-1.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30">
              Logout
            </button>
          </div>
        </div>
      </nav>
    );
  }

  const isDownloadPage = pathname === '/dashboard/download';
  const isEAStorePage = pathname === '/dashboard/ea-store';
  const isDashboardPage = pathname === '/dashboard' && selectedLicense;

  return (
    <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Left: Back + License Info */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => clearSelectedLicense()}
            className="text-cyan-300 hover:text-white text-sm flex items-center gap-1 transition"
          >
            ← Back
          </button>
          {selectedLicense && (
            <>
              <div className="h-5 w-px bg-cyan-500/30"></div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded flex items-center justify-center">
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <span className="text-white font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>{selectedLicense.plan}</span>
                <span className="text-cyan-400 text-xs font-mono hidden sm:inline bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {selectedLicense.license_key?.slice(0, 12)}...
                </span>
                <span className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full border border-yellow-500/30">
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
                  isDashboardPage 
                    ? 'bg-cyan-500 text-black' 
                    : 'text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/ea-store"
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                  isEAStorePage 
                    ? 'bg-yellow-500 text-black' 
                    : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Store className="w-4 h-4" /> EA Store
              </Link>
              <div className="h-5 w-px bg-cyan-500/30 mx-1"></div>
            </>
          )}
          <span className="text-cyan-300 text-sm hidden sm:inline">{user?.email}</span>
          <button 
            onClick={logout} 
            className="text-cyan-300 hover:text-white text-sm px-3 py-1.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
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
      <div className="min-h-screen bg-[#0a0a0f]">
        <DashboardNav />
        {children}
      </div>
    </DashboardProvider>
  );
}
