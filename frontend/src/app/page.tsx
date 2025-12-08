'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Shield, Zap, Clock, TrendingUp, Star, ArrowRight, X, Copy, Loader2, LogIn, Bot, Cpu, Activity, Target, Sparkles, Store, BookOpen, Settings } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://127.0.0.1:8000/api'

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

export default function Home() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [licenseResult, setLicenseResult] = useState<LicenseResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')
  
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

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user')
    const licensesData = localStorage.getItem('licenses')
    if (userData && licensesData) {
      setIsLoggedIn(true)
      const user = JSON.parse(userData)
      setUserName(user.email || 'User')
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
    if (!isLoggedIn) {
      // Show login modal if not logged in
      setSelectedPlan(plan)
      setShowLoginModal(true)
      setError('')
      return
    }
    // If logged in, redirect to dashboard to purchase
    router.push('/dashboard?tab=purchase&plan=' + plan.id)
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
        first_name: firstName
      })

      if (response.data.success) {
        // Auto login after registration
        localStorage.setItem('user', JSON.stringify(response.data.user))
        localStorage.setItem('licenses', JSON.stringify(response.data.licenses || []))
        setIsLoggedIn(true)
        setUserName(response.data.user.name || response.data.user.email)
        setShowRegisterModal(false)
        // Clear form
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setFirstName('')
        // Redirect to dashboard
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

  const copyLicenseKey = () => {
    if (licenseResult) {
      navigator.clipboard.writeText(licenseResult.license_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEmail('')
    setPassword('')
    setMt5Account('')
    setError('')
    setLicenseResult(null)
    setSelectedPlan(null)
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowRegisterModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">Create Account</h3>
            <p className="text-gray-400 mb-6">Register to purchase licenses</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="Confirm password"
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>Create Account</>
                )}
              </button>
            </form>

            <p className="text-gray-500 text-sm mt-4 text-center">
              Already have an account?{' '}
              <button 
                onClick={() => { setShowRegisterModal(false); setShowLoginModal(true); setError(''); }}
                className="text-purple-400 hover:text-purple-300"
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">Login to Dashboard</h3>
            <p className="text-gray-400 mb-6">Access your trading dashboard</p>

            <form onSubmit={async (e) => {
              e.preventDefault()
              setError('')
              setSubmitting(true)
              try {
                const response = await axios.post(`${API_URL}/login/`, { email, password })
                if (response.data.success) {
                  localStorage.setItem('user', JSON.stringify(response.data.user))
                  localStorage.setItem('licenses', JSON.stringify(response.data.licenses))
                  router.push('/dashboard')
                } else {
                  setError(response.data.message || 'Login failed')
                }
              } catch (err: any) {
                setError(err.response?.data?.message || 'Invalid credentials')
              }
              setSubmitting(false)
            }} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  placeholder="Your password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>Login</>
                )}
              </button>
            </form>

            <p className="text-gray-500 text-sm mt-4 text-center">
              Don't have an account?{' '}
              <button 
                onClick={() => { setShowLoginModal(false); setShowRegisterModal(true); setError(''); }}
                className="text-purple-400 hover:text-purple-300"
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Navigation - Mobile Optimized */}
      <nav className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <span className="text-sm sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isLoggedIn ? (
              <button onClick={() => router.push('/dashboard')} className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-all" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Dashboard
              </button>
            ) : (
              <>
                <button onClick={() => setShowLoginModal(true)} className="px-2 sm:px-4 py-1.5 sm:py-2 text-cyan-400 hover:text-cyan-300 font-medium transition-all text-xs sm:text-sm border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10">
                  Login
                </button>
                <button onClick={() => setShowRegisterModal(true)} className="px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg transition-all">
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="container mx-auto px-3 sm:px-4 py-10 sm:py-20">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            
            {/* Left Side - Text Content */}
            <div className="flex-1 text-center lg:text-left max-w-2xl">
              {/* Typing Effect Description - AT TOP */}
              <div className="h-16 sm:h-20 md:h-16 flex items-center justify-center lg:justify-start mb-4 sm:mb-6">
                <p className="text-white max-w-3xl text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <span className="text-yellow-400">&gt;</span>{' '}
                  <span className="capitalize">{typedText}</span>
                  <span className="inline-block w-1 h-5 sm:h-7 md:h-8 bg-cyan-400 ml-1 sm:ml-2 animate-pulse" />
                </p>
              </div>
              
              {/* AI Badge */}
              <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-black/50 border border-cyan-500/50 rounded-full px-3 sm:px-5 py-1.5 sm:py-2 mb-4 sm:mb-6 backdrop-blur-md">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-pulse" />
                <span className="text-cyan-300 text-[10px] sm:text-sm tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>POWERED BY AI</span>
              </div>
              
              {/* Main Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-yellow-400 mb-1 sm:mb-2 drop-shadow-2xl" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                MARK'S AI 3.0
              </h1>
              <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 mb-3 sm:mb-4 drop-shadow-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                ADVANCE SCALPER
              </h2>
              
              {/* Tagline */}
              <p className="text-sm sm:text-lg md:text-xl text-cyan-300 mb-4 sm:mb-6 font-light drop-shadow-lg">
                The Most Powerful Automated Gold AI Trading
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-6 sm:mb-8">
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
              <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:justify-center lg:justify-start sm:gap-6 md:gap-8 py-3 sm:py-4 px-3 sm:px-6 bg-black/30 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-cyan-500/20">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>99.2%</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>24/7</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Auto</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>0.001s</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Speed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>5000+</div>
                  <div className="text-gray-500 text-[9px] sm:text-xs md:text-sm">Traders</div>
                </div>
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
                      <div className="text-green-400 text-sm sm:text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>98.7%</div>
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

        {/* Progress Steps - Catchy Section */}
        <div className="mb-12 sm:mb-24 relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-yellow-500/5 to-green-500/5 rounded-3xl blur-xl" />
          
          <div className="relative bg-gradient-to-r from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] border border-cyan-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 overflow-hidden">
            {/* Animated background lines */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(6,182,212,0.03)_50%,transparent_100%)] animate-pulse" />
            
            <div className="relative z-10">
              <div className="text-center mb-6 sm:mb-10">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Start Earning in <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400">4 Simple Steps</span>
                </h2>
                <p className="text-gray-500 text-xs sm:text-base">From download to withdrawal - it's that easy!</p>
              </div>
              
              {/* Progress Steps - 2x2 grid on mobile, row on desktop */}
              <div className="grid grid-cols-2 md:flex md:flex-row items-center justify-between gap-4 md:gap-0">
                {[
                  { step: 1, icon: '📥', title: 'Download', subtitle: 'Get EA from Store', color: 'cyan' },
                  { step: 2, icon: '⚙️', title: 'Install EA', subtitle: 'Add to MT5 Terminal', color: 'yellow' },
                  { step: 3, icon: '💰', title: 'Enjoy Profit', subtitle: 'Every Minute', color: 'green' },
                  { step: 4, icon: '🏦', title: 'Withdraw', subtitle: 'Your Earnings', color: 'purple' }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center">
                    {/* Step Card */}
                    <div className={`relative group w-full`}>
                      <div className={`w-full h-28 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br ${
                        item.color === 'cyan' ? 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 group-hover:border-cyan-400 group-hover:shadow-cyan-500/20' :
                        item.color === 'yellow' ? 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 group-hover:border-yellow-400 group-hover:shadow-yellow-500/20' :
                        item.color === 'green' ? 'from-green-500/20 to-green-500/5 border-green-500/30 group-hover:border-green-400 group-hover:shadow-green-500/20' :
                        'from-purple-500/20 to-purple-500/5 border-purple-500/30 group-hover:border-purple-400 group-hover:shadow-purple-500/20'
                      } border flex flex-col items-center justify-center transition-all group-hover:scale-105 group-hover:shadow-lg`}>
                        <span className="text-3xl mb-1">{item.icon}</span>
                        <span className={`text-xs font-bold ${
                          item.color === 'cyan' ? 'text-cyan-400' :
                          item.color === 'yellow' ? 'text-yellow-400' :
                          item.color === 'green' ? 'text-green-400' :
                          'text-purple-400'
                        }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{item.title}</span>
                        <span className="text-gray-500 text-[10px]">{item.subtitle}</span>
                      </div>
                      {/* Step number badge */}
                      <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        item.color === 'cyan' ? 'bg-cyan-500 text-black' :
                        item.color === 'yellow' ? 'bg-yellow-500 text-black' :
                        item.color === 'green' ? 'bg-green-500 text-black' :
                        'bg-purple-500 text-black'
                      }`}>{item.step}</div>
                    </div>
                    
                    {/* Arrow connector (not on last item) - Desktop only */}
                    {idx < 3 && (
                      <div className="hidden md:flex items-center mx-4">
                        <div className={`w-12 h-0.5 ${
                          item.color === 'cyan' ? 'bg-gradient-to-r from-cyan-500 to-yellow-500' :
                          item.color === 'yellow' ? 'bg-gradient-to-r from-yellow-500 to-green-500' :
                          'bg-gradient-to-r from-green-500 to-purple-500'
                        }`} />
                        <div className={`w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent ${
                          item.color === 'cyan' ? 'border-l-yellow-500' :
                          item.color === 'yellow' ? 'border-l-green-500' :
                          'border-l-purple-500'
                        }`} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Bottom tagline */}
              <div className="text-center mt-10">
                <p className="text-lg md:text-xl text-gray-300 mb-4">
                  <span className="text-cyan-400 font-bold">No trading experience needed.</span> Let AI do the work for you.
                </p>
                <button 
                  onClick={() => router.push('/ea-store')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  START EARNING NOW <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* EA Store Preview Section */}
        <div className="mb-12 sm:mb-24">
          <div className="text-center mb-6 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
              <Store className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>EA STORE</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Choose Your Trading AI</h2>
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
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>Choose Your AI Power</h2>
            <p className="text-gray-400 text-sm sm:text-base">Unlock the full potential of Mark's AI trading system</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
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
                  <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-[10px] sm:text-sm font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>MOST POPULAR</span>
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
                    24/7 Support
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
                  {isLoggedIn ? 'ACTIVATE NOW' : 'GET STARTED'}
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
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[
              { icon: Shield, title: 'Risk Mgmt', desc: 'Lot sizing & capital', color: 'yellow' },
              { icon: Settings, title: 'EA Config', desc: 'Optimal settings', color: 'purple' },
              { icon: TrendingUp, title: 'Strategies', desc: 'Trading modes', color: 'green' },
              { icon: Zap, title: 'Quick Setup', desc: '5 min install', color: 'cyan' }
            ].map((item, idx) => (
              <div key={idx} className={`bg-[#12121a] border ${
                item.color === 'yellow' ? 'border-yellow-500/20 hover:border-yellow-400/50' :
                item.color === 'purple' ? 'border-purple-500/20 hover:border-purple-400/50' :
                item.color === 'green' ? 'border-green-500/20 hover:border-green-400/50' :
                'border-cyan-500/20 hover:border-cyan-400/50'
              } rounded-xl p-3 sm:p-5 transition-all hover:scale-105 cursor-pointer group`} onClick={() => router.push('/guideline')}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${
                  item.color === 'yellow' ? 'bg-yellow-500/20' :
                  item.color === 'purple' ? 'bg-purple-500/20' :
                  item.color === 'green' ? 'bg-green-500/20' :
                  'bg-cyan-500/20'
                } rounded-xl flex items-center justify-center mb-2 sm:mb-3`}>
                  <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                    item.color === 'yellow' ? 'text-yellow-400' :
                    item.color === 'purple' ? 'text-purple-400' :
                    item.color === 'green' ? 'text-green-400' :
                    'text-cyan-400'
                  }`} />
                </div>
                <h3 className="text-white font-bold text-xs sm:text-base mb-0.5 sm:mb-1 group-hover:text-cyan-400 transition">{item.title}</h3>
                <p className="text-gray-500 text-[10px] sm:text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          
          <div className="bg-gradient-to-r from-cyan-500/10 to-yellow-500/10 border border-cyan-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Video Tutorials</h3>
                <p className="text-gray-400 text-[10px] sm:text-sm">15+ videos from installation to strategies</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/guideline')}
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-xs sm:text-base transition-all w-full md:w-auto justify-center"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" /> WATCH
            </button>
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
              <p className="text-gray-400 text-[10px] sm:text-base">Trade 24/7</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-cyan-500/10 pt-6 sm:pt-8 pb-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
            </div>
            <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm px-4">
            © 2024 Mark's AI - Advance Scalper
          </p>
          <p className="text-gray-600 text-[10px] sm:text-xs mt-1 sm:mt-2 px-4">
            Trading involves risk. Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </main>
  )
}
