'use client';

import { useState } from 'react';
import { useDashboard } from '../../context';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Shield, TrendingUp, Users, DollarSign, CheckCircle,
  AlertTriangle, Send, Loader2, Star
} from 'lucide-react';

export default function ApplyFMPage() {
  const { user, API_URL } = useDashboard();
  const router = useRouter();
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    trading_style: 'Scalping',
    trading_pairs: 'XAUUSD',
    monthly_price: '49.99',
    experience_years: '',
    why_apply: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.display_name || !form.bio || !form.why_apply) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/fund-managers/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Application failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-1 sm:px-4 py-16 text-center">
        <div className="bg-[#12121a] border border-green-500/20 rounded-2xl p-10">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Application Submitted!
          </h2>
          <p className="text-gray-400 mb-6">
            Your application to join FM Engine has been submitted for review.
            Our team will evaluate your profile and get back to you within 24-48 hours.
          </p>
          <button
            onClick={() => router.push('/dashboard/fund-managers')}
            className="bg-cyan-500 text-black px-6 py-3 rounded-lg font-bold hover:bg-cyan-400 transition"
          >
            Back to FM Engine
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-4 py-6">
      {/* Header */}
      <button onClick={() => router.push('/dashboard/fund-managers')} className="text-cyan-400 hover:text-cyan-300 text-sm mb-4 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Marketplace
      </button>
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Join FM Engine
        </h1>
        <p className="text-gray-400">Join the community network — share your expertise, manage traders&apos; EA bots, and earn</p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: DollarSign, title: 'Earn Monthly Revenue', desc: 'Set your own subscription price', color: 'text-green-400' },
          { icon: Users, title: 'Grow Your Community', desc: 'Build a subscriber base', color: 'text-cyan-400' },
          { icon: TrendingUp, title: 'Control EA Remotely', desc: 'Toggle EA on/off for all subscribers', color: 'text-purple-400' },
        ].map((b, i) => (
          <div key={i} className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-5 text-center">
            <b.icon className={`w-8 h-8 ${b.color} mx-auto mb-3`} />
            <div className="text-white font-medium text-sm mb-1">{b.title}</div>
            <div className="text-gray-500 text-xs">{b.desc}</div>
          </div>
        ))}
      </div>

      {/* Application Form */}
      <div className="bg-[#12121a] border border-cyan-500/10 rounded-2xl p-6 space-y-5">
        <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-3">Application Details</h3>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">Display Name *</label>
          <input
            type="text"
            placeholder="e.g., Gold Master Trading"
            value={form.display_name}
            onChange={e => setForm({ ...form, display_name: e.target.value })}
            className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">Bio / Description *</label>
          <textarea
            rows={4}
            placeholder="Tell traders about your trading experience, strategy, and what makes you different..."
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm resize-none"
          />
        </div>

        {/* Two Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Trading Style */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Trading Style</label>
            <select
              value={form.trading_style}
              onChange={e => setForm({ ...form, trading_style: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white text-sm"
            >
              <option value="Scalping">Scalping</option>
              <option value="Day Trading">Day Trading</option>
              <option value="Swing Trading">Swing Trading</option>
              <option value="Grid Trading">Grid Trading</option>
              <option value="Martingale">Martingale</option>
              <option value="Hedging">Hedging</option>
              <option value="Mixed">Mixed Strategies</option>
            </select>
          </div>

          {/* Trading Pairs */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Trading Pairs</label>
            <div className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-cyan-300 text-sm flex items-center gap-2">
              <span className="font-bold tracking-wider">XAUUSD</span>
              <span className="text-gray-600 text-xs">(Gold — only supported pair)</span>
            </div>
          </div>

          {/* Monthly Price */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Monthly Subscription Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="49.99"
              value={form.monthly_price}
              onChange={e => setForm({ ...form, monthly_price: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm"
            />
            <p className="text-gray-600 text-xs mt-1">Platform takes 15% commission</p>
          </div>

          {/* Experience */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Years of Trading Experience</label>
            <input
              type="number"
              min="0"
              placeholder="e.g., 3"
              value={form.experience_years}
              onChange={e => setForm({ ...form, experience_years: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm"
            />
          </div>
        </div>

        {/* Why Apply */}
        <div>
          <label className="text-gray-400 text-sm mb-1 block">Why do you want to become a Fund Manager? *</label>
          <textarea
            rows={3}
            placeholder="What value will you bring to subscribers? Describe your track record..."
            value={form.why_apply}
            onChange={e => setForm({ ...form, why_apply: e.target.value })}
            className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm resize-none"
          />
        </div>

        {/* Requirements Notice */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
          <h4 className="text-yellow-400 text-sm font-medium mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Requirements
          </h4>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>• Must have an active license with verified trading history</li>
            <li>• Minimum 1 month of trading activity on the platform</li>
            <li>• Applications are reviewed within 24-48 hours</li>
            <li>• Approved managers start at Bronze tier and can be promoted based on performance</li>
          </ul>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white py-3.5 rounded-lg font-bold hover:from-cyan-400 hover:to-purple-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="w-5 h-5" /> Submit Application</>
          )}
        </button>
      </div>
    </div>
  );
}
