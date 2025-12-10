'use client';

import Link from 'next/link';
import { Bot, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Orbitron, sans-serif' }}>Terms & Conditions</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using Mark's AI 3.0 Expert Advisor (EA), you accept and agree to be bound by the terms and provision of this agreement.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. License Grant</h2>
            <p>We grant you a non-exclusive, non-transferable license to use the EA software on MetaTrader 5 platform for your personal trading purposes.</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>One license per MT5 account</li>
              <li>License is bound to specific account number and hardware ID</li>
              <li>License cannot be transferred or shared</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. Risk Disclosure</h2>
            <p className="mb-2">Trading forex and CFDs involves substantial risk of loss and is not suitable for all investors.</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Past performance does not guarantee future results</li>
              <li>You may lose all your invested capital</li>
              <li>Only trade with money you can afford to lose</li>
              <li>Seek independent financial advice if necessary</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. No Guarantee of Profits</h2>
            <p>We make no representations or warranties that the EA will generate profits. All trading results are dependent on market conditions, your account settings, and risk management.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Refund Policy</h2>
            <p>Due to the digital nature of the product:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>All sales are final</li>
              <li>No refunds will be provided after license activation</li>
              <li>License extensions are non-refundable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Keep your license key confidential</li>
              <li>Not share, sell, or distribute the EA software</li>
              <li>Not reverse engineer or modify the EA</li>
              <li>Use the EA in accordance with broker terms and conditions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Limitation of Liability</h2>
            <p>Mark's AI and its developers shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of the EA, including but not limited to trading losses.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">8. Termination</h2>
            <p>We reserve the right to terminate your license if you violate these terms. Upon termination, you must cease all use of the EA.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Updates and Modifications</h2>
            <p>We may update the EA software and these terms at any time. Continued use of the EA constitutes acceptance of updated terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. Contact</h2>
            <p>For questions about these terms, please contact us through our website.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-cyan-500/20">
          <p className="text-gray-500 text-sm">Last updated: December 2024</p>
        </div>
      </div>
    </main>
  );
}
