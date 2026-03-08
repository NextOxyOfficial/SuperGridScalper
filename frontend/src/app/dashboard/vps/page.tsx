'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../context';
import { useRouter } from 'next/navigation';
import { Server, Cpu, HardDrive, Globe, Shield, Zap, CheckCircle, Loader2, Upload, Copy, Clock, Eye, EyeOff, ArrowRight, Monitor, Wifi, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

interface VPSPlan {
  id: number;
  name: string;
  description: string;
  cpu: string;
  ram: string;
  storage: string;
  os: string;
  bandwidth: string;
  location: string;
  price_monthly: number;
  price_quarterly: number | null;
  price_yearly: number | null;
  features: string[];
  is_popular: boolean;
}

interface VPSOrderServer {
  ip_address: string;
  rdp_port: number;
  username: string;
  password: string;
  hostname: string;
  additional_info: string;
}

interface VPSOrder {
  id: number;
  order_number: string;
  status: string;
  plan: { name: string; cpu: string; ram: string; storage: string; os: string };
  billing_cycle: string;
  amount_paid: number;
  activated_at: string | null;
  expires_at: string | null;
  days_remaining: number;
  created_at: string;
  server: VPSOrderServer | null;
  network: string | null;
  txid: string;
  admin_note: string;
}

interface PaymentNetwork {
  id: number;
  name: string;
  code: string;
  token_symbol: string;
  wallet_address: string;
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

export default function VPSPage() {
  const { user } = useDashboard();
  const router = useRouter();

  const [plans, setPlans] = useState<VPSPlan[]>([]);
  const [orders, setOrders] = useState<VPSOrder[]>([]);
  const [networks, setNetworks] = useState<PaymentNetwork[]>([]);
  const [loading, setLoading] = useState(true);

  // Order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<VPSPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [txid, setTxid] = useState('');
  const [userNote, setUserNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  // UI state
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'orders'>('plans');

  useEffect(() => {
    fetchPlans();
    fetchNetworks();
    if (user?.email) fetchOrders();
  }, [user]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_URL}/vps/plans/`);
      const data = await res.json();
      if (data.success) setPlans(data.plans);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchNetworks = async () => {
    try {
      const res = await fetch(`${API_URL}/payment-networks/`);
      const data = await res.json();
      if (data.success) setNetworks(data.networks);
    } catch (e) { console.error(e); }
  };

  const fetchOrders = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`${API_URL}/vps/my-orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (e) { console.error(e); }
  };

  const getPrice = (plan: VPSPlan, cycle: BillingCycle) => {
    if (cycle === 'quarterly' && plan.price_quarterly) return plan.price_quarterly;
    if (cycle === 'yearly' && plan.price_yearly) return plan.price_yearly;
    return plan.price_monthly;
  };

  const getSavings = (plan: VPSPlan, cycle: BillingCycle) => {
    const monthly = plan.price_monthly;
    if (cycle === 'quarterly' && plan.price_quarterly) {
      return Math.round((1 - plan.price_quarterly / (monthly * 3)) * 100);
    }
    if (cycle === 'yearly' && plan.price_yearly) {
      return Math.round((1 - plan.price_yearly / (monthly * 12)) * 100);
    }
    return 0;
  };

  const handleOrder = (plan: VPSPlan) => {
    if (!user) { router.push('/'); return; }
    setSelectedPlan(plan);
    setBillingCycle('monthly');
    setSelectedNetwork(null);
    setTxid('');
    setUserNote('');
    setProof(null);
    setSubmitResult(null);
    setShowOrderForm(true);
  };

  const handleSubmitOrder = async () => {
    if (!selectedPlan || !selectedNetwork || !proof || !user?.email) return;
    setSubmitting(true);
    setSubmitResult(null);

    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('plan_id', String(selectedPlan.id));
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
        fetchOrders();
        setTimeout(() => { setShowOrderForm(false); setActiveTab('orders'); }, 2000);
      }
    } catch (e) {
      setSubmitResult({ success: false, message: 'Network error. Please try again.' });
    }
    setSubmitting(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    suspended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const selectedNetworkObj = networks.find(n => n.id === selectedNetwork);

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-6 py-6 sm:py-10">
      {/* Hero Section */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-2 mb-4">
          <Server className="w-4 h-4 text-orange-400" />
          <span className="text-orange-300 text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>FOREX VPS</span>
        </div>
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Windows RDP <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">Server</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
          Ultra-low latency VPS for MT5 trading. Keep your EA running 24/7 with enterprise-grade Windows servers.
        </p>
      </div>

      

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <>
          {/* Features Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { icon: Zap, label: 'Ultra-Low Latency', desc: '<1ms to broker', color: 'text-yellow-400' },
              { icon: Shield, label: '99.99% Uptime', desc: 'Enterprise SLA', color: 'text-green-400' },
              { icon: Monitor, label: 'Full RDP Access', desc: 'Windows Desktop', color: 'text-cyan-400' },
              { icon: Wifi, label: '24/7 Online', desc: 'Never miss a trade', color: 'text-purple-400' },
            ].map((f, i) => (
              <div key={i} className="bg-[#12121a] border border-white/5 rounded-xl p-3 sm:p-4 text-center">
                <f.icon className={`w-6 h-6 ${f.color} mx-auto mb-2`} />
                <div className="text-white text-xs sm:text-sm font-semibold">{f.label}</div>
                <div className="text-gray-500 text-[10px] sm:text-xs">{f.desc}</div>
              </div>
            ))}
          </div>
{/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#12121a] p-1 rounded-xl border border-orange-500/10 max-w-md mx-auto">
        {[{ key: 'plans', label: 'Plans & Order', count: plans.length }, { key: 'orders', label: 'My Servers', count: orders.length }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition ${
              activeTab === tab.key
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 text-[10px]">({tab.count})</span>}
          </button>
        ))}
      </div>
          {/* Loading/Empty States */}
          {loading ? (
            <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" /><p className="text-gray-400">Loading plans...</p></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 bg-[#12121a] border border-orange-500/10 rounded-xl">
              <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No VPS plans available yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {/* Mobile: Billing Cycle Tabs */}
              <div className="md:hidden flex justify-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
                {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold transition ${
                      billingCycle === cycle
                        ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? '3 Months' : 'Yearly'}
                    {cycle === 'yearly' && <span className="ml-1 text-[10px] text-green-400 font-bold">SAVE</span>}
                  </button>
                ))}
              </div>

              {/* Mobile: Single Card */}
              <div className="md:hidden max-w-md mx-auto mb-12">
                {plans.map((plan) => {
                  const price = getPrice(plan, billingCycle);
                  const savings = getSavings(plan, billingCycle);
                  return (
                    <div key={plan.id} className={`relative bg-gradient-to-br from-[#12121a] to-[#0a0a0f] border rounded-2xl p-5 transition-all ${plan.is_popular ? 'border-orange-400 ring-2 ring-orange-400/30 shadow-lg shadow-orange-500/10' : 'border-white/10'}`}>
                    {plan.is_popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-orange-500 to-yellow-400 text-black text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>MOST POPULAR</span>
                      </div>
                    )}
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h3>
                    {plan.description && <p className="text-gray-400 text-xs sm:text-sm mb-4">{plan.description}</p>}

                    {/* Specs */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <Cpu className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                        <div className="text-white text-xs font-semibold">{plan.cpu}</div>
                        <div className="text-gray-500 text-[10px]">CPU</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <div className="text-white text-xs font-semibold">{plan.ram}</div>
                        <div className="text-gray-500 text-[10px]">RAM</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <HardDrive className="w-4 h-4 text-green-400 mx-auto mb-1" />
                        <div className="text-white text-xs font-semibold">{plan.storage}</div>
                        <div className="text-gray-500 text-[10px]">Storage</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <Globe className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                        <div className="text-white text-xs font-semibold truncate">{plan.location || 'US'}</div>
                        <div className="text-gray-500 text-[10px]">Location</div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-4 text-center">
                      <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${price}</span>
                      <span className="text-gray-500 text-sm">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? '3mo' : 'yr'}</span>
                      {savings > 0 && <div className="text-green-400 text-xs font-semibold mt-1">Save {savings}%</div>}
                    </div>

                    {/* Features */}
                    {plan.features && plan.features.length > 0 && (
                      <ul className="space-y-1.5 mb-5">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-gray-300 text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handleOrder(plan)}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                        plan.is_popular
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

              {/* Desktop: 3 Cards Side-by-Side */}
              <div className="hidden md:grid md:grid-cols-3 gap-6 mb-12">
                {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => {
                  const plan = plans[0];
                  if (!plan) return null;
                  const price = cycle === 'quarterly' && plan.price_quarterly ? plan.price_quarterly : cycle === 'yearly' && plan.price_yearly ? plan.price_yearly : plan.price_monthly;
                  const savings = cycle === 'quarterly' && plan.price_quarterly ? Math.round((1 - plan.price_quarterly / (plan.price_monthly * 3)) * 100) : cycle === 'yearly' && plan.price_yearly ? Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100) : 0;
                  const isPopular = cycle === 'yearly';
                  
                  return (
                    <div key={cycle} className={`relative bg-gradient-to-br from-[#12121a] to-[#0a0a0f] border rounded-2xl p-6 transition-all hover:scale-[1.02] ${isPopular ? 'border-orange-400 ring-2 ring-orange-400/30 shadow-lg shadow-orange-500/10' : 'border-white/10 hover:border-orange-500/30'}`}>
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-orange-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full" style={{ fontFamily: 'Orbitron, sans-serif' }}>MOST POPULAR</span>
                        </div>
                      )}
                      <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{cycle === 'monthly' ? 'Monthly Plan' : cycle === 'quarterly' ? '3 Months Plan' : 'Yearly Plan'}</p>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <Cpu className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                          <div className="text-white text-xs font-semibold">{plan.cpu}</div>
                          <div className="text-gray-500 text-[10px]">CPU</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                          <div className="text-white text-xs font-semibold">{plan.ram}</div>
                          <div className="text-gray-500 text-[10px]">RAM</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <HardDrive className="w-4 h-4 text-green-400 mx-auto mb-1" />
                          <div className="text-white text-xs font-semibold">{plan.storage}</div>
                          <div className="text-gray-500 text-[10px]">Storage</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                          <Globe className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                          <div className="text-white text-xs font-semibold truncate">{plan.location || 'US'}</div>
                          <div className="text-gray-500 text-[10px]">Location</div>
                        </div>
                      </div>

                      <div className="mb-4 text-center">
                        <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${price}</span>
                        <span className="text-gray-500 text-sm">/{cycle === 'monthly' ? 'mo' : cycle === 'quarterly' ? '3mo' : 'yr'}</span>
                        {savings > 0 && <div className="text-green-400 text-xs font-semibold mt-1">Save {savings}%</div>}
                      </div>

                      {plan.features && plan.features.length > 0 && (
                        <ul className="space-y-1.5 mb-5">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-gray-300 text-xs">
                              <CheckCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}

                      <button
                        onClick={() => { setBillingCycle(cycle); handleOrder(plan); }}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                          isPopular
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
            </>
          )}
        </>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {!user ? (
            <div className="text-center py-16 bg-[#12121a] border border-orange-500/10 rounded-xl">
              <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">Please log in to view your VPS orders.</p>
              <button onClick={() => router.push('/')} className="bg-orange-500 text-black px-6 py-2 rounded-xl font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>LOGIN</button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 bg-[#12121a] border border-orange-500/10 rounded-xl">
              <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">You don&apos;t have any VPS orders yet.</p>
              <button onClick={() => setActiveTab('plans')} className="bg-orange-500 text-black px-6 py-2 rounded-xl font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>VIEW PLANS</button>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-[#12121a] border border-white/10 rounded-xl overflow-hidden">
                {/* Order Header */}
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${order.status === 'active' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                      <Server className={`w-5 h-5 ${order.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`} />
                    </div>
                    <div className="text-left">
                      <div className="text-white text-sm font-semibold">{order.plan.name}</div>
                      <div className="text-gray-500 text-xs">#{order.order_number} · {order.plan.cpu} · {order.plan.ram}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[order.status] || statusColors.pending}`}>
                      {order.status === 'pending' ? 'Pending' : order.status === 'active' ? `Active · ${order.days_remaining}d` : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>

                {/* Order Details */}
                {expandedOrder === order.id && (
                  <div className="border-t border-gray-800 p-4 space-y-4">
                    {/* Server Details */}
                    {order.server ? (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Monitor className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm font-semibold">Server Credentials</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { label: 'IP Address', value: order.server.ip_address, field: `ip_${order.id}` },
                            { label: 'RDP Port', value: String(order.server.rdp_port), field: `port_${order.id}` },
                            { label: 'Username', value: order.server.username, field: `user_${order.id}` },
                            { label: 'Password', value: order.server.password, field: `pass_${order.id}`, isPassword: true },
                          ].map((item) => (
                            <div key={item.field} className="bg-black/30 rounded-lg p-2.5">
                              <div className="text-gray-500 text-[10px] mb-1">{item.label}</div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-white text-xs font-mono">
                                  {item.isPassword && !showPasswords[order.id] ? '••••••••' : item.value}
                                </span>
                                <div className="flex items-center gap-1">
                                  {item.isPassword && (
                                    <button onClick={() => setShowPasswords(p => ({ ...p, [order.id]: !p[order.id] }))} className="p-1 text-gray-500 hover:text-white transition">
                                      {showPasswords[order.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                  )}
                                  <button onClick={() => copyToClipboard(item.value, item.field)} className="p-1 text-gray-500 hover:text-orange-400 transition">
                                    {copiedField === item.field ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.server.additional_info && (
                          <div className="mt-3 text-gray-400 text-xs bg-black/20 rounded-lg p-2">{order.server.additional_info}</div>
                        )}
                      </div>
                    ) : order.status === 'pending' ? (
                      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-yellow-300 text-sm font-medium">Pending Activation</div>
                          <div className="text-gray-400 text-xs mt-1">Your payment is being verified. Server credentials will appear here once your VPS is set up (usually 1-24 hours).</div>
                        </div>
                      </div>
                    ) : null}

                    {/* Order Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-gray-500 text-[10px]">Billing</div>
                        <div className="text-white font-medium">{order.billing_cycle}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-gray-500 text-[10px]">Amount</div>
                        <div className="text-white font-medium">${order.amount_paid}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-gray-500 text-[10px]">Ordered</div>
                        <div className="text-white font-medium">{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-gray-500 text-[10px]">Expires</div>
                        <div className={`font-medium ${order.days_remaining <= 7 ? 'text-red-400' : 'text-white'}`}>
                          {order.expires_at ? new Date(order.expires_at).toLocaleDateString() : 'Pending'}
                        </div>
                      </div>
                    </div>

                    {order.admin_note && (
                      <div className="text-orange-400/70 text-xs bg-orange-500/5 border border-orange-500/10 rounded-lg p-2">
                        <strong>Admin:</strong> {order.admin_note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Order Modal */}
      {showOrderForm && selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOrderForm(false)}>
          <div className="bg-[#12121a] border border-orange-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Order VPS</h2>
                <button onClick={() => setShowOrderForm(false)} className="text-gray-500 hover:text-white transition text-xl">&times;</button>
              </div>

              {/* Plan Summary */}
              <div className="bg-white/5 rounded-xl p-4 mb-5">
                <div className="text-white font-semibold text-sm mb-1">{selectedPlan.name}</div>
                <div className="text-gray-400 text-xs">{selectedPlan.cpu} · {selectedPlan.ram} · {selectedPlan.storage}</div>
              </div>

              {/* Billing Cycle */}
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-2 block">Billing Cycle</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => {
                    const price = getPrice(selectedPlan, cycle);
                    const isAvailable = cycle === 'monthly' || (cycle === 'quarterly' && selectedPlan.price_quarterly) || (cycle === 'yearly' && selectedPlan.price_yearly);
                    if (!isAvailable) return <div key={cycle} />;
                    const savings = getSavings(selectedPlan, cycle);
                    return (
                      <button
                        key={cycle}
                        onClick={() => setBillingCycle(cycle)}
                        className={`p-2.5 rounded-lg border text-center transition text-xs ${
                          billingCycle === cycle
                            ? 'border-orange-400 bg-orange-500/10 text-orange-300'
                            : 'border-white/10 text-gray-400 hover:border-orange-500/30'
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
                <label className="text-gray-400 text-xs mb-2 block">Payment Network</label>
                <div className="grid grid-cols-2 gap-2">
                  {networks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNetwork(n.id)}
                      className={`p-2.5 rounded-lg border text-xs text-left transition ${
                        selectedNetwork === n.id
                          ? 'border-orange-400 bg-orange-500/10 text-white'
                          : 'border-white/10 text-gray-400 hover:border-orange-500/30'
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
                  <div className="text-orange-300 text-[10px] mb-1">Send ${getPrice(selectedPlan, billingCycle)} {selectedNetworkObj.token_symbol} to:</div>
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
                disabled={submitting || !selectedNetwork || !proof}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-black shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <>SUBMIT ORDER · ${getPrice(selectedPlan, billingCycle)}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
