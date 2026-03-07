'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { Server, Cpu, HardDrive, Globe, Shield, Zap, CheckCircle, Loader2, Upload, Copy, Clock, Eye, EyeOff, ArrowRight, Monitor, Wifi, AlertTriangle, ChevronDown, ChevronUp, Bot, Star, Lock, Headphones } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

// Single VPS Configuration
const VPS_CONFIG = {
  name: 'Forex VPS',
  description: 'Perfect for running your EA 24/7',
  cpu: '2 vCPU',
  ram: '4 GB',
  storage: '80 GB SSD',
  os: 'Windows Server 2022',
  bandwidth: 'Unlimited',
  location: 'New York, USA',
  price_monthly: 20,
  price_quarterly: 54,
  price_yearly: 192,
  features: [
    'Windows Server 2022',
    'MetaTrader 5 Pre-Installed',
    "Mark's AI EA Pre-Loaded",
    'Full RDP Access',
    'Up to 3 MT5 Instances',
    '99.99% Uptime SLA',
    '24/7 Priority Support',
    'Faster Execution Speed',
  ],
};

interface PaymentNetwork {
  id: number;
  name: string;
  code: string;
  token_symbol: string;
  wallet_address: string;
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export default function VPSLandingPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<PaymentNetwork[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  // Order modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [txid, setTxid] = useState('');
  const [userNote, setUserNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchNetworks();
    // Pre-fill email if logged in
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.email) setEmail(user.email);
      } catch {}
    }
  }, []);

  const fetchNetworks = async () => {
    try {
      const res = await fetch(`${API_URL}/payment-networks/`);
      const data = await res.json();
      if (data.success) setNetworks(data.networks);
    } catch (e) { console.error(e); }
  };

  const getPrice = (cycle: BillingCycle) => {
    if (cycle === 'quarterly') return VPS_CONFIG.price_quarterly;
    if (cycle === 'yearly') return VPS_CONFIG.price_yearly;
    return VPS_CONFIG.price_monthly;
  };

  const getSavings = (cycle: BillingCycle) => {
    const monthly = VPS_CONFIG.price_monthly;
    if (cycle === 'quarterly') return Math.round((1 - VPS_CONFIG.price_quarterly / (monthly * 3)) * 100);
    if (cycle === 'yearly') return Math.round((1 - VPS_CONFIG.price_yearly / (monthly * 12)) * 100);
    return 0;
  };

  const handleOrder = () => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      // Redirect to login page
      router.push('/?auth=login');
      return;
    }

    setSelectedNetwork(null);
    setTxid('');
    setUserNote('');
    setProof(null);
    setSubmitResult(null);
    setShowOrderModal(true);
  };

  const handleSubmitOrder = async () => {
    if (!selectedNetwork || !proof || !email.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);

    const formData = new FormData();
    formData.append('email', email.trim());
    formData.append('plan_id', '1'); // Single VPS plan ID
    formData.append('billing_cycle', billingCycle);
    formData.append('network_id', String(selectedNetwork));
    formData.append('txid', txid);
    formData.append('user_note', userNote);
    formData.append('proof', proof);

    try {
      const res = await fetch(`${API_URL}/vps/order/`, { method: 'POST', body: formData });
      const data = await res.json();
      setSubmitResult({ success: data.success, message: data.message || data.error || 'Something went wrong' });
      if (data.success) {
        setTimeout(() => setShowOrderModal(false), 3000);
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    }
    setSubmitting(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const selectedNetworkObj = networks.find(n => n.id === selectedNetwork);

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      <Header />

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-1 sm:px-4 py-10 sm:py-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Text Content */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-2 mb-5">
                  <Server className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-300 text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>FOREX VPS HOSTING</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Run Your EA <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">24/7</span>
                  <br className="hidden sm:block" /> Without Interruption
                </h1>
                <p className="text-gray-400 text-sm sm:text-lg mb-8 leading-relaxed">
                  Stop losing trades because your computer shut down. Our Windows RDP Servers keep MetaTrader 5 running non-stop with ultra-low latency — so your EA never misses an opportunity.
                </p>
                <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 sm:gap-4">
                  <a
                    href="#plans"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-orange-500/25 hover:scale-105 w-full sm:w-auto justify-center"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Server className="w-5 h-5" /> VIEW PLANS & ORDER
                  </a>
                </div>
              </div>

              {/* Right: Windows RDP Image */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 blur-3xl rounded-full" />
                <img 
                  src="/windows-rdp.jpg" 
                  alt="Windows RDP Server" 
                  className="relative z-10 w-full h-auto max-h-[350px] sm:max-h-[450px] lg:max-h-[500px] object-cover rounded-2xl shadow-2xl shadow-orange-500/20 border border-orange-500/10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Trust Stats */}
        <section className="container mx-auto px-3 sm:px-4 pb-10 sm:pb-16">
          <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-3xl mx-auto">
            {[
              { value: '99.99%', label: 'Uptime SLA', icon: Shield, color: 'text-green-400' },
              { value: '<1ms', label: 'Latency', icon: Zap, color: 'text-yellow-400' },
              { value: '24/7', label: 'Support', icon: Headphones, color: 'text-cyan-400' },
              { value: 'Full', label: 'RDP Access', icon: Monitor, color: 'text-purple-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-2 sm:p-3 text-center hover:border-orange-500/20 transition">
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
                <div className="text-white text-sm sm:text-lg font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>{stat.value}</div>
                <div className="text-gray-500 text-[9px] sm:text-[10px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Plans Section - MOVED UP */}
        <section id="plans" className="container mx-auto px-1 sm:px-4 pb-12 sm:pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-2 mb-4">
                <Star className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>PRICING</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">VPS Plan</span>
              </h2>
              <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
                All plans include Windows Server 2022, MetaTrader 5, full RDP access, and 24/7 support.
              </p>
            </div>

            {/* Mobile: Billing Toggle */}
            <div className="md:hidden flex justify-center gap-2 mb-8">
              {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                    billingCycle === cycle
                      ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:border-orange-500/30 hover:text-white'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? '3 Months' : 'Yearly'}
                  {cycle === 'yearly' && <span className="ml-1 text-[10px] text-green-400 font-bold">SAVE</span>}
                </button>
              ))}
            </div>

            {/* Mobile: Single VPS Card */}
            <div className="md:hidden max-w-md mx-auto">
              <div className="relative bg-gradient-to-br from-[#12121a] to-[#0a0a0f] border border-orange-400 ring-2 ring-orange-400/30 shadow-lg shadow-orange-500/10 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>{VPS_CONFIG.name}</h3>
                <p className="text-gray-400 text-xs mb-4">{VPS_CONFIG.description}</p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { icon: Cpu, label: 'CPU', value: VPS_CONFIG.cpu, color: 'text-orange-400' },
                    { icon: Zap, label: 'RAM', value: VPS_CONFIG.ram, color: 'text-cyan-400' },
                    { icon: HardDrive, label: 'Storage', value: VPS_CONFIG.storage, color: 'text-green-400' },
                    { icon: Globe, label: 'Location', value: VPS_CONFIG.location, color: 'text-purple-400' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-2 text-center">
                      <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-0.5`} />
                      <div className="text-white text-xs font-semibold">{s.value}</div>
                      <div className="text-gray-500 text-[9px]">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-4 text-center">
                  <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${getPrice(billingCycle)}</span>
                  <span className="text-gray-500 text-sm">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? '3mo' : 'yr'}</span>
                  {getSavings(billingCycle) > 0 && <div className="text-green-400 text-xs font-semibold mt-1">Save {getSavings(billingCycle)}%</div>}
                </div>

                <ul className="space-y-1.5 mb-5">
                  {VPS_CONFIG.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleOrder}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black shadow-lg shadow-orange-500/25 hover:scale-[1.02]"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  ORDER NOW <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            </div>

            {/* Desktop: 3 Cards Side by Side */}
            <div className="hidden md:grid md:grid-cols-3 gap-4 lg:gap-6">
              {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((cycle) => {
                const price = getPrice(cycle);
                const savings = getSavings(cycle);
                return (
                  <div key={cycle} className={`relative bg-gradient-to-br from-[#12121a] to-[#0a0a0f] border rounded-2xl p-5 transition-all hover:scale-[1.02] ${
                    cycle === 'yearly' ? 'border-orange-400 ring-2 ring-orange-400/30 shadow-lg shadow-orange-500/10' : 'border-white/10 hover:border-orange-500/30'
                  }`}>
                    {cycle === 'yearly' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-orange-500 to-yellow-400 text-black text-[10px] font-bold px-3 py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>BEST VALUE</span>
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>{VPS_CONFIG.name}</h3>
                    <p className="text-gray-400 text-xs mb-4">{cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? '3 Months' : 'Yearly'}</p>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { icon: Cpu, label: 'CPU', value: VPS_CONFIG.cpu, color: 'text-orange-400' },
                        { icon: Zap, label: 'RAM', value: VPS_CONFIG.ram, color: 'text-cyan-400' },
                        { icon: HardDrive, label: 'Storage', value: VPS_CONFIG.storage, color: 'text-green-400' },
                        { icon: Globe, label: 'Location', value: VPS_CONFIG.location, color: 'text-purple-400' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-2 text-center">
                          <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-0.5`} />
                          <div className="text-white text-xs font-semibold">{s.value}</div>
                          <div className="text-gray-500 text-[9px]">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4 text-center">
                      <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${price}</span>
                      <span className="text-gray-500 text-sm">/{cycle === 'monthly' ? 'mo' : cycle === 'quarterly' ? '3mo' : 'yr'}</span>
                      {savings > 0 && <div className="text-green-400 text-xs font-semibold mt-1">Save {savings}%</div>}
                    </div>

                    <ul className="space-y-1.5 mb-5">
                      {VPS_CONFIG.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-gray-300 text-xs">
                          <CheckCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => { setBillingCycle(cycle); handleOrder(); }}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                        cycle === 'yearly'
                          ? 'bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black shadow-lg shadow-orange-500/25'
                          : 'bg-white/5 hover:bg-white/10 text-orange-300 border border-orange-500/30 hover:border-orange-400'
                      }`}
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      ORDER NOW <ArrowRight className="w-4 h-4 inline ml-1" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* What You Get Section - Tab Format for Mobile */}
        <section className="container mx-auto px-1 sm:px-4 pb-12 sm:pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">Trade Hands-Free</span>
              </h2>
              <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
                Each VPS comes fully configured — MetaTrader 5 installed, your EA ready to go. Just enter your trading account and license key.
              </p>
            </div>

            {/* Mobile: Stacked Cards, Desktop: Grid */}
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {[
                { icon: Monitor, title: 'Windows Server 2022', desc: 'Full Windows desktop accessible via Remote Desktop from any device — PC, Mac, tablet, or phone.', color: 'orange' },
                { icon: Bot, title: 'MetaTrader 5 Pre-Installed', desc: 'MT5 is already installed and configured. No setup needed — just log in with your broker credentials.', color: 'cyan' },
                { icon: Cpu, title: "Mark's AI EA Ready", desc: 'Your EA is pre-loaded on the server. Enter your license key, attach to chart, and start trading immediately.', color: 'yellow' },
                { icon: Zap, title: 'Ultra-Low Latency', desc: 'Servers located near major broker data centers for the fastest possible trade execution speed.', color: 'green' },
                { icon: Shield, title: '99.99% Uptime', desc: 'Enterprise-grade infrastructure with redundant power and network. Your EA stays online around the clock.', color: 'purple' },
                { icon: Headphones, title: '24/7 Priority Support', desc: 'Our team is always available to help with server issues, EA setup, or any questions you have.', color: 'pink' },
              ].map((item, i) => {
                const colorMap: Record<string, { bg: string; border: string; text: string }> = {
                  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
                  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400' },
                  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
                  green: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
                  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
                  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400' },
                };
                const c = colorMap[item.color];
                return (
                  <div key={i} className={`bg-[#12121a] border ${c.border} rounded-xl p-3 sm:p-4 flex sm:block items-start gap-3`}>
                    <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 ${c.bg} rounded-xl flex items-center justify-center sm:mb-3`}>
                      <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${c.text}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white text-sm sm:text-base font-bold mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>{item.title}</h3>
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-1 sm:px-4 pb-12 sm:pb-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {[
                { q: 'What is a Forex VPS?', a: 'A Forex VPS (Virtual Private Server) is a remote Windows computer that runs 24/7 in a data center. You connect to it via Remote Desktop (RDP) and run your MetaTrader 5 and EA on it — so your trading never stops, even when your personal computer is off.' },
                { q: 'Do I need to install anything?', a: 'No. Your VPS comes with Windows Server 2022, MetaTrader 5, and your EA already installed. Just log in via RDP, enter your broker trading account details and license key, and you\'re ready to trade.' },
                { q: 'How do I connect to my VPS?', a: 'You connect using Remote Desktop (built into Windows) or any RDP app on Mac/phone. We provide you with an IP address, username, and password. It takes 30 seconds to connect.' },
                { q: 'How long does setup take?', a: 'After payment verification, your server is typically ready within 1-24 hours. You\'ll receive an email with your RDP credentials as soon as it\'s ready.' },
                { q: 'Can I run multiple EAs or accounts?', a: 'Yes! You can run multiple MetaTrader 5 instances on your VPS. The number depends on your VPS plan resources (CPU, RAM).' },
                { q: 'What happens when my VPS expires?', a: 'You\'ll receive a reminder email before expiration. You can renew from your dashboard. If not renewed, the server will be deactivated but your data is kept for a grace period.' },
              ].map((faq, i) => (
                <details key={i} className="group bg-[#12121a] border border-white/5 rounded-xl overflow-hidden hover:border-orange-500/20 transition">
                  <summary className="flex items-center justify-between p-4 cursor-pointer text-white text-sm font-medium">
                    {faq.q}
                    <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" />
                  </summary>
                  <div className="px-4 pb-4 text-gray-400 text-xs sm:text-sm leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-1 sm:px-4 pb-12 sm:pb-20">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-gradient-to-br from-orange-500/10 via-[#12121a] to-yellow-500/5 border border-orange-500/30 rounded-2xl p-6 sm:p-10 text-center overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
              <Server className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h2 className="text-xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Ready to Trade 24/7?
              </h2>
              <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-6">
                Stop worrying about your PC crashing or internet going down. Get a dedicated VPS and let your EA work around the clock.
              </p>
              <a
                href="#plans"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-orange-500/25 hover:scale-105"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Server className="w-5 h-5" /> GET YOUR VPS NOW
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-6 sm:py-8 text-center text-gray-600 text-xs">
          <div className="container mx-auto px-4">
            &copy; {new Date().getFullYear()} Mark&apos;s AI Trading. All rights reserved.
          </div>
        </footer>
      </div>

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOrderModal(false)}>
          <div className="bg-[#12121a] border border-orange-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Order VPS</h2>
                <button onClick={() => setShowOrderModal(false)} className="text-gray-500 hover:text-white transition text-xl">&times;</button>
              </div>

              {/* Plan Summary */}
              <div className="bg-white/5 rounded-xl p-4 mb-5">
                <div className="text-white font-semibold text-sm mb-1">{VPS_CONFIG.name}</div>
                <div className="text-gray-400 text-xs">{VPS_CONFIG.cpu} · {VPS_CONFIG.ram} · {VPS_CONFIG.storage}</div>
                <div className="text-orange-400 font-bold mt-1">${getPrice(billingCycle)} / {billingCycle === 'monthly' ? 'month' : billingCycle === 'quarterly' ? '3 months' : 'year'}</div>
              </div>

              {/* Email - Read Only */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-1.5 block">Your Email</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs">
                  {email}
                </div>
                <p className="text-gray-600 text-[10px] mt-1">Logged in as {email}</p>
              </div>

              {/* Billing Cycle */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-2 block">Billing Cycle</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => {
                    const price = getPrice(cycle);
                    const savings = getSavings(cycle);
                    return (
                      <button
                        key={cycle}
                        onClick={() => setBillingCycle(cycle)}
                        className={`p-2.5 rounded-lg border text-center transition text-xs ${
                          billingCycle === cycle ? 'border-orange-400 bg-orange-500/10 text-orange-300' : 'border-white/10 text-gray-400 hover:border-orange-500/30'
                        }`}
                      >
                        <div className="font-semibold">${price}</div>
                        <div className="text-[10px] text-gray-500">{cycle === 'monthly' ? '/month' : cycle === 'quarterly' ? '/3 months' : '/year'}</div>
                        {savings > 0 && <div className="text-green-400 text-[10px] font-semibold">-{savings}%</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Network */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-2 block">Payment Network *</label>
                <div className="grid grid-cols-2 gap-2">
                  {networks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNetwork(n.id)}
                      className={`p-2.5 rounded-lg border text-xs text-left transition ${
                        selectedNetwork === n.id ? 'border-orange-400 bg-orange-500/10 text-white' : 'border-white/10 text-gray-400 hover:border-orange-500/30'
                      }`}
                    >
                      <div className="font-semibold">{n.name}</div>
                      <div className="text-[10px] text-gray-500">{n.token_symbol}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallet Address */}
              {selectedNetworkObj && (
                <div className="mb-4 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                  <div className="text-orange-300 text-[10px] mb-1">Send ${getPrice(billingCycle)} {selectedNetworkObj.token_symbol} to:</div>
                  <div className="flex items-center gap-2">
                    <code className="text-white text-[10px] sm:text-xs break-all flex-1 font-mono">{selectedNetworkObj.wallet_address}</code>
                    <button onClick={() => copyToClipboard(selectedNetworkObj.wallet_address, 'wallet')} className="p-1.5 text-orange-400 hover:text-orange-300 transition flex-shrink-0">
                      {copiedField === 'wallet' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* TXID */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-1.5 block">Transaction ID (TXID)</label>
                <input
                  type="text"
                  value={txid}
                  onChange={e => setTxid(e.target.value)}
                  placeholder="Paste your transaction hash..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition"
                />
              </div>

              {/* Payment Proof */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-1.5 block">Payment Proof *</label>
                <label className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 rounded-lg p-3 cursor-pointer hover:border-orange-500/30 transition">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400 text-xs">{proof ? proof.name : 'Upload screenshot...'}</span>
                  <input type="file" accept="image/*,.pdf" onChange={e => setProof(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              {/* Note */}
              <div className="mb-5">
                <label className="text-gray-400 text-xs mb-1.5 block">Note (optional)</label>
                <textarea
                  value={userNote}
                  onChange={e => setUserNote(e.target.value)}
                  placeholder="Any special requirements..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition resize-none"
                />
              </div>

              {/* Result */}
              {submitResult && (
                <div className={`mb-4 p-3 rounded-lg text-xs ${submitResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {submitResult.message}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !selectedNetwork || !proof || !email.trim()}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>SUBMIT ORDER · ${getPrice(billingCycle)}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
