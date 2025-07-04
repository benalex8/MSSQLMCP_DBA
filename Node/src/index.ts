#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Internal imports
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { ListTableTool } from "./tools/ListTableTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";
import { CheckDBTool } from "./tools/CheckDBTool.js";
import { sp_WhoisActiveTool } from "./tools/sp_WhoisactiveTool.js";
import { sp_BlitzTool } from "./tools/sp_BlitzTool.js";
import { sp_PressureDetectorTool } from "./tools/sp_PressureDetectorTool.js";
// MSSQL Database connection configuration
// const credential = new DefaultAzureCredential();
// Globals for connection and token reuse
let globalSqlPool: any = null;
let globalAccessToken: string | null = null;
let globalTokenExpiresOn: Date | null = null;
// Function to create SQL config with fresh access token, returns token and expiry
export async function createSqlConfig() {
    const config = {
        server: process.env.SERVER_NAME || "",
        database: process.env.DATABASE_NAME || "",
        user: process.env.SQL_USER || "",
        password: process.env.SQL_PASSWORD || "",
        options: {
            encrypt: false,
            trustServerCertificate: false,
            enableArithAbort: true,
        },
    };
    
    // Validate required environment variables
    if (!config.server || !config.database || !config.user || !config.password) {
        throw new Error("Missing required environment variables: SERVER_NAME, DATABASE_NAME, SQL_USER, SQL_PASSWORD");
    }
    
    return config;
}

const updateDataTool = new UpdateDataTool();
const insertDataTool = new InsertDataTool();
const readDataTool = new ReadDataTool();
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const listTableTool = new ListTableTool();
const dropTableTool = new DropTableTool();
const describeTableTool = new DescribeTableTool();
const checkDBTool = new CheckDBTool();
const sp_whoisactiveTool = new sp_WhoisActiveTool();
const sp_blitzTool = new sp_BlitzTool();
const sp_pressureDetectorTool = new sp_PressureDetectorTool();

const server = new Server({
    name: "mssql-mcp-server",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});

// Read READONLY env variable
const isReadOnly = process.env.READONLY === "true";

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: isReadOnly
        ? [listTableTool, readDataTool, describeTableTool, sp_whoisactiveTool, sp_blitzTool, sp_pressureDetectorTool] // todo: add searchDataTool to the list of tools available in readonly mode once implemented
        : [insertDataTool, readDataTool, describeTableTool, updateDataTool, createTableTool, createIndexTool, dropTableTool, listTableTool, checkDBTool, sp_whoisactiveTool, sp_blitzTool, sp_pressureDetectorTool], // add all new tools here
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case insertDataTool.name:
                result = await insertDataTool.run(args);
                break;
            case readDataTool.name:
                result = await readDataTool.run(args);
                break;
            case updateDataTool.name:
                result = await updateDataTool.run(args);
                break;
            case createTableTool.name:
                result = await createTableTool.run(args);
                break;
            case createIndexTool.name:
                result = await createIndexTool.run(args);
                break;
            case listTableTool.name:
                result = await listTableTool.run(args);
                break;
            case dropTableTool.name:
                result = await dropTableTool.run(args);
                break;
            case describeTableTool.name:
                if (!args || typeof args.tableName !== "string") {
                    return {
                        content: [{ type: "text", text: `Missing or invalid 'tableName' argument for describe_table tool.` }],
                        isError: true,
                    };
                }
                result = await describeTableTool.run(args as { tableName: string });
                break;
            case checkDBTool.name:
                result = await checkDBTool.run(args);
                break;
            case sp_whoisactiveTool.name:
                result = await sp_whoisactiveTool.run(args);
                break;
            case sp_blitzTool.name:
                result = await sp_blitzTool.run(args);
                break;
            case sp_pressureDetectorTool.name:
                result = await sp_pressureDetectorTool.run(args);
                break;
            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error occurred: ${error}` }],
            isError: true,
        };
    }
});

// Server startup
async function runServer() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    catch (error) {
        console.error("Fatal error running server:", error);
        process.exit(1);
    }
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});

// Connect to SQL only when handling a request
import sql from "mssql";

async function ensureSqlConnection() {
  if (globalSqlPool && globalSqlPool.connected) {
    return;
  }

  if (globalSqlPool) {
    try {
      await globalSqlPool.close();
    } catch (e) {
      console.warn("Failed to close old pool:", e);
    }
  }

  const config = await createSqlConfig();  // uses SQL auth
  globalSqlPool = await sql.connect(config);
}

// Patch all tool handlers to ensure SQL connection before running
function wrapToolRun(tool: any) {
    const originalRun = tool.run.bind(tool);
    tool.run = async function (...args: any[]) {
        await ensureSqlConnection();
        return originalRun(...args);
    };
}

[insertDataTool, readDataTool, updateDataTool, createTableTool, createIndexTool, dropTableTool, listTableTool, describeTableTool, checkDBTool, sp_whoisactiveTool, sp_blitzTool, sp_pressureDetectorTool].forEach(wrapToolRun);