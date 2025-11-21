import * as React from 'react';
import { useState } from 'react';

interface StarRating5Props {
	value: number;
	onChange: (value: number) => void;
	readonly?: boolean;
}

export const StarRating5: React.FC<StarRating5Props> = ({ value, onChange, readonly = false }) => {
	const [hoveredStars, setHoveredStars] = useState<number | null>(null);
	
	const currentStars = hoveredStars !== null ? hoveredStars : value;
	
	const handleStarClick = (starIndex: number) => {
		if (!readonly) {
			onChange(starIndex);
		}
	};
	
	return (
		<div 
			className="ai-notebook-star-rating-5"
			onMouseLeave={() => !readonly && setHoveredStars(null)}
		>
			{[1, 2, 3, 4, 5].map((i) => (
				<span
					key={i}
					className={`ai-notebook-star-5 ${i <= currentStars ? 'filled' : 'empty'}`}
					onMouseEnter={() => !readonly && setHoveredStars(i)}
					onClick={() => handleStarClick(i)}
					style={{ cursor: readonly ? 'default' : 'pointer' }}
				>
					★
				</span>
			))}
		</div>
	);
};

