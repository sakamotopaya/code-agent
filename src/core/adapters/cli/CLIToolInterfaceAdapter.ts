import type {
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolResponse,
	ToolParamName,
} from "../../../shared/tools"
import type { ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { CLIOutputAdapter } from "./CLIOutputAdapters"
import { ToolInterfaceAdapter } from "../ToolInterfaceAdapter"

/**
 * CLI-specific implementation of tool interface adapter
 * Bridges presentAssistantMessage tool interface to CLI stdio output
 */
export class CLIToolInterfaceAdapter implements ToolInterfaceAdapter {
	constructor(private outputAdapter: CLIOutputAdapter) {}

	/**
	 * Handle tool approval requests in CLI context
	 * Auto-approves in batch mode, prompts user in interactive mode
	 */
	askApproval: AskApproval = async (
		type: ClineAsk,
		partialMessage?: string,
		progressStatus?: ToolProgressStatus,
	): Promise<boolean> => {
		// In CLI context, we typically auto-approve tools
		// Interactive approval can be added later if needed
		if (this.outputAdapter.isInteractive && this.outputAdapter.isInteractive()) {
			// For now, auto-approve even in interactive mode
			// TODO: Implement interactive approval prompts
			return true
		}
		return true // Auto-approve in batch mode
	}

	/**
	 * Handle errors in CLI context
	 * Outputs errors via CLI output adapter
	 */
	handleError: HandleError = async (action: string, error: Error): Promise<void> => {
		const errorMessage = `Error in ${action}: ${error.message}`
		await this.outputAdapter.showError(errorMessage)
	}

	/**
	 * Push tool results to CLI output
	 * Formats and displays tool results via CLI output adapter
	 */
	pushToolResult: PushToolResult = (content: ToolResponse): void => {
		// Convert ToolResponse to string for CLI display
		const result = Array.isArray(content)
			? content.map((block) => (block.type === "text" ? block.text : "[Image]")).join("\n")
			: content
		this.outputAdapter.showToolResult(result)
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
