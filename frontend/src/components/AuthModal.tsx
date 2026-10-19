import { useState } from 'react';
import { X, Mail, Lock, User, Phone, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, token: string) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && !fullName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    if (!email.trim()) {
      setError('Email cannot be empty');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (isRegister && phone.trim()) {
      const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      const indianRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      const generalRegex = /^\+?[1-9]\d{9,14}$/;
      if (!indianRegex.test(cleanPhone) && !generalRegex.test(cleanPhone)) {
        setError('Please enter a valid 10-digit phone number (e.g. 9876543210)');
        return;
      }
    }

    if (!password.trim()) {
      setError('Password cannot be empty');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const cleanPhone = phone.trim() ? phone.trim().replace(/[\s\-\(\)]/g, '') : undefined;
        const regRes = await api.post('/auth/register', {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          phone: cleanPhone,
          role: 'CUSTOMER'
        });

        let userData = regRes.data?.user;
        let userToken = regRes.data?.token;

        if (!userToken || !userData) {
          const loginRes = await api.post('/auth/login', {
            email: email.trim().toLowerCase(),
            password: password.trim()
          });
          userData = loginRes.data?.user;
          userToken = loginRes.data?.token;
        }

        onSuccess(userData, userToken);
        onClose();
      } else {
        const res = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password: password.trim()
        });
        onSuccess(res.data.user, res.data.token);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#4C1829] sm:bg-black/80 sm:backdrop-blur-md sm:flex sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)'
        }}
        className="bg-[#4C1829] text-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl p-6 sm:p-8 shadow-none sm:shadow-[0_30px_70px_rgba(0,0,0,0.9)] border-0 sm:border border-[#930E36] relative overflow-hidden flex flex-col justify-center"
      >
        {/* Yellow Dots Pattern Overlay - Confined strictly to upper header region */}
        <div
          className="absolute top-0 left-0 right-0 h-[220px] pointer-events-none bg-no-repeat bg-top bg-cover opacity-90 z-0"
          style={{
            backgroundImage: "url('/yellow-dots.png')",
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)'
          }}
        ></div>
        
        <div className="relative z-10">
          {/* Top Close Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white rounded-2xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-[#930E36]/40 border border-[#930E36] flex items-center space-x-2 text-white text-xs">
              <ShieldAlert size={16} className="shrink-0 text-white" />
              <span>{error}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRegister && (
              <div>
                <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">FULL NAME</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    required
                    placeholder="Samyak"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">EMAIL ADDRESS</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">PHONE NUMBER</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="tel"
                    placeholder="8000395769"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">PASSWORD</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>{isRegister ? 'CREATE ACCOUNT' : 'LOG IN NOW'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Login / Register */}
          <div className="mt-6 pt-5 border-t border-[#930E36]/50 text-center">
            <p className="text-xs text-white/80">
              {isRegister ? 'Already registered on Bites?' : "Don't have an account yet?"}
              <button
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="ml-2 text-white underline font-medium uppercase tracking-wider text-[11px]"
              >
                {isRegister ? 'LOG IN' : 'SIGN UP'}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
