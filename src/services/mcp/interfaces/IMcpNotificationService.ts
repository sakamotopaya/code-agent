/**
 * Platform abstraction for MCP-related notifications
 */
export interface IMcpNotificationService {
	/**
	 * Notify about MCP server changes (connections, status, etc.)
	 */
	notifyServerChanges(): Promise<void>

	/**
	 * Notify about tool updates (permissions, etc.)
	 */
	notifyToolUpdate(toolName: string): Promise<void>

	/**
	 * Notify about resource updates
	 */
	notifyResourceUpdate?(resourceUri: string): Promise<void>

	/**
	 * Notify about configuration changes
	 */
	notifyConfigurationChange?(): Promise<void>
}
