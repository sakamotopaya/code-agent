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
	// New interface dependencies
	fileSystem?: IFileSystem
	terminal?: ITerminal
	browser?: IBrowser
	telemetry?: ITelemetryService
	globalStoragePath?: string
	workspacePath?: string
	verbose?: boolean
	// CLI specific dependencies
	cliUIService?: any // CLIUIService type import would create circular dependency
	// MCP configuration options
	mcpConfigPath?: string
	mcpAutoConnect?: boolean
	mcpTimeout?: number
	mcpRetries?: number
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
	private cliUIService?: any // CLIUIService instance for CLI mode
	private verbose: boolean = false

	// MCP configuration
	private mcpConfigPath?: string
	private mcpAutoConnect: boolean = true
	private mcpTimeout?: number
	private mcpRetries?: number
	private cliMcpService?: any // CLIMcpService instance for CLI mode

	// Modular components
	private messaging: TaskMessaging
	private lifecycle: TaskLifecycle
	private apiHandler: TaskApiHandler

	// Logging methods
	private logDebug(message: string, ...args: any[]): void {
		if (this.isCliMode()) {
			getCLILogger().debug(message, ...args)
		} else if (this.verbose) {
			console.log(message, ...args)
		}
	}

	private logInfo(message: string, ...args: any[]): void {
		if (this.isCliMode()) {
			getCLILogger().info(message, ...args)
		} else {
			console.log(message, ...args)
		}
	}

	private logError(message: string, ...args: any[]): void {
		if (this.isCliMode()) {
			getCLILogger().error(message, ...args)
		} else {
			console.error(message, ...args)
		}
	}

	private logWarn(message: string, ...args: any[]): void {
		if (this.isCliMode()) {
			getCLILogger().warn(message, ...args)
		} else {
			console.warn(message, ...args)
		}
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
		verbose = false,
		cliUIService,
		mcpConfigPath,
		mcpAutoConnect = true,
		mcpTimeout,
		mcpRetries,
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
		this.cliUIService = cliUIService
		this.verbose = verbose

		// Store MCP configuration
		this.mcpConfigPath = mcpConfigPath
		this.mcpAutoConnect = mcpAutoConnect
		this.mcpTimeout = mcpTimeout
		this.mcpRetries = mcpRetries

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
			this.isCliMode(),
		)

		// Initialize other components
		// Initialize RooIgnoreController in both VS Code and CLI modes
		// Enable file watcher only in VSCode mode (when provider exists)
		this.rooIgnoreController = new RooIgnoreController(this.workspacePath, !!provider)
		this.rooIgnoreController.initialize().catch((error) => {
			console.error("Failed to initialize RooIgnoreController:", error)
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
			(taskId, tokenUsage) => this.emit("taskTokenUsageUpdated", taskId, tokenUsage),
			(taskId, tool, error) => this.emit("taskToolFailed", taskId, tool, error),
			(action, message) => this.emit("message", { action, message }), // onMessage callback
			!provider, // cliMode - true if no provider
			apiConfiguration, // cliApiConfiguration
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

				if (this.verbose) {
					console.log(`[CLI MCP] Executing tool: ${params.tool_name} on server: ${params.server_name}`)
					console.log(`[CLI MCP] Arguments:`, params.arguments)
				}

				try {
					const parsedArgs = JSON.parse(params.arguments)
					if (this.verbose) {
						console.log(`[CLI MCP] Parsed arguments:`, JSON.stringify(parsedArgs, null, 2))
					}

					const result = await this.cliMcpService.executeTool(
						params.server_name,
						params.tool_name,
						parsedArgs,
					)

					if (this.verbose) {
						console.log(`[CLI MCP] Tool execution result:`, JSON.stringify(result, null, 2))
					}

					if (!result.success) {
						const errorMsg = result.error || "Tool execution failed"
						if (this.verbose) {
							console.error(`[CLI MCP] Tool execution failed: ${errorMsg}`)
						}
						throw new Error(`MCP tool execution failed: ${errorMsg}`)
					}

					// Format result similar to extension version
					const formattedResult = result.result
						? typeof result.result === "string"
							? result.result
							: JSON.stringify(result.result, null, 2)
						: "(No response)"

					if (this.verbose) {
						console.log(`[CLI MCP] Formatted result:`, formattedResult)
					}
					return formattedResult
				} catch (parseError) {
					if (this.verbose) {
						console.error(`[CLI MCP] Failed to parse arguments:`, parseError)
					}
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
		if (this.verbose) {
			console.log(`[MCP] executeMcpTool called: server=${serverName}, tool=${toolName}`)
			console.log(`[MCP] Args:`, JSON.stringify(args, null, 2))
			console.log(`[MCP] CLI MCP Service available:`, !!this.cliMcpService)
			console.log(`[MCP] Provider ref available:`, !!this.providerRef?.deref())
		}

		try {
			if (this.cliMcpService) {
				// CLI mode - use CLI MCP service
				if (this.verbose) {
					console.log(`[CLI MCP] Using CLI MCP service for tool execution`)
					console.log(
						`[CLI MCP] Connected servers:`,
						this.cliMcpService.getConnectedServers().map((s: any) => s.id),
					)
				}

				const result = await this.cliMcpService.executeTool(serverName, toolName, args)
				if (this.verbose) {
					console.log(
						`[CLI MCP] Tool execution completed: ${toolName} -> ${result.success ? "SUCCESS" : "ERROR"}`,
					)
					console.log(`[CLI MCP] Result:`, JSON.stringify(result, null, 2))
				}
				return result
			} else if (this.providerRef?.deref()) {
				// VS Code extension mode - use MCP hub
				if (this.verbose) {
					console.log(`[MCP] Using VS Code extension MCP hub`)
				}
				const mcpHub = this.providerRef.deref()?.getMcpHub()
				if (!mcpHub) {
					console.error(`[MCP] MCP hub not available in extension mode`)
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

				console.log(`[MCP] Extension tool execution completed: ${success ? "SUCCESS" : "ERROR"}`)
				return { success, result, error: success ? undefined : result }
			} else {
				console.error(`[MCP] No MCP service available in current context`)
				return { success: false, error: "MCP service not available in current context" }
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[MCP] Tool execution failed:`, error)
			console.error(`[MCP] Error stack:`, error instanceof Error ? error.stack : "No stack trace")
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
		this.logDebug(`[Task] Initiating task loop for task ${this.taskId}.${this.instanceId}`)
		this.logDebug(`[Task] User content length: ${userContent.length}`)
		this.logDebug(`[Task] User content:`, JSON.stringify(userContent, null, 2))

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
								console.error(`[Task] attempt_completion failed:`, error)
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
							console.error(`[Task] Tool execution failed for ${block.name}:`, error)
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
								console.error(`[Task] Parsed tool execution failed for ${toolUse.name}:`, error)
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
		// Debug: Getting system prompt (only log in verbose mode)

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
							console.error("MCP servers failed to connect in time")
						})
					}
				}
			} catch (error) {
				console.warn(`[Task] Failed to get provider state:`, error)
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
			const mode = "code"
			const modeConfig = modes.find((m) => m.slug === mode) || modes[0]
			const { roleDefinition } = getModeSelection(mode, undefined, [])

			// Check if this mode supports MCP
			const enableMcpServerCreation = modeConfig.groups.some(
				(groupEntry) => (typeof groupEntry === "string" ? groupEntry : groupEntry[0]) === "mcp",
			)

			// Build the same comprehensive prompt as VSCode extension
			const systemPrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
	mode,
	this.workspacePath,
	false, // supportsComputerUse - disable browser tool in CLI
	undefined, // codeIndexManager - CLI doesn't need code indexing
	undefined, // diffStrategy
	"900x600", // browserViewportSize
	mcpHub, // mcpHub - now enabled in CLI
	[], // customModeConfigs
	{}, // experiments
	true, // partialReadsEnabled
	{}, // settings
)}

${await getMcpServersSection(mcpHub, undefined, enableMcpServerCreation)}

${getToolUseGuidelinesSection()}

${getCapabilitiesSection(this.workspacePath, false, undefined, undefined, undefined)}

${getRulesSection(this.workspacePath, false, undefined)}

${getSystemInfoSection(this.workspacePath)}

${getObjectiveSection()}`

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

			return systemPrompt
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
