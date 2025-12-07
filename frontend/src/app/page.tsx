'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Database, Server, Layout } from 'lucide-react'
import axios from 'axios'

interface HealthStatus {
  status: string
  database: string
  message: string
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await axios.get<HealthStatus>('http://localhost:8000/api/health')
        setHealthData(response.data)
        setBackendStatus('connected')
      } catch (error) {
        setBackendStatus('error')
      }
    }

    checkBackend()
    const interval = setInterval(checkBackend, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Super Grid Scalper
          </h1>
          <p className="text-xl text-gray-300">
            Full-Stack Application Ready for Development
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          {/* Frontend Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Layout className="w-8 h-8 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Frontend</h2>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">Next.js Running</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">Port 3000</p>
          </div>

          {/* Backend Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-8 h-8 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Backend</h2>
            </div>
            <div className="flex items-center gap-2">
              {backendStatus === 'loading' && (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                  <span className="text-yellow-400">Connecting...</span>
                </>
              )}
              {backendStatus === 'connected' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">FastAPI Running</span>
                </>
              )}
              {backendStatus === 'error' && (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Not Connected</span>
                </>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-2">Port 8000</p>
          </div>

          {/* Database Status */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-8 h-8 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Database</h2>
            </div>
            <div className="flex items-center gap-2">
              {backendStatus === 'loading' && (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                  <span className="text-yellow-400">Checking...</span>
                </>
              )}
              {backendStatus === 'connected' && healthData?.database === 'connected' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">PostgreSQL Connected</span>
                </>
              )}
              {(backendStatus === 'error' || healthData?.database === 'disconnected') && (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Not Connected</span>
                </>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-2">super_grid</p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-semibold text-white text-center mb-8">
            Tech Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Next.js 14', color: 'bg-black' },
              { name: 'React 18', color: 'bg-blue-600' },
              { name: 'FastAPI', color: 'bg-emerald-600' },
              { name: 'PostgreSQL', color: 'bg-blue-800' },
              { name: 'TypeScript', color: 'bg-blue-500' },
              { name: 'Tailwind CSS', color: 'bg-cyan-500' },
              { name: 'SQLAlchemy', color: 'bg-red-600' },
              { name: 'Axios', color: 'bg-purple-600' },
            ].map((tech) => (
              <div
                key={tech.name}
                className={`${tech.color} rounded-lg px-4 py-3 text-center text-white font-medium shadow-lg`}
              >
                {tech.name}
              </div>
            ))}
          </div>
        </div>

        {/* Ready Message */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/50 rounded-full px-6 py-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">
              Project Ready - Start Building Your Business Idea!
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
