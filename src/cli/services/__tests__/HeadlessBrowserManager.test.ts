import { HeadlessBrowserManager } from "../HeadlessBrowserManager"
import { CLI_BROWSER_CONFIG } from "../../types/browser-types"

// Mock puppeteer-core and PCR
jest.mock("puppeteer-core", () => ({
	launch: jest.fn(),
}))

jest.mock("puppeteer-chromium-resolver", () => {
	return jest.fn(() =>
		Promise.resolve({
			puppeteer: {
				launch: jest.fn(),
			},
			executablePath: "/mock/chrome/path",
		}),
	)
})

jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockResolvedValue(true),
}))

describe("HeadlessBrowserManager", () => {
	let manager: HeadlessBrowserManager

	beforeEach(() => {
		manager = new HeadlessBrowserManager("/test/workdir")
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with working directory", () => {
			expect(manager).toBeDefined()
		})
	})

	describe("createSession", () => {
		it("should launch browser with default config", async () => {
			const mockBrowser = { newPage: jest.fn(), close: jest.fn() }
			const { launch } = require("puppeteer-core")
			launch.mockResolvedValue(mockBrowser)

			const browser = await manager.createSession()

			expect(browser).toBe(mockBrowser)
			expect(launch).toHaveBeenCalledWith(
				expect.objectContaining({
					headless: CLI_BROWSER_CONFIG.headless,
					args: CLI_BROWSER_CONFIG.args,
				}),
			)
		})

		it("should launch browser with custom config", async () => {
			const mockBrowser = { newPage: jest.fn(), close: jest.fn() }
			const { launch } = require("puppeteer-core")
			launch.mockResolvedValue(mockBrowser)

			const customConfig = { ...CLI_BROWSER_CONFIG, headless: false }
			const browser = await manager.createSession(customConfig)

			expect(browser).toBe(mockBrowser)
			expect(launch).toHaveBeenCalledWith(
				expect.objectContaining({
					headless: false,
				}),
			)
		})
	})

	describe("cleanup", () => {
		it("should cleanup resources", async () => {
			await expect(manager.cleanup()).resolves.toBeUndefined()
		})
	})
})
