'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Shield, Zap, Clock, TrendingUp, Star, ArrowRight, X, Copy, Loader2, LogIn } from 'lucide-react'
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

  const features = [
    { icon: TrendingUp, title: 'Grid Trading', description: 'Automated grid strategy for consistent profits' },
    { icon: Shield, title: 'Risk Management', description: 'Built-in stop loss and take profit controls' },
    { icon: Zap, title: 'Fast Execution', description: 'Lightning-fast order execution on MT5' },
    { icon: Clock, title: '24/7 Trading', description: 'Works around the clock while you sleep' },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/50 rounded-full px-4 py-2 mb-6">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-purple-300 text-sm">Professional MT5 Expert Advisor</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Hedge Grid Trailing EA
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Advanced grid trading system with intelligent trailing stops. 
            Maximize your forex profits with our proven automated strategy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isLoggedIn ? (
              <>
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all"
                >
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </button>
                <span className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-4 rounded-xl font-medium border border-white/20">
                  👋 Welcome, {userName}
                </span>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setShowRegisterModal(true)}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all"
                >
                  Create Account <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold transition-all border border-white/20"
                >
                  <LogIn className="w-5 h-5" /> Login
                </button>
              </>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature, index) => (
            <div key={index} className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all">
              <feature.icon className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Pricing Section */}
        <div id="pricing" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h2>
            <p className="text-gray-400">Select the subscription that fits your trading needs</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
                className={`relative bg-white/5 backdrop-blur-lg rounded-2xl p-8 border transition-all hover:scale-105 ${
                  index === 1 ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-white/10'
                }`}
              >
                {index === 1 && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-600 text-white text-sm px-4 py-1 rounded-full">Most Popular</span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-400">/{plan.duration_days} days</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    {plan.max_accounts} MT5 Account{plan.max_accounts > 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Full EA Features
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Automatic Updates
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Email Support
                  </li>
                </ul>
                <button 
                  onClick={() => handleSubscribe(plan)}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    index === 1 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {isLoggedIn ? 'Purchase Now' : 'Login to Purchase'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Subscribe</h3>
              <p className="text-gray-400">Choose a plan and get your license key instantly</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Install EA</h3>
              <p className="text-gray-400">Download and install the EA on your MT5 platform</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Start Trading</h3>
              <p className="text-gray-400">Enter your license key and start automated trading</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-white/10 pt-8">
          <p className="text-gray-400">
            © 2024 Super Grid Scalper. Developed by Alimul Islam. Contact: +8801957045438
          </p>
        </div>
      </div>
    </main>
  )
}
