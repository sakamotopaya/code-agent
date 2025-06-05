import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Global test configuration
declare global {
	// eslint-disable-next-line no-var
	var testWorkspace: string
	// eslint-disable-next-line no-var
	var originalCwd: string
	// eslint-disable-next-line no-var
	var testTempDir: string
}

beforeAll(async () => {
	// Store original working directory
	global.originalCwd = process.cwd()

	// Create temp directory for tests
	global.testTempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-cli-test-"))

	// Set up global test timeout
	jest.setTimeout(30000)
})

beforeEach(async () => {
	// Create unique workspace for each test
	global.testWorkspace = await fs.mkdtemp(path.join(global.testTempDir, "workspace-"))

	// Mock console methods to reduce test noise
	jest.spyOn(console, "log").mockImplementation(() => {})
	jest.spyOn(console, "warn").mockImplementation(() => {})
	jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
	// Restore console methods
	jest.restoreAllMocks()

	// Clean up workspace
	if (global.testWorkspace) {
		try {
			await fs.rm(global.testWorkspace, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors in tests
		}
	}

	// Restore working directory
	process.chdir(global.originalCwd)
})

afterAll(async () => {
	// Clean up temp directory
	if (global.testTempDir) {
		try {
			await fs.rm(global.testTempDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	}
})
