'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Shield, X, Sparkles } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://localhost:8000/api'

interface ValidationResult {
  valid: boolean
  message: string
  expires_at?: string
  days_remaining?: number
  plan?: string
  mt5_account?: string
}

interface Plan {
  id: number
  name: string
  description: string
  price: string
  duration_days: number
  max_accounts: number
}

export default function ValidationPage() {
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [extendingPlan, setExtendingPlan] = useState<number | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    setLoadingPlans(true)
    try {
      const response = await axios.get(`${API_URL}/plans/`)
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
      setLoadingPlans(false)
    }
  }

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await axios.post(`${API_URL}/validation/`, {
        license_key: licenseKey
      })
      setResult(response.data)
    } catch (err: any) {
      setResult({
        valid: false,
        message: err.response?.data?.message || 'Connection error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExtendLicense = async (planId: number) => {
    setExtendingPlan(planId)
    try {
      // TODO: Implement extend license API call
      const response = await axios.post(`${API_URL}/extend-license/`, {
        license_key: licenseKey,
        plan_id: planId
      })
      
      // Show success message
      alert('License extended successfully!')
      setShowExtendModal(false)
      
      // Re-validate to show updated info
      handleValidate(new Event('submit') as any)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to extend license')
    } finally {
      setExtendingPlan(null)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">License Validation</h1>
        </div>

        <form onSubmit={handleValidate} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">License Key</label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 font-mono text-sm"
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating...
              </>
            ) : (
              'Validate License'
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-xl ${result.valid ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.valid ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <span className={`font-semibold ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                {result.valid ? 'Valid License' : 'Invalid License'}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{result.message}</p>
            
            {result.valid && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1 text-sm text-gray-300">
                  <p><strong>Plan:</strong> {result.plan}</p>
                  <p><strong>Days Remaining:</strong> {result.days_remaining}</p>
                </div>
                <button
                  onClick={() => setShowExtendModal(true)}
                  className="w-full py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Extend License
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-700/50 rounded-xl">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">API Endpoint:</strong><br />
            <code className="text-purple-400">POST {API_URL}/validation/</code>
          </p>
        </div>

        <div className="mt-4 text-center">
          <a href="/" className="text-purple-400 hover:text-purple-300 text-sm">
            ← Back to Home
          </a>
        </div>
      </div>

      {/* Extend License Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Extend Your License</h2>
              </div>
              <button
                onClick={() => setShowExtendModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingPlans ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                <p className="text-gray-400">Loading plans...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl p-6 border transition-all hover:scale-105 ${
                      index === 1
                        ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10'
                        : 'border-cyan-500/20 hover:border-cyan-500/40'
                    }`}
                  >
                    {index === 1 && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-white mb-2 text-center">
                      {plan.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 text-center">
                      {plan.description}
                    </p>
                    <div className="mb-6 text-center">
                      <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400">
                        ${plan.price}
                      </span>
                      <span className="text-gray-500 text-sm">
                        /{plan.duration_days} days
                      </span>
                    </div>
                    <ul className="space-y-2 mb-6">
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        {plan.max_accounts} MT5 Account{plan.max_accounts > 1 ? 's' : ''}
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        AI-Powered Trading
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        24/7 Support
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        Regular Updates
                      </li>
                    </ul>
                    <button
                      onClick={() => handleExtendLicense(plan.id)}
                      disabled={extendingPlan === plan.id}
                      className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        index === 1
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black shadow-lg shadow-cyan-500/25'
                          : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {extendingPlan === plan.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>Extend Now</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
