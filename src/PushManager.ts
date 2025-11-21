import { Events, Notice, requestUrl } from 'obsidian';
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';
import type MemoAIPlugin from '../main';
import { Chunk, ChunkManager } from './ChunkManager';
import { LLMService, PushResponseResult, PushConversationHistory } from './LLMService';
import { StoredPush, StoredPushMessage, PushState, PushEvaluation } from './pushTypes';

export class PushManager extends Events {
	private plugin: MemoAIPlugin;
	private chunkManager: ChunkManager;
	private pushes: Record<string, StoredPush> = {};
	private messages: StoredPushMessage[] = [];

	constructor(plugin: MemoAIPlugin, chunkManager: ChunkManager) {
		super();
		this.plugin = plugin;
		this.chunkManager = chunkManager;
		this.loadPushes();
	}

	private getMaxPushCount(): number {
		const value = Number(this.plugin.settings?.pushMaxActive ?? 5);
		return Math.max(1, Math.min(50, value));
	}

	private getPushDueDuration(): number {
		const hours = Number(this.plugin.settings?.pushDueHours ?? 24);
		const safeHours = isNaN(hours) ? 24 : Math.max(1, Math.min(720, hours));
		return safeHours * 60 * 60 * 1000;
	}

	private getOpenPushCount(): number {
		return Object.values(this.pushes).filter(p => p.state !== 'completed').length;
	}

	// Range from 0~7, the higher the score, the more likely the chunk will be pushed
	// Use ChunkManager's computeChunkScore method to ensure consistency
	private computeChunkScore(chunk: Chunk): number {
		return this.chunkManager.computeChunkScore(chunk);
	}

	private loadPushes() {
		this.pushes = { ...this.plugin.getStoredPushes() };
		this.messages = [...this.plugin.getStoredPushMessages()];
		const defaultDuration = this.getPushDueDuration();
		for (const push of Object.values(this.pushes)) {
			if (!push.expiresAt) {
				push.expiresAt = (push.createdAt || Date.now()) + defaultDuration;
			}
		}
	}

	private async persist() {
		await this.plugin.persistPushes(this.pushes, this.messages);
		this.trigger('push-updated');
	}

	getPushes(state: PushState | 'all' = 'all'): StoredPush[] {
		const list = Object.values(this.pushes);
		const filtered = state === 'all' ? list : list.filter(p => p.state === state);
		return filtered.sort((a, b) => b.createdAt - a.createdAt);
	}

	getPush(pushId: string): StoredPush | undefined {
		return this.pushes[pushId];
	}

