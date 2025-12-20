'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, LogOut } from 'lucide-react';
import SiteLogo from './SiteLogo';

interface HeaderProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  scrollToPricing?: () => void;
}

export default function Header({ onLoginClick, onRegisterClick, scrollToPricing }: HeaderProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setIsLoggedIn(true);
      const user = JSON.parse(userData);
      setUserName(user.email || 'User');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('licenses');
    localStorage.removeItem('selectedLicense');
    setIsLoggedIn(false);
    setUserName('');
    router.push('/');
  };

  return (
    <nav className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <div className="flex-shrink-0">
            <SiteLogo size="sm" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Dashboard
                </Link>
                <Link
                  href="/ea-store"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Store className="w-4 h-4" /> EA Store
                </Link>
                <Link
                  href="/guideline"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Guidelines
                </Link>
                <Link
                  href="/demo"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Demo
                </Link>
                {scrollToPricing && (
                  <button
                    onClick={scrollToPricing}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </button>
                )}
                <div className="h-5 w-px bg-cyan-500/30 mx-2"></div>
                <span className="text-cyan-300 text-sm">{userName}</span>
                <button
                  onClick={handleLogout}
                  className="text-cyan-300 hover:text-white text-sm px-4 py-2 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/ea-store"
                  className="px-4 py-2 text-yellow-300 hover:text-yellow-200 text-sm font-medium transition border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 flex items-center gap-2"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Store className="w-4 h-4" /> EA Store
                </Link>
                <Link
                  href="/guideline"
                  className="px-4 py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-sm font-medium transition border border-cyan-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Guidelines
                </Link>
                <Link
                  href="/demo"
                  className="px-4 py-2 text-green-300 hover:text-white hover:bg-green-500/20 rounded-lg text-sm font-medium transition border border-green-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Demo
                </Link>
                {scrollToPricing && (
                  <button
                    onClick={scrollToPricing}
                    className="px-4 py-2 text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-lg text-sm font-medium transition border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </button>
                )}
                {onLoginClick && (
                  <button
                    onClick={onLoginClick}
                    className="px-4 py-2 text-cyan-400 hover:text-cyan-300 font-medium transition text-sm border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10"
                  >
                    Login
                  </button>
                )}
                {onRegisterClick && (
                  <button
                    onClick={onRegisterClick}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Get Started
                  </button>
                )}
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="flex lg:hidden items-center gap-2 flex-1 justify-end">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Dashboard
                </Link>
                <Link
                  href="/ea-store"
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  EA Store
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/ea-store"
                  className="px-2.5 py-1.5 text-yellow-300 hover:text-yellow-200 text-[10px] font-medium transition border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  EA Store
                </Link>
                <Link
                  href="/guideline"
                  className="px-2.5 py-1.5 text-cyan-300 hover:text-white text-[10px] font-medium transition border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Guide
                </Link>
                <Link
                  href="/demo"
                  className="px-2.5 py-1.5 text-green-300 hover:text-white text-[10px] font-medium transition border border-green-500/30 rounded-lg hover:bg-green-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Demo
                </Link>
                {onLoginClick && (
                  <button
                    onClick={onLoginClick}
                    className="px-2.5 py-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition text-[10px] border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10"
                  >
                    Login
                  </button>
                )}
                {onRegisterClick && (
                  <button
                    onClick={onRegisterClick}
                    className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-[10px] font-medium transition"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Register
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Row 2 - Only show if logged in */}
        {isLoggedIn && (
          <div className="flex lg:hidden items-center gap-2 mt-2 pt-2 border-t border-cyan-500/10">
            <Link
              href="/guideline"
              className="flex-1 text-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Guidelines
            </Link>
            <Link
              href="/demo"
              className="flex-1 text-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition text-green-300 hover:text-white hover:bg-green-500/20 border border-green-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Demo
            </Link>
            {scrollToPricing && (
              <button
                onClick={scrollToPricing}
                className="flex-1 text-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Pricing
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
