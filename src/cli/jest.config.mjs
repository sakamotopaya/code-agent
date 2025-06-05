import process from "node:process"

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
	preset: "ts-jest",
	testEnvironment: "node",
	displayName: "CLI Tests",
	extensionsToTreatAsEsm: [".ts"],
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				useESM: true,
				tsconfig: {
					module: "CommonJS",
					moduleResolution: "node",
					esModuleInterop: true,
					allowJs: true,
				},
				diagnostics: false,
			},
		],
	},
	roots: ["<rootDir>"],
	testMatch: [
		"**/__tests__/**/*.test.ts",
		"**/?(*.)+(spec|test).ts"
	],
	collectCoverageFrom: [
		"**/*.ts",
		"!**/*.d.ts",
		"!**/__tests__/**",
		"!**/__mocks__/**",
		"!**/node_modules/**",
		"!jest.config.mjs",
		"!tsconfig.json"
	],
	coverageThreshold: {
		global: {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90
		}
	},
	testPathIgnorePatterns: [
		// Skip platform-specific tests based on environment
		...(process.platform === "win32" ? [".*\\.unix\\.test\\.ts$"] : [".*\\.windows\\.test\\.ts$"]),
		"node_modules/"
	],
	moduleNameMapper: {
		"^@cli/(.*)$": "<rootDir>/$1",
	},
	transformIgnorePatterns: [
		"node_modules/(?!(chalk|ora|inquirer|commander|boxen|cli-table3)/)",
	],
	setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
	testTimeout: 30000, // 30 seconds for integration tests
	maxWorkers: "50%", // Use half the available cores for test parallelization
	verbose: true,
	forceExit: true,
	detectOpenHandles: true
}