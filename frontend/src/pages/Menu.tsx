import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, Search, Clock, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import SingleOutletModal from '../components/SingleOutletModal';

interface MenuItem {
  item_id: number;
  shop_id: number;
  shop_name: string;
  item_name: string;
  category_name: string;
  price: number;
  description?: string;
  is_veg?: boolean;
}

// Full Campus Outlets Menus (Includes exact items from Healthy & Tasty price list + user specified outlets)
const FULL_MOCK_MENUS: Record<number, { shop_name: string; area_name: string; items: MenuItem[] }> = {
  // Gazebo 1
  1: {
    shop_name: 'Gazebo 1',
    area_name: 'Gazebo Complex',
    items: [
      { item_id: 101, shop_id: 1, shop_name: 'Gazebo 1', item_name: 'Crispy Veg Cheese Burger', category_name: 'Burgers', price: 85, is_veg: true },
      { item_id: 102, shop_id: 1, shop_name: 'Gazebo 1', item_name: 'Paneer Loaded Fries', category_name: 'Fries', price: 95, is_veg: true },
      { item_id: 103, shop_id: 1, shop_name: 'Gazebo 1', item_name: 'Double Cheese Pizza', category_name: 'Pizzas', price: 150, is_veg: true },
      { item_id: 104, shop_id: 1, shop_name: 'Gazebo 1', item_name: 'Cold Coffee with Ice Cream', category_name: 'Beverages', price: 70, is_veg: true },
    ]
  },
  // Gazebo 2
  2: {
    shop_name: 'Gazebo 2',
    area_name: 'Gazebo Complex',
    items: [
      { item_id: 201, shop_id: 2, shop_name: 'Gazebo 2', item_name: 'Chicken Kathi Roll', category_name: 'Rolls', price: 110, is_veg: false },
      { item_id: 202, shop_id: 2, shop_name: 'Gazebo 2', item_name: 'Chicken Cheese Burger', category_name: 'Burgers', price: 110, is_veg: false },
      { item_id: 203, shop_id: 2, shop_name: 'Gazebo 2', item_name: 'Hot & Spicy Wings', category_name: 'Snacks', price: 140, is_veg: false },
    ]
  },
  // Fresh Juices - Healthy & Tasty (Exact items from media_1791512452028.jpg)
  3: {
    shop_name: 'Fresh Juices - Healthy & Tasty',
    area_name: 'Gazebo Complex',
    items: [
      // Drinks
      { item_id: 301, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Hot Tea', category_name: 'Drinks', price: 15, is_veg: true },
      { item_id: 302, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Hot Coffee', category_name: 'Drinks', price: 15, is_veg: true },
      { item_id: 303, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Filter Coffee', category_name: 'Drinks', price: 25, is_veg: true },
      { item_id: 304, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Badam / Ragi Malt', category_name: 'Drinks', price: 30, is_veg: true },
      { item_id: 305, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Nannari Sarbath', category_name: 'Drinks', price: 30, is_veg: true },
      { item_id: 306, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Fresh Buttermilk', category_name: 'Drinks', price: 30, is_veg: true },
      { item_id: 307, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Rosemilk', category_name: 'Drinks', price: 50, is_veg: true },
      // Juices
      { item_id: 308, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Sugarcane Juice', category_name: 'Juice', price: 40, is_veg: true },
      { item_id: 309, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Vazhaithandu Juice', category_name: 'Juice', price: 50, is_veg: true },
      { item_id: 310, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Carrot Juice', category_name: 'Juice', price: 50, is_veg: true },
      { item_id: 311, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Beetroot Juice', category_name: 'Juice', price: 50, is_veg: true },
      // Milkshakes
      { item_id: 312, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Pineapple Milkshake', category_name: 'Milkshakes', price: 70, is_veg: true },
      { item_id: 313, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Banana Milkshake', category_name: 'Milkshakes', price: 70, is_veg: true },
      { item_id: 314, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Strawberry Milkshake', category_name: 'Milkshakes', price: 80, is_veg: true },
      { item_id: 315, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Pomegranate Milkshake', category_name: 'Milkshakes', price: 80, is_veg: true },
      { item_id: 316, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Chiku Milkshake', category_name: 'Milkshakes', price: 80, is_veg: true },
      { item_id: 317, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Mango Milkshake', category_name: 'Milkshakes', price: 80, is_veg: true },
      // Dosa
      { item_id: 318, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Idli (2 Pcs)', category_name: 'Dosa', price: 35, is_veg: true },
      { item_id: 319, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Set Dosa', category_name: 'Dosa', price: 50, is_veg: true },
      { item_id: 320, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Adai Dosa (4 Dhalls)', category_name: 'Dosa', price: 60, is_veg: true },
      { item_id: 321, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Curry Leaf Dosa', category_name: 'Dosa', price: 60, is_veg: true },
      { item_id: 322, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Drumstick Leaf Dosa', category_name: 'Dosa', price: 60, is_veg: true },
      { item_id: 323, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Ragi Dosa', category_name: 'Dosa', price: 60, is_veg: true },
      { item_id: 324, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Kambu (Rye) Dosa', category_name: 'Dosa', price: 60, is_veg: true },
      { item_id: 325, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Dhall Podi Dosa (Sesame)', category_name: 'Dosa', price: 70, is_veg: true },
      { item_id: 326, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Egg Dosa', category_name: 'Dosa', price: 70, is_veg: false },
      // Shawarma
      { item_id: 327, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Regular Chicken Shawarma', category_name: 'Shawarma', price: 90, is_veg: false },
      { item_id: 328, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Spl. Whole Chicken Shawarma', category_name: 'Shawarma', price: 130, is_veg: false },
      // Chaat
      { item_id: 329, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Masala Poori', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 330, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Dahi Bhel Poori', category_name: 'Chaat', price: 60, is_veg: true },
      { item_id: 331, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Pani Poori', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 332, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Sev Poori', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 333, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Channa Samosa', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 334, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Dahi Samosa', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 335, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Cutlet Channa', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 336, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Aloo Chaat', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 337, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Mushroom Fry Masala', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 338, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Vada Pav', category_name: 'Chaat', price: 50, is_veg: true },
      { item_id: 339, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Pav Bhaji', category_name: 'Chaat', price: 70, is_veg: true },
      // Snacks
      { item_id: 340, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Sundal (Channa)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 341, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Vegetable Cutlet (2 Pcs)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 342, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Veg Samosa (2 Pcs)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 343, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Kuzhi Paniyaram (4 Pcs)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 344, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Keerai Vadai (2 Pcs)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 345, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Veg Bajji (3 Pcs)', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 346, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Spring Potato', category_name: 'Snacks', price: 50, is_veg: true },
      { item_id: 347, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Potato Pops', category_name: 'Snacks', price: 50, is_veg: true },
      { item_id: 348, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Millets & Sprouts Sandwich', category_name: 'Sandwich', price: 70, is_veg: true },
      { item_id: 349, shop_id: 3, shop_name: 'Fresh Juices', item_name: 'Millets & Sprouts Wrap', category_name: 'Wrap', price: 80, is_veg: true },
    ]
  },

  // Sri Outlet (North Square)
  4: {
    shop_name: 'Sri Outlet',
    area_name: 'North Square',
    items: [
      { item_id: 401, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Classic Maggi', category_name: 'Maggi', price: 30, is_veg: true },
      { item_id: 402, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Cheese Maggi', category_name: 'Maggi', price: 45, is_veg: true },
      { item_id: 403, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Crispy Veg Puff', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 404, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Hot Veg Samosa', category_name: 'Snacks', price: 30, is_veg: true },
      { item_id: 405, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Hot Chai', category_name: 'Beverages', price: 15, is_veg: true },
      { item_id: 406, shop_id: 4, shop_name: 'Sri Outlet', item_name: 'Hot Coffee', category_name: 'Beverages', price: 15, is_veg: true },
    ]
  },

  // North Square Diner
  5: {
    shop_name: 'North Square Diner',
    area_name: 'North Square',
    items: [
      { item_id: 501, shop_id: 5, shop_name: 'North Square Diner', item_name: 'Special Chole Bhature (2 Pcs)', category_name: 'Meals', price: 80, is_veg: true },
      { item_id: 502, shop_id: 5, shop_name: 'North Square Diner', item_name: 'Rajma Chawal Bowl', category_name: 'Meals', price: 80, is_veg: true },
      { item_id: 503, shop_id: 5, shop_name: 'North Square Diner', item_name: 'Bombay Pav Bhaji', category_name: 'Chaat', price: 70, is_veg: true },
    ]
  },

  // Campus Bakers
  6: {
    shop_name: 'Campus Bakers',
    area_name: 'North Square',
    items: [
      { item_id: 601, shop_id: 6, shop_name: 'Campus Bakers', item_name: 'Grilled Paneer Sandwich', category_name: 'Sandwich', price: 60, is_veg: true },
      { item_id: 602, shop_id: 6, shop_name: 'Campus Bakers', item_name: 'Chocolate Mousse', category_name: 'Desserts', price: 50, is_veg: true },
      { item_id: 603, shop_id: 6, shop_name: 'Campus Bakers', item_name: 'Chicken Puff', category_name: 'Snacks', price: 40, is_veg: false },
    ]
  },

  // South Corner
  7: {
    shop_name: 'South Corner',
    area_name: 'North Square',
    items: [
      { item_id: 701, shop_id: 7, shop_name: 'South Corner', item_name: 'Idli Sambar (2 Pcs)', category_name: 'South Indian', price: 35, is_veg: true },
      { item_id: 702, shop_id: 7, shop_name: 'South Corner', item_name: 'Crisp Medu Vada', category_name: 'South Indian', price: 30, is_veg: true },
      { item_id: 703, shop_id: 7, shop_name: 'South Corner', item_name: 'Hot Masala Dosa', category_name: 'South Indian', price: 60, is_veg: true },
    ]
  },

  // Hunger Express
  8: {
    shop_name: 'Hunger Express',
    area_name: 'Hunger Outlet',
    items: [
      { item_id: 801, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Classic Veg Frankie Roll', category_name: 'Rolls', price: 60, is_veg: true },
      { item_id: 802, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Chicken Kathi Roll', category_name: 'Rolls', price: 80, is_veg: false },
      { item_id: 803, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Classic Veg Burger', category_name: 'Burgers', price: 70, is_veg: true },
      { item_id: 804, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Crispy Chicken Burger', category_name: 'Burgers', price: 95, is_veg: false },
      { item_id: 805, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Peri Peri French Fries', category_name: 'Fries', price: 60, is_veg: true },
      { item_id: 806, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Honey Chilli Potato', category_name: 'Starters', price: 90, is_veg: true },
      { item_id: 807, shop_id: 8, shop_name: 'Hunger Express', item_name: 'Paneer Tikka Wrap', category_name: 'Wraps', price: 85, is_veg: true },
    ]
  },

  // Gymkhana Food Club
  9: {
    shop_name: 'Gymkhana Food Club',
    area_name: 'Gymkhana Outlet',
    items: [
      { item_id: 901, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Paneer Lababdar', category_name: 'Curries', price: 160, is_veg: true },
      { item_id: 902, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Paneer Tikka Masala', category_name: 'Curries', price: 170, is_veg: true },
      { item_id: 903, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Garlic Butter Naan', category_name: 'Breads', price: 40, is_veg: true },
      { item_id: 904, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Tandoori Roti', category_name: 'Breads', price: 20, is_veg: true },
      { item_id: 905, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Hyderabadi Veg Dum Biryani', category_name: 'Biryani', price: 120, is_veg: true },
      { item_id: 906, shop_id: 9, shop_name: 'Gymkhana', item_name: 'Special Chicken Dum Biryani', category_name: 'Biryani', price: 160, is_veg: false },
    ]
  }
};

export default function Menu() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const sId = Number(shopId) || 1;

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [shopName, setShopName] = useState('Campus Outlet');
  const [areaName, setAreaName] = useState('Campus');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Cart state stored per outlet
  const [cart, setCart] = useState<{ id: number; shopId: number; shopName: string; quantity: number; price: number; name: string }[]>(() => {
    const saved = localStorage.getItem('campusbite_cart');
    return saved ? JSON.parse(saved) : [];
  });

  // Single Outlet Modal state
  const [conflictShopName, setConflictShopName] = useState<string>('');
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'CASH'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem('campusbite_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    api.get(`/shops/${sId}/menu`)
      .then(res => {
        if (res.data && res.data.length > 0) {
          setMenu(res.data.map((item: any) => ({
            item_id: item.id || item.item_id,
            shop_id: item.shopId || item.shop_id || sId,
            shop_name: item.shop?.name || item.shop_name || 'Outlet',
            item_name: item.name || item.item_name,
            category_name: item.category?.name || item.category_name || 'General',
            price: Number(item.price),
            is_veg: item.is_veg !== undefined ? item.is_veg : !item.name.toLowerCase().includes('chicken') && !item.name.toLowerCase().includes('egg')
          })));
          setShopName(res.data[0]?.shop?.name || FULL_MOCK_MENUS[sId]?.shop_name || 'Campus Outlet');
        } else {
          loadMockData();
        }
      })
      .catch(() => {
        loadMockData();
      })
      .finally(() => setLoading(false));
  }, [sId]);

  const loadMockData = () => {
    const mock = FULL_MOCK_MENUS[sId] || FULL_MOCK_MENUS[1];
    setMenu(mock.items);
    setShopName(mock.shop_name);
    setAreaName(mock.area_name);
  };

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(menu.map(m => m.category_name)))];

  const handleAddToCart = (item: MenuItem, delta: number) => {
    if (cart.length > 0 && cart[0].shopId !== item.shop_id && delta > 0) {
      setConflictShopName(cart[0].shopName);
      setPendingItem(item);
      return;
    }

    setCart(prev => {
      const existing = prev.find(c => c.id === item.item_id);
      if (existing) {
        const newQ = existing.quantity + delta;
        if (newQ <= 0) return prev.filter(c => c.id !== item.item_id);
        return prev.map(c => c.id === item.item_id ? { ...c, quantity: newQ } : c);
      }
      if (delta > 0) {
        return [...prev, { id: item.item_id, shopId: item.shop_id, shopName: item.shop_name || shopName, quantity: 1, price: item.price, name: item.item_name }];
      }
      return prev;
    });
  };

  const handleConfirmClearAndSwitch = () => {
    if (pendingItem) {
      setCart([{ id: pendingItem.item_id, shopId: pendingItem.shop_id, shopName: pendingItem.shop_name || shopName, quantity: 1, price: pendingItem.price, name: pendingItem.item_name }]);
      setPendingItem(null);
    }
    setConflictShopName('');
  };

  const getItemQty = (itemId: number) => cart.find(c => c.id === itemId)?.quantity || 0;
  const totalCartCount = cart.reduce((acc, c) => acc + c.quantity, 0);
  const cartSubtotal = cart.reduce((acc, c) => acc + (c.quantity * c.price), 0);
  const packagingFee = cart.length > 0 ? 10 : 0;
  const grandTotal = cartSubtotal + packagingFee;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        shopId: sId,
        items: cart.map(c => ({ itemId: c.id, quantity: c.quantity }))
      };

      let orderId = Math.floor(1000 + Math.random() * 9000);
      if (token) {
        try {
          const res = await api.post('/orders', payload);
          if (res.data?.orderId) {
            orderId = res.data.orderId;
            // Automatically confirm payment since we are mocking it
            await api.post(`/orders/${orderId}/payment`);
          }
        } catch (e: any) {
          console.warn('API post order failed', e.response?.data?.error || e.message);
          alert(`Failed to place order: ${e.response?.data?.error || e.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      // We no longer strictly need localStorage, but keeping it for guest fallback
      const savedOrders = JSON.parse(localStorage.getItem('campusbite_orders') || '[]');
      const newOrder = {
        order_id: orderId,
        shop_name: cart[0]?.shopName || shopName,
        items: cart,
        total_amount: grandTotal,
        status: 'PLACED',
        pickup_token: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      localStorage.setItem('campusbite_orders', JSON.stringify([newOrder, ...savedOrders]));

      setCart([]);
      localStorage.removeItem('campusbite_cart');
      setIsCheckoutOpen(false);

      alert(`Takeaway Order Placed Successfully!\nOrder Token: ${newOrder.pickup_token}\nPickup in 10-15 mins at Stall Counter.`);
      navigate('/orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMenu = menu.filter(item => {
    const matchesCat = selectedCategory === 'ALL' || item.category_name === selectedCategory;
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 fade-in pt-20 pb-28 max-w-6xl mx-auto">
      
      {/* Single Outlet Conflict Modal */}
      <SingleOutletModal
        isOpen={!!conflictShopName}
        currentShopName={conflictShopName}
        newShopName={shopName}
        onConfirmClear={handleConfirmClearAndSwitch}
        onCancel={() => { setConflictShopName(''); setPendingItem(null); }}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#4C1829] text-white rounded-3xl p-6 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] border border-[#930E36] relative overflow-hidden">
        <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-xs text-white/80 hover:text-white mb-3 transition-colors uppercase tracking-wider"
          >
            <span>Back to Campus Outlets</span>
          </button>
          
          <h1 className="text-2xl sm:text-3xl text-white tracking-tight">
            <span>{shopName}</span>
          </h1>
          <p className="text-xs text-white/80 font-medium mt-1">
            {areaName} • Takeaway Counter Pre-Order
          </p>
        </div>

        <div className="flex items-center space-x-3 relative z-10">
          <div className="flex items-center space-x-1.5 bg-[#930E36]/40 border border-[#930E36]/60 text-white text-xs px-3.5 py-2 rounded-2xl backdrop-blur-md">
            <Clock size={16} className="text-white" />
            <span>Pickup: 10 - 15 Mins</span>
          </div>
          <span className="bg-white text-[#4C1829] font-medium text-xs px-3.5 py-2 rounded-2xl uppercase tracking-wider shadow-sm">
            Takeaway Only
          </span>
        </div>
      </div>

      {/* Search & Category Filter Navigation */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search items in menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#1D1D21]/90 border border-white/10 rounded-2xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#930E36] shadow-lg"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all shrink-0 border ${
                selectedCategory === cat
                  ? 'bg-[#4C1829] text-white border-[#930E36] shadow-lg shadow-[#4C1829]/50'
                  : 'bg-[#1D1D21]/80 border-white/10 text-white/80 hover:bg-[#2A2A30]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: Menu Items + Cart Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Menu Items Grid */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-[#4C1829]/30 animate-pulse rounded-2xl border border-[#930E36]/30"></div>
              ))}
            </div>
          ) : (
            <>
              {filteredMenu.map((item) => {
                const qty = getItemQty(item.item_id);
                return (
                  <div
                    key={item.item_id}
                    className="bg-[#4C1829] text-white border border-[#930E36]/60 rounded-2xl p-4 shadow-[0_15px_35px_rgba(0,0,0,0.6),0_5px_15px_rgba(76,24,41,0.4)] hover:scale-[1.01] transition-all flex items-center justify-between gap-4 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

                    <div className="flex items-center space-x-3.5 relative z-10">
                      {/* Veg / Non Veg Indicator Badge */}
                      <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 ${item.is_veg !== false ? 'border-white bg-emerald-500' : 'border-white bg-red-800'}`}>
                        <span className={`w-2 h-2 rounded-full ${item.is_veg !== false ? 'bg-white' : 'bg-white'}`}></span>
                      </span>

                      <div>
                        <h3 className="text-sm text-white">{item.item_name}</h3>
                        <p className="text-xs text-white/80 mt-0.5">{item.category_name}</p>
                        <p className="text-sm text-white mt-1">₹{item.price}</p>
                      </div>
                    </div>

                    {/* Quantity Modifier Buttons */}
                    <div className="flex items-center space-x-2 bg-[#930E36]/40 backdrop-blur-md p-1.5 rounded-xl border border-[#930E36]/60 shrink-0 relative z-10">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => handleAddToCart(item, -1)}
                            className="w-7 h-7 bg-white text-[#4C1829] font-medium rounded-lg flex items-center justify-center transition-colors shadow-sm"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs text-white">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => handleAddToCart(item, 1)}
                        className="w-7 h-7 bg-white text-[#4C1829] font-medium rounded-lg flex items-center justify-center transition-colors shadow-sm"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                  </div>
                );
              })}

              {filteredMenu.length === 0 && (
                <div className="text-center py-12 bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 text-white/80">
                  <p className="text-sm">No items found matching your search.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Cart Drawer */}
        <div className="lg:col-span-1">
          <div className="bg-[#4C1829] text-white border border-[#930E36] rounded-3xl p-6 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] sticky top-24 space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

            <div className="relative z-10 flex items-center justify-between border-b border-[#930E36]/60 pb-3">
              <div className="flex items-center space-x-2">
                <ShoppingBag size={20} className="text-white" />
                <h3 className="text-base text-white tracking-tight">Takeaway Cart</h3>
              </div>
              <span className="text-xs bg-[#930E36]/50 text-white px-2.5 py-1 rounded-xl border border-[#930E36]/70">
                {totalCartCount} Items
              </span>
            </div>

            <div className="relative z-10">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-white/60 space-y-2">
                  <ShoppingBag size={36} className="mx-auto opacity-50 text-white" />
                  <p className="text-xs text-white">Your takeaway cart is empty</p>
                  <p className="text-[11px] text-white/70">Select items from the menu to add</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Outlet Name Warning */}
                  <div className="text-[11px] bg-[#930E36]/30 text-white p-2.5 rounded-xl border border-[#930E36]/50 flex items-center space-x-2">
                    <Clock size={14} className="text-white shrink-0" />
                    <span>Takeaway order from <strong>{cart[0]?.shopName}</strong></span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {cart.map(c => (
                      <div key={c.id} className="flex justify-between items-center text-xs text-white">
                        <div className="flex items-center space-x-2">
                          <span className="text-white bg-[#930E36]/40 px-2 py-0.5 rounded-md">{c.quantity}x</span>
                          <span className="text-white">{c.name}</span>
                        </div>
                        <span className="text-white">₹{c.price * c.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Price Calculation */}
                  <div className="pt-3 border-t border-[#930E36]/50 space-y-2 text-xs text-white">
                    <div className="flex justify-between text-white/90">
                      <span>Subtotal</span>
                      <span className="text-white">₹{cartSubtotal}</span>
                    </div>
                    <div className="flex justify-between text-white/90">
                      <span>Container / Packaging</span>
                      <span className="text-white">₹{packagingFee}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#930E36]/50 text-sm text-white">
                      <span>Grand Total</span>
                      <span className="text-white text-base">₹{grandTotal}</span>
                    </div>
                  </div>

                  {/* Checkout Trigger Button */}
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full py-3.5 bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to Checkout (₹{grandTotal})</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#4C1829] text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.9)] border border-[#930E36] space-y-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>
            
            <div className="relative z-10 space-y-5">
              <div className="flex justify-between items-center border-b border-[#930E36]/60 pb-3">
                <div>
                  <h3 className="text-xl text-white tracking-tight">Confirm Takeaway Order</h3>
                  <p className="text-xs text-white/80">Stall Pickup • {cart[0]?.shopName}</p>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="p-1 text-white/80 hover:text-white rounded-xl"
                >
                  ✕
                </button>
              </div>

              {/* Takeaway Info Box */}
              <div className="bg-[#930E36]/30 border border-[#930E36]/50 p-3.5 rounded-2xl flex items-center space-x-3 text-white">
                <Clock size={20} className="text-white shrink-0" />
                <div>
                  <p className="text-xs text-white">Estimated Pickup Time: 10 - 15 Mins</p>
                  <p className="text-[11px] text-white/80">Present your Secret Pickup Token Code at stall counter.</p>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="block text-xs text-white uppercase tracking-wider">Select Payment Method</label>
                
                <div
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'UPI' ? 'border-[#930E36] bg-[#930E36]/40 text-white' : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>UPI Payment (Google Pay / PhonePe / Paytm)</span>
                  {paymentMethod === 'UPI' && <CheckCircle2 size={16} className="text-white" />}
                </div>

                <div
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'CARD' ? 'border-[#930E36] bg-[#930E36]/40 text-white' : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Credit / Debit Card</span>
                  {paymentMethod === 'CARD' && <CheckCircle2 size={16} className="text-white" />}
                </div>

                <div
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'CASH' ? 'border-[#930E36] bg-[#930E36]/40 text-white' : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Counter Cash on Pickup</span>
                  {paymentMethod === 'CASH' && <CheckCircle2 size={16} className="text-white" />}
                </div>
              </div>

              {/* Order Total & Action */}
              <div className="pt-3 border-t border-[#930E36]/60 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-white/80 uppercase tracking-wider">Total Payable</span>
                  <span className="text-xl text-white">₹{grandTotal}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="py-3.5 px-6 bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider"
                >
                  {isSubmitting ? 'Processing Order...' : 'Place Order Now'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
