'use client';

import { DashboardProvider, useDashboard } from './context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Bot, Store, Gift, Download, X, Bell, Users, Star, Flame, Crown, Shield as ShieldIcon, Gem, Rocket, Trophy, Zap, Clock, TrendingUp, Loader2, Server } from 'lucide-react';
import SiteLogo from '@/components/SiteLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

function EAUpdateBanner() {
  const [update, setUpdate] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedKey = 'ea_update_dismissed';
    const dismissedData = localStorage.getItem(dismissedKey);
    
    const fetchUpdate = async () => {
      try {
        const res = await fetch(`${API_URL}/ea-update-status/`);
        const data = await res.json();
        if (data.success && data.has_update && data.update) {
          // Check if user already dismissed this specific version
          if (dismissedData === data.update.version) {
            setDismissed(true);
            return;
          }
          setUpdate(data.update);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchUpdate();
  }, []);

  if (!update || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-cyan-500/15 via-yellow-500/10 to-cyan-500/15 border-b border-cyan-500/30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs sm:text-sm font-semibold truncate">
              🔄 New Update: <span className="text-cyan-400">{update.product_name} v{update.version}</span>
            </p>
            {update.changelog && (
              <p className="text-gray-400 text-[10px] sm:text-xs truncate hidden sm:block">{update.changelog.split('\n')[0]}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/ea-store"
            className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">UPDATE</span>
          </Link>
          <button
            onClick={() => {
              setDismissed(true);
              localStorage.setItem('ea_update_dismissed', update.version);
            }}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const BADGE_ICON_MAP: Record<string, React.ElementType> = {
  star: Star,
  fire: Flame,
  crown: Crown,
  shield: ShieldIcon,
  diamond: Gem,
  rocket: Rocket,
  trophy: Trophy,
  zap: Zap,
  clock: Clock,
};

function UserBadges({ email }: { email: string }) {
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    if (!email) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_URL}/user-badges/?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success) setBadges(data.badges);
      } catch {}
    };
    fetch_();
  }, [email]);

  const manualBadges = badges.filter((b: any) => b.badge_type !== 'auto_join');
  if (manualBadges.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {manualBadges.map((b: any) => {
        const Icon = BADGE_ICON_MAP[b.icon] || Star;
        return (
          <span
            key={b.id}
            title={`${b.name}: ${b.description}`}
            className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
          >
            <Icon className="w-2.5 h-2.5" />
            {b.name}
          </span>
        );
      })}
    </div>
  );
}

