'use client';

import Link from 'next/link';
import { Bot, ArrowLeft, FileText, Shield, AlertTriangle, CreditCard, Users, Scale, XCircle, RefreshCw, Mail, CheckCircle } from 'lucide-react';

export default function TermsPage() {
  const currentYear = new Date().getFullYear();
  
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px]" />

      {/* Navigation */}
      <nav className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Back to Home</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
            </div>
            <span className="text-sm sm:text-base font-bold hidden sm:inline" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-2 mb-4">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-xs sm:text-sm font-medium">Legal Document</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Terms & <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400">Conditions</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Please read these terms carefully before using Mark's AI 3.0 Expert Advisor
          </p>
        </div>
        
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">1. Acceptance of Terms</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  By accessing, downloading, installing, or using Mark's AI 3.0 Expert Advisor ("EA"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree to these terms, you must not use the EA.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">2. License Grant</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to use the EA software on the MetaTrader 5 platform for your personal trading purposes.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Single Account:</strong> Each license is valid for one MT5 trading account only</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Hardware Binding:</strong> License is bound to your specific account number and hardware ID</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Non-Transferable:</strong> License cannot be sold, shared, transferred, or sublicensed</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Time-Limited:</strong> License is valid for the purchased subscription period only</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 - Risk Disclosure */}
          <section className="bg-[#12121a]/80 border border-red-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-red-400 mb-2 sm:mb-3">3. Risk Disclosure (Important)</h2>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 sm:p-4 mb-3">
                  <p className="text-red-300 text-sm sm:text-base font-medium">
                    ⚠️ Trading foreign exchange (Forex), CFDs, and other financial instruments involves substantial risk of loss and is not suitable for all investors.
                  </p>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Past performance does not guarantee or indicate future results</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>You may lose some or all of your invested capital</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Only trade with money you can afford to lose without affecting your lifestyle</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Seek independent professional financial advice before trading</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Automated trading systems carry additional risks including technical failures</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 border border-purple-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">4. No Guarantee of Profits</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  We make no representations, warranties, or guarantees that the EA will generate profits or prevent losses. All trading results are entirely dependent on market conditions, broker execution, your account settings, risk management, and various other factors beyond our control. Any testimonials or performance results shown are not typical and should not be relied upon as indicators of future performance.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/10 border border-green-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">5. Payment & Refund Policy</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  Due to the digital nature of the product and immediate license activation:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-green-400 mt-1">•</span>
                    <span>All sales are final upon license activation</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-green-400 mt-1">•</span>
                    <span>No refunds will be provided after the license has been activated</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-green-400 mt-1">•</span>
                    <span>License extensions and renewals are non-refundable</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-green-400 mt-1">•</span>
                    <span>Chargebacks or payment disputes will result in immediate license termination</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">6. User Responsibilities</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  By using the EA, you agree to:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Keep your license key strictly confidential and secure</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Not share, sell, rent, lease, or distribute the EA software</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Not attempt to reverse engineer, decompile, or modify the EA</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Use the EA in accordance with your broker's terms and conditions</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Ensure you have a stable internet connection and VPS for optimal performance</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/10 border border-orange-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">7. Limitation of Liability</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  To the maximum extent permitted by applicable law, Mark's AI, its developers, affiliates, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from or related to your use of the EA. This includes, but is not limited to, trading losses, lost profits, data loss, system failures, or any other damages, even if we have been advised of the possibility of such damages.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">8. Termination</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  We reserve the right to terminate or suspend your license immediately, without prior notice, if you violate any of these Terms. Upon termination, you must immediately cease all use of the EA and delete all copies from your systems. We may also terminate licenses for suspected fraudulent activity, license sharing, or any actions that harm our business or other users.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 border border-blue-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">9. Updates and Modifications</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  We may update, modify, or discontinue the EA software at any time without prior notice. We may also update these Terms and Conditions periodically. Your continued use of the EA after any changes constitutes your acceptance of the updated terms. It is your responsibility to review these Terms regularly.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">10. Contact Information</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  If you have any questions, concerns, or inquiries regarding these Terms and Conditions, please contact us:
                </p>
                <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3 sm:p-4">
                  <p className="text-cyan-400 text-sm sm:text-base">
                    📧 Email: <a href="mailto:support@markstrades.com" className="hover:text-cyan-300 underline">support@markstrades.com</a>
                  </p>
                  <p className="text-cyan-400 text-sm sm:text-base mt-1">
                    🌐 Website: <a href="https://markstrades.com" className="hover:text-cyan-300 underline">markstrades.com</a>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 sm:mt-12 pt-6 border-t border-cyan-500/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-xs sm:text-sm">
              Last updated: December {currentYear}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
                Privacy Policy
              </Link>
              <span className="text-gray-700">•</span>
              <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
                Back to Home
              </Link>
            </div>
          </div>
          <p className="text-center text-gray-600 text-xs mt-4">
            © {currentYear} Mark's AI - Advanced Gold Scalping EA. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
