import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle2, ShieldAlert, Store, ChevronDown } from 'lucide-react';
import api from '../services/api';

interface LoginProps {
  onSuccess?: (user: any, token: string) => void;
}

const DEFAULT_STALLS = [
  { id: 1, name: 'Gazebo 1', slug: 'gazebo1', email: 'staff.gazebo1@campusbites.com' },
  { id: 2, name: 'Gazebo 2', slug: 'gazebo2', email: 'staff.gazebo2@campusbites.com' },
  { id: 3, name: 'Fresh Juices - Healthy & Tasty', slug: 'freshjuices', email: 'staff.freshjuices@campusbites.com' },
  { id: 4, name: 'Sri Outlet', slug: 'sri', email: 'staff.sri@campusbites.com' },
  { id: 5, name: 'North Square Diner', slug: 'nsdiner', email: 'staff.nsdiner@campusbites.com' },
  { id: 6, name: 'Campus Bakers', slug: 'bakers', email: 'staff.bakers@campusbites.com' },
  { id: 7, name: 'South Corner', slug: 'southcorner', email: 'staff.southcorner@campusbites.com' },
  { id: 8, name: 'Hunger Express', slug: 'hunger', email: 'staff.hunger@campusbites.com' },
  { id: 9, name: 'Gymkhana Food Club', slug: 'gymkhana', email: 'staff.gymkhana@campusbites.com' },
];

