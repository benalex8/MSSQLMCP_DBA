// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

using System.ComponentModel;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

namespace Mssql.McpServer;

public partial class Tools
{
    private const string ListSynonymsQuery = @"
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
        ORDER BY SCHEMA_NAME(schema_id), name";

    [McpServerTool(
        Title = "List Synonyms",
        ReadOnly = true,
        Idempotent = true,
        Destructive = false),
        Description("Lists all synonyms in the SQL Database, showing their target objects for cross-database querying.")]
    public async Task<DbOperationResult> ListSynonyms()
    {
        var conn = await _connectionFactory.GetOpenConnectionAsync();
        try
        {
            using (conn)
            {
                using var cmd = new SqlCommand(ListSynonymsQuery, conn);
                var synonyms = new List<object>();
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    synonyms.Add(new
                    {
                        synonym_name = reader.IsDBNull(0) ? null : reader.GetString(0),
                        target_object = reader.IsDBNull(1) ? null : reader.GetString(1),
                        server_name = reader.IsDBNull(2) ? null : reader.GetString(2),
                        database_name = reader.IsDBNull(3) ? null : reader.GetString(3),
                        schema_name = reader.IsDBNull(4) ? null : reader.GetString(4),
                        object_name = reader.IsDBNull(5) ? null : reader.GetString(5),
                        create_date = reader.IsDBNull(6) ? (DateTime?)null : reader.GetDateTime(6),
                        modify_date = reader.IsDBNull(7) ? (DateTime?)null : reader.GetDateTime(7)
                    });
                }
                return new DbOperationResult(success: true, data: synonyms);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ListSynonyms failed: {Message}", ex.Message);
            return new DbOperationResult(success: false, error: ex.Message);
        }
    }
}