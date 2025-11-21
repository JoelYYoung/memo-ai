import * as React from 'react';

interface SignalGradeProps {
	value: number;
	onChange: (value: number) => void;
	max?: number;
}

export const SignalGrade: React.FC<SignalGradeProps> = ({ value, onChange, max = 5 }) => {
	const getBarHeight = (index: number) => {
		const percentage = ((index + 1) / (max + 1)) * 100;
		return `${Math.max(20, percentage)}%`;
	};

	return (
		<div className="ai-notebook-signal-grade">
			<div className="ai-notebook-signal-grade-label">评分：</div>
			<div className="ai-notebook-signal-bars">
				{Array.from({ length: max + 1 }, (_, i) => (
					<button
						key={i}
						type="button"
						className={`ai-notebook-signal-bar ${i <= value ? 'active' : ''}`}
						onClick={() => onChange(i)}
						aria-label={`Grade ${i}`}
					>
						<div 
							className="ai-notebook-signal-bar-fill"
							style={{ height: getBarHeight(i) }}
						/>
					</button>
				))}
			</div>
			<div className="ai-notebook-signal-grade-value">{value} / {max}</div>
		</div>
	);
};

