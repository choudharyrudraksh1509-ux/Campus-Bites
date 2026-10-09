import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Star, Clock } from 'lucide-react';
import api from '../services/api';

interface Shop {
  shop_id: number;
  name: string;
  status: string;
  area_id: number;
  area_name?: string;
  rating?: number;
  waitTime?: string;
  tags?: string[];
}

const MOCK_CAMPUS_SHOPS: Shop[] = [
  // Gazebo Outlets
  { shop_id: 1, name: 'Gazebo 1', status: 'ACTIVE', area_id: 1, area_name: 'Gazebo Complex', rating: 4.8, waitTime: '8-12 mins', tags: ['Burgers', 'Pizzas', 'Fries'] },
  { shop_id: 2, name: 'Gazebo 2', status: 'ACTIVE', area_id: 1, area_name: 'Gazebo Complex', rating: 4.7, waitTime: '10-15 mins', tags: ['Rolls', 'Wings', 'Burgers'] },
  { shop_id: 3, name: 'Fresh Juices - Healthy & Tasty', status: 'ACTIVE', area_id: 1, area_name: 'Gazebo Complex', rating: 4.9, waitTime: '5-8 mins', tags: ['Juices', 'Shawarma', 'Dosa', 'Chaats'] },

  // North Square Outlets
  { shop_id: 4, name: 'Sri Outlet', status: 'ACTIVE', area_id: 2, area_name: 'North Square', rating: 4.9, waitTime: '5-7 mins', tags: ['Maggi', 'Puffs', 'Chai'] },
  { shop_id: 5, name: 'North Square Diner', status: 'ACTIVE', area_id: 2, area_name: 'North Square', rating: 4.6, waitTime: '10-12 mins', tags: ['Chole Bhature', 'Pav Bhaji'] },
  { shop_id: 6, name: 'Campus Bakers', status: 'ACTIVE', area_id: 2, area_name: 'North Square', rating: 4.5, waitTime: '3-5 mins', tags: ['Bakery', 'Sandwiches'] },
  { shop_id: 7, name: 'South Corner', status: 'ACTIVE', area_id: 2, area_name: 'North Square', rating: 4.7, waitTime: '5-8 mins', tags: ['South Indian', 'Idli', 'Dosa'] },

  // Hunger & Gymkhana
  { shop_id: 8, name: 'Hunger Express', status: 'ACTIVE', area_id: 3, area_name: 'Hunger Outlet', rating: 4.8, waitTime: '8-10 mins', tags: ['Rolls', 'Honey Chilli', 'Burgers'] },
  { shop_id: 9, name: 'Gymkhana Food Club', status: 'ACTIVE', area_id: 4, area_name: 'Gymkhana Outlet', rating: 4.9, waitTime: '12-15 mins', tags: ['Paneer Sabzi', 'Naan', 'Biryani'] },
];

