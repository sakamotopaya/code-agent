import {
	IBrowser,
	IBrowserSession,
	BrowserType,
	BrowserLaunchOptions,
	BrowserConnectOptions,
	BrowserInstallOptions,
	BrowserActionResult,
	ScreenshotResult,
	ConsoleLog,
	ViewportSize,
	NavigationOptions,
	ClickOptions,
	TypeOptions,
	HoverOptions,
	ScrollDirection,
	ScrollOptions,
	ResizeOptions,
	ScreenshotOptions,
	ScriptOptions,
	WaitOptions,
	LogOptions,
	BrowserEvent,
} from "../../interfaces"

/**
 * Options for API Browser adapter
 */
export interface ApiBrowserOptions {
	verbose?: boolean
}

/**
 * API implementation of browser session
 * In API context, browser operations would typically be handled
 * by delegating to the underlying CLI browser implementation
 */
export class ApiBrowserSession implements IBrowserSession {
	public readonly id: string
	public isActive = false
	private options: ApiBrowserOptions
	private currentUrl?: string
	private viewport: ViewportSize = { width: 1280, height: 720 }
	private consoleLogs: ConsoleLog[] = []
	private eventListeners: Map<BrowserEvent, ((data: any) => void)[]> = new Map()

	constructor(sessionId: string, options: ApiBrowserOptions = {}) {
		this.id = sessionId
		this.options = options
		this.isActive = true
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Browser Session] ${message}`)
		}
	}

	async navigateToUrl(url: string, options?: NavigationOptions): Promise<BrowserActionResult> {
		this.log(`Navigate to: ${url}`)
		this.currentUrl = url

		// In API context, this would delegate to actual browser implementation
		return {
			currentUrl: url,
			screenshot: "mock-screenshot-base64",
			logs: "Navigation completed",
		}
	}

	async click(coordinate: string, options?: ClickOptions): Promise<BrowserActionResult> {
		this.log(`Click: ${coordinate}`)

		return {
			currentUrl: this.currentUrl,
			screenshot: "mock-screenshot-base64",
			logs: `Clicked at ${coordinate}`,
		}
	}

	async type(text: string, options?: TypeOptions): Promise<BrowserActionResult> {
		this.log(`Type: ${text}`)

		return {
			currentUrl: this.currentUrl,
			screenshot: "mock-screenshot-base64",
			logs: `Typed: ${text}`,
		}
	}

	async hover(coordinate: string, options?: HoverOptions): Promise<BrowserActionResult> {
		this.log(`Hover: ${coordinate}`)

		return {
			currentUrl: this.currentUrl,
			screenshot: "mock-screenshot-base64",
			logs: `Hovered at ${coordinate}`,
			currentMousePosition: coordinate,
		}
	}

	async scroll(direction: ScrollDirection, options?: ScrollOptions): Promise<BrowserActionResult> {
		this.log(`Scroll: ${direction}`)

		return {
			currentUrl: this.currentUrl,
			screenshot: "mock-screenshot-base64",
			logs: `Scrolled ${direction}`,
		}
	}

	async resize(size: string, options?: ResizeOptions): Promise<BrowserActionResult> {
		this.log(`Resize: ${size}`)
		const [width, height] = size.split(",").map((s) => parseInt(s.trim()))
		this.viewport = { width, height }

		return {
			currentUrl: this.currentUrl,
			screenshot: "mock-screenshot-base64",
			logs: `Resized to ${size}`,
		}
	}

	async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
		this.log(`Taking screenshot`)

		// In API context, this would return actual screenshot data
		return {
			data: "mock-screenshot-base64-data",
			format: options?.format || "png",
			width: this.viewport.width,
			height: this.viewport.height,
		}
	}

	async executeScript(script: string, options?: ScriptOptions): Promise<any> {
		this.log(`Execute script: ${script}`)

		// In API context, this would execute actual JavaScript
		return { result: "mock-script-result" }
	}

	async waitForElement(selector: string, options?: WaitOptions): Promise<boolean> {
		this.log(`Wait for element: ${selector}`)
		// In API context, this would wait for actual element
		return true
	}

	async waitForNavigation(options?: WaitOptions): Promise<boolean> {
		this.log(`Wait for navigation`)
		// In API context, this would wait for actual navigation
		return true
	}

	async getCurrentUrl(): Promise<string> {
		return this.currentUrl || "about:blank"
	}

	async getTitle(): Promise<string> {
		this.log(`Getting page title`)
		return "Mock Page Title"
	}

	async getContent(): Promise<string> {
		this.log(`Getting page content`)
		// In API context, this would return actual page content
		return "<html><body>Mock page content</body></html>"
	}

	async getConsoleLogs(options?: LogOptions): Promise<ConsoleLog[]> {
		this.log(`Getting console logs`)
		return this.consoleLogs
	}

	async clearConsoleLogs(): Promise<void> {
		this.log(`Clearing console logs`)
		this.consoleLogs = []
	}

	async setViewport(width: number, height: number): Promise<void> {
		this.log(`Set viewport: ${width}x${height}`)
		this.viewport = { width, height }
	}

	async getViewport(): Promise<ViewportSize> {
		return this.viewport
	}

	async close(): Promise<void> {
		this.log(`Closing browser session`)
		this.isActive = false
	}

	on(event: BrowserEvent, callback: (data: any) => void): void {
		this.log(`Event listener added: ${event}`)
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, [])
		}
		this.eventListeners.get(event)!.push(callback)
	}

	off(event: BrowserEvent, callback: (data: any) => void): void {
		this.log(`Event listener removed: ${event}`)
		const listeners = this.eventListeners.get(event)
		if (listeners) {
			const index = listeners.indexOf(callback)
			if (index > -1) {
				listeners.splice(index, 1)
			}
		}
	}
}

/**
 * API implementation of the IBrowser interface
 * Provides browser automation capabilities for API requests
 */
export class ApiBrowser implements IBrowser {
	private options: ApiBrowserOptions
	private sessions: Map<string, ApiBrowserSession> = new Map()
	private sessionCounter = 0

	constructor(options: ApiBrowserOptions = {}) {
		this.options = {
			verbose: false,
			...options,
		}
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API Browser] ${message}`)
		}
	}

	async launch(options?: BrowserLaunchOptions): Promise<IBrowserSession> {
		const sessionId = `api-browser-${++this.sessionCounter}`
		this.log(`Launching browser session: ${sessionId}`)

		const session = new ApiBrowserSession(sessionId, this.options)
		this.sessions.set(sessionId, session)

		// In API context, this would launch actual browser instance
		return session
	}

	async connect(options: BrowserConnectOptions): Promise<IBrowserSession> {
		const sessionId = `api-browser-connect-${++this.sessionCounter}`
		this.log(`Connecting to browser: ${sessionId}`)

		const session = new ApiBrowserSession(sessionId, this.options)
		this.sessions.set(sessionId, session)

		return session
	}

	async getAvailableBrowsers(): Promise<BrowserType[]> {
		this.log(`Getting available browsers`)

		// In API context, this would detect actual installed browsers
		return ["chromium", "firefox", "chrome"] as BrowserType[]
	}

	async isBrowserInstalled(browserType: BrowserType): Promise<boolean> {
		this.log(`Checking if browser is installed: ${browserType}`)
		// In API context, this would check actual browser installation
		return true
	}

	async getBrowserExecutablePath(browserType: BrowserType): Promise<string | undefined> {
		this.log(`Getting browser executable path: ${browserType}`)
		// In API context, this would return actual browser path
		return "/mock/browser/path"
	}

	async installBrowser(browserType: BrowserType, options?: BrowserInstallOptions): Promise<void> {
		this.log(`Installing browser: ${browserType}`)

		// In API context, this would perform actual browser installation
		// No return value as per interface
	}

	async getBrowserVersion(browser: BrowserType): Promise<string | null> {
		this.log(`Getting version for browser: ${browser}`)

		// In API context, this would return actual browser version
		return "1.0.0"
	}

	async isInstalled(browser: BrowserType): Promise<boolean> {
		this.log(`Checking if browser is installed: ${browser}`)

		// In API context, this would check actual browser installation
		return true
	}

	async killAllBrowsers(): Promise<void> {
		this.log(`Killing all browser processes`)

		// Close all sessions
		const closePromises = Array.from(this.sessions.values()).map((session) => session.close())
		await Promise.all(closePromises)

		this.sessions.clear()
	}

	async getActiveSessions(): Promise<IBrowserSession[]> {
		return Array.from(this.sessions.values()).filter((session) => session.isActive)
	}

	async closeSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId)
		if (session) {
			await session.close()
			this.sessions.delete(sessionId)
			this.log(`Closed browser session: ${sessionId}`)
		}
	}

	async closeAllSessions(): Promise<void> {
		this.log(`Closing all ${this.sessions.size} browser sessions`)

		const closePromises = Array.from(this.sessions.values()).map((session) => session.close())
		await Promise.all(closePromises)

		this.sessions.clear()
	}

	getDefaultBrowser(): BrowserType {
		return "chromium" as BrowserType
	}

	isHeadlessSupported(): boolean {
		return true
	}
}
