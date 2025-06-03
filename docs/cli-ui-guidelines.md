# CLI UI Guidelines

This document provides guidelines for using the CLI UI elements consistently across the Roo CLI application.

## Table of Contents

- [Color Scheme](#color-scheme)
- [Progress Indicators](#progress-indicators)
- [Messages and Notifications](#messages-and-notifications)
- [Tables and Data Display](#tables-and-data-display)
- [Interactive Prompts](#interactive-prompts)
- [Best Practices](#best-practices)

## Color Scheme

The CLI uses a consistent color scheme to provide visual hierarchy and improve user experience.

### Default Colors

| Type | Color | Usage |
|------|-------|-------|
| Success | Green | Successful operations, completed tasks |
| Warning | Yellow | Warnings, non-critical issues |
| Error | Red | Errors, failures, critical issues |
| Info | Blue | Information messages, help text |
| Highlight | Cyan | Important values, emphasized text |
| Muted | Gray | Secondary information, timestamps |
| Primary | White | Default text color |

### Color Configuration

Colors can be configured programmatically:

```typescript
import { CLIUIService } from './services/CLIUIService'

const customColorScheme = {
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  highlight: 'cyan',
  muted: 'gray',
  primary: 'white'
}

const ui = new CLIUIService(true, customColorScheme)
```

### Accessibility

- Colors are automatically disabled in environments that don't support them
- All information is also conveyed through symbols (✓, ✗, ⚠, ℹ)
- Text remains readable when colors are disabled

## Progress Indicators

### Spinners

Use spinners for indeterminate progress:

```typescript
const spinner = ui.showSpinner('Processing files...')
spinner.start()

// Update text as needed
spinner.text = 'Analyzing dependencies...'

// Complete with appropriate status
spinner.succeed('Processing completed')
spinner.fail('Processing failed')
spinner.warn('Processing completed with warnings')
spinner.info('Processing stopped')
```

### Progress Bars

Use progress bars for determinate progress:

```typescript
const progressBar = ui.showProgressBar(100, 'Downloading...')

// Update progress
progressBar.update(50) // Set to 50%
progressBar.increment(10) // Add 10%

// Complete
progressBar.stop()
```

### Guidelines

- Use spinners for unknown duration tasks
- Use progress bars when you can track completion percentage
- Always provide meaningful messages
- Update progress text to reflect current operation
- Complete with appropriate status (succeed/fail/warn/info)

## Messages and Notifications

### Message Types

```typescript
// Success messages
ui.success('Configuration saved successfully')

// Warning messages  
ui.warning('API rate limit approaching')

// Error messages
ui.error('Failed to connect to database')

// Info messages
ui.info('Loading configuration from ~/.roo/config.json')
```

### Formatted Messages

For important messages, use boxes:

```typescript
// Success box
ui.showSuccessBox('Operation completed successfully', 'Success')

// Error box
ui.showErrorBox('Critical system error detected', 'Error')

// Warning box
ui.showWarningBox('This action cannot be undone', 'Warning')

// Info box
ui.showInfoBox('For more help, visit https://docs.roo.dev', 'Help')
```

### Guidelines

- Use appropriate message types for context
- Keep messages concise but informative
- Use boxes for critical or important information
- Include actionable information when possible

## Tables and Data Display

### Simple Tables

For simple data display:

```typescript
const data = [
  { name: 'John', age: 30, role: 'Developer' },
  { name: 'Jane', age: 25, role: 'Designer' }
]

ui.showTable(data)
```

### Key-Value Tables

For configuration or details:

```typescript
const config = {
  'API Endpoint': 'https://api.example.com',
  'Version': '1.0.0',
  'Environment': 'production'
}

ui.showKeyValueTable(config, 'Configuration')
```

### Columnar Tables

For structured data with custom formatting:

```typescript
const columns = [
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Status', key: 'status', width: 10, alignment: 'center' },
  { header: 'Score', key: 'score', width: 10, alignment: 'right' }
]

ui.showColumnarTable(data, columns, 'Results')
```

### Comparison Tables

For before/after comparisons:

```typescript
const before = { users: 100, errors: 5 }
const after = { users: 120, errors: 2 }

ui.showComparisonTable(before, after, 'Performance Comparison')
```

### Guidelines

- Use appropriate table type for your data
- Include meaningful headers
- Align numeric data to the right
- Use titles for context
- Keep column widths reasonable

## Interactive Prompts

### Text Input

```typescript
const name = await ui.promptText('Enter your name:', 'John Doe')
```

### Password Input

```typescript
const password = await ui.promptPassword('Enter password:')
```

### Confirmation

```typescript
const confirmed = await ui.promptConfirm('Are you sure?', false)
```

### Selection

```typescript
const choice = await ui.promptSelect('Select environment:', [
  { name: 'Development', value: 'dev' },
  { name: 'Production', value: 'prod' }
])
```

### Multiple Selection

```typescript
const features = await ui.promptMultiSelect('Select features:', [
  { name: 'Authentication', value: 'auth' },
  { name: 'Database', value: 'db' },
  { name: 'API', value: 'api' }
])
```

### Guidelines

- Provide clear, specific prompts
- Include default values when appropriate
- Use validation for critical inputs
- Group related prompts together
- Provide helpful choice descriptions

## Best Practices

### General Guidelines

1. **Consistency**: Use the same patterns throughout the application
2. **Clarity**: Make messages clear and actionable
3. **Accessibility**: Ensure functionality works without colors
4. **Performance**: Don't overuse spinners or progress indicators
5. **Feedback**: Always provide feedback for user actions

### Message Hierarchy

1. **Errors** (Red): Critical issues requiring immediate attention
2. **Warnings** (Yellow): Important but non-critical issues
3. **Success** (Green): Positive confirmations
4. **Info** (Blue): General information and guidance

### Layout and Spacing

- Use separators to group related content
- Add spacing between major sections
- Use boxes sparingly for emphasis
- Keep tables readable with appropriate column widths

### Error Handling

- Always handle gracefully when colors/formatting fails
- Provide meaningful error messages
- Include suggested actions when possible
- Log technical details separately from user-facing messages

### Examples

#### Complete Workflow Example

```typescript
// Clear screen and show header
ui.clearScreen()
ui.showHeader('Roo CLI Setup', 'Initial configuration')

// Show current status
const status = {
  'CLI Version': '1.0.0',
  'Node Version': process.version,
  'Platform': process.platform
}
ui.showKeyValueTable(status, 'System Information')

// Get user input
const projectName = await ui.promptText('Project name:', 'my-project')
const useTypescript = await ui.promptConfirm('Use TypeScript?', true)

// Show progress
const spinner = ui.showSpinner('Creating project...')
spinner.start()

// Simulate work
spinner.text = 'Installing dependencies...'
// ... do work ...

spinner.succeed('Project created successfully')

// Show summary
ui.showSuccessBox(`Project "${projectName}" created`, 'Success')
ui.showSeparator('=', 50)
```

This example demonstrates proper use of headers, tables, prompts, progress indicators, and final confirmation.