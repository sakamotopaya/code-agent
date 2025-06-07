import { ZodError } from "zod"
import * as vscode from "vscode"
import { type TelemetryClient, type TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"
import { ITelemetryService } from "../../interfaces/ITelemetryService"

/**
 * VSCode implementation of telemetry service
 * Uses VSCode's built-in telemetry infrastructure
 */
export class VsCodeTelemetryService implements ITelemetryService {
	private clients: TelemetryClient[] = []
	private provider?: TelemetryPropertiesProvider
	private enabled: boolean = true

	constructor(private context: vscode.ExtensionContext) {
		// Check VSCode telemetry settings
		this.enabled = vscode.env.isTelemetryEnabled
	}

	register(client: TelemetryClient): void {
		this.clients.push(client)
	}

	setProvider(provider: TelemetryPropertiesProvider): void {
		this.provider = provider
	}

	updateTelemetryState(didUserOptIn: boolean): void {
		this.enabled = didUserOptIn && vscode.env.isTelemetryEnabled
	}

	captureEvent(eventName: TelemetryEventName, properties?: Record<string, any>): void {
		if (!this.enabled) return

		// Send to registered clients
		for (const client of this.clients) {
			try {
				// Use the client's capture method from TelemetryClient interface
				client
					.capture({
						event: eventName,
						properties,
					})
					.catch((error) => {
						console.warn("Failed to send telemetry event:", error)
					})
			} catch (error) {
				console.warn("Failed to send telemetry event:", error)
			}
		}
	}

	captureTaskCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_CREATED, { taskId })
	}

	captureTaskRestarted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_RESTARTED, { taskId })
	}

	captureTaskCompleted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_COMPLETED, { taskId })
	}

	captureConversationMessage(taskId: string, source: "user" | "assistant"): void {
		this.captureEvent(TelemetryEventName.TASK_CONVERSATION_MESSAGE, { taskId, source })
	}

	captureLlmCompletion(
		taskId: string,
		properties: {
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			cost?: number
		},
	): void {
		this.captureEvent(TelemetryEventName.LLM_COMPLETION, { taskId, ...properties })
	}

	captureModeSwitch(taskId: string, newMode: string): void {
		this.captureEvent(TelemetryEventName.MODE_SWITCH, { taskId, newMode })
	}

	captureToolUsage(taskId: string, tool: string): void {
		this.captureEvent(TelemetryEventName.TOOL_USED, { taskId, tool })
	}

	captureCheckpointCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_CREATED, { taskId })
	}

	captureCheckpointDiffed(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_DIFFED, { taskId })
	}

	captureCheckpointRestored(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_RESTORED, { taskId })
	}

	captureContextCondensed(
		taskId: string,
		isAutomaticTrigger: boolean,
		usedCustomPrompt?: boolean,
		usedCustomApiHandler?: boolean,
	): void {
		this.captureEvent(TelemetryEventName.CONTEXT_CONDENSED, {
			taskId,
			isAutomaticTrigger,
			usedCustomPrompt,
			usedCustomApiHandler,
		})
	}

	captureSlidingWindowTruncation(taskId: string): void {
		this.captureEvent(TelemetryEventName.SLIDING_WINDOW_TRUNCATION, { taskId })
	}

	captureCodeActionUsed(actionType: string): void {
		this.captureEvent(TelemetryEventName.CODE_ACTION_USED, { actionType })
	}

	capturePromptEnhanced(taskId?: string): void {
		this.captureEvent(TelemetryEventName.PROMPT_ENHANCED, { taskId })
	}

	captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void {
		this.captureEvent(TelemetryEventName.SCHEMA_VALIDATION_ERROR, {
			schemaName,
			errorMessage: error.message,
			issues: error.issues,
		})
	}

	captureDiffApplicationError(taskId: string, consecutiveMistakeCount: number): void {
		this.captureEvent(TelemetryEventName.DIFF_APPLICATION_ERROR, { taskId, consecutiveMistakeCount })
	}

	captureShellIntegrationError(taskId: string): void {
		this.captureEvent(TelemetryEventName.SHELL_INTEGRATION_ERROR, { taskId })
	}

	captureConsecutiveMistakeError(taskId: string): void {
		this.captureEvent(TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR, { taskId })
	}

	captureTitleButtonClicked(button: string): void {
		this.captureEvent(TelemetryEventName.TITLE_BUTTON_CLICKED, { button })
	}

	isTelemetryEnabled(): boolean {
		return this.enabled && vscode.env.isTelemetryEnabled
	}

	async shutdown(): Promise<void> {
		// Clean up clients
		this.clients.length = 0
		this.provider = undefined
	}
}
