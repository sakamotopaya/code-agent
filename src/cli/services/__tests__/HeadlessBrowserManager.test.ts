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
			const mockPage = { setUserAgent: jest.fn() }
			const mockBrowser = {
				newPage: jest.fn(),
				close: jest.fn(),
				pages: jest.fn().mockResolvedValue([mockPage]),
				on: jest.fn(),
			}
			const PCR = require("puppeteer-chromium-resolver")
			PCR.mockResolvedValue({
				puppeteer: {
					launch: jest.fn().mockResolvedValue(mockBrowser),
				},
				executablePath: "/mock/chrome/path",
			})

			const browser = await manager.createSession()

			expect(browser).toBe(mockBrowser)
		})

		it("should launch browser with custom config", async () => {
			const mockPage = { setUserAgent: jest.fn() }
			const mockBrowser = {
				newPage: jest.fn(),
				close: jest.fn(),
				pages: jest.fn().mockResolvedValue([mockPage]),
				on: jest.fn(),
			}
			const PCR = require("puppeteer-chromium-resolver")
			PCR.mockResolvedValue({
				puppeteer: {
					launch: jest.fn().mockResolvedValue(mockBrowser),
				},
				executablePath: "/mock/chrome/path",
			})

			const customConfig = { ...CLI_BROWSER_CONFIG, headless: false }
			const browser = await manager.createSession(customConfig)

			expect(browser).toBe(mockBrowser)
		})

		it("should set user agent on existing pages when provided", async () => {
			const mockPage1 = { setUserAgent: jest.fn() }
			const mockPage2 = { setUserAgent: jest.fn() }
			const mockBrowser = {
				newPage: jest.fn(),
				close: jest.fn(),
				pages: jest.fn().mockResolvedValue([mockPage1, mockPage2]),
				on: jest.fn(),
			}
			const PCR = require("puppeteer-chromium-resolver")
			PCR.mockResolvedValue({
				puppeteer: {
					launch: jest.fn().mockResolvedValue(mockBrowser),
				},
				executablePath: "/mock/chrome/path",
			})

			const customConfig = {
				...CLI_BROWSER_CONFIG,
				userAgent: "Custom User Agent",
			}
			const browser = await manager.createSession(customConfig)

			expect(browser).toBe(mockBrowser)
			expect(mockBrowser.pages).toHaveBeenCalled()
			expect(mockPage1.setUserAgent).toHaveBeenCalledWith("Custom User Agent")
			expect(mockPage2.setUserAgent).toHaveBeenCalledWith("Custom User Agent")
			expect(mockBrowser.on).toHaveBeenCalledWith("targetcreated", expect.any(Function))
		})

		it("should set up event listener for new pages when user agent provided", async () => {
			const mockPage = { setUserAgent: jest.fn() }
			const mockBrowser = {
				newPage: jest.fn(),
				close: jest.fn(),
				pages: jest.fn().mockResolvedValue([]),
				on: jest.fn(),
			}
			const PCR = require("puppeteer-chromium-resolver")
			PCR.mockResolvedValue({
				puppeteer: {
					launch: jest.fn().mockResolvedValue(mockBrowser),
				},
				executablePath: "/mock/chrome/path",
			})

			const customConfig = {
				...CLI_BROWSER_CONFIG,
				userAgent: "Custom User Agent",
			}
			await manager.createSession(customConfig)

			expect(mockBrowser.on).toHaveBeenCalledWith("targetcreated", expect.any(Function))

			// Test the event handler
			const eventHandler = mockBrowser.on.mock.calls[0][1]
			const mockTarget = {
				page: jest.fn().mockResolvedValue(mockPage),
			}

			await eventHandler(mockTarget)

			expect(mockTarget.page).toHaveBeenCalled()
			expect(mockPage.setUserAgent).toHaveBeenCalledWith("Custom User Agent")
		})

		it("should not set user agent when not provided", async () => {
			const mockPage = { setUserAgent: jest.fn() }
			const mockBrowser = {
				newPage: jest.fn(),
				close: jest.fn(),
				pages: jest.fn().mockResolvedValue([mockPage]),
				on: jest.fn(),
			}
			const PCR = require("puppeteer-chromium-resolver")
			PCR.mockResolvedValue({
				puppeteer: {
					launch: jest.fn().mockResolvedValue(mockBrowser),
				},
				executablePath: "/mock/chrome/path",
			})

			await manager.createSession()

			expect(mockBrowser.pages).not.toHaveBeenCalled()
			expect(mockPage.setUserAgent).not.toHaveBeenCalled()
			expect(mockBrowser.on).not.toHaveBeenCalled()
		})
	})

	describe("cleanup", () => {
		it("should cleanup resources", async () => {
			await expect(manager.cleanup()).resolves.toBeUndefined()
		})
	})
})