	getMessages(pushId: string): StoredPushMessage[] {
		return this.messages
			.filter(msg => msg.pushId === pushId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	async deletePush(pushId: string) {
		if (!this.pushes[pushId]) return;
		delete this.pushes[pushId];
		this.messages = this.messages.filter(m => m.pushId !== pushId);
		await this.persist();
	}

	async deletePushesForChunk(chunkId: string) {
		let deleted = false;
		const pushIdsToDelete: string[] = [];
		
		// Find all pushes for this chunk
		for (const [pushId, push] of Object.entries(this.pushes)) {
			if (push.chunkId === chunkId) {
				pushIdsToDelete.push(pushId);
			}
		}
		
		// Delete all pushes for this chunk
		for (const pushId of pushIdsToDelete) {
			delete this.pushes[pushId];
			this.messages = this.messages.filter(m => m.pushId !== pushId);
			deleted = true;
		}
		
		if (deleted) {
			await this.persist();
		}
	}

	async refreshPushes(): Promise<{ deleted: number; created: number; kept: number }> {
		const now = Date.now();
		let changed = false;
		let deleted = 0;
		const initialCount = Object.keys(this.pushes).length;
		
		// Delete completed or expired pushes
		for (const [id, push] of Object.entries(this.pushes)) {
			if (push.state === 'completed' || (push.expiresAt && push.expiresAt < now)) {
				delete this.pushes[id];
				this.messages = this.messages.filter(m => m.pushId !== id);
				changed = true;
				deleted++;
			}
		}
		if (changed) {
			await this.persist();
		}
		
		const kept = Object.keys(this.pushes).length;
		const openCount = this.getOpenPushCount();
		const needed = this.getMaxPushCount() - openCount;
		let created = 0;
		if (needed > 0) {
			created = await this.schedulePushes(needed, false);
		}
		
		return { deleted, created, kept };
	}

	hasOpenPushForChunk(chunkId: string): boolean {
		return Object.values(this.pushes).some(p => p.chunkId === chunkId && (p.state === 'pending' || p.state === 'active'));
	}

	async schedulePushes(maxCount: number = this.getMaxPushCount(), debugMode: boolean = false): Promise<number> {
		const settings = this.plugin.settings;
		if (!settings?.llmApiKey) {
			new Notice('Configure LLM settings before scheduling pushes.');
			return 0;
		}

		const baseCandidates = this.chunkManager.getAllChunks().filter(c => {
			if (debugMode) return true;
			return c.needsReview;
		});

		const threshold = settings?.pushScoreThreshold ?? 0;
		
		// Calculate and save chunkScore for all candidates (even those that won't be selected)
		// This ensures all chunks have their latest score calculated
		const candidatesWithoutPush = baseCandidates.filter(chunk => !this.hasOpenPushForChunk(chunk.id));
		
		// Calculate scores for all candidates and update chunks
		for (const chunk of candidatesWithoutPush) {
			const score = this.computeChunkScore(chunk);
			// Explicitly set chunkScore to avoid triggering recalculation
			await this.chunkManager.updateChunk(chunk.id, { chunkScore: score });
		}
		
		const scoredCandidates = candidatesWithoutPush
			.map(chunk => ({
				chunk,
				score: chunk.chunkScore ?? this.computeChunkScore(chunk)
			}))
			.filter(item => item.score >= threshold)
			.sort((a, b) => b.score - a.score);

		const available = scoredCandidates
			.slice(0, Math.max(0, maxCount))
			.map(item => item.chunk);

		let created = 0;
		for (const chunk of available) {
			if (this.getOpenPushCount() >= this.getMaxPushCount()) {
				break;
			}
			const pushId = this.generateId();
			this.pushes[pushId] = {
				id: pushId,
				chunkId: chunk.id,
				state: 'pending',
				createdAt: Date.now(),
				expiresAt: Date.now() + this.getPushDueDuration(),
				lastQuestion: undefined
			};
			created += 1;
		}

		if (created > 0) {
			await this.persist();
		}

		return created;
	}

	async startConversation(pushId: string): Promise<string> {
		const push = this.pushes[pushId];
		if (!push) throw new Error('Push not found');
		if (push.state !== 'pending') throw new Error('Push already started');

		const chunk = this.chunkManager.getChunk(push.chunkId);
		if (!chunk) throw new Error('Chunk missing');

		const question = await this.generateQuestion(chunk);
		push.state = 'active';
		push.lastQuestion = question;
		this.messages.push(this.createMessage(pushId, 'system', question));
		await this.persist();
		return question;
	}

	async sendUserMessage(pushId: string, content: string): Promise<PushResponseResult> {
		const push = this.pushes[pushId];
		if (!push) throw new Error('Push not found');
		if (push.state === 'completed') throw new Error('Push already completed');

		const trimmed = content.trim();
		if (!trimmed) throw new Error('Empty message');

		const chunk = this.chunkManager.getChunk(push.chunkId);
		if (!chunk) throw new Error('Chunk missing');

		this.messages.push(this.createMessage(pushId, 'user', trimmed));
		const history: PushConversationHistory[] = this.getMessages(pushId).map(m => ({
			sender: m.sender,
			content: m.content
		}));

		const response = await this.generateResponse(chunk, history);
		this.messages.push(this.createMessage(pushId, 'system', response.response));

		// Only apply evaluation if conversation should end AND push is still active
		// (to avoid double evaluation if user clicks "End conversation" after AI already ended)
		if (response.shouldEnd && response.evaluation && push.state === 'active') {
			await this.applyEvaluation(push, chunk, response.evaluation);
		}

		await this.persist();
		return response;
	}

	async manualEvaluate(pushId: string, grade: number, recommendation?: string) {
		const push = this.pushes[pushId];
		if (!push) throw new Error('Push not found');
		const chunk = this.chunkManager.getChunk(push.chunkId);
		if (!chunk) throw new Error('Chunk missing');

		const safeGrade = Math.max(0, Math.min(5, Math.round(grade)));
		await this.applyEvaluation(push, chunk, {
			grade: safeGrade,
			recommendation: recommendation || (safeGrade >= 3 ? 'Great job! Keep going.' : 'Needs more practice.')
		});
		await this.persist();
	}

	async forceAutoEvaluate(pushId: string) {
		const push = this.pushes[pushId];
		if (!push) throw new Error('Push not found');
		if (push.state !== 'active') {
			// If push is already completed, don't evaluate again
			return;
		}
		const chunk = this.chunkManager.getChunk(push.chunkId);
		if (!chunk) throw new Error('Chunk missing');
		const history: PushConversationHistory[] = this.getMessages(push.id).map(m => ({
			sender: m.sender,
			content: m.content
		}));
		const result = await this.generateResponse(chunk, history, true);
		if (result.response) {
			this.messages.push(this.createMessage(pushId, 'system', result.response));
		}
		// Only apply evaluation if push is still active (to avoid double evaluation)
		if (result.shouldEnd && result.evaluation && push.state === 'active') {
			await this.applyEvaluation(push, chunk, result.evaluation);
		}
		await this.persist();
	}

	private async applyEvaluation(push: StoredPush, chunk: Chunk, evaluation: PushEvaluation) {
		// Ensure grade is a valid number between 0 and 5
		let grade = evaluation.grade !== undefined && evaluation.grade !== null
			? Math.max(0, Math.min(5, Math.round(evaluation.grade)))
			: 3; // Default to 3 if grade is missing
		
		const updatedChunk = await this.chunkManager.reviewChunk(chunk.id, grade);
		
		push.state = 'completed';
		push.evaluation = {
			grade: grade,
			recommendation: evaluation.recommendation,
			nextDueAt: updatedChunk?.dueAt,
			confidence: evaluation.confidence
		};
		// Note: persist() and trigger('push-updated') are called by the caller
	}

	private createMessage(pushId: string, sender: StoredPushMessage['sender'], content: string): StoredPushMessage {
		return {
			id: this.generateId(),
			pushId,
			sender,
			content,
			createdAt: Date.now()
		};
	}

	private generateId(): string {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	private getLLMConfig() {
		const settings = this.plugin.settings;
		return {
			apiKey: settings.llmApiKey,
			apiBase: settings.llmApiBase,
			model: settings.llmModel,
			timeout: (settings.llmTimeout || 60) * 1000, // Convert seconds to milliseconds
			requestUrl: (param: RequestUrlParam): Promise<RequestUrlResponse> => requestUrl(param)
		};
	}

	private async generateQuestion(chunk: Chunk): Promise<string> {
		try {
			const llm = new LLMService(this.getLLMConfig());
			return await llm.generatePushQuestion({
				chunkContent: chunk.content,
				familiarScore: chunk.familiarScore || 0,
				language: 'zh'
			});
		} catch (e: unknown) {
			console.error('Failed to generate push question', e);
			return `请解释以下内容：${chunk.content.slice(0, 80)}...`;
		}
	}

	private async generateResponse(chunk: Chunk, history: PushConversationHistory[], forceEvaluate = false): Promise<PushResponseResult> {
		try {
			const llm = new LLMService(this.getLLMConfig());
			return await llm.generatePushResponse({
				chunkContent: chunk.content,
				familiarScore: chunk.familiarScore || 0,
				history,
				language: 'zh',
				forceEvaluate
			});
		} catch (e: unknown) {
			console.error('Failed to generate push response', e);
			return {
				response: '我暂时无法处理这个问题，请稍后再试。',
				shouldEnd: false
			};
		}
	}
}
