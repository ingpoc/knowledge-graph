import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * @route GET /api/context/related/{id}
 * @desc Get entities related to the specified entity
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
    const projectId = searchParams.get('projectId');
    const relationTypes = searchParams.get('relationTypes')?.split(',') || [];
    const entityTypes = searchParams.get('entityTypes')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const confidenceThreshold = parseFloat(searchParams.get('confidence') || '0.3');
    const includeSourceEntity = searchParams.get('includeSource') === 'true';
    
    // Build conditions for relationship filtering
    const relationConditions: string[] = [];
    const queryParams: any[] = [];
    
    // Always include the entity ID in params
    queryParams.push(entityId);
    
    // Filter by relation types if specified
    if (relationTypes.length > 0) {
      relationConditions.push(`r.relation_type IN (${relationTypes.map(() => '?').join(',')})`);
      queryParams.push(...relationTypes);
    }
    
    // Filter by project ID if specified
    if (projectId) {
      relationConditions.push(`(e.project_id = ? OR r_entity.project_id = ?)`);
      queryParams.push(projectId, projectId);
    }
    
    // Filter by entity types if specified
    if (entityTypes.length > 0) {
      relationConditions.push(`e.entity_type IN (${entityTypes.map(() => '?').join(',')})`);
      queryParams.push(...entityTypes);
    }
    
    // Filter by confidence
    relationConditions.push('e.confidence >= ?');
    queryParams.push(confidenceThreshold);
    
    // Build the base relationship condition
    let baseCondition = `(r.from_entity_id = ? OR r.to_entity_id = ?)`;
    queryParams.push(entityId); // Add the entity ID again for the OR condition
    
    // Build the final condition string
    const whereClause = `WHERE ${baseCondition} ${
      relationConditions.length > 0 ? 'AND ' + relationConditions.join(' AND ') : ''
    }`;
    
    // Get the related entities
    const sql = `
      WITH related_entities AS (
        SELECT 
          CASE
            WHEN r.from_entity_id = ? THEN r.to_entity_id
            ELSE r.from_entity_id
          END as related_id,
          r.id as relationship_id,
          r.relation_type,
          r.strength,
          CASE
            WHEN r.from_entity_id = ? THEN 'outgoing'
            ELSE 'incoming'
          END as direction
        FROM relationships r
        ${whereClause}
      )
      SELECT 
        e.id,
        e.name,
        e.entity_type as entityType,
        e.confidence,
        e.metadata,
        e.project_id as projectId,
        e.source,
        p.name as projectName,
        re.relationship_id,
        re.relation_type as relationType,
        re.strength,
        re.direction,
        (
          SELECT COUNT(*) 
          FROM relationships r2 
          WHERE r2.from_entity_id = e.id OR r2.to_entity_id = e.id
        ) as connectionCount
      FROM entities e
      JOIN related_entities re ON e.id = re.related_id
      JOIN projects p ON e.project_id = p.id
      ORDER BY e.confidence DESC, connectionCount DESC, e.name
      LIMIT ? OFFSET ?
    `;
    
    // Add the entityId for the WITH clause twice
    queryParams.unshift(entityId, entityId);
    
    // Add limit and offset
    queryParams.push(limit, offset);
    
    const relatedEntities = await query(sql, queryParams);
    
    // Get the source entity if requested
    let sourceEntity = null;
    if (includeSourceEntity) {
      const sourceResults = await query(
        `SELECT 
          e.id,
          e.name,
          e.entity_type as entityType,
          e.confidence,
          e.metadata,
          e.project_id as projectId,
          p.name as projectName,
          (
            SELECT COUNT(*) 
            FROM relationships r 
            WHERE r.from_entity_id = e.id OR r.to_entity_id = e.id
          ) as connectionCount
        FROM entities e
        JOIN projects p ON e.project_id = p.id
        WHERE e.id = ?`,
        [entityId]
      );
      
      if (sourceResults.length > 0) {
        sourceEntity = sourceResults[0];
        
        // Parse metadata
        if (sourceEntity.metadata) {
          sourceEntity.metadata = JSON.parse(sourceEntity.metadata);
        } else {
          sourceEntity.metadata = {};
        }
      }
    }
    
    // Process the results
    const processedEntities = relatedEntities.map((entity: any) => {
      // Parse metadata
      if (entity.metadata) {
        entity.metadata = JSON.parse(entity.metadata);
      } else {
        entity.metadata = {};
      }
      
      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        metadata: entity.metadata,
        projectId: entity.projectId,
        projectName: entity.projectName,
        relationship: {
          id: entity.relationship_id,
          type: entity.relationType,
          strength: entity.strength,
          direction: entity.direction
        },
        connectionCount: entity.connectionCount
      };
    });
    
    // Count the total related entities without limits
    const countSql = `
      WITH related_entities AS (
        SELECT 
          CASE
            WHEN r.from_entity_id = ? THEN r.to_entity_id
            ELSE r.from_entity_id
          END as related_id
        FROM relationships r
        ${whereClause}
      )
      SELECT COUNT(*) as total FROM related_entities
    `;
    
    // Remove limit and offset, but keep the WITH clause parameters
    const countParams = [...queryParams.slice(0, -2)];
    
    const totalResults = await query(countSql, countParams);
    const total = totalResults[0]?.total || 0;
    
    return NextResponse.json({
      sourceEntity,
      relatedEntities: processedEntities,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: {
        projectId: projectId || 'all',
        relationTypes: relationTypes.length > 0 ? relationTypes : 'all',
        entityTypes: entityTypes.length > 0 ? entityTypes : 'all',
        confidenceThreshold
      }
    });
  } catch (error) {
    console.error('Error fetching related entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch related entities', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 