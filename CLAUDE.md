# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains two complementary Model Context Protocol (MCP) server implementations for Microsoft SQL Server and Azure SQL Database:

1. **Node.js Implementation** (`/Node/`) - Full-featured MCP server with extensive DBA monitoring tools
2. **.NET Implementation** (`/dotnet/`) - Clean, enterprise-focused MCP server with core database operations

Both implementations follow the MCP specification and provide AI assistants with direct database interaction capabilities.

## Build Commands

### Node.js Server (`/Node/`)
```bash
cd Node
npm install           # Install dependencies
npm run build         # Build TypeScript to JavaScript
npm run watch         # Watch mode for development
npm start             # Start the server
```

### .NET Server (`/dotnet/`)
```bash
cd dotnet/MssqlMcp
dotnet build          # Build the project
dotnet run            # Run the server
dotnet test           # Run unit tests (from MssqlMcp.Tests directory)
```

## Architecture

### Node.js Implementation Architecture
- **Entry Point**: `src/index.ts` - Main server setup, tool registration, and request routing
- **Connection Management**: Global connection pooling with automatic reconnection and token refresh
- **Tool Organization**: Individual tool classes in `src/tools/` directory
- **Tool Categories**:
  - **Core CRUD**: CreateTable, DropTable, InsertData, ReadData, UpdateData, etc.
  - **DBA Monitoring**: sp_BlitzTool, sp_WhoisActiveTool, IOHotspotsTool, IndexUsageStatsTool
  - **Database Health**: CheckDBTool, DatabaseStatusTool, BackupStatusTool, AgentJobHealthTool
  - **Performance**: QueryPlanTool, WaitStatsTool, StatisticsUpdateTool
  - **Partitioning**: CreatePartitionFunctionTool, CreatePartitionSchemeTool, etc.

### .NET Implementation Architecture
- **Entry Point**: `Program.cs` - Host builder configuration with dependency injection
- **Tools Registry**: `Tools/Tools.cs` - Central registry for all MCP tools
- **Individual Tools**: Separate classes in `Tools/` directory (ListTables.cs, CreateTable.cs, etc.)
- **Connection Factory**: `ISqlConnectionFactory` interface with `SqlConnectionFactory` implementation
- **Dependency Injection**: Microsoft.Extensions.DependencyInjection for service registration

### Common Patterns
- Both implementations use connection string-based authentication via environment variables
- Tools are organized as individual classes with standardized interfaces
- Read-only mode support via `READONLY` environment variable
- Enhanced error handling and logging throughout

## Environment Configuration

### Required Environment Variables
- `SERVER_LIST` (Node.js) / `CONNECTION_STRING` (.NET): Database server connection details
- `DATABASE_NAME`: Target database name
- `SQL_USER`, `SQL_PASSWORD`: Database authentication credentials
- `READONLY`: Set to "true" to restrict to read-only operations

### MCP Client Configuration
Both servers support integration with:
- **VS Code Agent**: Configure in `.vscode/mcp.json` or VS Code settings
- **Claude Desktop**: Configure in `claude_desktop_config.json`

See respective README.md files for detailed setup instructions.

## Tool Categories and Usage

### Core Database Operations
- Table management (create, drop, list, describe)
- Data operations (insert, read, update) with safety constraints
- Index creation and management

### DBA and Monitoring Tools (Node.js)
- `sp_BlitzTool`: Comprehensive database health check using Brent Ozar's sp_Blitz
- `sp_WhoisActiveTool`: Active session monitoring
- `IOHotspotsTool`: I/O performance analysis
- `IndexUsageStatsTool`: Index utilization statistics
- `WaitStatsTool`: SQL Server wait statistics analysis

### Enhanced DBA Tools
- `DBA_ReadDataTool`: Advanced read operations with performance insights
- `DBA_InsertDataTool`: Enhanced insert operations with validation

### Security and Safety Features
- WHERE clause requirements for read operations to prevent full table scans
- Explicit WHERE clause requirements for update operations
- Read-only mode support for production environments
- Connection timeout and retry logic for stability

## Development Notes

### Node.js Specific
- TypeScript-first development with strict type checking
- Connection pooling with automatic cleanup
- Tool wrapper pattern for connection management (`wrapToolRun` function)

### .NET Specific
- Follows .NET 8 patterns with modern C# features
- Comprehensive unit testing with xUnit framework
- Dependency injection throughout the application
- Microsoft.Extensions.Logging for structured logging

### Testing
- .NET: Unit tests in `MssqlMcp.Tests/` using xUnit
- Node.js: Manual testing recommended through MCP client integration