'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../../context';
import { useRouter } from 'next/navigation';
import {
  Power, PowerOff, Users, DollarSign, TrendingUp, BarChart3,
  Shield, Clock, AlertTriangle, Calendar, Plus, Trash2, Loader2,
  MessageCircle, ChevronDown, ChevronUp, Zap, ArrowLeft, Camera, Upload
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

  // Schedule state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', day_of_week: 0, off_time: '12:00', on_time: '14:00', reason: '' });

  const [activeSection, setActiveSection] = useState<'subscribers' | 'commands' | 'schedules' | 'earnings'>('subscribers');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [expandedSub, setExpandedSub] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboard();
    fetchSchedules();
  }, []);

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
    setShowReasonModal(true);
  };

  const executeToggle = async () => {
    if (!pendingToggle) return;
    const { action, target } = pendingToggle;
    
    if (target === 'all') setTogglingAll(true);
    else setTogglingId(target as number);

    try {
      const res = await fetch(`${API_URL}/fund-managers/toggle-ea/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          action,
          target: String(target),
          reason: toggleReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboard();
      } else {
        alert(data.error || 'Failed');
      }
    } catch (err) {
      alert('Failed to execute command');
    } finally {
      setTogglingAll(false);
      setTogglingId(null);
      setShowReasonModal(false);
      setPendingToggle(null);
    }
  };

  const createSchedule = async () => {
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
    }
  };

  const deleteSchedule = async (id: number) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await fetch(`${API_URL}/fund-managers/schedules/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, action: 'delete', schedule_id: id }),
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          {/* Avatar Upload */}
          <div className="relative group flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center overflow-hidden">
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
          <div>
            <button onClick={() => router.push('/dashboard/fund-managers')} className="text-cyan-400 hover:text-cyan-300 text-xs mb-1 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              FM Dashboard
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm">{profile.display_name} • {profile.tier} tier</p>
            {avatarError && <p className="text-red-400 text-xs mt-1">{avatarError}</p>}
            <p className="text-gray-600 text-[10px] mt-0.5">Hover profile picture to change it</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => initiateToggle('ea_off', 'all')}
            disabled={togglingAll}
            className="flex items-center gap-2 bg-red-500/20 text-red-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition text-xs sm:text-sm font-medium disabled:opacity-50"
          >
            <PowerOff className="w-4 h-4" /> All OFF
          </button>
          <button
            onClick={() => initiateToggle('ea_on', 'all')}
            disabled={togglingAll}
            className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition text-xs sm:text-sm font-medium disabled:opacity-50"
          >
            <Power className="w-4 h-4" /> All ON
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Active Subs', value: stats.active_subscribers, icon: Users, color: 'text-cyan-400' },
          { label: 'Trial Subs', value: stats.trial_subscribers, icon: Clock, color: 'text-yellow-400' },
          { label: 'Balance', value: `$${parseFloat(stats.total_managed_balance).toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Equity', value: `$${parseFloat(stats.total_managed_equity).toLocaleString()}`, icon: BarChart3, color: 'text-blue-400' },
          { label: 'Monthly Rev', value: `$${parseFloat(stats.monthly_revenue).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-400' },
          { label: 'Net Earnings', value: `$${parseFloat(stats.net_earnings).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className={`${s.color} font-bold text-lg`}>{s.value}</div>
            <div className="text-gray-500 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 mb-6 bg-[#12121a] p-1 rounded-lg border border-cyan-500/10">
        {(['subscribers', 'commands', 'schedules', 'earnings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition capitalize ${
              activeSection === tab ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                    <div className="text-left min-w-0">
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
                    </div>
                  </button>
                  {/* Right: status + expand toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
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

                {/* Expanded: Account Details */}
                {expandedSub === sub.subscription_id && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    {sub.accounts.map((acc: any) => (
                      <div key={acc.assignment_id} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-3">
                        <div>
                          <div className="text-white text-sm font-medium">MT5: {acc.mt5_account}</div>
                          {acc.balance && (
                            <div className="text-gray-500 text-xs mt-1">
                              Balance: ${parseFloat(acc.balance).toLocaleString()} • Equity: ${parseFloat(acc.equity).toLocaleString()} • P/L: <span className={parseFloat(acc.profit) >= 0 ? 'text-green-400' : 'text-red-400'}>${acc.profit}</span>
                            </div>
                          )}
                          {acc.last_toggled_reason && (
                            <div className="text-yellow-400/70 text-[10px] mt-1">Last: {acc.last_toggled_reason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${acc.is_ea_active ? 'text-green-400' : 'text-red-400'}`}>
                            EA {acc.is_ea_active ? 'ON' : 'OFF'}
                          </span>
                          <button
                            onClick={() => initiateToggle(acc.is_ea_active ? 'ea_off' : 'ea_on', acc.assignment_id)}
                            disabled={togglingId === acc.assignment_id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              acc.is_ea_active
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                            }`}
                          >
                            {togglingId === acc.assignment_id ? <Loader2 className="w-3 h-3 animate-spin" /> : acc.is_ea_active ? 'Turn OFF' : 'Turn ON'}
                          </button>
                        </div>
                      </div>
                    ))}
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
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Recent Commands</h3>
          </div>
          {recent_commands.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No commands issued yet</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {recent_commands.map((cmd: any) => (
                <div key={cmd.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {cmd.command_type === 'ea_on' ? (
                      <Power className="w-5 h-5 text-green-400" />
                    ) : (
                      <PowerOff className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <div className="text-white text-sm">
                        {cmd.command_type === 'ea_on' ? 'EA Enabled' : 'EA Disabled'} — {cmd.target_type === 'all' ? 'All Accounts' : 'Specific Account'}
                      </div>
                      {cmd.reason && <div className="text-gray-500 text-xs">{cmd.reason}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 text-xs">{cmd.affected_accounts} affected</div>
                    <div className="text-gray-600 text-[10px]">{new Date(cmd.created_at).toLocaleString()}</div>
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
                <button onClick={createSchedule} className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-bold">Create</button>
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
                  <button onClick={() => deleteSchedule(s.id)} className="text-red-400/50 hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Earnings Section */}
      {activeSection === 'earnings' && (
        <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-6">Earnings Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-[#0a0a0f] rounded-xl p-5 border border-gray-800">
              <div className="text-gray-500 text-xs mb-2">Monthly Revenue</div>
              <div className="text-green-400 font-bold text-2xl">${parseFloat(stats.monthly_revenue).toLocaleString()}</div>
              <div className="text-gray-600 text-xs mt-1">{stats.active_subscribers} active subscribers × ${dashboard.profile.monthly_price || '0'}</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-5 border border-gray-800">
              <div className="text-gray-500 text-xs mb-2">Platform Fee</div>
              <div className="text-red-400 font-bold text-2xl">-${parseFloat(stats.platform_fee).toLocaleString()}</div>
              <div className="text-gray-600 text-xs mt-1">15% platform commission</div>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-5 border border-gray-800">
              <div className="text-gray-500 text-xs mb-2">Net Earnings</div>
              <div className="text-emerald-400 font-bold text-2xl">${parseFloat(stats.net_earnings).toLocaleString()}</div>
              <div className="text-gray-600 text-xs mt-1">Your monthly take-home</div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl max-w-md w-full p-6">
            <h3 className="text-white font-bold text-lg mb-2">
              {pendingToggle?.action === 'ea_on' ? 'Enable EA' : 'Disable EA'}
              {pendingToggle?.target === 'all' ? ' — All Accounts' : ''}
            </h3>
            <p className="text-gray-400 text-sm mb-4">Provide a reason (shown to subscribers):</p>
            <input
              type="text"
              placeholder="e.g., NFP News Release, High volatility..."
              value={toggleReason}
              onChange={e => setToggleReason(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowReasonModal(false); setPendingToggle(null); }}
                className="flex-1 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeToggle}
                className={`flex-1 py-2.5 font-bold rounded-lg text-sm transition ${
                  pendingToggle?.action === 'ea_on'
                    ? 'bg-green-500 text-black hover:bg-green-400'
                    : 'bg-red-500 text-white hover:bg-red-400'
                }`}
              >
                Confirm {pendingToggle?.action === 'ea_on' ? 'Enable' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
