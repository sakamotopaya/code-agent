import i18next from "i18next"

// Build translations object
const translations: Record<string, Record<string, any>> = {}

// Determine if running in test environment (jest)
const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined

// Load translations based on environment
if (!isTestEnv) {
	try {
		// Dynamic imports to avoid browser compatibility issues
		const fs = require("fs")
		const path = require("path")

		// Check if running as standalone executable
		const isStandaloneExecutable =
			process.env.PKG_EXECUTABLE === "true" || process.argv[0].includes("roo-cline") || process.pkg !== undefined

		// Determine locales directory based on context
		let localesDir: string
		let localesFound = false

		// In CLI build, locales are at dist/i18n/locales
		// In VSCode extension, locales are at i18n/locales relative to this file
		const cliLocalesDir = path.join(__dirname, "..", "i18n", "locales")
		const extensionLocalesDir = path.join(__dirname, "locales")

		if (fs.existsSync(cliLocalesDir)) {
			localesDir = cliLocalesDir
			localesFound = true
		} else if (fs.existsSync(extensionLocalesDir)) {
			localesDir = extensionLocalesDir
			localesFound = true
		} else {
			// Fallback: try to find locales directory
			const possiblePaths = [
				path.join(__dirname, "i18n", "locales"),
				path.join(__dirname, "..", "..", "i18n", "locales"),
				path.join(process.cwd(), "src", "i18n", "locales"),
			]

			const foundPath = possiblePaths.find((p) => fs.existsSync(p))
			if (foundPath) {
				localesDir = foundPath
				localesFound = true
			} else {
				localesDir = extensionLocalesDir
				localesFound = false
			}
		}

		// For standalone executables, silently handle missing locales (they may be bundled differently)
		if (!localesFound) {
			if (!isStandaloneExecutable) {
				// Only show warning for non-standalone executables
				console.warn(`Locales directory not found: ${localesDir}`)
			}
			// Set up minimal default translations for English
			translations["en"] = {
				common: {},
				tools: {},
			}
		} else {
			try {
				// Find all language directories
				const languageDirs = fs.readdirSync(localesDir, { withFileTypes: true })

				const languages = languageDirs
					.filter((dirent: { isDirectory: () => boolean }) => dirent.isDirectory())
					.map((dirent: { name: string }) => dirent.name)

				// Process each language
				languages.forEach((language: string) => {
					const langPath = path.join(localesDir, language)

					// Find all JSON files in the language directory
					const files = fs.readdirSync(langPath).filter((file: string) => file.endsWith(".json"))

					// Initialize language in translations object
					if (!translations[language]) {
						translations[language] = {}
					}

					// Process each namespace file
					files.forEach((file: string) => {
						const namespace = path.basename(file, ".json")
						const filePath = path.join(langPath, file)

						try {
							// Read and parse the JSON file
							const content = fs.readFileSync(filePath, "utf8")
							translations[language][namespace] = JSON.parse(content)
						} catch (error) {
							console.error(`Error loading translation file ${filePath}:`, error)
						}
					})
				})

				// Debug: Loaded translations (only log in verbose mode)
			} catch (dirError) {
				if (!isStandaloneExecutable) {
					// Only show error for non-standalone executables
					console.error(`Error processing directory ${localesDir}:`, dirError)
				}
				// Set up minimal default translations
				translations["en"] = {
					common: {},
					tools: {},
				}
			}
		}
	} catch (error) {
		// Only log error for non-standalone executables
		const isStandaloneExecutable =
			process.env.PKG_EXECUTABLE === "true" || process.argv[0].includes("roo-cline") || process.pkg !== undefined

		if (!isStandaloneExecutable) {
			console.error("Error loading translations:", error)
		}
		// Set up minimal default translations as fallback
		translations["en"] = {
			common: {},
			tools: {},
		}
	}
}

// Initialize i18next with configuration
i18next.init({
	lng: "en",
	fallbackLng: "en",
	debug: false,
	resources: translations,
	interpolation: {
		escapeValue: false,
	},
})

export default i18next
