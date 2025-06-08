#!/usr/bin/env node

const { Client } = require("@modelcontextprotocol/sdk/client/index.js")
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js")
const { ReadResourceResultSchema } = require("@modelcontextprotocol/sdk/types.js")
const fs = require("fs").promises
const path = require("path")

async function testGitHubMcpServer() {
	console.log("Starting GitHub MCP server test...")

	try {
		// Create MCP client
		const client = new Client(
			{
				name: "GitHub MCP Test",
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		)

		// Set up transport for GitHub MCP server
		// Note: This assumes you have the GitHub MCP server installed
		// You can install it with: npm install -g @modelcontextprotocol/server-github
		const transport = new StdioClientTransport({
			command: "npx",
			args: ["@modelcontextprotocol/server-github"],
			env: {
				...process.env,
				// Add GitHub token if needed
				// GITHUB_TOKEN: process.env.GITHUB_TOKEN
			},
		})

		// Set up error handling
		transport.onerror = (error) => {
			console.error("Transport error:", error)
		}

		transport.onclose = () => {
			console.log("Transport closed")
		}

		// Connect to the server
		console.log("Connecting to GitHub MCP server...")
		await client.connect(transport)
		console.log("Connected successfully!")

		// List available resources first
		console.log("Listing available resources...")
		try {
			const resourcesResponse = await client.request({
				method: "resources/list",
			})
			console.log("Available resources:", JSON.stringify(resourcesResponse, null, 2))
		} catch (error) {
			console.log("Could not list resources:", error.message)
		}

		// Try to read the Microsoft VSCode repository resource
		const resourceUri = "github://repos/microsoft/vscode"
		console.log(`Attempting to read resource: ${resourceUri}`)

		const resourceResponse = await client.request(
			{
				method: "resources/read",
				params: {
					uri: resourceUri,
				},
			},
			ReadResourceResultSchema,
		)

		console.log("Resource read successfully!")
		console.log("Response structure:", {
			meta: resourceResponse._meta,
			contentsCount: resourceResponse.contents?.length,
			firstContentType: resourceResponse.contents?.[0]?.mimeType,
		})

		// Save the response to file
		const outputPath = path.join(__dirname, "repository-info.json")
		await fs.writeFile(outputPath, JSON.stringify(resourceResponse, null, 2))
		console.log(`Repository information saved to: ${outputPath}`)

		// Close the connection
		await client.close()
		console.log("Connection closed successfully")

		return resourceResponse
	} catch (error) {
		console.error("Error accessing GitHub MCP server:", error)

		// Try to save error information
		const errorInfo = {
			error: error.message,
			stack: error.stack,
			timestamp: new Date().toISOString(),
		}

		try {
			const errorPath = path.join(__dirname, "repository-info.json")
			await fs.writeFile(errorPath, JSON.stringify(errorInfo, null, 2))
			console.log(`Error information saved to: ${errorPath}`)
		} catch (writeError) {
			console.error("Could not save error information:", writeError)
		}

		throw error
	}
}

// Run the test
if (require.main === module) {
	testGitHubMcpServer()
		.then(() => {
			console.log("Test completed successfully")
			process.exit(0)
		})
		.catch((error) => {
			console.error("Test failed:", error)
			process.exit(1)
		})
}

module.exports = { testGitHubMcpServer }
