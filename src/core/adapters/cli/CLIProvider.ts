import { CoreProvider } from "../../provider/CoreProvider"
import { CLIProviderContext } from "./CLIProviderContext"
import { CLIOutputAdapter } from "./CLIOutputAdapters"
import { ITelemetryService } from "../../interfaces/ITelemetryService"

export interface CLIProviderOptions {
	globalStoragePath?: string
	workspacePath?: string
	extensionPath?: string
	useColor?: boolean
	telemetry?: ITelemetryService
}

/**
 * CLI implementation of CoreProvider
 * Provides all ClineProvider functionality for CLI mode
 */
export class CLIProvider extends CoreProvider {
	constructor(options: CLIProviderOptions = {}) {
		// Create CLI-specific context
		const context = new CLIProviderContext({
			globalStoragePath: options.globalStoragePath,
			workspacePath: options.workspacePath,
			extensionPath: options.extensionPath,
		})

		// Create CLI-specific output adapter
		const outputAdapter = new CLIOutputAdapter(context.getGlobalStoragePath(), options.useColor ?? true)

		// Use provided telemetry or create a no-op service
		const telemetry =
			options.telemetry ||
			({
				register: () => {},
				setProvider: () => {},
				updateTelemetryState: () => {},
				captureEvent: () => {},
				captureTaskCreated: () => {},
				captureTaskRestarted: () => {},
				captureTaskCompleted: () => {},
				captureConversationMessage: () => {},
				captureLlmCompletion: () => {},
				captureModeSwitch: () => {},
				captureToolUsage: () => {},
				captureCheckpointCreated: () => {},
				captureCheckpointDiffed: () => {},
				captureCheckpointRestored: () => {},
				captureContextCondensed: () => {},
				captureSlidingWindowTruncation: () => {},
				captureCodeActionUsed: () => {},
				capturePromptEnhanced: () => {},
				captureSchemaValidationError: () => {},
				captureDiffApplicationError: () => {},
				captureShellIntegrationError: () => {},
				captureConsecutiveMistakeError: () => {},
				captureTitleButtonClicked: () => {},
				isTelemetryEnabled: () => false,
				shutdown: async () => {},
			} as ITelemetryService)

		super(context, outputAdapter, telemetry)
	}

	async initialize(): Promise<void> {
		// Initialize the context (loads state and config)
		if (this.context.initialize) {
			await this.context.initialize()
		}

		// Initialize any CLI-specific services
		// MCP hub, settings managers, etc. could be initialized here
		console.log("[CLIProvider] Initialized successfully")
	}

	// CLI-specific helper methods
	async showStatus(): Promise<void> {
		const state = await this.getState()
		const currentTask = this.getCurrentTask()

		console.log("\n📊 CLI Agent Status:")
		console.log(`   Mode: ${state.mode}`)
		console.log(`   API Provider: ${state.apiConfiguration?.apiProvider || "Not configured"}`)
		console.log(`   Tasks in history: ${state.taskHistory?.length || 0}`)
		console.log(`   Current task: ${currentTask ? `${currentTask.taskId} (${currentTask.instanceId})` : "None"}`)
		console.log(`   Task stack size: ${this.getTaskStackSize()}`)
		console.log(`   Features: Diff=${state.diffEnabled}, Checkpoints=${state.enableCheckpoints}`)
		console.log("")
	}

	async showTaskHistory(limit: number = 10): Promise<void> {
		const state = await this.getState()
		const history = state.taskHistory || []

		console.log(`\n📝 Recent Tasks (showing ${Math.min(limit, history.length)} of ${history.length}):\n`)

		for (let i = 0; i < Math.min(limit, history.length); i++) {
			const item = history[i]
			const date = new Date(item.ts).toLocaleDateString()
			const taskPreview = item.task?.substring(0, 60) || item.id
			console.log(`   ${i + 1}. [${date}] ${taskPreview}${(item.task?.length || 0) > 60 ? "..." : ""}`)
		}
		console.log("")
	}

	async clearHistory(): Promise<void> {
		await this.updateGlobalState("taskHistory", [])
		console.log("✅ Task history cleared")
	}

	// Override log method for CLI-specific formatting
	protected override log(message: string, ...args: any[]): void {
		console.log(`[CLI] ${message}`, ...args)
	}
}
