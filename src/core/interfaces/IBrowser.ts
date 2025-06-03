/**
 * Interface for browser operations abstraction.
 * Provides methods for browser automation and interaction
 * in both VS Code extension and CLI environments.
 */
export interface IBrowser {
	/**
	 * Launch a browser instance
	 * @param options Browser launch options
	 * @returns A browser session instance
	 */
	launch(options?: BrowserLaunchOptions): Promise<IBrowserSession>

	/**
	 * Connect to an existing browser instance
	 * @param options Connection options
	 * @returns A browser session instance
	 */
	connect(options: BrowserConnectOptions): Promise<IBrowserSession>

	/**
	 * Get available browser types
	 * @returns Array of available browser types
	 */
	getAvailableBrowsers(): Promise<BrowserType[]>

	/**
	 * Check if a browser is installed
	 * @param browserType The browser type to check
	 * @returns True if the browser is installed
	 */
	isBrowserInstalled(browserType: BrowserType): Promise<boolean>

	/**
	 * Get the default browser executable path
	 * @param browserType The browser type
	 * @returns The executable path
	 */
	getBrowserExecutablePath(browserType: BrowserType): Promise<string | undefined>

	/**
	 * Download and install a browser if needed
	 * @param browserType The browser type to install
	 * @param options Installation options
	 */
	installBrowser(browserType: BrowserType, options?: BrowserInstallOptions): Promise<void>
}

/**
 * Interface for browser session management
 */
export interface IBrowserSession {
	/** Unique identifier for the browser session */
	id: string

	/** Whether the browser session is active */
	isActive: boolean

	/**
	 * Navigate to a URL
	 * @param url The URL to navigate to
	 * @param options Navigation options
	 * @returns Browser action result
	 */
	navigateToUrl(url: string, options?: NavigationOptions): Promise<BrowserActionResult>

	/**
	 * Click at specific coordinates
	 * @param coordinate The coordinates to click (format: "x,y")
	 * @param options Click options
	 * @returns Browser action result
	 */
	click(coordinate: string, options?: ClickOptions): Promise<BrowserActionResult>

	/**
	 * Type text into the current focused element
	 * @param text The text to type
	 * @param options Typing options
	 * @returns Browser action result
	 */
	type(text: string, options?: TypeOptions): Promise<BrowserActionResult>

	/**
	 * Hover over specific coordinates
	 * @param coordinate The coordinates to hover over (format: "x,y")
	 * @param options Hover options
	 * @returns Browser action result
	 */
	hover(coordinate: string, options?: HoverOptions): Promise<BrowserActionResult>

	/**
	 * Scroll the page
	 * @param direction The scroll direction
	 * @param options Scroll options
	 * @returns Browser action result
	 */
	scroll(direction: ScrollDirection, options?: ScrollOptions): Promise<BrowserActionResult>

	/**
	 * Resize the browser viewport
	 * @param size The new size (format: "width,height")
	 * @param options Resize options
	 * @returns Browser action result
	 */
	resize(size: string, options?: ResizeOptions): Promise<BrowserActionResult>

	/**
	 * Take a screenshot of the current page
	 * @param options Screenshot options
	 * @returns Screenshot data
	 */
	screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult>

	/**
	 * Execute JavaScript in the browser
	 * @param script The JavaScript code to execute
	 * @param options Execution options
	 * @returns The result of the script execution
	 */
	executeScript(script: string, options?: ScriptOptions): Promise<any>

	/**
	 * Wait for an element to appear
	 * @param selector The CSS selector to wait for
	 * @param options Wait options
	 * @returns True if element appeared within timeout
	 */
	waitForElement(selector: string, options?: WaitOptions): Promise<boolean>

	/**
	 * Wait for navigation to complete
	 * @param options Wait options
	 * @returns True if navigation completed within timeout
	 */
	waitForNavigation(options?: WaitOptions): Promise<boolean>

	/**
	 * Get the current page URL
	 * @returns The current URL
	 */
	getCurrentUrl(): Promise<string>

