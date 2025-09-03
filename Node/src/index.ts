#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
} from "@modelcontextprotocol/sdk/types.js";

// Internal imports - only tools that exist in the file structure
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { DBA_InsertDataTool } from "./tools/DBA_InsertDataTool.js";
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { DBA_ReadDataTool } from "./tools/DBA_ReadDataTool.js";
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { ListTableTool } from "./tools/ListTableTool.js";
import { ListSynonymsTool } from "./tools/ListSynonymsTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";
import { CheckDBTool } from "./tools/CheckDBTool.js";
import { sp_WhoisActiveTool } from "./tools/sp_WhoisactiveTool.js";
import { sp_BlitzTool } from "./tools/sp_BlitzTool.js";
import { sp_PressureDetectorTool } from "./tools/sp_PressureDetectorTool.js";
import { BackupStatusTool } from "./tools/BackupStatusTool.js";
import { CheckConnectivityTool } from "./tools/CheckConnectivityTool.js";
import { DatabaseStatusTool } from "./tools/DatabaseStatusTool.js";
import { IOHotspotsTool } from "./tools/IOHotspotsTool.js";
import { IndexUsageStatsTool } from "./tools/IndexUsageStatsTool.js";
import { QueryPlanTool } from "./tools/QueryPlanTool.js";
import { StatisticsUpdateTool } from "./tools/StatisticsUpdateTool.js";
import { WaitStatsTool } from "./tools/WaitStatsTool.js";

// MSSQL Database connection configuration
let globalSqlPool: any = null;
let globalAccessToken: string | null = null;
let globalTokenExpiresOn: Date | null = null;

// Function to create SQL config with fresh access token, returns token and expiry
export async function createSqlConfig(serverName?: string) {
    const servers = process.env.SERVER_LIST?.split(",") ?? [];
    const selectedServer = serverName || servers[0]; // Use arg or default to first
    
    const config = {
        server: selectedServer,
        database: process.env.DATABASE_NAME || "",
        user: process.env.SQL_USER || "",
        password: process.env.SQL_PASSWORD || "",
        // Add timeout configurations for large table operations
        connectionTimeout: 30000,
        requestTimeout: 3600000,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
            acquireTimeoutMillis: 60000
        },
        options: {
            encrypt: false,
            trustServerCertificate: false,
            enableArithAbort: true,
            // Add additional query options for better performance
            abortTransactionOnError: true
        },
    };

    if (!config.server || !config.database || !config.user || !config.password) {
        throw new Error("Missing required environment variables: SERVER_LIST, DATABASE_NAME, SQL_USER, SQL_PASSWORD");
    }
    
    return config;
}

