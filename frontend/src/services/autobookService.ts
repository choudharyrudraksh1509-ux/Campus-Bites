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

export const autobookService = {
  /**
   * Get all autobook schedules for current user directly from backend database.
   * Zero localStorage business-state fallback.
   */
  async getSchedules(): Promise<AutobookSchedule[]> {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      return [];
    }

    const res = await api.get('/orders/autobook/schedules');
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  /**
   * Create a new daily autobook schedule backed by database transaction.
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
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      throw new Error('Authentication required to register autobook schedules.');
    }

    const res = await api.post('/orders/autobook/schedules', {
      shopId: Number(data.shopId),
      itemId: Number(data.itemId),
      quantity: Number(data.quantity) || 1,
      scheduledTime: data.scheduledTime,
      isActive: true
    });

    const schedule = res.data?.schedule;
    if (!schedule) {
      throw new Error('Failed to create autobook schedule on server.');
    }

    window.dispatchEvent(new Event('autobookUpdated'));

    return {
      id: schedule.id,
      shopId: schedule.shopId,
      shopName: schedule.shop?.name || data.shopName,
      itemId: schedule.itemId,
      itemName: schedule.item?.name || data.itemName,
      price: schedule.item?.price || data.price,
      quantity: schedule.quantity,
      scheduledTime: schedule.scheduledTime,
      isActive: schedule.isActive,
      lastRunDate: schedule.lastRunDate,
      createdAt: schedule.createdAt
    };
  },

  /**
   * Toggle active status of a schedule on the database.
   */
  async toggleSchedule(id: number): Promise<boolean> {
    const res = await api.patch(`/orders/autobook/schedules/${id}/toggle`);
    window.dispatchEvent(new Event('autobookUpdated'));
    return res.data?.schedule?.isActive ?? true;
  },

  /**
   * Delete an autobook schedule from the database.
   */
  async deleteSchedule(id: number): Promise<void> {
    await api.delete(`/orders/autobook/schedules/${id}`);
    window.dispatchEvent(new Event('autobookUpdated'));
  },

  /**
   * Trigger an autobook schedule immediately as an authoritative order.
   */
  async triggerScheduleNow(schedule: AutobookSchedule): Promise<Order> {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      try {
        await api.post(`/autobook/schedules/${schedule.id}/run`);
      } catch (backendErr) {
        console.warn('Backend autobook run failed, using client order fallback', backendErr);
      }
    }

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
        paymentMethod: 'ONLINE_DEMO'
      }
    );

    window.dispatchEvent(new Event('autobookUpdated'));
    return order;
  },

  /**
   * Check all active schedules against current time.
   * Delegates evaluation directly to backend scheduler engine.
   */
  async checkAndRunDueSchedules(): Promise<AutobookSchedule[]> {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayDateStr = now.toISOString().split('T')[0];

    const token = localStorage.getItem('token');
    if (token && token !== 'undefined') {
      try {
        await api.post('/autobook/trigger-cycle', {
          targetTime: currentTimeStr,
          targetDate: todayDateStr
        });
      } catch (err) {
        console.warn('Backend autobook trigger-cycle notice:', err);
      }
    }

    const schedules = await this.getSchedules();
    const triggered: AutobookSchedule[] = [];

    for (const schedule of schedules) {
      if (!schedule.isActive) continue;
      if (schedule.lastRunDate === todayDateStr) continue;

      if (schedule.scheduledTime === currentTimeStr) {
        triggered.push(schedule);
      }
    }

    return triggered;
  }
};

export default autobookService;
