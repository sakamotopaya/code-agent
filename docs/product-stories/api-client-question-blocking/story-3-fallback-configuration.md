# Story 3: Fallback Configuration

## User Story

**As a system administrator**, I want to configure the fallback behavior for failed questions so I can control how the system handles question failures.

## Background

Currently, when questions fail (due to timeouts, network issues, or other problems), the system automatically falls back to default answers without clear indication. This can lead to unexpected behavior and makes it difficult to identify and fix underlying issues.

## Acceptance Criteria

### Configurable Fallback Behavior

- [ ] Option to enable/disable automatic fallbacks globally
- [ ] Configurable timeout before fallback occurs
- [ ] Option to fail fast instead of using defaults
- [ ] Per-question fallback configuration support
- [ ] Environment variable and config file support

### Fallback Transparency

- [ ] Clear warnings when fallbacks are triggered
- [ ] Detailed logging of fallback reasons
- [ ] Metrics tracking fallback frequency
- [ ] User notification when defaults are used
- [ ] Audit trail of fallback decisions

### Graceful Degradation

- [ ] Configurable fallback strategies (default choice, first choice, custom value)
- [ ] Timeout warnings before fallback occurs
- [ ] Option to prompt user before falling back
- [ ] Escalation paths for critical questions

### Administrative Controls

- [ ] Runtime configuration updates without restart
- [ ] Per-job fallback configuration
- [ ] Question type-specific fallback rules
- [ ] Emergency fallback disable switch

## Technical Requirements

### Configuration Interface

```typescript
interface QuestionFallbackConfig {
	// Global fallback settings
	enableFallback: boolean
	fallbackTimeout: number
	fallbackStrategy: "default" | "first" | "custom" | "fail"
	customFallbackValue?: string

	// Warning and notification settings
	enableTimeoutWarnings: boolean
	warningThreshold: number // Percentage of timeout before warning
	notifyUserOnFallback: boolean

	// Per-question type overrides
	questionTypeOverrides: Record<string, Partial<QuestionFallbackConfig>>

	// Emergency controls
	emergencyDisable: boolean
	maxFallbacksPerJob: number
}
```

### Enhanced SSE Output Adapter

