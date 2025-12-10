'use client';

import Link from 'next/link';
import { Bot, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Orbitron, sans-serif' }}>Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-2">We collect the following information:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Account Information:</strong> Email, username, password (encrypted)</li>
              <li><strong>License Information:</strong> License keys, MT5 account numbers, hardware IDs</li>
              <li><strong>Trading Data:</strong> Account balance, positions, profit/loss (for dashboard display)</li>
              <li><strong>Usage Data:</strong> EA connection logs, verification attempts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p className="mb-2">Your information is used to:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Provide and maintain the EA service</li>
              <li>Verify license authenticity and prevent unauthorized use</li>
              <li>Display your trading statistics in the dashboard</li>
              <li>Send important service updates and notifications</li>
              <li>Improve our products and services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">3. Data Security</h2>
            <p className="mb-2">We implement security measures to protect your data:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Passwords are encrypted using industry-standard hashing</li>
              <li>HTTPS encryption for all data transmission</li>
              <li>Secure database with access controls</li>
              <li>Regular security audits and updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">4. Data Sharing</h2>
            <p>We do NOT sell, trade, or share your personal information with third parties, except:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>When required by law or legal process</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">5. Trading Data</h2>
            <p>Trading data collected from your MT5 account is:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Used only to display your trading statistics</li>
              <li>Stored securely in our database</li>
              <li>Not shared with any third parties</li>
              <li>Deleted upon account termination (if requested)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">6. Cookies and Tracking</h2>
            <p>We use cookies and local storage to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Improve user experience</li>
            </ul>
            <p className="mt-2">You can disable cookies in your browser, but this may affect functionality.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">7. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Opt-out of marketing communications</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">8. Data Retention</h2>
            <p>We retain your data:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>For as long as your account is active</li>
              <li>For legal and regulatory compliance purposes</li>
              <li>Until you request deletion (subject to legal requirements)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">9. Children's Privacy</h2>
            <p>Our service is not intended for users under 18 years of age. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">10. Changes to Privacy Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">11. Contact Us</h2>
            <p>If you have questions about this privacy policy or your data, please contact us through our website.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-cyan-500/20">
          <p className="text-gray-500 text-sm">Last updated: December 2024</p>
        </div>
      </div>
    </main>
  );
}