export default function Login({ onSuccess }: LoginProps) {
  const [loginType, setLoginType] = useState<'USER' | 'STAFF'>('USER');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stalls, setStalls] = useState<any[]>(DEFAULT_STALLS);
  const [selectedStallId, setSelectedStallId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Load latest stalls from backend on mount
  useEffect(() => {
    api.get('/shops')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((s: any) => {
            const slug = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return {
              id: s.shop_id || s.id,
              name: s.name,
              slug,
              email: `staff.${slug}@campusbites.com`
            };
          });
          setStalls(mapped);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_STALLS
      });
  }, []);

  const handleStallChange = (stallIdStr: string) => {
    setSelectedStallId(stallIdStr);
    setError('');
    if (!stallIdStr) {
      setEmail('');
      return;
    }
    if (stallIdStr === 'owner') {
      setEmail('owner@campusbites.com');
      return;
    }
    const found = stalls.find(s => String(s.id) === stallIdStr);
    if (found) {
      setEmail(found.email);
    }
  };

  const validate = () => {
    if (isRegister && !name.trim()) {
      setError('Please enter your full name.');
      return false;
    }
    if (loginType === 'USER' && (!email.trim() || !email.toLowerCase().endsWith('@vitstudent.ac.in'))) {
      setError('User email must end with @vitstudent.ac.in (e.g. samyak.m2023@vitstudent.ac.in)');
      return false;
    }
    if (loginType === 'STAFF') {
      if (!selectedStallId) {
        setError('Please select your stall from the list.');
        return false;
      }
      if (!email.trim()) {
        setError('Please enter your staff ID or email.');
        return false;
      }
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
    const payload: any = isRegister ? { fullName: name, email, password } : { email, password };
    if (loginType === 'STAFF' && selectedStallId && selectedStallId !== 'owner') {
      payload.shopId = Number(selectedStallId);
    }

    try {
      const res = await api.post(endpoint, payload);
      let userData = res.data?.user;
      let userToken = res.data?.token;

      // If backend registration didn't return token and user directly, automatically login
      if (isRegister && (!userToken || !userData)) {
        const loginRes = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password
        });
        userData = loginRes.data?.user;
        userToken = loginRes.data?.token;
      }

      if (userData && userToken) {
        localStorage.setItem('token', userToken);
        localStorage.setItem('campusbite_user', JSON.stringify(userData));

        if (onSuccess) {
          onSuccess(userData, userToken);
        }

        if (userData.role === 'STAFF' || userData.role === 'OWNER') {
          navigate('/staff');
        } else {
          navigate('/');
        }
      } else {
        setError('Authentication succeeded, but failed to retrieve session. Please log in.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.issues?.[0]?.message || 'Authentication failed. Please check your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] sm:min-h-0 sm:max-w-md sm:my-auto fade-in flex flex-col justify-center">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 36px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)'
        }}
        className="w-full min-h-[100dvh] sm:min-h-0 bg-[#4C1829] text-white rounded-none sm:rounded-3xl p-5 sm:p-8 shadow-none sm:shadow-[0_35px_80px_rgba(0,0,0,0.95)] border-0 sm:border border-[#930E36] relative overflow-hidden flex flex-col justify-between"
      >
        {/* Halftone Pattern Overlay */}
        <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 space-y-5 my-auto">
          {/* Top Brand Header for Native App feel */}
          <div className="text-center space-y-1 mb-2">
            <div className="inline-flex items-center space-x-2 bg-[#930E36]/50 border border-[#930E36]/80 px-3 py-1 rounded-full mb-1">
              <span className="text-sm font-bold tracking-tight text-white">Bites</span>
              <span className="text-[10px] text-white/80 font-mono">VIT CAMPUS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {isRegister ? 'Create Your Account' : 'Welcome to Campus Bites'}
            </h2>
            <p className="text-xs text-white/70">
              Instant Takeaway Counter Pre-Ordering
            </p>
          </div>

          {/* Student vs Staff Mode Switcher */}
          <div className="flex justify-center space-x-4 mb-4 border-b border-white/10 pb-4">
            <button
              onClick={() => { setLoginType('USER'); setIsRegister(false); setError(''); setEmail(''); setSelectedStallId(''); }}
              className={`text-xs uppercase tracking-wider font-medium transition-colors ${loginType === 'USER' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 hover:text-white/80 pb-1'}`}
            >
              User Login
            </button>
            <button
              onClick={() => { setLoginType('STAFF'); setIsRegister(false); setError(''); }}
              className={`text-xs uppercase tracking-wider font-medium transition-colors ${loginType === 'STAFF' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 hover:text-white/80 pb-1'}`}
            >
              Staff / Stall Login
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
            
            {/* Stall Selection Dropdown - Visible for Staff */}
            {loginType === 'STAFF' && (
              <div>
                <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>SELECT YOUR STALL / OUTLET</span>
                  <span className="text-[10px] text-white/50 normal-case">Step 1: Choose stall</span>
                </label>
                <div className="relative">
                  <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  <select
                    value={selectedStallId}
                    onChange={(e) => handleStallChange(e.target.value)}
                    className="w-full pl-11 pr-10 py-3.5 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#930E36] appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#4C1829] text-white">-- Choose Your Stall --</option>
                    {stalls.map((stall) => (
                      <option key={stall.id} value={stall.id} className="bg-[#4C1829] text-white">
                        {stall.name}
                      </option>
                    ))}
                    <option value="owner" className="bg-[#4C1829] text-white">
                      Campus Administrator / Owner
                    </option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>

                {selectedStallId && selectedStallId !== 'owner' && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/80 flex items-center justify-between">
                    <span className="font-mono text-white/90">ID: {email}</span>
                    <span className="text-white/60">Pass: password123</span>
                  </div>
                )}
                {selectedStallId === 'owner' && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/80 flex items-center justify-between">
                    <span className="font-mono text-white/90">ID: owner@campusbites.com</span>
                    <span className="text-white/60">Pass: password123</span>
                  </div>
                )}
              </div>
            )}

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
                {loginType === 'USER' ? 'USER EMAIL (@vitstudent.ac.in)' : 'STALL STAFF ID / EMAIL'}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type={loginType === 'USER' ? 'email' : 'text'}
                  required
                  placeholder={loginType === 'USER' ? 'your.name@vitstudent.ac.in' : 'Select a stall above or enter ID'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#930E36]/30 border border-[#930E36]/50 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">
                {loginType === 'STAFF' ? 'STALL PASSWORD' : 'PASSWORD'}
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  required
                  placeholder={loginType === 'STAFF' ? 'Enter stall password (default: password123)' : 'Password'}
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
                  <span>{isRegister ? 'CREATE ACCOUNT' : loginType === 'STAFF' ? 'LOG IN TO STALL PORTAL' : 'LOG IN NOW'}</span>
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
