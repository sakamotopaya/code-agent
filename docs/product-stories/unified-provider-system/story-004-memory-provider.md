# Story 004: Memory Provider Implementation

## Overview

Implement an in-memory provider for API usage that provides stateless operation by default with optional persistence capabilities for session management.

## Acceptance Criteria

### Core Functionality

- [ ] Implements `IProvider` interface completely
- [ ] Provides in-memory state management
- [ ] Supports stateless operation (default)
- [ ] Offers optional persistence to file/database
- [ ] Handles session-based state isolation

### API Integration

- [ ] Integrates seamlessly with API server
- [ ] Supports per-request state isolation
- [ ] Provides session management capabilities
- [ ] Handles concurrent request state safely
- [ ] Maintains performance for high-throughput scenarios

### Persistence Options

- [ ] Optional file-based persistence
- [ ] Optional database persistence (Redis/PostgreSQL)
- [ ] Configurable persistence strategies
- [ ] Session expiration and cleanup
- [ ] State serialization/deserialization

## Technical Requirements

### Core Implementation

```typescript
class MemoryProvider extends BaseProvider implements IProvider {
	private state: ProviderState
	private sessionStates: Map<string, ProviderState>
	private persistenceAdapter?: IPersistenceAdapter
	private sessionTimeout: number
	private cleanupInterval: NodeJS.Timeout

	constructor(options: MemoryProviderOptions = {}) {
		super(ProviderType.Memory)
		this.state = this.createDefaultState()
		this.sessionStates = new Map()
		this.sessionTimeout = options.sessionTimeout || 3600000 // 1 hour
		this.persistenceAdapter = options.persistenceAdapter
	}

	async initialize(): Promise<void> {
		if (this.persistenceAdapter) {
			await this.persistenceAdapter.initialize()
			await this.loadPersistedState()
		}
		this.startCleanupTimer()
	}

	async getState(sessionId?: string): Promise<ProviderState> {
		if (sessionId && this.sessionStates.has(sessionId)) {
			return { ...this.sessionStates.get(sessionId)! }
		}
		return { ...this.state }
	}

	async updateState(key: keyof ProviderState, value: any, sessionId?: string): Promise<void> {
		const targetState = sessionId ? this.getOrCreateSessionState(sessionId) : this.state
		targetState[key] = value
		targetState.lastUsed = new Date()

		if (this.persistenceAdapter && sessionId) {
			await this.persistenceAdapter.saveSessionState(sessionId, targetState)
		}

		this.emit("stateChanged", key, value, sessionId)
	}

	// ... other interface methods
}
```

### Session Management

```typescript
interface SessionManager {
	createSession(): string
	getSession(sessionId: string): ProviderState | undefined
	updateSession(sessionId: string, state: Partial<ProviderState>): Promise<void>
	deleteSession(sessionId: string): Promise<void>
	cleanupExpiredSessions(): Promise<void>
	listActiveSessions(): string[]
}

class MemorySessionManager implements SessionManager {
	private sessions: Map<string, SessionData>
	private sessionTimeout: number

	createSession(): string {
		const sessionId = this.generateSessionId()
		const sessionData: SessionData = {
			id: sessionId,
			state: this.createDefaultState(),
			createdAt: new Date(),
			lastAccessed: new Date(),
			expiresAt: new Date(Date.now() + this.sessionTimeout),
		}
		this.sessions.set(sessionId, sessionData)
		return sessionId
	}

	// ... other methods
}
```

### Persistence Adapters

```typescript
interface IPersistenceAdapter {
	initialize(): Promise<void>
	saveState(state: ProviderState): Promise<void>
	loadState(): Promise<ProviderState | null>
	saveSessionState(sessionId: string, state: ProviderState): Promise<void>
	loadSessionState(sessionId: string): Promise<ProviderState | null>
	deleteSessionState(sessionId: string): Promise<void>
	cleanup(): Promise<void>
}

class FilePersistenceAdapter implements IPersistenceAdapter {
	private basePath: string

	constructor(basePath: string) {
		this.basePath = basePath
	}

	async saveSessionState(sessionId: string, state: ProviderState): Promise<void> {
		const sessionPath = path.join(this.basePath, "sessions", `${sessionId}.json`)
		await this.ensureDirectory(path.dirname(sessionPath))
		await this.writeJsonFileAtomic(sessionPath, {
			sessionId,
			state,
			savedAt: new Date(),
		})
	}

	// ... other methods
}

class RedisPersistenceAdapter implements IPersistenceAdapter {
	private redis: Redis
	private keyPrefix: string

	constructor(redisConfig: RedisConfig) {
		this.redis = new Redis(redisConfig)
		this.keyPrefix = redisConfig.keyPrefix || "agentz:"
	}

	async saveSessionState(sessionId: string, state: ProviderState): Promise<void> {
		const key = `${this.keyPrefix}session:${sessionId}`
		await this.redis.setex(key, this.sessionTimeout / 1000, JSON.stringify(state))
	}

	// ... other methods
}
```

### Configuration Options

