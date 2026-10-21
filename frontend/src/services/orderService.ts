import api from './api';

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  itemId?: number;
  price_at_order?: number;
}

export interface Order {
  order_id: number;
  id?: number;
  shop_name: string;
  shop_id?: number;
  items: OrderItem[];
  total_amount: number;
  status: string; // 'PAYMENT_PENDING' | 'PLACED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
  pickup_token: string;
  created_at: string;
  order_time?: string;
  // Features: Preorder, Queue & Estimated Delivery Time, Payment Gateway
  is_preorder?: boolean;
  isPreorder?: boolean;
  pickup_time?: string | null;
  pickupTime?: string | null;
  queue_number?: number;
  queueNumber?: number;
  prep_time_minutes?: number;
  estimated_delivery_minutes?: number;
  estimatedMinutes?: number;
  estimated_ready_time?: string;
  payment_method?: string;
  paymentMethod?: string;
}

export interface PlaceOrderItem {
  itemId: number;
  quantity: number;
  name?: string;
  price?: number;
}

const updateLocalOrderStatus = (orderId: number, status: string): void => {
  try {
    const raw = localStorage.getItem('campusbite_orders');
    if (raw) {
      const orders: Order[] = JSON.parse(raw);
      const updated = orders.map(o => o.order_id === orderId ? { ...o, status } : o);
      localStorage.setItem('campusbite_orders', JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Failed to update local order status', err);
  }
};

export const KNOWN_MENU_ITEMS: Record<number, { name: string; price: number }> = {
  101: { name: 'Crispy Veg Cheese Burger', price: 85 },
  102: { name: 'Paneer Loaded Fries', price: 95 },
  103: { name: 'Double Cheese Pizza', price: 150 },
  104: { name: 'Cold Coffee with Ice Cream', price: 70 },
  201: { name: 'Chicken Kathi Roll', price: 110 },
  202: { name: 'Chicken Cheese Burger', price: 110 },
  203: { name: 'Hot & Spicy Wings', price: 140 },
  301: { name: 'Hot Tea', price: 15 },
  302: { name: 'Hot Coffee', price: 15 },
  303: { name: 'Filter Coffee', price: 25 },
  304: { name: 'Badam Malt', price: 30 },
  305: { name: 'Nannari Sarbath', price: 30 },
  306: { name: 'Fresh Buttermilk', price: 30 },
  307: { name: 'Rosemilk', price: 50 },
  308: { name: 'Sugarcane Juice', price: 40 },
  309: { name: 'Vazhaithandu Juice', price: 50 },
  310: { name: 'Carrot Juice', price: 50 },
  311: { name: 'Beetroot Juice', price: 50 },
  312: { name: 'Pineapple Milkshake', price: 70 },
  313: { name: 'Banana Milkshake', price: 70 },
  314: { name: 'Strawberry Milkshake', price: 80 },
  315: { name: 'Pomegranate Milkshake', price: 80 },
  316: { name: 'Chiku Milkshake', price: 80 },
  317: { name: 'Mango Milkshake', price: 80 },
  318: { name: 'Idli (2 Pcs)', price: 35 },
  319: { name: 'Set Dosa', price: 50 },
  320: { name: 'Adai Dosa (4 Dhalls)', price: 60 },
  321: { name: 'Curry Leaf Dosa', price: 60 },
  322: { name: 'Drumstick Leaf Dosa', price: 60 },
  323: { name: 'Ragi Dosa', price: 60 },
  324: { name: 'Kambu Dosa', price: 60 },
  325: { name: 'Dhall Podi Dosa (Sesame)', price: 70 },
  326: { name: 'Egg Dosa', price: 70 },
  327: { name: 'Regular Chicken Shawarma', price: 90 },
  328: { name: 'Spl. Whole Chicken Shawarma', price: 130 },
  329: { name: 'Masala Poori', price: 50 },
  330: { name: 'Dahi Bhel Poori', price: 60 },
  331: { name: 'Pani Poori', price: 50 },
  332: { name: 'Sev Poori', price: 50 },
  333: { name: 'Channa Samosa', price: 50 },
  334: { name: 'Dahi Samosa', price: 50 },
  335: { name: 'Cutlet Channa', price: 50 },
  336: { name: 'Aloo Chaat', price: 50 },
  337: { name: 'Mushroom Fry Masala', price: 50 },
  338: { name: 'Vada Pav', price: 50 },
  339: { name: 'Pav Bhaji', price: 70 },
  340: { name: 'Sundal (Channa)', price: 30 },
  341: { name: 'Vegetable Cutlet (2 Pcs)', price: 30 },
  342: { name: 'Veg Samosa (2 Pcs)', price: 30 },
  343: { name: 'Kuzhi Paniyaram (4 Pcs)', price: 30 },
  344: { name: 'Keerai Vadai (2 Pcs)', price: 30 },
  345: { name: 'Veg Bajji (3 Pcs)', price: 30 },
  346: { name: 'Spring Potato', price: 50 },
  347: { name: 'Potato Pops', price: 50 },
  401: { name: 'Masala Maggi', price: 45 },
  402: { name: 'Cheese Butter Maggi', price: 65 },
  403: { name: 'Veg Puff', price: 25 },
  404: { name: 'Egg Puff', price: 30 },
  405: { name: 'Ginger Chai', price: 20 },
  501: { name: 'Chole Bhature (2 Pcs)', price: 90 },
  502: { name: 'Special Pav Bhaji', price: 80 },
  503: { name: 'Aloo Paratha with Curd', price: 70 },
  601: { name: 'Grilled Veg Sandwich', price: 60 },
  602: { name: 'Paneer Tikka Sandwich', price: 85 },
  603: { name: 'Chocolate Brownie', price: 50 },
  701: { name: 'Masala Dosa', price: 60 },
  702: { name: 'Ghee Podi Idli (4 Pcs)', price: 55 },
  703: { name: 'Medu Vada (2 Pcs)', price: 40 },
  801: { name: 'Veg Manchurian Roll', price: 75 },
  802: { name: 'Honey Chilli Potato', price: 90 },
  803: { name: 'Crispy Veg Burger', price: 70 },
  901: { name: 'Paneer Butter Masala Combo', price: 140 },
  902: { name: 'Butter Naan (2 Pcs)', price: 50 },
  903: { name: 'Veg Dum Biryani', price: 130 },
};

export const getItemPrepTime = (itemId: number, name?: string): number => {
  const n = (name || '').toLowerCase();
  if (n.includes('tea') || n.includes('coffee') || n.includes('sarbath') || n.includes('buttermilk') || n.includes('chai') || n.includes('badam')) return 4;
  if (n.includes('juice') || n.includes('milkshake')) return 6;
  if (n.includes('idli') || n.includes('samosa') || n.includes('cutlet') || n.includes('sundal') || n.includes('paniyaram') || n.includes('vadai') || n.includes('bajji') || n.includes('poori') || n.includes('chaat') || n.includes('vada')) return 7;
  if (n.includes('maggi') || n.includes('puff') || n.includes('fries') || n.includes('pops') || n.includes('potato')) return 8;
  if (n.includes('burger') || n.includes('sandwich') || n.includes('dosa') || n.includes('roll') || n.includes('paratha') || n.includes('bhature') || n.includes('wings')) return 12;
  if (n.includes('pizza') || n.includes('shawarma') || n.includes('biryani') || n.includes('combo') || n.includes('naan')) return 15;
  return 10;
};

export function normalizeOrderItem(i: any): OrderItem {
  const rawId = Number(i.itemId || i.id || i.item_id || 0);
  const known = KNOWN_MENU_ITEMS[rawId];
  let rawName = i.item?.name || i.name || '';
  if (!rawName || rawName === 'Food Item' || rawName.startsWith('Campus Special')) {
    rawName = known?.name || 'Takeaway Special';
  }
  let rawPrice = Number(i.priceAtOrder || i.price_at_order || i.price || 0);
  if (!rawPrice || (known && rawName === known.name && rawPrice === 60 && known.price !== 60)) {
    rawPrice = known ? known.price : (rawPrice || 50);
  }
  return {
    id: rawId,
    name: rawName,
    quantity: Number(i.quantity || 1),
    price: rawPrice
  };
}

export const orderService = {
  /**
   * Fetch all orders for current user, merging live backend updates with localStorage fallback
   */
  async getOrders(): Promise<Order[]> {
    let localOrders: Order[] = [];
    try {
      const raw = localStorage.getItem('campusbite_orders');
      if (raw) {
        localOrders = JSON.parse(raw);
        localOrders = localOrders.map(o => ({
          ...o,
          items: (o.items || []).map(normalizeOrderItem)
        }));
      }
    } catch (err) {
      console.error('Failed to parse local orders', err);
    }

    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      return localOrders;
    }

    try {
      const res = await api.get('/orders');
      const apiOrders = Array.isArray(res.data) ? res.data : [];

      const mappedApiOrders: Order[] = apiOrders.map((o: any) => {
        const items = Array.isArray(o.items) ? o.items.map(normalizeOrderItem) : [];
        const itemsTotal = items.reduce((sum: number, item: OrderItem) => sum + (item.price * item.quantity), 0);
        const estMinutes = o.estimated_delivery_minutes || o.estimatedMinutes || 15;
        const estReady = o.estimated_ready_time || (o.order_time ? new Date(new Date(o.order_time).getTime() + estMinutes * 60 * 1000).toISOString() : undefined);

        return {
          order_id: Number(o.order_id || o.id),
          id: Number(o.id || o.order_id),
          shop_name: o.shop_name || o.shop?.name || 'Campus Outlet',
          shop_id: o.shop_id || o.shop?.id,
          items,
          total_amount: itemsTotal > 0 ? (itemsTotal + 10) : Number(o.total_amount || o.totalAmount || 0),
          status: o.status || 'PLACED',
          pickup_token: o.pickup_token || `TK-${1000 + (Number(o.id || o.order_id || 0) % 9000)}`,
          created_at: o.order_time
            ? new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recent',
          order_time: o.order_time,
          is_preorder: Boolean(o.is_preorder ?? o.isPreorder),
          pickup_time: o.pickup_time || o.pickupTime || null,
          queue_number: o.queue_number || o.queueNumber || 1,
          estimated_delivery_minutes: estMinutes,
          estimated_ready_time: estReady,
          payment_method: o.payment_method || o.paymentMethod || 'ONLINE_DEMO'
        };
      });

      // Merge backend orders with offline/demo local orders so no orders disappear
      const apiOrderIds = new Set(mappedApiOrders.map(o => o.order_id));
      const merged: Order[] = [
        ...mappedApiOrders,
        ...localOrders.filter(l => !apiOrderIds.has(l.order_id))
      ];

      merged.sort((a, b) => {
        if (a.order_time && b.order_time) {
          return new Date(b.order_time).getTime() - new Date(a.order_time).getTime();
        }
        return b.order_id - a.order_id;
      });

      try {
        localStorage.setItem('campusbite_orders', JSON.stringify(merged));
      } catch {
        // Ignore storage quota
      }

      return merged;
    } catch (error) {
      console.warn('API getOrders failed, returning local cached orders', error);
      return localOrders;
    }
  },

  /**
   * Get queue and estimated delivery time preview for a shop
   */
  async getShopQueueEstimate(shopId: number): Promise<{
    queueNumber: number;
    activeOrdersCount: number;
    basePrepMinutes: number;
    estimatedMinutes: number;
    estimatedReadyTime: string;
  }> {
    try {
      const res = await api.get(`/orders/queue-estimate/${shopId}`);
      if (res.data && res.data.queueNumber) {
        return res.data;
      }
    } catch {
      // Fallback
    }

    try {
      const orders = await this.getOrders();
      const activeAtShop = orders.filter(o => 
        Number(o.shop_id) === Number(shopId) &&
        ['PLACED', 'PREPARING'].includes(o.status)
      ).length;
      const basePrep = 10;
      const wait = activeAtShop * 3;
      const total = basePrep + wait;
      return {
        queueNumber: activeAtShop + 1,
        activeOrdersCount: activeAtShop,
        basePrepMinutes: basePrep,
        estimatedMinutes: total,
        estimatedReadyTime: new Date(Date.now() + total * 60 * 1000).toISOString()
      };
    } catch {
      return {
        queueNumber: 1,
        activeOrdersCount: 0,
        basePrepMinutes: 10,
        estimatedMinutes: 10,
        estimatedReadyTime: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      };
    }
  },

  /**
   * Place an order: communicates with backend API and ensures fallback sync in localStorage
   */
  async placeOrder(
    shopId: number,
    items: PlaceOrderItem[],
    metadata?: {
      shopName?: string;
      packagingFee?: number;
      isPreorder?: boolean;
      pickupTime?: string;
      paymentMethod?: string;
    }
  ): Promise<Order> {
    const token = localStorage.getItem('token');
    const packagingFee = metadata?.packagingFee ?? 10;
    const itemsSubtotal = items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
    const totalAmount = itemsSubtotal + (items.length > 0 ? packagingFee : 0);

    let orderId = Math.floor(1000 + Math.random() * 9000);
    let pickupToken = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    let finalStatus = 'PLACED';

    // Calculate queue & prep time
    let maxPrepTime = 8;
    for (const item of items) {
      const p = getItemPrepTime(item.itemId, item.name);
      if (p > maxPrepTime) maxPrepTime = p;
    }

    let existingOrders: Order[] = [];
    try {
      const raw = localStorage.getItem('campusbite_orders');
      if (raw) existingOrders = JSON.parse(raw);
    } catch {}

    const activeAtShop = existingOrders.filter(o => 
      Number(o.shop_id) === Number(shopId) &&
      ['PLACED', 'PREPARING'].includes(o.status)
    ).length;

    let queueNumber = activeAtShop + 1;
    let estimatedMinutes = maxPrepTime + (activeAtShop * 3);
    const orderTimeIso = new Date().toISOString();
    let estimatedReadyTime = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();

    if (token && token !== 'undefined') {
      try {
        const payload = {
          shopId: Number(shopId),
          items: items.map(i => ({
            itemId: Number(i.itemId),
            quantity: Number(i.quantity),
            name: i.name,
            price: i.price
          })),
          isPreorder: Boolean(metadata?.isPreorder),
          pickupTime: metadata?.pickupTime || undefined,
          paymentMethod: metadata?.paymentMethod || 'ONLINE_DEMO'
        };

        const res = await api.post('/orders', payload);
        if (res.data?.orderId || res.data?.id) {
          orderId = Number(res.data.orderId || res.data.id);
          if (res.data.pickup_token) {
            pickupToken = res.data.pickup_token;
          }
          if (res.data.queue_number) {
            queueNumber = res.data.queue_number;
          }
          if (res.data.estimated_delivery_minutes) {
            estimatedMinutes = res.data.estimated_delivery_minutes;
          }
          if (res.data.estimated_ready_time) {
            estimatedReadyTime = res.data.estimated_ready_time;
          }

          // Move order from PAYMENT_PENDING to PLACED
          try {
            await api.post(`/orders/${orderId}/payment`);
            finalStatus = 'PLACED';
          } catch (payErr) {
            console.warn('Payment confirmation step skipped or failed', payErr);
          }
        }
      } catch (apiErr: any) {
        console.warn('API placeOrder error, falling back to local sync', apiErr);
      }
    }

    const newOrder: Order = {
      order_id: orderId,
      id: orderId,
      shop_name: metadata?.shopName || `Campus Outlet #${shopId}`,
      shop_id: Number(shopId),
      items: items.map(i => ({
        id: Number(i.itemId),
        name: i.name || 'Food Item',
        quantity: Number(i.quantity),
        price: Number(i.price || 0)
      })),
      total_amount: totalAmount,
      status: finalStatus,
      pickup_token: pickupToken,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      order_time: orderTimeIso,
      is_preorder: Boolean(metadata?.isPreorder),
      pickup_time: metadata?.pickupTime || null,
      queue_number: queueNumber,
      prep_time_minutes: maxPrepTime,
      estimated_delivery_minutes: estimatedMinutes,
      estimated_ready_time: estimatedReadyTime,
      payment_method: metadata?.paymentMethod || 'ONLINE_DEMO'
    };

    // Immediate save into localStorage
    try {
      const raw = localStorage.getItem('campusbite_orders');
      const existing: Order[] = raw ? JSON.parse(raw) : [];
      const updated = [newOrder, ...existing.filter(o => o.order_id !== newOrder.order_id)];
      localStorage.setItem('campusbite_orders', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to sync order to localStorage', err);
    }

    return newOrder;
  },

  /**
   * Confirm payment to transition order to PLACED
   */
  async confirmPayment(orderId: number): Promise<boolean> {
    try {
      await api.post(`/orders/${orderId}/payment`);
      updateLocalOrderStatus(orderId, 'PLACED');
      return true;
    } catch (error) {
      console.warn(`Payment confirmation for order ${orderId} failed`, error);
      updateLocalOrderStatus(orderId, 'PLACED');
      return false;
    }
  },

  /**
   * Cancel an order if it is in PAYMENT_PENDING or PLACED status
   */
  async cancelOrder(orderId: number): Promise<boolean> {
    try {
      await api.patch(`/orders/${orderId}/cancel`);
      updateLocalOrderStatus(orderId, 'CANCELLED');
      return true;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error;
      if (errorMsg) {
        throw new Error(errorMsg);
      }
      updateLocalOrderStatus(orderId, 'CANCELLED');
      return true;
    }
  },

  /**
   * Get single order details
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data) {
        const o = res.data.order || res.data;
        const estMinutes = o.estimated_delivery_minutes || o.estimatedMinutes || 15;
        return {
          order_id: Number(o.order_id || o.id),
          id: Number(o.id || o.order_id),
          shop_name: o.shop_name || 'Campus Outlet',
          shop_id: o.shop_id || o.shopId,
          items: Array.isArray(res.data.items) ? res.data.items.map(normalizeOrderItem) : [],
          total_amount: Number(o.total_amount || 0),
          status: o.status || 'PLACED',
          pickup_token: o.pickup_token || `TK-${1000 + (Number(o.id || o.order_id) % 9000)}`,
          created_at: o.order_time
            ? new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Recent',
          order_time: o.order_time,
          is_preorder: Boolean(o.is_preorder ?? o.isPreorder),
          pickup_time: o.pickup_time || o.pickupTime || null,
          queue_number: o.queue_number || o.queueNumber || 1,
          estimated_delivery_minutes: estMinutes,
          estimated_ready_time: o.estimated_ready_time,
          payment_method: o.payment_method || o.paymentMethod || 'ONLINE_DEMO'
        };
      }
    } catch {
      // Check localStorage
      const orders = await this.getOrders();
      return orders.find(o => o.order_id === orderId) || null;
    }
    return null;
  }
};

export default orderService;
