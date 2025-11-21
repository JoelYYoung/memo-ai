import * as React from 'react';

interface ReviewToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
}

export const ReviewToggle: React.FC<ReviewToggleProps> = ({ checked, onChange }) => {
	return (
		<div className="ai-notebook-review-toggle">
			<label className="ai-notebook-review-toggle-label">
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					className="ai-notebook-review-toggle-input"
				/>
				<span className="ai-notebook-review-toggle-slider" />
				<span className="ai-notebook-review-toggle-text">
					{checked ? 'Needs Review' : 'No Review'}
				</span>
			</label>
		</div>
	);
};