```typescript
class SSEOutputAdapter implements IUserInterface {
	private fallbackConfig: QuestionFallbackConfig
	private fallbackStats: Map<string, number> = new Map()

	constructor(
		streamManager: StreamManager,
		jobId: string,
		verbose: boolean = false,
		questionManager?: ApiQuestionManager,
		fallbackConfig?: QuestionFallbackConfig,
	) {
		// ... existing constructor ...
		this.fallbackConfig = fallbackConfig || this.getDefaultFallbackConfig()
	}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		const startTime = Date.now()
		const questionType = this.determineQuestionType(question, options)
		const config = this.getEffectiveConfig(questionType)

		this.logger.info(`Starting question with fallback config`, {
			questionType,
			enableFallback: config.enableFallback,
			fallbackTimeout: config.fallbackTimeout,
			fallbackStrategy: config.fallbackStrategy,
		})

		try {
			const suggestions = options.choices.map((choice) => ({ answer: choice }))
			const { questionId, promise } = await this.questionManager.createQuestion(
				this.jobId,
				question,
				suggestions,
				config.fallbackTimeout,
			)

			// Emit question event
			const event: SSEEvent = {
				type: SSE_EVENTS.QUESTION_ASK,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: question,
				questionId,
				choices: options.choices,
				suggestions,
				fallbackConfig: {
					enableFallback: config.enableFallback,
					timeout: config.fallbackTimeout,
					strategy: config.fallbackStrategy,
				},
			}

			this.emitEvent(event)

			// Set up timeout warning if enabled
			if (config.enableTimeoutWarnings && config.fallbackTimeout > 0) {
				const warningTime = config.fallbackTimeout * (config.warningThreshold / 100)
				setTimeout(() => {
					this.emitTimeoutWarning(questionId, config.fallbackTimeout - warningTime)
				}, warningTime)
			}

			// Wait for answer with configured timeout
			const answer = await this.waitForAnswerWithTimeout(promise, config)

			const duration = Date.now() - startTime
			this.logger.info(`Question answered successfully`, {
				questionId,
				duration,
				answer: answer.substring(0, 50),
			})

			return answer
		} catch (error) {
			return await this.handleQuestionFailure(error, options, config, startTime)
		}
	}

	private async waitForAnswerWithTimeout(promise: Promise<string>, config: QuestionFallbackConfig): Promise<string> {
		if (!config.enableFallback || config.fallbackTimeout <= 0) {
			// No timeout, wait indefinitely
			return await promise
		}

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Question timed out after ${config.fallbackTimeout}ms`))
			}, config.fallbackTimeout)

			promise
				.then((answer) => {
					clearTimeout(timeoutId)
					resolve(answer)
				})
				.catch((error) => {
					clearTimeout(timeoutId)
					reject(error)
				})
		})
	}

	private async handleQuestionFailure(
		error: Error,
		options: QuestionOptions,
		config: QuestionFallbackConfig,
		startTime: number,
	): Promise<string | undefined> {
		const duration = Date.now() - startTime
		const fallbackCount = this.fallbackStats.get(this.jobId) || 0

		this.logger.error(`Question failed`, {
			error: error.message,
			duration,
			fallbackCount,
			enableFallback: config.enableFallback,
			maxFallbacks: config.maxFallbacksPerJob,
		})

		// Check if fallback is disabled or emergency disable is active
		if (!config.enableFallback || config.emergencyDisable) {
			this.logger.info(`Fallback disabled, re-throwing error`)
			throw error
		}

		// Check fallback limits
		if (config.maxFallbacksPerJob > 0 && fallbackCount >= config.maxFallbacksPerJob) {
			this.logger.warn(`Maximum fallbacks exceeded for job ${this.jobId}`)
			throw new Error(`Maximum fallbacks (${config.maxFallbacksPerJob}) exceeded for this job`)
		}

		// Determine fallback value
		const fallbackValue = this.determineFallbackValue(options, config)

		// Update fallback statistics
		this.fallbackStats.set(this.jobId, fallbackCount + 1)

		// Emit fallback notification
		await this.emitFallbackNotification(error, fallbackValue, config)

		this.logger.warn(`Using fallback value`, {
			fallbackValue,
			strategy: config.fallbackStrategy,
			reason: error.message,
		})

		return fallbackValue
	}

	private determineFallbackValue(options: QuestionOptions, config: QuestionFallbackConfig): string {
		switch (config.fallbackStrategy) {
			case "default":
				return options.defaultChoice || options.choices[0] || ""
			case "first":
				return options.choices[0] || ""
			case "custom":
				return config.customFallbackValue || options.choices[0] || ""
			case "fail":
				throw new Error("Fallback strategy is set to fail")
			default:
				return options.defaultChoice || options.choices[0] || ""
		}
	}

	private async emitTimeoutWarning(questionId: string, remainingTime: number): Promise<void> {
		const warningEvent: SSEEvent = {
			type: SSE_EVENTS.WARNING,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: `Question will timeout in ${Math.round(remainingTime / 1000)} seconds`,
			questionId,
		}

		this.emitEvent(warningEvent)
	}

	private async emitFallbackNotification(
		error: Error,
		fallbackValue: string,
		config: QuestionFallbackConfig,
	): Promise<void> {
		if (!config.notifyUserOnFallback) {
			return
		}

		const notificationEvent: SSEEvent = {
			type: SSE_EVENTS.WARNING,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: `Question failed (${error.message}), using fallback answer: "${fallbackValue}"`,
			fallbackInfo: {
				reason: error.message,
				strategy: config.fallbackStrategy,
				value: fallbackValue,
			},
		}

		this.emitEvent(notificationEvent)
	}

	private getDefaultFallbackConfig(): QuestionFallbackConfig {
		return {
			enableFallback: process.env.ENABLE_QUESTION_FALLBACK !== "false",
			fallbackTimeout: parseInt(process.env.QUESTION_FALLBACK_TIMEOUT || "30000"),
			fallbackStrategy: (process.env.QUESTION_FALLBACK_STRATEGY as any) || "default",
			customFallbackValue: process.env.QUESTION_CUSTOM_FALLBACK,
			enableTimeoutWarnings: process.env.ENABLE_QUESTION_TIMEOUT_WARNINGS !== "false",
			warningThreshold: parseInt(process.env.QUESTION_WARNING_THRESHOLD || "80"),
			notifyUserOnFallback: process.env.NOTIFY_USER_ON_FALLBACK !== "false",
			questionTypeOverrides: {},
			emergencyDisable: process.env.EMERGENCY_DISABLE_FALLBACK === "true",
			maxFallbacksPerJob: parseInt(process.env.MAX_FALLBACKS_PER_JOB || "5"),
		}
	}
}
```

### Configuration Management

```typescript
class QuestionConfigManager {
	private config: QuestionFallbackConfig
	private configFile: string

