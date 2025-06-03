import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from "puppeteer-core"
import {
	IBrowser,
	IBrowserSession,
	BrowserLaunchOptions,
	BrowserConnectOptions,
	BrowserInstallOptions,
	BrowserType,
	BrowserActionResult,
	ScreenshotResult,
	NavigationOptions,
	ClickOptions,
	TypeOptions,
	HoverOptions,
	ScrollOptions,
	ScrollDirection,
	ResizeOptions,
	ScreenshotOptions,
	ScriptOptions,
	WaitOptions,
	LogOptions,
	ConsoleLog,
	ConsoleLogType,
	ViewportSize,
	BrowserEvent,
} from "../../interfaces"

/**
 * CLI implementation of the IBrowser interface using Puppeteer
 */
export class CliBrowser implements IBrowser {
	private activeSessions: Map<string, IBrowserSession> = new Map()

	async launch(options?: BrowserLaunchOptions): Promise<IBrowserSession> {
		const launchOptions: PuppeteerLaunchOptions = {
			headless: options?.headless !== false,
			executablePath: options?.executablePath,
			args: options?.args || [],
			timeout: options?.timeout || 30000,
			userDataDir: options?.userDataDir,
			devtools: options?.devtools,
			slowMo: options?.slowMo,
		}

		// Set default viewport if provided
		if (options?.defaultViewport) {
			launchOptions.defaultViewport = {
				width: options.defaultViewport.width,
				height: options.defaultViewport.height,
			}
		}

		const browser = await puppeteer.launch(launchOptions)
		const session = new CliBrowserSession(browser, options)
		this.activeSessions.set(session.id, session)

		return session
	}

	async connect(options: BrowserConnectOptions): Promise<IBrowserSession> {
		const browser = await puppeteer.connect({
			browserWSEndpoint: options.browserWSEndpoint,
			browserURL: options.browserURL,
			defaultViewport: options.defaultViewport
				? {
						width: options.defaultViewport.width,
						height: options.defaultViewport.height,
					}
				: undefined,
		})

		const session = new CliBrowserSession(browser)
		this.activeSessions.set(session.id, session)
		return session
	}

	async getAvailableBrowsers(): Promise<BrowserType[]> {
		const browsers: BrowserType[] = []

		// Check for common browser installations
		const browserChecks = [
			{ type: "chrome" as BrowserType, commands: ["google-chrome", "chrome", "chromium"] },
			{ type: "chromium" as BrowserType, commands: ["chromium", "chromium-browser"] },
			{ type: "firefox" as BrowserType, commands: ["firefox"] },
			{ type: "edge" as BrowserType, commands: ["microsoft-edge", "edge"] },
		]

		for (const { type, commands } of browserChecks) {
			for (const command of commands) {
				if (await this.isCommandAvailable(command)) {
					browsers.push(type)
					break
				}
			}
		}

		return browsers
	}

	async isBrowserInstalled(browserType: BrowserType): Promise<boolean> {
		const executablePath = await this.getBrowserExecutablePath(browserType)
		return executablePath !== undefined
	}

	async getBrowserExecutablePath(browserType: BrowserType): Promise<string | undefined> {
		const commands = this.getBrowserCommands(browserType)

		for (const command of commands) {
			if (await this.isCommandAvailable(command)) {
				try {
					const { exec } = await import("child_process")
					const { promisify } = await import("util")
					const execAsync = promisify(exec)

					const whichCommand = process.platform === "win32" ? "where" : "which"
					const result = await execAsync(`${whichCommand} ${command}`)

					if (result.stdout.trim()) {
						return result.stdout.trim().split("\n")[0]
					}
				} catch {
					// Command not found
				}
			}
		}

		return undefined
	}

	async installBrowser(browserType: BrowserType, options?: BrowserInstallOptions): Promise<void> {
		// For CLI implementation, we can't automatically install browsers
		// This would typically be handled by the system package manager
		throw new Error(
			`Automatic browser installation not supported in CLI mode. Please install ${browserType} manually.`,
		)
	}

