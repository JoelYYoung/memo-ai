import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Chunk } from '../../ChunkManager';
import type MemoAIPlugin from '../../../main';
import { ChunkCard } from './ChunkCard';

interface NoteChunksViewProps {
	plugin: MemoAIPlugin;
	currentNotePath: string | null;
}

export const NoteChunksViewComponent: React.FC<NoteChunksViewProps> = ({ plugin, currentNotePath }) => {
	const [chunks, setChunks] = useState<Chunk[]>([]);
	const [isExtracting, setIsExtracting] = useState(false);

	const loadChunks = useCallback(() => {
		if (currentNotePath) {
			const noteChunks = plugin.chunkManager.getChunksByNotePath(currentNotePath);
			setChunks(noteChunks);
		} else {
			setChunks([]);
		}
	}, [plugin, currentNotePath]);

	useEffect(() => {
		loadChunks();
	}, [loadChunks]);

	useEffect(() => {
		const handler = () => loadChunks();
		if (plugin.pushManager) {
			plugin.pushManager.on('push-updated', handler);
		}
		// Trigger reload when chunks are updated
		return () => {
			if (plugin.pushManager) {
				plugin.pushManager.off('push-updated', handler);
			}
		};
	}, [plugin, loadChunks]);

	const handleExtract = async () => {
		setIsExtracting(true);
		try {
			await plugin.chunkManager.extractChunksFromActiveNote(true);
			loadChunks();
		} finally {
			setIsExtracting(false);
		}
	};

	const handleDelete = async (chunkId: string) => {
		await plugin.chunkManager.deleteChunk(chunkId);
		loadChunks();
	};

	const handleToggleReview = async (chunk: Chunk) => {
		await plugin.chunkManager.updateChunk(chunk.id, { needsReview: !chunk.needsReview });
		// Trigger push update to sync
		if (plugin.pushManager) {
			plugin.pushManager.trigger('push-updated');
		}
		loadChunks();
	};

	const handleChangeImportance = async (chunk: Chunk, newLevel: 'low' | 'medium' | 'high') => {
		if (chunk.importanceLevel !== newLevel) {
			await plugin.chunkManager.updateChunk(chunk.id, { importanceLevel: newLevel });
			// Trigger push update to sync
			if (plugin.pushManager) {
				plugin.pushManager.trigger('push-updated');
			}
			loadChunks();
		}
	};

	const getFamiliarityColor = (percentage: number): string => {
		if (percentage < 30) return '#ff4d4f';
		if (percentage < 60) return '#faad14';
		if (percentage < 80) return '#52c41a';
		return '#1890ff';
	};

	const formatDate = (timestamp?: number): string => {
		if (!timestamp) return 'unknown';
		const date = new Date(timestamp);
		if (isNaN(date.getTime())) return 'unknown';
		return date.toLocaleString();
	};

	if (!currentNotePath) {
		return (
			<div className="ai-notebook-note-chunks-view">
				<p>Open a note to view its chunks</p>
			</div>
		);
	}

	return (
		<div className="ai-notebook-note-chunks-view">
			<div className="ai-notebook-note-chunks-header">
				<h2>Chunks ({chunks.length})</h2>
				<button 
					onClick={() => void handleExtract()} 
					disabled={isExtracting}
					className={isExtracting ? 'loading' : ''}
				>
					{isExtracting ? 'Extracting...' : 'Extract Chunks'}
				</button>
			</div>

			{chunks.length === 0 ? (
				<p className="ai-notebook-empty-state">
					No chunks extracted yet. Click "Extract Chunks" to extract chunks from this note.
				</p>
			) : (
				<div className="ai-notebook-chunks-list">
					{chunks.map((chunk, index) => (
						<ChunkCard
							key={chunk.id}
							chunk={chunk}
							showIndex={true}
							index={index}
							total={chunks.length}
							onDelete={(chunkId) => { void handleDelete(chunkId); }}
							onToggleReview={(chunk) => { void handleToggleReview(chunk); }}
							onChangeImportance={(chunk, newLevel) => { void handleChangeImportance(chunk, newLevel); }}
							getFamiliarityColor={getFamiliarityColor}
							formatDate={formatDate}
						/>
					))}
				</div>
			)}
		</div>
	);
};

