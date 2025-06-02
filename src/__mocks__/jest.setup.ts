import nock from "nock"

nock.disableNetConnect()

export function allowNetConnect(host?: string | RegExp) {
	if (host) {
		nock.enableNetConnect(host)
	} else {
		nock.enableNetConnect()
	}
}

// Mock VS Code API
jest.mock("vscode", () => ({
	env: {
		language: "en",
		appName: "Visual Studio Code Test",
		appHost: "desktop",
		appRoot: "/mock/vscode",
		machineId: "test-machine-id",
		sessionId: "test-session-id",
		shell: "/bin/zsh",
	},
	window: {
		createOutputChannel: jest.fn().mockReturnValue({
			appendLine: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		}),
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
		showErrorMessage: jest.fn(),
		showQuickPick: jest.fn(),
		createWebviewPanel: jest.fn().mockReturnValue({
			webview: {
				html: "",
				postMessage: jest.fn(),
				onDidReceiveMessage: jest.fn(),
			},
			dispose: jest.fn(),
		}),
		createTerminal: jest.fn().mockReturnValue({
			sendText: jest.fn(),
			show: jest.fn(),
			dispose: jest.fn(),
		}),
	},
	workspace: {
		fs: {
			readFile: jest.fn(),
			writeFile: jest.fn(),
			delete: jest.fn(),
			createDirectory: jest.fn(),
			stat: jest.fn(),
			readDirectory: jest.fn(),
		},
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
		getConfiguration: jest.fn().mockReturnValue({
			get: jest.fn().mockReturnValue(""),
			update: jest.fn(),
		}),
		onDidChangeTextDocument: jest.fn(),
		onDidSaveTextDocument: jest.fn(),
		onDidCreateFiles: jest.fn(),
		onDidDeleteFiles: jest.fn(),
		onDidRenameFiles: jest.fn(),
	},
	Uri: {
		file: jest.fn((path) => ({ fsPath: path })),
		parse: jest.fn((uri) => ({ fsPath: uri })),
	},
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
	TextEncoder: global.TextEncoder,
	TextDecoder: global.TextDecoder,
}))

// Mock VS Code context for adapter tests
jest.mock("../core/adapters/vscode", () => {
	const originalModule = jest.requireActual("../core/adapters/vscode")

	// Create a mock VS Code context
	const mockContext = {
		globalStorageUri: { fsPath: "/mock/global-storage" },
		workspaceState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		subscriptions: [],
	}

	// Set the mock context
	originalModule.setVsCodeContext(mockContext)

	return originalModule
})

// Mock the logger globally for all tests
jest.mock("../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		fatal: jest.fn(),
		child: jest.fn().mockReturnValue({
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			fatal: jest.fn(),
		}),
	},
}))

// Mock TelemetryService globally for all tests
jest.mock("../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		createInstance: jest.fn().mockReturnValue({
			register: jest.fn(),
			setProvider: jest.fn(),
			updateTelemetryState: jest.fn(),
			captureEvent: jest.fn(),
			captureTaskCreated: jest.fn(),
			captureTaskRestarted: jest.fn(),
			captureTaskCompleted: jest.fn(),
			captureConversationMessage: jest.fn(),
			captureModeSwitch: jest.fn(),
			captureToolUsage: jest.fn(),
			captureCheckpointCreated: jest.fn(),
			captureCheckpointDiffed: jest.fn(),
			captureCheckpointRestored: jest.fn(),
			captureSlidingWindowTruncation: jest.fn(),
			captureCodeActionUsed: jest.fn(),
			capturePromptEnhanced: jest.fn(),
			captureSchemaValidationError: jest.fn(),
			captureDiffApplicationError: jest.fn(),
			captureShellIntegrationError: jest.fn(),
			captureConsecutiveMistakeError: jest.fn(),
			captureTitleButtonClicked: jest.fn(),
			isTelemetryEnabled: jest.fn().mockReturnValue(false),
			shutdown: jest.fn(),
		}),
		instance: {
			register: jest.fn(),
			setProvider: jest.fn(),
			updateTelemetryState: jest.fn(),
			captureEvent: jest.fn(),
			captureTaskCreated: jest.fn(),
			captureTaskRestarted: jest.fn(),
			captureTaskCompleted: jest.fn(),
			captureConversationMessage: jest.fn(),
			captureModeSwitch: jest.fn(),
			captureToolUsage: jest.fn(),
			captureCheckpointCreated: jest.fn(),
			captureCheckpointDiffed: jest.fn(),
			captureCheckpointRestored: jest.fn(),
			captureSlidingWindowTruncation: jest.fn(),
			captureCodeActionUsed: jest.fn(),
			capturePromptEnhanced: jest.fn(),
			captureSchemaValidationError: jest.fn(),
			captureDiffApplicationError: jest.fn(),
			captureShellIntegrationError: jest.fn(),
			captureConsecutiveMistakeError: jest.fn(),
			captureTitleButtonClicked: jest.fn(),
			isTelemetryEnabled: jest.fn().mockReturnValue(false),
			shutdown: jest.fn(),
		},
		hasInstance: jest.fn().mockReturnValue(true),
	},
}))

