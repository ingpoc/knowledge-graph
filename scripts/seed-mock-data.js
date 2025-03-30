const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const duckdb = require('duckdb');

// Create the data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Path to database file
const dbFilePath = path.join(dataDir, 'knowledge-graph.db');
const backupFilePath = path.join(dataDir, 'knowledge-graph-backup.db');

// Make a backup of the existing database if it exists
if (fs.existsSync(dbFilePath)) {
  try {
    fs.copyFileSync(dbFilePath, backupFilePath);
    console.log(`Backed up existing database to ${backupFilePath}`);
  } catch (err) {
    console.warn(`Warning: Could not backup database: ${err.message}`);
  }
}

// Attempt to remove any lock files
try {
  const lockFile = `${dbFilePath}.tmp`;
  if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
} catch (err) {
  console.warn(`Warning: Could not clean up lock files: ${err.message}`);
}

// Connect to the database with a timeout
let db = null;
let connection = null;

function connectToDatabase(maxRetries = 5, retryDelay = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    function tryConnect() {
      if (db) {
        try {
          if (connection) connection.close();
          db.close();
        } catch (e) {
          console.log('Previous database connection could not be closed:', e.message);
        }
      }
      
      console.log(`Attempting database connection (attempt ${retries + 1}/${maxRetries})...`);
      
      try {
        db = new duckdb.Database(dbFilePath);
        connection = new duckdb.Connection(db);
        console.log('DuckDB connection established successfully');
        resolve({ db, connection });
      } catch (err) {
        retries++;
        if (retries < maxRetries) {
          console.log(`Connection failed: ${err.message}, retrying in ${retryDelay}ms...`);
          setTimeout(tryConnect, retryDelay);
        } else {
          reject(new Error(`Could not connect to database after ${maxRetries} attempts: ${err.message}`));
        }
      }
    }
    
    tryConnect();
  });
}

// Execute a query with promise wrapper and retry logic
function runQuery(sql, params = [], maxRetries = 3, retryDelay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attempt() {
      attempts++;
      
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
      
      connection.all(processedSql, (err, rows) => {
        if (err) {
          console.error(`SQL Error (attempt ${attempts}/${maxRetries}):`, err.message);
          console.error('SQL Statement:', processedSql);
          
          if (attempts < maxRetries) {
            console.log(`Query failed, retrying in ${retryDelay}ms...`);
            setTimeout(attempt, retryDelay * attempts); // Increasing backoff
          } else {
            reject(err);
          }
        } else {
          resolve(rows || []);
        }
      });
    }
    
    attempt();
  });
}

// Execute a query to get data with retry logic
function getQuery(sql, params = [], maxRetries = 3, retryDelay = 500) {
  return runQuery(sql, params, maxRetries, retryDelay).then(rows => rows[0]);
}

// Run multiple SQL statements
async function runQueries(sqlStatements) {
  for (const sql of sqlStatements) {
    try {
      await runQuery(sql);
    } catch (error) {
      console.error('Error running SQL statement:', error.message);
      // Continue with other statements
    }
  }
}

// Initialize schema
async function initializeSchema() {
  console.log('Initializing database schema...');
  
  const createStatements = [
    // Create projects table
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      metadata JSON,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Create entities table
    `CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      project_id TEXT NOT NULL,
      metadata JSON,
      confidence FLOAT NOT NULL DEFAULT 0.5,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )`,
    
    // Create relationships table
    `CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_entity_id TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      strength FLOAT NOT NULL DEFAULT 0.5,
      metadata JSON,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      FOREIGN KEY (from_entity_id) REFERENCES entities(id),
      FOREIGN KEY (to_entity_id) REFERENCES entities(id)
    )`,
    
    // Create observations table
    `CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence FLOAT NOT NULL DEFAULT 0.5,
      version INTEGER NOT NULL DEFAULT 1,
      is_valid BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id)
    )`
  ];
  
  await runQueries(createStatements);
  console.log('Schema initialized');
}

// Clear existing data
async function clearExistingData() {
  console.log('Clearing existing data...');
  
  const deleteStatements = [
    `DELETE FROM observations`,
    `DELETE FROM relationships`,
    `DELETE FROM entities`,
    `DELETE FROM projects WHERE id != 'default'`
  ];
  
  await runQueries(deleteStatements);
  console.log('Existing data cleared');
  
  // Check if default project exists
  try {
    const row = await getQuery(`SELECT COUNT(*) as count FROM projects WHERE id = 'default'`);
    
    if (!row || row.count === 0) {
      await runQuery(
        `INSERT INTO projects (id, name, description, metadata) 
         VALUES ('default', 'Default Project', 'Default knowledge graph project', '{}')`
      );
      console.log('Default project created');
    }
  } catch (err) {
    console.error('Error checking for default project:', err.message);
    // Create default project anyway
    try {
      await runQuery(
        `INSERT OR IGNORE INTO projects (id, name, description, metadata) 
         VALUES ('default', 'Default Project', 'Default knowledge graph project', '{}')`
      );
      console.log('Attempted to create default project with INSERT OR IGNORE');
    } catch (insertErr) {
      console.error('Error creating default project:', insertErr.message);
    }
  }
}

