import { useState } from 'react';
import { Star } from 'lucide-react';

export interface RatingStarsProps {
  rating: number;
  maxStars?: number;
  size?: number;
  showScore?: boolean;
  showCount?: boolean;
  reviewCount?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  starColor?: string;
}

export default function RatingStars({
  rating,
  maxStars = 5,
  size = 14,
  showScore = false,
  showCount = false,
  reviewCount,
  interactive = false,
  onRatingChange,
  className = '',
  starColor = 'text-amber-400 fill-amber-400'
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const starValue = i + 1;
          const isFilled = displayRating >= starValue;
          const isHalf = !isFilled && displayRating >= starValue - 0.75;

          return (
            <div
              key={starValue}
              className={`relative flex items-center justify-center ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
              onMouseEnter={() => interactive && setHoverRating(starValue)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              onClick={() => interactive && onRatingChange && onRatingChange(starValue)}
            >
              {/* Full Star */}
              {isFilled ? (
                <Star size={size} className={starColor} />
              ) : isHalf ? (
                /* Half Star with layered clip */
                <div className="relative inline-block" style={{ width: size, height: size }}>
                  <Star size={size} className="text-white/20 fill-white/10" />
                  <div className="absolute inset-0 overflow-hidden w-[50%]">
                    <Star size={size} className={starColor} />
                  </div>
                </div>
              ) : (
                /* Empty Star */
                <Star size={size} className="text-white/25 fill-white/5" />
              )}
            </div>
          );
        })}
      </div>

      {showScore && (
        <span className="text-xs font-semibold text-white ml-1">
          {Number(rating).toFixed(1)}
        </span>
      )}

      {showCount && reviewCount !== undefined && (
        <span className="text-[11px] text-white/60 ml-0.5">
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
