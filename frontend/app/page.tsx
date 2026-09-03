"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client for reading state
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  // System State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // AI Reminder State
  const [aiTone, setAiTone] = useState("polite");
  const [aiLanguage, setAiLanguage] = useState("Hinglish");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedWhatsapp, setGeneratedWhatsapp] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // AI Negotiation State
  const [activeTab, setActiveTab] = useState<"reminder" | "negotiate">("reminder");
  const [customerReply, setCustomerReply] = useState("");
  const [negotiationResult, setNegotiationResult] = useState<any>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);

  // Fetch invoices from Supabase on mount
  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/invoices`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
        return;
      }
    } catch (err) {
      console.warn("Backend fetch failed, trying direct Supabase:", err);
    }
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setInvoices(data);
  };

  // Submit Handler: Triggers FastAPI to create Razorpay Links
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          amount_rupees: parseFloat(amount),
        }),
      });
      const data = await response.json();
      if (data.status === "success") {
        alert("Invoice & Payment Link Created Successfully!");
        setName(""); setEmail(""); setPhone(""); setAmount("");
        fetchInvoices();
      }
    } catch (err) {
      console.error("Error creating invoice:", err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Groq AI Agent via FastAPI — Reminder
  const handleGenerateAIResponse = async () => {
    if (!selectedInvoice) return;
    setAiLoading(true);
    setGeneratedEmail("");
    setGeneratedWhatsapp("");
    setEmailStatus(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-generate-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: selectedInvoice.customer_name,
          amount_rupees: selectedInvoice.amount_paise / 100,
          payment_url: selectedInvoice.payment_link_url,
          tone: aiTone,
          language: aiLanguage,
        }),
      });
      const data = await response.json();
      setGeneratedEmail(data.email_body || "");
      setGeneratedWhatsapp(data.whatsapp_body || "");
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Dispatch Email to Customer
  const handleSendEmail = async () => {
    if (!selectedInvoice || !generatedEmail) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: selectedInvoice.customer_email,
          subject: `Payment Reminder: Invoice for ${selectedInvoice.customer_name}`,
          body: generatedEmail,
        }),
      });
      const data = await response.json();
      setEmailStatus(data.message);
    } catch (err) {
      console.error(err);
      setEmailStatus("Failed to dispatch email.");
    } finally {
      setSendingEmail(false);
    }
  };

  // One-Click WhatsApp Redirect — pre-fills customer phone + email body into wa.me deep-link
  const triggerWhatsAppSend = () => {
    if (!selectedInvoice || !generatedEmail) return;

    // Normalise phone: strip spaces/dashes, add 91 country code if not already present
    const rawPhone = (selectedInvoice.customer_phone || "").replace(/[\s\-().+]/g, "");
    const formattedPhone = rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;

    const encodedText = encodeURIComponent(generatedEmail);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;

    window.open(whatsappUrl, "_blank");
  };

  // Trigger Groq AI Agent via FastAPI — Negotiation
  const handleNegotiation = async () => {
    if (!selectedInvoice || !customerReply.trim()) return;
    setNegotiationLoading(true);
    setNegotiationResult(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-negotiate-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selectedInvoice.id,
          customer_reply: customerReply,
        }),
      });
      const data = await response.json();
      setNegotiationResult(data);
      fetchInvoices(); // Instantly refresh ledger matrix to show 'PARTIAL_ALLOWED' status
    } catch (err) {
      console.error(err);
    } finally {
      setNegotiationLoading(false);
    }
  };

  const openAgentHub = (inv: any) => {
    setSelectedInvoice(inv);
    setGeneratedEmail("");
    setGeneratedWhatsapp("");
    setEmailStatus(null);
    setNegotiationResult(null);
    setCustomerReply("");
    setActiveTab("reminder");
  };

  // ⏳ DEV TOOL: Simulates invoice aging by 10 days for demo purposes.
  // Shows judges how the AI escalation tone shifts from Polite → Urgent automatically.
  const handleSimulateAging = async (invoiceId: string, customerName: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dev-simulate-aging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await response.json();
      if (data.status === "success") {
        alert(`⏳ Time Warp Complete!\n\n"${customerName}"'s invoice has been backdated by 10 days.\nRe-run the AI Reminder Agent to see the escalation tone shift to URGENT.`);
        fetchInvoices();
      } else {
        alert("Aging simulation failed. Check backend logs.");
      }
    } catch (err) {
      console.error("Aging simulation error:", err);
      alert("Could not reach backend. Is it running on port 8000?");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-indigo-400">🤖 Autonomous AR Financial Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Razorpay Sandbox + Groq AI Infrastructure</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section 1: Create Invoice Form */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md h-fit">
          <h2 className="text-xl font-semibold mb-4 text-indigo-300">📌 Create New Invoice</h2>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Customer Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-gray-700 rounded p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Customer Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 rounded p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Customer Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full bg-gray-700 rounded p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Amount (INR)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full bg-gray-700 rounded p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="500.00" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded font-medium transition disabled:bg-gray-600">
              {loading ? "Generating Razorpay Assets..." : "Generate Payment Link"}
            </button>
          </form>
        </div>

        {/* Section 2: Invoices Management Ledger */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-indigo-300">📊 Account Ledger Matrix</h2>
            <button onClick={fetchInvoices} className="text-xs text-gray-400 hover:text-indigo-300 transition">↻ Refresh</button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm">
                <th className="pb-3">Client</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-500 text-sm">No invoices yet. Create one to get started.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr 
                  key={inv.id} 
                  className="border-b border-gray-700/50 hover:bg-gray-700/50 transition-all duration-300 transform hover:-translate-y-0.5 text-sm animate-fadeIn"
                >
                  <td className="py-4 font-medium pl-2">
                    {inv.customer_name}
                    <span className="block text-xs text-gray-400 font-mono mt-0.5">{inv.customer_email}</span>
                  </td>
                  <td className="py-4 font-semibold text-gray-200">₹{(inv.amount_paise / 100).toFixed(2)}</td>
                  <td className="py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${
                      inv.status === 'PAID' 
                        ? 'bg-emerald-950/70 border border-emerald-500/30 text-emerald-400' 
                        : inv.status === 'PARTIAL' || inv.status === 'PARTIAL_ALLOWED'
                        ? 'bg-amber-950/70 border border-amber-500/30 text-amber-400 animate-pulse' 
                        : 'bg-rose-950/70 border border-rose-500/30 text-rose-400 animate-pulse'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-4 text-right pr-2">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <a 
                        href={inv.payment_link_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline transition-colors"
                      >
                        Pay Link
                      </a>
                      <button 
                        onClick={() => openAgentHub(inv)} 
                        className="bg-gray-700 hover:bg-indigo-600 text-xs px-3 py-1.5 rounded-md font-medium shadow-sm transition-all duration-200 active:scale-95 text-white"
                      >
                        Agent Actions
                      </button>
                      <button
                        onClick={() => handleSimulateAging(inv.id, inv.customer_name)}
                        title="DEV TOOL: Backdate this invoice by 10 days to simulate aging"
                        className="bg-amber-600/20 hover:bg-amber-500 border border-amber-500/40 text-amber-400 hover:text-black text-xs px-2.5 py-1.5 rounded-md font-medium shadow-sm transition-all duration-200 active:scale-95"
                      >
                        ⏳ Age +10d
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: AI Agent Hub Drawer */}
      {selectedInvoice && (
        <div className="mt-8 bg-gray-800 p-6 rounded-xl border border-indigo-500/30 shadow-xl max-w-4xl animate-slideUp">
          {/* Hub Header */}
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
                🤖 AI Automation Hub
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedInvoice.customer_name} · ₹{(selectedInvoice.amount_paise / 100).toFixed(2)} ·{" "}
                <span className={`font-semibold ${
                  selectedInvoice.status === "PAID" ? "text-emerald-400" :
                  selectedInvoice.status?.includes("PARTIAL") ? "text-amber-400 animate-pulse" : "text-rose-400 animate-pulse"
                }`}>{selectedInvoice.status}</span>
              </p>
            </div>
            <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-white text-sm">✕ Close</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 p-1 rounded-lg w-fit mb-6">
            <button
              onClick={() => setActiveTab("reminder")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === "reminder" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              ✉️ AI Reminder
            </button>
            <button
              onClick={() => setActiveTab("negotiate")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === "negotiate" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              🤝 AI Negotiator
            </button>
          </div>

          {/* Tab: AI Reminder */}
          {activeTab === "reminder" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4 bg-gray-900 p-4 rounded-lg">
                <div className="flex-1">
                  <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Select Workflow Tone Priority</label>
                  <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="bg-gray-700 p-2 rounded w-full text-white outline-none">
                    <option value="polite">Polite Reminder (Standard onboarding)</option>
                    <option value="firm">Firm Warning (Overdue &amp; un-notified)</option>
                    <option value="urgent">Urgent Escalation (Final payout breach)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Target Communication Language</label>
                  <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="bg-gray-700 p-2 rounded w-full text-white outline-none">
                    <option value="Hinglish">Hinglish (Hindi + English Chat)</option>
                    <option value="English">English (Formal Business)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                  </select>
                </div>
                <button onClick={handleGenerateAIResponse} disabled={aiLoading} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded font-medium transition active:scale-95 disabled:bg-gray-600 whitespace-nowrap shadow">
                  {aiLoading ? "Agent Contextualizing..." : "⚡ Run Multilingual Dispatch Agent"}
                </button>
              </div>

              {/* Processing Mind Spinner */}
              {aiLoading && (
                <div className="mt-4 p-8 bg-gray-900 rounded-lg border border-indigo-500/30 flex flex-col items-center justify-center space-y-3 animate-pulse">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-medium text-indigo-400 tracking-wide font-mono">Agent analyzing transaction context & drafting copy...</p>
                </div>
              )}

              {(generatedEmail || generatedWhatsapp) && !aiLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slideUp">
                  {/* Email Payload Card */}
                  {generatedEmail && (
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 flex flex-col justify-between space-y-3 shadow-md">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-indigo-900/60 text-indigo-300 text-xs px-2.5 py-0.5 rounded font-bold">✉️ EMAIL DISPATCH</span>
                            <span className="text-xs text-gray-400">Formal Letter</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(generatedEmail);
                                alert("Email script copied to clipboard!");
                              }}
                              className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-[10px] px-2.5 py-1 rounded font-medium transition-all active:scale-95"
                            >
                              📋 Copy
                            </button>
                            <button
                              onClick={triggerWhatsAppSend}
                              title={`Open WhatsApp for ${selectedInvoice.customer_name} with email pre-filled`}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1 rounded font-medium shadow-sm transition-all active:scale-95 flex items-center gap-1"
                            >
                              💬 WhatsApp
                            </button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-200 text-xs leading-relaxed bg-gray-950 p-3 rounded select-all border border-gray-800 font-mono min-h-[160px] max-h-[220px] overflow-y-auto">
                          {generatedEmail}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <button
                          onClick={handleSendEmail}
                          disabled={sendingEmail}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded font-semibold transition active:scale-95 disabled:bg-gray-600 shadow"
                        >
                          {sendingEmail ? "📨 Dispatching Email..." : `📧 Send Email to ${selectedInvoice.customer_email}`}
                        </button>
                        {emailStatus && (
                          <p className="text-xs p-2 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-200">
                            ℹ️ {emailStatus}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Payload Card */}
                  {generatedWhatsapp && (
                    <div className="bg-gray-900 p-4 rounded-lg border border-emerald-500/30 flex flex-col justify-between space-y-3 bg-emerald-950/10 shadow-md">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-900/80 text-emerald-300 text-xs px-2.5 py-0.5 rounded font-bold">💬 WHATSAPP DISPATCH</span>
                            <span className="text-xs text-emerald-400 font-semibold">{aiLanguage}</span>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(generatedWhatsapp);
                              alert("WhatsApp snippet copied to clipboard!");
                            }}
                            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-[10px] px-2.5 py-1 rounded font-medium transition-all active:scale-95"
                          >
                            📋 Copy
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-gray-200 text-xs leading-relaxed bg-gray-950 p-3 rounded select-all border border-gray-800 font-mono min-h-[160px] max-h-[220px] overflow-y-auto">
                          {generatedWhatsapp}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-gray-800">
                        <a
                          href={`https://api.whatsapp.com/send?phone=${selectedInvoice.customer_phone || ''}&text=${encodeURIComponent(generatedWhatsapp)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black text-xs py-2.5 rounded font-bold transition active:scale-95 shadow flex items-center justify-center gap-1.5"
                        >
                          📱 Open &amp; Send via WhatsApp Web / App
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: AI Negotiator */}
          {activeTab === "negotiate" && (
            <div className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-1 uppercase font-bold">How it works</p>
                <p className="text-sm text-gray-300">
                  Paste the customer reply below. The AI evaluates their message and decides whether to{" "}
                  <span className="text-amber-400 font-semibold">split the payment</span> into two equal installments or{" "}
                  <span className="text-rose-400 font-semibold">stay firm</span> on the full amount — then automatically updates Razorpay &amp; Supabase.
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Customer Reply / Message</label>
                <textarea
                  value={customerReply}
                  onChange={(e) => setCustomerReply(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-700 rounded p-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                  placeholder={`e.g. "I can't pay ₹${(selectedInvoice.amount_paise / 100).toFixed(0)} all at once right now, is there any way to split it?"`}
                />
              </div>

              <button
                onClick={handleNegotiation}
                disabled={negotiationLoading || !customerReply.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded font-medium transition disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {negotiationLoading ? "🧠 AI Agent Evaluating..." : "⚡ Run AI Negotiation Engine"}
              </button>

              {negotiationResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    negotiationResult.new_link && negotiationResult.new_link !== selectedInvoice.payment_link_url
                      ? "border-amber-500/40 bg-amber-950/20"
                      : "border-rose-500/40 bg-rose-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        negotiationResult.new_link && negotiationResult.new_link !== selectedInvoice.payment_link_url
                          ? "bg-amber-900/60 text-amber-300"
                          : "bg-rose-900/60 text-rose-300"
                      }`}
                    >
                      {negotiationResult.new_link && negotiationResult.new_link !== selectedInvoice.payment_link_url
                        ? "✅ SPLIT PAYMENT APPROVED"
                        : "🔒 STAY FIRM — FULL AMOUNT REQUIRED"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed mb-3">
                    {negotiationResult.ai_message || negotiationResult.reply}
                  </p>
                  {negotiationResult.new_link && negotiationResult.new_link !== selectedInvoice.payment_link_url && (
                    <div className="mt-3 pt-3 border-t border-amber-500/20">
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">New Split-Payment Link (Auto-Generated)</p>
                      <a
                        href={negotiationResult.new_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-indigo-400 hover:text-indigo-300 underline break-all"
                      >
                        {negotiationResult.new_link}
                      </a>
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum first instalment = 50% · Supabase updated to PARTIAL_ALLOWED
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
