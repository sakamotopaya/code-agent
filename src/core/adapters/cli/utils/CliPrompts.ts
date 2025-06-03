import inquirer from "inquirer"
import chalk from "chalk"

/**
 * Utility for CLI prompts and user interactions
 */
export class CliPrompts {
	/**
	 * Ask a simple yes/no question
	 * @param question The question to ask
	 * @param defaultValue Optional default value
	 * @returns Promise resolving to true/false
	 */
	static async confirm(question: string, defaultValue?: boolean): Promise<boolean> {
		const { confirmed } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmed",
				message: question,
				default: defaultValue,
			},
		])
		return confirmed
	}

	/**
	 * Ask for text input
	 * @param question The question to ask
	 * @param options Input options
	 * @returns Promise resolving to the input string
	 */
	static async input(
		question: string,
		options?: {
			defaultValue?: string
			validate?: (input: string) => boolean | string
			password?: boolean
		},
	): Promise<string> {
		const promptConfig: any = {
			type: options?.password ? "password" : "input",
			name: "input",
			message: question,
			default: options?.defaultValue,
		}

		if (options?.validate) {
			promptConfig.validate = (input: string) => {
				const validation = options.validate!(input)
				return validation === true ? true : validation || "Invalid input"
			}
		}

		const { input } = await inquirer.prompt([promptConfig])
		return input
	}

	/**
	 * Ask user to select from a list of choices
	 * @param question The question to ask
	 * @param choices Array of choices
	 * @param defaultChoice Optional default choice
	 * @returns Promise resolving to the selected choice
	 */
	static async select(question: string, choices: string[], defaultChoice?: string): Promise<string> {
		const { selection } = await inquirer.prompt([
			{
				type: "list",
				name: "selection",
				message: question,
				choices: choices,
				default: defaultChoice,
			},
		])
		return selection
	}

	/**
	 * Ask user to select multiple items from a list
	 * @param question The question to ask
	 * @param choices Array of choices
	 * @param defaultChoices Optional default selections
	 * @returns Promise resolving to array of selected choices
	 */
	static async multiSelect(question: string, choices: string[], defaultChoices?: string[]): Promise<string[]> {
		const { selections } = await inquirer.prompt([
			{
				type: "checkbox",
				name: "selections",
				message: question,
				choices: choices,
				default: defaultChoices,
			},
		])
		return selections
	}

	/**
	 * Ask for a number input
	 * @param question The question to ask
	 * @param options Number input options
	 * @returns Promise resolving to the number
	 */
	static async number(
		question: string,
		options?: {
			defaultValue?: number
			min?: number
			max?: number
			validate?: (input: number) => boolean | string
		},
	): Promise<number> {
		const { input } = await inquirer.prompt([
			{
				type: "input",
				name: "input",
				message: question,
				default: options?.defaultValue?.toString(),
				validate: (input: string) => {
					const num = parseFloat(input)

					if (isNaN(num)) {
						return "Please enter a valid number"
					}

					if (options?.min !== undefined && num < options.min) {
						return `Number must be at least ${options.min}`
					}

					if (options?.max !== undefined && num > options.max) {
						return `Number must be at most ${options.max}`
					}

					if (options?.validate) {
						const validation = options.validate(num)
						return validation === true ? true : validation || "Invalid number"
					}

					return true
				},
			},
		])
		return parseFloat(input)
	}

	/**
	 * Display a list and ask user to select one item
	 * @param title Title for the list
	 * @param items Array of items with name and optional description
	 * @param allowCancel Whether to allow canceling the selection
	 * @returns Promise resolving to selected item or null if canceled
	 */
	static async selectFromList<T>(
		title: string,
		items: Array<{ name: string; value: T; description?: string }>,
		allowCancel: boolean = false,
	): Promise<T | null> {
		const choices = items.map((item) => ({
			name: item.description ? `${item.name} - ${chalk.gray(item.description)}` : item.name,
			value: item.value,
		}))

		if (allowCancel) {
			choices.push({
				name: chalk.red("Cancel"),
				value: null as any,
			})
		}

		const { selection } = await inquirer.prompt([
			{
				type: "list",
				name: "selection",
				message: title,
				choices: choices,
			},
		])

		return selection
	}

	/**
	 * Ask for file path input with validation
	 * @param question The question to ask
	 * @param options Path input options
	 * @returns Promise resolving to the file path
	 */
	static async filePath(
		question: string,
		options?: {
			defaultValue?: string
			mustExist?: boolean
			allowDirectories?: boolean
		},
	): Promise<string> {
		const { path } = await inquirer.prompt([
			{
				type: "input",
				name: "path",
				message: question,
				default: options?.defaultValue,
				validate: async (input: string) => {
					if (!input.trim()) {
						return "Please enter a path"
					}

					if (options?.mustExist) {
						try {
							const fs = await import("fs/promises")
							const stat = await fs.stat(input)

							if (!options.allowDirectories && stat.isDirectory()) {
								return "Path must be a file, not a directory"
							}

							if (options.allowDirectories === false && !stat.isFile()) {
								return "Path must be a valid file"
							}
						} catch {
							return "Path does not exist"
						}
					}

					return true
				},
			},
		])
		return path
	}

	/**
	 * Show a progress prompt that can be updated
	 * @param initialMessage Initial message to show
	 * @returns Object with update and close methods
	 */
	static createProgressPrompt(initialMessage: string): {
		update: (message: string) => void
		close: () => void
	} {
		console.log(chalk.blue(`🔄 ${initialMessage}`))

		return {
			update: (message: string) => {
				// Clear the current line and write new message
				process.stdout.write("\r\x1b[K")
				process.stdout.write(chalk.blue(`🔄 ${message}`))
			},
			close: () => {
				process.stdout.write("\n")
			},
		}
	}
}
