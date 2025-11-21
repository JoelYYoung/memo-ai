export type PushState = 'pending' | 'active' | 'completed';

export interface PushEvaluation {
	grade: number;
	recommendation: string;
	nextDueAt?: number;
	confidence?: number;
}

export interface StoredPush {
	id: string;
	chunkId: string;
	state: PushState;
	createdAt: number;
	expiresAt?: number;
	lastQuestion?: string;
	evaluation?: PushEvaluation;
}

export type PushMessageSender = 'system' | 'user';

export interface StoredPushMessage {
	id: string;
	pushId: string;
	sender: PushMessageSender;
	content: string;
	createdAt: number;
}
