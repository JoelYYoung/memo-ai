import { WorkspaceLeaf } from 'obsidian';
import { ReactView } from '../react/ReactView';
import { NoteChunksViewComponent } from '../react/components/NoteChunksView';
import type MemoAIPlugin from '../../main';

export const VIEW_TYPE_NOTE_CHUNKS = "ai-notebook-note-chunks";

export class NoteChunksView extends ReactView {
	private plugin: MemoAIPlugin;
	private currentNotePath: string | null = null;
	private onFileOpenHandler = () => this.onFileOpen();

	constructor(leaf: WorkspaceLeaf, plugin: MemoAIPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_NOTE_CHUNKS;
	}

	getDisplayText() {
		return "Note Chunks";
	}

	getIcon() {
		return "file-text";
	}

	async onOpen() {
		this.app.workspace.on('file-open', this.onFileOpenHandler);
		this.onFileOpen();
		await super.onOpen();
	}

	async onClose() {
		this.app.workspace.off('file-open', this.onFileOpenHandler);
		await super.onClose();
	}

	onFileOpen = () => {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			this.currentNotePath = activeFile.path;
			this.renderReact();
		} else {
			this.currentNotePath = null;
			this.renderReact();
		}
	}

	renderReact() {
		this.renderComponent(
			<NoteChunksViewComponent
				plugin={this.plugin}
				currentNotePath={this.currentNotePath}
			/>
		);
	}
}

