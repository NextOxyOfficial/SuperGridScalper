'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Play, ChevronDown, ChevronUp, Shield, Settings, TrendingUp, AlertTriangle, Download, CheckCircle, DollarSign, Target, Zap, ArrowRight, Store, BookOpen, LogIn } from 'lucide-react';
import ExnessBroker from '@/components/ExnessBroker';
import SiteLogo from '@/components/SiteLogo';
import Header from '@/components/Header';
import { useSiteSettings } from '@/context/SiteSettingsContext';

// Video tutorials data - Add your YouTube/video URLs here
const videoTutorials = [
  {
    id: 'getting-started',
    category: 'Getting Started',
    icon: Download,
    color: 'cyan',
    videos: [
      {
        title: 'How to Download & Install EA on MT5',
        description: 'Step-by-step guide to download the EA file and install it in MetaTrader 5',
        duration: '5:30',
        videoUrl: '', // Add your video URL here
        thumbnail: '/thumbnails/install.jpg'
      },
      {
        title: 'How to Get Your License Key',
        description: 'Register, purchase a plan, and get your license key to activate the EA',
        duration: '3:45',
        videoUrl: '',
        thumbnail: '/thumbnails/license.jpg'
      },
      {
        title: 'First Time EA Setup',
        description: 'Configure the EA for the first time with optimal settings',
        duration: '8:20',
        videoUrl: '',
        thumbnail: '/thumbnails/setup.jpg'
      }
    ]
  },
  {
    id: 'risk-management',
    category: 'Risk Management',
    icon: Shield,
    color: 'yellow',
    videos: [
      {
        title: 'Understanding Lot Sizes',
        description: 'How to calculate proper lot sizes based on your account balance',
        duration: '6:15',
        videoUrl: '',
        thumbnail: '/thumbnails/lots.jpg'
      },
      {
        title: 'Setting Stop Loss & Take Profit',
        description: 'Configure SL/TP levels to protect your capital',
        duration: '7:00',
        videoUrl: '',
        thumbnail: '/thumbnails/sltp.jpg'
      },
      {
        title: 'Maximum Drawdown Settings',
        description: 'How to limit your maximum loss with drawdown controls',
        duration: '5:45',
        videoUrl: '',
        thumbnail: '/thumbnails/drawdown.jpg'
      },
      {
        title: 'Capital Allocation Strategy',
        description: 'How much to invest based on your risk tolerance',
        duration: '8:30',
        videoUrl: '',
        thumbnail: '/thumbnails/capital.jpg'
      }
    ]
  },
  {
    id: 'ea-settings',
    category: 'EA Settings & Configuration',
    icon: Settings,
    color: 'purple',
    videos: [
      {
        title: 'Grid Settings Explained',
        description: 'Understanding grid gap, max orders, and grid range',
        duration: '10:15',
        videoUrl: '',
        thumbnail: '/thumbnails/grid.jpg'
      },
      {
        title: 'Trailing Stop Configuration',
        description: 'How to set up trailing stops for maximum profit',
        duration: '6:30',
        videoUrl: '',
        thumbnail: '/thumbnails/trailing.jpg'
      },
      {
        title: 'Recovery Mode Settings',
        description: 'Configure breakeven recovery for losing positions',
        duration: '9:00',
        videoUrl: '',
        thumbnail: '/thumbnails/recovery.jpg'
      },
      {
        title: 'Best Settings for Different Account Sizes',
        description: 'Recommended settings for $350, $1000, $5000+ accounts',
        duration: '12:00',
        videoUrl: '',
        thumbnail: '/thumbnails/settings.jpg'
      }
    ]
  },
  {
    id: 'trading-strategies',
    category: 'Trading Strategies',
    icon: TrendingUp,
    color: 'green',
    videos: [
      {
        title: 'Gold Trading Basics',
        description: 'Understanding XAUUSD market behavior and best trading times',
        duration: '8:45',
        videoUrl: '',
        thumbnail: '/thumbnails/gold.jpg'
      },
      {
        title: 'Scalping vs Swing Trading',
        description: 'When to use aggressive vs conservative settings',
        duration: '7:30',
        videoUrl: '',
        thumbnail: '/thumbnails/scalping.jpg'
      },
      {
        title: 'News Trading with EA',
        description: 'How to handle high-impact news events',
        duration: '6:00',
        videoUrl: '',
        thumbnail: '/thumbnails/news.jpg'
      }
    ]
  },
  {
    id: 'troubleshooting',
    category: 'Troubleshooting & FAQ',
    icon: AlertTriangle,
    color: 'orange',
    videos: [
      {
        title: 'Common Installation Errors',
        description: 'How to fix WebRequest, DLL, and license errors',
        duration: '5:00',
        videoUrl: '',
        thumbnail: '/thumbnails/errors.jpg'
      },
      {
        title: 'EA Not Opening Trades',
        description: 'Troubleshoot when EA is not placing orders',
        duration: '4:30',
        videoUrl: '',
        thumbnail: '/thumbnails/notrades.jpg'
      },
      {
        title: 'License Activation Issues',
        description: 'Fix license key not working or expired issues',
        duration: '3:45',
        videoUrl: '',
        thumbnail: '/thumbnails/licensefix.jpg'
      }
    ]
  }
];

