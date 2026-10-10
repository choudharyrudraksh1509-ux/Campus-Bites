import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../services/api';

interface LoginProps {
  onSuccess?: (user: any, token: string) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [loginType, setLoginType] = useState<'USER' | 'STAFF'>('USER');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validate = () => {
    if (isRegister && !name.trim()) {
      setError('Please enter your full name.');
      return false;
    }
    if (loginType === 'USER' && (!email.trim() || !email.toLowerCase().endsWith('@vitstudent.ac.in'))) {
      setError('User email must end with @vitstudent.ac.in (e.g. samyak.m2023@vitstudent.ac.in)');
      return false;
    }
    if (loginType === 'STAFF' && !email.trim()) {
      setError('Please enter your staff email.');
      return false;
    }
    if (!password) {
      setError('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister ? { fullName: name, email, password } : { email, password };

    try {
      const res = await api.post(endpoint, payload);
      const { user, token } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('campusbite_user', JSON.stringify(user));

      if (onSuccess) {
        onSuccess(user, token);
      }

      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.issues?.[0]?.message || 'Authentication failed. Please check your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 fade-in">
      <div className="w-full max-w-md bg-[#4C1829] text-white rounded-3xl p-6 sm:p-8 shadow-[0_35px_80px_rgba(0,0,0,0.95)] border border-[#930E36] relative overflow-hidden space-y-6 opacity-100">
        
        {/* Halftone Pattern Overlay */}
        <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 space-y-6">

          {/* Student vs Staff Mode Switcher */}
          <div className="flex justify-center space-x-4 mb-4 border-b border-white/10 pb-4">
            <button
              onClick={() => { setLoginType('USER'); setIsRegister(false); setError(''); }}
              className={`text-xs uppercase tracking-wider font-medium transition-colors ${loginType === 'USER' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 hover:text-white/80 pb-1'}`}
            >
              User Login
            </button>
            <button
              onClick={() => { setLoginType('STAFF'); setIsRegister(false); setError(''); }}
              className={`text-xs uppercase tracking-wider font-medium transition-colors ${loginType === 'STAFF' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 hover:text-white/80 pb-1'}`}
            >
              Staff / Owner
            </button>
          </div>
          
          {/* Form Mode Switcher (Log In / Create Account) - Hidden for Staff */}
          {loginType === 'USER' && (
            <div className="grid grid-cols-2 p-1 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                className={`py-2.5 text-xs uppercase tracking-wider rounded-xl transition-all ${
                  !isRegister ? 'bg-white text-[#4C1829] font-medium shadow-md' : 'text-white/80 hover:text-white'
                }`}
              >
                Log In
              </button>

              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                className={`py-2.5 text-xs uppercase tracking-wider rounded-xl transition-all ${
                  isRegister ? 'bg-white text-[#4C1829] font-medium shadow-md' : 'text-white/80 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-[#930E36]/40 border border-[#930E36] flex items-center space-x-2.5 text-white text-xs">
              <ShieldAlert size={18} className="shrink-0 text-white" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRegister && (
              <div>
                <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">FULL NAME</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">
                {loginType === 'USER' ? 'USER EMAIL (@vitstudent.ac.in)' : 'STAFF/OWNER EMAIL'}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  required
                  placeholder={loginType === 'USER' ? 'your.name@vitstudent.ac.in' : 'staff@campusbites.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">PASSWORD</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2 mt-6"
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

          {/* Bottom Footer toggle helper - Hidden for staff */}
          {loginType === 'USER' && (
            <div className="pt-2 text-center">
              <p className="text-xs text-white/80">
                {isRegister ? 'Already registered on Bites?' : "Don't have an account yet?"}
                <button
                  type="button"
                  onClick={() => { setIsRegister(!isRegister); setError(''); }}
                  className="ml-2 text-white underline font-medium uppercase tracking-wider text-[11px]"
                >
                  {isRegister ? 'LOG IN' : 'SIGN UP'}
                </button>
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
