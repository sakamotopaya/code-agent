import * as vscode from "vscode"
import { BrowserSession } from "../../../services/browser/BrowserSession"
import {
	IBrowser,
	IBrowserSession,
	BrowserType,
	BrowserLaunchOptions,
	BrowserConnectOptions,
	BrowserInstallOptions,
	NavigationOptions,
	ClickOptions,
	TypeOptions,
	HoverOptions,
	ScrollOptions,
	ScrollDirection,
	ResizeOptions,
	ScreenshotOptions,
	BrowserActionResult,
	ScreenshotResult,
	ScriptOptions,
	WaitOptions,
	LogOptions,
	ConsoleLog,
	ViewportSize,
	BrowserEvent,
} from "../../interfaces/IBrowser"

/**
 * VS Code implementation of a browser session wrapper
 */
class VsCodeBrowserSessionWrapper implements IBrowserSession {
	public readonly id: string
	public isActive: boolean = true

	constructor(private browserSession: BrowserSession) {
		this.id = Math.random().toString(36).substr(2, 9)
	}

	async navigateToUrl(url: string, options?: NavigationOptions): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.navigateToUrl(url)
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async click(coordinate: string, options?: ClickOptions): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.click(coordinate)
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async type(text: string, options?: TypeOptions): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.type(text)
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async hover(coordinate: string, options?: HoverOptions): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.hover(coordinate)
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async scroll(direction: ScrollDirection, options?: ScrollOptions): Promise<BrowserActionResult> {
		try {
			if (direction === ScrollDirection.DOWN) {
				return await this.browserSession.scrollDown()
			} else if (direction === ScrollDirection.UP) {
				return await this.browserSession.scrollUp()
			} else {
				return {
					success: false,
					error: `Scroll direction ${direction} not supported`,
				}
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async resize(size: string, options?: ResizeOptions): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.resize(size)
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
		try {
			// Use the existing screenshot functionality from BrowserActionResult
			const result = await this.browserSession.doAction(async (page) => {
				// Just trigger a screenshot by doing a simple action
				await page.evaluate(() => {})
			})

			if (result.screenshot) {
				return {
					data: result.screenshot,
					format: options?.format || "png",
					width: 0, // We don't have access to dimensions from the existing API
					height: 0,
				}
			} else {
				throw new Error("Failed to capture screenshot")
			}
		} catch (error) {
			throw new Error(`Screenshot failed: ${error}`)
		}
	}

	async executeScript(script: string, options?: ScriptOptions): Promise<any> {
		try {
			// The existing BrowserSession doesn't support script execution with return values
			// We'll execute the script but can't return the result
			await this.browserSession.doAction(async (page) => {
				await page.evaluate(script, ...(options?.args || []))
			})
			return undefined
		} catch (error) {
			throw new Error(`Script execution failed: ${error}`)
		}
	}

	async waitForElement(selector: string, options?: WaitOptions): Promise<boolean> {
		try {
			await this.browserSession.doAction(async (page) => {
				await page.waitForSelector(selector, {
					timeout: options?.timeout || 30000,
					visible: options?.visible,
				})
			})
			return true
		} catch {
			return false
		}
	}

	async waitForNavigation(options?: WaitOptions): Promise<boolean> {
		try {
			await this.browserSession.doAction(async (page) => {
				await page.waitForNavigation({
					timeout: options?.timeout || 30000,
					waitUntil: "networkidle0",
				})
			})
			return true
		} catch {
			return false
		}
	}

	async getCurrentUrl(): Promise<string> {
		try {
			// The existing BrowserSession doesn't expose current URL directly
			// We'll return the currentUrl from the last action result if available
			const result = await this.browserSession.doAction(async (page) => {
				// Just trigger an action to get the current state
				await page.evaluate(() => {})
			})
			return result.currentUrl || ""
		} catch {
			return ""
		}
	}

	async getTitle(): Promise<string> {
		try {
			// The existing BrowserSession doesn't expose page title
			// This would need to be implemented in the underlying BrowserSession
			return ""
		} catch {
			return ""
		}
	}

	async getContent(): Promise<string> {
		try {
			// The existing BrowserSession doesn't expose page content
			// This would need to be implemented in the underlying BrowserSession
			return ""
		} catch {
			return ""
		}
	}

	async getConsoleLogs(options?: LogOptions): Promise<ConsoleLog[]> {
		// The existing BrowserSession captures console logs but doesn't expose them
		// This would need to be implemented in the underlying BrowserSession
		return []
	}

	async clearConsoleLogs(): Promise<void> {
		// Not implemented in the existing BrowserSession
	}

	async setViewport(width: number, height: number): Promise<void> {
		await this.browserSession.doAction(async (page) => {
			await page.setViewport({ width, height })
		})
	}

	async getViewport(): Promise<ViewportSize> {
		try {
			// The existing BrowserSession doesn't expose viewport info
			// We'll return the default viewport size
			return { width: 900, height: 600 }
		} catch {
			return { width: 900, height: 600 }
		}
	}

	async close(): Promise<void> {
		try {
			await this.browserSession.closeBrowser()
			this.isActive = false
		} catch (error) {
			// Ignore errors when closing
		}
	}

	on(event: BrowserEvent, callback: (data: any) => void): void {
		// The existing BrowserSession doesn't support event listeners
		// This would need to be implemented in the underlying BrowserSession
	}

	off(event: BrowserEvent, callback: (data: any) => void): void {
		// The existing BrowserSession doesn't support event listeners
		// This would need to be implemented in the underlying BrowserSession
	}
}

/**
 * VS Code implementation of the IBrowser interface.
 * Provides browser automation using the existing BrowserSession service.
 */
export class VsCodeBrowser implements IBrowser {
	private sessions: Map<string, VsCodeBrowserSessionWrapper> = new Map()

	constructor(private context: vscode.ExtensionContext) {}

	async launch(options?: BrowserLaunchOptions): Promise<IBrowserSession> {
		const browserSession = new BrowserSession(this.context)
		await browserSession.launchBrowser()

		const wrapper = new VsCodeBrowserSessionWrapper(browserSession)
		this.sessions.set(wrapper.id, wrapper)

		return wrapper
	}

	async connect(options: BrowserConnectOptions): Promise<IBrowserSession> {
		// The existing BrowserSession doesn't support connecting to existing browsers
		// For now, we'll just launch a new browser
		return this.launch()
	}

	async getAvailableBrowsers(): Promise<BrowserType[]> {
		// The existing BrowserSession only supports Chrome/Chromium
		return [BrowserType.CHROMIUM]
	}

	async isBrowserInstalled(browserType: BrowserType): Promise<boolean> {
		if (browserType === BrowserType.CHROMIUM || browserType === BrowserType.CHROME) {
			try {
				const browserSession = new BrowserSession(this.context)
				// Try to ensure Chromium exists - this will download it if needed
				await (browserSession as any).ensureChromiumExists()
				return true
			} catch {
				return false
			}
		}
		return false
	}

	async getBrowserExecutablePath(browserType: BrowserType): Promise<string | undefined> {
		if (browserType === BrowserType.CHROMIUM || browserType === BrowserType.CHROME) {
			try {
				const browserSession = new BrowserSession(this.context)
				const stats = await (browserSession as any).ensureChromiumExists()
				return stats.executablePath
			} catch {
				return undefined
			}
		}
		return undefined
	}

	async installBrowser(browserType: BrowserType, options?: BrowserInstallOptions): Promise<void> {
		if (browserType === BrowserType.CHROMIUM || browserType === BrowserType.CHROME) {
			try {
				const browserSession = new BrowserSession(this.context)
				// This will download Chromium if it doesn't exist
				await (browserSession as any).ensureChromiumExists()
			} catch (error) {
				throw new Error(`Failed to install ${browserType}: ${error}`)
			}
		} else {
			throw new Error(`Browser type ${browserType} is not supported`)
		}
	}

	/**
	 * Get all active browser sessions
	 */
	getActiveSessions(): IBrowserSession[] {
		return Array.from(this.sessions.values()).filter((session) => session.isActive)
	}

	/**
	 * Close all browser sessions
	 */
	async closeAllSessions(): Promise<void> {
		const closingPromises = Array.from(this.sessions.values()).map((session) => session.close())
		await Promise.all(closingPromises)
		this.sessions.clear()
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this.closeAllSessions()
	}
}
