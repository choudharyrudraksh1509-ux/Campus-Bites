import api from './api';
import orderService, { type Order, type PlaceOrderItem } from './orderService';

export interface AutobookSchedule {
  id: number;
  userId?: number;
  shopId: number;
  shopName: string;
  itemId: number;
  itemName: string;
  price: number;
  quantity: number;
  scheduledTime: string; // format "HH:MM", 24-hr format, e.g. "08:30"
  isActive: boolean;
  lastRunDate?: string | null; // e.g. "2026-10-21"
  createdAt?: string;
  notes?: string;
}

const STORAGE_KEY = 'campusbite_autobook_schedules';

export const autobookService = {
  /**
   * Get all autobook schedules for current user (merges API with local sync)
   */
  async getSchedules(): Promise<AutobookSchedule[]> {
    let localSchedules: AutobookSchedule[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        localSchedules = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse local autobooks', e);
    }

    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      return localSchedules;
    }

    try {
      const res = await api.get('/orders/autobook/schedules');
      if (Array.isArray(res.data)) {
        // Merge with local
        const apiIds = new Set(res.data.map((s: any) => s.id));
        const merged = [
          ...res.data,
          ...localSchedules.filter(s => !apiIds.has(s.id))
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Failed to fetch autobook schedules from API, using local storage', err);
    }

    return localSchedules;
  },

  /**
   * Create a new daily autobook schedule
   */
  async createSchedule(data: {
    shopId: number;
    shopName: string;
    itemId: number;
    itemName: string;
    price: number;
    quantity: number;
    scheduledTime: string;
    notes?: string;
  }): Promise<AutobookSchedule> {
    const newId = Math.floor(1000 + Math.random() * 9000);
    const newSchedule: AutobookSchedule = {
      id: newId,
      shopId: data.shopId,
      shopName: data.shopName,
      itemId: data.itemId,
      itemName: data.itemName,
      price: data.price,
      quantity: data.quantity || 1,
      scheduledTime: data.scheduledTime,
      isActive: true,
      lastRunDate: null,
      createdAt: new Date().toISOString(),
      notes: data.notes
    };

    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      try {
        const res = await api.post('/orders/autobook/schedules', {
          shopId: data.shopId,
          itemId: data.itemId,
          quantity: data.quantity || 1,
          scheduledTime: data.scheduledTime,
          isActive: true
        });
        if (res.data?.schedule?.id) {
          newSchedule.id = res.data.schedule.id;
        }
      } catch (err) {
        console.warn('Failed to save autobook schedule on backend, saved locally', err);
      }
    }

    // Save to local storage
    const current = await this.getSchedules();
    const updated = [newSchedule, ...current.filter(s => s.id !== newSchedule.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('autobookUpdated'));

    return newSchedule;
  },

  /**
   * Toggle active status of a schedule
   */
  async toggleSchedule(id: number): Promise<boolean> {
    const current = await this.getSchedules();
    const target = current.find(s => s.id === id);
    if (!target) return false;

    const newStatus = !target.isActive;
    target.isActive = newStatus;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('autobookUpdated'));

    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      try {
        await api.patch(`/orders/autobook/schedules/${id}/toggle`);
      } catch (err) {
        console.warn('Backend toggle schedule failed', err);
      }
    }

    return newStatus;
  },

  /**
   * Delete an autobook schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    const current = await this.getSchedules();
    const updated = current.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('autobookUpdated'));

    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      try {
        await api.delete(`/orders/autobook/schedules/${id}`);
      } catch (err) {
        console.warn('Backend delete schedule failed', err);
      }
    }
  },

  /**
   * Trigger an autobook schedule immediately as an order
   */
  async triggerScheduleNow(schedule: AutobookSchedule): Promise<Order> {
    const items: PlaceOrderItem[] = [{
      itemId: schedule.itemId,
      quantity: schedule.quantity,
      name: schedule.itemName,
      price: schedule.price
    }];

    const order = await orderService.placeOrder(
      schedule.shopId,
      items,
      {
        shopName: schedule.shopName,
        isPreorder: false,
        paymentMethod: 'AUTOBOOK_SCHEDULE_DEMO'
      }
    );

    // Update last run date
    const today = new Date().toISOString().split('T')[0];
    const current = await this.getSchedules();
    const updated = current.map(s => s.id === schedule.id ? { ...s, lastRunDate: today } : s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('autobookUpdated'));

    return order;
  },

  /**
   * Check all active schedules against current time.
   * If current local time matches schedule time and hasn't run today, place order!
   */
  async checkAndRunDueSchedules(): Promise<AutobookSchedule[]> {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayDateStr = now.toISOString().split('T')[0];

    const schedules = await this.getSchedules();
    const triggered: AutobookSchedule[] = [];

    for (const schedule of schedules) {
      if (!schedule.isActive) continue;
      if (schedule.lastRunDate === todayDateStr) continue;

      // Check if scheduled time matches current time
      if (schedule.scheduledTime === currentTimeStr) {
        try {
          console.log(`[Autobook] Auto-triggering daily scheduled order for ${schedule.itemName} at ${schedule.scheduledTime}`);
          await this.triggerScheduleNow(schedule);
          triggered.push(schedule);
        } catch (err) {
          console.error(`[Autobook] Failed to auto-place order for schedule ${schedule.id}`, err);
        }
      }
    }

    return triggered;
  }
};

export default autobookService;
