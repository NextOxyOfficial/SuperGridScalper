'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Download, Shield, Zap, TrendingUp, DollarSign, Target, Star, CheckCircle, ArrowRight, Store, Loader2 } from 'lucide-react';
import ExnessBroker from '@/components/ExnessBroker';
import Header from '@/components/Header';
import { useSiteSettings } from '@/context/SiteSettingsContext';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

export default function PublicEAStorePage() {
  const settings = useSiteSettings();
  const [eaProducts, setEaProducts] = useState<EAProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const supportEmail = settings.support_email || 'support@markstrades.com';

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

      <Header />

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

            const downloadHref = ea.download_url || '';
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
                {ea.has_file ? (
                  <a
                    href={downloadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${
                      ea.color === 'yellow' ? 'from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400' :
                      ea.color === 'cyan' ? 'from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400' :
                      ea.color === 'purple' ? 'from-purple-500 to-purple-400 hover:from-purple-400 hover:to-cyan-400' :
                      'from-orange-500 to-orange-400 hover:from-orange-400 hover:to-yellow-400'
                    } text-black py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-[1.02] shadow-lg`}
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    DOWNLOAD
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-700 to-gray-600 text-gray-300 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base cursor-not-allowed opacity-80`}
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    COMING SOON
                  </button>
                )}
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

        {/* Exness Broker Recommendation */}
        <div className="mb-6 sm:mb-8">
          <ExnessBroker variant="full" />
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


        {/* Support */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-3">Need help choosing the right EA?</p>
          <Link 
            href="/contact"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            Contact Support <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
