import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"
import pWaitFor from "p-wait-for"
import { serializeError } from "serialize-error"
import { ApiHandler, ApiHandlerCreateMessageMetadata } from "../../api"
import { ApiStream } from "../../api/transform/stream"
import { ProviderSettings, ClineAsk, ToolName } from "@roo-code/types"
import { ClineProvider } from "../webview/ClineProvider"
import { TaskMessaging } from "./TaskMessaging"
import { truncateConversationIfNeeded } from "../sliding-window"
import { getMessagesSinceLastSummary } from "../condense"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { calculateApiCostAnthropic } from "../../shared/cost"
import { ITelemetryService } from "../interfaces/ITelemetryService"
import { type AssistantMessageContent, parseAssistantMessage, presentAssistantMessage } from "../assistant-message"
import { formatContentBlockToMarkdown } from "../../integrations/misc/export-markdown"
import { ClineApiReqCancelReason, ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { findLastIndex } from "../../shared/array"
import { formatResponse } from "../prompts/responses"

/**
 * Handles API requests and streaming for the Task class
 */
export class TaskApiHandler {
	private lastApiRequestTime?: number
	private consecutiveAutoApprovedRequestsCount: number = 0
	private isWaitingForFirstChunk = false
	private isStreaming = false
	private currentStreamingContentIndex = 0
	private assistantMessageContent: AssistantMessageContent[] = []
	private presentAssistantMessageLocked = false
	private presentAssistantMessageHasPendingUpdates = false
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	private userMessageContentReady = false
	private didRejectTool = false
	private didAlreadyUseTool = false
	private didCompleteReadingStream = false

	constructor(
		private taskId: string,
		private instanceId: string,
		private api: ApiHandler,
		private messaging: TaskMessaging,
		private telemetry: ITelemetryService,
		private providerRef?: WeakRef<ClineProvider>,
		private onTokenUsageUpdate?: (taskId: string, tokenUsage: any) => void,
		private onToolFailed?: (taskId: string, tool: ToolName, error: string) => void,
	) {}

	async *attemptApiRequest(
		retryAttempt: number = 0,
		getSystemPrompt: () => Promise<string>,
		getTokenUsage: () => any,
		abort?: boolean,
	): ApiStream {
		const state = await this.providerRef?.deref()?.getState()
		const {
			apiConfiguration,
			autoApprovalEnabled,
			alwaysApproveResubmit,
			requestDelaySeconds,
			mode,
			autoCondenseContext = true,
			autoCondenseContextPercent = 100,
		} = state ?? {}

		// Get condensing configuration for automatic triggers
		const customCondensingPrompt = state?.customCondensingPrompt
		const condensingApiConfigId = state?.condensingApiConfigId
		const listApiConfigMeta = state?.listApiConfigMeta

		// Determine API handler to use for condensing
		let condensingApiHandler: ApiHandler | undefined
		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			const matchingConfig = listApiConfigMeta.find((config: any) => config.id === condensingApiConfigId)
			if (matchingConfig) {
				const profile = await this.providerRef?.deref()?.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})
				if (profile && profile.apiProvider) {
					const { buildApiHandler } = await import("../../api")
					condensingApiHandler = buildApiHandler(profile)
				}
			}
		}

		let rateLimitDelay = 0

		// Only apply rate limiting if this isn't the first request
		if (this.lastApiRequestTime) {
			const now = Date.now()
			const timeSinceLastRequest = now - this.lastApiRequestTime
			const rateLimit = apiConfiguration?.rateLimitSeconds || 0
			rateLimitDelay = Math.ceil(Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000)
		}

		// Only show rate limiting message if we're not retrying
		if (rateLimitDelay > 0 && retryAttempt === 0) {
			for (let i = rateLimitDelay; i > 0; i--) {
				const delayMessage = `Rate limiting for ${i} seconds...`
				await this.messaging.say(
					"api_req_retry_delayed",
					delayMessage,
					undefined,
					true,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)
				await delay(1000)
			}
		}

		// Update last request time before making the request
		this.lastApiRequestTime = Date.now()

		const systemPrompt = await getSystemPrompt()
		const { contextTokens } = getTokenUsage()

		if (contextTokens) {
			const DEFAULT_THINKING_MODEL_MAX_TOKENS = 16_384
			const modelInfo = this.api.getModel().info
			const maxTokens = modelInfo.supportsReasoningBudget
				? (apiConfiguration as any)?.modelMaxTokens || DEFAULT_THINKING_MODEL_MAX_TOKENS
				: modelInfo.maxTokens
			const contextWindow = modelInfo.contextWindow

			const truncateResult = await truncateConversationIfNeeded({
				messages: this.messaging.apiHistory,
				totalTokens: contextTokens,
				maxTokens,
				contextWindow,
				apiHandler: this.api,
				autoCondenseContext,
				autoCondenseContextPercent,
				systemPrompt,
				taskId: this.taskId,
				customCondensingPrompt,
				condensingApiHandler,
			})

			if (truncateResult.messages !== this.messaging.apiHistory) {
				await this.messaging.overwriteApiConversationHistory(truncateResult.messages)
			}
			if (truncateResult.error) {
				await this.messaging.say(
					"condense_context_error",
					truncateResult.error,
					undefined,
					undefined,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)
			} else if (truncateResult.summary) {
				const { summary, cost, prevContextTokens, newContextTokens = 0 } = truncateResult
				const contextCondense = { summary, cost, newContextTokens, prevContextTokens }
				await this.messaging.say(
					"condense_context",
					undefined,
					undefined,
					false,
					undefined,
					undefined,
					{ isNonInteractive: true },
					contextCondense,
					abort,
				)
			}
		}

		const messagesSinceLastSummary = getMessagesSinceLastSummary(this.messaging.apiHistory)
		const cleanConversationHistory = maybeRemoveImageBlocks(messagesSinceLastSummary, this.api).map(
			({ role, content }) => ({ role, content }),
		)

		// Check if we've reached the maximum number of auto-approved requests
		const maxRequests = state?.allowedMaxRequests || Infinity
		this.consecutiveAutoApprovedRequestsCount++

		if (this.consecutiveAutoApprovedRequestsCount > maxRequests) {
			const { response } = await this.messaging.ask(
				"auto_approval_max_req_reached",
				JSON.stringify({ count: maxRequests }),
				undefined,
				undefined,
				abort,
			)
			if (response === "yesButtonClicked") {
				this.consecutiveAutoApprovedRequestsCount = 0
			}
		}

		const metadata: ApiHandlerCreateMessageMetadata = {
			mode: mode,
			taskId: this.taskId,
		}

		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory, metadata)
		const iterator = stream[Symbol.asyncIterator]()

		try {
			this.isWaitingForFirstChunk = true
			const firstChunk = await iterator.next()
			yield firstChunk.value
			this.isWaitingForFirstChunk = false
		} catch (error) {
			this.isWaitingForFirstChunk = false

			if (autoApprovalEnabled && alwaysApproveResubmit) {
				let errorMsg
				if ((error as any).error?.metadata?.raw) {
					errorMsg = JSON.stringify((error as any).error.metadata.raw, null, 2)
				} else if ((error as any).message) {
					errorMsg = (error as any).message
				} else {
					errorMsg = "Unknown error"
				}

				const baseDelay = requestDelaySeconds || 5
				let exponentialDelay = Math.ceil(baseDelay * Math.pow(2, retryAttempt))

				// Handle 429 errors with retry delay
				if ((error as any).status === 429) {
					const geminiRetryDetails = (error as any).errorDetails?.find(
						(detail: any) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
					)
					if (geminiRetryDetails) {
						const match = geminiRetryDetails?.retryDelay?.match(/^(\d+)s$/)
						if (match) {
							exponentialDelay = Number(match[1]) + 1
						}
					}
				}

				const finalDelay = Math.max(exponentialDelay, rateLimitDelay)

				// Show countdown timer with exponential backoff
				for (let i = finalDelay; i > 0; i--) {
					await this.messaging.say(
						"api_req_retry_delayed",
						`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying in ${i} seconds...`,
						undefined,
						true,
						undefined,
						undefined,
						{},
						undefined,
						abort,
					)
					await delay(1000)
				}

				await this.messaging.say(
					"api_req_retry_delayed",
					`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying now...`,
					undefined,
					false,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)

				yield* this.attemptApiRequest(retryAttempt + 1, getSystemPrompt, getTokenUsage, abort)
				return
			} else {
				const { response } = await this.messaging.ask(
					"api_req_failed",
					(error as any).message ?? JSON.stringify(serializeError(error), null, 2),
					undefined,
					undefined,
					abort,
				)

				if (response !== "yesButtonClicked") {
					throw new Error("API request failed")
				}

				await this.messaging.say(
					"api_req_retried",
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)
				yield* this.attemptApiRequest(0, getSystemPrompt, getTokenUsage, abort)
				return
			}
		}

		yield* iterator
	}

	async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
		getSystemPrompt: () => Promise<string>,
		getTokenUsage: () => any,
		getEnvironmentDetails: (includeFileDetails: boolean) => Promise<string>,
		processUserContentMentions: (
			userContent: Anthropic.Messages.ContentBlockParam[],
		) => Promise<Anthropic.Messages.ContentBlockParam[]>,
		abort?: boolean,
		consecutiveMistakeCount?: number,
		consecutiveMistakeLimit?: number,
		onMistakeLimitReached?: () => Promise<{ response: string; text?: string; images?: string[] }>,
		onTaskCompleted?: (taskId: string, tokenUsage: any, toolUsage: any) => void,
	): Promise<boolean> {
		if (abort) {
			throw new Error(`[RooCode#recursivelyMakeRooRequests] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (
			consecutiveMistakeCount !== undefined &&
			consecutiveMistakeLimit !== undefined &&
			consecutiveMistakeCount >= consecutiveMistakeLimit &&
			onMistakeLimitReached
		) {
			const { response, text, images } = await onMistakeLimitReached()

			if (response === "messageResponse") {
				userContent.push(
					...[
						{ type: "text" as const, text: `Too many mistakes. ${text}` },
						...formatResponse.imageBlocks(images),
					],
				)

				await this.messaging.say(
					"user_feedback",
					text,
					images,
					undefined,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)
				this.telemetry.captureConsecutiveMistakeError(this.taskId)
			}
		}

		// Show loading message
		await this.messaging.say(
			"api_req_started",
			JSON.stringify({
				request:
					userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n") + "\n\nLoading...",
			}),
			undefined,
			undefined,
			undefined,
			undefined,
			{},
			undefined,
			abort,
		)

		const parsedUserContent = await processUserContentMentions(userContent)
		const environmentDetails = await getEnvironmentDetails(includeFileDetails)

		const finalUserContent = [...parsedUserContent, { type: "text" as const, text: environmentDetails }]

		await this.messaging.addToApiConversationHistory({ role: "user", content: finalUserContent })
		this.telemetry.captureConversationMessage(this.taskId, "user")

		// Update the loading message
		const lastApiReqIndex = findLastIndex(this.messaging.messages, (m) => m.say === "api_req_started")
		if (lastApiReqIndex !== -1) {
			this.messaging.messages[lastApiReqIndex].text = JSON.stringify({
				request: finalUserContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n"),
			} satisfies ClineApiReqInfo)
		}

		try {
			let cacheWriteTokens = 0
			let cacheReadTokens = 0
			let inputTokens = 0
			let outputTokens = 0
			let totalCost: number | undefined

			const updateApiReqMsg = (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
				if (lastApiReqIndex !== -1) {
					this.messaging.messages[lastApiReqIndex].text = JSON.stringify({
						...JSON.parse(this.messaging.messages[lastApiReqIndex].text || "{}"),
						tokensIn: inputTokens,
						tokensOut: outputTokens,
						cacheWrites: cacheWriteTokens,
						cacheReads: cacheReadTokens,
						cost:
							totalCost ??
							calculateApiCostAnthropic(
								this.api.getModel().info,
								inputTokens,
								outputTokens,
								cacheWriteTokens,
								cacheReadTokens,
							),
						cancelReason,
						streamingFailedMessage,
					} satisfies ClineApiReqInfo)
				}
			}

			// Reset streaming state
			this.currentStreamingContentIndex = 0
			this.assistantMessageContent = []
			this.didCompleteReadingStream = false
			this.userMessageContent = []
			this.userMessageContentReady = false
			this.didRejectTool = false
			this.didAlreadyUseTool = false
			this.presentAssistantMessageLocked = false
			this.presentAssistantMessageHasPendingUpdates = false

			const stream = this.attemptApiRequest(0, getSystemPrompt, getTokenUsage, abort)
			let assistantMessage = ""
			let reasoningMessage = ""
			this.isStreaming = true

			try {
				for await (const chunk of stream) {
					if (!chunk) continue

					switch (chunk.type) {
						case "reasoning":
							reasoningMessage += chunk.text
							await this.messaging.say(
								"reasoning",
								reasoningMessage,
								undefined,
								true,
								undefined,
								undefined,
								{},
								undefined,
								abort,
							)
							break
						case "usage":
							inputTokens += chunk.inputTokens
							outputTokens += chunk.outputTokens
							cacheWriteTokens += chunk.cacheWriteTokens ?? 0
							cacheReadTokens += chunk.cacheReadTokens ?? 0
							totalCost = chunk.totalCost
							break
						case "text": {
							assistantMessage += chunk.text
							const prevLength = this.assistantMessageContent.length
							this.assistantMessageContent = parseAssistantMessage(assistantMessage)

							if (this.assistantMessageContent.length > prevLength) {
								this.userMessageContentReady = false
							}

							// Present content to user
							// presentAssistantMessage(this) // This would need to be refactored
							break
						}
					}

					if (abort) {
						break
					}

					if (this.didRejectTool || this.didAlreadyUseTool) {
						break
					}
				}
			} catch (error) {
				if (!abort) {
					updateApiReqMsg(
						"streaming_failed",
						(error as any).message ?? JSON.stringify(serializeError(error), null, 2),
					)
					throw error
				}
			} finally {
				this.isStreaming = false
			}

			if (
				inputTokens > 0 ||
				outputTokens > 0 ||
				cacheWriteTokens > 0 ||
				cacheReadTokens > 0 ||
				typeof totalCost !== "undefined"
			) {
				this.telemetry.captureLlmCompletion(this.taskId, {
					inputTokens,
					outputTokens,
					cacheWriteTokens,
					cacheReadTokens,
					cost: totalCost,
				})
			}

			if (abort) {
				throw new Error(`[RooCode#recursivelyMakeRooRequests] task ${this.taskId}.${this.instanceId} aborted`)
			}

			this.didCompleteReadingStream = true

			// Set any blocks to be complete
			const partialBlocks = this.assistantMessageContent.filter((block) => block.partial)
			partialBlocks.forEach((block) => (block.partial = false))

			updateApiReqMsg()

			let didEndLoop = false

			if (assistantMessage.length > 0) {
				await this.messaging.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: assistantMessage }],
				})

				this.telemetry.captureConversationMessage(this.taskId, "assistant")

				await pWaitFor(() => this.userMessageContentReady)

				const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")

				if (!didToolUse) {
					this.userMessageContent.push({
						type: "text",
						text: "No tools were used. Please use a tool or attempt_completion.",
					})
				}

				// Recursive call would go here
				// const recDidEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent, ...)
				// didEndLoop = recDidEndLoop
			} else {
				await this.messaging.say(
					"error",
					"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
					undefined,
					undefined,
					undefined,
					undefined,
					{},
					undefined,
					abort,
				)

				await this.messaging.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Failure: I did not provide a response." }],
				})
			}

			return didEndLoop
		} catch (error) {
			return true
		}
	}

	// Getters for streaming state
	get streamingState() {
		return {
			isWaitingForFirstChunk: this.isWaitingForFirstChunk,
			isStreaming: this.isStreaming,
			currentStreamingContentIndex: this.currentStreamingContentIndex,
			assistantMessageContent: this.assistantMessageContent,
			presentAssistantMessageLocked: this.presentAssistantMessageLocked,
			presentAssistantMessageHasPendingUpdates: this.presentAssistantMessageHasPendingUpdates,
			userMessageContent: this.userMessageContent,
			userMessageContentReady: this.userMessageContentReady,
			didRejectTool: this.didRejectTool,
			didAlreadyUseTool: this.didAlreadyUseTool,
			didCompleteReadingStream: this.didCompleteReadingStream,
		}
	}

	// Setters for streaming state
	setStreamingState(state: Partial<typeof this.streamingState>) {
		if (state.isWaitingForFirstChunk !== undefined) this.isWaitingForFirstChunk = state.isWaitingForFirstChunk
		if (state.isStreaming !== undefined) this.isStreaming = state.isStreaming
		if (state.currentStreamingContentIndex !== undefined)
			this.currentStreamingContentIndex = state.currentStreamingContentIndex
		if (state.assistantMessageContent !== undefined) this.assistantMessageContent = state.assistantMessageContent
		if (state.presentAssistantMessageLocked !== undefined)
			this.presentAssistantMessageLocked = state.presentAssistantMessageLocked
		if (state.presentAssistantMessageHasPendingUpdates !== undefined)
			this.presentAssistantMessageHasPendingUpdates = state.presentAssistantMessageHasPendingUpdates
		if (state.userMessageContent !== undefined) this.userMessageContent = state.userMessageContent
		if (state.userMessageContentReady !== undefined) this.userMessageContentReady = state.userMessageContentReady
		if (state.didRejectTool !== undefined) this.didRejectTool = state.didRejectTool
		if (state.didAlreadyUseTool !== undefined) this.didAlreadyUseTool = state.didAlreadyUseTool
		if (state.didCompleteReadingStream !== undefined) this.didCompleteReadingStream = state.didCompleteReadingStream
	}
}
