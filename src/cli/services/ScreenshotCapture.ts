import * as fs from "fs/promises"
import * as path from "path"
import { Page } from "puppeteer-core"
import { ScreenshotOptions, ScreenshotMetadata } from "../types/browser-types"
import { fileExistsAtPath } from "../../utils/fs"

export class ScreenshotCapture {
	private outputDirectory: string

	constructor(outputDirectory: string) {
		this.outputDirectory = outputDirectory
	}

	async capture(page: Page, options?: ScreenshotOptions): Promise<string> {
		await this.ensureOutputDirectory()

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const defaultOptions: ScreenshotOptions = {
			type: "png",
			fullPage: true,
			encoding: "binary",
		}

		const screenshotOptions = { ...defaultOptions, ...options }

		// Generate filename if path not provided
		if (!screenshotOptions.path) {
			const extension = screenshotOptions.type === "jpeg" ? "jpg" : screenshotOptions.type
			screenshotOptions.path = path.join(this.outputDirectory, `screenshot-${timestamp}.${extension}`)
		}

		// Ensure the screenshot directory exists
		const screenshotDir = path.dirname(screenshotOptions.path)
		const dirExists = await fileExistsAtPath(screenshotDir)
		if (!dirExists) {
			await fs.mkdir(screenshotDir, { recursive: true })
		}

		// Capture screenshot
		const screenshotBuffer = await page.screenshot({
			path: screenshotOptions.path,
			type: screenshotOptions.type,
			quality: screenshotOptions.quality,
			fullPage: screenshotOptions.fullPage,
			clip: screenshotOptions.clip,
			omitBackground: screenshotOptions.omitBackground,
			encoding: screenshotOptions.encoding,
		})

		// Generate metadata
		const metadata = await this.generateMetadata(page, screenshotOptions.path)
		await this.saveMetadata(metadata)

		return screenshotOptions.path
	}

	async captureElement(page: Page, selector: string, options?: ScreenshotOptions): Promise<string> {
		await this.ensureOutputDirectory()

		const element = await page.$(selector)
		if (!element) {
			throw new Error(`Element with selector "${selector}" not found`)
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const defaultOptions: ScreenshotOptions = {
			type: "png",
			fullPage: false,
			encoding: "binary",
		}

		const screenshotOptions = { ...defaultOptions, ...options }

		if (!screenshotOptions.path) {
			const extension = screenshotOptions.type === "jpeg" ? "jpg" : screenshotOptions.type
			screenshotOptions.path = path.join(this.outputDirectory, `element-${timestamp}.${extension}`)
		}

		// Capture element screenshot
		await element.screenshot({
			path: screenshotOptions.path,
			type: screenshotOptions.type,
			quality: screenshotOptions.quality,
			omitBackground: screenshotOptions.omitBackground,
			encoding: screenshotOptions.encoding,
		})

		// Generate metadata
		const metadata = await this.generateMetadata(page, screenshotOptions.path)
		await this.saveMetadata(metadata)

		return screenshotOptions.path
	}

	private async generateMetadata(page: Page, filePath: string): Promise<ScreenshotMetadata> {
		const viewport = page.viewport()
		const url = page.url()
		const stats = await fs.stat(filePath)

		return {
			timestamp: new Date().toISOString(),
			url,
			dimensions: {
				width: viewport?.width || 0,
				height: viewport?.height || 0,
			},
			fileSize: stats.size,
			filePath,
		}
	}

	private async saveMetadata(metadata: ScreenshotMetadata): Promise<void> {
		const metadataPath = metadata.filePath.replace(/\.[^.]+$/, ".metadata.json")
		await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
	}

	private async ensureOutputDirectory(): Promise<void> {
		const dirExists = await fileExistsAtPath(this.outputDirectory)
		if (!dirExists) {
			await fs.mkdir(this.outputDirectory, { recursive: true })
		}
	}

	async cleanupOldScreenshots(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
		try {
			const files = await fs.readdir(this.outputDirectory)
			const now = Date.now()

			for (const file of files) {
				const filePath = path.join(this.outputDirectory, file)
				const stats = await fs.stat(filePath)

				if (now - stats.mtime.getTime() > maxAge) {
					await fs.unlink(filePath)
				}
			}
		} catch (error) {
			// Ignore cleanup errors
		}
	}
}
