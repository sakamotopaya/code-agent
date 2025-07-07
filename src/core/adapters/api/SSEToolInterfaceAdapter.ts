import type {
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolResponse,
	ToolParamName,
} from "../../../shared/tools"
import type { ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"
import { TaskApiHandler } from "../../task/TaskApiHandler"
import { ToolInterfaceAdapter } from "../ToolInterfaceAdapter"

/**
 * SSE-specific implementation of tool interface adapter
 * Bridges presentAssistantMessage tool interface to SSE streaming output
 */
export class SSEToolInterfaceAdapter implements ToolInterfaceAdapter {
	constructor(
		private sseAdapter: SSEOutputAdapter,
		private taskApiHandler: TaskApiHandler,
	) {}

	/**
	 * Handle tool approval requests in API context
	 * Auto-approves for now, could integrate with question system later
	 */
	askApproval: AskApproval = async (
		type: ClineAsk,
		partialMessage?: string,
		progressStatus?: ToolProgressStatus,
	): Promise<boolean> => {
		// In API context, we typically auto-approve tools
		// Future enhancement: integrate with question system for interactive approval
		return true
	}

	/**
	 * Handle errors in API context
	 * Emits errors via SSE events
	 */
	handleError: HandleError = async (action: string, error: Error): Promise<void> => {
		await this.sseAdapter.emitError(error)
	}

	/**
	 * Push tool results to API output
	 * Adds results to conversation history and emits SSE events
	 */
	pushToolResult: PushToolResult = (content: ToolResponse): void => {
		// Convert ToolResponse to string for processing
		const result = Array.isArray(content)
			? content.map((block) => (block.type === "text" ? block.text : "[Image]")).join("\n")
			: content

		// Add to conversation history for continuity
		this.taskApiHandler.streamingState.userMessageContent.push({
			type: "text",
			text: `<tool_result>\n${result}\n</tool_result>`,
		})

		// Emit real-time SSE event for immediate feedback
		this.sseAdapter.emitToolResult(result)
	}

	/**
	 * Remove closing XML tags from strings
	 * Utility function for cleaning up tool output
	 */
	removeClosingTag: RemoveClosingTag = (tag: ToolParamName, content?: string): string => {
		if (!content) return ""
		return content.replace(new RegExp(`</${tag}>$`), "")
	}
}
