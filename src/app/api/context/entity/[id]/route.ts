import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * @route GET /api/context/entity/{id}
 * @desc Get entity with its relationships and observations
 * @access Public
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entityId = params.id;
    
    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }
    
    // Extract URL parameters
    const { searchParams } = new URL(request.url);
    const includeObservations = searchParams.get('includeObservations') !== 'false';
    const includeRelationships = searchParams.get('includeRelationships') !== 'false';
    const maxRelationshipDepth = parseInt(searchParams.get('depth') || '1');
    
    // Get the entity details
    const entityResult = await query(
      `SELECT 
        e.id,
        e.name,
        e.entity_type as entityType,
        e.confidence,
        e.metadata,
        e.project_id as projectId,
        e.source,
        e.created_at as createdAt,
        e.updated_at as updatedAt,
        p.name as projectName
      FROM entities e
      JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?`,
      [entityId]
    );
    
    if (!entityResult.length) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }
    
    const entity = entityResult[0];
    
    // Parse entity metadata
    if (entity.metadata) {
      entity.metadata = JSON.parse(entity.metadata);
    } else {
      entity.metadata = {};
    }
    
    // Add observations if requested
    if (includeObservations) {
      const observations = await query(
        `SELECT 
          id,
          content,
          confidence,
          version,
          is_valid as isValid,
          created_at as createdAt,
          updated_at as updatedAt,
          source
        FROM observations
        WHERE entity_id = ?
        ORDER BY version DESC, confidence DESC, updated_at DESC`,
        [entityId]
      );
      
      entity.observations = observations;
    }
    
    // Add relationships if requested
    if (includeRelationships) {
      // Get outgoing relationships
      const outgoingRelationships = await fetchRelationships(entityId, 'outgoing', maxRelationshipDepth);
      entity.outgoingRelationships = outgoingRelationships;
      
      // Get incoming relationships
      const incomingRelationships = await fetchRelationships(entityId, 'incoming', maxRelationshipDepth);
      entity.incomingRelationships = incomingRelationships;
    }
    
    return NextResponse.json({
      entity,
      metadata: {
        includeObservations,
        includeRelationships,
        maxRelationshipDepth
      }
    });
  } catch (error) {
    console.error('Error fetching entity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Recursively fetch relationships up to a specified depth
 */
async function fetchRelationships(
  entityId: string,
  direction: 'outgoing' | 'incoming',
  maxDepth: number,
  currentDepth: number = 0,
  visitedIds: Set<string> = new Set()
): Promise<any[]> {
  // Avoid circular references and respect max depth
  if (currentDepth >= maxDepth || visitedIds.has(entityId)) {
    return [];
  }
  
  visitedIds.add(entityId);
  
  try {
    let sql, params;
    
    if (direction === 'outgoing') {
      sql = `
        SELECT 
          r.id,
          r.relation_type as relationType,
          r.strength,
          r.metadata,
          r.to_entity_id as targetEntityId,
          e.name as targetEntityName,
          e.entity_type as targetEntityType,
          e.confidence as targetConfidence,
          p.name as targetProjectName
        FROM relationships r
        JOIN entities e ON r.to_entity_id = e.id
        JOIN projects p ON e.project_id = p.id
        WHERE r.from_entity_id = ?
      `;
    } else {
      sql = `
        SELECT 
          r.id,
          r.relation_type as relationType,
          r.strength,
          r.metadata,
          r.from_entity_id as sourceEntityId,
          e.name as sourceEntityName,
          e.entity_type as sourceEntityType,
          e.confidence as sourceConfidence,
          p.name as sourceProjectName
        FROM relationships r
        JOIN entities e ON r.from_entity_id = e.id
        JOIN projects p ON e.project_id = p.id
        WHERE r.to_entity_id = ?
      `;
    }
    
    params = [entityId];
    
    const relationships = await query(sql, params);
    
    // Process the results
    const processedRelationships = await Promise.all(relationships.map(async (rel: any) => {
      // Parse metadata
      if (rel.metadata) {
        rel.metadata = JSON.parse(rel.metadata);
      } else {
        rel.metadata = {};
      }
      
      // Recursively fetch more relationships if we're not at max depth
      if (currentDepth < maxDepth - 1) {
        const nextEntityId = direction === 'outgoing' ? rel.targetEntityId : rel.sourceEntityId;
        
        if (!visitedIds.has(nextEntityId)) {
          const nextDepthRelationships = await fetchRelationships(
            nextEntityId,
            direction,
            maxDepth,
            currentDepth + 1,
            visitedIds
          );
          
          if (direction === 'outgoing') {
            rel.targetRelationships = nextDepthRelationships;
          } else {
            rel.sourceRelationships = nextDepthRelationships;
          }
        }
      }
      
      return rel;
    }));
    
    return processedRelationships;
  } catch (error) {
    console.error(`Error fetching ${direction} relationships:`, error);
    return [];
  }
} 