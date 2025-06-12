import { ITelemetryService } from "../../interfaces"
import { ZodError } from "zod"
import { type TelemetryClient, type TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"

export interface ApiTelemetryOptions {
	enabled?: boolean
	verbose?: boolean
}

export class ApiTelemetryService implements ITelemetryService {
	private options: ApiTelemetryOptions
	private client?: TelemetryClient
	private provider?: TelemetryPropertiesProvider

	constructor(options: ApiTelemetryOptions = {}) {
		this.options = {
			enabled: false,
			verbose: false,
			...options,
		}
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Telemetry] ${message}`)
		}
	}

	register(client: TelemetryClient): void {
		this.client = client
		this.log("Telemetry client registered")
	}

	setProvider(provider: TelemetryPropertiesProvider): void {
		this.provider = provider
		this.log("Telemetry provider set")
	}

	updateTelemetryState(didUserOptIn: boolean): void {
		this.options.enabled = didUserOptIn
		this.log(`Telemetry state updated: ${didUserOptIn}`)
	}

	captureEvent(eventName: TelemetryEventName, properties?: Record<string, any>): void {
		if (this.options.enabled) {
			this.log(`Event: ${eventName} ${properties ? JSON.stringify(properties) : ""}`)
		}
	}

	captureTaskCreated(taskId: string): void {
		this.captureEvent("task_created" as TelemetryEventName, { taskId })
	}

	captureTaskRestarted(taskId: string): void {
		this.captureEvent("task_restarted" as TelemetryEventName, { taskId })
	}

	captureTaskCompleted(taskId: string): void {
		this.captureEvent("task_completed" as TelemetryEventName, { taskId })
	}

	captureConversationMessage(taskId: string, source: "user" | "assistant"): void {
		this.captureEvent("conversation_message" as TelemetryEventName, { taskId, source })
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
		this.captureEvent("llm_completion" as TelemetryEventName, { taskId, ...properties })
	}

	captureModeSwitch(taskId: string, newMode: string): void {
		this.captureEvent("mode_switch" as TelemetryEventName, { taskId, newMode })
	}

	captureToolUsage(taskId: string, tool: string): void {
		this.captureEvent("tool_usage" as TelemetryEventName, { taskId, tool })
	}

	captureCheckpointCreated(taskId: string): void {
		this.captureEvent("checkpoint_created" as TelemetryEventName, { taskId })
	}

	captureCheckpointDiffed(taskId: string): void {
		this.captureEvent("checkpoint_diffed" as TelemetryEventName, { taskId })
	}

	captureCheckpointRestored(taskId: string): void {
		this.captureEvent("checkpoint_restored" as TelemetryEventName, { taskId })
	}

	captureContextCondensed(
		taskId: string,
		isAutomaticTrigger: boolean,
		usedCustomPrompt?: boolean,
		usedCustomApiHandler?: boolean,
	): void {
		this.captureEvent("context_condensed" as TelemetryEventName, {
			taskId,
			isAutomaticTrigger,
			usedCustomPrompt,
			usedCustomApiHandler,
		})
	}

	captureSlidingWindowTruncation(taskId: string): void {
		this.captureEvent("sliding_window_truncation" as TelemetryEventName, { taskId })
	}

	captureCodeActionUsed(actionType: string): void {
		this.captureEvent("code_action_used" as TelemetryEventName, { actionType })
	}

	capturePromptEnhanced(taskId?: string): void {
		this.captureEvent("prompt_enhanced" as TelemetryEventName, { taskId })
	}

	captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void {
		this.captureEvent("schema_validation_error" as TelemetryEventName, {
			schemaName,
			error: error.message,
		})
	}

	captureDiffApplicationError(taskId: string, consecutiveMistakeCount: number): void {
		this.captureEvent("diff_application_error" as TelemetryEventName, { taskId, consecutiveMistakeCount })
	}

	captureShellIntegrationError(taskId: string): void {
		this.captureEvent("shell_integration_error" as TelemetryEventName, { taskId })
	}

	captureConsecutiveMistakeError(taskId: string): void {
		this.captureEvent("consecutive_mistake_error" as TelemetryEventName, { taskId })
	}

	captureTitleButtonClicked(button: string): void {
		this.captureEvent("title_button_clicked" as TelemetryEventName, { button })
	}

	isTelemetryEnabled(): boolean {
		return this.options.enabled ?? false
	}

	async shutdown(): Promise<void> {
		this.log("Telemetry shutdown")
	}
}
