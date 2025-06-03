import { CLIBrowserService, CLIBrowserSession } from "../CLIBrowserService"
import { HeadlessBrowserManager } from "../HeadlessBrowserManager"
import { ScreenshotCapture } from "../ScreenshotCapture"
import { ContentExtractor } from "../ContentExtractor"
import { FormInteractor } from "../FormInteractor"
import { Browser, Page } from "puppeteer-core"
import { CLI_BROWSER_CONFIG } from "../../types/browser-types"

// Mock dependencies
jest.mock("../HeadlessBrowserManager")
jest.mock("../ScreenshotCapture")
jest.mock("../ContentExtractor")
jest.mock("../FormInteractor")

describe("CLIBrowserService", () => {
	let service: CLIBrowserService
	let mockBrowserManager: jest.Mocked<HeadlessBrowserManager>
	let mockScreenshotCapture: jest.Mocked<ScreenshotCapture>
	let mockContentExtractor: jest.Mocked<ContentExtractor>
	let mockFormInteractor: jest.Mocked<FormInteractor>

	beforeEach(() => {
		mockBrowserManager = new HeadlessBrowserManager("/test") as jest.Mocked<HeadlessBrowserManager>
		mockScreenshotCapture = new ScreenshotCapture("/test") as jest.Mocked<ScreenshotCapture>
		mockContentExtractor = new ContentExtractor() as jest.Mocked<ContentExtractor>
		mockFormInteractor = new FormInteractor() as jest.Mocked<FormInteractor>

		service = new CLIBrowserService("/test/workdir")
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with default configuration", () => {
			expect(service).toBeDefined()
			expect(HeadlessBrowserManager).toHaveBeenCalledWith("/test/workdir")
		})

		it("should merge custom options with defaults", () => {
			const customOptions = { viewport: { width: 1280, height: 720 } }
			const customService = new CLIBrowserService("/test/workdir", customOptions)
			expect(customService).toBeDefined()
		})
	})

	describe("setHeadlessMode", () => {
		it("should update headless mode setting", () => {
			service.setHeadlessMode(false)
			// The headless mode should be updated internally
			expect(service.getHeadlessCapabilities()).toEqual({
				screenshots: true,
				contentExtraction: true,
				formInteraction: true,
				pdfGeneration: true,
				networkMonitoring: true,
			})
		})
	})

	describe("getHeadlessCapabilities", () => {
		it("should return all supported capabilities", () => {
			const capabilities = service.getHeadlessCapabilities()
			expect(capabilities).toEqual({
				screenshots: true,
				contentExtraction: true,
				formInteraction: true,
				pdfGeneration: true,
				networkMonitoring: true,
			})
		})
	})

	describe("setOutputDirectory", () => {
		it("should update output directory", () => {
			const newDir = "/new/output/dir"
			service.setOutputDirectory(newDir)
			// Should create new ScreenshotCapture instance with new directory
			expect(ScreenshotCapture).toHaveBeenCalledWith(newDir)
		})
	})

	describe("launchHeadless", () => {
		it("should launch browser with default options", async () => {
			const mockBrowser = {} as Browser
			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)

			const session = await service.launchHeadless()

			expect(mockBrowserManager.createSession).toHaveBeenCalledWith(CLI_BROWSER_CONFIG)
			expect(session).toBeInstanceOf(CLIBrowserSession)
		})

		it("should launch browser with custom options", async () => {
			const mockBrowser = {} as Browser
			const customOptions = { headless: false, viewport: { width: 800, height: 600 } }
			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)

			const session = await service.launchHeadless(customOptions)

			expect(mockBrowserManager.createSession).toHaveBeenCalledWith({
				...CLI_BROWSER_CONFIG,
				...customOptions,
			})
			expect(session).toBeInstanceOf(CLIBrowserSession)
		})
	})

	describe("captureScreenshot", () => {
		it("should capture screenshot of URL", async () => {
			const mockBrowser = {} as Browser
			const mockSession = {
				launch: jest.fn().mockResolvedValue(undefined),
				captureScreenshot: jest.fn().mockResolvedValue("/path/to/screenshot.png"),
				close: jest.fn().mockResolvedValue(undefined),
			}

			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)
			jest.spyOn(service, "launchHeadless").mockResolvedValue(mockSession as any)

			const screenshotPath = await service.captureScreenshot("https://example.com")

			expect(mockSession.launch).toHaveBeenCalledWith("https://example.com")
			expect(mockSession.captureScreenshot).toHaveBeenCalled()
			expect(mockSession.close).toHaveBeenCalled()
			expect(screenshotPath).toBe("/path/to/screenshot.png")
		})

		it("should handle screenshot errors and close session", async () => {
			const mockBrowser = {} as Browser
			const mockSession = {
				launch: jest.fn().mockResolvedValue(undefined),
				captureScreenshot: jest.fn().mockRejectedValue(new Error("Screenshot failed")),
				close: jest.fn().mockResolvedValue(undefined),
			}

			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)
			jest.spyOn(service, "launchHeadless").mockResolvedValue(mockSession as any)

			await expect(service.captureScreenshot("https://example.com")).rejects.toThrow("Screenshot failed")
			expect(mockSession.close).toHaveBeenCalled()
		})
	})

	describe("extractContent", () => {
		it("should extract content from URL", async () => {
			const mockBrowser = {} as Browser
			const mockContent = {
				title: "Test Page",
				text: "Sample content",
				links: [],
				images: [],
				forms: [],
				metadata: { url: "https://example.com", title: "Test Page", timestamp: "2023-01-01T00:00:00.000Z" },
			}
			const mockSession = {
				launch: jest.fn().mockResolvedValue(undefined),
				extractContent: jest.fn().mockResolvedValue(mockContent),
				close: jest.fn().mockResolvedValue(undefined),
			}

			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)
			jest.spyOn(service, "launchHeadless").mockResolvedValue(mockSession as any)

			const content = await service.extractContent("https://example.com", ["h1", "p"])

			expect(mockSession.launch).toHaveBeenCalledWith("https://example.com")
			expect(mockSession.extractContent).toHaveBeenCalledWith(["h1", "p"])
			expect(mockSession.close).toHaveBeenCalled()
			expect(content).toEqual(mockContent)
		})
	})

	describe("fillForm", () => {
		it("should fill form with provided data", async () => {
			const mockBrowser = {} as Browser
			const formData = { username: "test", password: "secret" }
			const mockResult = { success: true, url: "https://example.com", responseTime: 100 }
			const mockSession = {
				launch: jest.fn().mockResolvedValue(undefined),
				fillForm: jest.fn().mockResolvedValue(mockResult),
				close: jest.fn().mockResolvedValue(undefined),
			}

			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)
			jest.spyOn(service, "launchHeadless").mockResolvedValue(mockSession as any)

			const result = await service.fillForm("https://example.com/login", formData)

			expect(mockSession.launch).toHaveBeenCalledWith("https://example.com/login")
			expect(mockSession.fillForm).toHaveBeenCalledWith(formData)
			expect(mockSession.close).toHaveBeenCalled()
			expect(result).toEqual(mockResult)
		})
	})

	describe("submitForm", () => {
		it("should submit form using selector", async () => {
			const mockBrowser = {} as Browser
			const mockResult = { success: true, redirectUrl: "https://example.com/success" }
			const mockSession = {
				launch: jest.fn().mockResolvedValue(undefined),
				submitForm: jest.fn().mockResolvedValue(mockResult),
				close: jest.fn().mockResolvedValue(undefined),
			}

			mockBrowserManager.createSession.mockResolvedValue(mockBrowser)
			jest.spyOn(service, "launchHeadless").mockResolvedValue(mockSession as any)

			const result = await service.submitForm("https://example.com/form", "#login-form")

			expect(mockSession.launch).toHaveBeenCalledWith("https://example.com/form")
			expect(mockSession.submitForm).toHaveBeenCalledWith("#login-form")
			expect(mockSession.close).toHaveBeenCalled()
			expect(result).toEqual(mockResult)
		})
	})
})

