import * as path from "path"
import * as fs from "fs/promises"

import { Package } from "../shared/package"
import { t } from "../i18n"
import { getPlatformServices, isVsCodeContext } from "../core/adapters/PlatformServiceFactory"

/**
 * Gets the base storage path for conversations
 * If a custom path is configured, uses that path
 * Otherwise uses the default VSCode extension global storage path
 */
export async function getStorageBasePath(defaultPath: string): Promise<string> {
	// Get user-configured custom storage path
	let customStoragePath = ""

	try {
		// Use platform abstraction to get configuration
		if (isVsCodeContext()) {
			const platformServices = await getPlatformServices()
			customStoragePath = platformServices.configuration.get("customStoragePath", "") as string
		} else {
			// CLI mode - use default path
			return defaultPath
		}
	} catch (error) {
		// Platform services not available - use default path
		return defaultPath
	}

	// If no custom path is set, use default path
	if (!customStoragePath) {
		return defaultPath
	}

	try {
		// Ensure custom path exists
		await fs.mkdir(customStoragePath, { recursive: true })

		// Test if path is writable
		const testFile = path.join(customStoragePath, ".write_test")
		await fs.writeFile(testFile, "test")
		await fs.rm(testFile)

		return customStoragePath
	} catch (error) {
		// If path is unusable, report error and fall back to default path
		console.error(`Custom storage path is unusable: ${error instanceof Error ? error.message : String(error)}`)
		try {
			if (isVsCodeContext()) {
				const platformServices = await getPlatformServices()
				await platformServices.userInterface.showErrorMessage(
					t("common:errors.custom_storage_path_unusable", { path: customStoragePath }),
				)
			}
		} catch {
			// Platform services not available, skip UI notification
		}
		return defaultPath
	}
}

/**
 * Gets the storage directory path for a task
 */
export async function getTaskDirectoryPath(globalStoragePath: string, taskId: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const taskDir = path.join(basePath, "tasks", taskId)
	await fs.mkdir(taskDir, { recursive: true })
	return taskDir
}

/**
 * Gets the settings directory path
 */
export async function getSettingsDirectoryPath(globalStoragePath: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const settingsDir = path.join(basePath, "settings")
	await fs.mkdir(settingsDir, { recursive: true })
	return settingsDir
}

/**
 * Gets the cache directory path
 */
export async function getCacheDirectoryPath(globalStoragePath: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const cacheDir = path.join(basePath, "cache")
	await fs.mkdir(cacheDir, { recursive: true })
	return cacheDir
}

/**
 * Prompts the user to set a custom storage path
 * Displays an input box allowing the user to enter a custom path
 */
export async function promptForCustomStoragePath(): Promise<void> {
	try {
		if (!isVsCodeContext()) {
			console.error("Custom storage path configuration only available in VS Code")
			return
		}

		const platformServices = await getPlatformServices()

		let currentPath = ""
		try {
			currentPath = platformServices.configuration.get("customStoragePath", "") || ""
		} catch (error) {
			console.error("Could not access configuration")
			return
		}

		const result = await platformServices.userInterface.showInputBox({
			value: currentPath,
			placeHolder: t("common:storage.path_placeholder"),
			prompt: t("common:storage.prompt_custom_path"),
			validateInput: (input: string) => {
				if (!input) {
					return null // Allow empty value (use default path)
				}

				try {
					// Validate path format
					path.parse(input)

					// Check if path is absolute
					if (!path.isAbsolute(input)) {
						return t("common:storage.enter_absolute_path")
					}

					return null // Path format is valid
				} catch (e) {
					return t("common:storage.enter_valid_path")
				}
			},
		})

		// If user canceled the operation, result will be undefined
		if (result !== undefined) {
			try {
				await platformServices.configuration.set("customStoragePath", result)

				if (result) {
					try {
						// Test if path is accessible
						await fs.mkdir(result, { recursive: true })
						await platformServices.userInterface.showInformationMessage(
							t("common:info.custom_storage_path_set", { path: result }),
						)
					} catch (error) {
						await platformServices.userInterface.showErrorMessage(
							t("common:errors.cannot_access_path", {
								path: result,
								error: error instanceof Error ? error.message : String(error),
							}),
						)
					}
				} else {
					await platformServices.userInterface.showInformationMessage(t("common:info.default_storage_path"))
				}
			} catch (error) {
				console.error("Failed to update configuration", error)
			}
		}
	} catch (error) {
		// Platform services not available
		console.error("Platform services not available")
	}
}
