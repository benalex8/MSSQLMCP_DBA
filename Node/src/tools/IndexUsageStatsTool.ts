import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class IndexUsageStatsTool implements Tool {
  [key: string]: any;
  name = "index_usage_stats";
  description = "Analyze unused, missing, and duplicate indexes";

  inputSchema: {
    type: "object";
    properties: {};
    required: string[];
  } = {
    type: "object",
    properties: {},
    required: []
  };

  async run(_: any) {
    const query = `
      -- Find unused indexes
      SELECT 
        DB_NAME() AS DatabaseName,
        OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
        OBJECT_NAME(i.object_id) AS TableName,
        i.name AS IndexName,
        i.index_id,
        user_seeks, user_scans, user_lookups, user_updates
      FROM sys.indexes AS i
      LEFT JOIN sys.dm_db_index_usage_stats AS s
        ON i.object_id = s.object_id AND i.index_id = s.index_id AND s.database_id = DB_ID()
      WHERE i.is_disabled = 0
        AND i.type_desc IN ('CLUSTERED', 'NONCLUSTERED')
        AND (user_seeks IS NULL AND user_scans IS NULL AND user_lookups IS NULL)
      ORDER BY TableName, IndexName;

      -- Duplicate indexes (simplified)
      SELECT 
        OBJECT_SCHEMA_NAME(i1.object_id) AS SchemaName,
        OBJECT_NAME(i1.object_id) AS TableName,
        i1.name AS Index1,
        i2.name AS Index2
      FROM sys.indexes i1
      JOIN sys.indexes i2
        ON i1.object_id = i2.object_id
        AND i1.index_id <> i2.index_id
      WHERE i1.type_desc = i2.type_desc
        AND i1.is_disabled = 0 AND i2.is_disabled = 0;
    `;
    try {
      const request = new sql.Request();
      const result = await request.query(query);
      return {
        success: true,
        message: "Index usage stats retrieved",
        data: result.recordsets
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to retrieve index usage stats: ${err.message}`
      };
    }
  }
}