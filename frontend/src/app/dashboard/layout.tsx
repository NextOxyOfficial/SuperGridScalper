'use client';

import { DashboardProvider, useDashboard } from './context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Store, Gift } from 'lucide-react';

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
  if (!selectedLicense && (pathname === '/dashboard' || pathname === '/dashboard/ea-store' || pathname === '/dashboard/referral')) {
    return (
      <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
          {/* Mobile: Two rows layout */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            
            {/* Row 1: Logo + Logout (mobile) */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                  </div>
                  <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
                </Link>
              </div>
              
              {/* Mobile only: Logout on right */}
              <button onClick={logout} className="sm:hidden text-cyan-300 hover:text-white text-xs px-3 py-2.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30">
                Logout
              </button>
            </div>
            
            {/* Row 2: Nav buttons (mobile full width) */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
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
                className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 ${
                  pathname === '/dashboard/ea-store' 
                    ? 'bg-yellow-500 text-black' 
                    : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Store className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> EA Store
              </Link>
              <Link
                href="/dashboard/referral"
                className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 ${
                  pathname === '/dashboard/referral' 
                    ? 'bg-green-500 text-black' 
                    : 'text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Gift className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> Referral
              </Link>
              
              {/* Desktop only: Email + Logout */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-5 w-px bg-cyan-500/30"></div>
                <span className="text-cyan-300 text-xs sm:text-sm">{user?.email}</span>
                <button onClick={logout} className="text-cyan-300 hover:text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const isDownloadPage = pathname === '/dashboard/download';
  const isEAStorePage = pathname === '/dashboard/ea-store';
  const isReferralPage = pathname === '/dashboard/referral';
  const isDashboardPage = pathname === '/dashboard' && selectedLicense;

  return (
    <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
        {/* Mobile: Two rows layout */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          
          {/* Row 1: Back + License Info + Days */}
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button 
                onClick={() => clearSelectedLicense()}
                className="text-cyan-300 hover:text-white text-sm sm:text-sm flex items-center gap-1 transition px-3 sm:px-3 py-2 sm:py-2 hover:bg-cyan-500/10 rounded-lg border border-cyan-500/30"
              >
                ←
              </button>
              {selectedLicense && (
                <>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                    </div>
                    <span className="text-white font-semibold text-sm sm:text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>{selectedLicense.plan}</span>
                    <span className="bg-yellow-500/20 text-yellow-300 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1 rounded-full border border-yellow-500/30">
                      {getDaysRemaining(selectedLicense)}d
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Mobile only: Logout button on right of first row */}
            <button 
              onClick={logout} 
              className="sm:hidden text-cyan-300 hover:text-white text-xs px-3 py-2.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
            >
              Logout
            </button>
          </div>

          {/* Row 2: Nav Links (Mobile) / Nav Links + User (Desktop) */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
            {selectedLicense && (
              <>
                <Link
                  href="/dashboard"
                  className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
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
                  className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 ${
                    isEAStorePage 
                      ? 'bg-yellow-500 text-black' 
                      : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Store className="w-4 h-4 sm:w-5 sm:h-5" /> EA Store
                </Link>
                <Link
                  href="/dashboard/referral"
                  className={`flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 ${
                    isReferralPage 
                      ? 'bg-green-500 text-black' 
                      : 'text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Gift className="w-4 h-4 sm:w-5 sm:h-5" /> Referral
                </Link>
                <div className="h-5 sm:h-6 w-px bg-cyan-500/30 mx-1 sm:mx-2 hidden sm:block"></div>
              </>
            )}
            <span className="text-cyan-300 text-xs sm:text-sm hidden md:inline">{user?.email}</span>
            <button 
              onClick={logout} 
              className="hidden sm:block text-cyan-300 hover:text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
            >
              Logout
            </button>
          </div>
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
