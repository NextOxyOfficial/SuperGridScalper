'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDashboard } from '../../context';
import {
  Star, Shield, Crown, Users, TrendingUp, Clock, ArrowLeft,
  MessageCircle, Calendar, ChevronDown, ChevronUp, Check, Loader2,
  Send, Pin, Megaphone, Zap, AlertTriangle, DollarSign, BarChart3,
  Mic, MicOff, StopCircle, X, Eye, EyeOff
} from 'lucide-react';

export default function FundManagerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, licenses, API_URL } = useDashboard();
  const fmId = params.id;

  const [fm, setFm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'chat' | 'schedule'>('overview');

  // Subscription state
  const [mySubscription, setMySubscription] = useState<any>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedLicenses, setSelectedLicenses] = useState<number[]>([]);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [usedLicenseMap, setUsedLicenseMap] = useState<Record<number, string>>({});

  // Unsubscribe modal state
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [unsubPassword, setUnsubPassword] = useState('');
  const [unsubPasswordVisible, setUnsubPasswordVisible] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [unsubError, setUnsubError] = useState('');

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isFm, setIsFm] = useState(false);
  const [chatError, setChatError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const chatErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Review state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const isGuest = !user?.email;

  useEffect(() => {
    fetchFMDetail();
    fetchMySubscription();
  }, [fmId]);

  useEffect(() => {
    if (activeTab === 'chat' && mySubscription?.is_active) {
      fetchChat();
      connectChatWS();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeTab, mySubscription]);

  const fetchFMDetail = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/${fmId}/`);
      const data = await res.json();
      if (data.success) setFm(data.fund_manager);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMySubscription = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`${API_URL}/fund-managers/my-subscriptions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        const sub = data.subscriptions.find((s: any) => s.fund_manager.id === Number(fmId));
        setMySubscription(sub || null);
        // Convert string keys from JSON back to number keys
        const map: Record<number, string> = {};
        if (data.used_license_map) {
          Object.entries(data.used_license_map).forEach(([k, v]) => { map[Number(k)] = v as string; });
        }
        setUsedLicenseMap(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubscribe = async () => {
    const validSelected = selectedLicenses.filter((id) => Number.isFinite(id) && id > 0);
    if (!user?.email || validSelected.length === 0) {
      alert('Please select at least one valid MT5 license.');
      return;
    }
    setSubscribing(true);
    try {
      const res = await fetch(`${API_URL}/fund-managers/subscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          fund_manager_id: Number(fmId),
          license_ids: validSelected,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSubscribeModal(false);
        fetchMySubscription();
      } else {
        // If conflict, refresh the license map so modal shows updated used-by info
        if (data.already_used) {
          const map = { ...usedLicenseMap };
          data.already_used.forEach((u: any) => { map[u.license_id] = u.fm_name; });
          setUsedLicenseMap(map);
          // Deselect conflicting licenses
          const conflictIds = new Set(data.already_used.map((u: any) => u.license_id));
          setSelectedLicenses(prev => prev.filter(id => !conflictIds.has(id)));
        }
        alert(data.error || 'Failed to subscribe');
      }
    } catch (err) {
      alert('Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!unsubPassword.trim()) {
      setUnsubError('Please enter your password.');
      return;
    }
    setUnsubscribing(true);
    setUnsubError('');
    try {
      const res = await fetch(`${API_URL}/fund-managers/unsubscribe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, fund_manager_id: Number(fmId), password: unsubPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setMySubscription(null);
        setShowUnsubscribeModal(false);
        setUnsubPassword('');
      } else {
        setUnsubError(data.error || 'Failed to unsubscribe.');
      }
    } catch (err) {
      setUnsubError('Network error. Please try again.');
    } finally {
      setUnsubscribing(false);
    }
  };

  // Chat functions
  const fetchChat = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, fund_manager_id: Number(fmId) }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages.reverse());
        setPinnedMessages(data.pinned);
        setIsFm(data.is_fm);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const connectChatWS = () => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const wsUrl = API_URL.replace('http', 'ws').replace('/api', '');
    const ws = new WebSocket(`${wsUrl}/ws/fm-chat/${fmId}/${encodeURIComponent(user.email)}/`);
    ws.onopen = () => {};
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message' || data.type === 'announcement') {
          setMessages(prev => {
            // Deduplicate by id
            if (prev.some((m: any) => m.id === data.data.id)) return prev;
            return [...prev, data.data];
          });
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else if (data.type === 'fm_command') {
          // Show a system-style notification message in the chat
          const cmdMsg = {
            id: `cmd_${Date.now()}`,
            sender_name: data.data.fm_name || 'Fund Manager',
            sender_email: '',
            is_fm: true,
            message: data.data.command_type === 'ea_on'
              ? `🟢 Robot STARTED by FM. Reason: ${data.data.reason || 'FM action'}`
              : `🔴 Robot STOPPED by FM. Reason: ${data.data.reason || 'FM action'}`,
            message_type: 'announcement',
            image_url: null,
            voice_url: null,
            reply_to: null,
            created_at: data.data.timestamp || new Date().toISOString(),
          };
          setMessages(prev => [...prev, cmdMsg]);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else if (data.type === 'user_joined') {
          // silent - no UI update needed
        } else if (data.type === 'pong') {
          // heartbeat response
        }
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      // Auto-reconnect after 3s if tab is still open
      setTimeout(() => {
        if (activeTab === 'chat' && mySubscription?.is_active) connectChatWS();
      }, 3000);
    };
    wsRef.current = ws;
  };

  // Heartbeat to keep WS alive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        await sendVoiceMessage(blob, mr.mimeType);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      showChatError('Microphone access denied. Please allow microphone permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const sendVoiceMessage = async (blob: Blob, mimeType: string) => {
    setSendingVoice(true);
    try {
      const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('email', user.email);
      formData.append('fund_manager_id', String(fmId));
      formData.append('media_type', 'voice');
      formData.append('file', blob, `voice_${Date.now()}.${ext}`);
      const res = await fetch(`${API_URL}/fund-managers/chat/media/`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        showChatError(data.error || 'Failed to send voice message.');
      }
    } catch {
      showChatError('Failed to send voice message.');
    } finally {
      setSendingVoice(false);
    }
  };

  const showChatError = (msg: string) => {
    setChatError(msg);
    if (chatErrorTimerRef.current) clearTimeout(chatErrorTimerRef.current);
    chatErrorTimerRef.current = setTimeout(() => setChatError(''), 4000);
  };

  const sendMessage = async (type: string = 'message') => {
    if (!chatMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`${API_URL}/fund-managers/chat/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          fund_manager_id: Number(fmId),
          message: chatMessage,
          message_type: type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setChatMessage('');
        setChatError('');
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        showChatError(data.error || 'Failed to send message.');
      }
    } catch (err) {
      showChatError('Network error. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const submitReview = async () => {
    if (!reviewRating) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/fund-managers/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          fund_manager_id: Number(fmId),
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchFMDetail();
        setReviewRating(0);
        setReviewComment('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    const stars = [];
    const r = parseFloat(String(rating));
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${interactive ? 'cursor-pointer' : ''} ${
            i <= r ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
          }`}
          onClick={interactive ? () => setReviewRating(i) : undefined}
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!fm) {
    return (
      <div className="max-w-4xl mx-auto px-1 sm:px-4 py-10 text-center">
        <p className="text-gray-400">Fund manager not found</p>
        <button onClick={() => router.back()} className="mt-4 text-cyan-400 hover:text-cyan-300">← Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-1 sm:px-4 py-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/fund-managers')}
        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6 text-sm transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Fund Managers
      </button>

      {/* Profile Header */}
      <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl overflow-hidden mb-6">
        {fm.is_featured && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 px-4 sm:px-6 py-2 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-xs font-semibold">FEATURED FUND MANAGER</span>
          </div>
        )}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 border-2 border-cyan-500/20 mx-auto sm:mx-0">
              {fm.avatar_url ? (
                <img src={fm.avatar_url} alt={fm.display_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-cyan-400">{fm.display_name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {fm.display_name}
                </h1>
                {fm.is_verified && <Shield className="w-5 h-5 text-cyan-400 mx-auto sm:mx-0" />}
              </div>
              <p className="text-gray-400 text-sm mb-3 leading-relaxed">{fm.bio || 'No bio provided'}</p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 capitalize">
                  {fm.tier}
                </span>
                <div className="flex items-center gap-1">
                  {renderStars(fm.average_rating)}
                  <span className="text-gray-400 text-xs ml-1">{fm.average_rating} ({fm.total_reviews} reviews)</span>
                </div>
                {fm.trading_pairs.split(',').map((pair: string) => (
                  <span key={pair} className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20">
                    {pair.trim()}
                  </span>
                ))}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-cyan-400 font-bold text-base sm:text-lg">{fm.total_profit_percent}%</div>
                  <div className="text-gray-500 text-xs">Total Profit</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-green-400 font-bold text-base sm:text-lg">{fm.win_rate}%</div>
                  <div className="text-gray-500 text-xs">Win Rate</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-purple-400 font-bold text-base sm:text-lg">{fm.subscriber_count}</div>
                  <div className="text-gray-500 text-xs">Subscribers</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-yellow-400 font-bold text-base sm:text-lg">{fm.months_active}mo</div>
                  <div className="text-gray-500 text-xs">Active</div>
                </div>
                <div className="text-center sm:text-left col-span-2 sm:col-span-1">
                  <div className="text-white font-bold text-base sm:text-lg">${fm.monthly_price}</div>
                  <div className="text-gray-500 text-xs">Per Month</div>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribe Button */}
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            {isGuest ? (
              <button
                onClick={() => router.push('/')}
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold px-6 sm:px-8 py-3 rounded-lg transition-all text-sm"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Login to Subscribe — ${fm.monthly_price}/mo
              </button>
            ) : mySubscription?.is_active ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-green-500/20 w-full sm:w-auto justify-center">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Subscribed ({mySubscription.days_remaining}d remaining)</span>
                </div>
                <button
                  onClick={() => { setUnsubError(''); setUnsubPassword(''); setShowUnsubscribeModal(true); }}
                  className="text-red-400 hover:text-red-300 text-sm px-3 py-2 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition w-full sm:w-auto"
                >
                  Unsubscribe
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSubscribeModal(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold px-6 sm:px-8 py-3 rounded-lg transition-all text-sm"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {fm.trial_days > 0 ? `Subscribe for ${fm.trial_days} Days Free Trial` : `Subscribe for 30 Days — $${fm.monthly_price}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#12121a] p-1 rounded-xl border border-cyan-500/10">
        {(['overview', 'chat', 'schedule', 'reviews'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 sm:py-2.5 px-1 sm:px-3 text-[10px] sm:text-xs font-semibold rounded-lg transition capitalize whitespace-nowrap ${
              activeTab === tab
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {tab === 'chat' && !mySubscription?.is_active ? '🔒 Chat' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          {/* Managed Accounts Stats */}
          <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4 sm:p-5">
            <h3 className="text-white text-sm sm:text-base font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" /> Portfolio Stats
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Managed Accounts</span>
                <span className="text-white font-medium text-xs sm:text-sm">{fm.total_managed_accounts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Total Balance</span>
                <span className="text-white font-medium text-xs sm:text-sm">${parseFloat(fm.total_managed_balance || '0').toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Max Subscribers</span>
                <span className="text-white font-medium text-xs sm:text-sm">{fm.subscriber_count}/{fm.max_subscribers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs sm:text-sm">Trading Style</span>
                <span className="text-cyan-300 font-medium text-xs sm:text-sm">{fm.trading_style || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Schedules Preview */}
          <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4 sm:p-5">
            <h3 className="text-white text-sm sm:text-base font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" /> Trading Schedule
            </h3>
            {fm.schedules?.length > 0 ? (
              <div className="space-y-3">
                {fm.schedules.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-3">
                    <div>
                      <div className="text-white text-sm font-medium">{s.name}</div>
                      <div className="text-gray-500 text-xs">{s.day} • OFF {s.off_time} → ON {s.on_time} UTC</div>
                    </div>
                    {s.reason && (
                      <span className="text-yellow-400 text-xs">{s.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No scheduled breaks</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Write Review */}
          {mySubscription && (
            <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4 sm:p-5">
              <h3 className="text-white font-semibold mb-3">Write a Review</h3>
              <div className="flex items-center gap-1 mb-3">{renderStars(reviewRating, true)}</div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                rows={3}
              />
              <button
                onClick={submitReview}
                disabled={!reviewRating || submittingReview}
                className="mt-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-2 rounded-lg text-sm disabled:opacity-50 transition"
              >
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Review'}
              </button>
            </div>
          )}

          {/* Existing Reviews */}
          {fm.reviews?.length > 0 ? (
            fm.reviews.map((r: any, i: number) => (
              <div key={i} className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{r.user}</span>
                    <div className="flex">{renderStars(r.rating)}</div>
                  </div>
                  <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-gray-300 text-sm">{r.comment}</p>}
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No reviews yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <>
          {!mySubscription?.is_active ? (
            <div className="text-center py-20 bg-[#12121a] border border-cyan-500/10 rounded-xl">
              <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">{isGuest ? 'Login to Access Chat' : 'Subscribe to Access Chat'}</h3>
              <p className="text-gray-400 text-sm mb-4">Join this fund manager's community to chat with other subscribers</p>
              <button
                onClick={() => isGuest ? router.push('/') : setShowSubscribeModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-2.5 rounded-lg text-sm transition"
              >
                {isGuest ? 'Login / Register' : 'Subscribe Now'}
              </button>
            </div>
          ) : (
            <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl overflow-hidden flex flex-col" style={{ height: '420px' }}>
              {/* Pinned Messages */}
              {pinnedMessages.length > 0 && (
                <div className="bg-yellow-500/5 border-b border-yellow-500/20 px-4 py-2">
                  {pinnedMessages.map((m: any) => (
                    <div key={m.id} className="flex items-start gap-2 text-xs">
                      <Pin className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-yellow-300 font-medium">{m.sender_name}:</span>
                      <span className="text-gray-300 truncate">{m.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m: any) => (
                  <div key={m.id} className={`flex gap-2 ${m.sender_email === user.email ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-1 ${
                      m.is_fm ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {m.sender_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[72%] flex flex-col ${m.sender_email === user.email ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-semibold ${m.is_fm ? 'text-cyan-400' : 'text-gray-400'}`}>
                          {m.sender_name}{m.is_fm && ' ·FM'}
                        </span>
                        <span className="text-gray-600 text-[9px]">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Voice message */}
                      {m.message_type === 'voice' && m.voice_url ? (
                        <div className={`rounded-2xl px-3 py-2.5 flex items-center gap-2 min-w-[200px] ${
                          m.sender_email === user.email ? 'bg-cyan-500/20 border border-cyan-500/20' : 'bg-[#1a1a2e] border border-gray-700'
                        }`}>
                          <Mic className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <audio
                            controls
                            src={m.voice_url.startsWith('http') ? m.voice_url : `${API_URL.replace('/api', '')}${m.voice_url}`}
                            className="h-8 flex-1"
                            style={{ filter: 'invert(0.8) hue-rotate(180deg)', maxWidth: '180px' }}
                          />
                        </div>
                      ) : (
                        /* Text / announcement / signal message */
                        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          m.message_type === 'announcement'
                            ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-tl-sm'
                            : m.message_type === 'signal'
                            ? 'bg-green-500/10 border border-green-500/20 text-green-200 rounded-tl-sm'
                            : m.sender_email === user.email
                            ? 'bg-cyan-600 text-white rounded-tr-sm'
                            : 'bg-[#1e1e2e] text-gray-200 rounded-tl-sm'
                        }`}>
                          {m.message_type === 'announcement' && <Megaphone className="w-3 h-3 inline mr-1.5" />}
                          {m.message_type === 'signal' && <Zap className="w-3 h-3 inline mr-1.5" />}
                          {m.message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Warning / Error Banner */}
              {chatError && (
                <div className="mx-3 mb-1 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{chatError}</span>
                </div>
              )}

              {/* Recording indicator bar */}
              {isRecording && (
                <div className="mx-3 mb-1 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-red-400 text-xs font-semibold flex-1">Recording... {recordingSeconds}s</span>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop & Send
                  </button>
                </div>
              )}

              {/* Input area */}
              <div className="border-t border-gray-800 p-3 flex gap-2 items-center">
                {/* Voice record button */}
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={sendingVoice}
                    title="Record voice message"
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a2e] border border-gray-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-gray-400 hover:text-cyan-400 transition disabled:opacity-40"
                  >
                    {sendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    title="Stop recording"
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                  >
                    <MicOff className="w-4 h-4" />
                  </button>
                )}

                {/* Text input */}
                <input
                  type="text"
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={isRecording ? 'Recording in progress...' : 'Type a message...'}
                  disabled={isRecording}
                  className={`flex-1 bg-[#0a0a0f] border rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none transition ${
                    chatError ? 'border-red-500/50' : isRecording ? 'border-gray-700 opacity-50' : 'border-cyan-500/20 focus:border-cyan-500/50'
                  }`}
                />

                {/* FM announcement button */}
                {isFm && !isRecording && (
                  <button
                    onClick={() => sendMessage('announcement')}
                    title="Send as Announcement"
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 transition"
                  >
                    <Megaphone className="w-4 h-4" />
                  </button>
                )}

                {/* Send button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatMessage.trim() || sendingMessage || isRecording}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-40 transition"
                >
                  {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-[#12121a] border border-cyan-500/10 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-400" /> EA Trading Schedule
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            This fund manager's EA on/off schedule. During OFF periods, your EA will not open new trades.
          </p>
          {fm.schedules?.length > 0 ? (
            <div className="space-y-3">
              {fm.schedules.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">{s.name}</div>
                      <div className="text-gray-500 text-xs mt-1">
                        Every {s.day} • EA OFF at {s.off_time} UTC → EA ON at {s.on_time} UTC
                      </div>
                    </div>
                  </div>
                  {s.reason && (
                    <span className="text-yellow-400/70 text-xs bg-yellow-500/5 px-2 py-1 rounded">{s.reason}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No scheduled breaks — EA runs 24/5</p>
            </div>
          )}
        </div>
      )}

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl max-w-md w-full p-6">
            <h2 className="text-white text-lg font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Subscribe to {fm.display_name}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              {fm.trial_days > 0
                ? `Start with a ${fm.trial_days}-day free trial, then $${fm.monthly_price}/month`
                : `$${fm.monthly_price}/month`}
            </p>

            <div className="mb-4">
              <label className="text-gray-300 text-sm font-medium block mb-2">Select MT5 accounts to assign:</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {licenses.filter((l: any) => l.status === 'active').length === 0 ? (
                  <p className="text-gray-500 text-sm py-3 text-center">No active MT5 licenses found.</p>
                ) : licenses.filter((l: any) => l.status === 'active').map((lic: any) => {
                  const licenseId = Number(lic.id);
                  const hasValidId = Number.isFinite(licenseId) && licenseId > 0;
                  const usedByFM = usedLicenseMap[lic.id];
                  const isUsed = !!usedByFM;
                  const isDisabled = isUsed || !hasValidId;
                  return (
                    <label
                      key={lic.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                        isDisabled
                          ? 'bg-gray-800/40 border-gray-700 opacity-60 cursor-not-allowed'
                          : selectedLicenses.includes(licenseId)
                          ? 'bg-cyan-500/10 border-cyan-500/30 cursor-pointer'
                          : 'bg-[#0a0a0f] border-gray-800 hover:border-gray-700 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isDisabled}
                        checked={selectedLicenses.includes(licenseId)}
                        onChange={() => {
                          if (isDisabled) return;
                          setSelectedLicenses(prev =>
                            prev.includes(licenseId) ? prev.filter(id => id !== licenseId) : [...prev, licenseId]
                          );
                        }}
                        className="accent-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">MT5: {lic.mt5_account || 'Unbound'}</div>
                        {isUsed ? (
                          <div className="text-yellow-400 text-[10px] flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                            Already assigned to <span className="font-semibold ml-0.5">{usedByFM}</span>
                          </div>
                        ) : !hasValidId ? (
                          <div className="text-red-400 text-[10px] mt-0.5">License metadata missing (refresh required)</div>
                        ) : (
                          <div className="text-gray-500 text-xs">{lic.plan} · {lic.license_key?.slice(0, 12)}...</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="flex-1 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubscribe}
                disabled={selectedLicenses.length === 0 || subscribing}
                className="flex-1 py-2.5 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
              >
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Unsubscribe Confirmation Modal */}
      {showUnsubscribeModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-red-500/30 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <AlertTriangle className="w-5 h-5 text-red-400" /> Unsubscribe
              </h2>
              <button onClick={() => setShowUnsubscribeModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-5">
              <p className="text-red-300 text-sm font-semibold mb-2">⚠️ Before you unsubscribe, please note:</p>
              <ul className="text-gray-400 text-sm space-y-1.5">
                <li>• <strong className="text-white">Your robot will no longer be managed</strong> by {fm?.display_name}.</li>
                <li>• You will lose access to the FM chat and trading signals.</li>
                <li>• Future scheduled events by this FM will not affect you.</li>
                <li>• Your MT5 accounts will be returned to your direct control.</li>
                <li>• <strong className="text-yellow-300">This action cannot be undone</strong> — you would need to re-subscribe.</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="text-gray-300 text-sm font-medium block mb-2">Confirm with your password:</label>
              <div className="relative">
                <input
                  type={unsubPasswordVisible ? 'text' : 'password'}
                  value={unsubPassword}
                  onChange={(e) => setUnsubPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnsubscribe(); }}
                  placeholder="Enter your account password"
                  className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm pr-10 focus:outline-none focus:border-red-500/50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setUnsubPasswordVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {unsubPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {unsubError && <p className="text-red-400 text-xs mt-1.5">{unsubError}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUnsubscribeModal(false)}
                className="flex-1 py-2.5 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition text-sm"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleUnsubscribe}
                disabled={unsubscribing || !unsubPassword.trim()}
                className="flex-1 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
              >
                {unsubscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Unsubscribe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
