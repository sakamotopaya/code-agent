import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { McpDebugLogger } from "../../../shared/mcp/McpDebugLogger"

export async function getMcpServersSection(
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	enableMcpServerCreation?: boolean,
): Promise<string> {
	McpDebugLogger.section("getMcpServersSection", "Called with mcpHub:", mcpHub ? "present" : "null")

	if (!mcpHub) {
		McpDebugLogger.section("getMcpServersSection", "No mcpHub provided, returning empty string")
		return ""
	}

	const allServers = mcpHub.getServers()
	McpDebugLogger.section("getMcpServersSection", "Total servers:", allServers.length)
	McpDebugLogger.section(
		"getMcpServersSection",
		"All servers:",
		allServers.map((s: any) => ({ name: s.name, status: s.status, toolCount: s.tools?.length || 0 })),
	)

	const connectedServers =
		allServers.length > 0
			? `${allServers
					.filter((server) => server.status === "connected")
					.map((server) => {
						McpDebugLogger.section(
							"getMcpServersSection",
							"Processing server:",
							server.name,
							"tools:",
							server.tools?.length || 0,
						)
						const tools = server.tools
							?.map((tool) => {
								const schemaStr = tool.inputSchema
									? `    Input Schema:
		${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
									: ""

								return `- ${tool.name}: ${tool.description}\n${schemaStr}`
							})
							.join("\n\n")

						const templates = server.resourceTemplates
							?.map((template) => `- ${template.uriTemplate} (${template.name}): ${template.description}`)
							.join("\n")

						const resources = server.resources
							?.map((resource) => `- ${resource.uri} (${resource.name}): ${resource.description}`)
							.join("\n")

						const config = JSON.parse(server.config)

						return (
							`## ${server.name} (\`${config.command}${config.args && Array.isArray(config.args) ? ` ${config.args.join(" ")}` : ""}\`)` +
							(tools ? `\n\n### Available Tools\n${tools}` : "") +
							(templates ? `\n\n### Resource Templates\n${templates}` : "") +
							(resources ? `\n\n### Direct Resources\n${resources}` : "")
						)
					})
					.join("\n\n")}`
			: "(No MCP servers currently connected)"

	const baseSection = `MCP SERVERS

The Model Context Protocol (MCP) enables communication between the system and MCP servers that provide additional tools and resources to extend your capabilities. MCP servers can be one of two types:

1. Local (Stdio-based) servers: These run locally on the user's machine and communicate via standard input/output
2. Remote (SSE-based) servers: These run on remote machines and communicate via Server-Sent Events (SSE) over HTTP/HTTPS

# Connected MCP Servers

When a server is connected, you can use the server's tools via the \`use_mcp_tool\` tool, and access the server's resources via the \`access_mcp_resource\` tool.

${connectedServers}`

	McpDebugLogger.section("getMcpServersSection", "Base section length:", baseSection.length)
	McpDebugLogger.section(
		"getMcpServersSection",
		"Connected servers content:",
		connectedServers.substring(0, 500) + (connectedServers.length > 500 ? "..." : ""),
	)

	if (!enableMcpServerCreation) {
		McpDebugLogger.section("getMcpServersSection", "Returning base section (no server creation)")
		return baseSection
	}

	const finalSection =
		baseSection +
		`
## Creating an MCP Server

The user may ask you something along the lines of "add a tool" that does some function, in other words to create an MCP server that provides tools and resources that may connect to external APIs for example. If they do, you should obtain detailed instructions on this topic using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>`

	McpDebugLogger.section("getMcpServersSection", "Returning final section, length:", finalSection.length)
	return finalSection
}