	private getBrowserCommands(browserType: BrowserType): string[] {
		switch (browserType) {
			case "chrome":
				return process.platform === "win32" ? ["chrome.exe", "google-chrome.exe"] : ["google-chrome", "chrome"]
			case "chromium":
				return process.platform === "win32" ? ["chromium.exe"] : ["chromium", "chromium-browser"]
			case "firefox":
				return process.platform === "win32" ? ["firefox.exe"] : ["firefox"]
			case "edge":
				return process.platform === "win32" ? ["msedge.exe", "microsoft-edge.exe"] : ["microsoft-edge", "edge"]
			case "safari":
				return process.platform === "darwin" ? ["safari"] : []
			default:
				return []
		}
	}

	private async isCommandAvailable(command: string): Promise<boolean> {
		try {
			const { exec } = await import("child_process")
			const { promisify } = await import("util")
			const execAsync = promisify(exec)

			const whichCommand = process.platform === "win32" ? "where" : "which"
			await execAsync(`${whichCommand} ${command}`)
			return true
		} catch {
			return false
		}
	}
}

/**
 * CLI implementation of IBrowserSession using Puppeteer
 */
class CliBrowserSession implements IBrowserSession {
	public readonly id: string
	public isActive: boolean = true

	private browser: Browser
	private page: Page | null = null
	private consoleLogs: ConsoleLog[] = []
	private eventListeners: Map<string, ((data: any) => void)[]> = new Map()

