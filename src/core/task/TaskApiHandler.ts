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
import { getCLILogger } from "../../cli/services/CLILogger"
import { IStreamingAdapter, IContentOutputAdapter } from "../interfaces/IOutputAdapter"
import { IContentProcessor } from "../interfaces/IContentProcessor"
import { ILogger, NoOpLogger } from "../interfaces/ILogger"

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
	private logger: ILogger

	constructor(
		private taskId: string,
		private instanceId: string,
		private api: ApiHandler,
		private messaging: TaskMessaging,
		private telemetry: ITelemetryService,
		private providerRef?: WeakRef<ClineProvider>,
		private onTokenUsageUpdate?: (taskId: string, tokenUsage: any) => void,
		private onToolFailed?: (taskId: string, tool: ToolName, error: string) => void,
		private onMessage?: (action: "created" | "updated", message: any) => void,
		private cliMode: boolean = false,
		private cliApiConfiguration?: any,
		private taskRef?: WeakRef<any>, // Task reference to access userInterface
		logger?: ILogger,
	) {
		// Initialize logger
		this.logger = logger || new NoOpLogger()

		// Detect CLI mode if no provider is available
		if (!providerRef) {
			this.cliMode = true
		}
	}

	private log(message: string, ...args: any[]): void {
		this.logger.debug(message, ...args)
	}

	/**
	 * Set or update the logger instance
	 */
	setLogger(logger: ILogger): void {
		this.logger = logger
	}

	async *attemptApiRequest(
		retryAttempt: number = 0,
		getSystemPrompt: () => Promise<string>,
		getTokenUsage: () => any,
		abort?: boolean,
	): ApiStream {
		this.log(
			`[TaskApiHandler.attemptApiRequest] Starting API request for task ${this.taskId}.${this.instanceId}, retry attempt: ${retryAttempt}`,
		)

		let state: any = null
		let apiConfiguration: any = null
		let autoApprovalEnabled: boolean = false
		let alwaysApproveResubmit: boolean = false
		let requestDelaySeconds: number = 0
		let mode: string = "code"
		let autoCondenseContext: boolean = true
		let autoCondenseContextPercent: number = 100

		if (this.cliMode) {
			this.log(`[TaskApiHandler.attemptApiRequest] Running in CLI mode, using default configuration`)
			// For CLI mode, use sensible defaults
			apiConfiguration = this.cliApiConfiguration
			autoApprovalEnabled = true // Auto-approve in CLI mode
			alwaysApproveResubmit = true // Auto-retry in CLI mode
			requestDelaySeconds = 0
			mode = "code"
			autoCondenseContext = true
			autoCondenseContextPercent = 100
		} else {
			const providerRef = this.providerRef?.deref()
			this.log(`[TaskApiHandler.attemptApiRequest] Provider ref available: ${!!providerRef}`)

			state = await providerRef?.getState()
			this.log(`[TaskApiHandler.attemptApiRequest] Provider state retrieved:`, {
				hasState: !!state,
				apiConfiguration: !!state?.apiConfiguration,
				mode: state?.mode,
				autoApprovalEnabled: state?.autoApprovalEnabled,
				alwaysApproveResubmit: state?.alwaysApproveResubmit,
			})

			const stateValues = state ?? {}
			apiConfiguration = stateValues.apiConfiguration
			autoApprovalEnabled = stateValues.autoApprovalEnabled ?? false
			alwaysApproveResubmit = stateValues.alwaysApproveResubmit ?? false
			requestDelaySeconds = stateValues.requestDelaySeconds ?? 0
			mode = stateValues.mode ?? "code"
			autoCondenseContext = stateValues.autoCondenseContext ?? true
			autoCondenseContextPercent = stateValues.autoCondenseContextPercent ?? 100
		}

		this.log(`[TaskApiHandler.attemptApiRequest] Configuration values:`, {
			cliMode: this.cliMode,
			hasApiConfiguration: !!apiConfiguration,
			apiProvider: apiConfiguration?.apiProvider,
			autoApprovalEnabled,
			alwaysApproveResubmit,
			requestDelaySeconds,
			mode,
			autoCondenseContext,
			autoCondenseContextPercent,
		})

		// Get condensing configuration for automatic triggers (only in VS Code mode)
		let customCondensingPrompt: string | undefined
		let condensingApiConfigId: string | undefined
		let listApiConfigMeta: any[] | undefined
		let condensingApiHandler: ApiHandler | undefined

		if (!this.cliMode && state) {
			customCondensingPrompt = state.customCondensingPrompt
			condensingApiConfigId = state.condensingApiConfigId
			listApiConfigMeta = state.listApiConfigMeta

			this.log(`[TaskApiHandler.attemptApiRequest] Condensing configuration:`, {
				hasCustomCondensingPrompt: !!customCondensingPrompt,
				condensingApiConfigId,
				hasListApiConfigMeta: !!listApiConfigMeta,
				listApiConfigMetaLength: Array.isArray(listApiConfigMeta) ? listApiConfigMeta.length : 0,
			})

			// Determine API handler to use for condensing
			if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
				this.logger.debug(
					`[TaskApiHandler.attemptApiRequest] Looking for condensing config with ID: ${condensingApiConfigId}`,
				)
				const matchingConfig = listApiConfigMeta.find((config: any) => config.id === condensingApiConfigId)
				this.logger.debug(`[TaskApiHandler.attemptApiRequest] Matching config found: ${!!matchingConfig}`)

				if (matchingConfig) {
					this.logger.debug(`[TaskApiHandler.attemptApiRequest] Getting profile for condensing config`)
					const profile = await this.providerRef?.deref()?.providerSettingsManager.getProfile({
						id: condensingApiConfigId,
					})
					this.logger.debug(`[TaskApiHandler.attemptApiRequest] Profile retrieved:`, {
						hasProfile: !!profile,
						apiProvider: profile?.apiProvider,
					})

					if (profile && profile.apiProvider) {
						this.logger.debug(`[TaskApiHandler.attemptApiRequest] Building condensing API handler`)
						try {
							const { buildApiHandler } = await import("../../api")
							this.logger.debug(
								`[TaskApiHandler.attemptApiRequest] buildApiHandler imported successfully`,
							)
							condensingApiHandler = buildApiHandler(profile)
							this.logger.debug(
								`[TaskApiHandler.attemptApiRequest] Condensing API handler created: ${!!condensingApiHandler}`,
							)
						} catch (error) {
							this.logger.error(
								`[TaskApiHandler.attemptApiRequest] Failed to build condensing API handler:`,
								error,
							)
						}
					}
				}
			}
		} else {
			this.log(`[TaskApiHandler.attemptApiRequest] Skipping condensing configuration in CLI mode`)
		}

		let rateLimitDelay = 0

		// Only apply rate limiting if this isn't the first request
		if (this.lastApiRequestTime) {
			const now = Date.now()
			const timeSinceLastRequest = now - this.lastApiRequestTime
			const rateLimit = apiConfiguration?.rateLimitSeconds || 0
			rateLimitDelay = Math.ceil(Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000)
		}

		this.log(`[TaskApiHandler.attemptApiRequest] Rate limit delay: ${rateLimitDelay}`)

		// Only show rate limiting message if we're not retrying
		if (rateLimitDelay > 0 && retryAttempt === 0) {
			this.logger.debug(`[TaskApiHandler.attemptApiRequest] Applying rate limit delay`)
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

		this.log(`[TaskApiHandler.attemptApiRequest] Getting system prompt...`)
		const systemPrompt = await getSystemPrompt()
		this.log(`[TaskApiHandler.attemptApiRequest] System prompt retrieved, length: ${systemPrompt.length}`)

		this.log(`[TaskApiHandler.attemptApiRequest] Getting token usage...`)
		const { contextTokens } = getTokenUsage()
		this.log(`[TaskApiHandler.attemptApiRequest] Token usage retrieved, contextTokens: ${contextTokens}`)

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

		this.log(`[TaskApiHandler] Creating API message with metadata:`, metadata)
		this.log(`[TaskApiHandler] System prompt length: ${systemPrompt.length}`)
		this.log(`[TaskApiHandler] Conversation history length: ${cleanConversationHistory.length}`)
		this.log(`[TaskApiHandler] API handler model info:`, this.api.getModel()?.info)

		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory, metadata)
		this.log(`[TaskApiHandler] API stream created successfully`)

		const iterator = stream[Symbol.asyncIterator]()
		this.log(`[TaskApiHandler] Stream iterator created`)

		try {
			this.isWaitingForFirstChunk = true
			this.log(`[TaskApiHandler] Waiting for first chunk...`)
			const firstChunk = await iterator.next()
			this.log(`[TaskApiHandler] First chunk received:`, firstChunk.value?.type)
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
		executeTools?: (taskApiHandler: TaskApiHandler) => Promise<void>,
	): Promise<boolean> {
		this.log(`[TaskApiHandler] Starting recursivelyMakeClineRequests for task ${this.taskId}.${this.instanceId}`)
		this.log(`[TaskApiHandler] User content length: ${userContent.length}`)
		this.log(`[TaskApiHandler] Include file details: ${includeFileDetails}`)
		this.log(`[TaskApiHandler] Abort: ${abort}`)
		this.log(`[TaskApiHandler] Consecutive mistake count: ${consecutiveMistakeCount}`)

		if (abort) {
			this.log(`[TaskApiHandler] Task aborted, throwing error`)
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

			this.log(`[TaskApiHandler] About to make API request...`)

			// Reset tool display tracking for new request
			if (this.cliMode) {
				getCLILogger().resetToolDisplay()
			}

			const stream = this.attemptApiRequest(0, getSystemPrompt, getTokenUsage, abort)
			this.log(`[TaskApiHandler] API request stream created`)
			let assistantMessage = ""
			let reasoningMessage = ""
			this.isStreaming = true

			try {
				this.log(`[TaskApiHandler] Starting to iterate over stream...`)
				for await (const chunk of stream) {
					this.log(`[TaskApiHandler] Received chunk type: ${chunk?.type}`)
					if (!chunk) continue

					switch (chunk.type) {
						case "reasoning":
							this.log(`[TaskApiHandler] Processing reasoning chunk`)
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
							this.log(`[TaskApiHandler] Processing usage chunk`)
							inputTokens += chunk.inputTokens
							outputTokens += chunk.outputTokens
							cacheWriteTokens += chunk.cacheWriteTokens ?? 0
							cacheReadTokens += chunk.cacheReadTokens ?? 0
							totalCost = chunk.totalCost
							break
						case "text": {
							this.log(`[TaskApiHandler] Processing text chunk: ${chunk.text?.substring(0, 100)}...`)
							assistantMessage += chunk.text
							const prevLength = this.assistantMessageContent.length
							this.assistantMessageContent = parseAssistantMessage(assistantMessage)
							this.log(
								`[TaskApiHandler] Assistant message content updated, length: ${this.assistantMessageContent.length}`,
							)

							// Stream chunk through unified output adapter (CLI, API, or VSCode)
							if (chunk.text) {
								try {
									await this.messaging.streamChunk(chunk.text)
									this.log(
										`[TaskApiHandler] Streamed chunk through unified messaging system: ${chunk.text.substring(0, 100)}...`,
									)
								} catch (error) {
									this.log(`[TaskApiHandler] Error streaming chunk through messaging system:`, error)
								}
							}

							// Still send through messaging system for persistence (but not for immediate streaming)
							if (chunk.text) {
								this.logger.debug(
									`[MESSAGING-PERSISTENCE] About to send chunk to messaging system for persistence`,
								)
								this.logger.debug(
									`[MESSAGING-PERSISTENCE] Chunk: "${chunk.text.substring(0, 100)}${chunk.text.length > 100 ? "..." : ""}" (${chunk.text.length} chars)`,
								)

								try {
									// Send AI response text through messaging system with proper callback for Task event emission
									this.messaging
										.say(
											"text",
											chunk.text,
											undefined,
											true,
											undefined,
											undefined,
											undefined,
											undefined,
											false,
											this.onMessage,
										)
										.catch((error) => {
											this.logger.error(
												`[MESSAGING-PERSISTENCE] Error in messaging say call:`,
												error,
											)
											this.log(`[TaskApiHandler] Error in say call:`, error)
										})
									this.logger.debug(`[MESSAGING-PERSISTENCE] Sent to messaging system successfully`)
									this.log(
										`[TaskApiHandler] Sent to messaging system for persistence: ${chunk.text.substring(0, 100)}...`,
									)
								} catch (error) {
									this.logger.error(`[MESSAGING-PERSISTENCE] Error in messaging system:`, error)
									this.log(`[TaskApiHandler] Error streaming text to messaging:`, error)
								}
							}

							if (this.assistantMessageContent.length > prevLength) {
								this.userMessageContentReady = false
							}

							// Content stored, continue processing - tool execution happens below
							break
						}
					}

					if (abort) {
						this.log(`[TaskApiHandler] Breaking due to abort`)
						break
					}

					if (this.didRejectTool || this.didAlreadyUseTool) {
						this.log(`[TaskApiHandler] Breaking due to tool rejection or already used`)
						break
					}
				}
				this.log(`[TaskApiHandler] Finished iterating over stream`)
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

				// Execute tools if executeTools function is provided
				this.log(`[TaskApiHandler] executeTools function provided: ${!!executeTools}`)
				this.log(
					`[TaskApiHandler] assistantMessageContent:`,
					JSON.stringify(this.assistantMessageContent, null, 2),
				)

				if (executeTools) {
					this.log(
						`[TaskApiHandler] Executing tools for ${this.assistantMessageContent.length} assistant message blocks`,
					)
					try {
						await executeTools(this)
						this.log(`[TaskApiHandler] executeTools completed successfully`)
					} catch (error) {
						this.log(`[TaskApiHandler] executeTools failed:`, error)
						this.userMessageContentReady = true
					}
				} else {
					this.log(`[TaskApiHandler] No executeTools function provided, auto-completing`)
					this.userMessageContentReady = true
				}

				// Wait for userMessageContentReady to be set by tool execution
				await pWaitFor(() => this.userMessageContentReady)

				const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")

				if (!didToolUse) {
					this.userMessageContent.push({
						type: "text",
						text: "No tools were used. Please use a tool or attempt_completion.",
					})
				}

				// Check if task should be completed
				const didUseAttemptCompletion = this.assistantMessageContent.some((block) => {
					if (block.type === "tool_use" && block.name === "attempt_completion") {
						return true
					}
					// Also check in text content for CLI mode
					if (block.type === "text" && block.content.includes("<tool_name>attempt_completion</tool_name>")) {
						return true
					}
					return false
				})

				if (didUseAttemptCompletion) {
					this.log(
						`[TaskApiHandler] Task completed with attempt_completion, calling onTaskCompleted callback`,
					)
					didEndLoop = true
				}

				// If userMessageContent has content, make recursive call
				if (this.userMessageContent.length > 0 && !didEndLoop) {
					this.log(
						`[TaskApiHandler] Making recursive call with ${this.userMessageContent.length} user message blocks`,
					)

					// Make recursive call
					return await this.recursivelyMakeClineRequests(
						this.userMessageContent,
						false, // Don't include file details on recursive calls
						getSystemPrompt,
						getTokenUsage,
						getEnvironmentDetails,
						processUserContentMentions,
						abort,
						consecutiveMistakeCount,
						consecutiveMistakeLimit,
						onMistakeLimitReached,
						onTaskCompleted,
						executeTools,
					)
				}
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

			// Check if task should be completed
			const didUseAttemptCompletion = this.assistantMessageContent.some((block) => {
				if (block.type === "tool_use" && block.name === "attempt_completion") {
					return true
				}
				// Also check in text content for CLI mode
				if (block.type === "text" && block.content.includes("<tool_name>attempt_completion</tool_name>")) {
					return true
				}
				return false
			})

			if (didUseAttemptCompletion || didEndLoop) {
				this.log(`[TaskApiHandler] Task completed, calling onTaskCompleted callback`)
				// Emit task completion
				if (onTaskCompleted) {
					const tokenUsage = getTokenUsage()
					const toolUsage = {} // TODO: implement proper tool usage tracking
					onTaskCompleted(this.taskId, tokenUsage, toolUsage)
				}
				return true
			}

			return didEndLoop
		} catch (error) {
			this.log(`[TaskApiHandler] Error in recursivelyMakeClineRequests:`, error)
			// Still call completion on error to prevent hanging
			if (onTaskCompleted) {
				const tokenUsage = getTokenUsage()
				const toolUsage = {}
				onTaskCompleted(this.taskId, tokenUsage, toolUsage)
			}
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
