import * as fs from "fs/promises"
import * as path from "path"
import { Browser, launch } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import { fileExistsAtPath } from "../../utils/fs"
import { HeadlessBrowserOptions, CLI_BROWSER_CONFIG } from "../types/browser-types"

interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}

export class HeadlessBrowserManager {
	private workingDirectory: string
	private puppeteerPath: string

	constructor(workingDirectory: string) {
		this.workingDirectory = workingDirectory
		this.puppeteerPath = path.join(workingDirectory, ".roo-cli", "puppeteer")
	}

	async createSession(options: HeadlessBrowserOptions = CLI_BROWSER_CONFIG): Promise<Browser> {
		return await this.launchBrowser(options)
	}

	private async launchBrowser(options: HeadlessBrowserOptions): Promise<Browser> {
		const stats = await this.ensureChromiumExists()

		const launchOptions = {
			headless: options.headless,
			devtools: options.devtools,
			slowMo: options.slowMo,
			defaultViewport: options.viewport,
			executablePath: stats.executablePath,
			args: options.args,
			timeout: options.timeout,
		}

		if (options.userAgent) {
			// User agent will be set on individual pages
		}

		return await stats.puppeteer.launch(launchOptions)
	}

	private async ensureChromiumExists(): Promise<PCRStats> {
		const dirExists = await fileExistsAtPath(this.puppeteerPath)
		if (!dirExists) {
			await fs.mkdir(this.puppeteerPath, { recursive: true })
		}

		// Download chromium if it doesn't exist, or return existing path
		const stats: PCRStats = await PCR({
			downloadPath: this.puppeteerPath,
		})

		return stats
	}

	async cleanup(): Promise<void> {
		// Cleanup any resources if needed
		// For now, just ensure the browser processes are terminated
	}
}
