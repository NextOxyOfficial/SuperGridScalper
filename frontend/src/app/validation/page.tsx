'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Shield } from 'lucide-react'
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

export default function ValidationPage() {
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)

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
              <div className="mt-3 space-y-1 text-sm text-gray-300">
                <p><strong>Plan:</strong> {result.plan}</p>
                <p><strong>Days Remaining:</strong> {result.days_remaining}</p>
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
    </main>
  )
}
