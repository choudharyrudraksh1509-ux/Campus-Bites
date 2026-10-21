import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  X,
  CreditCard,
  QrCode,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Smartphone,
  ChevronDown,
  RotateCw,
  Sparkles
} from 'lucide-react';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  amount: number;
  shopName: string;
  itemCount: number;
  estimatedMinutes?: number;
  queueNumber?: number;
  isPreorder?: boolean;
  pickupTime?: string | null;
  onClose: () => void;
  onPaymentSuccess: (details: {
    paymentMethod: string;
    transactionId: string;
    amount: number;
  }) => void;
}

type TabType = 'UPI' | 'NETBANKING' | 'CARDS' | 'QR';

const POPULAR_BANKS = [
  { id: 'HDFC', name: 'HDFC Bank', code: 'HDFC', color: '#004c8f', badge: 'HDFC' },
  { id: 'SBI', name: 'State Bank of India', code: 'SBI', color: '#002e6e', badge: 'SBI' },
  { id: 'ICICI', name: 'ICICI Bank', code: 'ICICI', color: '#b32223', badge: 'iCICI' },
  { id: 'AXIS', name: 'Axis Bank', code: 'UTIB', color: '#97144d', badge: 'AXIS' },
  { id: 'KOTAK', name: 'Kotak Bank', code: 'KKBK', color: '#ed1c24', badge: 'Kotak' },
  { id: 'PNB', name: 'Punjab National Bank', code: 'PUNB', color: '#a20037', badge: 'PNB' },
];

const OTHER_BANKS = [
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'IndusInd Bank',
  'Federal Bank',
  'IDFC FIRST Bank',
  'Yes Bank',
  'Central Bank of India',
  'Indian Bank',
  'Bank of India',
  'RBL Bank'
];

