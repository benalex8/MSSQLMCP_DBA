// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

using System.Text.RegularExpressions;

namespace Mssql.McpServer;

/// <summary>
/// Provides SQL security validation to prevent injection attacks and restrict dangerous operations
/// </summary>
public static class SqlSecurityValidator
{
    // List of dangerous SQL keywords that should not be allowed in read operations
    private static readonly string[] DangerousKeywords = 
    {
        "DELETE", "DROP", "INSERT", "ALTER", "CREATE", "TRUNCATE", "EXEC", "EXECUTE", 
        "MERGE", "REPLACE", "GRANT", "REVOKE", "COMMIT", "ROLLBACK", "TRANSACTION",
        "BEGIN", "DECLARE", "SET", "USE", "BACKUP", "RESTORE", "KILL", "SHUTDOWN",
        "WAITFOR", "OPENROWSET", "OPENDATASOURCE", "OPENQUERY", "OPENXML", "BULK"
    };

    // Regex patterns to detect common SQL injection techniques
    private static readonly Regex[] DangerousPatterns = 
    {
        // Semicolon followed by dangerous keywords
        new Regex(@";\s*(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE)", 
                 RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // UNION injection attempts (block ALL UNION usage for safety)
        new Regex(@"\bUNION\s+(?:ALL\s+)?SELECT", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // Comment-based injection attempts
        new Regex(@"--.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)", 
                 RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"/\*.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE).*?\*/", 
                 RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // Stored procedure execution patterns
        new Regex(@"\bEXEC\s*\(", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bEXECUTE\s*\(", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bsp_", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bxp_", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // Bulk operations
        new Regex(@"\bBULK\s+INSERT", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bOPENROWSET", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bOPENDATASOURCE", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // System functions that could be dangerous
        new Regex(@"@@", RegexOptions.Compiled),
        new Regex(@"\bSYSTEM_USER", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bUSER_NAME", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bDB_NAME", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bHOST_NAME", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // Time delay attacks
        new Regex(@"\bWAITFOR\s+DELAY", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\bWAITFOR\s+TIME", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        
        // Multiple statements (semicolon not at end)
        new Regex(@";\s*\w", RegexOptions.Compiled),
        
        // String concatenation that might hide malicious code
        new Regex(@"\+\s*CHAR\s*\(", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\+\s*NCHAR\s*\(", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new Regex(@"\+\s*ASCII\s*\(", RegexOptions.IgnoreCase | RegexOptions.Compiled)
    };

    /// <summary>
    /// Validates a SQL query for read operations (must start with SELECT)
    /// </summary>
    /// <param name="sql">The SQL query to validate</param>
    /// <returns>Validation result</returns>
    public static ValidationResult ValidateReadQuery(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            return new ValidationResult(false, "Query must be a non-empty string");
        }

        // Remove comments and normalize whitespace for analysis
        var cleanQuery = RemoveComments(sql)
            .Replace("\t", " ")
            .Replace("\n", " ")
            .Replace("\r", " ")
            .Trim();

        while (cleanQuery.Contains("  "))
        {
            cleanQuery = cleanQuery.Replace("  ", " ");
        }

        if (string.IsNullOrWhiteSpace(cleanQuery))
        {
            return new ValidationResult(false, "Query cannot be empty after removing comments");
        }

        var upperQuery = cleanQuery.ToUpperInvariant();

        // Must start with SELECT for read operations
        if (!upperQuery.StartsWith("SELECT"))
        {
            return new ValidationResult(false, "Query must start with SELECT for security reasons");
        }

        // Check for dangerous keywords
        foreach (var keyword in DangerousKeywords)
        {
            // Use word boundary checking
            var keywordPattern = $@"(^|\s|[^A-Za-z0-9_]){Regex.Escape(keyword)}($|\s|[^A-Za-z0-9_])";
            if (Regex.IsMatch(upperQuery, keywordPattern, RegexOptions.IgnoreCase))
            {
                return new ValidationResult(false, $"Dangerous keyword '{keyword}' detected in query. Only SELECT operations are allowed.");
            }
        }

        // Check for dangerous patterns
        foreach (var pattern in DangerousPatterns)
        {
            if (pattern.IsMatch(sql))
            {
                return new ValidationResult(false, "Potentially malicious SQL pattern detected. Only simple SELECT queries are allowed.");
            }
        }

        // Check for multiple statements
        var statements = cleanQuery.Split(';')
            .Where(stmt => !string.IsNullOrWhiteSpace(stmt))
            .ToList();
            
        if (statements.Count > 1)
        {
            return new ValidationResult(false, "Multiple SQL statements are not allowed. Use only a single SELECT statement.");
        }

        // Check for character conversion functions that could be used for obfuscation
        if (sql.Contains("CHAR(", StringComparison.OrdinalIgnoreCase) ||
            sql.Contains("NCHAR(", StringComparison.OrdinalIgnoreCase) ||
            sql.Contains("ASCII(", StringComparison.OrdinalIgnoreCase))
        {
            return new ValidationResult(false, "Character conversion functions are not allowed as they may be used for obfuscation.");
        }

        // Limit query length to prevent potential DoS
        if (sql.Length > 10000)
        {
            return new ValidationResult(false, "Query is too long. Maximum allowed length is 10,000 characters.");
        }

        return new ValidationResult(true, "Query validation passed");
    }

    /// <summary>
    /// Validates a SQL query for update operations (must start with UPDATE and have WHERE clause)
    /// </summary>
    /// <param name="sql">The SQL query to validate</param>
    /// <returns>Validation result</returns>
    public static ValidationResult ValidateUpdateQuery(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            return new ValidationResult(false, "Query must be a non-empty string");
        }

        // Remove comments and normalize whitespace for analysis
        var cleanQuery = RemoveComments(sql)
            .Replace("\t", " ")
            .Replace("\n", " ")
            .Replace("\r", " ")
            .Trim();

        while (cleanQuery.Contains("  "))
        {
            cleanQuery = cleanQuery.Replace("  ", " ");
        }

        if (string.IsNullOrWhiteSpace(cleanQuery))
        {
            return new ValidationResult(false, "Query cannot be empty after removing comments");
        }

        var upperQuery = cleanQuery.ToUpperInvariant();

        // Must start with UPDATE
        if (!upperQuery.StartsWith("UPDATE"))
        {
            return new ValidationResult(false, "Query must start with UPDATE for update operations");
        }

        // Must contain WHERE clause for safety
        if (!upperQuery.Contains(" WHERE "))
        {
            return new ValidationResult(false, "UPDATE queries must include a WHERE clause for security reasons");
        }

        // Check for dangerous keywords (excluding UPDATE and SET since they're expected for UPDATE operations)
        var updateDangerousKeywords = DangerousKeywords.Where(k => k != "UPDATE" && k != "SET").ToArray();
        foreach (var keyword in updateDangerousKeywords)
        {
            var keywordPattern = $@"(^|\s|[^A-Za-z0-9_]){Regex.Escape(keyword)}($|\s|[^A-Za-z0-9_])";
            if (Regex.IsMatch(upperQuery, keywordPattern, RegexOptions.IgnoreCase))
            {
                return new ValidationResult(false, $"Dangerous keyword '{keyword}' detected in query.");
            }
        }

        // Check for multiple statements
        var statements = cleanQuery.Split(';')
            .Where(stmt => !string.IsNullOrWhiteSpace(stmt))
            .ToList();
            
        if (statements.Count > 1)
        {
            return new ValidationResult(false, "Multiple SQL statements are not allowed. Use only a single UPDATE statement.");
        }

        // Limit query length to prevent potential DoS
        if (sql.Length > 10000)
        {
            return new ValidationResult(false, "Query is too long. Maximum allowed length is 10,000 characters.");
        }

        return new ValidationResult(true, "Query validation passed");
    }

    /// <summary>
    /// Removes SQL comments from the query
    /// </summary>
    /// <param name="sql">The SQL query</param>
    /// <returns>SQL query with comments removed</returns>
    private static string RemoveComments(string sql)
    {
        // Remove line comments (-- comment)
        var result = Regex.Replace(sql, @"--.*$", "", RegexOptions.Multiline);
        
        // Remove block comments (/* comment */)
        result = Regex.Replace(result, @"/\*[\s\S]*?\*/", "", RegexOptions.Multiline);
        
        return result;
    }

    /// <summary>
    /// Represents the result of SQL validation
    /// </summary>
    public readonly struct ValidationResult
    {
        public bool IsValid { get; }
        public string Message { get; }

        public ValidationResult(bool isValid, string message)
        {
            IsValid = isValid;
            Message = message;
        }
    }
}