	/**
	 * Get the page title
	 * @returns The page title
	 */
	getTitle(): Promise<string>

	/**
	 * Get the page content (HTML)
	 * @returns The page HTML content
	 */
	getContent(): Promise<string>

	/**
	 * Get console logs from the page
	 * @param options Log retrieval options
	 * @returns Array of console logs
	 */
	getConsoleLogs(options?: LogOptions): Promise<ConsoleLog[]>

	/**
	 * Clear console logs
	 */
	clearConsoleLogs(): Promise<void>

	/**
	 * Set viewport size
	 * @param width The viewport width
	 * @param height The viewport height
	 */
	setViewport(width: number, height: number): Promise<void>

	/**
	 * Get viewport size
	 * @returns The current viewport size
	 */
	getViewport(): Promise<ViewportSize>

	/**
	 * Close the browser session
	 */
	close(): Promise<void>

	/**
	 * Listen for page events
	 * @param event The event type to listen for
	 * @param callback The callback to handle the event
	 */
	on(event: BrowserEvent, callback: (data: any) => void): void

	/**
	 * Remove event listener
	 * @param event The event type
	 * @param callback The callback to remove
	 */
	off(event: BrowserEvent, callback: (data: any) => void): void
}

/**
 * Browser types
 */
export enum BrowserType {
	CHROME = "chrome",
	FIREFOX = "firefox",
	SAFARI = "safari",
	EDGE = "edge",
	CHROMIUM = "chromium",
}

/**
 * Scroll directions
 */
export enum ScrollDirection {
	UP = "up",
	DOWN = "down",
	LEFT = "left",
	RIGHT = "right",
}

/**
 * Browser events
 */
export enum BrowserEvent {
	CONSOLE = "console",
	PAGE_ERROR = "pageerror",
	REQUEST = "request",
	RESPONSE = "response",
	NAVIGATION = "navigation",
	LOAD = "load",
	DOM_CONTENT_LOADED = "domcontentloaded",
}

/**
 * Options for launching a browser
 */
export interface BrowserLaunchOptions {
	/** Browser type to launch */
	browserType?: BrowserType

	/** Whether to run in headless mode */
	headless?: boolean

	/** Custom executable path */
	executablePath?: string

	/** Browser arguments */
	args?: string[]

	/** Default viewport size */
	defaultViewport?: ViewportSize

	/** Whether to ignore HTTPS errors */
	ignoreHTTPSErrors?: boolean

	/** Timeout for launching */
	timeout?: number

	/** User data directory */
	userDataDir?: string

	/** Whether to run in devtools mode */
	devtools?: boolean

	/** Slow motion delay between actions */
	slowMo?: number
}

/**
 * Options for connecting to a browser
 */
export interface BrowserConnectOptions {
	/** Browser WebSocket endpoint URL */
	browserWSEndpoint?: string

	/** Browser URL for connection */
	browserURL?: string

	/** Default viewport size */
	defaultViewport?: ViewportSize

	/** Whether to ignore HTTPS errors */
	ignoreHTTPSErrors?: boolean

	/** Connection timeout */
	timeout?: number
}

/**
 * Options for browser installation
 */
export interface BrowserInstallOptions {
	/** Installation directory */
	installDir?: string

	/** Whether to force reinstallation */
	force?: boolean

	/** Progress callback */
	onProgress?: (progress: number, message: string) => void
}

/**
 * Navigation options
 */
export interface NavigationOptions {
	/** Timeout for navigation */
	timeout?: number

	/** Wait conditions */
	waitUntil?: WaitCondition[]

	/** Referer header */
	referer?: string
}

/**
 * Click options
 */
export interface ClickOptions {
	/** Mouse button to click */
	button?: MouseButton

	/** Number of clicks */
	clickCount?: number

	/** Delay between clicks */
	delay?: number

	/** Modifier keys */
	modifiers?: ModifierKey[]
}

/**
 * Type options
 */
export interface TypeOptions {
	/** Delay between keystrokes */
	delay?: number

