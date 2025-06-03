export interface HeadlessBrowserOptions {
	headless: boolean
	devtools: boolean
	slowMo: number
	viewport: {
		width: number
		height: number
	}
	userAgent?: string
	timeout: number
	args: string[]
}

export interface ScreenshotOptions {
	path?: string
	type: "png" | "jpeg" | "webp"
	quality?: number
	fullPage: boolean
	clip?: {
		x: number
		y: number
		width: number
		height: number
	}
	omitBackground?: boolean
	encoding?: "base64" | "binary"
}

export interface ScreenshotMetadata {
	timestamp: string
	url: string
	dimensions: {
		width: number
		height: number
	}
	fileSize: number
	filePath: string
}

export interface HeadlessCapabilities {
	screenshots: boolean
	contentExtraction: boolean
	formInteraction: boolean
	pdfGeneration: boolean
	networkMonitoring: boolean
}

export interface FormData {
	[key: string]: string | number | boolean | File
}

export interface FormResult {
	success: boolean
	url: string
	responseTime: number
	errors?: string[]
}

export interface SubmissionResult {
	success: boolean
	redirectUrl?: string
	responseData?: any
	errors?: string[]
}

export const CLI_BROWSER_CONFIG: HeadlessBrowserOptions = {
	headless: true,
	devtools: false,
	slowMo: 0,
	viewport: {
		width: 1920,
		height: 1080,
	},
	timeout: 30000,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-gpu",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-timer-throttling",
		"--disable-backgrounding-occluded-windows",
		"--disable-renderer-backgrounding",
	],
}