describe("CLIBrowserSession", () => {
	let session: CLIBrowserSession
	let mockBrowser: jest.Mocked<Browser>
	let mockPage: jest.Mocked<Page>
	let mockScreenshotCapture: jest.Mocked<ScreenshotCapture>
	let mockContentExtractor: jest.Mocked<ContentExtractor>
	let mockFormInteractor: jest.Mocked<FormInteractor>

	beforeEach(() => {
		mockBrowser = {
			newPage: jest.fn(),
			close: jest.fn(),
		} as any

		mockPage = {
			goto: jest.fn(),
			close: jest.fn(),
			content: jest.fn(),
			url: jest.fn().mockReturnValue("https://example.com"),
			waitForSelector: jest.fn(),
			click: jest.fn(),
			keyboard: {
				type: jest.fn(),
			},
		} as any

		mockScreenshotCapture = {
			capture: jest.fn(),
		} as any

		mockContentExtractor = {
			extract: jest.fn(),
		} as any

		mockFormInteractor = {
			fillForm: jest.fn(),
			submitForm: jest.fn(),
		} as any

		session = new CLIBrowserSession(mockBrowser, mockScreenshotCapture, mockContentExtractor, mockFormInteractor)
	})

	describe("launch", () => {
		it("should create new page and navigate to URL", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			mockPage.goto.mockResolvedValue(null as any)
			mockPage.content.mockResolvedValue("<html></html>")

			await session.launch("https://example.com")

			expect(mockBrowser.newPage).toHaveBeenCalled()
			expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
				timeout: 30000,
				waitUntil: ["domcontentloaded", "networkidle2"],
			})
		})

		it("should throw error if browser not initialized", async () => {
			const sessionWithoutBrowser = new CLIBrowserSession(
				undefined as any,
				mockScreenshotCapture,
				mockContentExtractor,
				mockFormInteractor,
			)

			await expect(sessionWithoutBrowser.launch("https://example.com")).rejects.toThrow("Browser not initialized")
		})
	})

	describe("close", () => {
		it("should close page and browser", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			await session.close()

			expect(mockPage.close).toHaveBeenCalled()
			expect(mockBrowser.close).toHaveBeenCalled()
		})

		it("should handle closing when page is not available", async () => {
			await session.close()

			expect(mockBrowser.close).toHaveBeenCalled()
		})
	})

	describe("captureScreenshot", () => {
		it("should delegate to screenshot capture service", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			const screenshotOptions = { type: "png" as const, fullPage: true }
			mockScreenshotCapture.capture.mockResolvedValue("/path/to/screenshot.png")

			const result = await session.captureScreenshot(screenshotOptions)

			expect(mockScreenshotCapture.capture).toHaveBeenCalledWith(mockPage, screenshotOptions)
			expect(result).toBe("/path/to/screenshot.png")
		})

		it("should throw error if no page available", async () => {
			await expect(session.captureScreenshot()).rejects.toThrow("No page available. Call launch() first.")
		})
	})

	describe("extractContent", () => {
		it("should delegate to content extractor service", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			const mockContent = {
				title: "Test",
				text: "Content",
				links: [],
				images: [],
				forms: [],
				metadata: { url: "https://example.com", title: "Test", timestamp: "2023-01-01T00:00:00.000Z" },
			}
			mockContentExtractor.extract.mockResolvedValue(mockContent)

			const result = await session.extractContent(["h1"])

			expect(mockContentExtractor.extract).toHaveBeenCalledWith(mockPage, {
				includeImages: true,
				includeLinks: true,
				includeForms: true,
				includeTables: true,
				includeLists: true,
				selectors: ["h1"],
			})
			expect(result).toEqual(mockContent)
		})
	})

	describe("fillForm", () => {
		it("should delegate to form interactor service", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			const formData = { username: "test" }
			const mockResult = { success: true, url: "https://example.com", responseTime: 100 }
			mockFormInteractor.fillForm.mockResolvedValue(mockResult)

			const result = await session.fillForm(formData)

			expect(mockFormInteractor.fillForm).toHaveBeenCalledWith(mockPage, formData)
			expect(result).toEqual(mockResult)
		})
	})

	describe("submitForm", () => {
		it("should delegate to form interactor service", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			const mockResult = { success: true }
			mockFormInteractor.submitForm.mockResolvedValue(mockResult)

			const result = await session.submitForm("#form")

			expect(mockFormInteractor.submitForm).toHaveBeenCalledWith(mockPage, "#form")
			expect(result).toEqual(mockResult)
		})
	})

	describe("navigateTo", () => {
		it("should navigate to URL and wait for page stability", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			mockPage.goto.mockResolvedValue(null as any)
			mockPage.content.mockResolvedValue("<html></html>")

			await session.launch("https://example.com")
			await session.navigateTo("https://example.com/page2")

			expect(mockPage.goto).toHaveBeenCalledWith("https://example.com/page2", {
				timeout: 30000,
				waitUntil: ["domcontentloaded", "networkidle2"],
			})
		})
	})

	describe("click", () => {
		it("should wait for selector and click element", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			await session.click("#button")

			expect(mockPage.waitForSelector).toHaveBeenCalledWith("#button", { timeout: 10000 })
			expect(mockPage.click).toHaveBeenCalledWith("#button")
		})
	})

	describe("type", () => {
		it("should type text using keyboard", async () => {
			mockBrowser.newPage.mockResolvedValue(mockPage)
			await session.launch("https://example.com")

			await session.type("hello world")

			expect(mockPage.keyboard.type).toHaveBeenCalledWith("hello world")
		})
	})
})
