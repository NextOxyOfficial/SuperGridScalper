'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Shield, Zap, Clock, TrendingUp, Star, ArrowRight, X, Copy, Loader2 } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://localhost:8000/api'

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
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mt5Account, setMt5Account] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [licenseResult, setLicenseResult] = useState<LicenseResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${API_URL}/plans/`)
        setPlans(response.data.plans || [])
      } catch (error) {
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
    setSelectedPlan(plan)
    setShowModal(true)
    setError('')
    setLicenseResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await axios.post(`${API_URL}/subscribe/`, {
        email,
        password,
        plan_id: selectedPlan?.id,
        mt5_account: mt5Account
      })

      if (response.data.success) {
        setLicenseResult(response.data.license)
      } else {
        setError(response.data.message || 'Subscription failed')
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
      {/* Subscribe Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>

            {!licenseResult ? (
              <>
                <h3 className="text-2xl font-bold text-white mb-2">Subscribe to {selectedPlan?.name}</h3>
                <p className="text-gray-400 mb-6">${selectedPlan?.price} for {selectedPlan?.duration_days} days</p>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <label className="block text-gray-300 mb-2">MT5 Account Number</label>
                    <input
                      type="text"
                      value={mt5Account}
                      onChange={(e) => setMt5Account(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                      placeholder="Your MT5 account number"
                      required
                    />
                    <p className="text-gray-500 text-xs mt-1">License will be bound to this account only</p>
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
                        Processing...
                      </>
                    ) : (
                      <>Complete Subscription</>
                    )}
                  </button>
                </form>

                <p className="text-gray-500 text-sm mt-4 text-center">
                  New user? Account will be created automatically.
                </p>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Subscription Successful!</h3>
                <p className="text-gray-400 mb-6">Your license key has been generated</p>

                <div className="bg-slate-700 rounded-xl p-4 mb-4">
                  <p className="text-gray-400 text-sm mb-2">Your License Key</p>
                  <div className="flex items-center gap-2">
                    <code className="text-green-400 font-mono text-sm break-all flex-1">
                      {licenseResult.license_key}
                    </code>
                    <button
                      onClick={copyLicenseKey}
                      className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-all"
                    >
                      <Copy className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  {copied && <p className="text-green-400 text-sm mt-2">Copied!</p>}
                </div>

                <div className="text-left bg-slate-700/50 rounded-xl p-4 mb-6">
                  <p className="text-gray-300"><strong>Plan:</strong> {licenseResult.plan}</p>
                  <p className="text-gray-300"><strong>Valid for:</strong> {licenseResult.days_remaining} days</p>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold"
                >
                  Done
                </button>
              </div>
            )}
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
            <a href="#pricing" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all">
              Get Started <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#features" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold transition-all border border-white/20">
              Learn More
            </a>
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
                  Subscribe Now
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