	constructor(browser: Browser, options?: BrowserLaunchOptions) {
		this.id = `cli-browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		this.browser = browser
		this.initializeSession(options)
	}

	private async initializeSession(options?: BrowserLaunchOptions): Promise<void> {
		// Create a new page
		this.page = await this.browser.newPage()

		// Set default viewport if specified
		if (options?.defaultViewport) {
			await this.page.setViewport({
				width: options.defaultViewport.width,
				height: options.defaultViewport.height,
			})
		}

		// Set up console log capture
		this.page.on("console", (msg) => {
			const log: ConsoleLog = {
				type: this.mapConsoleType(msg.type()),
				message: msg.text(),
				timestamp: new Date(),
				location: {
					url: this.page?.url() || "",
					lineNumber: 0,
					columnNumber: 0,
				},
			}
			this.consoleLogs.push(log)
			this.emit("console", log)
		})

		// Set up error handling
		this.page.on("pageerror", (error) => {
			this.emit("pageerror", error)
		})

		// Set up navigation events
		this.page.on("load", () => {
			this.emit("load", { url: this.page?.url() })
		})

		this.page.on("domcontentloaded", () => {
			this.emit("domcontentloaded", { url: this.page?.url() })
		})
	}

	async navigateToUrl(url: string, options?: NavigationOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			await this.page.goto(url, {
				timeout: options?.timeout || 30000,
				waitUntil: "networkidle2",
			})

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			this.emit("navigation", { url })

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async click(coordinate: string, options?: ClickOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			const [x, y] = coordinate.split(",").map((coord) => parseInt(coord.trim()))

			await this.page.mouse.click(x, y, {
				button: options?.button === "right" ? "right" : "left",
				clickCount: options?.clickCount || 1,
				delay: options?.delay,
			})

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				currentMousePosition: coordinate,
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async type(text: string, options?: TypeOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			if (options?.clear) {
				await this.page.keyboard.down("Control")
				await this.page.keyboard.press("KeyA")
				await this.page.keyboard.up("Control")
			}

			await this.page.keyboard.type(text, {
				delay: options?.delay,
			})

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async hover(coordinate: string, options?: HoverOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			const [x, y] = coordinate.split(",").map((coord) => parseInt(coord.trim()))
			await this.page.mouse.move(x, y)

			if (options?.duration) {
				await new Promise((resolve) => setTimeout(resolve, options.duration))
			}

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				currentMousePosition: coordinate,
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async scroll(direction: ScrollDirection, options?: ScrollOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			const amount = options?.amount || 300
			let deltaX = 0
			let deltaY = 0

			switch (direction) {
				case "up":
					deltaY = -amount
					break
				case "down":
					deltaY = amount
					break
				case "left":
					deltaX = -amount
					break
				case "right":
					deltaX = amount
					break
			}

			await this.page.mouse.wheel({ deltaX, deltaY })

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async resize(size: string, options?: ResizeOptions): Promise<BrowserActionResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			const [width, height] = size.split(",").map((dim) => parseInt(dim.trim()))
			await this.page.setViewport({ width, height })

			const screenshot = await this.takeScreenshotInternal()
			const logs = this.getRecentLogs()

			return {
				success: true,
				screenshot: screenshot.data as string,
				currentUrl: await this.getCurrentUrl(),
				logs,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				currentUrl: await this.getCurrentUrl(),
			}
		}
	}

	async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
		if (!this.page) throw new Error("Browser session not initialized")

		const screenshotOptions: any = {
			type: options?.format || "png",
			quality: options?.quality,
			fullPage: options?.fullPage || false,
			omitBackground: options?.omitBackground,
			encoding: options?.encoding || "base64",
		}

		if (options?.clip) {
			screenshotOptions.clip = options.clip
		}

		const screenshot = await this.page.screenshot(screenshotOptions)
		const viewport = this.page.viewport()

		return {
			data: screenshot,
			format: screenshotOptions.type,
			width: viewport?.width || 0,
			height: viewport?.height || 0,
		}
	}

	async executeScript(script: string, options?: ScriptOptions): Promise<any> {
		if (!this.page) throw new Error("Browser session not initialized")

		return await this.page.evaluate(script, ...(options?.args || []))
	}

	async waitForElement(selector: string, options?: WaitOptions): Promise<boolean> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			await this.page.waitForSelector(selector, {
				timeout: options?.timeout || 30000,
				visible: options?.visible,
			})
			return true
		} catch {
			return false
		}
	}

	async waitForNavigation(options?: WaitOptions): Promise<boolean> {
		if (!this.page) throw new Error("Browser session not initialized")

		try {
			await this.page.waitForNavigation({
				timeout: options?.timeout || 30000,
				waitUntil: "networkidle2",
			})
			return true
		} catch {
			return false
		}
	}

	async getCurrentUrl(): Promise<string> {
		return this.page?.url() || ""
	}

	async getTitle(): Promise<string> {
		return this.page?.title() || ""
	}

	async getContent(): Promise<string> {
		return this.page?.content() || ""
	}

	async getConsoleLogs(options?: LogOptions): Promise<ConsoleLog[]> {
		let logs = [...this.consoleLogs]

		if (options?.types) {
			logs = logs.filter((log) => options.types!.includes(log.type))
		}

		if (options?.limit) {
			logs = logs.slice(-options.limit)
		}

		return logs
	}

	async clearConsoleLogs(): Promise<void> {
		this.consoleLogs = []
	}

	async setViewport(width: number, height: number): Promise<void> {
		if (!this.page) throw new Error("Browser session not initialized")
		await this.page.setViewport({ width, height })
	}

	async getViewport(): Promise<ViewportSize> {
		if (!this.page) throw new Error("Browser session not initialized")
		const viewport = this.page.viewport()
		return {
			width: viewport?.width || 0,
			height: viewport?.height || 0,
		}
	}

	async close(): Promise<void> {
		this.isActive = false

		if (this.page) {
			await this.page.close()
		}

		await this.browser.close()
	}

	on(event: BrowserEvent, callback: (data: any) => void): void {
		const eventKey = event as string
		if (!this.eventListeners.has(eventKey)) {
			this.eventListeners.set(eventKey, [])
		}
		this.eventListeners.get(eventKey)!.push(callback)
	}

	off(event: BrowserEvent, callback: (data: any) => void): void {
		const eventKey = event as string
		const listeners = this.eventListeners.get(eventKey)
		if (listeners) {
			const index = listeners.indexOf(callback)
			if (index > -1) {
				listeners.splice(index, 1)
			}
		}
	}

	private emit(event: string, data: any): void {
		const listeners = this.eventListeners.get(event) || []
		listeners.forEach((callback) => callback(data))
	}

	private async takeScreenshotInternal(): Promise<ScreenshotResult> {
		return await this.screenshot({ encoding: "base64", format: "png" })
	}

	private getRecentLogs(): string {
		return this.consoleLogs
			.slice(-5) // Get last 5 logs
			.map((log) => `[${log.type}] ${log.message}`)
			.join("\n")
	}

	private mapConsoleType(puppeteerType: string): ConsoleLogType {
		switch (puppeteerType) {
			case "log":
				return "log" as ConsoleLogType
			case "info":
				return "info" as ConsoleLogType
			case "warn":
				return "warn" as ConsoleLogType
			case "error":
				return "error" as ConsoleLogType
			case "debug":
				return "debug" as ConsoleLogType
			default:
				return "log" as ConsoleLogType
		}
	}
}
