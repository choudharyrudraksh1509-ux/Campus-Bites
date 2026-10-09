import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Store, Clock, MapPin } from 'lucide-react';
import api from '../services/api';

interface Shop {
  shop_id: number;
  name: string;
  status: string;
  area_id: number;
  area_name?: string;
}

export default function Home() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/shops')
      .then(res => setShops(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 fade-in">
      {/* Hero Section */}
      <div className="bg-white border rounded-lg p-8 sm:p-12 shadow-sm flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
        <div className="z-10 max-w-xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
            Campus Dining, <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">Elevated.</span>
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Pre-order your favorite meals, skip the long queues, and grab your food hot and fresh. Welcome to the modern way to eat on campus.
          </p>
          <div className="flex space-x-4">
            <button 
              onClick={() => { document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors shadow-sm flex items-center space-x-2"
            >
              <span>Explore Spots</span>
              <ArrowRight size={16} />
            </button>
            <Link 
              to="/orders"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
            >
              View Activity
            </Link>
          </div>
        </div>
        <div className="hidden md:block absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-gray-50 to-transparent"></div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-5 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <Store className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-700">Active Spots</h3>
          </div>
          <p className="text-3xl font-bold tracking-tight">{loading ? '-' : shops.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-5 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-700">Avg. Wait Time</h3>
          </div>
          <p className="text-3xl font-bold tracking-tight">5-10m</p>
        </div>
      </div>

      {/* Shop Grid */}
      <div id="shops" className="pt-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Food Spots</h2>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full border">All Areas</div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg border"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <div 
                key={shop.shop_id} 
                onClick={() => shop.status === 'ACTIVE' && navigate(`/shop/${shop.shop_id}/menu`)}
                className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col ${shop.status === 'INACTIVE' ? 'opacity-50 grayscale' : 'hover:border-gray-300'}`}
              >
                <div className="h-32 bg-gray-50 border-b flex flex-col items-center justify-center p-6 relative">
                  <div className="absolute top-3 right-3 flex space-x-1">
                    <span className={`w-2 h-2 rounded-full ${shop.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </div>
                  <Store size={32} className="text-gray-300 group-hover:text-gray-400 transition-colors mb-2" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate">{shop.name}</h3>
                    <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                      <MapPin size={12} />
                      <span>{shop.area_name || 'Main Campus'}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs font-medium text-gray-500">Fast Food, Beverages</span>
                    <ArrowRight size={16} className="text-gray-400 group-hover:text-black transition-colors" />
                  </div>
                </div>
              </div>
            ))}
            {shops.length === 0 && (
              <div className="col-span-3 text-center py-12 bg-white border rounded-lg border-dashed">
                <Store size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No shops available right now.</p>
                <p className="text-xs text-gray-400 mt-1">The database might be empty or syncing.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
