import { useState, useEffect } from 'react';
import { X, MessageSquare, UtensilsCrossed, Send, CheckCircle2, AlertCircle, Sparkles, User, Calendar } from 'lucide-react';
import api from '../services/api';
import RatingStars from './RatingStars';

interface ReviewItem {
  id: number;
  orderId?: number;
  customerId?: number;
  shopId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer_name: string;
}

interface FoodItemRating {
  itemId: number;
  shopId: number;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviewCount: number;
  popularTag?: string;
  is_veg?: boolean;
  recentReviews?: Array<{
    rating: number;
    comment: string;
    reviewerName: string;
    date: string;
  }>;
}

interface ReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: number;
  shopName: string;
  areaName?: string;
  initialRating?: number;
  onReviewAdded?: (newAvgRating?: number) => void;
}

export default function ReviewsModal({
  isOpen,
  onClose,
  shopId,
  shopName,
  areaName,
  initialRating = 4.8,
  onReviewAdded
}: ReviewsModalProps) {
  const [activeTab, setActiveTab] = useState<'REVIEWS' | 'ITEMS'>('REVIEWS');
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [itemRatings, setItemRatings] = useState<FoodItemRating[]>([]);
  const [averageRating, setAverageRating] = useState<number>(initialRating);
  const [totalReviews, setTotalReviews] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  // New review form state
  const [userRating, setUserRating] = useState<number>(5);
  const [userComment, setUserComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    // Fetch Shop Reviews
    const fetchReviews = api.get(`/reviews/shop/${shopId}`)
      .then(res => {
        if (res.data) {
          if (Array.isArray(res.data)) {
            setReviews(res.data);
            setTotalReviews(res.data.length);
            const sum = res.data.reduce((acc: number, r: any) => acc + (r.rating || 5), 0);
            setAverageRating(res.data.length ? Number((sum / res.data.length).toFixed(1)) : initialRating);
          } else {
            setReviews(res.data.reviews || []);
            setAverageRating(res.data.averageRating || initialRating);
            setTotalReviews(res.data.totalReviews || res.data.reviews?.length || 0);
            if (res.data.ratingBreakdown) {
              setBreakdown(res.data.ratingBreakdown);
            }
          }
        }
      })
      .catch(err => {
        console.warn('Could not fetch reviews:', err);
      });

    // Fetch Food Item Ratings
    const fetchItems = api.get(`/reviews/shop/${shopId}/items`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setItemRatings(res.data);
        }
      })
      .catch(err => {
        console.warn('Could not fetch item ratings:', err);
      });

    Promise.allSettled([fetchReviews, fetchItems]).finally(() => {
      setLoading(false);
    });
  }, [isOpen, shopId, initialRating]);

  if (!isOpen) return null;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (userRating < 1 || userRating > 5) {
      setSubmitError('Please select a star rating between 1 and 5');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        shopId,
        rating: userRating,
        comment: userComment.trim() || undefined
      };

      const res = await api.post('/reviews', payload);

      const createdReview: ReviewItem = res.data?.review || {
        id: Date.now(),
        shopId,
        rating: userRating,
        comment: userComment.trim() || null,
        createdAt: new Date().toISOString(),
        reviewer_name: 'You'
      };

      // Prepend newly added review
      setReviews(prev => [createdReview, ...prev]);
      const newTotal = totalReviews + 1;
      const newAvg = Number(((averageRating * totalReviews + userRating) / newTotal).toFixed(1));
      setTotalReviews(newTotal);
      setAverageRating(newAvg);
      setBreakdown(prev => ({
        ...prev,
        [userRating]: (prev[userRating] || 0) + 1
      }));

      setSubmitSuccess('Thank you! Your rating and review have been posted.');
      setUserComment('');
      setShowReviewForm(false);

      if (onReviewAdded) {
        onReviewAdded(newAvg);
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center items-end justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#4C1829] text-white rounded-t-3xl sm:rounded-3xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-[0_30px_70px_rgba(0,0,0,0.95),0_10px_30px_rgba(76,24,41,0.8)] border-t sm:border border-[#930E36] relative overflow-hidden my-0 sm:my-auto">
        
        {/* Subtle patterned overlay */}
        <div className="absolute inset-0 bg-small-dots opacity-20 pointer-events-none mix-blend-overlay"></div>

        {/* Modal Top Header */}
        <div className="relative z-10 p-5 sm:p-6 border-b border-[#930E36]/60 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="text-[11px] bg-[#930E36]/50 text-white px-3 py-0.5 rounded-full border border-[#930E36]/80 uppercase tracking-widest font-mono">
                {areaName || 'Campus Outlet'}
              </span>
              <span className="text-xs text-white/70 flex items-center space-x-1">
                <Sparkles size={13} className="text-amber-400" />
                <span>Verified Outlets</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl text-white tracking-tight flex items-center space-x-2">
              <span>{shopName}</span>
            </h2>

            <div className="flex items-center space-x-3 mt-2">
              <div className="flex items-center space-x-1.5 bg-[#930E36]/40 px-3 py-1 rounded-2xl border border-[#930E36]/60">
                <RatingStars rating={averageRating} size={15} showScore={true} />
              </div>
              <span className="text-xs text-white/80">
                Based on <strong className="text-white">{totalReviews}</strong> student reviews
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X size={22} />
          </button>
        </div>

        {/* Tab Navigation Pill Buttons */}
        <div className="relative z-10 px-5 sm:px-6 pt-4 pb-2 flex gap-2 border-b border-[#930E36]/40">
          <button
            onClick={() => setActiveTab('REVIEWS')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs uppercase tracking-wider font-medium transition-all ${
              activeTab === 'REVIEWS'
                ? 'bg-white text-[#4C1829] shadow-lg'
                : 'bg-[#930E36]/30 text-white/80 hover:bg-[#930E36]/50 hover:text-white border border-[#930E36]/50'
            }`}
          >
            <MessageSquare size={15} />
            <span>Outlet Reviews ({reviews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs uppercase tracking-wider font-medium transition-all ${
              activeTab === 'ITEMS'
                ? 'bg-white text-[#4C1829] shadow-lg'
                : 'bg-[#930E36]/30 text-white/80 hover:bg-[#930E36]/50 hover:text-white border border-[#930E36]/50'
            }`}
          >
            <UtensilsCrossed size={15} />
            <span>Top Rated Dishes ({itemRatings.length})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="relative z-10 p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {submitSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* TAB 1: CUSTOMER REVIEWS */}
          {activeTab === 'REVIEWS' && (
            <div className="space-y-6">
              
              {/* Rating Summary & Star Breakdown Card */}
              <div className="bg-[#930E36]/25 border border-[#930E36]/50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                
                {/* Big Score Block */}
                <div className="flex flex-col items-center justify-center text-center p-3 border-b md:border-b-0 md:border-r border-[#930E36]/50">
                  <span className="text-5xl font-bold tracking-tight text-white mb-1">
                    {averageRating.toFixed(1)}
                  </span>
                  <RatingStars rating={averageRating} size={18} className="my-1.5" />
                  <span className="text-xs text-white/70">
                    {totalReviews} ratings overall
                  </span>
                </div>

                {/* Star Rating Breakdown Bars */}
                <div className="md:col-span-2 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = breakdown[stars] || 0;
                    const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center space-x-2 text-xs">
                        <span className="w-10 text-white/80 flex items-center justify-end space-x-1 shrink-0">
                          <span>{stars}</span>
                          <span className="text-amber-400">★</span>
                        </span>

                        <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        <span className="w-10 text-right text-[11px] text-white/60 shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Bar: Write Review Toggle */}
              <div className="flex items-center justify-between">
                <h3 className="text-base text-white font-medium flex items-center space-x-2">
                  <span>Student Feedback</span>
                  <span className="text-xs text-white/60">({reviews.length})</span>
                </h3>

                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs px-4 py-2 rounded-2xl shadow-md transition-all uppercase tracking-wider"
                >
                  {showReviewForm ? 'Cancel Rating' : '+ Rate This Outlet'}
                </button>
              </div>

              {/* Quick Rating & Review Form */}
              {showReviewForm && (
                <form
                  onSubmit={handleSubmitReview}
                  className="bg-[#930E36]/35 border border-[#930E36]/70 rounded-2xl p-5 space-y-4 animate-fade-in shadow-xl"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-white">Your Review for {shopName}</h4>
                    <p className="text-xs text-white/70">Tap a star to rate taste, speed, and packaging</p>
                  </div>

                  {/* Interactive Star Selection */}
                  <div className="p-3 bg-black/25 rounded-2xl border border-white/10 flex items-center justify-between">
                    <span className="text-xs text-white/80 uppercase tracking-wider">Your Rating:</span>
                    <RatingStars
                      rating={userRating}
                      size={22}
                      interactive={true}
                      onRatingChange={(newVal) => setUserRating(newVal)}
                      showScore={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/80 mb-1.5 uppercase tracking-wider">
                      Comments / Thoughts (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={userComment}
                      onChange={(e) => setUserComment(e.target.value)}
                      placeholder="e.g. Crispy veg burger was great, takeaway was ready right on time!"
                      className="w-full p-3 bg-black/30 border border-white/15 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-2xl uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-2xl shadow-lg transition-all flex items-center space-x-1.5 uppercase tracking-wider"
                    >
                      <Send size={14} />
                      <span>{isSubmitting ? 'Posting...' : 'Submit Review'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Reviews List */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl border border-white/10"></div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-10 bg-[#930E36]/20 rounded-2xl border border-[#930E36]/40 p-6 text-white/70">
                  <MessageSquare size={32} className="mx-auto text-white/40 mb-2" />
                  <p className="text-sm text-white">No customer reviews yet for this outlet.</p>
                  <p className="text-xs text-white/60 mt-1">Be the first campus student to leave feedback!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-black/25 border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#930E36] text-white flex items-center justify-center text-xs font-bold border border-white/20">
                            <User size={14} />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              {rev.reviewer_name || 'Campus Student'}
                            </span>
                            <div className="flex items-center space-x-2 text-[10px] text-white/60">
                              <span className="flex items-center space-x-1">
                                <Calendar size={10} />
                                <span>{formatDate(rev.createdAt)}</span>
                              </span>
                              <span>• Verified Diner</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#930E36]/40 px-2.5 py-1 rounded-xl border border-[#930E36]/60">
                          <RatingStars rating={rev.rating} size={13} showScore={true} />
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-xs text-white/90 leading-relaxed pl-10 pr-2">
                          "{rev.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: TOP RATED FOOD ITEMS */}
          {activeTab === 'ITEMS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base text-white font-medium">Food Item Ratings</h3>
                  <p className="text-xs text-white/70">Explore bestsellers and ratings for each dish</p>
                </div>
                <span className="text-xs bg-white/10 px-3 py-1 rounded-xl text-white/80">
                  {itemRatings.length} Dishes
                </span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl border border-white/10"></div>
                  ))}
                </div>
              ) : itemRatings.length === 0 ? (
                <div className="text-center py-10 bg-[#930E36]/20 rounded-2xl border border-[#930E36]/40 p-6 text-white/70">
                  <UtensilsCrossed size={32} className="mx-auto text-white/40 mb-2" />
                  <p className="text-sm text-white">No food item ratings available yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {itemRatings.map((item) => (
                    <div
                      key={item.itemId}
                      className="bg-black/30 border border-white/10 hover:border-amber-400/40 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            {/* Veg / Non-veg indicator */}
                            <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              item.is_veg !== false ? 'border-emerald-400 bg-emerald-950' : 'border-rose-400 bg-rose-950'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.is_veg !== false ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}></span>
                            </span>
                            <span className="text-xs font-semibold text-white tracking-tight line-clamp-1">
                              {item.name}
                            </span>
                          </div>

                          {item.popularTag && (
                            <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-medium shrink-0">
                              {item.popularTag}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-white/70 mt-1 pl-5">
                          <span>{item.category}</span>
                          <span className="font-semibold text-white">₹{item.price}</span>
                        </div>
                      </div>

                      {/* Item Rating Badge */}
                      <div className="bg-[#930E36]/40 border border-[#930E36]/60 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <RatingStars rating={item.rating} size={14} showScore={true} />
                        </div>
                        <span className="text-[11px] text-white/70">
                          {item.reviewCount} Reviews
                        </span>
                      </div>

                      {/* Recent quote excerpt */}
                      {item.recentReviews && item.recentReviews.length > 0 && (
                        <div className="text-[11px] text-white/80 bg-white/5 p-2 rounded-xl italic border border-white/5">
                          "{item.recentReviews[0].comment}"
                          <span className="block text-[10px] text-white/50 not-italic mt-0.5">
                            — {item.recentReviews[0].reviewerName}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="relative z-10 p-4 sm:p-5 border-t border-[#930E36]/60 bg-black/20 flex items-center justify-between text-xs text-white/70">
          <span>Campus Bites Verified Community Reviews</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-[#4C1829] font-medium rounded-2xl hover:bg-white/95 transition-all uppercase tracking-wider text-xs shadow-md"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
