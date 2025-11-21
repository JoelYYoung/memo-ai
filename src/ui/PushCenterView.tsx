import { WorkspaceLeaf } from 'obsidian';
import { ReactView } from '../react/ReactView';
import { PushCenterViewComponent } from '../react/components/PushCenterView';
import type MemoAIPlugin from '../../main';

export const VIEW_TYPE_PUSH_CENTER = "ai-notebook-push-center";

export class PushCenterView extends ReactView {
	private plugin: MemoAIPlugin;
	private rerenderHandler = () => this.renderReact();

	constructor(leaf: WorkspaceLeaf, plugin: MemoAIPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_PUSH_CENTER;
	}

	getDisplayText() {
		return "Push center";
	}

	getIcon() {
		return "message-square";
	}

	async onOpen() {
		this.plugin.pushManager.on('push-updated', this.rerenderHandler);
		await super.onOpen();
	}

	async onClose() {
		this.plugin.pushManager.off('push-updated', this.rerenderHandler);
		await super.onClose();
	}

	renderReact() {
		this.renderComponent(
			<PushCenterViewComponent plugin={this.plugin} />
		);
	}
}

