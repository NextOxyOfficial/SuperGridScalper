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

  const tabs = [
    { name: 'Overview', href: '/dashboard' },
    { name: 'Trading', href: '/dashboard/trading' },
    { name: 'Settings', href: '/dashboard/settings' },
    { name: 'Download', href: '/dashboard/download' },
  ];

  // Simple nav for license selection page
  if (!selectedLicense && pathname === '/dashboard') {
    return (
      <nav className="bg-gradient-to-r from-indigo-600 to-indigo-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white font-bold text-xl">
              SuperGrid Scalper
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-white text-sm hidden sm:block">{user?.email}</p>
            <button onClick={logout} className="text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg">
              Logout
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="bg-gradient-to-r from-indigo-600 to-indigo-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                clearSelectedLicense();
              }}
              className="text-white/70 hover:text-white flex items-center gap-1"
            >
              ← Licenses
            </button>
            {selectedLicense && (
              <>
                <div className="h-6 w-px bg-white/20"></div>
                <div>
                  <h1 className="text-lg font-bold text-white">{selectedLicense.plan}</h1>
                  <p className="text-xs text-indigo-200 font-mono">{selectedLicense.license_key?.slice(0, 15)}...</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm">{user?.email}</p>
              {selectedLicense && (
                <p className="text-indigo-200 text-xs">{getDaysRemaining(selectedLicense)} days left</p>
              )}
            </div>
            <button onClick={logout} className="text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {selectedLicense && (
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <div className="flex gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || 
                (tab.href !== '/dashboard' && pathname.startsWith(tab.href));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-6 py-3 rounded-lg font-medium transition whitespace-nowrap ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
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