// Initialize all tool instances
const updateDataTool = new UpdateDataTool();
const insertDataTool = new InsertDataTool();
const dbaInsertDataTool = new DBA_InsertDataTool();
const readDataTool = new ReadDataTool();
const dbaReadDataTool = new DBA_ReadDataTool();
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const listTableTool = new ListTableTool();
const listSynonymsTool = new ListSynonymsTool();
const dropTableTool = new DropTableTool();
const describeTableTool = new DescribeTableTool();
const checkDBTool = new CheckDBTool();
const sp_whoisactiveTool = new sp_WhoisActiveTool();
const sp_blitzTool = new sp_BlitzTool();
const sp_pressureDetectorTool = new sp_PressureDetectorTool();
const backupStatusTool = new BackupStatusTool();
const checkConnectivityTool = new CheckConnectivityTool();
const databaseStatusTool = new DatabaseStatusTool();
const ioHotspotsTool = new IOHotspotsTool();
const indexUsageStatsTool = new IndexUsageStatsTool();
const queryPlanTool = new QueryPlanTool();
const statisticsUpdateTool = new StatisticsUpdateTool();
const waitStatsTool = new WaitStatsTool();

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
        ? [
            // Read-only tools for monitoring and analysis
            listTableTool, 
            listSynonymsTool,
            readDataTool,
            dbaReadDataTool,
            describeTableTool,
            dbaInsertDataTool,
            sp_whoisactiveTool,
            sp_blitzTool,
            sp_pressureDetectorTool,
            backupStatusTool,
            checkConnectivityTool,
            databaseStatusTool,
            ioHotspotsTool,
            indexUsageStatsTool,
            queryPlanTool,
            waitStatsTool
        ]
        : [
            // All tools including write operations
            insertDataTool,
            dbaInsertDataTool,
            readDataTool,
            dbaReadDataTool,
            describeTableTool,
            updateDataTool,
            createTableTool,
            createIndexTool,
            dropTableTool,
            listTableTool,
            listSynonymsTool,
            checkDBTool,
            sp_whoisactiveTool,
            sp_blitzTool,
            sp_pressureDetectorTool,
            backupStatusTool,
            checkConnectivityTool,
            databaseStatusTool,
            ioHotspotsTool,
            indexUsageStatsTool,
            queryPlanTool,
            statisticsUpdateTool,
            waitStatsTool
        ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
        let result: any;
        
        switch (name) {
            case insertDataTool.name:
                result = await insertDataTool.run(args);
                break;
            case dbaInsertDataTool.name:
                result = await dbaInsertDataTool.run(args);
                break;
            case readDataTool.name:
                result = await readDataTool.run(args);
                break;
            case dbaReadDataTool.name:
                result = await dbaReadDataTool.run(args);
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
            case listSynonymsTool.name:
                result = await listSynonymsTool.run(args);
                break;
            case dropTableTool.name:
                result = await dropTableTool.run(args);
                break;
            case describeTableTool.name:
                if (!args || !args.tableName || typeof args.tableName !== "string") {
                    return {
                        content: [{ type: "text", text: `Missing or invalid 'tableName' argument for describe_table tool.` }],
                        isError: true,
                    };
                }
                result = await describeTableTool.run({ tableName: args.tableName });
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
            case backupStatusTool.name:
                result = await backupStatusTool.run(args);
                break;
            case checkConnectivityTool.name:
                result = await checkConnectivityTool.run(args);
                break;
            case databaseStatusTool.name:
                result = await databaseStatusTool.run(args);
                break;
            case ioHotspotsTool.name:
                result = await ioHotspotsTool.run(args);
                break;
            case indexUsageStatsTool.name:
                result = await indexUsageStatsTool.run(args);
                break;
            case queryPlanTool.name:
                result = await queryPlanTool.run(args);
                break;
            case statisticsUpdateTool.name:
                result = await statisticsUpdateTool.run(args);
                break;
            case waitStatsTool.name:
                result = await waitStatsTool.run(args);
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

async function ensureSqlConnection(serverName?: string) {
    if (globalSqlPool && globalSqlPool.connected) {
        return;
    }
    
    if (globalSqlPool) {
        try {
            await globalSqlPool.close();
        }
        catch (e) {
            console.warn("Failed to close old pool:", e);
        }
    }
    
    const config = await createSqlConfig(serverName);
    globalSqlPool = await sql.connect(config);
}

// Patch all tool handlers to ensure SQL connection before running
function wrapToolRun(tool: any) {
    const originalRun = tool.run.bind(tool);
    tool.run = async function (args: any) {
        const targetServer = args?.serverName;
        await ensureSqlConnection(targetServer);
        return originalRun(args);
    };
}

// Apply connection wrapper to all tools
[
    insertDataTool,
    dbaInsertDataTool,
    readDataTool,
    dbaReadDataTool,
    updateDataTool,
    createTableTool,
    createIndexTool,
    dropTableTool,
    listTableTool,
    listSynonymsTool,
    describeTableTool,
    checkDBTool,
    sp_whoisactiveTool,
    sp_blitzTool,
    sp_pressureDetectorTool,
    backupStatusTool,
    checkConnectivityTool,
    databaseStatusTool,
    ioHotspotsTool,
    indexUsageStatsTool,
    queryPlanTool,
    statisticsUpdateTool,
    waitStatsTool
].forEach(wrapToolRun);