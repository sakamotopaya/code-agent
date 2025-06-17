import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"

export async function useMcpToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const server_name: string | undefined = block.params.server_name
	const tool_name: string | undefined = block.params.tool_name
	const mcp_arguments: string | undefined = block.params.arguments
	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName: removeClosingTag("server_name", server_name),
				toolName: removeClosingTag("tool_name", tool_name),
				arguments: removeClosingTag("arguments", mcp_arguments),
			} satisfies ClineAskUseMcpServer)

			await cline.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!server_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_mcp_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
				return
			}

			if (!tool_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_mcp_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
				return
			}

			let parsedArguments: Record<string, unknown> | undefined

			if (mcp_arguments) {
				try {
					parsedArguments = JSON.parse(mcp_arguments)
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("use_mcp_tool")
					await cline.say("error", `Roo tried to use ${tool_name} with an invalid JSON argument. Retrying...`)

					pushToolResult(
						formatResponse.toolError(formatResponse.invalidMcpToolArgumentError(server_name, tool_name)),
					)

					return
				}
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName: server_name,
				toolName: tool_name,
				arguments: mcp_arguments,
			} satisfies ClineAskUseMcpServer)

			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Now execute the tool
			await cline.say("mcp_server_request_started") // same as browser_action_result

			if (cline.isVerbose) {
				console.log(`[useMcpToolTool] About to call cline.executeMcpTool`)
				console.log(`[useMcpToolTool] Server: ${server_name}`)
				console.log(`[useMcpToolTool] Tool: ${tool_name}`)
				console.log(`[useMcpToolTool] Args: ${JSON.stringify(parsedArguments, null, 2)}`)
			}

			// Use Task's new public method for MCP tool execution
			const mcpResult = await cline.executeMcpTool(server_name, tool_name, parsedArguments)

			if (cline.isVerbose) {
				console.log(`[useMcpToolTool] executeMcpTool returned:`, JSON.stringify(mcpResult, null, 2))
			}

			// Convert to expected format for response handling
			const toolResult = {
				isError: !mcpResult.success,
				content: [
					{
						type: "text",
						text: mcpResult.success
							? typeof mcpResult.result === "string"
								? mcpResult.result
								: JSON.stringify(mcpResult.result, null, 2)
							: mcpResult.error || "Tool execution failed",
					},
				],
			}

			if (cline.isVerbose) {
				console.log(`[useMcpToolTool] Final toolResult:`, JSON.stringify(toolResult, null, 2))
			}

			// TODO: add progress indicator and ability to parse images and non-text responses
			const toolResultPretty =
				(toolResult?.isError ? "Error:\n" : "") +
					toolResult?.content
						.map((item: any) => {
							if (item.type === "text") {
								return item.text
							}
							if (item.type === "resource" && item.resource) {
								const { blob: _, ...rest } = item.resource
								return JSON.stringify(rest, null, 2)
							}
							return ""
						})
						.filter(Boolean)
						.join("\n\n") || "(No response)"

			await cline.say("mcp_server_response", toolResultPretty)
			pushToolResult(formatResponse.toolResult(toolResultPretty))

			return
		}
	} catch (error) {
		await handleError("executing MCP tool", error)
		return
	}
}
