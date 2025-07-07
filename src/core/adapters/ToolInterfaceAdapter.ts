import type { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"

/**
 * Interface for tool execution adapters
 * Defines the contract that all context-specific adapters must implement
 * to bridge presentAssistantMessage tool interface to context-specific output systems
 */
export interface ToolInterfaceAdapter {
	askApproval: AskApproval
	handleError: HandleError
	pushToolResult: PushToolResult
	removeClosingTag: RemoveClosingTag
}

/**
 * Factory function to create appropriate tool interface adapter based on context
 */
export type ToolInterfaceAdapterFactory = () => ToolInterfaceAdapter
