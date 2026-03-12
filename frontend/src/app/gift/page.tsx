'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gift, CheckCircle, Loader2, ArrowLeft, Copy, Check, X, Upload, ChevronDown, Clock, Shield, Sparkles } from 'lucide-react'
import axios from 'axios'
import QRCode from 'qrcode'
import Header from '@/components/Header'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000/api'
    : 'https://markstrades.com/api')

interface Plan {
  id: number
  name: string
  description: string
  price: string
  duration_days: number
  max_accounts: number
}

export default function GiftPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1=configure, 2=payment, 3=success
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  // Buyer info
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerName, setBuyerName] = useState('')

  // Recipient info
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [giftToSelf, setGiftToSelf] = useState(false)

  // Payment
  const [paymentNetworks, setPaymentNetworks] = useState<any[]>([])
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('')
  const [txid, setTxid] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [qrCode, setQrCode] = useState('')
  const [walletCopied, setWalletCopied] = useState(false)

  // Result
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string; giftCode?: string } | null>(null)

  useEffect(() => {
    fetchPlans()
    fetchPaymentNetworks()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API_URL}/gift/plans/`)
      if (res.data.success) {
        setPlans(res.data.plans || [])
        if (res.data.plans?.length) setSelectedPlanId(String(res.data.plans[0].id))
      }
    } catch { }
    setLoading(false)
  }

  const fetchPaymentNetworks = async () => {
    try {
      const res = await fetch(`${API_URL}/payment-networks/`)
      const data = await res.json()
      if (data.success) {
        setPaymentNetworks(data.networks || [])
        if (data.networks?.length) setSelectedNetworkId(String(data.networks[0].id))
      }
    } catch { }
  }

  const selectedPlan = plans.find(p => String(p.id) === selectedPlanId) || null
  const selectedNetwork = paymentNetworks.find((n) => String(n.id) === String(selectedNetworkId))

  useEffect(() => {
    if (selectedNetwork?.wallet_address) {
      QRCode.toDataURL(selectedNetwork.wallet_address, { width: 200, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } })
        .then((url: string) => setQrCode(url))
        .catch(() => setQrCode(''))
    } else {
      setQrCode('')
    }
  }, [selectedNetworkId, paymentNetworks])

  const copyWallet = () => {
    if (selectedNetwork?.wallet_address) {
      navigator.clipboard.writeText(selectedNetwork.wallet_address)
      setWalletCopied(true)
      setTimeout(() => setWalletCopied(false), 2000)
    }
  }

  const canProceedToPayment = !!selectedPlan && !!buyerEmail.trim() && !!recipientEmail.trim()

  const handleSubmit = async () => {
    if (!selectedPlan || !buyerEmail || !recipientEmail || !selectedNetworkId) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await axios.post(`${API_URL}/gift/purchase/`, {
        buyer_email: buyerEmail.trim(),
        buyer_name: buyerName.trim(),
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim(),
        gift_message: giftMessage.trim(),
        plan_id: selectedPlan.id,
        txid: txid.trim(),
        payment_network: selectedNetwork?.name || '',
      })
      if (res.data.success) {
        setResult({ type: 'success', text: res.data.message, giftCode: res.data.gift?.gift_code })
        setStep(3)
      } else {
        setResult({ type: 'error', text: res.data.message || 'Something went wrong' })
      }
    } catch (err: any) {
      setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to process gift purchase' })
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      <div className="max-w-lg mx-auto px-1 pt-24 pb-16">
        {/* Gift Voucher Illustration */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="bg-gradient-to-br from-purple-600/20 via-purple-500/10 to-cyan-500/20 border border-purple-500/30 rounded-2xl p-6 shadow-2xl shadow-purple-500/10 transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-yellow-900" />
              </div>
              <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <Gift className="w-3 h-3 text-pink-900" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-cyan-400 rounded-xl flex items-center justify-center mb-3">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 mb-2">
                    <p className="text-xs font-bold text-purple-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>GIFT VOUCHER</p>
                  </div>
                  <div className="bg-white/5 rounded px-2 py-1">
                    <p className="text-[10px] text-gray-400">Redeemable License</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Hero */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Gift a License to your friend!
          </h1>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Buy a voucher for someone or yourself. Expiry starts only when redeemed.
          </p>
        </div>

        {/* Step 1: Single Gift Card — configure everything */}
        {step === 1 && (
          <div className="bg-[#12121a] border border-purple-500/20 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-b border-purple-500/20 px-5 py-3">
              <p className="text-xs font-bold text-purple-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>GIFT VOUCHER</p>
            </div>

            <div className="p-3 space-y-4">
              {/* Duration dropdown + price */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block font-medium">Select Duration</label>
                <div className="relative">
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-3 text-white text-sm focus:border-purple-500 focus:outline-none appearance-none cursor-pointer pr-10"
                    style={{ fontSize: '16px' }}
                  >
                    {plans.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name} — {p.duration_days} days — ${p.price}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                {selectedPlan && (
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-gray-500 text-xs">{selectedPlan.max_accounts} MT5 Account{selectedPlan.max_accounts > 1 ? 's' : ''}</span>
                    <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${selectedPlan.price}</span>
                  </div>
                )}
              </div>

              <hr className="border-gray-800" />

              {/* Your email */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block font-medium">Your Email</label>
                <input type="email" placeholder="you@example.com" value={buyerEmail} onChange={(e) => { setBuyerEmail(e.target.value); if (giftToSelf) setRecipientEmail(e.target.value) }} className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none" style={{ fontSize: '16px' }} />
              </div>

              {/* Gift to self */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={giftToSelf} onChange={(e) => { setGiftToSelf(e.target.checked); if (e.target.checked) { setRecipientEmail(buyerEmail); setRecipientName(buyerName) } else { setRecipientEmail(''); setRecipientName('') } }} className="w-4 h-4 accent-purple-500 rounded" />
                <span className="text-sm text-gray-300">Buy for myself (redeem later)</span>
              </label>

              {/* Recipient email */}
              {!giftToSelf && (
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block font-medium">Recipient&apos;s Email</label>
                  <input type="email" placeholder="friend@example.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none" style={{ fontSize: '16px' }} />
                </div>
              )}

              {/* Optional message */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block font-medium">Message <span className="text-gray-600">(optional)</span></label>
                <textarea placeholder="Happy trading! 🎉" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={2} maxLength={300} className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none resize-none" />
              </div>

              {/* Proceed */}
              <button
                onClick={() => { if (canProceedToPayment) setStep(2) }}
                disabled={!canProceedToPayment}
                className="w-full py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-purple-500 to-cyan-400 hover:from-purple-400 hover:to-cyan-300 text-black disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Gift className="w-4 h-4" /> PROCEED TO PAYMENT — ${selectedPlan?.price || '0'}
              </button>
            </div>

            {/* Card footer info */}
            <div className="border-t border-gray-800 px-5 py-3 flex items-center gap-4 text-[10px] sm:text-xs text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expiry starts on redeem</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Verified delivery</span>
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Instant activation</span>
            </div>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && selectedPlan && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Complete Payment</h2>
            </div>

            {/* Summary */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-5 flex justify-between items-center">
              <div>
                <p className="text-white font-bold text-sm">{selectedPlan.name} Gift</p>
                <p className="text-gray-500 text-xs">To: {recipientEmail}</p>
              </div>
              <p className="text-lg font-bold text-purple-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${selectedPlan.price}</p>
            </div>

            <div className="space-y-4">
              {/* Network pills */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Payment Network</label>
                <div className="flex flex-wrap gap-2">
                  {paymentNetworks.map((n: any) => (
                    <button key={n.id} type="button" onClick={() => setSelectedNetworkId(String(n.id))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${String(n.id) === String(selectedNetworkId) ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'bg-white/5 text-gray-400 border-gray-700 hover:border-gray-500'}`}>
                      {n.name} ({n.token_symbol})
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallet + QR */}
              {selectedNetwork?.wallet_address && (
                <div className="bg-[#0a0a0f] border border-purple-500/20 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-2">
                    Send <span className="text-purple-400 font-bold">${selectedPlan.price}</span> in <span className="text-purple-400 font-bold">{selectedNetwork.token_symbol}</span> to:
                  </p>
                  <div className="flex items-center gap-2 bg-black/40 rounded-lg p-2">
                    <code className="text-cyan-300 text-xs flex-1 break-all">{selectedNetwork.wallet_address}</code>
                    <button onClick={copyWallet} className="p-1.5 rounded-md hover:bg-white/10 transition-colors flex-shrink-0">
                      {walletCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                  {qrCode && <div className="flex justify-center mt-3"><img src={qrCode} alt="QR" className="w-32 h-32 rounded-lg" /></div>}
                </div>
              )}

              {/* TXID */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Transaction ID (TXID) <span className="text-gray-600">(optional)</span></label>
                <input type="text" placeholder="Paste your transaction hash..." value={txid} onChange={(e) => setTxid(e.target.value)} className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 focus:outline-none" style={{ fontSize: '16px' }} />
              </div>

              {/* Proof */}
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block font-medium">Payment Proof <span className="text-purple-400">*</span></label>
                <label className="flex items-center gap-2 bg-[#0a0a0f] border border-purple-500/30 rounded-lg px-3 py-2.5 cursor-pointer hover:border-purple-400 transition-colors">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">{proofFile ? proofFile.name : 'Upload payment screenshot...'}</span>
                  <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="hidden" required />
                </label>
                <p className="text-gray-600 text-xs mt-1">Required for payment verification</p>
              </div>

              {result?.type === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{result.text}</p>
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting || !proofFile}
                className="w-full py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-purple-500 to-cyan-400 hover:from-purple-400 hover:to-cyan-300 text-black disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><Gift className="w-5 h-5" /> PURCHASE GIFT</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && result?.type === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Gift Purchase Received!</h2>
            <p className="text-gray-400 text-sm mb-5">{result.text}</p>

            <div className="bg-white/5 border border-green-500/20 rounded-xl p-5 mb-5 text-left">
              <div className="space-y-2">
                {[
                  ['Plan', selectedPlan?.name],
                  ['Amount', `$${selectedPlan?.price}`],
                  ['Gift To', recipientEmail],
                  ['Status', 'Payment Verification Pending'],
                ].map(([l, v], i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">{l}</span>
                    <span className={i === 3 ? 'text-yellow-400 font-medium' : i === 2 ? 'text-cyan-400' : 'text-white'}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-5 text-left">
              <p className="text-purple-300 text-xs font-bold mb-1.5">What happens next?</p>
              <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
                <li>We verify your payment (usually few hours)</li>
                <li>Gift code sent to <strong className="text-cyan-400">{recipientEmail}</strong></li>
                <li>Recipient redeems from dashboard</li>
                <li>License activates — expiry starts then</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setResult(null); setTxid(''); setProofFile(null) }} className="flex-1 py-2.5 rounded-xl font-bold bg-white/5 border border-gray-700 text-gray-300 hover:bg-white/10 text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Buy Another
              </button>
              <Link href="/dashboard" className="flex-1 py-2.5 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 text-black text-center text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
