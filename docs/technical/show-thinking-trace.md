# --show-thinking Flow Trace

## Command Line to Filter Flow

1. **CLI Parsing**: `--show-thinking` → `options.showThinking = true` (line 87)
2. **Main Function**: `showThinking: options.showThinking` → REPLSession (line 1178)
3. **REPLSession**: `this.options = options` stores REPLSessionOptions (line 543)
4. **executeCommand**: `...this.options` → spreads into new ApiClientOptions (line 776)
5. **executeStreamingRequest**: `showThinking: options.showThinking` → ClientContentFilter (line 882)
6. **StreamProcessor**: `shouldShowContent(event.contentType || '')` (line 355)
7. **ClientContentFilter**: Checks if `event.contentType === 'thinking'` → returns `this.options.showThinking` (line 818)
8. **Filter Logic**: `shouldDisplay` used in condition (line 371)

## Critical Question

**What is `event.contentType` for thinking content from the server?**

If the server sends thinking content with:

- `contentType: 'thinking'` ✅ Filter works
- `contentType: 'thought'` ❌ Filter fails
- `contentType: null/undefined` ❌ Filter fails
- No contentType field ❌ Filter fails

## Debugging Steps

1. Add debug logging to see what `event.contentType` values are received
2. Check if thinking content is being sent with the correct contentType
3. Verify the server is properly setting contentType for thinking sections