	/** Whether to clear existing text first */
	clear?: boolean
}

/**
 * Hover options
 */
export interface HoverOptions {
	/** Duration to hover */
	duration?: number
}

/**
 * Scroll options
 */
export interface ScrollOptions {
	/** Amount to scroll */
	amount?: number

	/** Whether to scroll smoothly */
	smooth?: boolean
}

/**
 * Resize options
 */
export interface ResizeOptions {
	/** Whether to resize the window or just viewport */
	windowResize?: boolean
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
	/** Image format */
	format?: "png" | "jpeg" | "webp"

	/** Image quality (0-100) */
	quality?: number

	/** Whether to capture full page */
	fullPage?: boolean

	/** Clip area */
	clip?: ClipArea

	/** Whether to omit background */
	omitBackground?: boolean

	/** Encoding for the result */
	encoding?: "base64" | "binary"
}

/**
 * Script execution options
 */
export interface ScriptOptions {
	/** Timeout for script execution */
	timeout?: number

	/** Arguments to pass to the script */
	args?: any[]
}

/**
 * Wait options
 */
export interface WaitOptions {
	/** Timeout in milliseconds */
	timeout?: number

	/** Polling interval */
	interval?: number

	/** Whether the element should be visible */
	visible?: boolean
}

/**
 * Log retrieval options
 */
export interface LogOptions {
	/** Log types to include */
	types?: ConsoleLogType[]

	/** Maximum number of logs to return */
	limit?: number

	/** Whether to include timestamps */
	includeTimestamp?: boolean
}

/**
 * Result of browser actions
 */
export interface BrowserActionResult {
	/** Screenshot of the current state */
	screenshot?: string

	/** Console logs */
	logs?: string

	/** Current URL */
	currentUrl?: string

	/** Current mouse position */
	currentMousePosition?: string

	/** Whether the action was successful */
	success?: boolean

	/** Error message if action failed */
	error?: string
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
	/** Screenshot data */
	data: string | Uint8Array

	/** Image format */
	format: string

	/** Image dimensions */
	width: number
	height: number
}

/**
 * Console log entry
 */
export interface ConsoleLog {
	/** Log type */
	type: ConsoleLogType

	/** Log message */
	message: string

	/** Timestamp */
	timestamp: Date

	/** Stack trace if available */
	stackTrace?: string

	/** Source location */
	location?: LogLocation
}

/**
 * Console log types
 */
export enum ConsoleLogType {
	LOG = "log",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
	DEBUG = "debug",
	TRACE = "trace",
}

/**
 * Log source location
 */
export interface LogLocation {
	/** File URL */
	url: string

	/** Line number */
	lineNumber: number

	/** Column number */
	columnNumber: number
}

/**
 * Viewport size
 */
export interface ViewportSize {
	/** Width in pixels */
	width: number

	/** Height in pixels */
	height: number

	/** Device scale factor */
	deviceScaleFactor?: number

	/** Whether the viewport is mobile */
	isMobile?: boolean

	/** Whether touch events are supported */
	hasTouch?: boolean

	/** Whether the viewport is in landscape mode */
	isLandscape?: boolean
}

/**
 * Clip area for screenshots
 */
export interface ClipArea {
	/** X coordinate */
	x: number

	/** Y coordinate */
	y: number

	/** Width */
	width: number

	/** Height */
	height: number
}

/**
 * Mouse buttons
 */
export enum MouseButton {
	LEFT = "left",
	RIGHT = "right",
	MIDDLE = "middle",
}

/**
 * Modifier keys
 */
export enum ModifierKey {
	ALT = "Alt",
	CONTROL = "Control",
	META = "Meta",
	SHIFT = "Shift",
}

/**
 * Wait conditions for navigation
 */
export enum WaitCondition {
	LOAD = "load",
	DOM_CONTENT_LOADED = "domcontentloaded",
	NETWORK_IDLE_0 = "networkidle0",
	NETWORK_IDLE_2 = "networkidle2",
}
