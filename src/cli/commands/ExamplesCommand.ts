import chalk from "chalk"
import inquirer from "inquirer"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { Command } from "commander"

interface Example {
	id: string
	title: string
	description: string
	command: string
	category: string
	difficulty: "beginner" | "intermediate" | "advanced"
	estimatedTime?: string
	expectedOutput?: string
	prerequisites?: string[]
	tags?: string[]
}

interface ExampleCategory {
	id: string
	name: string
	description: string
	examples: Example[]
}

export interface IExamplesCommand {
	listCategories(): Promise<void>
	showCategory(category: string): Promise<void>
	searchExamples(query: string): Promise<void>
	runExample(exampleId: string): Promise<void>
	createCustomExample(): Promise<void>
	showExample(exampleId: string): Promise<void>
}

export class ExamplesCommand implements IExamplesCommand {
	private examplesPath: string
	private categories: ExampleCategory[] = []

	constructor(examplesPath?: string) {
		this.examplesPath = examplesPath || join(process.cwd(), "examples")
		this.loadExamples()
	}

	async listCategories(): Promise<void> {
		console.log(chalk.blue.bold("\n📚 CLI USAGE EXAMPLES\n"))
		console.log("Available categories:\n")

		this.categories.forEach((category, index) => {
			const exampleCount = category.examples.length
			const icon = this.getCategoryIcon(category.id)

			console.log(`${index + 1}. ${icon} ${chalk.cyan(category.name)}`)
			console.log(`   ${category.description}`)
			console.log(`   ${chalk.gray(`${exampleCount} example${exampleCount !== 1 ? "s" : ""}`)}`)
			console.log()
		})

		console.log(chalk.yellow("Usage:"))
		console.log(`  roo examples <category>     Show examples for a category`)
		console.log(`  roo examples search <query> Search examples`)
		console.log(`  roo examples run <id>       Run a specific example`)
		console.log()
	}

