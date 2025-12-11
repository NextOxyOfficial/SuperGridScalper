'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bot, Download, Shield, Zap, TrendingUp, DollarSign, Target, Star, CheckCircle, ArrowRight, LogIn, Store, Loader2 } from 'lucide-react';

// Fallback EA Products Data (used if API fails)
const fallbackProducts = [
  {
    id: 1,
    name: 'Gold Scalper Pro',
    subtitle: 'Most Popular',
    description: 'Balanced approach for intermediate traders. Optimized for consistent daily profits.',
    min_investment: 1000,
    max_investment: 5000,
    expected_profit: '100-180%',
    risk_level: 'Medium',
    trading_style: 'Aggressive Scalping',
    features: ['Advanced Grid System', 'Dynamic Lot Sizing', 'Trailing Stop', 'Recovery Mode'],
    color: 'yellow',
    is_popular: true,
    file_name: 'HedgeGridTrailingEA.ex5',
    has_file: false,
    download_url: null
  }
];

interface EAProduct {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  min_investment: number;
  max_investment: number;
  expected_profit: string;
  risk_level: string;
  trading_style: string;
  features: string[];
  color: string;
  is_popular: boolean;
  file_name: string;
  has_file: boolean;
  download_url: string | null;
}

export default function PublicEAStorePage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [eaProducts, setEaProducts] = useState<EAProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

  // Fetch EA products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/ea-products/`);
        const data = await res.json();
        if (data.success && data.products?.length > 0) {
          setEaProducts(data.products);
        } else {
          setEaProducts(fallbackProducts);
        }
      } catch (err) {
        console.error('Failed to fetch EA products:', err);
        setEaProducts(fallbackProducts);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setIsLoggedIn(true);
      const user = JSON.parse(userData);
      setUserName(user.email || 'User');
    }
  }, []);

  const getColorClasses = (color: string) => {
    const colors: { [key: string]: { bg: string; border: string; text: string; glow: string } } = {
      cyan: {
        bg: 'from-cyan-500/20 to-cyan-500/5',
        border: 'border-cyan-500/30 hover:border-cyan-400',
        text: 'text-cyan-400',
        glow: 'shadow-cyan-500/20'
      },
      yellow: {
        bg: 'from-yellow-500/20 to-yellow-500/5',
        border: 'border-yellow-500/30 hover:border-yellow-400',
        text: 'text-yellow-400',
        glow: 'shadow-yellow-500/20'
      },
      purple: {
        bg: 'from-purple-500/20 to-purple-500/5',
        border: 'border-purple-500/30 hover:border-purple-400',
        text: 'text-purple-400',
        glow: 'shadow-purple-500/20'
      },
      orange: {
        bg: 'from-orange-500/20 to-orange-500/5',
        border: 'border-orange-500/30 hover:border-orange-400',
        text: 'text-orange-400',
        glow: 'shadow-orange-500/20'
      }
    };
    return colors[color] || colors.cyan;
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] animate-pulse" />

      {/* Navigation - Different for logged in vs non-logged in */}
      <nav className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            {isLoggedIn ? (
              <>
                {/* Logged In: Dashboard Style Header */}
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                      </div>
                      <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
                    </Link>
                  </div>
                </div>
                
                {/* Nav buttons row */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  <Link
                    href="/dashboard"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/ea-store"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 bg-yellow-500 text-black"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Store className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> EA Store
                  </Link>
                  <Link
                    href="/guideline"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Guidelines
                  </Link>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="h-5 w-px bg-cyan-500/30"></div>
                    <span className="text-cyan-300 text-xs sm:text-sm">{userName}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Non-Logged In: Homepage Style Header */}
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
                  </Link>
                  <div className="h-5 sm:h-6 w-px bg-cyan-500/30"></div>
                  <span className="flex items-center gap-1.5 sm:gap-2 text-yellow-400 text-xs sm:text-sm font-medium" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    <Store className="w-4 h-4 sm:w-5 sm:h-5" /> EA STORE
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Home
                  </Link>
                  <Link 
                    href="/guideline" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Guidelines
                  </Link>
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4 sm:w-4 sm:h-4" /> Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
            <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
            <span className="text-yellow-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>EA STORE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Choose Your Trading AI
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">
            Select the EA that matches your investment size and trading style.
          </p>
          
          {/* Call to action for non-logged in users */}
          {!isLoggedIn && (
            <div className="mt-4 sm:mt-6 inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 sm:px-5 py-2 sm:py-3">
              <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              <span className="text-gray-300 text-xs sm:text-sm">
                <Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">Create account</Link> to get license key
              </span>
            </div>
          )}
        </div>

        {/* EA Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : eaProducts.length === 0 ? (
          <div className="text-center py-20">
            <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No EA products available yet.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-10">
          {eaProducts.map((ea) => {
            const colors = getColorClasses(ea.color);
            return (
              <div
                key={ea.id}
                className={`relative bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:shadow-lg ${colors.glow} group`}
              >
                {/* Popular Badge */}
                {ea.is_popular && (
                  <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-0.5 sm:py-1 rounded-full flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> POPULAR
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div>
                    <p className={`text-[10px] sm:text-xs ${colors.text} mb-0.5 sm:mb-1`}>{ea.subtitle}</p>
                    <h3 className="text-base sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {ea.name}
                    </h3>
                  </div>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center border ${colors.border}`}>
                    <Bot className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{ea.description}</p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="bg-black/30 rounded-lg p-2 sm:p-3">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                      <span className="text-gray-500 text-[10px] sm:text-xs">Investment</span>
                    </div>
                    <p className="text-white font-bold text-xs sm:text-base">${ea.min_investment} - ${ea.max_investment >= 1000 ? `${ea.max_investment/1000}K` : ea.max_investment}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 sm:p-3">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
                      <span className="text-gray-500 text-[10px] sm:text-xs">Profit</span>
                    </div>
                    <p className={`font-bold text-xs sm:text-base ${colors.text}`}>{ea.expected_profit}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 sm:p-3">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                      <span className="text-gray-500 text-[10px] sm:text-xs">Risk</span>
                    </div>
                    <p className="text-white font-medium text-xs sm:text-base">{ea.risk_level}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-2 sm:p-3">
                    <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                      <span className="text-gray-500 text-[10px] sm:text-xs">Style</span>
                    </div>
                    <p className="text-white font-medium text-[10px] sm:text-sm">{ea.trading_style}</p>
                  </div>
                </div>

                {/* Features - Hidden on mobile, shown on larger screens */}
                <div className="mb-3 sm:mb-5 hidden sm:block">
                  <p className="text-gray-500 text-xs mb-2">Features:</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {ea.features.slice(0, 3).map((feature, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-black/30 text-gray-300 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-400" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Download Button */}
                <a
                  href={ea.download_url || `/ea/${ea.file_name}`}
                  download={ea.file_name}
                  className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${
                    ea.color === 'yellow' ? 'from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400' :
                    ea.color === 'cyan' ? 'from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400' :
                    ea.color === 'purple' ? 'from-purple-500 to-purple-400 hover:from-purple-400 hover:to-cyan-400' :
                    'from-orange-500 to-orange-400 hover:from-orange-400 hover:to-yellow-400'
                  } text-black py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-[1.02] shadow-lg`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  {ea.has_file ? 'DOWNLOAD' : 'COMING SOON'}
                </a>
              </div>
            );
          })}
        </div>
        )}

        {/* Installation Guide */}
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            INSTALLATION GUIDE
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { step: 1, title: 'Download', desc: 'Get EA file' },
              { step: 2, title: 'Install', desc: 'Copy to MT5' },
              { step: 3, title: 'License', desc: 'Get key' },
              { step: 4, title: 'Activate', desc: 'Start trading' }
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-bold text-xs sm:text-sm">{item.step}</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold text-xs sm:text-base">{item.title}</h4>
                  <p className="text-gray-500 text-[10px] sm:text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-3 sm:p-5 mb-6 sm:mb-8">
          <h3 className="text-yellow-400 font-bold text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" /> IMPORTANT
          </h3>
          <ul className="space-y-1.5 sm:space-y-2 text-yellow-400/80 text-xs sm:text-sm">
            <li className="flex gap-2">
              <span>•</span>
              <span>Choose EA based on your investment capital for optimal performance</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>You need a valid license key to run the EA - <Link href="/" className="underline hover:text-yellow-300">Get one here</Link></span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Enable "Allow Algo Trading" in MT5 settings</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Allow WebRequest to <code className="bg-yellow-500/10 px-1 rounded">https://markstrades.com</code></span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Past performance does not guarantee future results. Trade responsibly.</span>
            </li>
          </ul>
        </div>

        {/* CTA for non-logged in users */}
        {!isLoggedIn && (
          <div className="text-center bg-gradient-to-r from-cyan-500/10 to-yellow-500/10 border border-cyan-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-8">
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Ready to Start?
            </h3>
            <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6 max-w-xl mx-auto">
              Get your license key to activate the EA.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black px-5 sm:px-8 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              GET LICENSE <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
          </div>
        )}

        {/* Support */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-3">Need help choosing the right EA?</p>
          <a 
            href="mailto:support@marksai.com" 
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            Contact Support <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Footer - Same as Homepage */}
      <footer className="relative z-10 border-t border-cyan-500/10 pt-6 sm:pt-8 pb-4 mt-10">
        <div className="max-w-7xl mx-auto px-4">
          {/* Footer Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-4">
            <Link href="/guideline" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Guidelines
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/ea-store" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              EA Store
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Terms & Conditions
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Privacy Policy
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
              </div>
              <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm">
              © 2025 Mark's AI - Advanced Gold Scalping EA
            </p>
            <p className="text-gray-600 text-[10px] sm:text-xs mt-1 sm:mt-2">
              Trading involves risk. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
