import * as path from "path"
import os from "os"
import crypto from "crypto"
import EventEmitter from "events"

import { Anthropic } from "@anthropic-ai/sdk"
import pWaitFor from "p-wait-for"

import {
	type ProviderSettings,
	type TokenUsage,
	type ToolUsage,
	type ToolName,
	type ContextCondense,
	type ClineAsk,
	type ClineMessage,
	type ClineSay,
	type ToolProgressStatus,
	type HistoryItem,
	TelemetryEventName,
} from "@roo-code/types"
import { ITelemetryService } from "../interfaces/ITelemetryService"

// api
import { ApiHandler, buildApiHandler } from "../../api"

// shared
import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { t } from "../../i18n"
import { ClineAskResponse } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"

// services
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { RepoPerTaskCheckpointService } from "../../services/checkpoints"

// integrations
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"
import { RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"

// utils
import { getWorkspacePath } from "../../utils/path"

// prompts
import { formatResponse } from "../prompts/responses"
import { SYSTEM_PROMPT } from "../prompts/system"

// core modules
import { ToolRepetitionDetector } from "../tools/ToolRepetitionDetector"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { ClineProvider } from "../webview/ClineProvider"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { getEnvironmentDetails } from "../environment/getEnvironmentDetails"
import {
	type CheckpointDiffOptions,
	type CheckpointRestoreOptions,
	getCheckpointService,
	checkpointSave,
	checkpointRestore,
	checkpointDiff,
} from "../checkpoints"
import { processUserContentMentions } from "../mentions/processUserContentMentions"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { summarizeConversation } from "../condense"
import { type AssistantMessageContent } from "../assistant-message"

// Interface imports
import { IFileSystem } from "../interfaces/IFileSystem"
import { ITerminal } from "../interfaces/ITerminal"
import { IBrowser } from "../interfaces/IBrowser"

// Modular components
import { TaskMessaging } from "./TaskMessaging"
import { TaskLifecycle } from "./TaskLifecycle"
import { TaskApiHandler } from "./TaskApiHandler"

export type ClineEvents = {
	message: [{ action: "created" | "updated"; message: ClineMessage }]
	taskStarted: []
	taskModeSwitched: [taskId: string, mode: string]
	taskPaused: []
	taskUnpaused: []
	taskAskResponded: []
	taskAborted: []
	taskSpawned: [taskId: string]
	taskCompleted: [taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage]
	taskTokenUsageUpdated: [taskId: string, tokenUsage: TokenUsage]
	taskToolFailed: [taskId: string, tool: ToolName, error: string]
}

export type TaskOptions = {
	provider?: ClineProvider
	apiConfiguration: ProviderSettings
	enableDiff?: boolean
	enableCheckpoints?: boolean
	fuzzyMatchThreshold?: number
	consecutiveMistakeLimit?: number
	task?: string
	images?: string[]
	historyItem?: HistoryItem
	experiments?: Record<string, boolean>
	startTask?: boolean
	rootTask?: Task
	parentTask?: Task
	taskNumber?: number
	onCreated?: (cline: Task) => void
	// New interface dependencies
	fileSystem?: IFileSystem
	terminal?: ITerminal
	browser?: IBrowser
	telemetry?: ITelemetryService
	globalStoragePath?: string
	workspacePath?: string
}

export class Task extends EventEmitter<ClineEvents> {
	readonly taskId: string
	readonly instanceId: string

	readonly rootTask: Task | undefined = undefined
	readonly parentTask: Task | undefined = undefined
	readonly taskNumber: number
	readonly workspacePath: string

	providerRef?: WeakRef<ClineProvider>
	private readonly globalStoragePath: string
	abort: boolean = false
	didFinishAbortingStream = false
	abandoned = false
	isInitialized = false
	isPaused: boolean = false
	pausedModeSlug: string = defaultModeSlug
	private pauseInterval: NodeJS.Timeout | undefined

	// API
	readonly apiConfiguration: ProviderSettings
	api: ApiHandler

	toolRepetitionDetector: ToolRepetitionDetector
	rooIgnoreController?: RooIgnoreController
	fileContextTracker: FileContextTracker
	urlContentFetcher: UrlContentFetcher
	terminalProcess?: RooTerminalProcess

	// Computer User
	browserSession: BrowserSession

	// Editing
	diffViewProvider: DiffViewProvider
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number
	didEditFile: boolean = false

	// Tool Use
	consecutiveMistakeCount: number = 0
	consecutiveMistakeLimit: number
	consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	toolUsage: ToolUsage = {}

	// Checkpoints
	enableCheckpoints: boolean
	checkpointService?: RepoPerTaskCheckpointService
	checkpointServiceInitializing = false

	// Interface dependencies
	private fileSystem?: IFileSystem
	private terminal?: ITerminal
	private browser?: IBrowser
	private telemetryService?: ITelemetryService

	// Modular components
	private messaging: TaskMessaging
	private lifecycle: TaskLifecycle
	private apiHandler: TaskApiHandler

	// Compatibility properties - delegated to modular components
	get isWaitingForFirstChunk() {
		return this.apiHandler.streamingState.isWaitingForFirstChunk
	}
	set isWaitingForFirstChunk(value: boolean) {
		this.apiHandler.setStreamingState({ isWaitingForFirstChunk: value })
	}

	get isStreaming() {
		return this.apiHandler.streamingState.isStreaming
	}
	set isStreaming(value: boolean) {
		this.apiHandler.setStreamingState({ isStreaming: value })
	}

	get currentStreamingContentIndex() {
		return this.apiHandler.streamingState.currentStreamingContentIndex
	}
	set currentStreamingContentIndex(value: number) {
		this.apiHandler.setStreamingState({ currentStreamingContentIndex: value })
	}

	get assistantMessageContent() {
		return this.apiHandler.streamingState.assistantMessageContent
	}
	set assistantMessageContent(value: AssistantMessageContent[]) {
		this.apiHandler.setStreamingState({ assistantMessageContent: value })
	}

	get presentAssistantMessageLocked() {
		return this.apiHandler.streamingState.presentAssistantMessageLocked
	}
	set presentAssistantMessageLocked(value: boolean) {
		this.apiHandler.setStreamingState({ presentAssistantMessageLocked: value })
	}

	get presentAssistantMessageHasPendingUpdates() {
		return this.apiHandler.streamingState.presentAssistantMessageHasPendingUpdates
	}
	set presentAssistantMessageHasPendingUpdates(value: boolean) {
		this.apiHandler.setStreamingState({ presentAssistantMessageHasPendingUpdates: value })
	}

	get userMessageContent() {
		return this.apiHandler.streamingState.userMessageContent
	}
	set userMessageContent(value: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]) {
		this.apiHandler.setStreamingState({ userMessageContent: value })
	}

	get userMessageContentReady() {
		return this.apiHandler.streamingState.userMessageContentReady
	}
	set userMessageContentReady(value: boolean) {
		this.apiHandler.setStreamingState({ userMessageContentReady: value })
	}

	get didRejectTool() {
		return this.apiHandler.streamingState.didRejectTool
	}
	set didRejectTool(value: boolean) {
		this.apiHandler.setStreamingState({ didRejectTool: value })
	}

	get didAlreadyUseTool() {
		return this.apiHandler.streamingState.didAlreadyUseTool
	}
	set didAlreadyUseTool(value: boolean) {
		this.apiHandler.setStreamingState({ didAlreadyUseTool: value })
	}

	get didCompleteReadingStream() {
		return this.apiHandler.streamingState.didCompleteReadingStream
	}
	set didCompleteReadingStream(value: boolean) {
		this.apiHandler.setStreamingState({ didCompleteReadingStream: value })
	}

	// Interface getters for tools
	get fs(): IFileSystem {
		if (!this.fileSystem) {
			throw new Error(
				"FileSystem interface not available. Make sure the Task was initialized with a fileSystem interface.",
			)
		}
		return this.fileSystem
	}

	get term(): ITerminal {
		if (!this.terminal) {
			throw new Error(
				"Terminal interface not available. Make sure the Task was initialized with a terminal interface.",
			)
		}
		return this.terminal
	}

	get browserInterface(): IBrowser {
		if (!this.browser) {
			throw new Error(
				"Browser interface not available. Make sure the Task was initialized with a browser interface.",
			)
		}
		return this.browser
	}

	get telemetry(): ITelemetryService {
		if (!this.telemetryService) {
			// Fallback to global telemetry service for compatibility
			try {
				const { TelemetryService } = require("@roo-code/telemetry")
				return TelemetryService.instance
			} catch (error) {
				// If telemetry package is not available, return a no-op service
				return {
					register: () => {},
					setProvider: () => {},
					updateTelemetryState: () => {},
					captureEvent: () => {},
					captureTaskCreated: () => {},
					captureTaskRestarted: () => {},
					captureTaskCompleted: () => {},
					captureConversationMessage: () => {},
					captureLlmCompletion: () => {},
					captureModeSwitch: () => {},
					captureToolUsage: () => {},
					captureCheckpointCreated: () => {},
					captureCheckpointDiffed: () => {},
					captureCheckpointRestored: () => {},
					captureContextCondensed: () => {},
					captureSlidingWindowTruncation: () => {},
					captureCodeActionUsed: () => {},
					capturePromptEnhanced: () => {},
					captureSchemaValidationError: () => {},
					captureDiffApplicationError: () => {},
					captureShellIntegrationError: () => {},
					captureConsecutiveMistakeError: () => {},
					captureTitleButtonClicked: () => {},
					isTelemetryEnabled: () => false,
					shutdown: async () => {},
				} as ITelemetryService
			}
		}
		return this.telemetryService
	}

	// Messaging compatibility
	get lastMessageTs() {
		return this.messaging.lastMessageTs
	}
	set lastMessageTs(value: number | undefined) {
		this.messaging.lastMessageTs = value
	}

	constructor({
		provider,
		apiConfiguration,
		enableDiff = false,
		enableCheckpoints = true,
		fuzzyMatchThreshold = 1.0,
		consecutiveMistakeLimit = 3,
		task,
		images,
		historyItem,
		startTask = true,
		rootTask,
		parentTask,
		taskNumber = -1,
		onCreated,
		fileSystem,
		terminal,
		browser,
		telemetry,
		globalStoragePath,
		workspacePath,
	}: TaskOptions) {
		super()

		if (startTask && !task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		this.taskId = historyItem ? historyItem.id : crypto.randomUUID()
		this.workspacePath = parentTask
			? parentTask.workspacePath
			: workspacePath || getWorkspacePath(path.join(os.homedir(), "Desktop"))
		this.instanceId = crypto.randomUUID().slice(0, 8)
		this.taskNumber = taskNumber

		// Store interface dependencies
		this.fileSystem = fileSystem
		this.terminal = terminal
		this.browser = browser
		this.telemetryService = telemetry

		// Set up provider and storage
		if (provider) {
			this.providerRef = new WeakRef(provider)
			this.globalStoragePath = provider.context.globalStorageUri.fsPath
		} else {
			this.globalStoragePath = globalStoragePath || path.join(os.homedir(), ".roo-code")
		}

		// Initialize modular components
		this.messaging = new TaskMessaging(
			this.taskId,
			this.instanceId,
			this.taskNumber,
			this.globalStoragePath,
			this.workspacePath,
			this.providerRef,
		)

		this.lifecycle = new TaskLifecycle(
			this.taskId,
			this.instanceId,
			this.messaging,
			() => this.emit("taskStarted"),
			() => this.emit("taskAborted"),
			() => this.emit("taskUnpaused"),
		)

		// Initialize other components
		// Only initialize RooIgnoreController if we have a provider (VS Code mode)
		if (provider) {
			this.rooIgnoreController = new RooIgnoreController(this.workspacePath)
			this.rooIgnoreController.initialize().catch((error) => {
				console.error("Failed to initialize RooIgnoreController:", error)
			})
		}

		if (provider) {
			this.fileContextTracker = new FileContextTracker(provider, this.taskId)
		} else {
			// For CLI usage, create a minimal FileContextTracker implementation
			this.fileContextTracker = {
				dispose: () => {},
				// Add other required methods as needed
			} as any
		}

		this.apiConfiguration = apiConfiguration
		this.api = buildApiHandler(apiConfiguration)

		// Initialize API handler
		this.apiHandler = new TaskApiHandler(
			this.taskId,
			this.instanceId,
			this.api,
			this.messaging,
			this.telemetry,
			this.providerRef,
			(taskId, tokenUsage) => this.emit("taskTokenUsageUpdated", taskId, tokenUsage),
			(taskId, tool, error) => this.emit("taskToolFailed", taskId, tool, error),
			!provider, // cliMode - true if no provider
			apiConfiguration, // cliApiConfiguration
		)

		// For backward compatibility with VS Code extension
		if (provider) {
			this.urlContentFetcher = new UrlContentFetcher(provider.context)
			this.browserSession = new BrowserSession(provider.context)
			this.diffViewProvider = new DiffViewProvider(this.workspacePath)
		} else {
			// For CLI usage, create minimal implementations
			// TODO: Implement CLI-compatible versions
			this.urlContentFetcher = new UrlContentFetcher(null as any)
			this.browserSession = new BrowserSession(null as any)
			this.diffViewProvider = new DiffViewProvider(this.workspacePath)
		}

		this.diffEnabled = enableDiff
		this.fuzzyMatchThreshold = fuzzyMatchThreshold
		this.consecutiveMistakeLimit = consecutiveMistakeLimit
		this.enableCheckpoints = enableCheckpoints

		this.rootTask = rootTask
		this.parentTask = parentTask

		if (historyItem) {
			this.telemetry.captureTaskRestarted(this.taskId)
		} else {
			this.telemetry.captureTaskCreated(this.taskId)
		}

		this.diffStrategy = new MultiSearchReplaceDiffStrategy(this.fuzzyMatchThreshold)
		this.toolRepetitionDetector = new ToolRepetitionDetector(this.consecutiveMistakeLimit)

		onCreated?.(this)

		if (startTask) {
			if (task || images) {
				this.startTask(task, images)
			} else if (historyItem) {
				this.resumeTaskFromHistory()
			} else {
				throw new Error("Either historyItem or task/images must be provided")
			}
		}
	}

	static create(options: TaskOptions): [Task, Promise<void>] {
		const instance = new Task({ ...options, startTask: false })
		const { images, task, historyItem } = options
		let promise

		if (images || task) {
			promise = instance.startTask(task, images)
		} else if (historyItem) {
			promise = instance.resumeTaskFromHistory()
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}

		return [instance, promise]
	}

	// Delegate messaging methods
	async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
		progressStatus?: ToolProgressStatus,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		const result = await this.messaging.ask(type, text, partial, progressStatus, this.abort, (action, message) =>
			this.emit("message", { action, message }),
		)
		this.emit("taskAskResponded")
		return result
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
		options: { isNonInteractive?: boolean } = {},
		contextCondense?: ContextCondense,
	): Promise<undefined> {
		return this.messaging.say(
			type,
			text,
			images,
			partial,
			checkpoint,
			progressStatus,
			options,
			contextCondense,
			this.abort,
			(action, message) => this.emit("message", { action, message }),
		)
	}

	async handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.messaging.handleWebviewAskResponse(askResponse, text, images)
	}

	async handleTerminalOperation(terminalOperation: "continue" | "abort") {
		if (terminalOperation === "continue") {
			this.terminalProcess?.continue()
		} else if (terminalOperation === "abort") {
			this.terminalProcess?.abort()
		}
	}

	public async condenseContext(): Promise<void> {
		const systemPrompt = await this.getSystemPrompt()
		const state = await this.providerRef?.deref()?.getState()
		const customCondensingPrompt = state ? (state as any).customCondensingPrompt : undefined
		const condensingApiConfigId = state ? (state as any).condensingApiConfigId : undefined
		const listApiConfigMeta = state ? (state as any).listApiConfigMeta : undefined

		let condensingApiHandler: ApiHandler | undefined
		if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
			const matchingConfig = listApiConfigMeta.find((config: any) => config.id === condensingApiConfigId)
			if (matchingConfig) {
				const profile = await this.providerRef?.deref()?.providerSettingsManager.getProfile({
					id: condensingApiConfigId,
				})
				if (profile && profile.apiProvider) {
					condensingApiHandler = buildApiHandler(profile)
				}
			}
		}

		const { contextTokens: prevContextTokens } = this.getTokenUsage()
		const {
			messages,
			summary,
			cost,
			newContextTokens = 0,
			error,
		} = await summarizeConversation(
			this.messaging.apiHistory,
			this.api,
			systemPrompt,
			this.taskId,
			prevContextTokens,
			false,
			customCondensingPrompt,
			condensingApiHandler,
		)
		if (error) {
			this.say("condense_context_error", error, undefined, false, undefined, undefined, {
				isNonInteractive: true,
			})
			return
		}
		await this.messaging.overwriteApiConversationHistory(messages)
		const contextCondense: ContextCondense = { summary, cost, newContextTokens, prevContextTokens }
		await this.say(
			"condense_context",
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
			contextCondense,
		)
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string) {
		await this.say(
			"error",
			`Roo tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ""
			} without value for required parameter '${paramName}'. Retrying...`,
		)
		return formatResponse.toolError(formatResponse.missingToolParameterError(paramName))
	}

	// CLI-specific tool execution method
	async executeCliTool(toolName: string, params: any): Promise<string> {
		console.log(`[Task] Executing CLI tool: ${toolName}`)

		// Import tools as needed
		switch (toolName) {
			case "write_to_file": {
				const { writeToFileTool } = await import("../tools/writeToFileTool")
				const result = await this.executeToolWithCLIInterface(writeToFileTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "read_file": {
				const { readFileTool } = await import("../tools/readFileTool")
				const result = await this.executeToolWithCLIInterface(readFileTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "list_files": {
				const { listFilesTool } = await import("../tools/listFilesTool")
				const result = await this.executeToolWithCLIInterface(listFilesTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "attempt_completion": {
				const { attemptCompletionTool } = await import("../tools/attemptCompletionTool")
				const result = await this.executeToolWithCLIInterface(attemptCompletionTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			default:
				throw new Error(`Tool ${toolName} not implemented for CLI mode`)
		}
	}

	// Helper method to execute tools with CLI-compatible interface
	async executeToolWithCLIInterface(
		toolFn: (
			task: Task,
			block: any,
			askApproval: import("../../shared/tools").AskApproval,
			handleError: import("../../shared/tools").HandleError,
			pushToolResult: import("../../shared/tools").PushToolResult,
			removeClosingTag: import("../../shared/tools").RemoveClosingTag,
			toolDescription: import("../../shared/tools").ToolDescription,
			askFinishSubTaskApproval: import("../../shared/tools").AskFinishSubTaskApproval,
		) => Promise<void>,
		block: any,
	): Promise<string> {
		let toolResult = ""

		// CLI-compatible interfaces
		const askApproval = async () => true // Auto-approve in CLI
		const handleError = async (action: string, error: Error) => {
			throw error
		}
		const pushToolResult = (result: any) => {
			if (typeof result === "string") {
				toolResult = result
			} else {
				toolResult = JSON.stringify(result)
			}
		}
		const removeClosingTag = (tag: string, text?: string) => text || ""
		const toolDescription = () => `Tool: ${block.name}`
		const askFinishSubTaskApproval = async () => true // Auto-approve in CLI

		// Execute the tool
		await toolFn(
			this,
			block,
			askApproval,
			handleError,
			pushToolResult,
			removeClosingTag,
			toolDescription,
			askFinishSubTaskApproval,
		)

		return toolResult
	}

	// Delegate lifecycle methods
	private async startTask(task?: string, images?: string[]): Promise<void> {
		await this.lifecycle.startTask(task, images, (userContent) => this.initiateTaskLoop(userContent))
		this.isInitialized = true
	}

	public async resumePausedTask(lastMessage: string) {
		this.isPaused = false
		await this.lifecycle.resumePausedTask(lastMessage)
	}

	private async resumeTaskFromHistory() {
		await this.lifecycle.resumeTaskFromHistory((userContent) => this.initiateTaskLoop(userContent))
		this.isInitialized = true
	}

	public async abortTask(isAbandoned = false) {
		if (isAbandoned) {
			this.abandoned = true
		}

		this.abort = true

		if (this.pauseInterval) {
			clearInterval(this.pauseInterval)
			this.pauseInterval = undefined
		}

		TerminalRegistry.releaseTerminalsForTask(this.taskId)
		this.urlContentFetcher.closeBrowser()
		this.browserSession.closeBrowser()
		this.rooIgnoreController?.dispose()
		this.fileContextTracker.dispose()

		if (this.apiHandler.streamingState.isStreaming && this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges()
		}

		await this.lifecycle.abortTask()
	}

	public async waitForResume() {
		await new Promise<void>((resolve) => {
			this.pauseInterval = setInterval(() => {
				if (!this.isPaused) {
					clearInterval(this.pauseInterval)
					this.pauseInterval = undefined
					resolve()
				}
			}, 1000)
		})
	}

	// Task Loop
	private async initiateTaskLoop(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<void> {
		console.log(`[Task] Initiating task loop for task ${this.taskId}.${this.instanceId}`)
		console.log(`[Task] User content length: ${userContent.length}`)
		console.log(`[Task] User content:`, JSON.stringify(userContent, null, 2))

		try {
			getCheckpointService(this)
			console.log(`[Task] Checkpoint service initialized`)

			let nextUserContent = userContent
			let includeFileDetails = true
			let loopCount = 0

			console.log(`[Task] Starting main task loop`)
			while (!this.abort) {
				loopCount++
				console.log(`[Task] Loop iteration ${loopCount}, abort=${this.abort}`)

				const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
				console.log(`[Task] Loop iteration ${loopCount} completed, didEndLoop=${didEndLoop}`)

				includeFileDetails = false

				if (didEndLoop) {
					console.log(`[Task] Task loop ended successfully after ${loopCount} iterations`)
					break
				} else {
					console.log(`[Task] Continuing loop, mistake count: ${this.consecutiveMistakeCount}`)
					nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
					this.consecutiveMistakeCount++
				}
			}

			if (this.abort) {
				console.log(`[Task] Task loop aborted after ${loopCount} iterations`)
			}
		} catch (error) {
			console.error(`[Task] Error in task loop:`, error)
			throw error
		}
	}

	public async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error(`[RooCode#recursivelyMakeRooRequests] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (this.consecutiveMistakeCount >= this.consecutiveMistakeLimit) {
			const { response, text, images } = await this.ask(
				"mistake_limit_reached",
				t("common:errors.mistake_limit_guidance"),
			)

			if (response === "messageResponse") {
				userContent.push(
					...[
						{ type: "text" as const, text: formatResponse.tooManyMistakes(text) },
						...formatResponse.imageBlocks(images),
					],
				)

				await this.say("user_feedback", text, images)
				this.telemetry.captureConsecutiveMistakeError(this.taskId)
			}

			this.consecutiveMistakeCount = 0
		}

		// Handle paused state
		const provider = this.providerRef?.deref()
		if (this.isPaused && provider) {
			provider.log(`[subtasks] paused ${this.taskId}.${this.instanceId}`)
			await this.waitForResume()
			provider.log(`[subtasks] resumed ${this.taskId}.${this.instanceId}`)
			const currentMode = (await provider.getState())?.mode ?? defaultModeSlug

			if (currentMode !== this.pausedModeSlug) {
				await provider.handleModeSwitch(this.pausedModeSlug)
				await new Promise((resolve) => setTimeout(resolve, 500))
				provider.log(
					`[subtasks] task ${this.taskId}.${this.instanceId} has switched back to '${this.pausedModeSlug}' from '${currentMode}'`,
				)
			}
		}

		return this.apiHandler.recursivelyMakeClineRequests(
			userContent,
			includeFileDetails,
			() => this.getSystemPrompt(),
			() => this.getTokenUsage(),
			(includeFileDetails) => this.getEnvironmentDetails(includeFileDetails),
			(userContent) => this.processUserContentMentions(userContent),
			this.abort,
			this.consecutiveMistakeCount,
			this.consecutiveMistakeLimit,
			() => this.ask("mistake_limit_reached", t("common:errors.mistake_limit_guidance")),
			(taskId, tokenUsage, toolUsage) => this.emit("taskCompleted", taskId, tokenUsage, toolUsage),
			async (taskApiHandler) => {
				console.log(`[Task] CLI tool execution function called`)

				// CLI-specific tool execution
				const assistantContent = taskApiHandler.streamingState.assistantMessageContent
				console.log(`[Task] CLI tool execution for ${assistantContent.length} assistant message blocks`)
				console.log(`[Task] Assistant content:`, JSON.stringify(assistantContent, null, 2))

				for (const block of assistantContent) {
					console.log(`[Task] Processing block type: ${block.type}`)

					if (block.type === "tool_use") {
						console.log(
							`[Task] Executing tool: ${block.name} with params:`,
							JSON.stringify(block.params, null, 2),
						)

						try {
							// Import and execute the specific tool
							const toolResult = await this.executeCliTool(block.name, block.params)
							console.log(`[Task] Tool ${block.name} completed with result:`, toolResult)

							// Add tool result to user message content
							taskApiHandler.streamingState.userMessageContent.push({
								type: "text",
								text: `[${block.name}] Result: ${toolResult || "(tool completed successfully)"}`,
							})

							// Mark that we used a tool
							taskApiHandler.setStreamingState({ didAlreadyUseTool: true })
						} catch (error) {
							console.error(`[Task] Tool execution failed for ${block.name}:`, error)
							taskApiHandler.streamingState.userMessageContent.push({
								type: "text",
								text: `[${block.name}] Error: ${error.message}`,
							})
							taskApiHandler.setStreamingState({ didRejectTool: true })
						}

						// Only execute one tool per message
						break
					}
				}

				console.log(`[Task] CLI tool execution completed, marking userMessageContentReady`)
				// Mark user message content as ready
				taskApiHandler.setStreamingState({ userMessageContentReady: true })
				console.log(`[Task] CLI tool execution function finished`)
			},
		)
	}

	private async getSystemPrompt(): Promise<string> {
		console.log(`[Task] Getting system prompt for task ${this.taskId}.${this.instanceId}`)

		// Check if we're in CLI mode (no provider)
		const provider = this.providerRef?.deref()
		const isCliMode = !provider

		console.log(`[Task] CLI mode: ${isCliMode}`)

		let mcpHub: any | undefined
		let state: any = {}

		if (!isCliMode) {
			// VSCode mode - use provider
			try {
				state = (await provider.getState()) ?? {}
				const { mcpEnabled } = state

				if (mcpEnabled ?? true) {
					const { McpServerManager } = await import("../../services/mcp/McpServerManager")
					mcpHub = await McpServerManager.getInstance(provider.context, provider)

					if (mcpHub) {
						await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 }).catch(() => {
							console.error("MCP servers failed to connect in time")
						})
					}
				}
			} catch (error) {
				console.warn(`[Task] Failed to get provider state:`, error)
			}
		} else {
			// CLI mode - use defaults
			console.log(`[Task] Using default CLI settings`)
			state = {
				mcpEnabled: false, // Disable MCP in CLI for now
				browserViewportSize: "900x600",
				mode: "code",
				customModes: [],
				customModePrompts: {},
				customInstructions: "",
			}
		}

		const rooIgnoreInstructions = this.rooIgnoreController?.getInstructions()

		const {
			browserViewportSize,
			mode,
			customModes,
			customModePrompts,
			customInstructions,
			experiments,
			enableMcpServerCreation,
			browserToolEnabled,
			language,
			maxConcurrentFileReads,
			maxReadFileLine,
		} = state ?? {}

		// Use the provider we already got above, or null for CLI mode
		if (!isCliMode && !provider) {
			throw new Error("Provider not available")
		}

		if (isCliMode) {
			// Return a simple CLI-compatible system prompt
			return `You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.

You have access to tools that let you execute CLI commands on the user's computer, list files, view source code definitions, regex search, read and write files, and ask follow-up questions. These tools help you effectively accomplish a wide range of tasks, such as writing code, making edits or improvements to existing files, understanding the current state of a project, performing system operations, and much more.

# Tool Use Guidelines

1. Choose the most appropriate tool based on the task and the tool descriptions provided.
2. Use one tool at a time per message to accomplish the task iteratively.
3. Always wait for user confirmation after each tool use before proceeding.

Your goal is to try to accomplish the user's task effectively using the available tools.`
		}

		return SYSTEM_PROMPT(
			provider.context,
			this.workspacePath,
			(this.api.getModel().info.supportsComputerUse ?? false) && (browserToolEnabled ?? true),
			mcpHub,
			this.diffStrategy,
			browserViewportSize,
			mode,
			customModePrompts,
			customModes,
			customInstructions,
			this.diffEnabled,
			experiments,
			enableMcpServerCreation,
			language,
			rooIgnoreInstructions,
			maxReadFileLine !== -1,
			{
				maxConcurrentFileReads,
			},
		)
	}

	private async getEnvironmentDetails(includeFileDetails: boolean): Promise<string> {
		return getEnvironmentDetails(this, includeFileDetails)
	}

	private async processUserContentMentions(
		userContent: Anthropic.Messages.ContentBlockParam[],
	): Promise<Anthropic.Messages.ContentBlockParam[]> {
		const { showRooIgnoredFiles = true } = (await this.providerRef?.deref()?.getState()) ?? {}

		return processUserContentMentions({
			userContent,
			cwd: this.workspacePath,
			urlContentFetcher: this.urlContentFetcher,
			fileContextTracker: this.fileContextTracker,
			rooIgnoreController: this.rooIgnoreController,
			showRooIgnoredFiles,
		})
	}

	// Checkpoints
	public async checkpointSave(force: boolean = false) {
		return checkpointSave(this, force)
	}

	public async checkpointRestore(options: CheckpointRestoreOptions) {
		return checkpointRestore(this, options)
	}

	public async checkpointDiff(options: CheckpointDiffOptions) {
		return checkpointDiff(this, options)
	}

	// Metrics
	public combineMessages(messages: ClineMessage[]) {
		return combineApiRequests(combineCommandSequences(messages))
	}

	public getTokenUsage(): TokenUsage {
		return getApiMetrics(this.combineMessages(this.messaging.messages.slice(1)))
	}

	public recordToolUsage(toolName: ToolName) {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].attempts++
	}

	public recordToolError(toolName: ToolName, error?: string) {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].failures++

		if (error) {
			this.emit("taskToolFailed", this.taskId, toolName, error)
		}
	}

	// Getters
	public get cwd() {
		return this.workspacePath
	}

	public get clineMessages() {
		return this.messaging.messages
	}

	public set clineMessages(value: ClineMessage[]) {
		this.messaging.messages = value
	}

	public get apiConversationHistory() {
		return this.messaging.apiHistory
	}

	public set apiConversationHistory(value: (Anthropic.MessageParam & { ts?: number })[]) {
		this.messaging.apiHistory = value
	}

	// Setters for backward compatibility
	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		await this.messaging.overwriteClineMessages(newMessages)
	}

	public async overwriteApiConversationHistory(newHistory: any[]) {
		await this.messaging.overwriteApiConversationHistory(newHistory)
	}
}
