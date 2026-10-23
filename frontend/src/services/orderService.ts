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
  const rawName = i.item?.name || i.name || 'Takeaway Item';
  const rawPrice = Number(i.priceAtOrder ?? i.price_at_order ?? i.price ?? 0);
  return {
    id: rawId,
    name: rawName,
    quantity: Number(i.quantity || 1),
    price: rawPrice
  };
}

export const orderService = {
  /**
   * Fetch all orders for current user directly from authoritative backend API.
   * Zero localStorage business-state fallback: never fakes orders if the API fails.
   */
  async getOrders(): Promise<Order[]> {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined') {
      return [];
    }

    const res = await api.get('/orders');
    const apiOrders = Array.isArray(res.data) ? res.data : [];

    const mappedOrders: Order[] = apiOrders.map((o: any) => {
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
        total_amount: Number(o.total_amount || o.totalAmount || (itemsTotal > 0 ? itemsTotal + 10 : 0)),
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

    mappedOrders.sort((a, b) => {
      if (a.order_time && b.order_time) {
        return new Date(b.order_time).getTime() - new Date(a.order_time).getTime();
      }
      return b.order_id - a.order_id;
    });

    return mappedOrders;
  },

  /**
   * Get queue and estimated delivery time preview for a shop from server
   */
  async getShopQueueEstimate(shopId: number): Promise<{
    queueNumber: number;
    activeOrdersCount: number;
    basePrepMinutes: number;
    estimatedMinutes: number;
    estimatedReadyTime: string;
  }> {
    const res = await api.get(`/orders/queue-estimate/${shopId}`);
    return res.data;
  },

  /**
   * Place an order: strictly server-authoritative.
   * If backend request fails, throws error immediately. Never fabricates fake orders.
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
    if (!token || token === 'undefined') {
      throw new Error('Authentication required to place an order. Please log in first.');
    }

    const idempotencyKey = `cb-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload = {
      shopId: Number(shopId),
      items: items.map(i => ({
        itemId: Number(i.itemId),
        quantity: Number(i.quantity)
      })),
      isPreorder: Boolean(metadata?.isPreorder),
      pickupTime: metadata?.pickupTime || undefined,
      paymentMethod: metadata?.paymentMethod || 'ONLINE_DEMO',
      idempotencyKey,
      autoConfirm: true
    };

    const res = await api.post('/orders', payload, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    const data = res.data;

    const createdOrder = data.order || data;
    const estMinutes = data.estimated_delivery_minutes || createdOrder.estimatedMinutes || 15;
    const estReady = data.estimated_ready_time || (createdOrder.orderTime ? new Date(new Date(createdOrder.orderTime).getTime() + estMinutes * 60 * 1000).toISOString() : new Date(Date.now() + estMinutes * 60000).toISOString());

    return {
      order_id: Number(data.orderId || data.id || createdOrder.id),
      id: Number(data.orderId || data.id || createdOrder.id),
      shop_name: metadata?.shopName || createdOrder.shop?.name || 'Campus Outlet',
      shop_id: Number(shopId),
      items: Array.isArray(createdOrder.items)
        ? createdOrder.items.map(normalizeOrderItem)
        : items.map(i => ({ id: i.itemId, name: i.name || 'Food Item', quantity: i.quantity, price: i.price || 0 })),
      total_amount: Number(data.total_amount || data.totalAmount || createdOrder.totalAmount || 0),
      status: createdOrder.status || 'PLACED',
      pickup_token: data.pickup_token || `TK-${1000 + (Number(data.orderId || createdOrder.id || 0) % 9000)}`,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      order_time: createdOrder.orderTime || new Date().toISOString(),
      is_preorder: Boolean(metadata?.isPreorder),
      pickup_time: metadata?.pickupTime || null,
      queue_number: data.queue_number || createdOrder.queueNumber || 1,
      prep_time_minutes: data.prep_time_minutes || 10,
      estimated_delivery_minutes: estMinutes,
      estimated_ready_time: estReady,
      payment_method: metadata?.paymentMethod || createdOrder.paymentMethod || 'ONLINE_DEMO'
    };
  },

  /**
   * Confirm payment to transition order to PLACED
   */
  async confirmPayment(orderId: number): Promise<boolean> {
    const res = await api.post(`/orders/${orderId}/payment`);
    return res.status === 200 || res.status === 201;
  },

  /**
   * Cancel an order if it is in PAYMENT_PENDING or PLACED status
   */
  async cancelOrder(orderId: number): Promise<boolean> {
    const res = await api.patch(`/orders/${orderId}/cancel`);
    return res.status === 200;
  },

  /**
   * Get single order details from authoritative backend
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    const res = await api.get(`/orders/${orderId}`);
    if (res.data) {
      const o = res.data.order || res.data;
      const estMinutes = o.estimated_delivery_minutes || o.estimatedMinutes || 15;
      return {
        order_id: Number(o.order_id || o.id),
        id: Number(o.id || o.order_id),
        shop_name: o.shop_name || o.shop?.name || 'Campus Outlet',
        shop_id: o.shop_id || o.shopId,
        items: Array.isArray(res.data.items) ? res.data.items.map(normalizeOrderItem) : [],
        total_amount: Number(o.total_amount || o.totalAmount || 0),
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
    return null;
  }
};

export default orderService;
