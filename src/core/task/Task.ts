import * as path from "path"
import os from "os"
import crypto from "crypto"
import EventEmitter from "events"
import { getGlobalStoragePath } from "../../shared/paths"

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
	type ModeConfig,
	TelemetryEventName,
} from "@roo-code/types"
import { ITelemetryService } from "../interfaces/ITelemetryService"
import { ILogger, NoOpLogger } from "../interfaces/ILogger"

// api
import { ApiHandler, buildApiHandler } from "../../api"

// shared
import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { t } from "../../i18n"
import { cleanOutput } from "../../utils/cleanOutput"
import { ClineAskResponse } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"

// services
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { RepoPerTaskCheckpointService } from "../../services/checkpoints"

// integrations
import { DiffViewProvider } from "../../integrations/editor/DiffViewProvider"
import { IDiffViewProvider } from "../interfaces/IDiffViewProvider"
import { CLIDiffViewProvider } from "../adapters/cli/CLIDiffViewProvider"
import { RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"

// utils
import { getWorkspacePath } from "../../utils/path"

// prompts
import { formatResponse } from "../prompts/responses"
import { SYSTEM_PROMPT } from "../prompts/system"
import { getToolDescriptionsForMode } from "../prompts/tools"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
} from "../prompts/sections"

// core modules
import { ToolRepetitionDetector } from "../tools/ToolRepetitionDetector"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import { CLIFileContextTracker } from "../adapters/cli/CLIFileContextTracker"
import { IFileContextTracker } from "../interfaces/IFileContextTracker"
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
import { IUserInterface } from "../interfaces/IUserInterface"
import { IStreamingAdapter, IContentOutputAdapter } from "../interfaces/IOutputAdapter"
import { IContentProcessor } from "../interfaces/IContentProcessor"

// Data layer imports
import { RepositoryContainer } from "../data/interfaces"

