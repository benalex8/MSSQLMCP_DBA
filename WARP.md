# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This repository contains two complementary Model Context Protocol (MCP) server implementations for Microsoft SQL Server and Azure SQL Database:

1. **Node.js Implementation** (`/Node/`) - Full-featured MCP server with extensive DBA monitoring tools (24 tools)
2. **.NET Implementation** (`/dotnet/`) - Clean, enterprise-focused MCP server with core database operations (9 tools)

Both implementations follow the MCP specification and provide AI assistants with direct database interaction capabilities. The Node.js version focuses on comprehensive DBA tooling, while the .NET version emphasizes enterprise patterns and maintainability.

## Common Development Commands

### Node.js Server (`/Node/`)
```bash
cd Node
npm install              # Install dependencies
npm run build            # Build TypeScript to JavaScript
npm run watch            # Watch mode for development
npm start                # Start the MCP server
```

### .NET Server (`/dotnet/`)
```bash
cd dotnet/MssqlMcp
dotnet build             # Build the project
dotnet run               # Run the MCP server
dotnet test              # Run unit tests (from MssqlMcp.Tests directory)
```

### Testing Individual Components
```bash
# .NET unit tests
cd dotnet/MssqlMcp.Tests
dotnet test

# Node.js manual testing through MCP client integration recommended
```

## High-Level Architecture

### Dual Implementation Strategy
The repository implements the same MCP server concept in two different technology stacks:

- **Node.js**: Focuses on comprehensive DBA tooling with 24+ specialized tools for database monitoring and performance analysis
- **.NET**: Enterprise-grade implementation with dependency injection, structured logging, and comprehensive unit testing

### MCP Tool Architecture Pattern
Both implementations follow a consistent pattern:

1. **Tool Registration**: 
   - Node.js: Manual instantiation and switch-case routing in `src/index.ts`
   - .NET: Automatic discovery via `WithToolsFromAssembly()` and dependency injection

2. **Connection Management**:
   - Node.js: Global connection pooling with `wrapToolRun` pattern ensuring connections before tool execution
   - .NET: `ISqlConnectionFactory` interface with dependency injection for testability

3. **Read-Only Mode**: Both implementations respect `READONLY` environment variable to restrict tool availability

### Tool Categories and Specialization

**Core Database Operations (Both)**:
- Table management (create, drop, list, describe)  
- Data operations (insert, read, update) with safety constraints
- Index creation and management

**Advanced DBA Tools (Node.js Focused)**:
- `sp_BlitzTool`: Brent Ozar's comprehensive database health check
- `sp_WhoisActiveTool`: Active session monitoring
- `IOHotspotsTool`: I/O performance analysis
- `IndexUsageStatsTool`: Index utilization statistics
- `WaitStatsTool`: SQL Server wait statistics analysis
- `QueryPlanTool`: Query execution plan analysis

**Enhanced Safety Tools**:
- `DBA_ReadDataTool`: Advanced read operations with performance insights
- `DBA_InsertDataTool`: Enhanced insert operations with validation

## Development Patterns and Best Practices

### Environment Configuration
Required environment variables for both implementations:
- `SERVER_LIST` (Node.js) / `CONNECTION_STRING` (.NET): Database server connection details
- `DATABASE_NAME`: Target database name  
- `SQL_USER`, `SQL_PASSWORD`: Database authentication credentials
- `READONLY`: Set to "true" to restrict to read-only operations

### Node.js Specific Patterns
- **TypeScript-first**: Strict type checking with ES2020 modules
- **Connection Pooling**: Global connection management with automatic reconnection
- **Tool Wrapper Pattern**: `wrapToolRun` function ensures SQL connections before tool execution
- **Manual Tool Registration**: Explicit tool instantiation and routing in switch statements

### .NET Specific Patterns  
- **Dependency Injection**: Microsoft.Extensions.DependencyInjection throughout
- **Host Builder Pattern**: Standard .NET application host with graceful shutdown
- **Factory Pattern**: `ISqlConnectionFactory` interface for connection management
- **Automatic Tool Discovery**: Assembly scanning for MCP tool registration
- **Comprehensive Unit Testing**: xUnit framework with dependency injection support

### MCP Client Integration
Both servers support integration with:
- **VS Code Agent**: Configure in VS Code settings with MCP server configuration
- **Claude Desktop**: Configure in `claude_desktop_config.json`
- **Custom MCP Clients**: Standard stdio transport with MCP protocol compliance

### Security and Safety Features
- WHERE clause requirements for read operations to prevent full table scans
- Explicit WHERE clause requirements for update operations  
- Read-only mode support for production environments
- Connection timeout and retry logic for stability
- Environment variable-based configuration (never hardcode credentials)

## Testing Strategy

### .NET Testing
- Comprehensive unit tests in `MssqlMcp.Tests/` using xUnit
- Dependency injection for testable connection factories
- Structured logging validation

### Node.js Testing  
- Manual testing through MCP client integration recommended
- Tool wrapper pattern facilitates integration testing
- Connection pooling behavior should be validated in integration scenarios

## Project-Specific Coding Guidelines

### Node.js Implementation
- Use idiomatic TypeScript with ES2020 modules
- Maintain the tool wrapper pattern for connection management
- Follow existing tool class structure when adding new tools
- Ensure all tools handle the `READONLY` environment variable appropriately

### .NET Implementation  
- Use idiomatic C# with .NET 8 patterns
- Follow dependency injection patterns throughout
- Add unit tests for all major components
- Use Microsoft.Extensions.Logging for structured logging
- Maintain the factory pattern for database connections

### Cross-Implementation Consistency
- Environment variable names should remain consistent between implementations
- Tool functionality should be equivalent where both implementations provide the same tool
- Error handling patterns should provide similar user experiences
- Documentation should clearly indicate implementation-specific features