import { HeadlessBrowserOptions, CLI_BROWSER_CONFIG } from "../types/browser-types"

export interface BrowserCLIOptions {
	headless?: boolean
	browserViewport?: string
	browserTimeout?: number
	screenshotOutput?: string
	userAgent?: string
}

export function parseBrowserOptions(cliOptions: BrowserCLIOptions): Partial<HeadlessBrowserOptions> {
	const options: Partial<HeadlessBrowserOptions> = {}

	if (cliOptions.headless !== undefined) {
		options.headless = cliOptions.headless
	}

	if (cliOptions.browserViewport) {
		const [width, height] = cliOptions.browserViewport.split("x").map(Number)
		if (width && height) {
			options.viewport = { width, height }
		}
	}

	if (cliOptions.browserTimeout) {
		options.timeout = cliOptions.browserTimeout
	}

	if (cliOptions.userAgent) {
		options.userAgent = cliOptions.userAgent
	}

	return options
}

export function validateBrowserViewport(value: string): string {
	const viewportRegex = /^\d+x\d+$/
	if (!viewportRegex.test(value)) {
		throw new Error(`Invalid viewport format: ${value}. Expected format: widthxheight (e.g., 1920x1080)`)
	}
	return value
}

export function validateTimeout(value: string): number {
	const timeout = parseInt(value, 10)
	if (isNaN(timeout) || timeout <= 0) {
		throw new Error(`Invalid timeout: ${value}. Must be a positive number in milliseconds`)
	}
	return timeout
}

export function getDefaultBrowserConfig(): HeadlessBrowserOptions {
	return { ...CLI_BROWSER_CONFIG }
}

export function mergeBrowserConfig(
	base: HeadlessBrowserOptions,
	overrides: Partial<HeadlessBrowserOptions>,
): HeadlessBrowserOptions {
	return {
		...base,
		...overrides,
		viewport: {
			...base.viewport,
			...overrides.viewport,
		},
		args: overrides.args || base.args,
	}
}
