import * as path from "path"
import { Browser, Page, launch } from "puppeteer-core"
import {
	HeadlessBrowserOptions,
	ScreenshotOptions,
	HeadlessCapabilities,
	FormData,
	FormResult,
	SubmissionResult,
	CLI_BROWSER_CONFIG,
} from "../types/browser-types"
import { ExtractedContent } from "../types/extraction-types"
import { HeadlessBrowserManager } from "./HeadlessBrowserManager"
import { ScreenshotCapture } from "./ScreenshotCapture"
import { ContentExtractor } from "./ContentExtractor"
import { FormInteractor } from "./FormInteractor"

interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}

export interface IBrowserSession {
	launch(url: string): Promise<void>
	close(): Promise<void>
	captureScreenshot(options?: ScreenshotOptions): Promise<string>
	extractContent(selectors?: string[]): Promise<ExtractedContent>
	fillForm(formData: FormData): Promise<FormResult>
	submitForm(formSelector: string): Promise<SubmissionResult>
	navigateTo(url: string): Promise<void>
	click(selector: string): Promise<void>
	type(text: string): Promise<void>
}

export interface ICLIBrowserService {
	// Headless-specific methods
	launchHeadless(options?: HeadlessBrowserOptions): Promise<IBrowserSession>
	captureScreenshot(url: string, options?: ScreenshotOptions): Promise<string>
	extractContent(url: string, selectors?: string[]): Promise<ExtractedContent>

	// Form interaction
	fillForm(url: string, formData: FormData): Promise<FormResult>
	submitForm(url: string, formSelector: string): Promise<SubmissionResult>

	// Configuration
	setHeadlessMode(enabled: boolean): void
	getHeadlessCapabilities(): HeadlessCapabilities
	setOutputDirectory(dir: string): void
}

export class CLIBrowserService implements ICLIBrowserService {
	private browserManager: HeadlessBrowserManager
	private screenshotCapture: ScreenshotCapture
	private contentExtractor: ContentExtractor
	private formInteractor: FormInteractor
	private outputDirectory: string
	private headlessMode: boolean = true
	private browserOptions: HeadlessBrowserOptions

	constructor(workingDirectory: string, options?: Partial<HeadlessBrowserOptions>) {
		this.outputDirectory = path.join(workingDirectory, ".roo-cli", "browser-output")
		this.browserOptions = { ...CLI_BROWSER_CONFIG, ...options }

		this.browserManager = new HeadlessBrowserManager(workingDirectory)
		this.screenshotCapture = new ScreenshotCapture(this.outputDirectory)
		this.contentExtractor = new ContentExtractor()
		this.formInteractor = new FormInteractor()
	}

	async launchHeadless(options?: Partial<HeadlessBrowserOptions>): Promise<IBrowserSession> {
		const launchOptions = { ...this.browserOptions, ...options }
		const browser = await this.browserManager.createSession(launchOptions)
		return new CLIBrowserSession(browser, this.screenshotCapture, this.contentExtractor, this.formInteractor)
	}

	async captureScreenshot(url: string, options?: ScreenshotOptions): Promise<string> {
		const session = await this.launchHeadless()
		try {
			await session.launch(url)
			return await session.captureScreenshot(options)
		} finally {
			await session.close()
		}
	}

	async extractContent(url: string, selectors?: string[]): Promise<ExtractedContent> {
		const session = await this.launchHeadless()
		try {
			await session.launch(url)
			return await session.extractContent(selectors)
		} finally {
			await session.close()
		}
	}

	async fillForm(url: string, formData: FormData): Promise<FormResult> {
		const session = await this.launchHeadless()
		try {
			await session.launch(url)
			return await session.fillForm(formData)
		} finally {
			await session.close()
		}
	}

	async submitForm(url: string, formSelector: string): Promise<SubmissionResult> {
		const session = await this.launchHeadless()
		try {
			await session.launch(url)
			return await session.submitForm(formSelector)
		} finally {
			await session.close()
		}
	}

	setHeadlessMode(enabled: boolean): void {
		this.headlessMode = enabled
		this.browserOptions.headless = enabled
	}

	getHeadlessCapabilities(): HeadlessCapabilities {
		return {
			screenshots: true,
			contentExtraction: true,
			formInteraction: true,
			pdfGeneration: true,
			networkMonitoring: true,
		}
	}

	setOutputDirectory(dir: string): void {
		this.outputDirectory = dir
		this.screenshotCapture = new ScreenshotCapture(this.outputDirectory)
	}
}

export class CLIBrowserSession implements IBrowserSession {
	private browser?: Browser
	private page?: Page
	private screenshotCapture: ScreenshotCapture
	private contentExtractor: ContentExtractor
	private formInteractor: FormInteractor

	constructor(
		browser: Browser,
		screenshotCapture: ScreenshotCapture,
		contentExtractor: ContentExtractor,
		formInteractor: FormInteractor,
	) {
		this.browser = browser
		this.screenshotCapture = screenshotCapture
		this.contentExtractor = contentExtractor
		this.formInteractor = formInteractor
	}

	async launch(url: string): Promise<void> {
		if (!this.browser) {
			throw new Error("Browser not initialized")
		}

		this.page = await this.browser.newPage()
		await this.navigateTo(url)
	}

	async close(): Promise<void> {
		if (this.page) {
			await this.page.close()
			this.page = undefined
		}
		if (this.browser) {
			await this.browser.close()
			this.browser = undefined
		}
	}

	async captureScreenshot(options?: ScreenshotOptions): Promise<string> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}
		return await this.screenshotCapture.capture(this.page, options)
	}

	async extractContent(selectors?: string[]): Promise<ExtractedContent> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}
		return await this.contentExtractor.extract(this.page, {
			includeImages: true,
			includeLinks: true,
			includeForms: true,
			includeTables: true,
			includeLists: true,
			selectors,
		})
	}

	async fillForm(formData: FormData): Promise<FormResult> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}
		return await this.formInteractor.fillForm(this.page, formData)
	}

	async submitForm(formSelector: string): Promise<SubmissionResult> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}
		return await this.formInteractor.submitForm(this.page, formSelector)
	}

	async navigateTo(url: string): Promise<void> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}

		await this.page.goto(url, {
			timeout: 30000,
			waitUntil: ["domcontentloaded", "networkidle2"],
		})

		// Wait for page to stabilize
		await this.waitForPageStable()
	}

	async click(selector: string): Promise<void> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}

		await this.page.waitForSelector(selector, { timeout: 10000 })
		await this.page.click(selector)
	}

	async type(text: string): Promise<void> {
		if (!this.page) {
			throw new Error("No page available. Call launch() first.")
		}

		await this.page.keyboard.type(text)
	}

	private async waitForPageStable(timeout: number = 5000): Promise<void> {
		if (!this.page) return

		const checkDuration = 500
		const maxChecks = timeout / checkDuration
		let lastHTMLSize = 0
		let checkCounts = 1
		let stableIterations = 0
		const minStableIterations = 3

		while (checkCounts++ <= maxChecks) {
			const html = await this.page.content()
			const currentHTMLSize = html.length

			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				stableIterations++
			} else {
				stableIterations = 0
			}

			if (stableIterations >= minStableIterations) {
				break
			}

			lastHTMLSize = currentHTMLSize
			await new Promise((resolve) => setTimeout(resolve, checkDuration))
		}
	}
}