export default function Home() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedComplex, setSelectedComplex] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/shops')
      .then(res => {
        if (res.data && res.data.length > 0) {
          const enriched = res.data.map((s: any) => {
            const match = MOCK_CAMPUS_SHOPS.find(m => m.name.toLowerCase() === s.name.toLowerCase());
            return {
              ...s,
              area_name: s.area?.name || match?.area_name || 'Campus Outlet',
              rating: match?.rating || 4.8,
              waitTime: match?.waitTime || '8-12 mins',
              tags: match?.tags || ['Takeaway', 'Campus']
            };
          });
          setShops(enriched);
        } else {
          setShops(MOCK_CAMPUS_SHOPS);
        }
      })
      .catch(() => {
        setShops(MOCK_CAMPUS_SHOPS);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredShops = shops.filter(shop => {
    if (selectedComplex === 'ALL') return true;
    if (selectedComplex === 'GAZEBO') return shop.area_name?.includes('Gazebo');
    if (selectedComplex === 'NORTH_SQUARE') return shop.area_name?.includes('North Square');
    if (selectedComplex === 'HUNGER') return shop.name.includes('Hunger') || shop.area_name?.includes('Hunger');
    if (selectedComplex === 'GYMKHANA') return shop.name.includes('Gymkhana') || shop.area_name?.includes('Gymkhana');
    return true;
  });

  return (
    <div className="space-y-8 fade-in pt-20 pb-28 max-w-6xl mx-auto">
      
      {/* Header Title Section */}
      <div className="space-y-5">
        <div className="flex items-center space-x-3 bg-[#1D1D21]/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 shadow-xl w-fit">
          <div className="p-2 bg-[#4C1829] text-white border border-[#930E36] rounded-xl shadow-md shadow-[#4C1829]/50 flex items-center justify-center">
            <Store size={22} />
          </div>
          <h1 className="text-2xl sm:text-3xl text-white tracking-tight">
            Campus Outlets
          </h1>
        </div>

        {/* Complex Category Pill Tabs with Pattern Overlay & Depth Effect */}
        <div className="flex overflow-x-auto gap-2.5 pb-2 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Outlets' },
            { id: 'GAZEBO', label: 'Gazebo Complex (3 Outlets)' },
            { id: 'NORTH_SQUARE', label: 'North Square (4 Outlets)' },
            { id: 'HUNGER', label: 'Hunger Outlet' },
            { id: 'GYMKHANA', label: 'Gymkhana Outlet' },
          ].map(tab => {
            const isSelected = selectedComplex === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedComplex(tab.id)}
                className={`relative overflow-hidden px-4.5 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-[#4C1829] text-white border-[#930E36] shadow-[0_10px_25px_rgba(76,24,41,0.6)] hover:scale-105'
                    : 'bg-[#1D1D21]/90 text-white/80 border-white/15 shadow-md hover:bg-[#2A2A30] hover:text-white'
                }`}
              >
                <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Outlets Grid - Dark Burgundy Card Boxes (#4C1829) with Crimson Border (#930E36) & Depth Shadow */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-56 bg-[#4C1829]/30 animate-pulse rounded-3xl border border-[#930E36]/30"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop) => (
            <div
              key={shop.shop_id}
              onClick={() => navigate(`/shop/${shop.shop_id}/menu`)}
              className="group bg-[#4C1829] text-white rounded-3xl p-6 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] border border-[#930E36] hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
            >
              {/* Pattern Texture Overlay inside Box */}
              <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>

              <div className="relative z-10">
                
                {/* Upper Center Location Badge */}
                <div className="text-center mb-3.5">
                  <span className="text-[11px] text-white bg-[#930E36]/40 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#930E36]/60 tracking-widest uppercase shadow-sm inline-block">
                    {shop.area_name}
                  </span>
                </div>

                {/* Title & Rating (White Text) */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl text-white tracking-tight">
                    {shop.name}
                  </h3>

                  <div className="flex items-center space-x-1 bg-[#930E36]/40 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs border border-[#930E36]/60 shrink-0 shadow-sm">
                    <Star size={12} className="fill-white text-white" />
                    <span>{shop.rating}</span>
                  </div>
                </div>

                {/* Item Tags inside Boxes */}
                {shop.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {shop.tags.map((tag, idx) => (
                      <span key={idx} className="bg-[#930E36]/30 border border-[#930E36]/50 text-white text-[11px] px-3 py-1 rounded-xl shadow-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Full-Width Explore Menu Button */}
              <div className="mt-6 relative z-10">
                <div className="flex items-center justify-between text-xs text-white/90 mb-3">
                  <span className="flex items-center space-x-1">
                    <Clock size={13} />
                    <span>Wait: {shop.waitTime}</span>
                  </span>
                  <span>Takeaway Only</span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/shop/${shop.shop_id}/menu`); }}
                  className="w-full bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs py-3.5 rounded-2xl shadow-xl transition-all text-center uppercase tracking-wider"
                >
                  Explore Menu
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