function DashboardNav() {
  const { user, selectedLicense, clearSelectedLicense, logout } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setLoadingPath(href);
    startTransition(() => {
      router.push(href);
      setTimeout(() => setLoadingPath(null), 500);
    });
  };

  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Simple nav for license selection page or EA store without license
  const isFundManagersPage = pathname.startsWith('/dashboard/fund-managers');
  const isVPSPage = pathname.startsWith('/dashboard/vps');

  // Guest nav for non-logged-in users browsing FM Engine
  if (!user && isFundManagersPage) {
    return (
      <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-1 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between mb-2">
            <SiteLogo size="sm" />
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-cyan-300 hover:text-white text-[10px] sm:text-xs px-3 py-1.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
              >
                Login
              </Link>
              <Link
                href="/"
                className="bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] sm:text-xs px-3 py-1.5 rounded-lg transition font-bold"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Register
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            <Link
              href="/dashboard/fund-managers"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                pathname === '/dashboard/fund-managers'
                  ? 'bg-purple-500 text-black'
                  : 'text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> FM Engine
            </Link>
            <Link
              href="/dashboard/fund-managers/leaderboard"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                pathname === '/dashboard/fund-managers/leaderboard'
                  ? 'bg-yellow-500 text-black'
                  : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Leaderboard
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  if (!selectedLicense && (pathname === '/dashboard' || pathname === '/dashboard/ea-store' || pathname === '/dashboard/referral' || isFundManagersPage || isVPSPage)) {
    return (
      <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-1 sm:px-4 py-2 sm:py-3">
          {/* Row 1: Logo + Dashboard(mobile) + Email + Logout */}
          <div className="flex items-center justify-between mb-2">
            <SiteLogo size="sm" />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/dashboard"
                className={`sm:hidden flex-shrink-0 text-center px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition ${
                  pathname === '/dashboard' 
                    ? 'bg-cyan-500 text-black' 
                    : 'text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Dashboard
              </Link>
              <div className="hidden sm:flex flex-col items-end gap-0.5">
                <span className="text-cyan-300 text-xs">{user?.email}</span>
                {user?.email && <UserBadges email={user.email} />}
              </div>
              <button onClick={logout} className="text-cyan-300 hover:text-white text-[10px] sm:text-xs px-2.5 py-1.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30">
                Logout
              </button>
            </div>
          </div>
          {/* Row 2: Nav buttons */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            <Link
              href="/dashboard"
              className={`hidden sm:block flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
                pathname === '/dashboard' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/fund-managers"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                isFundManagersPage 
                  ? 'bg-purple-500 text-black' 
                  : 'text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> FM Engine
            </Link>
            <Link
              href="/dashboard/ea-store"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                pathname === '/dashboard/ea-store' 
                  ? 'bg-yellow-500 text-black' 
                  : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> EA Store
            </Link>
            <Link
              href="/dashboard/referral"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                pathname === '/dashboard/referral' 
                  ? 'bg-green-500 text-black' 
                  : 'text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Referral
            </Link>
            <Link
              href="/vps"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 text-orange-300 hover:text-white hover:bg-orange-500/20 border border-orange-500/30`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> VPS
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const isDownloadPage = pathname === '/dashboard/download';
  const isEAStorePage = pathname === '/dashboard/ea-store';
  const isReferralPage = pathname === '/dashboard/referral';
  const isDashboardPage = pathname === '/dashboard' && selectedLicense;
  const isVPSPageSelected = isVPSPage;

  return (
    <nav className="bg-[#0a0a0f] border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-1 sm:px-4 py-2 sm:py-3">
        {/* Row 1: Back + License Info + Logout */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => clearSelectedLicense()}
              className="text-cyan-300 hover:text-white text-sm flex items-center gap-1 transition px-2.5 py-1.5 hover:bg-cyan-500/10 rounded-lg border border-cyan-500/30"
            >
              ←
            </button>
            {selectedLicense && (
              <div className="flex items-center gap-2 sm:gap-3">
                <SiteLogo size="sm" showText={false} />
                <span className="text-white font-semibold text-xs sm:text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>{selectedLicense.plan}</span>
                <span className="bg-yellow-500/20 text-yellow-300 text-[10px] sm:text-sm px-2 py-0.5 rounded-full border border-yellow-500/30">
                  {getDaysRemaining(selectedLicense)}d
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col items-end gap-0.5">
              <span className="text-cyan-300 text-xs">{user?.email}</span>
              {user?.email && <UserBadges email={user.email} />}
            </div>
            <button 
              onClick={logout} 
              className="text-cyan-300 hover:text-white text-[10px] sm:text-xs px-2.5 py-1.5 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Row 2: Nav Links */}
        {selectedLicense && (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            <Link
              href="/dashboard"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
                isDashboardPage 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/fund-managers"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                isFundManagersPage 
                  ? 'bg-purple-500 text-black' 
                  : 'text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> FM Engine
            </Link>
            <Link
              href="/dashboard/ea-store"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                isEAStorePage 
                  ? 'bg-yellow-500 text-black' 
                  : 'text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> EA Store
            </Link>
            <Link
              href="/dashboard/referral"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 ${
                isReferralPage 
                  ? 'bg-green-500 text-black' 
                  : 'text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Referral
            </Link>
            <Link
              href="/vps"
              className={`flex-shrink-0 text-center px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center gap-1 sm:gap-2 text-orange-300 hover:text-white hover:bg-orange-500/20 border border-orange-500/30`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> VPS
            </Link>
          </div>
        )}
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
        <EAUpdateBanner />
        <DashboardNav />
        {children}
      </div>
    </DashboardProvider>
  );
}
