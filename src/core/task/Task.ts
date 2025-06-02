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
import { TelemetryService } from "@roo-code/telemetry"

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
			this.providerRef,
			(taskId, tokenUsage) => this.emit("taskTokenUsageUpdated", taskId, tokenUsage),
			(taskId, tool, error) => this.emit("taskToolFailed", taskId, tool, error),
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
			TelemetryService.instance.captureTaskRestarted(this.taskId)
		} else {
			TelemetryService.instance.captureTaskCreated(this.taskId)
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
		getCheckpointService(this)

		let nextUserContent = userContent
		let includeFileDetails = true

		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false

			if (didEndLoop) {
				break
			} else {
				nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
				this.consecutiveMistakeCount++
			}
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
				TelemetryService.instance.captureConsecutiveMistakeError(this.taskId)
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
		)
	}

	private async getSystemPrompt(): Promise<string> {
		const { mcpEnabled } = (await this.providerRef?.deref()?.getState()) ?? {}
		let mcpHub: any | undefined
		if (mcpEnabled ?? true) {
			const provider = this.providerRef?.deref()
			if (!provider) {
				throw new Error("Provider reference lost during view transition")
			}

			const { McpServerManager } = await import("../../services/mcp/McpServerManager")
			mcpHub = await McpServerManager.getInstance(provider.context, provider)

			if (!mcpHub) {
				throw new Error("Failed to get MCP hub from server manager")
			}

			await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 }).catch(() => {
				console.error("MCP servers failed to connect in time")
			})
		}

		const rooIgnoreInstructions = this.rooIgnoreController?.getInstructions()
		const state = await this.providerRef?.deref()?.getState()

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

		const provider = this.providerRef?.deref()
		if (!provider) {
			throw new Error("Provider not available")
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
