import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Repeat,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Store
} from 'lucide-react';
import autobookService from '../services/autobookService';

interface AutobookModalProps {
  isOpen: boolean;
  item: {
    item_id: number;
    shop_id: number;
    shop_name: string;
    item_name: string;
    price: number;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_TIMES = [
  { label: '☀️ Breakfast', time: '08:30', display: '08:30 AM' },
  { label: '🍛 Lunch', time: '13:15', display: '01:15 PM' },
  { label: '☕ Evening Chai', time: '17:00', display: '05:00 PM' },
  { label: '🌙 Dinner', time: '20:30', display: '08:30 PM' },
];

export default function AutobookModal({
  isOpen,
  item,
  onClose,
  onSuccess
}: AutobookModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen || !item) return null;

  const handleSaveSchedule = async () => {
    setIsSubmitting(true);
    try {
      await autobookService.createSchedule({
        shopId: item.shop_id,
        shopName: item.shop_name,
        itemId: item.item_id,
        itemName: item.item_name,
        price: item.price,
        quantity,
        scheduledTime,
        notes: notes.trim() || undefined
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        onSuccess?.();
      }, 1600);
    } catch (err) {
      console.error('Failed to create autobook schedule', err);
      alert('Failed to save autobook schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayTime = (time24: string) => {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr || '8', 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#4C1829] text-white rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-[0_30px_70px_rgba(0,0,0,0.95)] border border-[#930E36] relative overflow-hidden flex flex-col space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#930E36]/60 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-[#930E36]/40 rounded-2xl border border-[#930E36]/70 text-pink-300">
              <Repeat size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
                <span>Daily Autobook Schedule</span>
              </h3>
              <p className="text-xs text-white/70">
                Automatic daily order placed at your designated time
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {showSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-lg font-bold text-white">Daily Autobook Active!</h4>
            <p className="text-xs text-white/80 max-w-xs">
              <strong>{quantity}x {item.item_name}</strong> will be placed automatically every day at <strong>{formatDisplayTime(scheduledTime)}</strong> from {item.shop_name}.
            </p>
          </div>
        ) : (
          /* Configuration View */
          <div className="space-y-4 text-xs">
            {/* Target Item Card */}
            <div className="bg-[#930E36]/30 border border-[#930E36]/60 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-white block">{item.item_name}</span>
                <span className="text-[11px] text-white/70 flex items-center space-x-1 mt-0.5">
                  <Store size={12} />
                  <span>{item.shop_name}</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-white">₹{item.price * quantity}</span>
                <span className="text-[10px] text-white/60 block">₹{item.price} each</span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-2xl border border-white/10">
              <span className="text-white/80 font-medium">Daily Quantity:</span>
              <div className="flex items-center space-x-2 bg-[#4C1829] px-2 py-1 rounded-xl border border-[#930E36]">
                <button
                  type="button"
                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                  className="w-6 h-6 bg-white text-[#4C1829] rounded-lg flex items-center justify-center hover:bg-white/90 font-bold"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center font-bold text-sm text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(prev => prev + 1)}
                  className="w-6 h-6 bg-white text-[#4C1829] rounded-lg flex items-center justify-center hover:bg-white/90 font-bold"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Daily Schedule Time */}
            <div className="space-y-2">
              <label className="text-white/90 font-medium flex items-center justify-between">
                <span>Select Daily Ordering Time:</span>
                <span className="font-mono text-pink-300 font-bold text-sm">
                  {formatDisplayTime(scheduledTime)}
                </span>
              </label>

              {/* Quick Presets */}
              <div className="grid grid-cols-2 gap-2">
                {PRESET_TIMES.map(preset => (
                  <button
                    key={preset.time}
                    type="button"
                    onClick={() => setScheduledTime(preset.time)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      scheduledTime === preset.time
                        ? 'bg-white text-[#4C1829] font-bold border-white shadow-md'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-[11px]">{preset.label}</div>
                    <div className="text-[10px] opacity-75">{preset.display}</div>
                  </button>
                ))}
              </div>

              {/* Custom Time Picker */}
              <div className="pt-1 flex items-center space-x-2">
                <span className="text-[11px] text-white/60">Or custom time:</span>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="bg-black/40 border border-[#930E36]/70 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/70">Custom Preference / Notes (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Less spicy, without onion, warm takeaway"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-black/30 border border-[#930E36]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>

            {/* Benefit Notice */}
            <div className="bg-[#930E36]/20 border border-[#930E36]/40 p-2.5 rounded-xl text-[11px] text-white/80 flex items-center space-x-2">
              <Sparkles size={14} className="text-pink-300 shrink-0" />
              <span>
                Zero effort! Every day at this scheduled time, your order will automatically be queued at {item.shop_name}.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveSchedule}
                disabled={isSubmitting}
                className="w-full py-3 bg-white hover:bg-white/95 text-[#4C1829] font-bold rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2"
              >
                <Repeat size={15} />
                <span>{isSubmitting ? 'Scheduling Daily Order...' : `Schedule Daily (${formatDisplayTime(scheduledTime)})`}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
