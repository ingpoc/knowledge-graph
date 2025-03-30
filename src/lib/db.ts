import fs from 'fs';
import path from 'path';

let db: any;
let duckdb: any;

try {
  // Dynamic import for duckdb to avoid server-side bundling issues
  if (typeof window === 'undefined') {
    duckdb = require('duckdb');
    
    // Define the database file path
    const DB_PATH = path.join(process.cwd(), 'data', 'knowledge-graph.db');
    
    // Ensure the data directory exists
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    
    // Create a database connection
    db = new duckdb.Database(DB_PATH);
    console.log('DuckDB initialized successfully');
  }
} catch (error) {
  console.error('Error initializing DuckDB:', error);
  // Provide fallback or handle error scenario
}

// Setup promise-based query execution
export function query(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    // Replace ? placeholders with actual values to avoid parameterization issues
    let processedSql = sql;
    if (params.length > 0) {
      params.forEach((param, index) => {
        let replacement = typeof param === 'string' ? `'${param}'` : param;
        if (param === null) replacement = 'NULL';
        if (typeof param === 'object' && !(param instanceof Date)) {
          replacement = `'${JSON.stringify(param)}'`;
        }
        if (param instanceof Date) {
          replacement = `'${param.toISOString()}'`;
        }
        
        // Replace the first occurrence of ? with the parameter value
        processedSql = processedSql.replace('?', String(replacement));
      });
    }
    
    // Execute the processed SQL query
    db.all(processedSql, (err: Error, rows: any[]) => {
      if (err) {
        console.error('SQL Error:', processedSql, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Initialize schema if it doesn't exist
export async function initializeSchema() {
  try {
    if (!db) {
      console.warn('Database not initialized, skipping schema creation');
      return;
    }
    
    // Create projects table
    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        metadata JSON,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `);

    // Create entities table
    await query(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        project_id TEXT NOT NULL,
        metadata JSON,
        confidence FLOAT NOT NULL DEFAULT 0.5,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        source TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Create relationships table
    await query(`
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        strength FLOAT NOT NULL DEFAULT 0.5,
        metadata JSON,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        source TEXT,
        FOREIGN KEY (from_entity_id) REFERENCES entities(id),
        FOREIGN KEY (to_entity_id) REFERENCES entities(id)
      )
    `);

    // Create observations table
    await query(`
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence FLOAT NOT NULL DEFAULT 0.5,
        version INTEGER NOT NULL DEFAULT 1,
        is_valid BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        source TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      )
    `);

    // Insert a sample project to get started
    const existingProjects = await query(`SELECT COUNT(*) as count FROM projects`);
    if (existingProjects[0].count === 0) {
      await query(`
        INSERT INTO projects (id, name, description, metadata, created_at, updated_at)
        VALUES ('default', 'Default Project', 'The default knowledge graph project', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      console.log('Created default project');
    }

    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
}

// Initialize the database on module load, only on server side
if (typeof window === 'undefined' && db) {
  initializeSchema().catch(console.error);
}

export default db; 