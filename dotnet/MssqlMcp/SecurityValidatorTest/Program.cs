using Mssql.McpServer;

Console.WriteLine("Testing SQL Security Validator");
Console.WriteLine("============================\n");

// Test valid SELECT queries
TestValidQueries();

// Test invalid/malicious queries
TestMaliciousQueries();

// Test UPDATE queries
TestUpdateQueries();

Console.WriteLine("\n✅ Security Validator Tests Completed!");

static void TestValidQueries()
{
    Console.WriteLine("🟢 Testing VALID SELECT Queries:");
    
    var validQueries = new[]
    {
        "SELECT * FROM users",
        "SELECT name, email FROM customers WHERE id = 1",
        "SELECT COUNT(*) FROM orders WHERE date > '2023-01-01'",
        "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id"
    };

    foreach (var query in validQueries)
    {
        var result = SqlSecurityValidator.ValidateReadQuery(query);
        Console.WriteLine($"   Query: {query}");
        Console.WriteLine($"   Result: {(result.IsValid ? "✅ Valid" : "❌ Invalid: " + result.Message)}\n");
    }
}

static void TestMaliciousQueries()
{
    Console.WriteLine("🔴 Testing MALICIOUS/INVALID Queries:");
    
    var maliciousQueries = new[]
    {
        "DROP TABLE users",
        "SELECT * FROM users; DROP TABLE customers;",
        "DELETE FROM users WHERE id = 1",
        "SELECT * FROM users UNION SELECT * FROM passwords",
        "INSERT INTO users VALUES ('hacker', 'password')",
        "EXEC sp_helpdb",
        "SELECT * FROM users WHERE name = 'test' + CHAR(59) + 'DROP TABLE users'",
        "UPDATE users SET password = 'hacked'",
        "/* comment */ SELECT * FROM users; DELETE FROM logs; -- end",
        "BULK INSERT users FROM 'C:\\temp\\data.csv'"
    };

    foreach (var query in maliciousQueries)
    {
        var result = SqlSecurityValidator.ValidateReadQuery(query);
        Console.WriteLine($"   Query: {query}");
        Console.WriteLine($"   Result: {(result.IsValid ? "❌ SECURITY ISSUE - Should be blocked!" : "✅ Correctly blocked: " + result.Message)}\n");
    }
}

static void TestUpdateQueries()
{
    Console.WriteLine("🟡 Testing UPDATE Query Validation:");
    
    var updateQueries = new[]
    {
        ("UPDATE users SET name = 'John' WHERE id = 1", true), // Valid - has WHERE
        ("UPDATE users SET name = 'John'", false), // Invalid - no WHERE
        ("DELETE FROM users WHERE id = 1", false), // Invalid - not UPDATE
        ("UPDATE users SET name = 'John' WHERE id = 1; DROP TABLE logs;", false) // Invalid - multiple statements
    };

    foreach (var (query, shouldBeValid) in updateQueries)
    {
        var result = SqlSecurityValidator.ValidateUpdateQuery(query);
        var expected = shouldBeValid ? "Valid" : "Invalid";
        var actual = result.IsValid ? "Valid" : "Invalid";
        var status = (expected == actual) ? "✅" : "❌";
        
        Console.WriteLine($"   Query: {query}");
        Console.WriteLine($"   Expected: {expected}, Got: {actual} {status}");
        if (!result.IsValid)
            Console.WriteLine($"   Reason: {result.Message}");
        Console.WriteLine();
    }
}
