import * as React from 'react';
import { useState } from 'react';

interface StarRatingProps {
	level: 'low' | 'medium' | 'high';
	onChange?: (level: 'low' | 'medium' | 'high') => void;
	className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({ level, onChange, className = '' }) => {
	const [hoveredStars, setHoveredStars] = useState<number | null>(null);
	
	const levelToStars = (l: 'low' | 'medium' | 'high') => {
		return l === 'low' ? 1 : l === 'medium' ? 2 : 3;
	};
	
	const starsToLevel = (s: number): 'low' | 'medium' | 'high' => {
		return s === 1 ? 'low' : s === 2 ? 'medium' : 'high';
	};
	
	const currentStars = hoveredStars !== null ? hoveredStars : levelToStars(level);
	const isInteractive = !!onChange;
	
	const handleStarClick = (starIndex: number) => {
		if (onChange) {
			onChange(starsToLevel(starIndex));
		}
	};
	
	return (
		<div 
			className={`ai-notebook-star-rating ${className}`}
			style={{ cursor: isInteractive ? 'pointer' : 'default' }}
			onMouseLeave={() => setHoveredStars(null)}
		>
			{[1, 2, 3].map((i) => (
				<span
					key={i}
					className={`ai-notebook-star ${i <= currentStars ? 'filled' : 'empty'}`}
					onMouseEnter={() => isInteractive && setHoveredStars(i)}
					onClick={() => isInteractive && handleStarClick(i)}
					style={{ cursor: isInteractive ? 'pointer' : 'default' }}
				>
					★
				</span>
			))}
		</div>
	);
};