// Quick tips data
const quickTips = [
  {
    icon: DollarSign,
    title: 'Start Small',
    description: 'Begin with minimum investment ($350) to learn how the EA works before scaling up.'
  },
  {
    icon: Shield,
    title: 'Never Risk More Than 2%',
    description: 'Set your lot sizes so you never risk more than 2% of your account per trade.'
  },
  {
    icon: Target,
    title: 'Use Recommended Settings',
    description: 'Start with default settings optimized for your account size before customizing.'
  },
  {
    icon: Zap,
    title: 'Keep EA Running 24/5',
    description: 'Use a VPS to keep the EA running continuously for best results.'
  }
];

export default function GuidelinePage() {
  const settings = useSiteSettings();
  const [expandedCategory, setExpandedCategory] = useState<string | null>('getting-started');
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  const supportEmail = settings.support_email || 'support@markstrades.com';

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setIsLoggedIn(true);
      const user = JSON.parse(userData);
      setUserName(user.email || 'User');
    }
  }, []);

  const getColorClasses = (color: string) => {
    const colors: { [key: string]: { bg: string; border: string; text: string } } = {
      cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
      yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
      purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
      green: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
      orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' }
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

      {/* Navigation - Different for logged in vs non-logged in */}
      <nav className="hidden relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            {isLoggedIn ? (
              <>
                {/* Logged In: Dashboard Style Header */}
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <SiteLogo size="sm" />
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
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Store className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> EA Store
                  </Link>
                  <Link
                    href="/guideline"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition bg-cyan-500 text-black"
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
                  <SiteLogo size="sm" />
                  <div className="h-5 sm:h-6 w-px bg-cyan-500/30"></div>
                  <span className="flex items-center gap-1.5 sm:gap-2 text-cyan-400 text-xs sm:text-sm font-medium" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> GUIDELINES
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
                    href="/ea-store" 
                    className="flex items-center gap-1.5 text-yellow-300 hover:text-yellow-200 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2 hover:bg-yellow-500/20 rounded-lg transition border border-yellow-500/30"
                  >
                    <Store className="w-4 h-4 sm:w-4 sm:h-4" /> EA Store
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
        <div className="text-center mb-6 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="text-cyan-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>VIDEO TUTORIALS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            EA Guidelines
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">
            Learn everything about setting up and managing your trading EA.
          </p>
        </div>

        {/* Exness Broker Recommendation */}
        <div className="mb-6 sm:mb-10">
          <ExnessBroker variant="full" />
        </div>

        {/* Quick Tips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-12">
          {quickTips.map((tip, idx) => (
            <div key={idx} className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-3 sm:p-4 hover:border-cyan-400/50 transition">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-2 sm:mb-3">
                <tip.icon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
              <h3 className="text-white font-semibold text-xs sm:text-base mb-0.5 sm:mb-1">{tip.title}</h3>
              <p className="text-gray-500 text-[10px] sm:text-sm line-clamp-2">{tip.description}</p>
            </div>
          ))}
        </div>

        {/* Video Tutorials */}
        <div className="space-y-4">
          {videoTutorials.map((category) => {
            const colors = getColorClasses(category.color);
            const isExpanded = expandedCategory === category.id;
            
            return (
              <div key={category.id} className="bg-[#12121a] border border-cyan-500/20 rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                  className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 ${colors.bg} ${colors.border} border rounded-xl flex items-center justify-center`}>
                      <category.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-sm sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        {category.category}
                      </h2>
                      <p className="text-gray-500 text-[10px] sm:text-sm">{category.videos.length} videos</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                  )}
                </button>

                {/* Videos List */}
                {isExpanded && (
                  <div className="px-3 sm:px-6 pb-4 sm:pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {category.videos.map((video, idx) => (
                      <div
                        key={idx}
                        className="bg-black/30 border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition group cursor-pointer"
                        onClick={() => setSelectedVideo(video)}
                      >
                        {/* Video Thumbnail */}
                        <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-cyan-500/80 rounded-full flex items-center justify-center group-hover:bg-cyan-400 transition">
                            <Play className="w-4 h-4 sm:w-6 sm:h-6 text-black ml-0.5 sm:ml-1" />
                          </div>
                          <span className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 bg-black/70 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                            {video.duration}
                          </span>
                        </div>
                        {/* Video Info */}
                        <div className="p-3 sm:p-4">
                          <h3 className="text-white font-semibold text-sm sm:text-base mb-0.5 sm:mb-1 group-hover:text-cyan-400 transition line-clamp-1">
                            {video.title}
                          </h3>
                          <p className="text-gray-500 text-[10px] sm:text-sm line-clamp-2">{video.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Video Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedVideo(null)}>
            <div className="bg-[#12121a] border border-cyan-500/30 rounded-2xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Video Player Placeholder */}
              <div className="aspect-video bg-black flex items-center justify-center">
                {selectedVideo.videoUrl ? (
                  <iframe
                    src={selectedVideo.videoUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="text-center">
                    <Play className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
                    <p className="text-gray-400">Video coming soon</p>
                    <p className="text-gray-600 text-sm mt-2">Add video URL to enable playback</p>
                  </div>
                )}
              </div>
              {/* Video Info */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {selectedVideo.title}
                </h3>
                <p className="text-gray-400">{selectedVideo.description}</p>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="mt-4 px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 text-center bg-gradient-to-r from-cyan-500/10 to-yellow-500/10 border border-cyan-500/30 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Ready to Start Trading?
          </h3>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            Download your EA from the store and start automated gold trading today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/ea-store"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400 text-black px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/25"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Store className="w-5 h-5" /> EA STORE <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-black/50 hover:bg-black/70 text-cyan-300 px-6 py-3 rounded-xl font-semibold transition-all border border-cyan-500/50 hover:border-cyan-400"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Support */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-3">Still have questions?</p>
          <a 
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            Contact Support <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
