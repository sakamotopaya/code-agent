import { ZodError } from "zod"
import { type TelemetryClient, type TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"

/**
 * Interface for telemetry services
 * Provides abstraction for both VSCode and CLI telemetry implementations
 */
export interface ITelemetryService {
	register(client: TelemetryClient): void
	setProvider(provider: TelemetryPropertiesProvider): void
	updateTelemetryState(didUserOptIn: boolean): void
	captureEvent(eventName: TelemetryEventName, properties?: Record<string, any>): void
	captureTaskCreated(taskId: string): void
	captureTaskRestarted(taskId: string): void
	captureTaskCompleted(taskId: string): void
	captureConversationMessage(taskId: string, source: "user" | "assistant"): void
	captureLlmCompletion(
		taskId: string,
		properties: {
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			cost?: number
		},
	): void
	captureModeSwitch(taskId: string, newMode: string): void
	captureToolUsage(taskId: string, tool: string): void
	captureCheckpointCreated(taskId: string): void
	captureCheckpointDiffed(taskId: string): void
	captureCheckpointRestored(taskId: string): void
	captureContextCondensed(
		taskId: string,
		isAutomaticTrigger: boolean,
		usedCustomPrompt?: boolean,
		usedCustomApiHandler?: boolean,
	): void
	captureSlidingWindowTruncation(taskId: string): void
	captureCodeActionUsed(actionType: string): void
	capturePromptEnhanced(taskId?: string): void
	captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void
	captureDiffApplicationError(taskId: string, consecutiveMistakeCount: number): void
	captureShellIntegrationError(taskId: string): void
	captureConsecutiveMistakeError(taskId: string): void
	captureTitleButtonClicked(button: string): void
	isTelemetryEnabled(): boolean
	shutdown(): Promise<void>
}
