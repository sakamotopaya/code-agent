import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { type ExecuteCommandOptions, executeCommand } from "./executeCommandTool"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					// Use the task's telemetry service instead of a global instance
					if (cline.telemetry) {
						cline.telemetry.captureTaskCompleted(cline.taskId)
					}

					// NEW: Log token usage data before emission
					const tokenUsage = cline.getTokenUsage()
					const toolUsage = cline.toolUsage
					console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event (path 1):`)
					console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
					console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
					console.log(`[attemptCompletionTool] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
					if (tokenUsage) {
						console.log(
							`[attemptCompletionTool] 🔍 - tokenUsage value:`,
							JSON.stringify(tokenUsage, null, 2),
						)
					}
					console.log(`[attemptCompletionTool] 🔍 - toolUsage:`, JSON.stringify(toolUsage, null, 2))

					cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// no command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			let commandResult: ToolResponse | undefined

			if (command) {
				if (lastMessage && lastMessage.ask !== "command") {
					// Haven't sent a command message yet so first send completion_result then command.
					await cline.say("completion_result", result, undefined, false)
					// Use the task's telemetry service instead of a global instance
					if (cline.telemetry) {
						cline.telemetry.captureTaskCompleted(cline.taskId)
					}

					// NEW: Log token usage data before emission
					const tokenUsage = cline.getTokenUsage()
					const toolUsage = cline.toolUsage
					console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event (path 2):`)
					console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
					console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
					console.log(`[attemptCompletionTool] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
					if (tokenUsage) {
						console.log(
							`[attemptCompletionTool] 🔍 - tokenUsage value:`,
							JSON.stringify(tokenUsage, null, 2),
						)
					}
					console.log(`[attemptCompletionTool] 🔍 - toolUsage:`, JSON.stringify(toolUsage, null, 2))

					cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
				}

				// Complete command message.
				const didApprove = await askApproval("command", command)

				if (!didApprove) {
					return
				}

				const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
				const options: ExecuteCommandOptions = { executionId, command }
				const [userRejected, execCommandResult] = await executeCommand(cline, options)

				if (userRejected) {
					cline.didRejectTool = true
					pushToolResult(execCommandResult)
					return
				}

				// User didn't reject, but the command may have output.
				commandResult = execCommandResult
			} else {
				await cline.say("completion_result", result, undefined, false)
				// Use the task's telemetry service instead of a global instance
				if (cline.telemetry) {
					cline.telemetry.captureTaskCompleted(cline.taskId)
				}

				// NEW: Log token usage data before emission
				const tokenUsage = cline.getTokenUsage()
				const toolUsage = cline.toolUsage
				console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event (path 3):`)
				console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
				console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
				console.log(`[attemptCompletionTool] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
				if (tokenUsage) {
					console.log(`[attemptCompletionTool] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
				}
				console.log(`[attemptCompletionTool] 🔍 - toolUsage:`, JSON.stringify(toolUsage, null, 2))

				cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
			}

			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await cline.providerRef?.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			// In CLI mode, use the askApproval function which auto-approves
			// In VSCode mode, this will show the appropriate UI for completion approval
			const approved = await askApproval("completion_result", "")

			// Signals to recursive loop to stop
			// In CLI mode, auto-approval means completion is accepted
			if (approved) {
				pushToolResult("")
				return
			}

			// If not approved, we need to continue with feedback handling
			// Note: In CLI mode this branch may not be reached due to auto-approval
			const feedbackText = "Completion not approved - please continue with the task"
			const feedbackImages: string[] = []

			await cline.say("user_feedback", feedbackText, feedbackImages)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			if (commandResult) {
				if (typeof commandResult === "string") {
					toolResults.push({ type: "text", text: commandResult })
				} else if (Array.isArray(commandResult)) {
					toolResults.push(...commandResult)
				}
			}

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${feedbackText}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(feedbackImages))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}
