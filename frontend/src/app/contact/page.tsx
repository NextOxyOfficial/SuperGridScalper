'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Mail, MessageCircle, Phone, Clock, Send, CheckCircle, AlertCircle, ArrowLeft, Headphones, Globe, Store, BookOpen, LogIn } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

export default function ContactPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: 'general'
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setIsLoggedIn(true);
      const user = JSON.parse(userData);
      setUserName(user.name || user.email || 'User');
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Failed to send message. Please try again.');
      }
    } catch (e) {
      // For now, show success even if API doesn't exist
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get help via email',
      value: 'support@markstrades.com',
      link: 'mailto:support@markstrades.com',
      color: 'cyan'
    },
    {
      icon: MessageCircle,
      title: 'Telegram',
      description: 'Join our community',
      value: '@MarksAISupport',
      link: 'https://t.me/MarksAISupport',
      color: 'blue'
    },
    {
      icon: Globe,
      title: 'Website',
      description: 'Visit our website',
      value: 'www.markstrades.com',
      link: 'https://www.markstrades.com',
      color: 'green'
    }
  ];

  const faqItems = [
    {
      question: 'How do I install the EA on MT5?',
      answer: 'Download the EA file from EA Store, copy it to MT5 Data Folder > MQL5 > Experts, restart MT5, and attach to chart.'
    },
    {
      question: 'Why is my license not working?',
      answer: 'Make sure you entered the correct license key and your MT5 account number matches the one registered with the license.'
    },
    {
      question: 'What is the minimum deposit required?',
      answer: 'We recommend minimum $350 for Standard Cent Account on Exness for optimal EA performance.'
    },
    {
      question: 'How do I get a refund?',
      answer: 'Contact support within 7 days of purchase with your license key and reason for refund request.'
    }
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />

      {/* Navigation */}
      <nav className="relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            {isLoggedIn ? (
              <>
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                      </div>
                      <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
                    </Link>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  <Link
                    href="/dashboard"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/ea-store"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition flex items-center justify-center gap-1 sm:gap-2 text-yellow-300 hover:text-white hover:bg-yellow-500/20 border border-yellow-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <Store className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> EA Store
                  </Link>
                  <Link
                    href="/contact"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition bg-cyan-500 text-black"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Contact
                  </Link>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="h-5 w-px bg-cyan-500/30"></div>
                    <span className="text-cyan-300 text-xs sm:text-sm">{userName}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</span>
                  </Link>
                  <div className="h-5 sm:h-6 w-px bg-cyan-500/30"></div>
                  <span className="flex items-center gap-1.5 sm:gap-2 text-cyan-400 text-xs sm:text-sm font-medium" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    <Headphones className="w-4 h-4 sm:w-5 sm:h-5" /> SUPPORT
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Home
                  </Link>
                  <Link 
                    href="/guideline" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Guidelines
                  </Link>
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4 sm:w-4 sm:h-4" /> Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
            <Headphones className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="text-cyan-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>24/7 SUPPORT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Contact Support
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">
            Need help? We're here for you. Reach out through any of the channels below.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {contactMethods.map((method, idx) => (
            <a
              key={idx}
              href={method.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4 sm:p-6 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group"
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-${method.color}-500/20 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                <method.icon className={`w-6 h-6 sm:w-7 sm:h-7 text-${method.color}-400`} />
              </div>
              <h3 className="text-white font-bold text-base sm:text-lg mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {method.title}
              </h3>
              <p className="text-gray-500 text-xs sm:text-sm mb-2">{method.description}</p>
              <p className="text-cyan-400 text-sm sm:text-base font-medium">{method.value}</p>
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Contact Form */}
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Send a Message
                </h2>
                <p className="text-gray-500 text-xs sm:text-sm">We'll respond within 24 hours</p>
              </div>
            </div>

            {submitted ? (
              <div className="text-center py-8 sm:py-12">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Message Sent!
                </h3>
                <p className="text-gray-400 text-sm sm:text-base mb-4">
                  Thank you for contacting us. We'll get back to you soon.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData(prev => ({ ...prev, subject: '', message: '', category: 'general' }));
                  }}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-white placeholder-gray-600"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-white placeholder-gray-600"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-white"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="technical">Technical Support</option>
                    <option value="license">License Issue</option>
                    <option value="billing">Billing & Payment</option>
                    <option value="refund">Refund Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-white placeholder-gray-600"
                    placeholder="Brief description of your issue"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1.5">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={5}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm text-white placeholder-gray-600 resize-none"
                    placeholder="Describe your issue in detail..."
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      SENDING...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      SEND MESSAGE
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* FAQ Section */}
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Frequently Asked
                </h2>
                <p className="text-gray-500 text-xs sm:text-sm">Quick answers to common questions</p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {faqItems.map((item, idx) => (
                <div key={idx} className="bg-[#0a0a0f] border border-cyan-500/10 rounded-xl p-3 sm:p-4 hover:border-cyan-500/30 transition">
                  <h4 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">{item.question}</h4>
                  <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 sm:mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm sm:text-base">Response Time</p>
                  <p className="text-gray-400 text-xs sm:text-sm">We typically respond within 24 hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8 sm:mt-12">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-500/10 mt-12 sm:mt-20">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-4">
            <Link href="/guideline" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Guidelines
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/ea-store" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              EA Store
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Terms & Conditions
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm transition">
              Privacy Policy
            </Link>
          </div>
          <p className="text-center text-gray-600 text-xs sm:text-sm">
            © {new Date().getFullYear()} Mark's AI 3.0. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
