import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, CheckCircle2, ShieldAlert, KeyRound, Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../services/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdateUser?: (user: any) => void;
}

export default function ProfileModal({ isOpen, onClose, user, onUpdateUser }: ProfileModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync state whenever modal opens or user prop changes
  useEffect(() => {
    if (user) {
      setFullName(user.name || user.fullName || '');
      setPhone(user.phone || '');
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowPasswordSection(false);
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Full name cannot be empty');
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        setError('Current password is required to set a new password');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      const payload: {
        fullName: string;
        phone?: string | null;
        password?: string;
        currentPassword?: string;
      } = {
        fullName: fullName.trim(),
        phone: phone.trim() ? phone.trim() : null,
      };

      if (newPassword) {
        payload.password = newPassword;
        payload.currentPassword = currentPassword;
      }

      const res = await api.put('/auth/profile', payload);
      const updatedUser = res.data?.user || {
        ...user,
        name: payload.fullName,
        phone: payload.phone,
      };

      // Update storage
      localStorage.setItem('campusbite_user', JSON.stringify(updatedUser));

      // Callback to update parent/Navbar user state
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }

      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const roleName = user?.role === 'CUSTOMER' ? 'STUDENT / CUSTOMER' : user?.role || 'CUSTOMER';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#4C1829] sm:bg-black/80 sm:backdrop-blur-md sm:flex sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)'
        }}
        className="bg-[#4C1829] text-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl p-5 sm:p-8 shadow-none sm:shadow-[0_30px_70px_rgba(0,0,0,0.9)] border-0 sm:border border-[#930E36] relative overflow-hidden flex flex-col"
      >
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-15 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#930E36]/50 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#930E36] to-[#60122B] text-white border border-white/20 flex items-center justify-center text-lg font-bold shadow-lg">
                {fullName ? fullName.charAt(0).toUpperCase() : (user?.name ? user.name.charAt(0).toUpperCase() : 'U')}
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-wide text-white">User Profile</h2>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase bg-[#930E36]/60 border border-[#930E36] text-white/90">
                    <Shield size={10} className="mr-1 text-white/80" />
                    {roleName}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Success Banner */}
          {success && (
            <div className="mt-3 p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 flex items-center space-x-2.5 text-emerald-200 text-xs shadow-lg animate-fade-in shrink-0">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span className="font-medium">{success}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-3 p-3.5 rounded-2xl bg-[#930E36]/60 border border-red-500/60 flex items-center space-x-2.5 text-red-200 text-xs shadow-lg animate-fade-in shrink-0">
              <ShieldAlert size={18} className="shrink-0 text-red-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Edit Profile Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Read-Only Campus Email */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs text-white/70 uppercase tracking-wider font-medium">CAMPUS EMAIL</label>
                <span className="text-[10px] text-white/40 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">Read-only</span>
              </div>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  readOnly
                  disabled
                  value={user?.email || ''}
                  className="w-full pl-11 pr-4 py-3 bg-black/25 border border-white/10 rounded-2xl text-sm text-white/60 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Editable Full Name */}
            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider font-medium">FULL NAME</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                />
              </div>
            </div>

            {/* Editable Phone Number */}
            <div>
              <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider font-medium">PHONE NUMBER</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                />
              </div>
            </div>

            {/* Password Change Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordSection(!showPasswordSection);
                  setError('');
                }}
                className="w-full flex items-center justify-between py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-all"
              >
                <span className="flex items-center space-x-2">
                  <KeyRound size={15} className="text-white/60" />
                  <span className="font-medium tracking-wide">
                    {showPasswordSection ? 'Cancel Password Change' : 'Change Password (Optional)'}
                  </span>
                </span>
                <span className="text-[11px] text-white/50 underline">
                  {showPasswordSection ? 'Hide' : 'Change'}
                </span>
              </button>
            </div>

            {/* Expandable Password Section */}
            {showPasswordSection && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-black/20 border border-[#930E36]/40 animate-fade-in">
                {/* Current Password */}
                <div>
                  <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider font-medium">CURRENT PASSWORD</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-2.5 bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    >
                      {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider font-medium">NEW PASSWORD</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-2.5 bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider font-medium">CONFIRM NEW PASSWORD</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium uppercase tracking-wider transition-all"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-white hover:bg-white/95 text-[#4C1829] font-semibold text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#4C1829]" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
