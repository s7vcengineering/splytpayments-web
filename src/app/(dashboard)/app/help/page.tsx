"use client";

import { useState } from "react";
import Link from "next/link";

const FAQ = [
  { q: "What is SPLYT?", a: "SPLYT is a platform that lets you split the cost of luxury experiences — yacht charters, exotic cars, luxury stays, and more — with a group. Think of it like Airbnb, but everyone chips in." },
  { q: "How does splitting work?", a: "A host creates an experience with a total cost and max number of participants. The cost is divided evenly among participants. You pledge your share from your SPLYT wallet, and once the group is full, the experience is confirmed." },
  { q: "How do I add money to my wallet?", a: "Go to Wallet > Add Funds. You can add money via Stripe using any credit or debit card. Funds are available immediately." },
  { q: "Can I withdraw money?", a: "Yes! Go to Wallet > Withdraw. Withdrawals are processed within 3-5 business days. You need a minimum balance to withdraw." },
  { q: "What happens if an experience is cancelled?", a: "If the host cancels, all pledges are fully refunded to participants' wallets. If you leave a split, the refund depends on the cancellation policy (flexible, moderate, or strict)." },
  { q: "How do I become a host?", a: "Sign up as a Captain/Host during registration, or contact support to upgrade your account. Hosts can create experiences, manage bookings, and earn through the platform." },
  { q: "Is my payment secure?", a: "Yes. All payments are processed through Stripe, a PCI-compliant payment processor. We never store your card details directly." },
  { q: "How do I contact support?", a: "Use the contact form below, or email us at support@splytpayments.com. We typically respond within 24 hours." },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production, this would call an API to create a support ticket
    setSubmitted(true);
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Help & Support</h1>
      <p className="text-gray-500 mb-8">Find answers or reach out to our team.</p>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {FAQ.map((item, i) => (
            <button
              key={i}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-gray-900">{item.q}</p>
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {openFaq === i && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.a}</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Support</h2>
        {submitted ? (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-green-800 mb-1">Message sent!</h3>
            <p className="text-sm text-green-600">We&apos;ll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text" required
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="What do you need help with?"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required rows={5}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Describe your issue or question in detail..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 resize-none"
              />
            </div>
            <button type="submit" className="px-5 py-3 bg-ocean-500 text-white text-sm font-semibold rounded-xl hover:bg-ocean-600 transition-colors">
              Send Message
            </button>
          </form>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="mailto:support@splytpayments.com" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div><p className="text-sm font-medium text-gray-900">Email Us</p><p className="text-xs text-gray-500">support@splytpayments.com</p></div>
          </a>
          <Link href="/app/messages" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <div><p className="text-sm font-medium text-gray-900">In-App Chat</p><p className="text-xs text-gray-500">Message us directly</p></div>
          </Link>
          <a href="/privacy" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div><p className="text-sm font-medium text-gray-900">Privacy Policy</p><p className="text-xs text-gray-500">How we handle your data</p></div>
          </a>
          <a href="/terms" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div><p className="text-sm font-medium text-gray-900">Terms of Service</p><p className="text-xs text-gray-500">Our terms and conditions</p></div>
          </a>
        </div>
      </section>
    </div>
  );
}
