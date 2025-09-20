// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

using System.ComponentModel;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

namespace Mssql.McpServer;

public partial class Tools
{
    [McpServerTool(
        Title = "Update Data",
        ReadOnly = false,
        Destructive = true),
        Description("Updates data in a table in the SQL Database. Expects a valid UPDATE SQL statement with WHERE clause for security.")]
    public async Task<DbOperationResult> UpdateData(
        [Description("UPDATE SQL statement (must start with UPDATE and include WHERE clause for security)")] string sql)
    {
        // Validate the SQL query for security issues
        var validation = SqlSecurityValidator.ValidateUpdateQuery(sql);
        if (!validation.IsValid)
        {
            _logger.LogWarning("SQL security validation failed: {Message}. Query: {Query}", 
                validation.Message, sql.Length > 100 ? sql.Substring(0, 100) + "..." : sql);
            return new DbOperationResult(success: false, error: $"Security validation failed: {validation.Message}");
        }

        var conn = await _connectionFactory.GetOpenConnectionAsync();
        try
        {
            using (conn)
            {
                _logger.LogInformation("Executing validated UPDATE query: {Query}", 
                    sql.Length > 200 ? sql.Substring(0, 200) + "..." : sql);
                    
                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(sql, conn);
                var rows = await cmd.ExecuteNonQueryAsync();
                return new DbOperationResult(true, rowsAffected: rows);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UpdateData failed: {Message}", ex.Message);
            
            // Don't expose internal error details to prevent information leakage
            var safeErrorMessage = ex.Message.Contains("Invalid object name", StringComparison.OrdinalIgnoreCase) ||
                                  ex.Message.Contains("Invalid column name", StringComparison.OrdinalIgnoreCase)
                ? ex.Message 
                : "Database update operation failed";
                
            return new DbOperationResult(false, safeErrorMessage);
        }
    }
}

