'use client';

import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../../context';
import { useRouter } from 'next/navigation';
import {
  Power, PowerOff, Users, DollarSign, TrendingUp, BarChart3,
  Shield, Clock, AlertTriangle, Calendar, Plus, Trash2, Loader2,
  MessageCircle, ChevronDown, ChevronUp, Zap, ArrowLeft, Camera, Upload,
  UserX, Eye, X
} from 'lucide-react';

export default function FMDashboardPage() {
  const { user, API_URL } = useDashboard();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingAll, setTogglingAll] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleReason, setToggleReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ action: string; target: string | number } | null>(null);
  const [togglePassword, setTogglePassword] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [stopConfirmChecked, setStopConfirmChecked] = useState(false);

  // Schedule state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', day_of_week: 0, off_time: '12:00', on_time: '14:00', reason: '' });

  const [activeSection, setActiveSection] = useState<'subscribers' | 'commands' | 'schedules' | 'earnings'>('subscribers');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [expandedSub, setExpandedSub] = useState<number | null>(null);
  const [cancellingSubId, setCancellingSubId] = useState<number | null>(null);
  const [positionsModal, setPositionsModal] = useState<{ subscriber: string; mt5_account?: string; positions: any[] } | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [tradeCommandLoading, setTradeCommandLoading] = useState<string | null>(null);
  const [tradeCommandSuccess, setTradeCommandSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const positionsModalRef = useRef<{ subscriber: string; mt5_account?: string } | null>(null);

  // Keep ref in sync with modal state so silentRefresh can update positions
  useEffect(() => {
    positionsModalRef.current = positionsModal ? { subscriber: positionsModal.subscriber, mt5_account: positionsModal.mt5_account } : null;
  }, [positionsModal]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboard();
    fetchSchedules();

    // Auto-refresh every 10 seconds for real-time trading updates
    refreshIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        silentRefresh();
      }
    }, 10000);

    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const cancelSubscriber = async (subscriptionId: number, userEmail: string) => {
    if (!confirm(`Cancel subscription for ${userEmail}? They will lose access immediately.`)) return;
    setCancellingSubId(subscriptionId);
    try {
      const res = await fetch(`${API_URL}/fund-managers/cancel-subscriber/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, subscription_id: subscriptionId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboard();
        setExpandedSub(null);
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setCancellingSubId(null);
    }
  };

  const sendTradeCommand = async (assignmentId: number, commandType: string, ticket?: number) => {
    const loadingKey = `${commandType}_${assignmentId}_${ticket || 'all'}`;
    setTradeCommandLoading(loadingKey);
    setTradeCommandSuccess(null);
    try {
      const payload: any = { email: user.email, command_type: commandType, assignment_id: assignmentId };
      if (ticket) payload.ticket = ticket;
      const res = await fetch(`${API_URL}/fund-managers/trade-command/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setTradeCommandSuccess(loadingKey);
        setTimeout(() => setTradeCommandSuccess(null), 3000);
        silentRefresh();
      } else {
        alert(data.error || 'Failed to send command');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setTradeCommandLoading(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('avatar', file);
    try {
      const res = await fetch(`${API_URL}/fund-managers/update-avatar/`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatarUrl(data.avatar_url);
        fetchDashboard();
      } else {
        setAvatarError(data.error || 'Upload failed');
      }
    } catch {
      setAvatarError('Upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/dashboard/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        setDashboard(data.dashboard);
        setLastUpdated(new Date());
      } else {
        // Not a fund manager - redirect
        router.push('/dashboard/fund-managers');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh — updates data without showing loading spinner
  const silentRefresh = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/dashboard/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.success && isMountedRef.current) {
        setDashboard(data.dashboard);
        setLastUpdated(new Date());

        // Auto-refresh positions modal if open
        const modalCtx = positionsModalRef.current;
        if (modalCtx && data.dashboard?.subscribers) {
          const sub = data.dashboard.subscribers.find((s: any) => s.user_name === modalCtx.subscriber);
          if (sub) {
            let freshPositions: any[];
            if (modalCtx.mt5_account) {
              const acc = sub.accounts.find((a: any) => a.mt5_account === modalCtx.mt5_account);
              freshPositions = acc ? (acc.open_positions || []).map((p: any) => ({ ...p, mt5_account: acc.mt5_account, assignment_id: acc.assignment_id })) : [];
            } else {
              freshPositions = sub.accounts.flatMap((a: any) => (a.open_positions || []).map((p: any) => ({ ...p, mt5_account: a.mt5_account, assignment_id: a.assignment_id })));
            }
            setPositionsModal(prev => prev ? { ...prev, positions: freshPositions } : null);
          }
        }
      }
    } catch {
      // Silent fail — don't interrupt user
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/schedules/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, action: 'list' }),
      });
      const data = await res.json();
      if (data.success) setSchedules(data.schedules);
    } catch (err) {
      console.error(err);
    }
  };

  const initiateToggle = (action: string, target: string | number) => {
    setPendingToggle({ action, target });
    setToggleReason('');
    setTogglePassword('');
    setToggleError('');
    setStopConfirmChecked(false);
    setShowReasonModal(true);
  };

  const executeToggle = async () => {
    if (!pendingToggle) return;
    const { action, target } = pendingToggle;
    
    if (target === 'all') setTogglingAll(true);
    else setTogglingId(target as number);

    try {
      const payload: any = {
        email: user.email,
        action,
        target: String(target),
        reason: toggleReason,
      };
      if (action === 'ea_off') {
        if (!togglePassword.trim()) {
          setToggleError('Password is required to stop robots.');
          if (target === 'all') setTogglingAll(false);
          else setTogglingId(null);
          return;
        }
        payload.password = togglePassword;
      }
      const res = await fetch(`${API_URL}/fund-managers/toggle-ea/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboard();
        setShowReasonModal(false);
        setPendingToggle(null);
      } else {
        setToggleError(data.error || 'Failed');
      }
    } catch (err) {
      setToggleError('Failed to execute command. Please try again.');
    } finally {
      setTogglingAll(false);
      setTogglingId(null);
    }
  };

  const createSchedule = async () => {
    setCreatingSchedule(true);
    try {
      const res = await fetch(`${API_URL}/fund-managers/schedules/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, action: 'create', ...newSchedule }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
        setShowScheduleForm(false);
        setNewSchedule({ name: '', day_of_week: 0, off_time: '12:00', on_time: '14:00', reason: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingSchedule(false);
    }
  };

  const deleteSchedule = async (id: number) => {
    if (!confirm('Delete this schedule?')) return;
    setDeletingScheduleId(id);
    try {
      await fetch(`${API_URL}/fund-managers/schedules/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, action: 'delete', schedule_id: id }),
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingScheduleId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="max-w-4xl mx-auto px-1 sm:px-4 py-10 text-center">
        <p className="text-gray-400">You are not a fund manager</p>
        <button onClick={() => router.push('/dashboard/fund-managers')} className="mt-4 text-cyan-400 hover:text-cyan-300">
          ← Back to FM Engine
        </button>
      </div>
    );
  }

  const { profile, stats, subscribers, recent_commands } = dashboard;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar Upload */}
          <div className="relative group flex-shrink-0" title="Tap to change profile picture">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center overflow-hidden">
              {avatarUrl || profile.avatar_url ? (
                <img src={avatarUrl || profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-cyan-400">{profile.display_name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <button onClick={() => router.push('/dashboard/fund-managers')} className="text-cyan-400 hover:text-cyan-300 text-xs mb-1 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              FM Dashboard
              <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-[9px] font-medium" style={{ fontFamily: 'inherit' }}>LIVE</span>
              </span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm">{profile.display_name} • {profile.tier} tier</p>
            {lastUpdated && (
              <p className="text-gray-600 text-[10px]">Updated {lastUpdated.toLocaleTimeString()}</p>
            )}
            {avatarError && <p className="text-red-400 text-xs mt-1">{avatarError}</p>}
          </div>
        </div>
        {/* Action Buttons Row */}
        <div className="flex max-sm:justify-center items-center gap-2 mt-3">
          <button
            onClick={() => router.push(`/dashboard/fund-managers/${profile.id}`)}
            className="flex items-center gap-1.5 bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/30 hover:bg-purple-500/30 transition"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            <Eye className="w-3.5 h-3.5" /> My FM Funnel
          </button>
          {(() => {
            const allAccounts = subscribers.flatMap((s: any) => s.accounts || []);
            const allStopped = allAccounts.length > 0 && allAccounts.every((a: any) => !a.is_ea_active);
            return allStopped ? (
              <button
                onClick={() => initiateToggle('ea_on', 'all')}
                disabled={togglingAll}
                className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition text-xs font-medium disabled:opacity-50"
              >
                {togglingAll ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</> : <><Power className="w-3.5 h-3.5" /> Start Robot</>}
              </button>
            ) : (
              <button
                onClick={() => initiateToggle('ea_off', 'all')}
                disabled={togglingAll}
                className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition text-xs font-medium disabled:opacity-50"
              >
                {togglingAll ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Stopping...</> : <><PowerOff className="w-3.5 h-3.5" /> Stop Robot</>}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-6">
        {(() => {
          const totalProfit = subscribers.reduce((sum: number, sub: any) => {
            return sum + sub.accounts.reduce((accSum: number, acc: any) => accSum + parseFloat(acc.profit || '0'), 0);
          }, 0);
          return [
            { label: 'Active Subs', value: stats.active_subscribers, icon: Users, color: 'text-cyan-400' },
            { label: 'Trial Subs', value: stats.trial_subscribers, icon: Clock, color: 'text-yellow-400' },
            { label: 'Balance', value: `$${parseFloat(stats.total_managed_balance).toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
            { label: 'Equity', value: `$${parseFloat(stats.total_managed_equity).toLocaleString()}`, icon: BarChart3, color: 'text-blue-400' },
            { label: 'Total P/L', value: `$${totalProfit.toFixed(2)}`, icon: TrendingUp, color: totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Monthly Rev', value: `$${parseFloat(stats.monthly_revenue).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-400' },
            { label: 'Net Earnings', value: `$${parseFloat(stats.net_earnings).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center text-center min-h-[90px] sm:min-h-[100px]">
              <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color} mb-1.5 sm:mb-2`} />
              <div className={`${s.color} font-bold text-base sm:text-lg mb-0.5`}>{s.value}</div>
              <div className="text-gray-500 text-[10px] sm:text-xs">{s.label}</div>
            </div>
          ));
        })()}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 mb-6 bg-[#12121a] p-1 rounded-xl border border-cyan-500/10 overflow-x-auto">
        {(['subscribers', 'commands', 'schedules', 'earnings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`flex-shrink-0 flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3 text-[10px] sm:text-xs font-semibold rounded-lg transition capitalize whitespace-nowrap ${
              activeSection === tab
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Subscribers Section */}
      {activeSection === 'subscribers' && (
        <div className="space-y-3">
          {subscribers.length === 0 ? (
            <div className="text-center py-16 bg-[#12121a] border border-cyan-500/10 rounded-xl">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No subscribers yet</p>
            </div>
          ) : (
            subscribers.map((sub: any) => (
              <div key={sub.subscription_id} className="bg-[#12121a] border border-cyan-500/10 rounded-xl overflow-hidden">
                {/* Subscriber Header */}
                <div className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                  {/* Left: avatar + name — clickable to FM profile if they are an FM */}
                  <button
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                    onClick={() => {
                      if (sub.subscriber_fm_id) {
                        router.push(`/dashboard/fund-managers/${sub.subscriber_fm_id}`);
                      } else {
                        setExpandedSub(expandedSub === sub.subscription_id ? null : sub.subscription_id);
                      }
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-400 font-bold">{sub.user_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{sub.user_name}</span>
                        {sub.subscriber_fm_id && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold flex-shrink-0">
                            FM
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs truncate">{sub.user_email} · {sub.accounts.length} account(s)</div>
                      {sub.subscriber_fm_id && (
                        <div className="text-purple-400 text-[10px] mt-0.5">Tap to view FM profile →</div>
                      )}
                      {/* Mobile: Balance/P/L/Positions/Mode/View Positions at a glance */}
                      {(() => {
                        const totalBuy = sub.accounts.reduce((s: number, a: any) => s + (a.buy_positions || 0), 0);
                        const totalSell = sub.accounts.reduce((s: number, a: any) => s + (a.sell_positions || 0), 0);
                        const totalProfit = sub.accounts.reduce((s: number, a: any) => s + parseFloat(a.profit || '0'), 0);
                        const totalBalance = sub.accounts.reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);
                        const totalPos = totalBuy + totalSell;
                        const tradingMode = sub.accounts.find((a: any) => a.trading_mode)?.trading_mode || 'Normal';
                        const allPositions = sub.accounts.flatMap((a: any) => (a.open_positions || []).map((p: any) => ({ ...p, mt5_account: a.mt5_account, assignment_id: a.assignment_id })));
                        if (!sub.accounts.some((a: any) => a.balance)) return null;
                        return (
                          <div className="sm:hidden mt-1.5 space-y-1">
                            <div className="flex items-center gap-3 text-[10px]">
                              <div>
                                <span className="text-gray-500">Bal: </span>
                                <span className="text-white font-semibold">${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">P/L: </span>
                                <span className={`font-semibold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${totalProfit.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Pos: </span>
                                <span className="text-white font-semibold">{totalPos}</span>
                              </div>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-gray-500">Mode: </span>
                              <span className={`font-semibold ${tradingMode === 'Recovery' ? 'text-orange-400' : 'text-cyan-400'}`}>{tradingMode}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </button>

                  {/* Trade Summary inline */}
                  {(() => {
                    const totalBuy = sub.accounts.reduce((s: number, a: any) => s + (a.buy_positions || 0), 0);
                    const totalSell = sub.accounts.reduce((s: number, a: any) => s + (a.sell_positions || 0), 0);
                    const totalProfit = sub.accounts.reduce((s: number, a: any) => s + parseFloat(a.profit || '0'), 0);
                    const totalBalance = sub.accounts.reduce((s: number, a: any) => s + parseFloat(a.balance || '0'), 0);
                    const allPositions = sub.accounts.flatMap((a: any) => (a.open_positions || []).map((p: any) => ({ ...p, mt5_account: a.mt5_account, assignment_id: a.assignment_id })));
                    const totalPos = totalBuy + totalSell;
                    const tradingMode = sub.accounts.find((a: any) => a.trading_mode)?.trading_mode || 'Normal';
                    return (
                      <div className="hidden sm:flex items-center gap-3 flex-shrink-0 mx-3">
                        <div className="text-right">
                          <div className="text-gray-400 text-[10px]">Mode</div>
                          <div className={`text-xs font-semibold ${tradingMode === 'Recovery' ? 'text-orange-400' : 'text-cyan-400'}`}>{tradingMode}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400 text-[10px]">Balance</div>
                          <div className="text-white text-xs font-semibold">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400 text-[10px]">P/L</div>
                          <div className={`text-xs font-semibold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${totalProfit.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-400 text-[10px]">Positions</div>
                          <div className="text-white text-xs font-semibold">{totalPos}</div>
                        </div>
                        {totalPos > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPositionsModal({ subscriber: sub.user_name, positions: allPositions }); }}
                            className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition whitespace-nowrap"
                          >
                            View Positions
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Right: EA status (mobile) + status + expand toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {/* Mobile: EA ON/OFF indicator */}
                    {(() => {
                      const allAccounts = sub.accounts || [];
                      const anyActive = allAccounts.some((a: any) => a.is_ea_active);
                      const allActive = allAccounts.length > 0 && allAccounts.every((a: any) => a.is_ea_active);
                      if (allAccounts.length === 0) return null;
                      return (
                        <div className="sm:hidden flex items-center gap-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            allActive ? 'bg-green-500/20 text-green-400' :
                            anyActive ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {allActive ? 'ON' : anyActive ? 'MIXED' : 'OFF'}
                          </span>
                        </div>
                      );
                    })()}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      sub.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      sub.status === 'trial' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {sub.status} · {sub.days_remaining}d
                    </span>
                    <button
                      onClick={() => setExpandedSub(expandedSub === sub.subscription_id ? null : sub.subscription_id)}
                      className="p-1 text-gray-500 hover:text-white transition"
                    >
                      {expandedSub === sub.subscription_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: Account Details + Cancel */}
                {expandedSub === sub.subscription_id && (
                  <div className="border-t border-gray-800 sm:p-4 p-1 space-y-3">
                    {/* Accounts list */}
                    {sub.accounts.length === 0 ? (
                      <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-yellow-300 text-xs font-medium">No MT5 accounts linked</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">
                            This subscriber did not assign any active MT5 licenses when subscribing. EA toggle is unavailable until they add accounts.
                          </div>
                        </div>
                      </div>
                    ) : (
                      sub.accounts.map((acc: any) => (
                        <div key={acc.assignment_id} className="bg-[#0a0a0f] rounded-lg p-3 space-y-2">
                          {/* MT5 Account + EA Toggle + View Positions */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-white text-xs sm:text-sm font-medium">MT5: {acc.mt5_account}</div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${acc.is_ea_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                EA {acc.is_ea_active ? 'ON' : 'OFF'}
                              </span>
                              <button
                                onClick={() => initiateToggle(acc.is_ea_active ? 'ea_off' : 'ea_on', acc.assignment_id)}
                                disabled={togglingId === acc.assignment_id}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition ${
                                  acc.is_ea_active
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                                    : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                                }`}
                              >
                                {togglingId === acc.assignment_id ? <><Loader2 className="w-3 h-3 animate-spin" /> {acc.is_ea_active ? 'Stopping...' : 'Starting...'}</> : acc.is_ea_active ? 'Stop' : 'Start'}
                              </button>
                              {acc.open_positions && acc.open_positions.length > 0 && (
                                <button
                                  onClick={() => setPositionsModal({ subscriber: sub.user_name, mt5_account: acc.mt5_account, positions: acc.open_positions.map((p: any) => ({ ...p, mt5_account: acc.mt5_account, assignment_id: acc.assignment_id })) })}
                                  className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition whitespace-nowrap"
                                >
                                  View Positions
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Balance/Equity/Profit */}
                          {acc.balance && (
                            <div className="text-gray-500 text-[10px] sm:text-xs flex flex-wrap gap-x-2">
                              <span>Bal: ${parseFloat(acc.balance).toLocaleString()}</span>
                              <span>Eq: ${parseFloat(acc.equity).toLocaleString()}</span>
                              <span>P/L: <span className={parseFloat(acc.profit) >= 0 ? 'text-green-400' : 'text-red-400'}>${acc.profit}</span></span>
                            </div>
                          )}
                          {acc.last_toggled_reason && (
                            <div className="text-yellow-400/70 text-[10px] truncate">{acc.last_toggled_reason}</div>
                          )}
                          {/* Trade Close Buttons */}
                          {acc.balance && (acc.buy_positions > 0 || acc.sell_positions > 0) && (
                            <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-2 border-t border-gray-800/50 flex-wrap">
                              {acc.buy_positions > 0 && (
                                <button
                                  onClick={() => { if(confirm(`Close ALL ${acc.buy_positions} BUY positions on MT5 ${acc.mt5_account}?`)) sendTradeCommand(acc.assignment_id, 'close_all_buy'); }}
                                  disabled={tradeCommandLoading === `close_all_buy_${acc.assignment_id}_all`}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition disabled:opacity-50"
                                >
                                  {tradeCommandLoading === `close_all_buy_${acc.assignment_id}_all` ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                   tradeCommandSuccess === `close_all_buy_${acc.assignment_id}_all` ? '✓ Sent' :
                                   `Close All Buy (${acc.buy_positions})`}
                                </button>
                              )}
                              {acc.sell_positions > 0 && (
                                <button
                                  onClick={() => { if(confirm(`Close ALL ${acc.sell_positions} SELL positions on MT5 ${acc.mt5_account}?`)) sendTradeCommand(acc.assignment_id, 'close_all_sell'); }}
                                  disabled={tradeCommandLoading === `close_all_sell_${acc.assignment_id}_all`}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50"
                                >
                                  {tradeCommandLoading === `close_all_sell_${acc.assignment_id}_all` ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                   tradeCommandSuccess === `close_all_sell_${acc.assignment_id}_all` ? '✓ Sent' :
                                   `Close All Sell (${acc.sell_positions})`}
                                </button>
                              )}
                              {(acc.buy_positions + acc.sell_positions) > 1 && (
                                <button
                                  onClick={() => { if(confirm(`Close ALL ${acc.buy_positions + acc.sell_positions} positions on MT5 ${acc.mt5_account}?`)) sendTradeCommand(acc.assignment_id, 'close_all'); }}
                                  disabled={tradeCommandLoading === `close_all_${acc.assignment_id}_all`}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition disabled:opacity-50"
                                >
                                  {tradeCommandLoading === `close_all_${acc.assignment_id}_all` ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                   tradeCommandSuccess === `close_all_${acc.assignment_id}_all` ? '✓ Sent' :
                                   `Close All (${acc.buy_positions + acc.sell_positions})`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* Cancel Subscription */}
                    <div className="pt-2 border-t border-gray-800 flex justify-end">
                      <button
                        onClick={() => cancelSubscriber(sub.subscription_id, sub.user_email)}
                        disabled={cancellingSubId === sub.subscription_id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        {cancellingSubId === sub.subscription_id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Cancelling...</>
                        ) : (
                          <><UserX className="w-3 h-3" /> Cancel Subscription</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Commands History */}
      {activeSection === 'commands' && (
        <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-white text-sm sm:text-base font-semibold">Recent Commands</h3>
          </div>
          {recent_commands.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No commands issued yet</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {recent_commands.map((cmd: any) => (
                <div key={cmd.id} className="flex items-start sm:items-center justify-between p-3 sm:p-4 gap-3">
                  <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {cmd.command_type === 'ea_on' ? (
                      <Power className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <PowerOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-white text-xs sm:text-sm truncate">
                        {cmd.command_type === 'ea_on' ? 'EA Enabled' : 'EA Disabled'} — {cmd.target_type === 'all' ? 'All Accounts' : 'Specific Account'}
                      </div>
                      {cmd.reason && <div className="text-gray-500 text-[10px] sm:text-xs truncate">{cmd.reason}</div>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-gray-400 text-[10px] sm:text-xs">{cmd.affected_accounts} affected</div>
                    <div className="text-gray-600 text-[9px] sm:text-[10px]">{new Date(cmd.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedules Section */}
      {activeSection === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">EA Schedules</h3>
            <button
              onClick={() => setShowScheduleForm(!showScheduleForm)}
              className="flex items-center gap-1 bg-cyan-500/20 text-cyan-400 px-3 py-2 rounded-lg text-sm hover:bg-cyan-500/30 transition border border-cyan-500/30"
            >
              <Plus className="w-4 h-4" /> Add Schedule
            </button>
          </div>

          {showScheduleForm && (
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-5 space-y-3">
              <input
                type="text"
                placeholder="Schedule Name (e.g., NFP News Window)"
                value={newSchedule.name}
                onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={newSchedule.day_of_week}
                  onChange={e => setNewSchedule({ ...newSchedule, day_of_week: parseInt(e.target.value) })}
                  className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <div>
                  <label className="text-gray-500 text-xs">OFF Time (UTC)</label>
                  <input
                    type="time"
                    value={newSchedule.off_time}
                    onChange={e => setNewSchedule({ ...newSchedule, off_time: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">ON Time (UTC)</label>
                  <input
                    type="time"
                    value={newSchedule.on_time}
                    onChange={e => setNewSchedule({ ...newSchedule, on_time: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={newSchedule.reason}
                onChange={e => setNewSchedule({ ...newSchedule, reason: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowScheduleForm(false)} className="px-4 py-2 text-gray-400 border border-gray-700 rounded-lg text-sm">Cancel</button>
                <button onClick={createSchedule} disabled={creatingSchedule} className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {creatingSchedule ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</> : 'Create'}
                </button>
              </div>
            </div>
          )}

          {schedules.length === 0 ? (
            <div className="text-center py-10 bg-[#12121a] border border-cyan-500/10 rounded-xl">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No schedules created yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between bg-[#12121a] border border-cyan-500/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <div>
                      <div className="text-white text-sm font-medium">{s.name}</div>
                      <div className="text-gray-500 text-xs">{s.day_name} • OFF {s.off_time} → ON {s.on_time} UTC</div>
                      {s.reason && <div className="text-yellow-400/60 text-[10px]">{s.reason}</div>}
                    </div>
                  </div>
                  <button onClick={() => deleteSchedule(s.id)} disabled={deletingScheduleId === s.id} className="text-red-400/50 hover:text-red-400 transition disabled:opacity-50">
                    {deletingScheduleId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Earnings Section */}
      {activeSection === 'earnings' && (
        <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4 sm:p-6">
          <h3 className="text-white text-sm sm:text-base font-semibold mb-4 sm:mb-6">Earnings Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-[#0a0a0f] rounded-xl p-4 sm:p-5 border border-gray-800">
              <div className="text-gray-500 text-xs mb-1.5">Monthly Revenue</div>
              <div className="text-green-400 font-bold text-xl sm:text-2xl">${parseFloat(stats.monthly_revenue).toLocaleString()}</div>
              <div className="text-gray-600 text-[10px] sm:text-xs mt-1">{stats.active_subscribers} subs × ${dashboard.profile.monthly_price || '0'}</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-4 sm:p-5 border border-gray-800">
              <div className="text-gray-500 text-xs mb-1.5">Platform Fee</div>
              <div className="text-red-400 font-bold text-xl sm:text-2xl">-${parseFloat(stats.platform_fee).toLocaleString()}</div>
              <div className="text-gray-600 text-[10px] sm:text-xs mt-1">15% platform commission</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-4 sm:p-5 border border-gray-800 col-span-2 sm:col-span-1">
              <div className="text-gray-500 text-xs mb-1.5">Net Earnings</div>
              <div className="text-emerald-400 font-bold text-xl sm:text-2xl">${parseFloat(stats.net_earnings).toLocaleString()}</div>
              <div className="text-gray-600 text-[10px] sm:text-xs mt-1">Your monthly take-home</div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className={`bg-[#12121a] border rounded-xl max-w-md w-full p-6 ${
            pendingToggle?.action === 'ea_off' ? 'border-red-500/30' : 'border-green-500/30'
          }`}>
            <h3 className="text-white font-bold text-lg mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {pendingToggle?.action === 'ea_on' ? 'Start Robot' : 'Stop Robot'}
              {pendingToggle?.target === 'all' ? ' — All Subscribers' : ''}
            </h3>

            {/* Warning for Stop */}
            {pendingToggle?.action === 'ea_off' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 my-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-semibold mb-1">Warning: This will stop all trading!</p>
                    <p className="text-red-400/70 text-xs">All open orders may be affected. Subscribers will see their robots as stopped. This action requires your password.</p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-gray-400 text-sm mb-3">Provide a reason (shown to subscribers):</p>
            <input
              type="text"
              placeholder="e.g., NFP News Release, High volatility..."
              value={toggleReason}
              onChange={e => setToggleReason(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 mb-3"
            />

            {/* Password + Confirm checkbox for Stop only */}
            {pendingToggle?.action === 'ea_off' && (
              <>
                <input
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={togglePassword}
                  onChange={e => { setTogglePassword(e.target.value); setToggleError(''); }}
                  className="w-full bg-[#0a0a0f] border border-red-500/30 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-400 mb-3"
                  style={{ fontSize: '16px' }}
                />
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={stopConfirmChecked}
                    onChange={e => setStopConfirmChecked(e.target.checked)}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-gray-400 text-xs">I understand this will stop trading for subscribers</span>
                </label>
              </>
            )}

            {toggleError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-300 text-xs mb-3">
                {toggleError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowReasonModal(false); setPendingToggle(null); setTogglePassword(''); setToggleError(''); }}
                className="flex-1 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeToggle}
                disabled={
                  pendingToggle?.action === 'ea_off'
                    ? (!togglePassword.trim() || !stopConfirmChecked)
                    : false
                }
                className={`flex-1 py-2.5 font-bold rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  pendingToggle?.action === 'ea_on'
                    ? 'bg-green-500 text-black hover:bg-green-400'
                    : 'bg-red-500 text-white hover:bg-red-400'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {(togglingAll || togglingId !== null) ? (
                  <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />{pendingToggle?.action === 'ea_on' ? 'Starting...' : 'Stopping...'}</>
                ) : (
                  pendingToggle?.action === 'ea_on' ? 'Start Robot' : 'Stop Robot'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Positions Modal */}
      {positionsModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPositionsModal(null)}>
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h2 className="text-white text-sm sm:text-base font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Open Positions — {positionsModal.subscriber}
                </h2>
                {positionsModal.mt5_account && (
                  <p className="text-gray-400 text-xs mt-0.5">MT5: {positionsModal.mt5_account}</p>
                )}
              </div>
              <button onClick={() => setPositionsModal(null)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {positionsModal.positions.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No open positions</div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="hidden sm:grid gap-2 text-gray-500 text-[10px] font-semibold uppercase px-3 pb-2 border-b border-gray-800" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.7fr 1.1fr 1.1fr 0.9fr 0.7fr' }}>
                    <span>Ticket</span>
                    <span>Type</span>
                    <span className="text-right">Vol</span>
                    <span className="text-right">Open Price</span>
                    <span className="text-right">Current</span>
                    <span className="text-right">Profit</span>
                    <span className="text-right">Action</span>
                  </div>
                  {positionsModal.positions.map((p: any, i: number) => {
                    const isBuy = String(p.type).toLowerCase().includes('buy') || p.type === 0 || p.type === 'POSITION_TYPE_BUY';
                    const profit = parseFloat(p.profit || '0');
                    const closeKey = `close_position_${p.assignment_id}_${p.ticket}`;
                    return (
                      <div key={p.ticket || i} className="hidden sm:grid gap-2 px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-800/50 text-xs items-center" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.7fr 1.1fr 1.1fr 0.9fr 0.7fr' }}>
                        <span className="text-gray-300 font-mono truncate">{p.ticket || '-'}</span>
                        <span className={`font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>{isBuy ? 'BUY' : 'SELL'}</span>
                        <span className="text-gray-300 text-right">{p.volume || p.lots || '-'}</span>
                        <span className="text-gray-300 text-right">{p.open_price || p.price_open || '-'}</span>
                        <span className="text-gray-300 text-right">{p.current_price || p.price_current || '-'}</span>
                        <span className={`font-semibold text-right ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toFixed(2)}</span>
                        <div className="text-right">
                          {p.ticket && p.assignment_id && (
                            <button
                              onClick={() => { if(confirm(`Close position #${p.ticket}?`)) sendTradeCommand(p.assignment_id, 'close_position', p.ticket); }}
                              disabled={tradeCommandLoading === closeKey}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50"
                            >
                              {tradeCommandLoading === closeKey ? <Loader2 className="w-3 h-3 animate-spin inline" /> : tradeCommandSuccess === closeKey ? '✓' : 'Close'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Mobile view */}
                  {positionsModal.positions.map((p: any, i: number) => {
                    const isBuy = String(p.type).toLowerCase().includes('buy') || p.type === 0 || p.type === 'POSITION_TYPE_BUY';
                    const profit = parseFloat(p.profit || '0');
                    const closeKey = `close_position_${p.assignment_id}_${p.ticket}`;
                    return (
                      <div key={`m_${p.ticket || i}`} className="sm:hidden flex items-center justify-between px-3 py-2 rounded-lg bg-[#0a0a0f] border border-gray-800/50 text-xs gap-2">
                        <span className="text-gray-400 font-mono truncate flex-1">{p.ticket || '-'}</span>
                        <span className={`font-semibold flex-shrink-0 ${isBuy ? 'text-green-400' : 'text-red-400'}`}>{isBuy ? 'BUY' : 'SELL'}</span>
                        <span className="text-gray-400 flex-shrink-0">vol: {p.volume || p.lots || '-'}</span>
                        <span className={`font-semibold flex-shrink-0 ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toFixed(2)}</span>
                        {p.ticket && p.assignment_id && (
                          <button
                            onClick={() => { if(confirm(`Close position #${p.ticket}?`)) sendTradeCommand(p.assignment_id, 'close_position', p.ticket); }}
                            disabled={tradeCommandLoading === closeKey}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50 flex-shrink-0"
                          >
                            {tradeCommandLoading === closeKey ? <Loader2 className="w-3 h-3 animate-spin inline" /> : tradeCommandSuccess === closeKey ? '✓' : 'Close'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {/* Totals */}
                  <div className="border-t border-gray-700 pt-2 mt-2 px-3 flex items-center justify-between">
                    <span className="text-gray-400 text-xs">{positionsModal.positions.length} position(s)</span>
                    <span className={`text-sm font-bold ${positionsModal.positions.reduce((s: number, p: any) => s + parseFloat(p.profit || '0'), 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Total P/L: ${positionsModal.positions.reduce((s: number, p: any) => s + parseFloat(p.profit || '0'), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
