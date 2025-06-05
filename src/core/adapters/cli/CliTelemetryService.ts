import { ZodError } from "zod"
import { type TelemetryClient, type TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"
import { ITelemetryService } from "../../interfaces/ITelemetryService"

/**
 * CLI implementation of telemetry service
 * Provides minimal logging for CLI environments
 */
export class CliTelemetryService implements ITelemetryService {
	private enabled: boolean = false
	private verbose: boolean = false

	constructor(options: { enabled?: boolean; verbose?: boolean } = {}) {
		this.enabled = options.enabled ?? false
		this.verbose = options.verbose ?? false
	}

	register(client: TelemetryClient): void {
		// CLI doesn't register external telemetry clients
		if (this.verbose) {
			console.log("[CLI Telemetry] Client registration skipped in CLI mode")
		}
	}

	setProvider(provider: TelemetryPropertiesProvider): void {
		// CLI doesn't use providers
		if (this.verbose) {
			console.log("[CLI Telemetry] Provider setting skipped in CLI mode")
		}
	}

	updateTelemetryState(didUserOptIn: boolean): void {
		this.enabled = didUserOptIn
		if (this.verbose) {
			console.log(`[CLI Telemetry] Telemetry state updated: ${this.enabled ? "enabled" : "disabled"}`)
		}
	}

	captureEvent(eventName: TelemetryEventName, properties?: Record<string, any>): void {
		if (!this.enabled) return

		if (this.verbose) {
			console.log(`[CLI Telemetry] Event: ${eventName}`, properties ? JSON.stringify(properties, null, 2) : "")
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
			...(usedCustomPrompt !== undefined && { usedCustomPrompt }),
			...(usedCustomApiHandler !== undefined && { usedCustomApiHandler }),
		})
	}

	captureSlidingWindowTruncation(taskId: string): void {
		this.captureEvent(TelemetryEventName.SLIDING_WINDOW_TRUNCATION, { taskId })
	}

	captureCodeActionUsed(actionType: string): void {
		this.captureEvent(TelemetryEventName.CODE_ACTION_USED, { actionType })
	}

	capturePromptEnhanced(taskId?: string): void {
		this.captureEvent(TelemetryEventName.PROMPT_ENHANCED, { ...(taskId && { taskId }) })
	}

	captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void {
		this.captureEvent(TelemetryEventName.SCHEMA_VALIDATION_ERROR, { schemaName, error: error.format() })
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
		return this.enabled
	}

	async shutdown(): Promise<void> {
		if (this.verbose) {
			console.log("[CLI Telemetry] Telemetry service shutdown")
		}
	}
}
