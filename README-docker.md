# 🐳 Roo Code Agent API - Docker Quick Start

Get the Roo Code Agent API running in Docker containers for both development and production environments with comprehensive SSE streaming support.

## 🚀 Quick Start

### Development Environment

```bash
# 1. Navigate to development directory
cd docker/development

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Setup configuration
mkdir -p workspace config
cp ../config/agent-config.json.example config/agent-config.json
cp ../config/mcp-config.json.example config/mcp-config.json
# Edit config files with your settings

# 4. Start development environment
../scripts/dev-up.sh

# 5. Access the API
curl http://localhost:3000/health
```

### Production Deployment

```bash
# 1. Navigate to production directory
cd docker/production

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your production settings

# 3. Setup configuration and workspace
mkdir -p workspace config logs
cp ../config/agent-config.json.example config/agent-config.json
cp ../config/mcp-config.json.example config/mcp-config.json
# Configure for production

# 4. Build and deploy
../scripts/build-prod.sh --validate
docker-compose up -d

# 5. Verify deployment
curl http://localhost:3000/health
```

## 📋 What's Included

### 🏭 Production Setup

- **Multi-stage Dockerfile** with Alpine Linux base (~200MB)
- **Security hardened** with non-root execution
- **SSE optimized** with proper buffering and timeouts
- **Health checks** and monitoring endpoints
- **Resource limits** and restart policies

### 🛠️ Development Setup

- **Hot reload** with nodemon and ts-node
- **Debug support** with exposed debug port (9229)
- **Volume mounting** for real-time code changes
- **Testing environment** with isolated configuration
- **VS Code integration** ready

### ⚙️ Configuration Management

- **Multi-source configuration** (env vars, files, CLI config)
- **MCP server integration** with multiple server support
- **Environment separation** (dev/staging/prod)
- **Security best practices** for secrets management

### 🌊 SSE Streaming Support

- **Real-time streaming** via `/execute/stream` endpoint
- **Interactive questions** with separate API endpoints
- **Long-running tasks** with 24-hour timeout support
- **Concurrent connections** (100+ streams supported)
- **Proxy optimized** with nginx configuration examples

## 🔧 Key Features

### API Endpoints

- `GET /health` - Health check with comprehensive validation
- `GET /status` - Detailed status including metrics
- `POST /execute` - Simple task execution
- `POST /execute/stream` - **SSE streaming** task execution
- `POST /api/questions/:id/answer` - Interactive question responses

### SSE Event Types

- `start` - Task execution started
- `progress` - Task progress updates
- `question_ask` - Interactive question prompts
- `content` - LLM content output
- `tool_call` - Tool execution
- `tool_result` - Tool execution results
- `thinking` - LLM reasoning (if enabled)
- `complete` - Task completion
- `error` - Error events

### Container Features

- **Multi-architecture support** (x64, ARM64)
- **File descriptor limits** optimized for SSE (65536+)
- **Memory management** with appropriate heap sizing
- **Signal handling** for graceful shutdowns
- **Log management** with rotation

## 📚 Documentation

### Comprehensive Guides

- 📖 [Production Deployment Guide](docs/deployment/docker-production.md)
- 🛠️ [Development Setup Guide](docs/development/docker-development.md)
- ⚙️ [Configuration Reference](docs/configuration/docker-config.md)
- 🏗️ [Technical Implementation](docs/technical/docker-api-implementation-plan.md)
- 📋 [Product Stories](docs/product-stories/docker-api-containerization.md)

### Quick References

- **Environment Variables**: All `API_*` variables documented
- **Configuration Files**: JSON/YAML examples provided
- **MCP Servers**: GitHub, filesystem, database integrations
- **Security Settings**: CORS, rate limiting, headers
- **SSE Configuration**: Heartbeat, timeouts, connection limits

## 🚀 Usage Examples

### Development Workflow

```bash
# Start development environment
docker/scripts/dev-up.sh --setup --logs

# Make code changes (auto-reloaded)
# API available at http://localhost:3000

# Debug with VS Code
# Attach to process on localhost:9229

# Test SSE streaming
curl -N -H "Accept: text/event-stream" \
  -X POST http://localhost:3000/execute/stream \
  -H "Content-Type: application/json" \
  -d '{"task": "list files in workspace", "mode": "code"}'

# Stop environment
cd docker/development && docker-compose down
```

### Production Deployment

```bash
# Build production image
docker/scripts/build-prod.sh --validate --tag v1.0.0

# Deploy with monitoring
cd docker/production
docker-compose up -d

# Monitor health
watch 'curl -s http://localhost:3000/health | jq'

# View logs
docker-compose logs -f roo-api

# Scale horizontally
docker-compose up -d --scale roo-api=3
```

### Testing SSE Streaming

```bash
# Test basic SSE
./test-api.js --stream "list the current directory contents"

# Test interactive questions
./test-api.js --stream "use the github mcp server to create a new issue"

# Test with verbose output
./test-api.js --stream --verbose --show-thinking "debug this code issue"
```

## 🔍 Monitoring & Troubleshooting

### Health Monitoring

```bash
# Container health
docker/scripts/health-check.sh --verbose

# Service status
curl http://localhost:3000/status | jq

# Resource usage
docker stats roo-api --no-stream
```

### Common Issues

| Issue                    | Solution                                |
| ------------------------ | --------------------------------------- |
| **Port conflicts**       | Change `API_PORT` in `.env`             |
| **Permission denied**    | Check volume mount permissions          |
| **SSE connection drops** | Increase proxy timeouts                 |
| **Memory issues**        | Adjust container resource limits        |
| **MCP server failures**  | Check API keys and network connectivity |

### Debug Commands

```bash
# Container logs
docker-compose logs -f roo-api

# Shell access
docker-compose exec roo-api bash

# Network connectivity
docker-compose exec roo-api curl -I http://localhost:3000/health

# Process monitoring
docker-compose exec roo-api ps aux
```

## 🛡️ Security

### Production Security Checklist

- ✅ **CORS configured** for your domain
- ✅ **API keys secured** via environment variables
- ✅ **HTTPS enabled** with reverse proxy
- ✅ **Rate limiting** configured
- ✅ **Security headers** enabled
- ✅ **Non-root execution** in containers
- ✅ **Resource limits** set

### Security Best Practices

- Use specific CORS origins in production
- Rotate API keys regularly
- Monitor for unusual activity
- Keep base images updated
- Use secrets management systems
- Enable audit logging

## 🔄 Maintenance

### Updates

```bash
# Update base images
docker-compose pull

# Rebuild with latest code
docker/scripts/build-prod.sh --no-cache

# Update dependencies
cd src && npm update
```

### Backup

```bash
# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz docker/*/config

# Backup workspace
tar -czf workspace-backup-$(date +%Y%m%d).tar.gz workspace
```

## 🆘 Support

### Getting Help

- 📖 **Documentation**: Check the comprehensive guides
- 🐛 **Issues**: Report bugs with logs and configuration
- 💬 **Questions**: Include environment details and error messages

### Useful Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [SSE Streaming Guide](docs/configuration/docker-config.md#sse-streaming-configuration)
- [MCP Server Documentation](docs/configuration/docker-config.md#mcp-server-configuration)

---

**Ready to start?** Choose your environment and follow the quick start guide above! 🚀
