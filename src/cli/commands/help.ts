import { HelpCommand } from "./HelpCommand"

const helpCommand = new HelpCommand()

export function showHelp(topic?: string, subtopic?: string): void {
	if (!topic) {
		helpCommand.showGeneralHelp()
		return
	}

	const normalizedTopic = topic.toLowerCase()

	switch (normalizedTopic) {
		case "config":
		case "configuration":
			helpCommand.showConfigHelp()
			break

		case "tools":
		case "tool":
			helpCommand.showToolHelp(subtopic || "list")
			break

		case "search":
			if (subtopic) {
				helpCommand.searchHelp(subtopic)
			} else {
				console.log("Usage: roo-cli help search <query>")
				console.log("Example: roo-cli help search browser")
			}
			break

		default:
			// Try to show command help
			helpCommand.showCommandHelp(normalizedTopic)
			break
	}
}

// Export the HelpCommand instance for use in interactive mode
export { helpCommand }

// Legacy function for backwards compatibility
export function showLegacyHelp(): void {
	helpCommand.showGeneralHelp()
}
