import * as React from 'react';
import { Chunk } from '../../ChunkManager';
import { StarRating } from './StarRating';
import { ReviewToggle } from './ReviewToggle';

interface ChunkCardProps {
	chunk: Chunk;
	showIndex?: boolean;
	index?: number;
	total?: number;
	onDelete?: (chunkId: string) => void;
	onToggleReview?: (chunk: Chunk) => void;
	onChangeImportance?: (chunk: Chunk, newLevel: 'low' | 'medium' | 'high') => void;
	getFamiliarityColor: (percentage: number) => string;
	formatDate: (timestamp?: number) => string;
}

export const ChunkCard: React.FC<ChunkCardProps> = ({
	chunk,
	showIndex = false,
	index,
	total,
	onDelete,
	onToggleReview,
	onChangeImportance,
	getFamiliarityColor,
	formatDate
}) => {
	const percentage = Math.min(100, Math.max(0, (chunk.familiarScore || 0) * 100));
	
	// Format date as YYYY-MM-DD
	const formatDateOnly = (timestamp?: number): string => {
		if (!timestamp) return 'unknown';
		const date = new Date(timestamp);
		if (isNaN(date.getTime())) return 'unknown';
		return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
	};

	return (
		<div className="ai-notebook-chunk-card">
			<div className="ai-notebook-chunk-card-header">
				<div className="ai-notebook-chunk-badges">
					<div className="ai-notebook-importance-rating">
						<span className="ai-notebook-importance-label">Importance: </span>
						<StarRating 
							level={chunk.importanceLevel}
							onChange={onChangeImportance ? (newLevel) => {
								if (newLevel !== chunk.importanceLevel) {
									onChangeImportance(chunk, newLevel);
								}
							} : undefined}
						/>
					</div>
					{onToggleReview && (
						<ReviewToggle
							checked={chunk.needsReview}
							onChange={(checked) => {
								if (checked !== chunk.needsReview) {
									onToggleReview(chunk);
								}
							}}
						/>
					)}
				</div>
				{onDelete && (
					<button
						className="ai-notebook-chunk-delete"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(chunk.id);
						}}
					>
						×
					</button>
				)}
			</div>

			<div className="ai-notebook-chunk-content">
				{chunk.content}
			</div>

			<div className="ai-notebook-chunk-footer">
				<div className="ai-notebook-chunk-footer-info">
					<div className="ai-notebook-chunk-info-item">
						<span className="ai-notebook-info-label">Created At: </span>
						<span>{formatDateOnly(chunk.createdAt)}</span>
					</div>
					<div className="ai-notebook-chunk-info-item">
						<span className="ai-notebook-info-label">Familiarity: </span>
						<span>{percentage.toFixed(0)}%</span>
					</div>
					<div className="ai-notebook-chunk-info-item">
						<span className="ai-notebook-info-label">Review Interval: </span>
						<span>{chunk.sm2IntervalDays} days</span>
					</div>
					<div className="ai-notebook-chunk-info-item">
						<span className="ai-notebook-info-label">Review Count: </span>
						<span>{chunk.sm2Repetitions}</span>
					</div>
					<div className="ai-notebook-chunk-info-item">
						<span className="ai-notebook-info-label">Chunk Score: </span>
						<span>{chunk.chunkScore !== undefined ? chunk.chunkScore.toFixed(2) : 'N/A'}</span>
					</div>
				</div>
			</div>
		</div>
	);
};