// Modular components
import { TaskMessaging } from "./TaskMessaging"
import { TaskLifecycle } from "./TaskLifecycle"
import { TaskApiHandler } from "./TaskApiHandler"
import { getCLILogger } from "../../cli/services/CLILogger"

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
	// Mode configuration
	mode?: string
	// New interface dependencies
	fileSystem?: IFileSystem
	terminal?: ITerminal
	browser?: IBrowser
	userInterface?: IUserInterface
	telemetry?: ITelemetryService
	globalStoragePath?: string
	workspacePath?: string
	verbose?: boolean
	logger?: ILogger
	// CLI specific dependencies
	cliUIService?: any // CLIUIService type import would create circular dependency
	// MCP configuration options
	mcpConfigPath?: string
	mcpAutoConnect?: boolean
	mcpTimeout?: number
	mcpRetries?: number
	// Logging configuration
	logSystemPrompt?: boolean
	logLlm?: boolean
	// Data layer support
	repositories?: RepositoryContainer
	// Output adapter (to prevent duplicate creation)
	outputAdapter?: import("../interfaces/IOutputAdapter").IOutputAdapter
	// Unified tool execution support
	customModesService?: import("../../shared/services/UnifiedCustomModesService").UnifiedCustomModesService
	toolInterfaceAdapter?: import("../adapters/ToolInterfaceAdapter").ToolInterfaceAdapter
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
	mode: string = defaultModeSlug
	private pauseInterval: NodeJS.Timeout | undefined

	// API
	readonly apiConfiguration: ProviderSettings
	api: ApiHandler

	toolRepetitionDetector: ToolRepetitionDetector
	rooIgnoreController?: RooIgnoreController
	fileContextTracker: IFileContextTracker
	urlContentFetcher: UrlContentFetcher
	terminalProcess?: RooTerminalProcess

	// Computer User
	browserSession: BrowserSession

	// Editing
	diffViewProvider: IDiffViewProvider
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
	private _userInterface?: IUserInterface
	private cliUIService?: any // CLIUIService instance for CLI mode
	private verbose: boolean = false
	private logger: ILogger = new NoOpLogger()

	// MCP configuration
	private mcpConfigPath?: string
	private mcpAutoConnect: boolean = true
	private mcpTimeout?: number
	private mcpRetries?: number
	private cliMcpService?: any // CLIMcpService instance for CLI mode

	// Logging configuration
	private logSystemPrompt: boolean = false
	private logLlm: boolean = false

	// Modular components
	private messaging: TaskMessaging
	private lifecycle: TaskLifecycle
	private apiHandler: TaskApiHandler

	// Data layer support (optional)
	private repositories?: RepositoryContainer

	// Unified tool execution support
	customModesService?: import("../../shared/services/UnifiedCustomModesService").UnifiedCustomModesService
	toolInterfaceAdapter?: import("../adapters/ToolInterfaceAdapter").ToolInterfaceAdapter

	// Logging methods using injected logger
	private logDebug(message: string, ...args: any[]): void {
		this.logger.debug(message, ...args)
	}

	private logVerbose(message: string, ...args: any[]): void {
		this.logger.verbose(message, ...args)
	}

	private logInfo(message: string, ...args: any[]): void {
		this.logger.info(message, ...args)
	}

	private logError(message: string, ...args: any[]): void {
		this.logger.error(message, ...args)
	}

	private logWarn(message: string, ...args: any[]): void {
		this.logger.warn(message, ...args)
	}

	/**
	 * Write system prompt to log file
	 */
	private async writeSystemPromptToFile(systemPrompt: string): Promise<void> {
		try {
			const fs = await import("fs/promises")
			const path = await import("path")

			// Create logs directory if it doesn't exist
			const logsDir = path.join(this.globalStoragePath, "logs")
			await fs.mkdir(logsDir, { recursive: true })

			// Generate filename with timestamp
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
			const filename = `system-prompt-${timestamp}.txt`
			const filepath = path.join(logsDir, filename)

			// Write system prompt to file
			await fs.writeFile(filepath, systemPrompt, "utf-8")

			this.logInfo(`System prompt logged to: ${filepath}`)
		} catch (error) {
			this.logError("Failed to write system prompt to file:", error)
		}
	}

	/**
	 * Set or update the logger instance
	 */
	setLogger(logger: ILogger): void {
		this.logger = logger
	}

	/**
	 * Get the current logger instance
	 */
	getLogger(): ILogger {
		return this.logger
	}

	private isCliMode(): boolean {
		return !this.providerRef
	}

	get isVerbose(): boolean {
		return this.verbose
	}

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

	get userInterface(): IUserInterface {
		if (!this._userInterface) {
			throw new Error(
				"UserInterface interface not available. Make sure the Task was initialized with a userInterface interface.",
			)
		}
		return this._userInterface
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

	// Data layer access
	get dataRepositories(): RepositoryContainer | undefined {
		return this.repositories
	}

	get hasDataLayer(): boolean {
		return !!this.repositories
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
		mode = defaultModeSlug,
		fileSystem,
		terminal,
		browser,
		userInterface,
		telemetry,
		globalStoragePath,
		workspacePath,
		verbose = false,
		logger,
		cliUIService,
		mcpConfigPath,
		mcpAutoConnect = true,
		mcpTimeout,
		mcpRetries,
		logSystemPrompt = false,
		logLlm = false,
		repositories,
		outputAdapter,
		customModesService,
		toolInterfaceAdapter,
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

		// Store mode configuration
		this.mode = mode
		this.logDebug(`[Task] Constructor - mode set to: ${this.mode}`)
		this.logDebug(`[Task] Constructor - customModesService available: ${!!this.customModesService}`)

		// Store interface dependencies
		this.fileSystem = fileSystem
		this.terminal = terminal
		this.browser = browser
		this._userInterface = userInterface
		this.telemetryService = telemetry
		this.cliUIService = cliUIService
		this.verbose = verbose
		this.repositories = repositories
		this.logger = logger || new NoOpLogger()

		// Store MCP configuration
		this.mcpConfigPath = mcpConfigPath
		this.mcpAutoConnect = mcpAutoConnect
		this.mcpTimeout = mcpTimeout
		this.mcpRetries = mcpRetries

		// Store logging configuration
		this.logSystemPrompt = logSystemPrompt
		this.logLlm = logLlm

		// Store unified tool execution support
		this.customModesService = customModesService
		this.toolInterfaceAdapter = toolInterfaceAdapter

		// Set up provider and storage
		if (provider) {
			this.providerRef = new WeakRef(provider)
			this.globalStoragePath = provider.context.globalStorageUri.fsPath
		} else {
			this.globalStoragePath = globalStoragePath || getGlobalStoragePath()
		}

		// Use provided output adapter or create one based on mode
		let taskOutputAdapter: import("../interfaces/IOutputAdapter").IOutputAdapter | undefined

		if (outputAdapter) {
			// Use the provided output adapter (from CLIProvider, etc.)
			this.logDebug("[Task] Using provided output adapter")
			taskOutputAdapter = outputAdapter
		} else {
			// Create appropriate output adapter based on mode
			try {
				if (provider) {
					// VSCode Extension mode - use VSCode output adapter
					this.logDebug("[Task] VSCode mode detected - creating VSCode output adapter")
					const { VSCodeOutputAdapter } = require("../adapters/vscode/VSCodeOutputAdapter")
					taskOutputAdapter = new VSCodeOutputAdapter(provider)
				} else if (userInterface) {
					// API mode - will implement SSE adapter later
					this.logDebug("[Task] API mode detected - using legacy userInterface for now")
					taskOutputAdapter = undefined // Will implement SSE adapter later
				} else {
					// CLI mode - use CLI output adapter
					this.logDebug("[Task] CLI mode detected - creating CLI output adapter")
					const { CLIOutputAdapter } = require("../adapters/cli/CLIOutputAdapters")
					taskOutputAdapter = new CLIOutputAdapter(this.globalStoragePath, true, this.logger)
				}
			} catch (error) {
				this.logError("[Task] Error creating output adapter:", error)
				taskOutputAdapter = undefined // Fall back to legacy methods
			}
		}

		// Initialize modular components
		this.messaging = new TaskMessaging(
			this.taskId,
			this.instanceId,
			this.taskNumber,
			this.globalStoragePath,
			this.workspacePath,
			this.providerRef,
			taskOutputAdapter,
		)

		this.lifecycle = new TaskLifecycle(
			this.taskId,
			this.instanceId,
			this.messaging,
			() => this.emit("taskStarted"),
			() => this.emit("taskAborted"),
			() => this.emit("taskUnpaused"),
			this.isCliMode(),
		)

		// Initialize other components
		// Initialize RooIgnoreController in both VS Code and CLI modes
		// Enable file watcher only in VSCode mode (when provider exists)
		this.rooIgnoreController = new RooIgnoreController(this.workspacePath, !!provider)
		this.rooIgnoreController.initialize().catch((error) => {
			this.logError("Failed to initialize RooIgnoreController:", error)
		})

		if (provider) {
			this.fileContextTracker = new FileContextTracker(provider, this.taskId)
		} else {
			// For CLI usage, use the CLI implementation
			this.fileContextTracker = new CLIFileContextTracker(this.taskId)
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
			(taskId: string, tokenUsage: any) => this.emit("taskTokenUsageUpdated", taskId, tokenUsage),
			(taskId: string, tool: ToolName, error: string) => this.emit("taskToolFailed", taskId, tool, error),
			(action: "created" | "updated", message: any) => this.emit("message", { action, message }), // onMessage callback
			!provider && !this._userInterface, // cliMode - true only if no provider AND no userInterface (true CLI mode)
			undefined, // cliApiConfiguration
			new WeakRef(this), // taskRef - reference to this Task instance
			this.logger, // logger
		)

		// For backward compatibility with VS Code extension
		if (provider) {
			this.urlContentFetcher = new UrlContentFetcher(provider.context)
			this.browserSession = new BrowserSession(provider.context)
			this.diffViewProvider = new DiffViewProvider(this.workspacePath)
		} else {
			// For CLI usage, create CLI-compatible implementations
			this.urlContentFetcher = new UrlContentFetcher(null as any)
			this.browserSession = new BrowserSession(null as any)
			this.diffViewProvider = new CLIDiffViewProvider(this.workspacePath)
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

		// Set up cleanup event listeners for CLI mode
		if (!provider) {
			this.on("taskCompleted", async () => {
				try {
					await this.dispose()
				} catch (error) {
					this.logDebug("Error during cleanup:", error)
				}
			})

			this.on("taskAborted", async () => {
				try {
					await this.dispose()
				} catch (error) {
					this.logDebug("Error during cleanup:", error)
				}
			})
		}
	}

	// Dispose method to clean up MCP connections and other resources
	async dispose(): Promise<void> {
		// Note: Don't dispose the MCP service in CLI mode since it's a shared global instance
		// The global MCP service will be disposed when the CLI shuts down
		if (this.cliMcpService) {
			this.logDebug("[Task] Releasing reference to shared MCP service...")
			this.cliMcpService = undefined
		}

		// Clean up data layer repositories if present
		if (this.repositories?.dispose) {
			try {
				await this.repositories.dispose()
				this.logDebug("[Task] Data layer repositories disposed")
			} catch (error) {
				this.logError("[Task] Error disposing data layer repositories:", error)
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

	// Unified tool execution method using presentAssistantMessage pattern
	async executeUnifiedTools(): Promise<void> {
		this.logDebug(`[Task] Executing unified tools via presentAssistantMessage`)

		if (!this.toolInterfaceAdapter) {
			throw new Error("Tool interface adapter not available for unified tool execution")
		}

		// Import presentAssistantMessage
		const { presentAssistantMessage } = await import("../assistant-message/presentAssistantMessage")

		// Execute tools using the unified pattern
		await presentAssistantMessage(this)
	}

	// CLI-specific tool execution method
	async executeCliTool(toolName: string, params: any): Promise<string> {
		this.logDebug(`[Task] Executing CLI tool: ${toolName}`)

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

			case "list_code_definition_names": {
				const { listCodeDefinitionNamesTool } = await import("../tools/listCodeDefinitionNamesTool")
				const result = await this.executeToolWithCLIInterface(listCodeDefinitionNamesTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "search_files": {
				const { searchFilesTool } = await import("../tools/searchFilesTool")
				const result = await this.executeToolWithCLIInterface(searchFilesTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "search_and_replace": {
				const { searchAndReplaceTool } = await import("../tools/searchAndReplaceTool")
				const result = await this.executeToolWithCLIInterface(searchAndReplaceTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "execute_command": {
				const { executeCommandTool } = await import("../tools/executeCommandTool")
				const result = await this.executeToolWithCLIInterface(executeCommandTool, {
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

			case "use_mcp_tool": {
				if (!this.cliMcpService) {
					throw new Error("MCP service not available in CLI mode")
				}

				this.logDebug(`[CLI MCP] Executing tool: ${params.tool_name} on server: ${params.server_name}`)
				this.logDebug(`[CLI MCP] Arguments:`, params.arguments)

				try {
					const parsedArgs = JSON.parse(params.arguments)
					this.logDebug(`[CLI MCP] Parsed arguments:`, JSON.stringify(parsedArgs, null, 2))

					const result = await this.cliMcpService.executeTool(
						params.server_name,
						params.tool_name,
						parsedArgs,
					)

					this.logDebug(`[CLI MCP] Tool execution result:`, JSON.stringify(result, null, 2))

					if (!result.success) {
						const errorMsg = result.error || "Tool execution failed"
						this.logError(`[CLI MCP] Tool execution failed: ${errorMsg}`)
						throw new Error(`MCP tool execution failed: ${errorMsg}`)
					}

					// Format result similar to extension version
					const formattedResult = result.result
						? typeof result.result === "string"
							? result.result
							: JSON.stringify(result.result, null, 2)
						: "(No response)"

					this.logDebug(`[CLI MCP] Formatted result:`, formattedResult)
					return formattedResult
				} catch (parseError) {
					this.logError(`[CLI MCP] Failed to parse arguments:`, parseError)
					throw new Error(`Invalid JSON arguments for MCP tool: ${parseError.message}`)
				}
			}

			case "access_mcp_resource": {
				if (!this.cliMcpService) {
					throw new Error("MCP service not available in CLI mode")
				}
				const result = await this.cliMcpService.accessResource(params.server_name, params.uri)
				return JSON.stringify(result, null, 2)
			}

			case "ask_followup_question": {
				// Use the new question handling system
				const { TaskQuestionService } = await import("../question-handling/services/TaskQuestionService")
				const { createCLIQuestionHandler } = await import("../question-handling/handlers/CLIQuestionHandler")

				// Use the injected CLI UI service or create a fallback
				let promptManager: any
				if (this.cliUIService) {
					promptManager = this.cliUIService.getPromptManager()
				} else {
					// Fallback: create a new CLI UI service if none was injected
					const { CLIUIService } = await import("../../cli/services/CLIUIService")
					const fallbackUIService = new CLIUIService(true) // Enable color by default
					promptManager = fallbackUIService.getPromptManager()
				}

				// Create CLI question handler
				const handler = createCLIQuestionHandler({
					promptManager,
					logger: this,
				})

				// Create question service
				const questionService = new TaskQuestionService(handler, this)

				// Ask the question
				const response = await questionService.askFollowupQuestion(
					params.question,
					params.follow_up,
					false, // not partial for CLI
				)

				// Return formatted response
				return questionService.formatResponseForTool(response)
			}

			case "list_modes": {
				// Import and use the list modes tool
				const { listModesTool } = await import("../tools/listModesTool")
				const result = await this.executeToolWithCLIInterface(listModesTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "switch_mode": {
				// Import and use the switch mode tool
				const { switchModeTool } = await import("../tools/switchModeTool")
				const result = await this.executeToolWithCLIInterface(switchModeTool, {
					name: toolName,
					params,
					type: "tool_use",
					partial: false,
				})
				return result
			}

			case "new_task": {
				// Import and use the new task tool
				const { newTaskTool } = await import("../tools/newTaskTool")
				const result = await this.executeToolWithCLIInterface(newTaskTool, {
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

	// Public method to execute MCP tools in both CLI and extension contexts
	async executeMcpTool(
		serverName: string,
		toolName: string,
		args: any,
	): Promise<{ success: boolean; result?: any; error?: string }> {
		this.logDebug(`[MCP] executeMcpTool called: server=${serverName}, tool=${toolName}`)
		this.logDebug(`[MCP] Args:`, JSON.stringify(args, null, 2))
		this.logDebug(`[MCP] CLI MCP Service available:`, !!this.cliMcpService)
		this.logDebug(`[MCP] Provider ref available:`, !!this.providerRef?.deref())

		try {
			if (this.cliMcpService) {
				// CLI mode - use CLI MCP service
				this.logDebug(`[CLI MCP] Using CLI MCP service for tool execution`)
				this.logDebug(
					`[CLI MCP] Connected servers:`,
					this.cliMcpService.getConnectedServers().map((s: any) => s.id),
				)

				const result = await this.cliMcpService.executeTool(serverName, toolName, args)
				this.logDebug(
					`[CLI MCP] Tool execution completed: ${toolName} -> ${result.success ? "SUCCESS" : "ERROR"}`,
				)
				this.logDebug(`[CLI MCP] Result:`, JSON.stringify(result, null, 2))
				return result
			} else if (this.providerRef?.deref()) {
				// VS Code extension mode - use MCP hub
				this.logDebug(`[MCP] Using VS Code extension MCP hub`)
				const mcpHub = this.providerRef.deref()?.getMcpHub()
				if (!mcpHub) {
					this.logError(`[MCP] MCP hub not available in extension mode`)
					return { success: false, error: "MCP hub not available in extension mode" }
				}

				const toolResult = await mcpHub.callTool(serverName, toolName, args)
				const success = !toolResult?.isError
				const result =
					toolResult?.content
						?.map((item: any) => {
							if (item.type === "text") {
								return item.text
							}
							if (item.type === "resource") {
								const { blob: _, ...rest } = item.resource
								return JSON.stringify(rest, null, 2)
							}
							return ""
						})
						.filter(Boolean)
						.join("\n\n") || "(No response)"

				this.logDebug(`[MCP] Extension tool execution completed: ${success ? "SUCCESS" : "ERROR"}`)
				return { success, result, error: success ? undefined : result }
			} else {
				this.logError(`[MCP] No MCP service available in current context`)
				return { success: false, error: "MCP service not available in current context" }
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.logError(`[MCP] Tool execution failed:`, error)
			this.logError(`[MCP] Error stack:`, error instanceof Error ? error.stack : "No stack trace")
			return { success: false, error: errorMessage }
		}
	}

	// Parse tool uses from text content for CLI mode
	private parseToolUsesFromText(content: string): Array<{ name: string; params: any }> {
		const toolUses: Array<{ name: string; params: any }> = []

		// Look for tool_use tags in the content
		const toolUseRegex = /<tool_use>\s*<tool_name>([^<]+)<\/tool_name>(.*?)<\/tool_use>/gs
		let match

		while ((match = toolUseRegex.exec(content)) !== null) {
			const toolName = match[1].trim()
			const paramsContent = match[2]

			// Parse parameters
			const params: any = {}
			const paramRegex =
				/<parameter_name>([^<]+)<\/parameter_name>\s*<parameter_name>value<\/parameter_name>([^<]*?)(?=<parameter_name>|<\/tool_use>|$)/gs
			let paramMatch

			while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
				const paramName = paramMatch[1].trim()
				const paramValue = paramMatch[2].trim()
				params[paramName] = paramValue
			}

			// Also try the standard format with parameter values
			const standardParamRegex =
				/<parameter_name>([^<]+)<\/parameter_name>\s*<parameter_name>value<\/parameter_name>([^<]*?)(?=<parameter_name>|<\/tool_use>|$)/gs
			let standardMatch

			while ((standardMatch = standardParamRegex.exec(paramsContent)) !== null) {
				const paramName = standardMatch[1].trim()
				const paramValue = standardMatch[2].trim()
				params[paramName] = paramValue
			}

			// Try simpler format: <parameter_name>param</parameter_name><parameter_name>value</parameter_name>content
			const simpleParamRegex =
				/<parameter_name>([^<]+)<\/parameter_name>\s*<parameter_name>value<\/parameter_name>\s*([^<]*?)(?=<parameter_name>|<\/tool_use>|$)/gs
			let simpleMatch

			while ((simpleMatch = simpleParamRegex.exec(paramsContent)) !== null) {
				const paramName = simpleMatch[1].trim()
				const paramValue = simpleMatch[2].trim()
				params[paramName] = paramValue
			}

			this.logDebug(`[Task] Parsed tool: ${toolName} with params:`, params)
			toolUses.push({ name: toolName, params })
		}

		return toolUses
	}

	// Delegate lifecycle methods
	private async startTask(task?: string, images?: string[]): Promise<void> {
		console.log(`[TASK-DEBUG] startTask() called with task: "${task}", images: ${images?.length || 0}`)
		await this.lifecycle.startTask(task, images, (userContent) => this.initiateTaskLoop(userContent))
		console.log(`[TASK-DEBUG] startTask() completed, isInitialized: ${this.isInitialized}`)
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
		console.log(`[TASK-DEBUG] initiateTaskLoop() called for task ${this.taskId}.${this.instanceId}`)
		console.log(`[TASK-DEBUG] Current mode: ${this.mode}`)
		console.log(`[TASK-DEBUG] User content length: ${userContent.length}`)
		console.log(`[TASK-DEBUG] About to call recursivelyMakeClineRequests`)
		console.log(`[TASK-DEBUG] Abort flag: ${this.abort}`)
		this.logDebug(`[Task] initiateTaskLoop() called for task ${this.taskId}.${this.instanceId}`)
		this.logDebug(`[Task] Current mode: ${this.mode}`)
		this.logDebug(`[Task] User content length: ${userContent.length}`)
		this.logDebug(`[Task] User content:`, JSON.stringify(userContent, null, 2))
		this.logDebug(`[Task] About to call recursivelyMakeClineRequests`)

		try {
			getCheckpointService(this)
			this.logDebug(`[Task] Checkpoint service initialized`)

			let nextUserContent = userContent
			let includeFileDetails = true
			let loopCount = 0

			this.logDebug(`[Task] Starting main task loop`)
			while (!this.abort) {
				loopCount++
				this.logDebug(`[Task] Loop iteration ${loopCount}, abort=${this.abort}`)

				const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
				this.logDebug(`[Task] Loop iteration ${loopCount} completed, didEndLoop=${didEndLoop}`)

				includeFileDetails = false

				if (didEndLoop) {
					this.logDebug(`[Task] Task loop ended successfully after ${loopCount} iterations`)
					break
				} else {
					this.logDebug(`[Task] Continuing loop, mistake count: ${this.consecutiveMistakeCount}`)
					nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
					this.consecutiveMistakeCount++
				}
			}

			if (this.abort) {
				this.logDebug(`[Task] Task loop aborted after ${loopCount} iterations`)
			}
		} catch (error) {
			this.logError(`[Task] Error in task loop:`, error)
			throw error
		}
	}

	public async recursivelyMakeClineRequests(
		userContent: Anthropic.Messages.ContentBlockParam[],
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		this.logDebug(`[Task] recursivelyMakeClineRequests() called`)
		this.logDebug(`[Task] Current mode: ${this.mode}`)
		this.logDebug(`[Task] About to call getSystemPrompt()`)

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

		console.log(`[TASK-DEBUG] About to call apiHandler.recursivelyMakeClineRequests`)
		console.log(`[TASK-DEBUG] Abort flag before API call: ${this.abort}`)
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
			(taskId, tokenUsage, toolUsage) => {
				console.log(`[TASK-DEBUG] taskCompleted event about to be emitted`)
				console.log(`[TASK-DEBUG] TaskId: ${taskId}`)
				console.log(`[TASK-DEBUG] Token usage:`, tokenUsage)
				console.log(`[TASK-DEBUG] Tool usage:`, toolUsage)
				console.log(`[TASK-DEBUG] Stack trace:`, new Error().stack)
				this.emit("taskCompleted", taskId, tokenUsage, toolUsage)
			},
			async (taskApiHandler) => {
				this.logDebug(`[Task] CLI tool execution function called`)

				// CLI-specific tool execution
				const assistantContent = taskApiHandler.streamingState.assistantMessageContent
				this.logDebug(`[Task] CLI tool execution for ${assistantContent.length} assistant message blocks`)
				this.logDebug(`[Task] Assistant content:`, JSON.stringify(assistantContent, null, 2))

				// Check for attempt_completion to detect task completion
				let foundAttemptCompletion = false
				let executedTool = false

				for (const block of assistantContent) {
					this.logDebug(`[Task] Processing block type: ${block.type}`)

					if (block.type === "tool_use") {
						this.logDebug(
							`[Task] Executing tool: ${block.name} with params:`,
							JSON.stringify(block.params, null, 2),
						)

						// Check for attempt_completion
						if (block.name === "attempt_completion") {
							foundAttemptCompletion = true
							this.logDebug(`[Task] Found attempt_completion tool, executing it`)

							try {
								// Execute the attempt_completion tool properly
								const toolResult = await this.executeCliTool(block.name, block.params)
								this.logDebug(`[Task] attempt_completion executed with result:`, toolResult)

								// Get the result for internal processing
								const result = block.params?.result || "Task completed"

								// Add completion result to user message content
								taskApiHandler.streamingState.userMessageContent.push({
									type: "text",
									text: `Task completed: ${cleanOutput(result)}`,
								})
								executedTool = true
								break
							} catch (error) {
								this.logError(`[Task] attempt_completion failed:`, error)
								taskApiHandler.streamingState.userMessageContent.push({
									type: "text",
									text: `<tool_result>\nError: ${error.message}\n</tool_result>`,
								})
								executedTool = true
								break
							}
						}

						try {
							// Import and execute the specific tool
							const toolResult = await this.executeCliTool(block.name, block.params)
							this.logDebug(`[Task] Tool ${block.name} completed with result:`, toolResult)

							// Add tool result to user message content
							taskApiHandler.streamingState.userMessageContent.push({
								type: "text",
								text: `<tool_result>\n${toolResult || "(tool completed successfully)"}\n</tool_result>`,
							})

							executedTool = true
							// Mark that we used a tool
							taskApiHandler.setStreamingState({ didAlreadyUseTool: true })
						} catch (error) {
							this.logError(`[Task] Tool execution failed for ${block.name}:`, error)
							taskApiHandler.streamingState.userMessageContent.push({
								type: "text",
								text: `<tool_result>\nError: ${error.message}\n</tool_result>`,
							})
							taskApiHandler.setStreamingState({ didRejectTool: true })
							executedTool = true
						}

						// Only execute one tool per message
						break
					} else if (block.type === "text") {
						// Parse text content to extract tool uses manually for CLI mode
						const toolUses = this.parseToolUsesFromText(block.content)
						this.logDebug(`[Task] Parsed ${toolUses.length} tool uses from text content`)

						for (const toolUse of toolUses) {
							this.logDebug(`[Task] Executing parsed tool: ${toolUse.name}`)

							// Check for attempt_completion
							if (toolUse.name === "attempt_completion") {
								foundAttemptCompletion = true
								this.logDebug(`[Task] Found attempt_completion in text, task should complete`)

								const result = toolUse.params?.result || "Task completed"
								taskApiHandler.streamingState.userMessageContent.push({
									type: "text",
									text: `Task completed: ${cleanOutput(result)}`,
								})
								executedTool = true
								break
							}

							try {
								const toolResult = await this.executeCliTool(toolUse.name, toolUse.params)
								// Debug: Tool completed (only log in verbose mode)

								taskApiHandler.streamingState.userMessageContent.push({
									type: "text",
									text: `<tool_result>\n${toolResult || "(tool completed successfully)"}\n</tool_result>`,
								})

								executedTool = true
								taskApiHandler.setStreamingState({ didAlreadyUseTool: true })
							} catch (error) {
								this.logError(`[Task] Parsed tool execution failed for ${toolUse.name}:`, error)
								taskApiHandler.streamingState.userMessageContent.push({
									type: "text",
									text: `<tool_result>\nError: ${error.message}\n</tool_result>`,
								})
								taskApiHandler.setStreamingState({ didRejectTool: true })
								executedTool = true
							}
							break // Only execute one tool per message
						}

						if (executedTool) break
					}
				}

				// If no tools were executed, add default response
				if (!executedTool) {
					// Debug: No tools executed (only log in verbose mode)
					taskApiHandler.streamingState.userMessageContent.push({
						type: "text",
						text: "Message received. Continue with the task.",
					})
				}

				// Debug: CLI tool execution completed (only log in verbose mode)
				// Mark user message content as ready
				taskApiHandler.setStreamingState({ userMessageContentReady: true })

				// Set task completion flag if attempt_completion was found
				if (foundAttemptCompletion) {
					// Debug: Setting task as completed (only log in verbose mode)
					// Mark that the task should complete by setting userMessageContent to empty
					// This will cause the recursion to return true and end the loop
					taskApiHandler.streamingState.userMessageContent = []
				}

				// Debug: CLI tool execution function finished (only log in verbose mode)
			},
		)
	}

	private async getSystemPrompt(): Promise<string> {
		this.logDebug(`[Task] Starting system prompt generation...`)

		try {
			// Check if we're in CLI mode (no provider)
			const provider = this.providerRef?.deref()
			const isCliMode = !provider

			// Debug: CLI mode status (only log in verbose mode)

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
								this.logError("MCP servers failed to connect in time")
							})
						}
					}
				} catch (error) {
					this.logWarn(`[Task] Failed to get provider state:`, error)
				}
			} else {
				// CLI mode - use defaults and enable MCP
				// Debug: Using default CLI settings (only log in verbose mode)
				state = {
					mcpEnabled: true, // Enable MCP in CLI mode
					browserViewportSize: "900x600",
					mode: "code",
					customModes: [],
					customModePrompts: {},
					customInstructions: "",
				}

				// Use global MCP service for CLI mode
				try {
					const { GlobalCLIMcpService } = await import("../../cli/services/GlobalCLIMcpService")
					const globalMcpService = GlobalCLIMcpService.getInstance()

					if (globalMcpService.isInitialized()) {
						// Get the shared MCP service instance
						this.cliMcpService = globalMcpService.getMcpService()

						// Create a compatible interface for getMcpServersSection
						mcpHub = globalMcpService.createMcpHub()

						// Populate tools and resources for each server
						if (mcpHub) {
							await globalMcpService.populateServerCapabilities(mcpHub)
						}
					} else {
						this.logDebug("[Task] Global MCP service not initialized - MCP features will be unavailable")
					}
				} catch (error) {
					this.logDebug(`[Task] Failed to use global MCP service:`, error)
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
				// Generate CLI-specific system prompt using the same components as VSCode extension
				const {
					getRulesSection,
					getSystemInfoSection,
					getObjectiveSection,
					getSharedToolUseSection,
					getMcpServersSection,
					getToolUseGuidelinesSection,
					getCapabilitiesSection,
					markdownFormattingSection,
				} = await import("../prompts/sections")

				const { getToolDescriptionsForMode } = await import("../prompts/tools")
				const { getModeSelection } = await import("../../shared/modes")
				const { modes } = await import("../../shared/modes")

				// Get mode configuration
				const mode = this.mode
				this.logDebug(`[Task] getSystemPrompt() called with mode: ${mode}`)
				this.logDebug(`[Task] customModesService available: ${!!this.customModesService}`)

				let modeConfig: ModeConfig | undefined
				let allCustomModes: ModeConfig[] = []

				// First check custom modes if available
				if (this.customModesService) {
					this.logDebug(`[Task] Attempting to load custom modes...`)
					console.log(`[SYSTEM-PROMPT-DEBUG] About to call customModesService.getAllModes()`)
					try {
						allCustomModes = await this.customModesService.getAllModes()
						console.log(`[SYSTEM-PROMPT-DEBUG] Successfully loaded ${allCustomModes.length} custom modes`)
						this.logDebug(
							`[Task] Loaded ${allCustomModes.length} custom modes:`,
							allCustomModes.map((m) => m.slug),
						)
						modeConfig = allCustomModes.find((m) => m.slug === mode)
						console.log(`[SYSTEM-PROMPT-DEBUG] Found custom mode config for '${mode}':`, !!modeConfig)
						this.logDebug(`[Task] Found custom mode config for '${mode}':`, !!modeConfig)
						if (modeConfig) {
							this.logDebug(`[Task] Custom mode details:`, {
								slug: modeConfig.slug,
								name: modeConfig.name,
							})
						}
					} catch (error) {
						console.log(`[SYSTEM-PROMPT-DEBUG] Error loading custom modes:`, error)
						this.logDebug(`[Task] Failed to load custom modes:`, error)
						throw error // Re-throw to see if this is causing the completion
					}
				} else {
					this.logDebug(`[Task] No customModesService available, using built-in modes only`)
				}

				// Fall back to built-in modes if not found in custom modes
				if (!modeConfig) {
					this.logDebug(`[Task] Custom mode not found, checking built-in modes...`)
					modeConfig = modes.find((m) => m.slug === mode) || modes[0]
					this.logDebug(`[Task] Built-in mode found for '${mode}':`, !!modes.find((m) => m.slug === mode))
					this.logDebug(`[Task] Final mode config:`, { slug: modeConfig.slug, name: modeConfig.name })
				}

				this.logDebug(
					`[Task] Calling getModeSelection with mode: ${mode}, customModes count: ${allCustomModes.length}`,
				)
				console.log(`[SYSTEM-PROMPT-DEBUG] About to call getModeSelection`)
				const { roleDefinition } = getModeSelection(mode, undefined, allCustomModes)
				console.log(
					`[SYSTEM-PROMPT-DEBUG] getModeSelection completed, roleDefinition length: ${roleDefinition?.length || 0}`,
				)
				this.logDebug(
					`[Task] getModeSelection completed, roleDefinition length: ${roleDefinition?.length || 0}`,
				)

				// Check if this mode supports MCP
				console.log(`[SYSTEM-PROMPT-DEBUG] About to check modeConfig.groups, modeConfig:`, modeConfig)
				const enableMcpServerCreation = modeConfig.groups.some(
					(groupEntry) => (typeof groupEntry === "string" ? groupEntry : groupEntry[0]) === "mcp",
				)
				console.log(
					`[SYSTEM-PROMPT-DEBUG] MCP check completed, enableMcpServerCreation: ${enableMcpServerCreation}`,
				)

				// Build the same comprehensive prompt as VSCode extension
				console.log(`[SYSTEM-PROMPT-DEBUG] About to build system prompt`)
				console.log(`[SYSTEM-PROMPT-DEBUG] roleDefinition length: ${roleDefinition?.length}`)

				console.log(`[SYSTEM-PROMPT-DEBUG] Calling markdownFormattingSection()`)
				const markdownSection = markdownFormattingSection()
				console.log(`[SYSTEM-PROMPT-DEBUG] markdownFormattingSection() completed`)

				console.log(`[SYSTEM-PROMPT-DEBUG] Calling getSharedToolUseSection()`)
				const sharedToolSection = getSharedToolUseSection()
				console.log(`[SYSTEM-PROMPT-DEBUG] getSharedToolUseSection() completed`)

				console.log(`[SYSTEM-PROMPT-DEBUG] Calling getToolDescriptionsForMode()`)
				const toolDescriptions = getToolDescriptionsForMode(
					mode,
					this.workspacePath,
					false, // supportsComputerUse - disable browser tool in CLI
					undefined, // codeIndexManager - CLI doesn't need code indexing
					undefined, // diffStrategy
					"900x600", // browserViewportSize
					mcpHub, // mcpHub - now enabled in CLI
					allCustomModes, // customModeConfigs - pass the loaded custom modes
					{}, // experiments
					true, // partialReadsEnabled
					{}, // settings
				)
				console.log(`[SYSTEM-PROMPT-DEBUG] getToolDescriptionsForMode() completed`)

				console.log(`[SYSTEM-PROMPT-DEBUG] Calling getMcpServersSection()`)
				const mcpServersSection = await getMcpServersSection(mcpHub, undefined, enableMcpServerCreation)
				console.log(`[SYSTEM-PROMPT-DEBUG] getMcpServersSection() completed`)

				console.log(`[SYSTEM-PROMPT-DEBUG] Calling remaining sections`)
				const toolUseGuidelines = getToolUseGuidelinesSection()
				const capabilities = getCapabilitiesSection(this.workspacePath, false, undefined, undefined, undefined)
				const rules = getRulesSection(this.workspacePath, false, undefined)
				const systemInfo = getSystemInfoSection(this.workspacePath)
				const objective = getObjectiveSection()
				console.log(`[SYSTEM-PROMPT-DEBUG] All sections completed`)

				const systemPrompt = `${roleDefinition}

${markdownSection}

${sharedToolSection}

${toolDescriptions}

${mcpServersSection}

${toolUseGuidelines}

${capabilities}

${rules}

${systemInfo}

${objective}`

				return systemPrompt
			}

			// In CLI mode, provider might be undefined, so we need to handle this case
			if (!provider) {
				// For CLI mode, create a minimal system prompt that includes MCP server information
				const mcpServersSection = await getMcpServersSection(
					mcpHub,
					this.diffEnabled ? this.diffStrategy : undefined,
					enableMcpServerCreation,
				)

				const systemPrompt = `You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices. Applying the wisdom in this document (docs/prompts/development-prompt.md), you write the application code

====

MARKDOWN RULES

ALL responses MUST show ANY \`language construct\` OR filename reference as clickable, exactly as [\`filename OR language.declaration()\`](relative/file/path.ext:line); line is required for \`syntax\` and optional for filename links. This applies to ALL markdown responses and ALSO those in <attempt_completion>

====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

${getToolDescriptionsForMode(
	mode,
	this.workspacePath,
	(this.api.getModel().info.supportsComputerUse ?? false) && (browserToolEnabled ?? true),
	undefined, // codeIndexManager not available in CLI mode
	this.diffEnabled ? this.diffStrategy : undefined,
	browserViewportSize,
	mcpHub,
	customModes,
	experiments,
	maxReadFileLine !== -1,
	{
		maxConcurrentFileReads,
	},
)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(this.workspacePath, (this.api.getModel().info.supportsComputerUse ?? false) && (browserToolEnabled ?? true), mcpHub, this.diffEnabled ? this.diffStrategy : undefined, undefined)}

${await this.getCliModesSection(customModes)}

${getRulesSection(this.workspacePath, (this.api.getModel().info.supportsComputerUse ?? false) && (browserToolEnabled ?? true), this.diffEnabled ? this.diffStrategy : undefined)}

${getSystemInfoSection(this.workspacePath)}

${getObjectiveSection()}

${await addCustomInstructions("", customInstructions || "", this.workspacePath, mode, { language: language ?? "English", rooIgnoreInstructions })}`

				// Log system prompt if enabled
				if (this.logSystemPrompt) {
					await this.writeSystemPromptToFile(systemPrompt)
				}

				return systemPrompt
			}

			const systemPrompt = await SYSTEM_PROMPT(
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

			// Log system prompt if enabled
			if (this.logSystemPrompt) {
				await this.writeSystemPromptToFile(systemPrompt)
			}

			this.logDebug(`[Task] System prompt generation completed successfully`)
			return systemPrompt
		} catch (error) {
			this.logDebug(`[Task] Error in getSystemPrompt():`, error)
			throw error
		}
	}

	/**
	 * Create a simplified modes section for CLI mode that doesn't require VSCode context
	 */
	private async getCliModesSection(customModes?: any[]): Promise<string> {
		// Import modes directly instead of using VSCode context
		const { getAllModes } = await import("../../shared/modes")
		const allModes = getAllModes(customModes)

		let modesContent = `====

MODES

- These are the currently available modes:
${allModes
	.map((mode: any) => {
		let description: string
		if (mode.whenToUse && mode.whenToUse.trim() !== "") {
			// Use whenToUse as the primary description, indenting subsequent lines for readability
			description = mode.whenToUse.replace(/\n/g, "\n    ")
		} else {
			// Fallback to the first sentence of roleDefinition if whenToUse is not available
			description = mode.roleDefinition.split(".")[0]
		}
		return `  * "${mode.name}" mode (${mode.slug}) - ${description}`
	})
	.join("\n")}`

		modesContent += `
If the user asks you to create or edit a new mode for this project, you should read the instructions by using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>
`

		return modesContent
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
