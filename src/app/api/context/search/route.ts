import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

// Define the search request schema
const searchRequestSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  projectId: z.string().optional(),
  entityTypes: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(20),
  minConfidence: z.number().min(0).max(1).default(0.3),
  includeMetadata: z.boolean().default(true),
  includeRelationships: z.boolean().default(false),
  maxRelationshipDepth: z.number().int().min(0).max(3).default(1),
  fuzzyMatch: z.boolean().default(true),
  sortBy: z.enum(['relevance', 'confidence', 'updated', 'created']).default('relevance'),
});

// Define relationship types
interface RelatedEntity {
  id: string;
  name: string;
  entityType: string;
}

interface Relationship {
  id: string;
  type: string;
  direction: 'outgoing' | 'incoming';
  strength: number;
  metadata: Record<string, any>;
  relatedEntity: RelatedEntity;
}

/**
 * @route POST /api/context/search
 * @desc Advanced semantic search through the knowledge graph
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validationResult = searchRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validationResult.error.format(),
      }, { status: 400 });
    }
    
    const {
      query: searchQuery,
      projectId,
      entityTypes,
      maxResults,
      minConfidence,
      includeMetadata,
      includeRelationships,
      maxRelationshipDepth,
      fuzzyMatch,
      sortBy,
    } = validationResult.data;
    
    // Build the SQL query conditions
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Project filter
    if (projectId) {
      conditions.push('e.project_id = ?');
      params.push(projectId);
    }
    
    // Entity type filter
    if (entityTypes && entityTypes.length > 0) {
      conditions.push(`e.entity_type IN (${entityTypes.map(() => '?').join(', ')})`);
      params.push(...entityTypes);
    }
    
    // Confidence filter
    conditions.push('e.confidence >= ?');
    params.push(minConfidence);
    
    // Search text conditions - fuzzy matching with LIKE for different fields
    const searchTerms = searchQuery.split(' ').filter(term => term.length > 1);
    
    // Build search conditions for each term
    const searchConditions: string[] = [];
    
    if (fuzzyMatch) {
      // Add fuzzy matching for each search term
      searchTerms.forEach(term => {
        const fuzzyTerm = `%${term.toLowerCase()}%`;
        
        // Create a group of OR conditions for this term
        const termConditions: string[] = [
          'LOWER(e.name) LIKE ?',
          'LOWER(COALESCE(e.metadata->>"$.description", "")) LIKE ?',
          'LOWER(COALESCE(e.metadata->>"$.content", "")) LIKE ?',
          'LOWER(COALESCE(e.metadata->>"$.filePath", "")) LIKE ?',
          'LOWER(COALESCE(e.metadata->>"$.functionName", "")) LIKE ?',
          'LOWER(COALESCE(e.metadata->>"$.className", "")) LIKE ?',
        ];
        
        // Add the params for each condition
        params.push(...Array(termConditions.length).fill(fuzzyTerm));
        
        // Add the group of conditions for this term
        searchConditions.push(`(${termConditions.join(' OR ')})`);
      });
    } else {
      // Exact matching using FULLTEXT if available or simple equality
      searchConditions.push('LOWER(e.name) = LOWER(?)');
      params.push(searchQuery);
    }
    
    // Combine all search conditions with AND (each term must match somewhere)
    if (searchConditions.length > 0) {
      conditions.push(`(${searchConditions.join(' AND ')})`);
    }
    
    // Build the WHERE clause
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
      
    // Build relevance scoring expression
    let relevanceExpression = `
      CASE 
        WHEN LOWER(e.name) = LOWER(?) THEN 100
        WHEN LOWER(e.name) LIKE ? THEN 80
        WHEN LOWER(COALESCE(e.metadata->>"$.filePath", "")) LIKE ? THEN 70
        WHEN LOWER(COALESCE(e.metadata->>"$.functionName", "")) LIKE ? OR LOWER(COALESCE(e.metadata->>"$.className", "")) LIKE ? THEN 60
        WHEN LOWER(COALESCE(e.metadata->>"$.description", "")) LIKE ? THEN 50
        WHEN LOWER(COALESCE(e.metadata->>"$.content", "")) LIKE ? THEN 40
        ELSE 10
      END * e.confidence
    `;
    
    // Add relevance scoring parameters
    const exactSearchTerm = searchQuery.toLowerCase();
    const fuzzySearchTerm = `%${exactSearchTerm}%`;
    params.push(
      exactSearchTerm,
      fuzzySearchTerm,
      fuzzySearchTerm,
      fuzzySearchTerm, 
      fuzzySearchTerm,
      fuzzySearchTerm,
      fuzzySearchTerm
    );
    
    // Determine sort order based on user preference
    let sortClause = '';
    switch (sortBy) {
      case 'relevance':
        sortClause = 'ORDER BY relevance_score DESC, e.confidence DESC, e.updated_at DESC';
        break;
      case 'confidence':
        sortClause = 'ORDER BY e.confidence DESC, relevance_score DESC, e.updated_at DESC';
        break;
      case 'updated':
        sortClause = 'ORDER BY e.updated_at DESC, relevance_score DESC';
        break;
      case 'created':
        sortClause = 'ORDER BY e.created_at DESC, relevance_score DESC';
        break;
      default:
        sortClause = 'ORDER BY relevance_score DESC';
    }
    
    // Build the complete query
    const sql = `
      SELECT 
        e.id,
        e.name,
        e.entity_type AS entityType,
        e.confidence,
        e.metadata,
        e.project_id AS projectId,
        p.name AS projectName,
        e.source,
        e.created_at AS createdAt,
        e.updated_at AS updatedAt,
        ${relevanceExpression} AS relevance_score,
        (
          SELECT COUNT(*) 
          FROM relationships r 
          WHERE r.from_entity_id = e.id OR r.to_entity_id = e.id
        ) AS connectionCount
      FROM entities e
      JOIN projects p ON e.project_id = p.id
      ${whereClause}
      ${sortClause}
      LIMIT ?
    `;
    
    // Add limit parameter
    params.push(maxResults);
    
    // Execute the query
    const results = await query(sql, params);
    
    // Process the results
    const processedResults = await Promise.all(results.map(async (entity: any) => {
      // Parse metadata if includeMetadata is true
      const metadata = includeMetadata && entity.metadata 
        ? JSON.parse(entity.metadata) 
        : null;
      
      // Base result object
      const processedEntity: {
        id: string;
        name: string;
        entityType: string;
        confidence: number;
        relevanceScore: number;
        projectId: string;
        projectName: string;
        source: string;
        createdAt: string;
        updatedAt: string;
        connectionCount: number;
        metadata?: Record<string, any>;
        relationships?: Relationship[];
      } = {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        relevanceScore: entity.relevance_score,
        projectId: entity.projectId,
        projectName: entity.projectName,
        source: entity.source,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        connectionCount: entity.connectionCount,
        metadata: includeMetadata ? metadata : undefined,
      };
      
      // Fetch relationships if requested
      if (includeRelationships && maxRelationshipDepth > 0) {
        processedEntity.relationships = await getEntityRelationships(entity.id, maxRelationshipDepth);
      }
      
      return processedEntity;
    }));
    
    return NextResponse.json({
      query: searchQuery,
      results: processedResults,
      total: processedResults.length,
      filters: {
        projectId: projectId || 'all',
        entityTypes: entityTypes || 'all',
        minConfidence,
        sortBy,
      }
    });
  } catch (error) {
    console.error('Error searching entities:', error);
    return NextResponse.json(
      { error: 'Failed to search entities', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function getEntityRelationships(entityId: string, depth: number): Promise<Relationship[]> {
  if (depth <= 0) return [];
  
  try {
    // Get all direct relationships for this entity
    const relationshipsSql = `
      SELECT 
        r.id,
        r.relation_type AS relationType,
        r.from_entity_id AS fromEntityId,
        r.to_entity_id AS toEntityId,
        r.strength,
        r.metadata,
        ef.name AS fromEntityName,
        ef.entity_type AS fromEntityType,
        et.name AS toEntityName,
        et.entity_type AS toEntityType
      FROM relationships r
      JOIN entities ef ON r.from_entity_id = ef.id
      JOIN entities et ON r.to_entity_id = et.id
      WHERE r.from_entity_id = ? OR r.to_entity_id = ?
    `;
    
    const relationships = await query(relationshipsSql, [entityId, entityId]);
    
    // Process the relationships
    return relationships.map((rel: any) => {
      // Parse metadata if exists
      const metadata = rel.metadata ? JSON.parse(rel.metadata) : {};
      
      // Determine direction
      const isOutgoing = rel.fromEntityId === entityId;
      
      // Determine the related entity
      const relatedEntity: RelatedEntity = {
        id: isOutgoing ? rel.toEntityId : rel.fromEntityId,
        name: isOutgoing ? rel.toEntityName : rel.fromEntityName,
        entityType: isOutgoing ? rel.toEntityType : rel.fromEntityType
      };
      
      return {
        id: rel.id,
        type: rel.relationType,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        strength: rel.strength,
        metadata,
        relatedEntity
      };
    });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return [];
  }
} 