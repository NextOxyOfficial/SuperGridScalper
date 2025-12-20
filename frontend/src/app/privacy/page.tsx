'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Database, Lock, Share2, BarChart3, Cookie, UserCheck, Clock, Users, RefreshCw, Mail } from 'lucide-react';
import SiteLogo from '@/components/SiteLogo';
import Header from '@/components/Header';

export default function PrivacyPage() {
  const currentYear = new Date().getFullYear();
  
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />

      <Header />

      {/* Navigation */}
      <nav className="hidden relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Back to Home</span>
          </Link>
          <SiteLogo size="sm" className="hidden sm:flex" />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-2 mb-4">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 text-xs sm:text-sm font-medium">Your Privacy Matters</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Policy</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            We are committed to protecting your privacy and ensuring the security of your personal information
          </p>
        </div>
        
        <div className="space-y-6 sm:space-y-8">
          {/* Section 1 */}
          <section className="bg-[#12121a]/80 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-purple-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 border border-purple-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">1. Information We Collect</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  To provide our services effectively, we collect the following types of information:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#0a0a0f] border border-purple-500/10 rounded-lg p-3">
                    <h3 className="text-purple-400 font-semibold text-sm mb-1">Account Information</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Email address, username, and encrypted password</p>
                  </div>
                  <div className="bg-[#0a0a0f] border border-purple-500/10 rounded-lg p-3">
                    <h3 className="text-cyan-400 font-semibold text-sm mb-1">License Information</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">License keys, MT5 account numbers, hardware IDs</p>
                  </div>
                  <div className="bg-[#0a0a0f] border border-purple-500/10 rounded-lg p-3">
                    <h3 className="text-yellow-400 font-semibold text-sm mb-1">Trading Data</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Account balance, positions, profit/loss statistics</p>
                  </div>
                  <div className="bg-[#0a0a0f] border border-purple-500/10 rounded-lg p-3">
                    <h3 className="text-green-400 font-semibold text-sm mb-1">Usage Data</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">EA connection logs, verification attempts, activity logs</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">2. How We Use Your Information</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  Your information is used exclusively for the following purposes:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Service Delivery:</strong> Provide, maintain, and improve the EA service</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">License Verification:</strong> Authenticate licenses and prevent unauthorized use</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Dashboard Display:</strong> Show your real-time trading statistics</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Communications:</strong> Send important service updates and notifications</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span><strong className="text-white">Product Improvement:</strong> Analyze usage patterns to enhance our services</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-[#12121a]/80 border border-green-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-green-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/10 border border-green-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">3. Data Security</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  We implement industry-standard security measures to protect your data:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <span className="text-green-400">🔐</span>
                    <span className="text-gray-300 text-sm">Bcrypt password encryption</span>
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <span className="text-green-400">🔒</span>
                    <span className="text-gray-300 text-sm">HTTPS/SSL encryption</span>
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <span className="text-green-400">🛡️</span>
                    <span className="text-gray-300 text-sm">Secure database with access controls</span>
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <span className="text-green-400">🔍</span>
                    <span className="text-gray-300 text-sm">Regular security audits</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-[#12121a]/80 border border-red-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Share2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">4. Data Sharing</h2>
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 sm:p-4 mb-3">
                  <p className="text-green-300 text-sm sm:text-base font-medium">
                    ✅ We do NOT sell, trade, or rent your personal information to third parties.
                  </p>
                </div>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-2">
                  We may only share your information in the following limited circumstances:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>When required by law, court order, or legal process</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>To protect our rights, property, and prevent fraud</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-red-400 mt-1">•</span>
                    <span>With your explicit written consent</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-[#12121a]/80 border border-yellow-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-yellow-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">5. Trading Data</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  Trading data collected from your MT5 account is handled with strict confidentiality:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Used exclusively to display your trading statistics on your dashboard</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Stored securely in encrypted databases with restricted access</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Never shared with any third parties under any circumstances</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>Can be deleted upon your request when you terminate your account</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/10 border border-orange-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">6. Cookies and Local Storage</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  We use cookies and browser local storage for the following purposes:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-orange-400 mt-1">•</span>
                    <span><strong className="text-white">Authentication:</strong> Keep you securely logged in to your account</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-orange-400 mt-1">•</span>
                    <span><strong className="text-white">Preferences:</strong> Remember your dashboard settings and preferences</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-orange-400 mt-1">•</span>
                    <span><strong className="text-white">Experience:</strong> Improve overall user experience and functionality</span>
                  </li>
                </ul>
                <p className="text-gray-400 text-xs sm:text-sm mt-3 italic">
                  You can disable cookies in your browser settings, but this may affect the functionality of our service.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 border border-blue-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">7. Your Rights</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  You have the following rights regarding your personal data:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                    <h3 className="text-blue-400 font-semibold text-sm mb-1">📋 Access</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Request a copy of your personal data</p>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                    <h3 className="text-blue-400 font-semibold text-sm mb-1">✏️ Correction</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Request correction of inaccurate data</p>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                    <h3 className="text-blue-400 font-semibold text-sm mb-1">🗑️ Deletion</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Request deletion of your account and data</p>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                    <h3 className="text-blue-400 font-semibold text-sm mb-1">📤 Export</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Export your data in a portable format</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 border border-purple-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">8. Data Retention</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  We retain your personal data according to the following guidelines:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Account data is retained for as long as your account remains active</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Trading data is retained for dashboard functionality and historical reference</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Some data may be retained for legal and regulatory compliance</span>
                  </li>
                  <li className="flex items-start gap-2 text-gray-300 text-sm sm:text-base">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Data will be deleted upon your request, subject to legal requirements</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">9. Children's Privacy</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately, and we will take steps to delete such information.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">10. Changes to This Policy</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of any material changes by posting the updated policy on this page with a new "Last Updated" date. Your continued use of our services after any changes constitutes your acceptance of the updated policy.
                </p>
              </div>
            </div>
          </section>

          {/* Section 11 */}
          <section className="bg-[#12121a]/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/10 border border-green-500/30 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">11. Contact Us</h2>
                <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-3">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:
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

        <div className="mt-8 sm:mt-12 pt-6 border-t border-cyan-500/20">
          <p className="text-gray-500 text-xs sm:text-sm text-center">
            Last updated: December {currentYear}
          </p>
        </div>
      </div>
    </main>
  );
}