export default function PaymentGatewayModal({
  isOpen,
  amount,
  shopName,
  itemCount,
  estimatedMinutes = 15,
  queueNumber = 1,
  isPreorder = false,
  pickupTime,
  onClose,
  onPaymentSuccess
}: PaymentGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('UPI');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'PHONEPE' | 'GPAY' | 'PAYTM' | 'CUSTOM'>('PHONEPE');
  const [customUpiId, setCustomUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [otherBankName, setOtherBankName] = useState('');
  
  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // Payment flow stage: 'IDLE' | 'PROCESSING' | 'SUCCESS'
  const [paymentStage, setPaymentStage] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS'>('IDLE');
  const [processingStatus, setProcessingStatus] = useState('Initiating secure gateway...');
  const [transactionId, setTransactionId] = useState('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);

  useEffect(() => {
    if (isOpen) {
      setPaymentStage('IDLE');
      setProcessingStatus('Initiating secure gateway...');
      setTransactionId(`CB-TXN-${Date.now().toString().slice(-8)}`);
      setQrSecondsLeft(300);
    }
  }, [isOpen]);

  // Countdown timer for QR
  useEffect(() => {
    if (!isOpen || activeTab !== 'QR' || paymentStage !== 'IDLE') return;
    const interval = setInterval(() => {
      setQrSecondsLeft(prev => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, paymentStage]);

  if (!isOpen) return null;

  const formatCardNumber = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleFillTestCard = () => {
    setCardNumber('4532 8921 7734 9012');
    setCardExpiry('12/28');
    setCardCvv('892');
    setCardHolder('Campus Student');
  };

  const handleStartPayment = (chosenMethod: string) => {
    setPaymentStage('PROCESSING');
    setProcessingStatus(`Connecting to ${chosenMethod} secure servers...`);

    setTimeout(() => {
      setProcessingStatus('Verifying payment credentials with bank gateway...');
    }, 900);

    setTimeout(() => {
      setProcessingStatus('Capturing transaction authorization token...');
    }, 1800);

    setTimeout(() => {
      setPaymentStage('SUCCESS');
      const txn = transactionId || `CB-TXN-${Date.now().toString().slice(-8)}`;
      setTimeout(() => {
        onPaymentSuccess({
          paymentMethod: chosenMethod,
          transactionId: txn,
          amount
        });
      }, 1400);
    }, 2800);
  };

  const getMethodName = () => {
    if (activeTab === 'UPI') {
      if (selectedUpiApp === 'PHONEPE') return 'PhonePe UPI';
      if (selectedUpiApp === 'GPAY') return 'Google Pay UPI';
      if (selectedUpiApp === 'PAYTM') return 'Paytm UPI';
      return `UPI (${customUpiId || 'student@upi'})`;
    }
    if (activeTab === 'NETBANKING') {
      return otherBankName ? `${otherBankName} Net Banking` : `${selectedBank} Net Banking`;
    }
    if (activeTab === 'CARDS') {
      return 'Credit/Debit Card';
    }
    return 'Scan & Pay QR';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1C1619] border border-[#930E36]/80 text-white rounded-3xl w-full max-w-xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh] relative">
        
        {/* Top Razorpay-like Header */}
        <div className="bg-[#4C1829] px-5 py-4 border-b border-[#930E36]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#930E36] to-pink-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="text-white" size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base tracking-tight">Campus Bites Pay</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  DEMO GATEWAY
                </span>
              </div>
              <p className="text-xs text-white/70">
                Payment to <strong className="text-white">{shopName}</strong> • {itemCount} Items
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <span className="text-[10px] text-white/60 uppercase tracking-wider block">Payable</span>
              <span className="text-xl font-extrabold text-white">₹{amount}</span>
            </div>
            {paymentStage === 'IDLE' && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close gateway"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Live Queue & Delivery Time Strip */}
        <div className="bg-[#2D121B] px-5 py-2.5 border-b border-[#930E36]/40 flex items-center justify-between text-xs text-white/90 shrink-0">
          <div className="flex items-center space-x-2">
            <Clock size={14} className="text-amber-400" />
            <span>
              {isPreorder ? (
                <>Scheduled Pre-order: <strong className="text-amber-300">{pickupTime || 'Later today'}</strong></>
              ) : (
                <>Approx. Delivery / Pickup: <strong className="text-emerald-300">~{estimatedMinutes} mins</strong></>
              )}
            </span>
          </div>
          <span className="bg-[#930E36]/40 px-2 py-0.5 rounded-lg border border-[#930E36]/60 text-[11px] font-mono">
            Queue #{queueNumber}
          </span>
        </div>

        {/* Modal Content Switcher based on stage */}
        {paymentStage === 'PROCESSING' ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-6 flex-1 min-h-[360px]">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-[#930E36]/40 border-t-white animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock size={26} className="text-white" />
              </div>
            </div>
            <div className="space-y-2 max-w-sm">
              <h4 className="text-lg font-bold text-white">Authorizing Live Demo Payment</h4>
              <p className="text-xs text-white/70 animate-pulse">{processingStatus}</p>
            </div>
            <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 to-emerald-400 h-full animate-[pulse_1s_infinite] w-full"></div>
            </div>
            <p className="text-[11px] text-white/50">
              Demo Transaction ID: <span className="font-mono text-white/80">{transactionId}</span>
            </p>
          </div>
        ) : paymentStage === 'SUCCESS' ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-5 flex-1 min-h-[360px] animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={44} className="animate-bounce" />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Authorized Successfully</span>
              <h4 className="text-2xl font-bold text-white">Payment of ₹{amount} Received!</h4>
              <p className="text-xs text-white/70">
                Payment verified through <strong className="text-white">{getMethodName()}</strong>
              </p>
            </div>
            <div className="bg-[#4C1829]/60 border border-[#930E36] rounded-2xl p-3.5 w-full max-w-xs text-xs space-y-1 font-mono text-white/80">
              <div className="flex justify-between">
                <span>TXN ID:</span>
                <span className="text-white font-bold">{transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span>Stall:</span>
                <span>{shopName}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold">SUCCESS (CONFIRMED)</span>
              </div>
            </div>
            <p className="text-xs text-white/60">Finalizing your takeaway order ticket...</p>
          </div>
        ) : (
          /* Normal Interactive Selection View */
          <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
            
            {/* Sidebar Modes */}
            <div className="sm:w-44 bg-[#140F11] border-r border-[#930E36]/40 flex sm:flex-col overflow-x-auto sm:overflow-x-visible shrink-0 text-xs">
              <button
                onClick={() => setActiveTab('UPI')}
                className={`flex-1 sm:flex-none p-3.5 flex items-center space-x-2.5 transition-all text-left whitespace-nowrap ${
                  activeTab === 'UPI'
                    ? 'bg-[#4C1829] text-white font-bold border-b-2 sm:border-b-0 sm:border-r-4 border-pink-500'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Smartphone size={16} className={activeTab === 'UPI' ? 'text-pink-400' : ''} />
                <span>UPI Apps</span>
              </button>

              <button
                onClick={() => setActiveTab('NETBANKING')}
                className={`flex-1 sm:flex-none p-3.5 flex items-center space-x-2.5 transition-all text-left whitespace-nowrap ${
                  activeTab === 'NETBANKING'
                    ? 'bg-[#4C1829] text-white font-bold border-b-2 sm:border-b-0 sm:border-r-4 border-pink-500'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Building2 size={16} className={activeTab === 'NETBANKING' ? 'text-pink-400' : ''} />
                <span>Net Banking</span>
              </button>

              <button
                onClick={() => setActiveTab('QR')}
                className={`flex-1 sm:flex-none p-3.5 flex items-center space-x-2.5 transition-all text-left whitespace-nowrap ${
                  activeTab === 'QR'
                    ? 'bg-[#4C1829] text-white font-bold border-b-2 sm:border-b-0 sm:border-r-4 border-pink-500'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <QrCode size={16} className={activeTab === 'QR' ? 'text-pink-400' : ''} />
                <span>Scan QR</span>
              </button>

              <button
                onClick={() => setActiveTab('CARDS')}
                className={`flex-1 sm:flex-none p-3.5 flex items-center space-x-2.5 transition-all text-left whitespace-nowrap ${
                  activeTab === 'CARDS'
                    ? 'bg-[#4C1829] text-white font-bold border-b-2 sm:border-b-0 sm:border-r-4 border-pink-500'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <CreditCard size={16} className={activeTab === 'CARDS' ? 'text-pink-400' : ''} />
                <span>Cards</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between space-y-4">
              
              {/* TAB 1: UPI APPS */}
              {activeTab === 'UPI' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/80 font-medium">Select Preferred UPI App:</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* PhonePe */}
                    <div
                      onClick={() => setSelectedUpiApp('PHONEPE')}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedUpiApp === 'PHONEPE'
                          ? 'border-purple-400 bg-purple-950/40 text-white shadow-md'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-[#5f259f] flex items-center justify-center font-bold text-white text-xs shadow">
                          पे
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">PhonePe</div>
                          <div className="text-[10px] text-white/60">Instant UPI redirect</div>
                        </div>
                      </div>
                      {selectedUpiApp === 'PHONEPE' && <CheckCircle2 size={16} className="text-purple-400" />}
                    </div>

                    {/* Google Pay */}
                    <div
                      onClick={() => setSelectedUpiApp('GPAY')}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedUpiApp === 'GPAY'
                          ? 'border-blue-400 bg-blue-950/40 text-white shadow-md'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-bold text-blue-600 text-xs shadow">
                          <span className="font-sans font-black text-sm">G</span>
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">Google Pay</div>
                          <div className="text-[10px] text-white/60">Fast 1-click checkout</div>
                        </div>
                      </div>
                      {selectedUpiApp === 'GPAY' && <CheckCircle2 size={16} className="text-blue-400" />}
                    </div>

                    {/* Paytm */}
                    <div
                      onClick={() => setSelectedUpiApp('PAYTM')}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedUpiApp === 'PAYTM'
                          ? 'border-sky-400 bg-sky-950/40 text-white shadow-md'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-[#002e6e] border border-sky-400 flex items-center justify-center font-bold text-sky-400 text-[10px] shadow">
                          paytm
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">Paytm UPI</div>
                          <div className="text-[10px] text-white/60">Wallet & UPI</div>
                        </div>
                      </div>
                      {selectedUpiApp === 'PAYTM' && <CheckCircle2 size={16} className="text-sky-400" />}
                    </div>

                    {/* Custom UPI ID */}
                    <div
                      onClick={() => setSelectedUpiApp('CUSTOM')}
                      className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedUpiApp === 'CUSTOM'
                          ? 'border-emerald-400 bg-emerald-950/40 text-white shadow-md'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-800 flex items-center justify-center font-bold text-white text-xs shadow">
                          @
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">Any UPI ID</div>
                          <div className="text-[10px] text-white/60">BHIM, Cred, Bank UPI</div>
                        </div>
                      </div>
                      {selectedUpiApp === 'CUSTOM' && <CheckCircle2 size={16} className="text-emerald-400" />}
                    </div>
                  </div>

                  {/* Input for custom UPI ID */}
                  {selectedUpiApp === 'CUSTOM' && (
                    <div className="space-y-1.5 animate-fade-in pt-1">
                      <label className="text-[11px] text-white/70">Enter Virtual Payment Address (VPA)</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. rollnumber@oksbi or 9876543210@paytm"
                          value={customUpiId}
                          onChange={(e) => setCustomUpiId(e.target.value)}
                          className="w-full bg-black/40 border border-[#930E36]/60 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-white/70 flex items-center space-x-2">
                    <Sparkles size={14} className="text-amber-400 shrink-0" />
                    <span>Instant demo verification: Click Pay button below to trigger simulated approval.</span>
                  </div>
                </div>
              )}

              {/* TAB 2: NET BANKING */}
              {activeTab === 'NETBANKING' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/80 font-medium">Select Your Bank:</div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {POPULAR_BANKS.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBank(b.name);
                          setOtherBankName('');
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer flex flex-col items-center justify-center text-center space-y-1.5 transition-all ${
                          selectedBank === b.name && !otherBankName
                            ? 'border-white bg-[#4C1829] shadow-lg text-white font-semibold'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/80'
                        }`}
                      >
                        <div
                          style={{ backgroundColor: b.color }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                        >
                          {b.badge}
                        </div>
                        <span className="text-[11px] leading-tight truncate w-full">{b.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Other Banks Dropdown */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] text-white/70">Or choose from other Indian banks:</label>
                    <select
                      value={otherBankName}
                      onChange={(e) => {
                        setOtherBankName(e.target.value);
                        if (e.target.value) setSelectedBank(e.target.value);
                      }}
                      className="w-full bg-[#1C1619] border border-[#930E36]/60 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-white cursor-pointer"
                    >
                      <option value="">Select Other Bank...</option>
                      {OTHER_BANKS.map(bank => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 3: SCAN QR CODE */}
              {activeTab === 'QR' && (
                <div className="flex flex-col items-center justify-center text-center space-y-3 py-1">
                  <div className="p-3 bg-white rounded-3xl shadow-2xl relative border-2 border-pink-500">
                    {/* Simulated SVG QR */}
                    <svg viewBox="0 0 100 100" className="w-36 h-36">
                      <rect width="100" height="100" fill="#ffffff" />
                      {/* Corner markers */}
                      <rect x="5" y="5" width="28" height="28" fill="#000000" rx="3" />
                      <rect x="9" y="9" width="20" height="20" fill="#ffffff" rx="2" />
                      <rect x="13" y="13" width="12" height="12" fill="#000000" rx="1" />

                      <rect x="67" y="5" width="28" height="28" fill="#000000" rx="3" />
                      <rect x="71" y="9" width="20" height="20" fill="#ffffff" rx="2" />
                      <rect x="75" y="13" width="12" height="12" fill="#000000" rx="1" />

                      <rect x="5" y="67" width="28" height="28" fill="#000000" rx="3" />
                      <rect x="9" y="71" width="20" height="20" fill="#ffffff" rx="2" />
                      <rect x="13" y="75" width="12" height="12" fill="#000000" rx="1" />

                      {/* Random Matrix demo squares */}
                      <rect x="38" y="10" width="8" height="8" fill="#000000" />
                      <rect x="50" y="15" width="10" height="6" fill="#000000" />
                      <rect x="38" y="25" width="6" height="10" fill="#000000" />
                      <rect x="48" y="32" width="12" height="8" fill="#000000" />
                      <rect x="10" y="42" width="15" height="6" fill="#000000" />
                      <rect x="30" y="45" width="8" height="12" fill="#000000" />
                      <rect x="42" y="46" width="16" height="16" fill="#930E36" />
                      <rect x="65" y="42" width="12" height="8" fill="#000000" />
                      <rect x="82" y="48" width="10" height="8" fill="#000000" />
                      <rect x="38" y="68" width="10" height="8" fill="#000000" />
                      <rect x="52" y="65" width="14" height="10" fill="#000000" />
                      <rect x="70" y="75" width="10" height="15" fill="#000000" />
                      <rect x="40" y="82" width="18" height="8" fill="#000000" />
                    </svg>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-[10px] shadow-lg border border-white">
                        ₹
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">Scan with PhonePe, Google Pay or Paytm</p>
                    <p className="text-[11px] text-white/60">
                      QR expires in: <span className="font-mono text-pink-400 font-bold">{Math.floor(qrSecondsLeft / 60)}:{(qrSecondsLeft % 60).toString().padStart(2, '0')}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: CARDS */}
              {activeTab === 'CARDS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80 font-medium">Debit or Credit Card</span>
                    <button
                      type="button"
                      onClick={handleFillTestCard}
                      className="text-[11px] bg-pink-900/40 hover:bg-pink-800/60 text-pink-200 border border-pink-500/40 px-2.5 py-1 rounded-xl transition-all"
                    >
                      ⚡ Autofill Demo Card
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">Card Number</label>
                      <input
                        type="text"
                        placeholder="4532 •••• •••• ••••"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full bg-black/40 border border-[#930E36]/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">Valid Thru (MM/YY)</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-black/40 border border-[#930E36]/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white font-mono text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-white/70 block mb-1">CVV / CVC</label>
                        <input
                          type="password"
                          placeholder="•••"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-black/40 border border-[#930E36]/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white font-mono text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-white/70 block mb-1">Name on Card</label>
                      <input
                        type="text"
                        placeholder="Campus Student"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="w-full bg-black/40 border border-[#930E36]/60 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Action Section */}
              <div className="pt-3 border-t border-[#930E36]/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-white/60 block uppercase">Mode Selected</span>
                  <span className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-xs block">
                    {getMethodName()}
                  </span>
                </div>

                <button
                  onClick={() => handleStartPayment(getMethodName())}
                  className="py-3 px-6 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:brightness-110 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-xl transition-all flex items-center space-x-2 tracking-wide uppercase"
                >
                  <Lock size={14} />
                  <span>Pay ₹{amount}</span>
                  <ArrowRight size={14} />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Footer Security Badges */}
        <div className="bg-[#120B0E] px-4 py-2 border-t border-[#930E36]/30 flex items-center justify-between text-[10px] text-white/50 shrink-0">
          <div className="flex items-center space-x-2">
            <Lock size={11} className="text-emerald-400" />
            <span>256-Bit SSL Demo Sandbox</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <span>Razorpay UI Clone</span>
            <span>•</span>
            <span>Simulated Payments</span>
          </div>
        </div>

      </div>
    </div>
  );
}
