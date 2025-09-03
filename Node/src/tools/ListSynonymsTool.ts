import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ListSynonymsTool implements Tool {
  [key: string]: any;
  name = "list_synonyms";
  description = "Lists synonyms in an MSSQL Database, showing their target objects and allowing cross-database querying";
  inputSchema = {
    type: "object",
    properties: {
      parameters: { 
        type: "array", 
        description: "Schemas to filter by (optional)",
        items: {
          type: "string"
        },
        minItems: 0
      },
    },
    required: [],
  } as any;

  async run(params: any) {
    try {
      const { parameters } = params;
      const request = new sql.Request();
      const schemaFilter = parameters && parameters.length > 0 ? 
        `AND SCHEMA_NAME(schema_id) IN (${parameters.map((p: string) => `'${p}'`).join(", ")})` : "";
      
      const query = `
        SELECT 
            SCHEMA_NAME(schema_id) + '.' + name AS synonym_name,
            base_object_name AS target_object,
            COALESCE(PARSENAME(base_object_name, 4), @@servername) AS server_name,
            COALESCE(PARSENAME(base_object_name, 3), DB_NAME()) AS database_name,
            COALESCE(PARSENAME(base_object_name, 2), 'dbo') AS schema_name,
            PARSENAME(base_object_name, 1) AS object_name,
            create_date,
            modify_date
        FROM sys.synonyms
        WHERE 1=1 ${schemaFilter}
        ORDER BY SCHEMA_NAME(schema_id), name
      `;
      
      const result = await request.query(query);
      return {
        success: true,
        message: `List synonyms executed successfully`,
        items: result.recordset,
      };
    } catch (error) {
      console.error("Error listing synonyms:", error);
      return {
        success: false,
        message: `Failed to list synonyms: ${error}`,
      };
    }
  }
}