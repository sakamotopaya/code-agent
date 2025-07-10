import { config } from "@roo-code/config-eslint/base"

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		rules: {
			// TODO: These should be fixed and the rules re-enabled.
			"no-regex-spaces": "off",
			"no-useless-escape": "off",
			"no-empty": "off",
			"prefer-const": "off",

			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/ban-ts-comment": "off",
		},
	},
	{
		files: ["core/assistant-message/presentAssistantMessage.ts", "core/webview/webviewMessageHandler.ts"],
		rules: {
			"no-case-declarations": "off",
		},
	},
	{
		files: ["__mocks__/**/*.js", "cli/__mocks__/**/*.js"],
		rules: {
			"no-undef": "off",
		},
	},
	{
		files: ["test-run-output/**/*.js", "**/__tests__/**/*.js", "temp/**/*.js", "test-cli-simple.js", "test-cli-logging.js"],
		languageOptions: {
			globals: {
				require: "readonly",
				console: "readonly",
				process: "readonly",
				__dirname: "readonly",
				module: "readonly",
				exports: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				// Jest globals
				describe: "readonly",
				test: "readonly",
				it: "readonly",
				expect: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
				beforeAll: "readonly",
				afterAll: "readonly",
				jest: "readonly",
			},
		},
	},
	{
		files: ["**/CLIStreamProcessor.test.ts"],
		rules: {
			"no-control-regex": "off",
		},
	},
	{
		ignores: ["webview-ui", "out"],
	},
]
