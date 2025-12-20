'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, LogOut, Menu, X } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loginHref = '/?auth=login';
  const registerHref = '/?auth=register';
  const pricingHref = '/#pricing';

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
                {scrollToPricing ? (
                  <button
                    onClick={scrollToPricing}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </button>
                ) : (
                  <Link
                    href={pricingHref}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition text-purple-300 hover:text-white hover:bg-purple-500/20 border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </Link>
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
                {scrollToPricing ? (
                  <button
                    onClick={scrollToPricing}
                    className="px-4 py-2 text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-lg text-sm font-medium transition border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </button>
                ) : (
                  <Link
                    href={pricingHref}
                    className="px-4 py-2 text-purple-300 hover:text-white hover:bg-purple-500/20 rounded-lg text-sm font-medium transition border border-purple-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </Link>
                )}

                {onLoginClick ? (
                  <button
                    onClick={onLoginClick}
                    className="px-4 py-2 text-cyan-400 hover:text-cyan-300 font-medium transition text-sm border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10"
                  >
                    Login
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="px-4 py-2 text-cyan-400 hover:text-cyan-300 font-medium transition text-sm border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10"
                  >
                    Login
                  </Link>
                )}

                {onRegisterClick ? (
                  <button
                    onClick={onRegisterClick}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Get Started
                  </button>
                ) : (
                  <Link
                    href={registerHref}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition text-center"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Get Started
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="flex lg:hidden items-center gap-2 flex-1 justify-end">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Dashboard
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="lg:hidden mt-3 pt-3 border-t border-cyan-500/10">
            <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/ea-store"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition border border-yellow-500/30 text-yellow-300 hover:text-white hover:bg-yellow-500/20 inline-flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Store className="w-4 h-4" /> EA Store
                </Link>
                <Link
                  href="/guideline"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Guidelines
                </Link>
                <Link
                  href="/demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition border border-green-500/30 text-green-300 hover:text-white hover:bg-green-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Demo
                </Link>

                {scrollToPricing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      scrollToPricing();
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition border border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-500/20"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </button>
                ) : (
                  <Link
                    href={pricingHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition border border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-500/20 text-center"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Pricing
                  </Link>
                )}

                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="col-span-2 px-3 py-2 rounded-lg text-xs font-medium transition border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 inline-flex items-center justify-center gap-2"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                ) : (
                  <>
                    {onLoginClick ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onLoginClick();
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        Login
                      </button>
                    ) : (
                      <Link
                        href={loginHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition border border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-500/20 text-center"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        Login
                      </Link>
                    )}
                    {onRegisterClick ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onRegisterClick();
                        }}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition bg-cyan-500 hover:bg-cyan-400 text-black"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        Get Started
                      </button>
                    ) : (
                      <Link
                        href={registerHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition bg-cyan-500 hover:bg-cyan-400 text-black text-center"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        Get Started
                      </Link>
                    )}
                  </>
                )}
              </div>

              {isLoggedIn ? (
                <div className="mt-2 text-[10px] text-gray-500 break-all">{userName}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