```typescript
interface MemoryProviderOptions {
	// Session management
	sessionTimeout?: number // Session expiration time in ms
	maxSessions?: number // Maximum concurrent sessions
	cleanupInterval?: number // Cleanup timer interval in ms

	// Persistence
	persistenceAdapter?: IPersistenceAdapter
	persistenceStrategy?: "none" | "file" | "redis" | "database"
	persistencePath?: string // For file-based persistence

	// Performance
	enableSessionIsolation?: boolean // Enable per-session state isolation
	enableStatePersistence?: boolean // Enable state persistence
	enableSessionCleanup?: boolean // Enable automatic session cleanup

	// Default state
	defaultState?: Partial<ProviderState>
}
```

## Implementation Details

### State Isolation Strategies

#### 1. Stateless Mode (Default)

```typescript
// Each request gets a fresh default state
async getState(): Promise<ProviderState> {
    return this.createDefaultState()
}
```

#### 2. Session-Based Mode

```typescript
// State is isolated per session ID
async getState(sessionId: string): Promise<ProviderState> {
    return this.getOrCreateSessionState(sessionId)
}
```

#### 3. Global State Mode

```typescript
// All requests share the same state
async getState(): Promise<ProviderState> {
    return { ...this.state }
}
```

### Performance Optimizations

- **Memory Pooling**: Reuse state objects to reduce GC pressure
- **Lazy Loading**: Load session state only when needed
- **Batch Operations**: Group multiple state updates
- **Compression**: Compress large state objects in persistence
- **Caching**: Cache frequently accessed session states

### Session Cleanup

```typescript
private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
        await this.cleanupExpiredSessions()
    }, this.cleanupIntervalMs)
}

private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date()
    const expiredSessions: string[] = []

    for (const [sessionId, sessionData] of this.sessionStates) {
        if (sessionData.expiresAt < now) {
            expiredSessions.push(sessionId)
        }
    }

    for (const sessionId of expiredSessions) {
        await this.deleteSession(sessionId)
    }

    if (expiredSessions.length > 0) {
        this.emit('sessionsCleanedUp', expiredSessions)
    }
}
```

### API Integration

```typescript
// API middleware for session management
export function sessionMiddleware(provider: MemoryProvider) {
	return async (req: Request, res: Response, next: NextFunction) => {
		// Extract or create session ID
		let sessionId = req.headers["x-session-id"] as string
		if (!sessionId && req.body.sessionId) {
			sessionId = req.body.sessionId
		}

		if (!sessionId) {
			sessionId = provider.createSession()
			res.setHeader("x-session-id", sessionId)
		}

		// Attach session to request
		req.sessionId = sessionId
		req.providerState = await provider.getState(sessionId)

		next()
	}
}
```

## Testing Requirements

### Unit Tests

- [ ] State isolation between sessions
- [ ] Session creation and management
- [ ] State persistence and retrieval
- [ ] Session expiration and cleanup
- [ ] Persistence adapter functionality

### Integration Tests

- [ ] API integration with session management
- [ ] Concurrent request handling
- [ ] Persistence adapter switching
- [ ] Memory usage under load
- [ ] Session cleanup effectiveness

### Performance Tests

- [ ] High-throughput request handling
- [ ] Memory usage with many sessions
- [ ] Persistence adapter performance
- [ ] Session cleanup performance
- [ ] State serialization overhead

### Load Tests

- [ ] 1000+ concurrent sessions
- [ ] Rapid session creation/deletion
- [ ] Large state object handling
- [ ] Persistence under load
- [ ] Memory leak detection

## Error Handling

### Session Errors

- **Invalid Session ID**: Create new session or return error
- **Expired Session**: Clean up and create new session
- **Session Limit Exceeded**: Implement LRU eviction
- **Persistence Failure**: Fall back to in-memory only

### Memory Management

- **Out of Memory**: Implement emergency cleanup
- **Large State Objects**: Implement size limits
- **Memory Leaks**: Automatic leak detection
- **GC Pressure**: Optimize object reuse

## Configuration Examples

### Stateless API (Default)

```typescript
const provider = new MemoryProvider({
	enableSessionIsolation: false,
	enableStatePersistence: false,
})
```

### Session-Based API with File Persistence

```typescript
const provider = new MemoryProvider({
	enableSessionIsolation: true,
	enableStatePersistence: true,
	sessionTimeout: 3600000, // 1 hour
	persistenceAdapter: new FilePersistenceAdapter("/tmp/agentz-sessions"),
})
```

### High-Performance API with Redis

```typescript
const provider = new MemoryProvider({
	enableSessionIsolation: true,
	enableStatePersistence: true,
	sessionTimeout: 1800000, // 30 minutes
	maxSessions: 10000,
	persistenceAdapter: new RedisPersistenceAdapter({
		host: "localhost",
		port: 6379,
		keyPrefix: "agentz:api:",
	}),
})
```

## Dependencies

- Story 001: Provider Interface Definition (must be complete)
- Optional: Redis client library
- Optional: Database client library
- JSON serialization/deserialization
- Session ID generation utility

## Definition of Done

- [ ] MemoryProvider implements IProvider interface completely
- [ ] Session management works correctly
- [ ] Persistence adapters function properly
- [ ] Performance meets requirements under load
- [ ] All unit and integration tests pass
- [ ] Load tests demonstrate scalability
- [ ] Memory usage is optimized
- [ ] API integration is seamless
- [ ] Documentation includes configuration examples
- [ ] Code review approved by API team