	constructor(configPath?: string) {
		this.configFile = configPath || path.join(getStoragePath(), "question-config.json")
		this.loadConfig()
	}

	async updateConfig(updates: Partial<QuestionFallbackConfig>): Promise<void> {
		this.config = { ...this.config, ...updates }
		await this.saveConfig()
		this.emit("configUpdated", this.config)
	}

	async emergencyDisable(): Promise<void> {
		await this.updateConfig({ emergencyDisable: true })
		console.log("🚨 Emergency fallback disable activated")
	}

	async emergencyEnable(): Promise<void> {
		await this.updateConfig({ emergencyDisable: false })
		console.log("✅ Emergency fallback disable deactivated")
	}

	getConfig(): QuestionFallbackConfig {
		return { ...this.config }
	}

	private async loadConfig(): Promise<void> {
		try {
			const data = await fs.readFile(this.configFile, "utf8")
			const fileConfig = JSON.parse(data)
			this.config = { ...this.getDefaultConfig(), ...fileConfig }
		} catch (error) {
			this.config = this.getDefaultConfig()
		}
	}

	private async saveConfig(): Promise<void> {
		await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2))
	}
}
```

## Configuration Options

### Environment Variables

```bash
# Global fallback settings
ENABLE_QUESTION_FALLBACK=true
QUESTION_FALLBACK_TIMEOUT=30000
QUESTION_FALLBACK_STRATEGY=default
QUESTION_CUSTOM_FALLBACK="I don't know"

# Warning and notification settings
ENABLE_QUESTION_TIMEOUT_WARNINGS=true
QUESTION_WARNING_THRESHOLD=80
NOTIFY_USER_ON_FALLBACK=true

# Emergency controls
EMERGENCY_DISABLE_FALLBACK=false
MAX_FALLBACKS_PER_JOB=5
```

### Configuration File

```json
{
	"enableFallback": true,
	"fallbackTimeout": 30000,
	"fallbackStrategy": "default",
	"customFallbackValue": "I need more time to think",
	"enableTimeoutWarnings": true,
	"warningThreshold": 80,
	"notifyUserOnFallback": true,
	"questionTypeOverrides": {
		"confirmation": {
			"fallbackStrategy": "first",
			"fallbackTimeout": 15000
		},
		"input": {
			"fallbackStrategy": "custom",
			"customFallbackValue": ""
		}
	},
	"emergencyDisable": false,
	"maxFallbacksPerJob": 5
}
```

### API Endpoints

```typescript
// Runtime configuration updates
POST /api/config/questions/fallback
{
  "enableFallback": false,
  "fallbackTimeout": 60000
}

// Emergency controls
POST /api/config/questions/emergency-disable
POST /api/config/questions/emergency-enable

// Get current configuration
GET /api/config/questions/fallback

// Get fallback statistics
GET /api/stats/questions/fallbacks
```

## Testing Requirements

### Unit Tests

- [ ] Test configuration loading and validation
- [ ] Test fallback strategy implementations
- [ ] Test timeout warning logic
- [ ] Test emergency disable functionality
- [ ] Test configuration override logic

### Integration Tests

- [ ] Test runtime configuration updates
- [ ] Test fallback behavior with different strategies
- [ ] Test timeout warnings and notifications
- [ ] Test emergency disable during active questions
- [ ] Test configuration persistence across restarts

### Load Tests

- [ ] Test fallback performance under high load
- [ ] Test configuration update performance
- [ ] Test memory usage with many fallback events
- [ ] Test concurrent question fallback handling

## Definition of Done

- [ ] All fallback strategies implemented and tested
- [ ] Configuration system supports runtime updates
- [ ] Emergency controls work reliably
- [ ] Timeout warnings are accurate and helpful
- [ ] Fallback notifications are clear and informative
- [ ] Performance impact is minimal
- [ ] Documentation covers all configuration options
- [ ] Tests pass with >90% coverage

## Dependencies

- Enhanced logging system (Story 1)
- Configuration management framework
- Metrics and monitoring system

## Estimated Effort

**2 days** (1.5 days implementation, 0.5 days testing and documentation)

## Priority

**Medium** - Important for operational control but not blocking core functionality

## Risks & Mitigations

**Risk**: Configuration changes affecting active questions
**Mitigation**: Careful state management and gradual rollout of changes

**Risk**: Emergency disable causing system failures
**Mitigation**: Comprehensive testing and clear documentation of impacts

**Risk**: Complex configuration leading to user confusion
**Mitigation**: Good defaults, clear documentation, and validation
