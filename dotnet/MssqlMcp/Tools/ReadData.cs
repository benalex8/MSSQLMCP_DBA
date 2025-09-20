// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

using System.ComponentModel;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

namespace Mssql.McpServer;
public partial class Tools
{
    [McpServerTool(
        Title = "Read Data",
        ReadOnly = true,
        Idempotent = true,
        Destructive = false),
        Description("Executes SELECT queries against SQL Database to read data. Only SELECT queries are allowed for security reasons.")]
    public async Task<DbOperationResult> ReadData(
        [Description("SELECT SQL query to execute (must start with SELECT and cannot contain destructive operations)")] string sql)
    {
        // Validate the SQL query for security issues
        var validation = SqlSecurityValidator.ValidateReadQuery(sql);
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
                _logger.LogInformation("Executing validated SELECT query: {Query}", 
                    sql.Length > 200 ? sql.Substring(0, 200) + "..." : sql);
                    
                using var cmd = new SqlCommand(sql, conn);
                using var reader = await cmd.ExecuteReaderAsync();
                var results = new List<Dictionary<string, object?>>();
                
                // Limit results to prevent memory issues
                const int maxRecords = 10000;
                var recordCount = 0;
                
                while (await reader.ReadAsync() && recordCount < maxRecords)
                {
                    var row = new Dictionary<string, object?>();
                    for (var i = 0; i < reader.FieldCount; i++)
                    {
                        // Sanitize column names (remove suspicious characters)
                        var columnName = reader.GetName(i);
                        var sanitizedColumnName = System.Text.RegularExpressions.Regex.Replace(columnName, @"[^\w\s\-_.]", "");
                        if (sanitizedColumnName != columnName)
                        {
                            _logger.LogWarning("Column name sanitized: {Original} -> {Sanitized}", columnName, sanitizedColumnName);
                        }
                        
                        row[sanitizedColumnName] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    }
                    results.Add(row);
                    recordCount++;
                }
                
                if (recordCount >= maxRecords)
                {
                    _logger.LogWarning("Query results limited to {MaxRecords} records", maxRecords);
                }
                
                return new DbOperationResult(success: true, data: results);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReadData failed: {Message}", ex.Message);
            
            // Don't expose internal error details to prevent information leakage
            var safeErrorMessage = ex.Message.Contains("Invalid object name", StringComparison.OrdinalIgnoreCase) 
                ? ex.Message 
                : "Database query execution failed";
                
            return new DbOperationResult(success: false, error: safeErrorMessage);
        }
    }
}