	async showCategory(categoryId: string): Promise<void> {
		const category = this.categories.find(
			(cat) => cat.id === categoryId || cat.name.toLowerCase() === categoryId.toLowerCase(),
		)

		if (!category) {
			console.log(chalk.red(`❌ Category '${categoryId}' not found.`))
			console.log(chalk.yellow("Available categories:"))
			this.categories.forEach((cat) => {
				console.log(`  - ${cat.id}`)
			})
			return
		}

		const icon = this.getCategoryIcon(category.id)
		console.log(chalk.blue.bold(`\n${icon} ${category.name.toUpperCase()} EXAMPLES\n`))
		console.log(`${category.description}\n`)

		if (category.examples.length === 0) {
			console.log(chalk.yellow("No examples available in this category yet."))
			return
		}

		category.examples.forEach((example, index) => {
			const difficultyColor = this.getDifficultyColor(example.difficulty)
			const timeStr = example.estimatedTime ? ` (${example.estimatedTime})` : ""

			console.log(
				`${index + 1}. ${chalk.cyan(example.title)} ${difficultyColor(`[${example.difficulty}]`)}${timeStr}`,
			)
			console.log(`   ${example.description}`)
			console.log(`   ${chalk.gray("Command:")} ${chalk.green(example.command)}`)

			if (example.tags && example.tags.length > 0) {
				console.log(`   ${chalk.gray("Tags:")} ${example.tags.map((tag) => chalk.blue(`#${tag}`)).join(" ")}`)
			}
			console.log()
		})

		// Interactive selection
		if (process.stdout.isTTY) {
			await this.promptForExampleSelection(category)
		}
	}

	async searchExamples(query: string): Promise<void> {
		const results = this.searchInExamples(query)

		if (results.length === 0) {
			console.log(chalk.yellow(`No examples found matching '${query}'`))
			return
		}

		console.log(chalk.blue.bold(`\n🔍 SEARCH RESULTS FOR '${query}'\n`))
		console.log(`Found ${results.length} example${results.length !== 1 ? "s" : ""}:\n`)

		results.forEach((result, index) => {
			const categoryName =
				this.categories.find((cat) => cat.examples.some((ex) => ex.id === result.id))?.name || "Unknown"

			const difficultyColor = this.getDifficultyColor(result.difficulty)

			console.log(`${index + 1}. ${chalk.cyan(result.title)} ${difficultyColor(`[${result.difficulty}]`)}`)
			console.log(`   ${chalk.gray("Category:")} ${categoryName}`)
			console.log(`   ${result.description}`)
			console.log(`   ${chalk.gray("Command:")} ${chalk.green(result.command)}`)
			console.log()
		})
	}

	async runExample(exampleId: string): Promise<void> {
		const example = this.findExampleById(exampleId)

		if (!example) {
			console.log(chalk.red(`❌ Example '${exampleId}' not found.`))
			return
		}

		await this.executeExample(example)
	}

	async showExample(exampleId: string): Promise<void> {
		const example = this.findExampleById(exampleId)

		if (!example) {
			console.log(chalk.red(`❌ Example '${exampleId}' not found.`))
			return
		}

		const categoryName =
			this.categories.find((cat) => cat.examples.some((ex) => ex.id === example.id))?.name || "Unknown"

		console.log(chalk.blue.bold(`\n📖 ${example.title}\n`))
		console.log(`${chalk.gray("Category:")} ${categoryName}`)
		console.log(`${chalk.gray("Difficulty:")} ${this.getDifficultyColor(example.difficulty)(example.difficulty)}`)
		if (example.estimatedTime) {
			console.log(`${chalk.gray("Estimated Time:")} ${example.estimatedTime}`)
		}
		console.log()
		console.log(`${chalk.gray("Description:")}\n${example.description}\n`)
		console.log(`${chalk.gray("Command:")}\n${chalk.green(example.command)}\n`)

		if (example.prerequisites && example.prerequisites.length > 0) {
			console.log(`${chalk.gray("Prerequisites:")}`)
			example.prerequisites.forEach((prereq) => {
				console.log(`  - ${prereq}`)
			})
			console.log()
		}

		if (example.expectedOutput) {
			console.log(`${chalk.gray("Expected Output:")}\n${example.expectedOutput}\n`)
		}

		if (example.tags && example.tags.length > 0) {
			console.log(`${chalk.gray("Tags:")} ${example.tags.map((tag) => chalk.blue(`#${tag}`)).join(" ")}\n`)
		}
	}

	async createCustomExample(): Promise<void> {
		console.log(chalk.blue.bold("\n✨ CREATE CUSTOM EXAMPLE\n"))

		const answers = await inquirer.prompt([
			{
				type: "input",
				name: "title",
				message: "Example title:",
				validate: (input: string) => input.trim().length > 0 || "Title is required",
			},
			{
				type: "input",
				name: "description",
				message: "Description:",
				validate: (input: string) => input.trim().length > 0 || "Description is required",
			},
			{
				type: "input",
				name: "command",
				message: "Command:",
				validate: (input: string) => input.trim().length > 0 || "Command is required",
			},
			{
				type: "list",
				name: "category",
				message: "Category:",
				choices: this.categories.map((cat) => ({ name: cat.name, value: cat.id })),
			},
			{
				type: "list",
				name: "difficulty",
				message: "Difficulty:",
				choices: ["beginner", "intermediate", "advanced"],
			},
			{
				type: "input",
				name: "tags",
				message: "Tags (comma-separated):",
				filter: (input: string) =>
					input
						? input
								.split(",")
								.map((tag) => tag.trim())
								.filter(Boolean)
						: [],
			},
		])

		const example: Example = {
			id: this.generateExampleId(answers.title),
			title: answers.title,
			description: answers.description,
			command: answers.command,
			category: answers.category,
			difficulty: answers.difficulty,
			tags: answers.tags,
		}

		console.log(chalk.green("\n✅ Custom example created!"))
		console.log(
			chalk.yellow(
				"Note: This example is not saved to disk. To persist it, add it to the appropriate examples file.",
			),
		)

		const shouldRun = await inquirer.prompt([
			{
				type: "confirm",
				name: "run",
				message: "Do you want to run this example now?",
				default: false,
			},
		])

		if (shouldRun.run) {
			await this.executeExample(example)
		}
	}

	private async promptForExampleSelection(category: ExampleCategory): Promise<void> {
		const choices = [
			...category.examples.map((ex, i) => ({
				name: `${ex.title} [${ex.difficulty}]`,
				value: i,
			})),
			{ name: "← Back to categories", value: -1 },
		]

		const choice = await inquirer.prompt([
			{
				type: "list",
				name: "example",
				message: "Select an example:",
				choices,
			},
		])

		if (choice.example >= 0) {
			await this.executeExample(category.examples[choice.example])
		}
	}

	private async executeExample(example: Example): Promise<void> {
		console.log(chalk.blue.bold(`\n🚀 Running: ${example.title}\n`))

		if (example.prerequisites && example.prerequisites.length > 0) {
			console.log(chalk.yellow("Prerequisites:"))
			example.prerequisites.forEach((prereq) => {
				console.log(`  - ${prereq}`)
			})
			console.log()
		}

		console.log(`${chalk.gray("Command:")} ${chalk.green(example.command)}\n`)

		if (example.expectedOutput) {
			console.log(`${chalk.gray("Expected Output:")}\n${example.expectedOutput}\n`)
		}

		const confirm = await inquirer.prompt([
			{
				type: "confirm",
				name: "proceed",
				message: "Do you want to execute this command?",
				default: false,
			},
		])

		if (confirm.proceed) {
			console.log(chalk.blue("\n📋 Executing command...\n"))
			// Here we would integrate with the CLI adapter to execute the command
			// For now, we'll just show the command that would be executed
			console.log(chalk.green(`Executing: ${example.command}`))
			console.log(chalk.yellow("\nNote: Command execution integration is not yet implemented."))
		} else {
			console.log(chalk.gray("\nCommand not executed. You can copy and run it manually."))
		}
	}

	private loadExamples(): void {
		if (!existsSync(this.examplesPath)) {
			// Debug: Examples directory not found (only log in verbose mode)
			return
		}

		const categoryDirs = readdirSync(this.examplesPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name)

		for (const categoryDir of categoryDirs) {
			const categoryPath = join(this.examplesPath, categoryDir)
			const category = this.loadCategoryExamples(categoryDir, categoryPath)

			if (category) {
				this.categories.push(category)
			}
		}
	}

	private loadCategoryExamples(categoryId: string, categoryPath: string): ExampleCategory | null {
		try {
			const files = readdirSync(categoryPath).filter((file) => file.endsWith(".md"))

			const examples: Example[] = []

			for (const file of files) {
				const filePath = join(categoryPath, file)
				const content = readFileSync(filePath, "utf-8")
				const fileExamples = this.parseExamplesFromMarkdown(content, categoryId)
				examples.push(...fileExamples)
			}

			return {
				id: categoryId,
				name: this.formatCategoryName(categoryId),
				description: this.getCategoryDescription(categoryId),
				examples,
			}
		} catch (error) {
			console.warn(`Failed to load examples from ${categoryPath}:`, error)
			return null
		}
	}

	private parseExamplesFromMarkdown(content: string, category: string): Example[] {
		// This is a simplified parser - in a real implementation,
		// you'd want a more robust markdown parser
		const examples: Example[] = []
		const lines = content.split("\n")

		// For now, return empty array - examples will be manually created
		// In a full implementation, this would parse markdown files for examples
		return examples
	}

	private searchInExamples(query: string): Example[] {
		const lowerQuery = query.toLowerCase()
		const results: Example[] = []

		for (const category of this.categories) {
			for (const example of category.examples) {
				if (
					example.title.toLowerCase().includes(lowerQuery) ||
					example.description.toLowerCase().includes(lowerQuery) ||
					example.command.toLowerCase().includes(lowerQuery) ||
					(example.tags && example.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
				) {
					results.push(example)
				}
			}
		}

		return results
	}

	private findExampleById(id: string): Example | null {
		for (const category of this.categories) {
			const example = category.examples.find((ex) => ex.id === id)
			if (example) return example
		}
		return null
	}

	private getCategoryIcon(categoryId: string): string {
		const icons: Record<string, string> = {
			basic: "🚀",
			workflows: "🔄",
			integration: "🔗",
			configuration: "⚙️",
			troubleshooting: "🔧",
			recipes: "📝",
		}
		return icons[categoryId] || "📚"
	}

	private getDifficultyColor(difficulty: string): (text: string) => string {
		switch (difficulty) {
			case "beginner":
				return chalk.green
			case "intermediate":
				return chalk.yellow
			case "advanced":
				return chalk.red
			default:
				return chalk.gray
		}
	}

	private formatCategoryName(categoryId: string): string {
		return categoryId.charAt(0).toUpperCase() + categoryId.slice(1).replace("-", " ")
	}

	private getCategoryDescription(categoryId: string): string {
		const descriptions: Record<string, string> = {
			basic: "Simple commands and fundamental concepts",
			workflows: "Multi-step development workflows and automation",
			integration: "Integration with popular tools and platforms",
			configuration: "Configuration examples and best practices",
			troubleshooting: "Common issues and debugging techniques",
			recipes: "Quick solutions and useful snippets",
		}
		return descriptions[categoryId] || "Examples for this category"
	}

	private generateExampleId(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, "")
			.replace(/\s+/g, "-")
			.substring(0, 50)
	}
}

export function registerExamplesCommands(program: Command): void {
	const examplesCmd = new ExamplesCommand()

	const examples = program.command("examples").description("Browse and run CLI usage examples")

	examples
		.command("list")
		.alias("ls")
		.description("List all example categories")
		.action(async () => {
			await examplesCmd.listCategories()
		})

	examples
		.command("show <category>")
		.description("Show examples for a specific category")
		.action(async (category: string) => {
			await examplesCmd.showCategory(category)
		})

	examples
		.command("search <query>")
		.description("Search examples by keyword")
		.action(async (query: string) => {
			await examplesCmd.searchExamples(query)
		})

	examples
		.command("run <exampleId>")
		.description("Run a specific example")
		.action(async (exampleId: string) => {
			await examplesCmd.runExample(exampleId)
		})

	examples
		.command("info <exampleId>")
		.description("Show detailed information about an example")
		.action(async (exampleId: string) => {
			await examplesCmd.showExample(exampleId)
		})

	examples
		.command("create")
		.description("Create a custom example interactively")
		.action(async () => {
			await examplesCmd.createCustomExample()
		})

	// Default action when just "roo examples" is called
	examples.action(async () => {
		await examplesCmd.listCategories()
	})
}
