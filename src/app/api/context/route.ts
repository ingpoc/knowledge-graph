import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

// Define the schema for the context query request
const ContextQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  projectId: z.string().optional(),
  entityTypes: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(10),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * @route POST /api/context
 * @desc Query knowledge graph for contextual information
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = ContextQuerySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { query: searchQuery, projectId, entityTypes, maxResults, confidence } = validation.data;
    
    // Build SQL query conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Add search condition using fuzzy matching
    conditions.push(`(
      e.name LIKE ? 
      OR e.entity_type LIKE ? 
      OR COALESCE(e.metadata->>'description', '') LIKE ?
    )`);
    
    const searchParam = `%${searchQuery}%`;
    params.push(searchParam, searchParam, searchParam);
    
    // Add optional filters
    if (projectId) {
      conditions.push('e.project_id = ?');
      params.push(projectId);
    }
    
    if (entityTypes && entityTypes.length > 0) {
      conditions.push(`e.entity_type IN (${entityTypes.map(() => '?').join(',')})`);
      params.push(...entityTypes);
    }
    
    if (confidence) {
      conditions.push('e.confidence >= ?');
      params.push(confidence);
    }
    
    // Build the final query
    let sql = `
      SELECT 
        e.id,
        e.name,
        e.entity_type as entityType,
        e.confidence,
        e.metadata,
        e.project_id as projectId,
        p.name as projectName,
        (
          SELECT json_group_array(json_object(
            'id', r.id,
            'relationType', r.relation_type,
            'toEntityId', r.to_entity_id,
            'toEntityName', te.name,
            'toEntityType', te.entity_type,
            'strength', r.strength
          ))
          FROM relationships r
          JOIN entities te ON r.to_entity_id = te.id
          WHERE r.from_entity_id = e.id
        ) as outgoingRelationships,
        (
          SELECT json_group_array(json_object(
            'id', r.id,
            'relationType', r.relation_type,
            'fromEntityId', r.from_entity_id,
            'fromEntityName', fe.name,
            'fromEntityType', fe.entity_type,
            'strength', r.strength
          ))
          FROM relationships r
          JOIN entities fe ON r.from_entity_id = fe.id
          WHERE r.to_entity_id = e.id
        ) as incomingRelationships
      FROM entities e
      JOIN projects p ON e.project_id = p.id
    `;
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY e.confidence DESC LIMIT ?';
    params.push(maxResults);
    
    // Execute the query
    const results = await query(sql, params);
    
    // Process results to parse JSON strings and clean up data
    const processedResults = results.map((entity: any) => {
      // Parse metadata JSON if it exists
      const metadata = entity.metadata ? JSON.parse(entity.metadata) : {};
      
      // Parse relationship arrays
      let outgoing = [];
      let incoming = [];
      
      try {
        if (entity.outgoingRelationships && entity.outgoingRelationships !== 'null') {
          outgoing = JSON.parse(entity.outgoingRelationships);
        }
      } catch (e) {
        console.error('Error parsing outgoing relationships:', e);
      }
      
      try {
        if (entity.incomingRelationships && entity.incomingRelationships !== 'null') {
          incoming = JSON.parse(entity.incomingRelationships);
        }
      } catch (e) {
        console.error('Error parsing incoming relationships:', e);
      }
      
      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        metadata,
        projectId: entity.projectId,
        projectName: entity.projectName,
        relationships: {
          outgoing: Array.isArray(outgoing) ? outgoing : [],
          incoming: Array.isArray(incoming) ? incoming : []
        }
      };
    });
    
    return NextResponse.json({
      query: searchQuery,
      results: processedResults,
      total: processedResults.length
    });
  } catch (error) {
    console.error('Error querying context:', error);
    return NextResponse.json(
      { error: 'Failed to query context' },
      { status: 500 }
    );
  }
} 