// Create projects
async function createProjects() {
  console.log('Creating projects...');
  
  const projects = [
    {
      id: 'knowledge-graph',
      name: 'Knowledge Graph',
      description: 'A knowledge graph for code understanding',
      metadata: JSON.stringify({ 
        technologies: ['Next.js', 'TypeScript', 'DuckDB'], 
        domain: 'Developer Tools' 
      })
    },
    {
      id: 'recipe-app',
      name: 'Recipe Application',
      description: 'A recipe management application with AI features',
      metadata: JSON.stringify({ 
        technologies: ['React', 'Node.js', 'MongoDB'], 
        domain: 'Food' 
      })
    },
    {
      id: 'financial-dashboard',
      name: 'Financial Dashboard',
      description: 'Real-time financial analytics dashboard',
      metadata: JSON.stringify({ 
        technologies: ['Vue.js', 'Express', 'PostgreSQL'], 
        domain: 'Finance' 
      })
    }
  ];
  
  for (const project of projects) {
    await runQuery(
      `INSERT INTO projects (id, name, description, metadata) 
       VALUES (?, ?, ?, ?)`,
      [project.id, project.name, project.description, project.metadata]
    );
  }
  
  console.log(`Created ${projects.length} projects`);
}

// Create entities
async function createEntities() {
  console.log('Creating entities...');
  
  // Generate IDs for entities to use in relationships
  const ids = {
    fetchEntityRelationships: uuidv4(),
    contextQueryForm: uuidv4(),
    similarityRoute: uuidv4(),
    searchRequestSchema: uuidv4(),
    knowledgeGraphComponents: uuidv4(),
    recipeController: uuidv4(),
    recipeSchema: uuidv4(),
    chartComponent: uuidv4(),
    calculateMetrics: uuidv4()
  };
  
  // Knowledge Graph project entities
  const knowledgeGraphEntities = [
    {
      id: ids.fetchEntityRelationships,
      name: 'fetchEntityRelationships',
      entityType: 'function',
      projectId: 'knowledge-graph',
      metadata: JSON.stringify({
        filePath: 'src/app/api/context/entity/[id]/route.ts',
        functionName: 'fetchRelationships',
        description: 'Recursively fetches relationships for an entity up to a specified depth',
        parameters: ['entityId', 'direction', 'maxDepth', 'currentDepth', 'visitedIds'],
        returns: 'Promise<any[]>'
      }),
      confidence: 0.95,
      source: 'code-parser'
    },
    {
      id: ids.contextQueryForm,
      name: 'ContextQueryForm',
      entityType: 'class',
      projectId: 'knowledge-graph',
      metadata: JSON.stringify({
        filePath: 'src/components/context-query-form.tsx',
        className: 'ContextQueryForm',
        description: 'React component for querying the knowledge graph',
        props: ['projects', 'onSearch', 'isLoading', 'defaultQuery', 'defaultProjectId']
      }),
      confidence: 0.92,
      source: 'code-parser'
    },
    {
      id: ids.similarityRoute,
      name: 'similarity-route',
      entityType: 'file',
      projectId: 'knowledge-graph',
      metadata: JSON.stringify({
        filePath: 'src/app/api/context/similarity/route.ts',
        description: 'API endpoint for finding similar entities in the knowledge graph',
        imports: ['NextRequest', 'NextResponse', 'z', 'query']
      }),
      confidence: 0.98,
      source: 'file-system'
    },
    {
      id: ids.searchRequestSchema,
      name: 'searchRequestSchema',
      entityType: 'variable',
      projectId: 'knowledge-graph',
      metadata: JSON.stringify({
        filePath: 'src/app/api/context/search/route.ts',
        variableName: 'searchRequestSchema',
        variableType: 'z.ZodObject',
        description: 'Zod schema for validating search API requests'
      }),
      confidence: 0.89,
      source: 'code-parser'
    },
    {
      id: ids.knowledgeGraphComponents,
      name: 'Knowledge Graph Components',
      entityType: 'concept',
      projectId: 'knowledge-graph',
      metadata: JSON.stringify({
        description: 'Collection of UI components for interacting with the knowledge graph',
        relatedFiles: ['context-query-form.tsx', 'entity-card.tsx', 'relationship-viewer.tsx']
      }),
      confidence: 0.75,
      source: 'llm-extraction'
    }
  ];

  // Recipe App entities
  const recipeAppEntities = [
    {
      id: ids.recipeController,
      name: 'RecipeController',
      entityType: 'class',
      projectId: 'recipe-app',
      metadata: JSON.stringify({
        filePath: 'controllers/RecipeController.js',
        className: 'RecipeController',
        description: 'Controller for recipe CRUD operations',
        methods: ['getAll', 'getById', 'create', 'update', 'delete']
      }),
      confidence: 0.91,
      source: 'code-parser'
    },
    {
      id: ids.recipeSchema,
      name: 'recipeSchema',
      entityType: 'variable',
      projectId: 'recipe-app',
      metadata: JSON.stringify({
        filePath: 'models/Recipe.js',
        variableName: 'recipeSchema',
        variableType: 'mongoose.Schema',
        description: 'Mongoose schema for recipe documents'
      }),
      confidence: 0.94,
      source: 'code-parser'
    }
  ];

  // Financial Dashboard entities
  const financialDashboardEntities = [
    {
      id: ids.chartComponent,
      name: 'ChartComponent',
      entityType: 'class',
      projectId: 'financial-dashboard',
      metadata: JSON.stringify({
        filePath: 'src/components/ChartComponent.vue',
        className: 'ChartComponent',
        description: 'Vue component for rendering financial charts',
        props: ['data', 'type', 'options']
      }),
      confidence: 0.87,
      source: 'code-parser'
    },
    {
      id: ids.calculateMetrics,
      name: 'calculateMetrics',
      entityType: 'function',
      projectId: 'financial-dashboard',
      metadata: JSON.stringify({
        filePath: 'src/utils/metrics.js',
        functionName: 'calculateMetrics',
        description: 'Calculates financial metrics from raw data',
        parameters: ['data', 'options'],
        returns: 'Object'
      }),
      confidence: 0.93,
      source: 'code-parser'
    }
  ];

  // Combine all entities
  const allEntities = [
    ...knowledgeGraphEntities,
    ...recipeAppEntities,
    ...financialDashboardEntities
  ];

  for (const entity of allEntities) {
    await runQuery(
      `INSERT INTO entities (
        id, name, entity_type, project_id, metadata, confidence, 
        created_at, updated_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [
        entity.id,
        entity.name,
        entity.entityType,
        entity.projectId,
        entity.metadata,
        entity.confidence,
        entity.source
      ]
    );
  }

  console.log(`Created ${allEntities.length} entities`);
  
  return ids;
}

// Create relationships
async function createRelationships(ids) {
  console.log('Creating relationships...');
  
  const relationships = [
    // File contains function relationship
    {
      id: uuidv4(),
      fromEntityId: ids.similarityRoute,
      toEntityId: ids.fetchEntityRelationships,
      relationType: 'contains',
      strength: 0.9,
      metadata: JSON.stringify({
        description: 'File contains the function definition',
        lineStart: 125,
        lineEnd: 157
      })
    },
    
    // Concept includes component relationship
    {
      id: uuidv4(),
      fromEntityId: ids.knowledgeGraphComponents,
      toEntityId: ids.contextQueryForm,
      relationType: 'includes',
      strength: 0.85,
      metadata: JSON.stringify({
        description: 'Concept includes this component as part of the UI toolkit'
      })
    },
    
    // Component uses schema relationship
    {
      id: uuidv4(),
      fromEntityId: ids.contextQueryForm,
      toEntityId: ids.searchRequestSchema,
      relationType: 'uses',
      strength: 0.8,
      metadata: JSON.stringify({
        description: 'Component uses the schema for form validation'
      })
    },
    
    // Recipe app relationship
    {
      id: uuidv4(),
      fromEntityId: ids.recipeController,
      toEntityId: ids.recipeSchema,
      relationType: 'depends_on',
      strength: 0.92,
      metadata: JSON.stringify({
        description: 'Controller depends on the schema for data validation'
      })
    },
    
    // Financial dashboard relationship
    {
      id: uuidv4(),
      fromEntityId: ids.chartComponent,
      toEntityId: ids.calculateMetrics,
      relationType: 'calls',
      strength: 0.88,
      metadata: JSON.stringify({
        description: 'Chart component calls the calculation function'
      })
    },
    
    // Cross-project relationship
    {
      id: uuidv4(),
      fromEntityId: ids.fetchEntityRelationships,
      toEntityId: ids.chartComponent,
      relationType: 'similar_pattern',
      strength: 0.65,
      metadata: JSON.stringify({
        description: 'These components demonstrate similar design patterns',
        patternType: 'recursive processing'
      })
    }
  ];
  
  for (const relationship of relationships) {
    await runQuery(
      `INSERT INTO relationships (
        id, from_entity_id, to_entity_id, relation_type, strength, 
        metadata, created_at, updated_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'mock-data')`,
      [
        relationship.id,
        relationship.fromEntityId,
        relationship.toEntityId,
        relationship.relationType,
        relationship.strength,
        relationship.metadata
      ]
    );
  }
  
  console.log(`Created ${relationships.length} relationships`);
}

// Create observations
async function createObservations(ids) {
  console.log('Creating observations...');
  
  const observations = [
    // Knowledge Graph function observations
    {
      id: uuidv4(),
      entityId: ids.fetchEntityRelationships,
      content: 'The function fetchRelationships uses recursion to traverse the knowledge graph and collect relationships up to a maximum depth. It includes cycle detection to prevent infinite recursion.',
      confidence: 0.94,
      version: 1,
      isValid: 1,
      source: 'code-analysis'
    },
    {
      id: uuidv4(),
      entityId: ids.fetchEntityRelationships,
      content: 'This function could be optimized by using a queue-based traversal algorithm instead of recursion for very deep graphs to avoid potential stack overflow issues.',
      confidence: 0.78,
      version: 1,
      isValid: 1,
      source: 'llm-suggestion'
    },
    
    // Knowledge Graph component observations
    {
      id: uuidv4(),
      entityId: ids.contextQueryForm,
      content: 'The ContextQueryForm component implements a tabbed interface with three search modes: basic, advanced, and semantic search. It uses React hooks for state management.',
      confidence: 0.91,
      version: 1,
      isValid: 1,
      source: 'code-analysis'
    },
    
    // Knowledge Graph file observations
    {
      id: uuidv4(),
      entityId: ids.similarityRoute,
      content: 'This file implements a RESTful API endpoint for finding similar entities based on graph connections. It uses Zod for request validation and implements advanced similarity scoring.',
      confidence: 0.96,
      version: 1,
      isValid: 1,
      source: 'code-analysis'
    },
    
    // Recipe app controller observations
    {
      id: uuidv4(),
      entityId: ids.recipeController,
      content: 'This controller implements standard CRUD operations with proper error handling and validation. It follows RESTful principles and includes authentication checks.',
      confidence: 0.89,
      version: 1,
      isValid: 1,
      source: 'code-review'
    },
    
    // Financial dashboard component observations
    {
      id: uuidv4(),
      entityId: ids.chartComponent,
      content: 'The chart component supports multiple visualization types including line, bar, and pie charts. It implements responsive design and accessibility features.',
      confidence: 0.85,
      version: 1,
      isValid: 1,
      source: 'documentation'
    }
  ];
  
  for (const observation of observations) {
    await runQuery(
      `INSERT INTO observations (
        id, entity_id, content, confidence, version, is_valid,
        created_at, updated_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [
        observation.id,
        observation.entityId,
        observation.content,
        observation.confidence,
        observation.version,
        observation.isValid,
        observation.source
      ]
    );
  }
  
  console.log(`Created ${observations.length} observations`);
}

// Cleanup function to ensure DB connection is properly closed
function cleanup() {
  if (connection) {
    console.log('Closing database connection...');
    try {
      connection.close();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error closing connection:', err.message);
    }
  }
  
  if (db) {
    console.log('Closing database...');
    try {
      db.close();
      console.log('Database closed');
    } catch (err) {
      console.error('Error closing database:', err.message);
    }
  }
}

// Handle process termination
process.on('exit', cleanup);
process.on('SIGINT', () => {
  console.log('Process interrupted');
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Process terminated');
  cleanup();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanup();
  process.exit(1);
});

// Main execution
async function seed() {
  try {
    // Delete the existing database if it's locked
    if (process.argv.includes('--force')) {
      console.log('Force flag detected, attempting to delete existing database...');
      try {
        if (fs.existsSync(dbFilePath)) {
          fs.unlinkSync(dbFilePath);
          console.log('Existing database deleted');
        }
      } catch (err) {
        console.error('Could not delete database file:', err.message);
      }
    }
    
    await connectToDatabase();
    
    // Execute in a transaction for atomicity
    await runQuery('BEGIN TRANSACTION');
    
    try {
      await initializeSchema();
      await clearExistingData();
      await createProjects();
      const entityIds = await createEntities();
      await createRelationships(entityIds);
      await createObservations(entityIds);
      
      await runQuery('COMMIT');
      console.log('Seed completed successfully!');
    } catch (err) {
      console.error('Error during seeding, rolling back transaction:', err.message);
      await runQuery('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Fatal error seeding database:', error.message);
    console.log('Try running with --force flag to delete the database and start fresh');
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Run the seed function
seed(); 