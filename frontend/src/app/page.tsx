'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Shield, Zap, Clock, TrendingUp, Star, ArrowRight, X, Copy, Loader2, LogIn, LogOut, Bot, Cpu, Activity, Target, Sparkles, Store, BookOpen, Settings, Gift } from 'lucide-react'
import axios from 'axios'
import ExnessBroker from '@/components/ExnessBroker'
import Header from '@/components/Header'
import { useSiteSettings } from '@/context/SiteSettingsContext'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000/api'
    : 'https://markstrades.com/api')

interface Plan {
  id: number
  name: string
  description: string
  price: string
  duration_days: number
  max_accounts: number
}

interface LicenseResult {
  license_key: string
  plan: string
  expires_at: string
  days_remaining: number
}

const STEP_DURATION = 4000;

function StepsSlideshow({ router }: { router: any }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advanceStep = useCallback((nextIdx: number) => {
    setIsExiting(true);
    setTimeout(() => {
      setActiveStep(nextIdx);
      setIsExiting(false);
      setProgress(0);
    }, 400);
  }, []);

  const goToStep = useCallback((idx: number) => {
    if (idx === activeStep) return;
    advanceStep(idx);
  }, [activeStep, advanceStep]);

  // Progress bar + auto-advance
  useEffect(() => {
    if (isPaused || isExiting) return;

    progressRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + (50 / STEP_DURATION) * 100;
        if (next >= 100) {
          advanceStep((activeStep + 1) % 4);
          return 100;
        }
        return next;
      });
    }, 50);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPaused, isExiting, activeStep, advanceStep]);

  // Render unique content per step
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: return (
        /* ── STEP 1: Exness – yellow/orange signature ── */
        <div className="flex flex-col md:flex-row gap-5 sm:gap-8 items-center">
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400/20 rounded-2xl blur-xl" />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-[#1a1a2e] to-[#0d0d15] rounded-2xl p-3 sm:p-4 border-2 border-yellow-500/40 shadow-xl shadow-yellow-500/20">
                <img src="/exness.png" alt="Exness" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-[10px] sm:text-xs">Trusted Worldwide</span>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mb-2">
              <span className="text-[9px] sm:text-[10px] font-bold text-yellow-300 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-400/40">⭐ RECOMMENDED BROKER</span>
              <span className="text-[9px] sm:text-[10px] font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-400/40 animate-pulse">CENT ACCOUNT</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-bold text-yellow-400 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Open Exness Account</h3>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-1">Create a <span className="text-yellow-400 font-semibold">Standard Cent Account</span> on Exness — the only broker optimized for our EA.</p>
            <p className="text-gray-500 text-xs sm:text-sm">Low spreads • Instant deposits • No restrictions on EAs • Start with just $10</p>
            <a href="https://one.exnesstrack.org/a/sxz9ig3enp" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold mt-4 transition-all hover:scale-105 shadow-lg shadow-yellow-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >OPEN EXNESS ACCOUNT <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      );
      case 1: return (
        /* ── STEP 2: Download EA – cyan/blue tech ── */
        <div className="flex flex-col md:flex-row gap-5 sm:gap-8 items-center">
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-400/15 rounded-2xl blur-xl" />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-2xl border-2 border-cyan-500/40 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                <span className="text-5xl sm:text-7xl">🤖</span>
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl sm:text-3xl font-bold text-cyan-400 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Download AI Trading EA</h3>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-1">Get our AI-powered Expert Advisor from the EA Store and install it on your MT5 terminal.</p>
            <p className="text-gray-500 text-xs sm:text-sm mb-4">Download .ex5 → Copy to MT5 Experts folder → Restart MT5 → Drag onto XAUUSD chart</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
              {['AI Grid Trading', 'Auto Recovery', 'Trailing Stop', '24/5 Automated'].map(f => (
                <span key={f} className="text-[10px] sm:text-xs bg-cyan-500/10 text-cyan-300 px-2 sm:px-3 py-1 rounded-full border border-cyan-500/20">{f}</span>
              ))}
            </div>
            <button onClick={() => router.push('/ea-store')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-cyan-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >VISIT EA STORE <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      );
      case 2: return (
        /* ── STEP 3: License – green ── */
        <div className="flex flex-col md:flex-row gap-5 sm:gap-8 items-center">
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-green-400/15 rounded-2xl blur-xl" />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl border-2 border-green-500/40 flex items-center justify-center shadow-xl shadow-green-500/20">
                <span className="text-5xl sm:text-7xl">🔑</span>
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl sm:text-3xl font-bold text-green-400 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Purchase License</h3>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-1">Choose a subscription plan, complete payment, and get your license key activated instantly.</p>
            <p className="text-gray-500 text-xs sm:text-sm mb-4">Enter the license key in your EA settings → The AI starts trading automatically for you.</p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-4">
              {[{label:'Weekly', price:'$19'}, {label:'Monthly', price:'$49'}, {label:'Yearly', price:'$299'}].map(p => (
                <div key={p.label} className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 sm:px-4 py-2 text-center">
                  <p className="text-green-400 font-bold text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{p.price}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs">{p.label}</p>
                </div>
              ))}
            </div>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-green-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >VIEW PLANS <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      );
      case 3: return (
        /* ── STEP 4: Withdraw – purple/gold ── */
        <div className="flex flex-col md:flex-row gap-5 sm:gap-8 items-center">
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-400/15 rounded-2xl blur-xl" />
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl border-2 border-purple-500/40 flex items-center justify-center shadow-xl shadow-purple-500/20">
                <span className="text-5xl sm:text-7xl">💰</span>
              </div>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl sm:text-3xl font-bold text-purple-400 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Withdraw Profits</h3>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-1">Watch your balance grow 24/5 and withdraw your earnings anytime directly from Exness.</p>
            <p className="text-gray-500 text-xs sm:text-sm mb-4">Monitor live from your dashboard • Instant withdrawals • No hidden fees</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
              {['📊 Live Dashboard', '⚡ Instant Withdrawal', '🔒 Secure Funds', '📱 Mobile Access'].map(f => (
                <span key={f} className="text-[10px] sm:text-xs bg-purple-500/10 text-purple-300 px-2 sm:px-3 py-1 rounded-full border border-purple-500/20">{f}</span>
              ))}
            </div>
            <button onClick={() => router.push('/ea-store')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-purple-500/30"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >START NOW <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      );
      default: return null;
    }
  };

  const stepColors = ['cyan', 'cyan', 'green', 'purple'];
  const stepTitles = ['Create Account', 'Download EA', 'Get License', 'Withdraw'];

  return (
    <div className="mb-12 sm:mb-24 relative" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-yellow-500/5 to-green-500/5 rounded-3xl blur-xl" />

      <div className="relative bg-gradient-to-r from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] border border-cyan-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(6,182,212,0.03)_50%,transparent_100%)] animate-pulse" />

        <div className="relative z-10">
          <div className="text-center mb-6 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Start Earning in <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400">4 Simple Steps</span>
            </h2>
            <p className="text-gray-500 text-xs sm:text-base">From account creation to withdrawal — it takes just minutes!</p>
          </div>

          {/* Step Indicators with Progress */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-6 sm:mb-8">
            {[0,1,2,3].map(idx => {
              const dotActive = [
                'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50 scale-110',
                'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50 scale-110',
                'bg-green-500 text-black shadow-lg shadow-green-500/50 scale-110',
                'bg-purple-500 text-black shadow-lg shadow-purple-500/50 scale-110',
              ];
              const textActive = ['text-yellow-400', 'text-cyan-400', 'text-green-400', 'text-purple-400'];
              const barActive = ['bg-yellow-500', 'bg-cyan-500', 'bg-green-500', 'bg-purple-500'];
              const isActive = idx === activeStep;
              const isDone = idx < activeStep;
              return (
                <button key={idx} onClick={() => goToStep(idx)} className="flex items-center gap-1 sm:gap-1.5 group">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${
                      isActive ? dotActive[idx] : isDone ? 'bg-gray-700 text-gray-400' : 'bg-gray-800/60 text-gray-600'
                    }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className={`text-[9px] sm:text-xs font-semibold transition-all duration-300 ${
                      isActive ? textActive[idx] : 'text-gray-600'
                    }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{stepTitles[idx]}</span>
                    {/* Progress bar under each step */}
                    <div className="w-14 sm:w-20 h-0.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isActive ? barActive[idx] : isDone ? 'bg-gray-600' : 'bg-transparent'}`}
                        style={{ 
                          width: isActive ? `${progress}%` : isDone ? '100%' : '0%',
                          transition: isActive ? 'none' : 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                  {idx < 3 && <div className={`hidden sm:block w-4 md:w-8 h-px mt-[-18px] transition-all duration-300 ${isDone ? 'bg-gray-600' : 'bg-gray-800/50'}`} />}
                </button>
              );
            })}
          </div>

          {/* Step Content with smooth fade-out / fade-in */}
          <div
            style={{
              opacity: isExiting ? 0 : 1,
              transform: isExiting ? 'translateY(14px) scale(0.97)' : 'translateY(0) scale(1)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {renderStepContent()}
          </div>

          {/* Bottom */}
          <div className="text-center mt-8 sm:mt-10">
            <p className="text-sm sm:text-lg md:text-xl text-gray-300 mb-4">
              <span className="text-cyan-400 font-bold">No trading experience needed.</span> Let AI do the work for you.
            </p>
            <button onClick={() => router.push('/ea-store')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >START EARNING NOW <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          </div>
        </div>
      </div>

      {/* Transitions handled via inline styles */}
    </div>
  );
}

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const settings = useSiteSettings()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanTab, setSelectedPlanTab] = useState(0)
  
  // Typing effect states
  const [typedText, setTypedText] = useState('')
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const typingPhrases = [
    'Start EA trading with as little as $350 and earn 70%-250% profit every day.',
    'Make money on every move. No matter market moves up or down.',
    'The EA manages risk automatically and handles all trades for you.',
    'Fully automated gold trading with AI precision.',
  ]

  const authParam = (searchParams.get('auth') || '').toLowerCase()

  const clearAuthParam = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('auth')
    const qs = params.toString()
    router.replace(qs ? `/?${qs}` : '/')
  }

  useEffect(() => {
    if (!authParam) return
    setError('')

    if (authParam === 'login') {
      setShowRegisterModal(false)
      setShowLoginModal(true)
      return
    }

    if (authParam === 'register') {
      setShowLoginModal(false)
      setShowRegisterModal(true)
    }
  }, [authParam])

  const scrollToPricing = () => {
    const pricingEl = document.getElementById('pricing')
    if (pricingEl) {
      const offset = 120
      const elementPosition = pricingEl.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' })
    }
  }

  useEffect(() => {

    // Capture referral code from URL
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      localStorage.setItem('referral_code', ref)
      document.cookie = `referral_code=${ref}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
      // Track the referral click in backend
      axios.post(`${API_URL}/referral/track-click/`, { referral_code: ref }).catch(() => {})
    } else {
      // Check if stored in localStorage
      const storedRef = localStorage.getItem('referral_code')
      if (storedRef) {
        setReferralCode(storedRef)
      }
    }

    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${API_URL}/plans/`)
        console.log('Plans response:', response.data)
        if (response.data.plans && response.data.plans.length > 0) {
          setPlans(response.data.plans)
        } else {
          // Fallback plans
          setPlans([
            { id: 1, name: 'Monthly', description: 'Perfect for trying out', price: '49.00', duration_days: 30, max_accounts: 1 },
            { id: 2, name: 'Quarterly', description: 'Most popular choice', price: '129.00', duration_days: 90, max_accounts: 2 },
            { id: 3, name: 'Yearly', description: 'Best value', price: '399.00', duration_days: 365, max_accounts: 5 },
          ])
        }
      } catch (error) {
        console.error('Failed to fetch plans:', error)
        // Fallback plans on error
        setPlans([
          { id: 1, name: 'Monthly', description: 'Perfect for trying out', price: '49.00', duration_days: 30, max_accounts: 1 },
          { id: 2, name: 'Quarterly', description: 'Most popular choice', price: '129.00', duration_days: 90, max_accounts: 2 },
          { id: 3, name: 'Yearly', description: 'Best value', price: '399.00', duration_days: 365, max_accounts: 5 },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
  }, [])

  // Typing effect
  useEffect(() => {
    const currentPhrase = typingPhrases[currentPhraseIndex]
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (typedText.length < currentPhrase.length) {
          setTypedText(currentPhrase.slice(0, typedText.length + 1))
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 2000)
        }
      } else {
        // Deleting
        if (typedText.length > 0) {
          setTypedText(typedText.slice(0, -1))
        } else {
          setIsDeleting(false)
          setCurrentPhraseIndex((prev) => (prev + 1) % typingPhrases.length)
        }
      }
    }, isDeleting ? 50 : 100)

    return () => clearTimeout(timeout)
  }, [typedText, isDeleting, currentPhraseIndex])

  const handleSubscribe = (plan: Plan) => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      setShowLoginModal(true)
      return
    }
    router.push(`/dashboard?plan=${plan.id}`)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setSubmitting(true)

    try {
      const response = await axios.post(`${API_URL}/register/`, {
        email,
        password,
        name: firstName,
        referral_code: referralCode
      })

      if (response.data.success) {
        localStorage.setItem('user', JSON.stringify(response.data.user))
        localStorage.setItem('licenses', JSON.stringify(response.data.licenses || []))
        setShowRegisterModal(false)
        clearAuthParam()
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setFirstName('')
        router.push('/dashboard')
      } else {
        setError(response.data.message || 'Registration failed')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px]" />
      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="relative max-w-md w-full">
            {/* Outer glow ring */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400/20 to-cyan-500/50 rounded-2xl blur-sm" />
            <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-400/30 via-transparent to-cyan-500/30 rounded-2xl" />
            
            <div className="relative bg-[#0a0a12] border border-cyan-500/30 rounded-2xl p-5 sm:p-7 overflow-hidden">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/60 rounded-br-2xl" />

              {/* Background circuit pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #06b6d4 1px, transparent 1px), radial-gradient(circle at 75% 75%, #06b6d4 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

              {/* Close button */}
              <button
                onClick={() => {
                  setShowRegisterModal(false)
                  setError('')
                  clearAuthParam()
                }}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="text-center mb-5 sm:mb-7 relative">
                <div className="relative inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-2xl rotate-45" />
                  <div className="absolute inset-[2px] bg-[#0a0a12] rounded-[14px] rotate-45" />
                  <div className="absolute inset-[3px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-[13px] rotate-45" />
                  <Cpu className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 relative z-10" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  INITIALIZE V3.0
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-cyan-500/50" />
                  <p className="text-cyan-500/70 text-[10px] sm:text-xs tracking-[0.2em] uppercase">New Operator Access</p>
                  <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-cyan-500/50" />
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-3 sm:space-y-3.5 relative">
                {/* Name field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <Bot className="w-3 h-3 text-cyan-500/50" />
                    Operator Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="Enter your name"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <Bot className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Email field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <Target className="w-3 h-3 text-cyan-500/50" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="your@email.com"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <Target className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Password field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <Shield className="w-3 h-3 text-cyan-500/50" />
                    Access Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="Min 6 characters"
                      minLength={6}
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Confirm Password field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <CheckCircle className="w-3 h-3 text-cyan-500/50" />
                    Confirm Access Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="Re-enter access key"
                      minLength={6}
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs sm:text-sm">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="relative w-full py-3 sm:py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 text-black rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 overflow-hidden group"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        INITIALIZING...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        ACTIVATE ACCOUNT
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="relative z-10 mt-5 pt-4 border-t border-cyan-500/10 text-center">
                <span className="text-gray-600 text-[10px] sm:text-xs">Already registered? </span>
                <button 
                  type="button"
                  onClick={() => { setShowRegisterModal(false); setShowLoginModal(true); setError(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors text-[10px] sm:text-xs"
                >
                  Access Terminal
                </button>
              </div>

              {/* Status bar */}
              <div className="relative z-10 flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400/60 text-[9px] uppercase tracking-wider">System Online</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-cyan-500/30" />
                  <span className="text-cyan-500/30 text-[9px] uppercase tracking-wider">Secure Connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="relative max-w-md w-full">
            {/* Outer glow ring */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400/20 to-cyan-500/50 rounded-2xl blur-sm" />
            <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-400/30 via-transparent to-cyan-500/30 rounded-2xl" />

            <div className="relative bg-[#0a0a12] border border-cyan-500/30 rounded-2xl p-5 sm:p-7 overflow-hidden">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/60 rounded-br-2xl" />

              {/* Background circuit pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #06b6d4 1px, transparent 1px), radial-gradient(circle at 75% 75%, #06b6d4 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

              {/* Close button */}
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  setError('')
                  clearAuthParam()
                }}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700/50 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="text-center mb-5 sm:mb-7 relative">
                <div className="relative inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-3">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-2xl rotate-45" />
                  <div className="absolute inset-[2px] bg-[#0a0a12] rounded-[14px] rotate-45" />
                  <div className="absolute inset-[3px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-[13px] rotate-45" />
                  <LogIn className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 relative z-10" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  ACCESS TERMINAL
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-cyan-500/50" />
                  <p className="text-cyan-500/70 text-[10px] sm:text-xs tracking-[0.2em] uppercase">Operator Authentication</p>
                  <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-cyan-500/50" />
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                setSubmitting(true)
                try {
                  const response = await axios.post(`${API_URL}/login/`, { email, password })
                  if (response.data.success) {
                    localStorage.setItem('user', JSON.stringify(response.data.user))
                    localStorage.setItem('licenses', JSON.stringify(response.data.licenses))
                    setShowLoginModal(false)
                    clearAuthParam()
                    router.push('/dashboard')
                  } else {
                    setError(response.data.message || 'Login failed')
                  }
                } catch (err: any) {
                  setError(err.response?.data?.message || 'Invalid credentials')
                }
                setSubmitting(false)
              }} className="space-y-3 sm:space-y-3.5 relative">
                {/* Email field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <Target className="w-3 h-3 text-cyan-500/50" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="your@email.com"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <Target className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Password field */}
                <div className="group">
                  <label className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1.5 uppercase tracking-wider">
                    <Shield className="w-3 h-3 text-cyan-500/50" />
                    Access Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#06060a] border border-cyan-500/15 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm sm:text-base transition-all"
                      placeholder="Enter your access key"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/30 group-focus-within:text-cyan-400/60 transition-colors">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs sm:text-sm">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="relative w-full py-3 sm:py-3.5 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 text-black rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 overflow-hidden group"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        AUTHENTICATING...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        AUTHENTICATE
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Forgot password */}
              <div className="relative z-10 mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false)
                    setError('')
                    router.push('/forgot-password')
                  }}
                  className="text-cyan-500/50 hover:text-cyan-400 text-[10px] sm:text-xs font-medium transition-colors uppercase tracking-wider"
                >
                  Reset Access Key
                </button>
              </div>

              {/* Footer */}
              <div className="relative z-10 mt-4 pt-4 border-t border-cyan-500/10 text-center">
                <span className="text-gray-600 text-[10px] sm:text-xs">New operator? </span>
                <button 
                  type="button"
                  onClick={() => { setShowLoginModal(false); setShowRegisterModal(true); setError(''); }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors text-[10px] sm:text-xs"
                >
                  Initialize Account
                </button>
              </div>

              {/* Status bar */}
              <div className="relative z-10 flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400/60 text-[9px] uppercase tracking-wider">System Online</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-cyan-500/30" />
                  <span className="text-cyan-500/30 text-[9px] uppercase tracking-wider">Secure Connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Header 
        onLoginClick={() => setShowLoginModal(true)}
        onRegisterClick={() => setShowRegisterModal(true)}
        scrollToPricing={scrollToPricing}
      />

      {/* Hero Section */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="container mx-auto px-3 sm:px-4 py-10 sm:py-20">
          {/* Typing Effect Description - Full Width on Mobile */}
          <div className="w-full mb-4 sm:mb-6 text-center lg:text-left">
            <div className="h-[60px] sm:h-[80px] md:h-[90px] flex items-start justify-center lg:justify-start">
              <p className="text-white text-xs sm:text-lg md:text-2xl lg:text-3xl font-bold tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <span className="text-yellow-400">&gt;</span>{' '}
                <span className="capitalize">{typedText}</span>
                <span className="inline-block w-1 h-4 sm:h-7 md:h-8 bg-cyan-400 ml-1 sm:ml-2 animate-pulse" />
              </p>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row max-sm:items-center justify-between gap-12">
            
            {/* Left Side - Text Content */}
            <div className="flex-1 text-center lg:text-left max-w-2xl">
              {/* Main Content */}
              <div>
              {/* AI Badge */}
              <div className="inline-flex items-center sm:mt-24 gap-1.5 sm:gap-2 bg-black/50 border border-cyan-500/50 rounded-full px-3 sm:px-5 py-1.5 sm:py-2 mb-4 sm:mb-6 backdrop-blur-md">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-pulse" />
                <span className="text-cyan-300 text-[10px] sm:text-sm tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>POWERED BY AI</span>
              </div>
              
              {/* Main Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-yellow-400 mb-1 sm:mb-2 drop-shadow-2xl" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {settings.logo_text} {settings.logo_version}
              </h1>
              <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 mb-3 sm:mb-4 drop-shadow-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                ADVANCE AI SCALPER
              </h2>
              
              {/* Tagline */}
              <p className="text-sm sm:text-lg md:text-xl text-cyan-300 mb-4 sm:mb-6 font-light drop-shadow-lg">
                {settings.site_tagline || 'The Most Powerful Automated Gold AI Trading'}
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-6 sm:mb-8 max-w-[320px] sm:max-w-none mx-auto lg:mx-0">
                <button 
                  onClick={() => router.push('/ea-store')}
                  className="group inline-flex items-center justify-center gap-2 sm:gap-3 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/25"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                  EA STORE
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => router.push('/demo')}
                  className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-black px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  DEMO
                </button>
                <button 
                  onClick={() => router.push('/guideline')}
                  className="inline-flex items-center justify-center gap-2 bg-black/50 hover:bg-black/70 text-cyan-300 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-sm"
                >
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> Guidelines
                </button>
              </div>
              
              {/* Stats Row */}
              <div className="w-full grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:justify-center lg:justify-start sm:gap-6 md:gap-8 py-3 sm:py-4 px-3 sm:px-6 bg-black/30 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-cyan-500/20 mt-4 sm:mt-6">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>89.2%</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>24/5</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Auto</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>0.001s</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Speed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>972+</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Traders</div>
                </div>
              </div>
              {/* Free EA Promo Banner */}
              <Link
                href="/free-EA-trading"
                className="mt-3 sm:mt-4 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-500/10 border-2 border-green-500/30 rounded-xl sm:rounded-2xl hover:border-green-400/60 hover:shadow-lg hover:shadow-green-500/10 transition-all group/promo"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30 flex-shrink-0">
                    <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[10px] sm:text-xs md:text-sm font-bold text-green-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>GET FREE EA SUBSCRIPTION</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-green-200 bg-green-500/25 px-1.5 py-0.5 rounded-full border border-green-400/40 animate-pulse">$0</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5">Open an Exness account under our referral link & trade for free!</p>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-green-400 font-bold whitespace-nowrap group-hover/promo:text-green-300 transition-colors flex items-center gap-1 flex-shrink-0">
                  How? <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/promo:translate-x-0.5 transition-transform" />
                </span>
              </Link>
              </div>
            </div>
            
            {/* Right Side - AI Robot Image */}
            <div className="flex-1 flex flex-col items-center lg:items-end">
              <div className="relative group">
                {/* Glow effect behind image */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-cyan-400/20 blur-3xl rounded-full scale-90 group-hover:scale-100 transition-transform duration-500" />
                
                {/* AI Robot Image */}
                <img 
                  src="/marks-ai-robot.png" 
                  alt="Mark's AI Trading Robot" 
                  className="relative z-10 w-[200px] sm:w-[300px] md:w-[400px] lg:w-[500px] h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  style={{ filter: 'drop-shadow(0 0 40px rgba(6, 182, 212, 0.4))' }}
                />
                
                {/* Floating badges */}
                <div className="absolute -top-1 sm:-top-2 right-4 sm:right-10 bg-gradient-to-r from-yellow-500 to-yellow-400 text-black text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full animate-bounce shadow-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  NEW 3.0
                </div>
                <div className="absolute bottom-12 sm:bottom-20 -left-2 sm:-left-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  AI POWERED
                </div>
              </div>
              
              {/* Tech Info Bar under Robot */}
              <div className="mt-3 sm:mt-4 w-full max-w-sm sm:max-w-md">
                <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] border border-cyan-500/30 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                  {/* Animated scanning line */}
                  <div className="relative overflow-hidden mb-2 sm:mb-3">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400 mb-1">
                      <span>AI NEURAL NETWORK</span>
                      <span className="text-cyan-400">ACTIVE</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-cyan-500 via-yellow-400 to-cyan-500 animate-pulse" 
                           style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    </div>
                  </div>
                  
                  {/* Live Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-black/40 rounded-lg p-1.5 sm:p-2">
                      <div className="text-cyan-400 text-sm sm:text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>LIVE</div>
                      <div className="text-gray-500 text-[8px] sm:text-[10px]">STATUS</div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-1.5 sm:p-2">
                      <div className="text-green-400 text-sm sm:text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>89.2%</div>
                      <div className="text-gray-500 text-[8px] sm:text-[10px]">WIN RATE</div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-1.5 sm:p-2">
                      <div className="text-yellow-400 text-sm sm:text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>GOLD</div>
                      <div className="text-gray-500 text-[8px] sm:text-[10px]">XAUUSD</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="relative z-10 container mx-auto px-3 sm:px-4">

        {/* Progress Steps - Auto-Playing Tab Slideshow */}
        <StepsSlideshow router={router} />

        {/* EA Store Preview Section */}
        <div className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <Store className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>EA STORE</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Choose Your Trading AI Power</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">Multiple EA options optimized for different investment sizes</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { name: 'Gold Scalper Lite', investment: '$350 - $1K', profit: '70-120%', color: 'cyan', risk: 'Low' },
              { name: 'Gold Scalper Pro', investment: '$1K - $5K', profit: '100-180%', color: 'yellow', risk: 'Medium', popular: true },
              { name: 'Gold Scalper Elite', investment: '$5K - $50K', profit: '150-250%', color: 'purple', risk: 'Med-High' },
              { name: 'BTC Scalper', investment: '$500 - $10K', profit: '80-200%', color: 'orange', risk: 'High' }
            ].map((ea, idx) => (
              <div key={idx} className={`relative bg-gradient-to-br ${
                ea.color === 'cyan' ? 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/30 hover:border-cyan-400' :
                ea.color === 'yellow' ? 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/30 hover:border-yellow-400' :
                ea.color === 'purple' ? 'from-purple-500/10 to-purple-500/5 border-purple-500/30 hover:border-purple-400' :
                'from-orange-500/10 to-orange-500/5 border-orange-500/30 hover:border-orange-400'
              } border rounded-xl p-3 sm:p-4 transition-all hover:scale-105`}>
                {ea.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
                  </div>
                )}
                <h3 className="text-white font-bold text-xs sm:text-base mb-1 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{ea.name}</h3>
                <div className="space-y-0.5 sm:space-y-1 text-[10px] sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Investment:</span>
                    <span className="text-white">{ea.investment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Profit:</span>
                    <span className={`font-bold ${
                      ea.color === 'cyan' ? 'text-cyan-400' :
                      ea.color === 'yellow' ? 'text-yellow-400' :
                      ea.color === 'purple' ? 'text-purple-400' :
                      'text-orange-400'
                    }`}>{ea.profit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risk:</span>
                    <span className="text-gray-300">{ea.risk}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <button 
              onClick={() => router.push('/ea-store')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400 text-black px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/25"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Store className="w-4 h-4 sm:w-5 sm:h-5" /> VISIT EA STORE <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Pricing Section */}
        <div id="pricing" className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs sm:text-sm">PRICING PLANS</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Choose Your AI Package</h2>
            <p className="text-gray-400 text-sm sm:text-base">Unlock the full potential of Mark's AI trading system</p>
          </div>
          
          {/* Mobile Tab Navigation */}
          <div className="flex md:hidden justify-center gap-2 mb-6 overflow-x-auto pb-2">
            {plans.map((plan, index) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanTab(index)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition ${
                  selectedPlanTab === index
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 text-cyan-300 border border-cyan-500/30'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {plan.name}
              </button>
            ))}
          </div>

          {/* Mobile Single Card View */}
          <div className="md:hidden">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading plans...</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No plans available. Please try again later.</p>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                {plans[selectedPlanTab] && (
                  <div className="relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-2xl p-6 border border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10">
                    {selectedPlanTab === 1 && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-4 py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>MOST POPULAR</span>
                      </div>
                    )}
                    <h3 className="text-2xl font-bold text-white mb-2 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plans[selectedPlanTab].name}</h3>
                    <p className="text-gray-400 text-sm mb-4 text-center">{plans[selectedPlanTab].description}</p>
                    <div className="mb-6 text-center">
                      <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plans[selectedPlanTab].price}</span>
                      <span className="text-gray-500 text-sm">/{plans[selectedPlanTab].duration_days} days</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center justify-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        {plans[selectedPlanTab].max_accounts} MT5 Account{plans[selectedPlanTab].max_accounts > 1 ? 's' : ''}
                      </li>
                      <li className="flex items-center justify-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        Full AI Trading
                      </li>
                      <li className="flex items-center justify-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        Gold Analysis
                      </li>
                      <li className="flex items-center justify-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        24/5 Support
                      </li>
                    </ul>
                    <button 
                      onClick={() => handleSubscribe(plans[selectedPlanTab])}
                      className="w-full py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black shadow-lg shadow-cyan-500/25"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      GET STARTED
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Grid View */}
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
            {loading ? (
              <div className="col-span-3 text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading plans...</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="col-span-3 text-center py-12">
                <p className="text-gray-400">No plans available. Please try again later.</p>
              </div>
            ) : null}
            {plans.map((plan, index) => (
              <div 
                key={plan.id} 
                className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-8 border transition-all hover:scale-105 ${
                  index === 1 ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10' : 'border-cyan-500/20 hover:border-cyan-500/40'
                }`}
              >
                {index === 1 && (
                  <div className="absolute -top-3 sm:-top-4 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 flex text-black text-[10px] sm:text-sm font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>MOST POPULAR</span>
                  </div>
                )}
                <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 text-center sm:text-left" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h3>
                <p className="text-gray-400 text-xs sm:text-base mb-2 sm:mb-4 text-center sm:text-left">{plan.description}</p>
                <div className="mb-4 sm:mb-6 text-center sm:text-left">
                  <span className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plan.price}</span>
                  <span className="text-gray-500 text-xs sm:text-base">/{plan.duration_days} days</span>
                </div>
                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-8">
                  <li className="flex items-center justify-center sm:justify-start gap-2 text-gray-300 text-xs sm:text-base">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
                    {plan.max_accounts} MT5 Account{plan.max_accounts > 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center justify-center sm:justify-start gap-2 text-gray-300 text-xs sm:text-base">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
                    Full AI Trading
                  </li>
                  <li className="flex items-center justify-center sm:justify-start gap-2 text-gray-300 text-xs sm:text-base">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
                    Gold Analysis
                  </li>
                  <li className="flex items-center justify-center sm:justify-start gap-2 text-gray-300 text-xs sm:text-base">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
                    24/5 Support
                  </li>
                </ul>
                <button 
                  onClick={() => handleSubscribe(plan)}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    index === 1 
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black shadow-lg shadow-cyan-500/25' 
                      : 'bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  GET STARTED
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Guidelines Section */}
        <div className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
              <span className="text-cyan-300 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>GUIDELINES</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Learn Before You Trade</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">Watch our video tutorials to set up EA correctly</p>
          </div>
          
          {/* Topic Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-10">
            {[
              { icon: Shield, title: 'Risk Management', desc: 'Learn proper lot sizing & capital protection', color: 'yellow', num: '01' },
              { icon: Settings, title: 'EA Configuration', desc: 'Optimal settings for maximum performance', color: 'purple', num: '02' },
              { icon: TrendingUp, title: 'Trading Strategies', desc: 'Master different trading modes', color: 'green', num: '03' },
              { icon: Zap, title: 'Quick Setup', desc: 'Get started in just 5 minutes', color: 'cyan', num: '04' }
            ].map((item, idx) => {
              const colorMap: Record<string, { border: string; hoverBorder: string; bg: string; icon: string; num: string; glow: string }> = {
                yellow: { border: 'border-yellow-500/20', hoverBorder: 'hover:border-yellow-400/50', bg: 'bg-yellow-500/10', icon: 'text-yellow-400', num: 'text-yellow-500/20', glow: 'group-hover:shadow-yellow-500/10' },
                purple: { border: 'border-purple-500/20', hoverBorder: 'hover:border-purple-400/50', bg: 'bg-purple-500/10', icon: 'text-purple-400', num: 'text-purple-500/20', glow: 'group-hover:shadow-purple-500/10' },
                green: { border: 'border-green-500/20', hoverBorder: 'hover:border-green-400/50', bg: 'bg-green-500/10', icon: 'text-green-400', num: 'text-green-500/20', glow: 'group-hover:shadow-green-500/10' },
                cyan: { border: 'border-cyan-500/20', hoverBorder: 'hover:border-cyan-400/50', bg: 'bg-cyan-500/10', icon: 'text-cyan-400', num: 'text-cyan-500/20', glow: 'group-hover:shadow-cyan-500/10' },
              };
              const c = colorMap[item.color];
              return (
                <div key={idx} className={`relative bg-[#12121a] border ${c.border} ${c.hoverBorder} rounded-xl sm:rounded-2xl p-3 sm:p-6 transition-all hover:scale-[1.03] cursor-pointer group overflow-hidden ${c.glow} hover:shadow-lg`} onClick={() => router.push('/guideline')}>
                  <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 text-2xl sm:text-4xl font-black ${c.num} select-none`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{item.num}</div>
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 ${c.bg} rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4 transition-transform group-hover:scale-110`}>
                    <item.icon className={`w-5 h-5 sm:w-7 sm:h-7 ${c.icon}`} />
                  </div>
                  <h3 className={`text-white font-bold text-xs sm:text-lg mb-0.5 sm:mb-2 transition-colors group-hover:${c.icon}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{item.title}</h3>
                  <p className="text-gray-500 text-[10px] sm:text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
          
          {/* CTA Banner */}
          <div className="relative bg-gradient-to-br from-[#0d1117] to-[#12121a] border border-cyan-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-yellow-500/5" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-5">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Video Tutorials</h3>
                  <p className="text-gray-400 text-[11px] sm:text-sm">15+ step-by-step videos from installation to advanced strategies</p>
                </div>
              </div>
              <button 
                onClick={() => router.push('/guideline')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-base transition-all w-full sm:w-auto justify-center shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> WATCH NOW
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <Cpu className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
              <span className="text-cyan-300 text-xs sm:text-sm">SIMPLE SETUP</span>
            </div>
            <h2 className="text-xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>How It Works?</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-8 max-w-4xl mx-auto">
            <div className="text-center group">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-500/20 to-yellow-500/10 border border-cyan-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:border-cyan-400 transition-all">
                <span className="text-xl sm:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>01</span>
              </div>
              <h3 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Subscribe</h3>
              <p className="text-gray-400 text-[10px] sm:text-base">Get instant access</p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-500/20 to-yellow-500/10 border border-cyan-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:border-cyan-400 transition-all">
                <span className="text-xl sm:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>02</span>
              </div>
              <h3 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Install</h3>
              <p className="text-gray-400 text-[10px] sm:text-base">Add to MT5</p>
            </div>
            <div className="text-center group">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-500/20 to-yellow-500/10 border border-cyan-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:border-cyan-400 transition-all">
                <span className="text-xl sm:text-3xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>03</span>
              </div>
              <h3 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Profit</h3>
              <p className="text-gray-400 text-[10px] sm:text-base">Trade 24/5</p>
            </div>
          </div>
        </div>

        {/* Exness Broker Recommendation */}
        <div className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs sm:text-sm">RECOMMENDED BROKER</span>
            </div>
            <h2 className="text-xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Open Your Trading Account</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
              Our EA works best with Exness Standard Cent Account. Get started in minutes.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <ExnessBroker variant="full" />
          </div>
        </div>

        <div className="border-t border-cyan-500/10 pt-6 sm:pt-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-block bg-gradient-to-r from-green-500/10 to-green-400/5 border border-green-500/30 rounded-2xl p-6 sm:p-8 max-w-2xl mx-4">
              <Gift className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Start Earning with Referrals!
              </h3>
              <p className="text-gray-400 text-sm sm:text-base mb-4">
                Refer friends and earn 10% commission on all their purchases
              </p>
              <Link 
                href="/dashboard/referral"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Gift className="w-5 h-5" />
                Get My Referral Code
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
