import sql from "mssql";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ExecuteDDLTool implements Tool {
  [key: string]: any;
  name = "execute_ddl";
  description = "Executes DDL (Data Definition Language) operations on an MSSQL Database. Supports CREATE, ALTER, DROP, and TRUNCATE operations with security restrictions.";
  
  inputSchema = {
    type: "object",
    properties: {
      ddl: { 
        type: "string", 
        description: "DDL statement to execute (CREATE, ALTER, DROP, TRUNCATE). Example: CREATE TABLE users (id INT PRIMARY KEY, name NVARCHAR(255))" 
      },
    },
    required: ["ddl"],
  } as any;

  // Allowed DDL keywords
  private static readonly ALLOWED_DDL_KEYWORDS = [
    'CREATE', 'ALTER', 'DROP', 'TRUNCATE'
  ];

  // Allowed DDL object types
  private static readonly ALLOWED_OBJECT_TYPES = [
    'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'CONSTRAINT', 
    'DEFAULT', 'RULE', 'SCHEMA', 'SEQUENCE', 'SYNONYM'
  ];

  // Dangerous keywords that should never be allowed in DDL
  private static readonly DANGEROUS_KEYWORDS = [
    'EXEC', 'EXECUTE', 'INSERT', 'UPDATE', 'DELETE', 'SELECT',
    'MERGE', 'REPLACE', 'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 
    'TRANSACTION', 'BEGIN', 'DECLARE', 'SET', 'USE', 'BACKUP',
    'RESTORE', 'KILL', 'SHUTDOWN', 'WAITFOR', 'OPENROWSET',
    'OPENDATASOURCE', 'OPENQUERY', 'OPENXML', 'BULK', 'DBCC'
  ];

  // Dangerous patterns specific to DDL context
  private static readonly DANGEROUS_PATTERNS = [
    // Semicolon followed by dangerous keywords
    /;\s*(EXEC|EXECUTE|INSERT|UPDATE|DELETE|SELECT|MERGE|GRANT|REVOKE|KILL|SHUTDOWN)/i,
    
    // Stored procedure execution patterns
    /EXEC\s*\(/i,
    /EXECUTE\s*\(/i,
    /sp_/i,
    /xp_/i,
    
    // Dynamic SQL construction in DDL
    /EXEC\s*\(/i,
    /EXECUTE\s*\(/i,
    
    // Bulk operations
    /BULK\s+INSERT/i,
    /OPENROWSET/i,
    /OPENDATASOURCE/i,
    
    // Time delay attacks
    /WAITFOR\s+DELAY/i,
    /WAITFOR\s+TIME/i,
    
    // Multiple statements with non-DDL operations
    /;\s*(INSERT|UPDATE|DELETE|SELECT)/i,
    
    // String concatenation that might hide malicious code
    /\+\s*CHAR\s*\(/i,
    /\+\s*NCHAR\s*\(/i,
    /\+\s*ASCII\s*\(/i,
    
    // System database modifications
    /master\./i,
    /msdb\./i,
    /model\./i,
    /tempdb\./i,
    
    // Dangerous system objects
    /sys\./i,
    /INFORMATION_SCHEMA\./i,
  ];

  /**
   * Validates the DDL statement for security issues
   * @param ddl The DDL statement to validate
   * @returns Validation result with success flag and error message if invalid
   */
  private validateDDL(ddl: string): { isValid: boolean; error?: string } {
    if (!ddl || typeof ddl !== 'string') {
      return { 
        isValid: false, 
        error: 'DDL statement must be a non-empty string' 
      };
    }

    // Remove comments and normalize whitespace for analysis
    const cleanDDL = ddl
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanDDL) {
      return { 
        isValid: false, 
        error: 'DDL statement cannot be empty after removing comments' 
      };
    }

    const upperDDL = cleanDDL.toUpperCase();

    // Must start with allowed DDL keyword
    const startsWithAllowedDDL = this.ALLOWED_DDL_KEYWORDS.some((keyword: string) => 
      upperDDL.startsWith(keyword + ' ')
    );

    if (!startsWithAllowedDDL) {
      return { 
        isValid: false, 
        error: `DDL statement must start with one of: ${this.ALLOWED_DDL_KEYWORDS.join(', ')}` 
      };
    }

    // For CREATE and ALTER, validate object types
    if (upperDDL.startsWith('CREATE ') || upperDDL.startsWith('ALTER ')) {
      const hasAllowedObjectType = this.ALLOWED_OBJECT_TYPES.some((objType: string) => 
        upperDDL.includes(' ' + objType + ' ')
      );
      
      if (!hasAllowedObjectType) {
        return { 
          isValid: false, 
          error: `Object type must be one of: ${this.ALLOWED_OBJECT_TYPES.join(', ')}` 
        };
      }
    }

    // Check for dangerous keywords
    for (const keyword of ExecuteDDLTool.DANGEROUS_KEYWORDS) {
      const keywordRegex = new RegExp(`(^|\\s|[^A-Za-z0-9_])${keyword}($|\\s|[^A-Za-z0-9_])`, 'i');
      if (keywordRegex.test(upperDDL)) {
        return { 
          isValid: false, 
          error: `Dangerous keyword '${keyword}' detected in DDL statement. Only safe DDL operations are allowed.` 
        };
      }
    }

    // Check for dangerous patterns
    for (const pattern of ExecuteDDLTool.DANGEROUS_PATTERNS) {
      if (pattern.test(ddl)) {
        return { 
          isValid: false, 
          error: 'Potentially malicious SQL pattern detected in DDL statement.' 
        };
      }
    }

    // Validate multiple statements - only allow multiple DDL statements
    const statements = cleanDDL.split(';').filter(stmt => stmt.trim().length > 0);
    if (statements.length > 1) {
      // Each statement must be a valid DDL statement
      for (const stmt of statements) {
        const trimmedStmt = stmt.trim().toUpperCase();
        const isValidDDL = this.ALLOWED_DDL_KEYWORDS.some((keyword: string) => 
          trimmedStmt.startsWith(keyword + ' ')
        );
        if (!isValidDDL) {
          return { 
            isValid: false, 
            error: 'All statements in a batch must be valid DDL operations.' 
          };
        }
      }
    }

    // Check for suspicious string patterns
    if (ddl.includes('CHAR(') || ddl.includes('NCHAR(') || ddl.includes('ASCII(')) {
      return { 
        isValid: false, 
        error: 'Character conversion functions are not allowed as they may be used for obfuscation.' 
      };
    }

    // Limit DDL length
    if (ddl.length > 50000) {
      return { 
        isValid: false, 
        error: 'DDL statement is too long. Maximum allowed length is 50,000 characters.' 
      };
    }

    // Prevent operations on system databases
    const systemDbPattern = /(master|msdb|model|tempdb)\./i;
    if (systemDbPattern.test(ddl)) {
      return { 
        isValid: false, 
        error: 'Operations on system databases (master, msdb, model, tempdb) are not allowed.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Executes the validated DDL statement
   * @param params DDL parameters
   * @returns DDL execution result
   */
  async run(params: { ddl: string }) {
    try {
      const { ddl } = params;
      
      // Validate the DDL for security issues
      const validation = this.validateDDL(ddl);
      if (!validation.isValid) {
        console.warn(`Security validation failed for DDL: ${ddl.substring(0, 100)}...`);
        return {
          success: false,
          message: `Security validation failed: ${validation.error}`,
          error: 'SECURITY_VALIDATION_FAILED'
        };
      }

      // Log the DDL for audit purposes
      console.log(`Executing validated DDL statement: ${ddl.substring(0, 200)}${ddl.length > 200 ? '...' : ''}`);

      // Execute the DDL
      const request = new sql.Request();
      const result = await request.query(ddl);
      
      // Determine operation type for appropriate messaging
      const upperDDL = ddl.trim().toUpperCase();
      let operationType = 'DDL operation';
      if (upperDDL.startsWith('CREATE')) operationType = 'CREATE operation';
      else if (upperDDL.startsWith('ALTER')) operationType = 'ALTER operation';
      else if (upperDDL.startsWith('DROP')) operationType = 'DROP operation';
      else if (upperDDL.startsWith('TRUNCATE')) operationType = 'TRUNCATE operation';
      
      return {
        success: true,
        message: `${operationType} executed successfully.`,
        rowsAffected: result.rowsAffected?.[0] || 0,
        operationType: operationType
      };
      
    } catch (error) {
      console.error("Error executing DDL:", error);
      
      // Provide more informative error messages for common DDL issues
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      let safeErrorMessage = 'DDL execution failed';
      if (errorMessage.includes('Invalid object name')) {
        safeErrorMessage = errorMessage;
      } else if (errorMessage.includes('already exists')) {
        safeErrorMessage = 'Object already exists';
      } else if (errorMessage.includes('does not exist')) {
        safeErrorMessage = 'Object does not exist';
      } else if (errorMessage.includes('syntax error')) {
        safeErrorMessage = 'DDL syntax error';
      } else if (errorMessage.includes('permission')) {
        safeErrorMessage = 'Insufficient permissions for DDL operation';
      }
      
      return {
        success: false,
        message: `Failed to execute DDL: ${safeErrorMessage}`,
        error: 'DDL_EXECUTION_FAILED'
      };
    }
  }
}