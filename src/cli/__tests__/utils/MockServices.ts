// Simple mock services for testing CLI functionality
export const createMockUIService = () => ({
	showSpinner: () => ({
		text: "",
		isSpinning: false,
		succeed: () => {},
		fail: () => {},
		stop: () => {},
	}),
	promptConfirm: async () => true,
	promptSelect: async () => "option1",
	promptInput: async () => "test-input",
	showProgress: () => {},
	hideProgress: () => {},
	showTable: () => {},
	showError: () => {},
	showWarning: () => {},
	showSuccess: () => {},
})

export const createMockBrowserService = () => ({
	launch: async () => {},
	close: async () => {},
	screenshot: async () => "screenshot-data",
	navigate: async () => {},
	click: async () => {},
	type: async () => {},
	waitFor: async () => {},
	evaluate: async () => {},
})

export const createMockSessionManager = () => ({
	createSession: async () => "test-session-id",
	saveSession: async () => {},
	loadSession: async () => ({ id: "test-session-id", data: {} }),
	deleteSession: async () => {},
	listSessions: async () => [],
	getCurrentSession: () => null,
})

export const createMockMcpService = () => ({
	connect: async () => {},
	disconnect: async () => {},
	listServers: async () => [],
	callTool: async () => ({ result: "mock-result" }),
	getResources: async () => [],
	isConnected: () => false,
})

export const createMockOutputFormatter = () => ({
	format: () => "formatted-output",
	formatTable: () => "formatted-table",
	formatJSON: () => '{"formatted": "json"}',
	formatYAML: () => "formatted: yaml",
	formatMarkdown: () => "# Formatted Markdown",
})

export const createMockErrorHandler = () => ({
	handleError: () => ({
		handled: true,
		exitCode: 1,
		message: "Mock error handled",
	}),
	classifyError: () => ({
		category: "SYSTEM_ERROR",
		severity: "ERROR",
		recoverable: false,
	}),
	recoverFromError: async () => false,
})

export const createMockBatchProcessor = () => ({
	processBatch: async () => ({
		successful: 5,
		failed: 0,
		results: [],
	}),
	validateBatchFile: () => ({ valid: true, errors: [] }),
})

export const createMockCommandExecutor = () => ({
	execute: async () => ({
		exitCode: 0,
		output: "Mock command output",
		error: null,
	}),
	validateCommand: () => ({ valid: true, errors: [] }),
})

export const createMockNonInteractiveMode = () => ({
	isNonInteractive: () => false,
	setNonInteractive: () => {},
	handleNonInteractiveInput: async () => "default-input",
})

export const createMockProgressIndicator = () => ({
	start: () => {},
	update: () => {},
	complete: () => {},
	fail: () => {},
	isActive: () => false,
})

export const createMockColorManager = () => ({
	colorize: (text: string) => text,
	getTheme: () => "dark",
	setTheme: () => {},
	isColorEnabled: () => true,
})

export const createMockHeadlessBrowserManager = () => ({
	launch: async () => {},
	close: async () => {},
	isHeadless: () => true,
	setHeadless: () => {},
	getBrowser: () => null,
})

// Mock file system operations
export const createMockFS = () => ({
	readFile: async () => "mock file content",
	writeFile: async () => {},
	mkdir: async () => {},
	rmdir: async () => {},
	stat: async () => ({
		isDirectory: () => false,
		isFile: () => true,
		size: 1024,
		mtime: new Date(),
	}),
	exists: async () => true,
	access: async () => {},
})

// Mock process operations
export const createMockProcess = () => ({
	spawn: () => ({
		stdout: { on: () => {} },
		stderr: { on: () => {} },
		stdin: { write: () => {}, end: () => {} },
		on: (event: string, callback: (code: number) => void) => {
			if (event === "close") {
				setTimeout(() => callback(0), 100)
			}
		},
		kill: () => {},
	}),
	exec: (command: string, callback: (error: null, stdout: string, stderr: string) => void) => {
		setTimeout(() => callback(null, "mock output", ""), 100)
	},
})

// Mock network operations
export const createMockNetwork = () => ({
	fetch: async () => ({
		ok: true,
		status: 200,
		json: async () => ({}),
		text: async () => "mock response",
	}),
	request: async () => "mock request response",
})

// Factory function to create all service mocks
export function createAllMockServices() {
	return {
		uiService: createMockUIService(),
		browserService: createMockBrowserService(),
		sessionManager: createMockSessionManager(),
		mcpService: createMockMcpService(),
		outputFormatter: createMockOutputFormatter(),
		errorHandler: createMockErrorHandler(),
		batchProcessor: createMockBatchProcessor(),
		commandExecutor: createMockCommandExecutor(),
		nonInteractiveMode: createMockNonInteractiveMode(),
		progressIndicator: createMockProgressIndicator(),
		colorManager: createMockColorManager(),
		headlessBrowserManager: createMockHeadlessBrowserManager(),
		fs: createMockFS(),
		process: createMockProcess(),
		network: createMockNetwork(),
	}
}

export default {
	createMockUIService,
	createMockBrowserService,
	createMockSessionManager,
	createMockMcpService,
	createMockOutputFormatter,
	createMockErrorHandler,
	createMockBatchProcessor,
	createMockCommandExecutor,
	createMockNonInteractiveMode,
	createMockProgressIndicator,
	createMockColorManager,
	createMockHeadlessBrowserManager,
	createMockFS,
	createMockProcess,
	createMockNetwork,
	createAllMockServices,
}
