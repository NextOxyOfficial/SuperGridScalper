'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bot, Download, Shield, Zap, TrendingUp, DollarSign, Target, Star, CheckCircle, ArrowRight, LogIn, Store } from 'lucide-react';

// EA Products Data - You can add more EAs here
const eaProducts = [
  {
    id: 'gold-scalper-350',
    name: 'Gold Scalper Lite',
    subtitle: 'Entry Level',
    description: 'Perfect for beginners starting with small capital. Conservative risk management with steady returns.',
    minInvestment: 350,
    maxInvestment: 1000,
    expectedProfit: '70-120%',
    riskLevel: 'Low',
    tradingStyle: 'Conservative Scalping',
    features: [
      'Auto Risk Management',
      'Small Lot Sizes',
      'Tight Stop Loss',
      'Daily Profit Target',
      'Beginner Friendly'
    ],
    color: 'cyan',
    popular: false,
    fileName: 'GoldScalperLite.ex5'
  },
  {
    id: 'gold-scalper-1000',
    name: 'Gold Scalper Pro',
    subtitle: 'Most Popular',
    description: 'Balanced approach for intermediate traders. Optimized for consistent daily profits with moderate risk.',
    minInvestment: 1000,
    maxInvestment: 5000,
    expectedProfit: '100-180%',
    riskLevel: 'Medium',
    tradingStyle: 'Aggressive Scalping',
    features: [
      'Advanced Grid System',
      'Dynamic Lot Sizing',
      'Trailing Stop Loss',
      'Recovery Mode',
      'Multi-Timeframe Analysis'
    ],
    color: 'yellow',
    popular: true,
    fileName: 'HedgeGridTrailingEA.ex5'
  },
  {
    id: 'gold-scalper-5000',
    name: 'Gold Scalper Elite',
    subtitle: 'High Profit',
    description: 'Maximum profit potential for experienced traders with larger capital. Advanced AI-powered strategies.',
    minInvestment: 5000,
    maxInvestment: 50000,
    expectedProfit: '150-250%',
    riskLevel: 'Medium-High',
    tradingStyle: 'AI Hedge Trading',
    features: [
      'Neural Network AI',
      'Hedge Grid System',
      'Breakeven Recovery',
      'News Filter',
      'VIP Support'
    ],
    color: 'purple',
    popular: false,
    fileName: 'GoldScalperElite.ex5'
  },
  {
    id: 'btc-scalper',
    name: 'BTC Scalper',
    subtitle: 'Crypto Trading',
    description: 'Specialized EA for Bitcoin trading. Captures volatility with precision entries and smart exits.',
    minInvestment: 500,
    maxInvestment: 10000,
    expectedProfit: '80-200%',
    riskLevel: 'High',
    tradingStyle: 'Crypto Scalping',
    features: [
      'BTC/USD Optimized',
      'Volatility Filter',
      '24/7 Crypto Markets',
      'Quick Scalps',
      'Momentum Trading'
    ],
    color: 'orange',
    popular: false,
    fileName: 'HedgeGridTrailingEA_BTC.ex5'
  }
];

export default function PublicEAStorePage() {
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

      {/* Navigation */}
      <nav className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
            </Link>
            <div className="h-5 w-px bg-cyan-500/30"></div>
            <span className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              <Store className="w-4 h-4" /> EA STORE
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="text-cyan-300 text-sm hidden sm:block">{userName}</span>
                <Link 
                  href="/dashboard" 
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link 
                  href="/" 
                  className="text-cyan-300 hover:text-white text-sm px-3 py-1.5 hover:bg-cyan-500/20 rounded-lg transition"
                >
                  Home
                </Link>
                <Link 
                  href="/#pricing" 
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-sm font-medium transition"
                >
                  Get License
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2 mb-4">
            <Bot className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>EA STORE</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Choose Your Trading AI
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Select the EA that matches your investment size and trading style. 
            Each EA is optimized for different capital ranges and risk preferences.
          </p>
          
          {/* Call to action for non-logged in users */}
          {!isLoggedIn && (
            <div className="mt-6 inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-5 py-3">
              <LogIn className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-300 text-sm">
                <Link href="/" className="text-cyan-400 hover:text-cyan-300 font-medium">Create an account</Link> to get your license key after downloading
              </span>
            </div>
          )}
        </div>

        {/* EA Products Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {eaProducts.map((ea) => {
            const colors = getColorClasses(ea.color);
            return (
              <div
                key={ea.id}
                className={`relative bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-6 transition-all hover:shadow-lg ${colors.glow} group`}
              >
                {/* Popular Badge */}
                {ea.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className={`text-xs ${colors.text} mb-1`}>{ea.subtitle}</p>
                    <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {ea.name}
                    </h3>
                  </div>
                  <div className={`w-12 h-12 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center border ${colors.border}`}>
                    <Bot className={`w-6 h-6 ${colors.text}`} />
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4">{ea.description}</p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-gray-500 text-xs">Investment</span>
                    </div>
                    <p className="text-white font-bold">${ea.minInvestment.toLocaleString()} - ${ea.maxInvestment.toLocaleString()}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span className="text-gray-500 text-xs">Expected Profit</span>
                    </div>
                    <p className={`font-bold ${colors.text}`}>{ea.expectedProfit}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-500 text-xs">Risk Level</span>
                    </div>
                    <p className="text-white font-medium">{ea.riskLevel}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-500 text-xs">Strategy</span>
                    </div>
                    <p className="text-white font-medium text-sm">{ea.tradingStyle}</p>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-5">
                  <p className="text-gray-500 text-xs mb-2">Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {ea.features.map((feature, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-black/30 text-gray-300 text-xs px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Download Button */}
                <a
                  href={`/ea/${ea.fileName}`}
                  download
                  className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${
                    ea.color === 'yellow' ? 'from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400' :
                    ea.color === 'cyan' ? 'from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400' :
                    ea.color === 'purple' ? 'from-purple-500 to-purple-400 hover:from-purple-400 hover:to-cyan-400' :
                    'from-orange-500 to-orange-400 hover:from-orange-400 hover:to-yellow-400'
                  } text-black py-3 rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Download className="w-5 h-5" />
                  DOWNLOAD EA
                </a>
              </div>
            );
          })}
        </div>

        {/* Installation Guide */}
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Zap className="w-5 h-5 text-yellow-400" />
            QUICK INSTALLATION GUIDE
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Download EA', desc: 'Click download button for your chosen EA' },
              { step: 2, title: 'Install in MT5', desc: 'Copy .ex5 file to MQL5/Experts folder' },
              { step: 3, title: 'Get License', desc: 'Register and purchase a license key' },
              { step: 4, title: 'Activate', desc: 'Enter license key and start trading' }
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold">{item.title}</h4>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-5 mb-8">
          <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Shield className="w-5 h-5" /> IMPORTANT NOTES
          </h3>
          <ul className="space-y-2 text-yellow-400/80 text-sm">
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
              <span>Allow WebRequest to <code className="bg-yellow-500/10 px-1 rounded">http://127.0.0.1:8000</code></span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Past performance does not guarantee future results. Trade responsibly.</span>
            </li>
          </ul>
        </div>

        {/* CTA for non-logged in users */}
        {!isLoggedIn && (
          <div className="text-center bg-gradient-to-r from-cyan-500/10 to-yellow-500/10 border border-cyan-500/30 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Ready to Start Trading?
            </h3>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              Create an account and get your license key to activate the EA and start automated gold trading today.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              GET YOUR LICENSE <ArrowRight className="w-5 h-5" />
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-500/20 py-6 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © 2024 Mark's AI - Advance Scalper. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
