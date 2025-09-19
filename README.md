# MSSQL MCP DBA Toolkit

This repository provides two implementations of a Model Context Protocol (MCP) server that let AI assistants interact safely with Microsoft SQL Server:

- `Node/` - TypeScript/Node.js MCP server distributed as a command line tool.
- `dotnet/` - .NET 8 MCP server that uses the official C# SDK.

Both servers expose a rich catalog of DBA-oriented tools (schema inspection, performance diagnostics, CRUD helpers) and share a common goal: making it easier for copilots such as Claude Desktop or the VS Code Agent extension to reason over SQL Server workloads with minimal manual wiring.

## Repository Layout

- `Node/` - Source for the Node.js MCP server, including tool implementations under `src/tools`, sample configs, and build scripts.
- `dotnet/` - Source for the .NET MCP server with dependency-injected tools and xUnit coverage.
- `CLAUDE.md` - Guidance originally authored for Claude-based workflows.

## Feature Highlights

- **Multiple runtimes**: choose between Node.js (ESM) or .NET 8 depending on your deployment environment.
- **Comprehensive toolset**: list tables/synonyms, describe schema, run health checks (`sp_Blitz`, `sp_WhoIsActive`), inspect wait stats, and perform carefully scoped CRUD operations.
- **Safety controls**:
  - `READONLY=true` hides and blocks mutating tools in the Node server.
  - Read/query operations validate inputs and sanitize outputs.
  - Update tools require explicit `WHERE` clauses.
- **Test coverage**: .NET project ships with unit tests that exercise the primary tools end-to-end.

## Quick Start

### Node.js Server

1. **Install & build**
   ```bash
   cd Node
   npm install
   npm run build
   ```
2. **Configure environment** (minimum variables)
   ```bash
   export SERVER_LIST="sqlserver01.yourdomain.com"
   export DATABASE_NAME="YourDatabase"
   export SQL_USER="mcp_service"
   export SQL_PASSWORD="super-secret"
   # optional: export READONLY="true" to expose only read-only tools
   ```
3. **Wire up your assistant**
   - VS Code Agent: reference `dist/index.js` in `settings.json` or `.vscode/mcp.json` (see `Node/src/samples`).
   - Claude Desktop: add the server under *Settings  Developer* with matching env vars.
4. **Run**
   ```bash
   node dist/index.js
   ```

### .NET Server

1. **Configure connection string**
   ```bash
   set CONNECTION_STRING=Server=.;Database=Test;Trusted_Connection=True;TrustServerCertificate=True
   ```
2. **Build & test**
   ```bash
   cd dotnet
   dotnet build
   dotnet test
   ```
3. **Run**
   ```bash
   dotnet run --project MssqlMcp
   ```
4. **Register the server** with your tool of choice (sample JSON snippets are documented in `dotnet/README.md`).

## Tool Catalog (excerpt)

| Category | Examples |
| --- | --- |
| Schema discovery | `list_table`, `list_synonyms`, `describe_table` |
| Data access | `read_data` (Node), `ReadData` (.NET) |
| Data change | `insert_data`, `update_data`, `create_table`, `drop_table` |
| Performance & health | `check_db`, `sp_Blitz`, `sp_WhoIsActive`, `wait_stats`, `backup_status` |

> **Note**: Tool identifiers differ slightly between the Node and .NET implementations (camelCase vs. PascalCase).

## Safety & Operations

- The Node server opens a pooled `mssql` connection on demand. Supply multiple targets via `SERVER_LIST` (comma-separated) and optionally pass `serverName` per call.
- Set `READONLY=true` to guarantee that only observational tools are advertised *and* enforced at runtime.
- Review credentials handling before production use; prefer managed identity / Azure AD where possible.

## Contributing

1. Fork and clone the repository.
2. Make your changes inside `Node/` or `dotnet/`.
3. Run the relevant build/tests (`npm run build`, `dotnet test`).
4. Submit a pull request describing the change and any new tool capability.

## License

See the [LICENSE](Node/LICENSE) file for the Node server. The .NET project inherits its licensing from the original Microsoft sample.