// Add toPosix method to String prototype for all tests, mimicking src/utils/path.ts
// This is needed because the production code expects strings to have this method
// Note: In production, this is added via import in the entry point (extension.ts)
export {}

declare global {
	interface String {
		toPosix(): string
	}
}

// Implementation that matches src/utils/path.ts
function toPosixPath(p: string) {
	// Extended-Length Paths in Windows start with "\\?\" to allow longer paths
	// and bypass usual parsing. If detected, we return the path unmodified.
	const isExtendedLengthPath = p.startsWith("\\\\?\\")

	if (isExtendedLengthPath) {
		return p
	}

	return p.replace(/\\/g, "/")
}

if (!String.prototype.toPosix) {
	String.prototype.toPosix = function (this: string): string {
		return toPosixPath(this)
	}
}

// Mock fs/promises to prevent filesystem operations in tests
jest.mock("fs/promises", () => {
	const originalModule = jest.requireActual("fs/promises")
	return {
		...originalModule,
		mkdir: jest.fn().mockResolvedValue(undefined),
		writeFile: jest.fn().mockResolvedValue(undefined),
		readFile: jest.fn().mockResolvedValue(""),
		rm: jest.fn().mockResolvedValue(undefined),
		unlink: jest.fn().mockResolvedValue(undefined), // Add unlink mock
		access: jest.fn().mockResolvedValue(undefined),
		readdir: jest.fn().mockResolvedValue([]),
		stat: jest.fn().mockResolvedValue({
			isDirectory: () => false,
			isFile: () => true,
		}),
	}
})

// Mock fs module as well
jest.mock("fs", () => {
	const originalModule = jest.requireActual("fs")
	return {
		...originalModule,
		promises: {
			mkdir: jest.fn().mockResolvedValue(undefined),
			writeFile: jest.fn().mockResolvedValue(undefined),
			readFile: jest.fn().mockResolvedValue(""),
			rm: jest.fn().mockResolvedValue(undefined),
			unlink: jest.fn().mockResolvedValue(undefined), // Add unlink mock
			access: jest.fn().mockResolvedValue(undefined),
			readdir: jest.fn().mockResolvedValue([]),
			stat: jest.fn().mockResolvedValue({
				isDirectory: () => false,
				isFile: () => true,
			}),
		},
		existsSync: jest.fn().mockReturnValue(true),
		readFileSync: jest.fn().mockReturnValue(""),
		writeFileSync: jest.fn(),
		mkdirSync: jest.fn(),
		createReadStream: jest.fn(), // Add createReadStream mock
		statSync: originalModule.statSync, // Keep original statSync for simple-git
	}
})

// Only mock the most problematic services that cause the specific issues reported
// Keep these mocks minimal to avoid breaking working tests

// Mock tiktoken to prevent WebAssembly issues
jest.mock("tiktoken/lite", () => ({
	Tiktoken: jest.fn().mockImplementation(() => ({
		encode: jest.fn().mockReturnValue([1, 2, 3]),
		decode: jest.fn().mockReturnValue("test"),
		free: jest.fn(),
	})),
}))

jest.mock("tiktoken/encoders/o200k_base", () => ({}))

jest.mock("../utils/tiktoken", () => ({
	tiktoken: jest.fn().mockImplementation(async (content: any[]) => {
		if (!content || content.length === 0) {
			return 0
		}

		let totalTokens = 0
		for (const block of content) {
			if (block.type === "text") {
				const text = block.text || ""
				if (text.length > 0) {
					// Simple mock: return 2 tokens for "Hello world", 0 for empty
					totalTokens += text === "Hello world" ? 2 : text.length > 0 ? text.split(" ").length : 0
				}
			} else if (block.type === "image") {
				const imageSource = block.source
				if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
					const base64Data = imageSource.data as string
					totalTokens += Math.ceil(Math.sqrt(base64Data.length))
				} else {
					totalTokens += 300 // Conservative estimate for unknown images
				}
			}
		}

		// Apply fudge factor like the real implementation (1.5)
		return Math.ceil(totalTokens * 1.5)
	}),
}))

jest.mock("../utils/countTokens", () => ({
	countTokens: jest.fn().mockReturnValue(10),
}))
