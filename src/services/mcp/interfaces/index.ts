import type { IFileSystemService } from "./IFileSystemService"
import type { IUserInterfaceService } from "./IUserInterfaceService"
import type { IStateService } from "./IStateService"
import type { IFileWatcherService, IDisposable } from "./IFileWatcherService"
import type { IMcpNotificationService } from "./IMcpNotificationService"

export type { IFileSystemService } from "./IFileSystemService"
export type { IUserInterfaceService } from "./IUserInterfaceService"
export type { IStateService } from "./IStateService"
export type { IFileWatcherService, IDisposable } from "./IFileWatcherService"
export type { IMcpNotificationService } from "./IMcpNotificationService"

/**
 * Platform services bundle for MCP operations
 */
export interface IPlatformServices {
	fileSystem: IFileSystemService
	userInterface: IUserInterfaceService
	state: IStateService
	fileWatcher: IFileWatcherService
	notifications: IMcpNotificationService
}
