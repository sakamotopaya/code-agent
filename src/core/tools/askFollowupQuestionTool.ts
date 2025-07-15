import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"
import { QuestionData } from "../questions/interfaces/IQuestionSystem"
import { QuestionOptions } from "../interfaces/IUserInterface"

export async function askFollowupQuestionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	console.log(`[askFollowupQuestionTool] Starting tool execution`)
	console.log(`[askFollowupQuestionTool] Block params:`, JSON.stringify(block.params, null, 2))

	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	console.log(`[askFollowupQuestionTool] Extracted params:`, {
		question: question ? `"${question}"` : "undefined",
		follow_up: follow_up ? `"${follow_up}"` : "undefined",
		partial: block.partial,
	})

	try {
		if (block.partial) {
			console.log(`[askFollowupQuestionTool] Handling partial block`)
			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			console.log(`[askFollowupQuestionTool] Handling complete block`)

			if (!question) {
				console.log(`[askFollowupQuestionTool] ERROR: No question provided`)
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			// Try to use the unified question system if available
			const unifiedQuestionManager = cline.unifiedQuestionManager
			console.log(`[askFollowupQuestionTool] Unified question manager available:`, !!unifiedQuestionManager)

			if (unifiedQuestionManager) {
				try {
					console.log(`[askFollowupQuestionTool] Using unified question system`)

					// Parse follow-up suggestions if provided
					let suggestions: string[] = []
					if (follow_up) {
						console.log(`[askFollowupQuestionTool] Parsing follow_up suggestions:`, follow_up)
						try {
							const parsedSuggest = parseXml(follow_up, ["suggest"]) as { suggest: any[] | any }
							console.log(
								`[askFollowupQuestionTool] Parsed XML result:`,
								JSON.stringify(parsedSuggest, null, 2),
							)

							const normalizedSuggest = Array.isArray(parsedSuggest?.suggest)
								? parsedSuggest.suggest
								: [parsedSuggest?.suggest].filter((sug) => sug !== undefined)

							console.log(`[askFollowupQuestionTool] Normalized suggestions:`, normalizedSuggest)

							suggestions = normalizedSuggest
								.filter((sug) => sug !== undefined && sug !== null)
								.map((sug, index) => {
									console.log(`[askFollowupQuestionTool] Processing suggestion ${index}:`, {
										type: typeof sug,
										value: sug,
										hasAnswer: typeof sug === "object" && "answer" in sug,
									})

									if (typeof sug === "string") {
										return sug
									}
									// Handle object case (legacy format)
									if (typeof sug === "object" && sug.answer) {
										console.log(`[askFollowupQuestionTool] Using sug.answer:`, sug.answer)
										return sug.answer
									}
									// Fallback to string conversion
									const converted = String(sug)
									console.log(`[askFollowupQuestionTool] Converted to string:`, converted)
									return converted
								})

							console.log(`[askFollowupQuestionTool] Final suggestions array:`, suggestions)
						} catch (error) {
							console.error(`[askFollowupQuestionTool] Failed to parse suggestions:`, {
								error: error.message,
								stack: error.stack,
								follow_up,
							})
							// Continue without suggestions
						}
					} else {
						console.log(`[askFollowupQuestionTool] No follow_up provided, using empty suggestions`)
					}

					// Create question options - if no suggestions, provide a default "Continue" option
					const questionOptions: QuestionOptions = {
						choices: suggestions.length > 0 ? suggestions : ["Continue"],
						defaultChoice: suggestions.length > 0 ? suggestions[0] : "Continue",
					}

					console.log(`[askFollowupQuestionTool] Question options:`, JSON.stringify(questionOptions, null, 2))

					// Use unified question system
					console.log(`[askFollowupQuestionTool] Calling unifiedQuestionManager.askQuestion()`)
					const answer = await unifiedQuestionManager.askQuestion(question, questionOptions)

					console.log(`[askFollowupQuestionTool] Received answer:`, {
						answer,
						type: typeof answer,
						isNull: answer === null,
						isUndefined: answer === undefined,
					})

					// Handle the response
					cline.consecutiveMistakeCount = 0
					await cline.say("user_feedback", answer ?? "", [])
					pushToolResult(formatResponse.toolResult(`<answer>\n${answer}\n</answer>`, []))
					console.log(`[askFollowupQuestionTool] Successfully completed unified question system flow`)
					return
				} catch (error) {
					console.error(`[askFollowupQuestionTool] Unified question system failed:`, {
						error: error.message,
						stack: error.stack,
						question,
						follow_up,
						errorName: error.name,
						errorConstructor: error.constructor.name,
					})
					await cline.say("error", `Question handling failed: CLI question handler error: ${error.message}`)
					// Fall back to legacy system
					console.log(`[askFollowupQuestionTool] Falling back to legacy system`)
				}
			}

			// Legacy system fallback
			type Suggest = { answer: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				let parsedSuggest: {
					suggest: Suggest[] | Suggest
				}

				try {
					parsedSuggest = parseXml(follow_up, ["suggest"]) as { suggest: Suggest[] | Suggest }
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("ask_followup_question")
					await cline.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const normalizedSuggest = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is Suggest => sug !== undefined)

				follow_up_json.suggest = normalizedSuggest
			}

			cline.consecutiveMistakeCount = 0
			const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
			await cline.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			return
		}
	} catch (error) {
		await handleError("asking question", error)
		return
	}
}
