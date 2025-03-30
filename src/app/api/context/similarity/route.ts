import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

// Define the similarity request schema
const similarityRequestSchema = z.object({
  entityIds: z.array(z.string()).min(1, "At least one entity ID is required"),
  projectId: z.string().optional(),
  entityTypes: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(20),
  minConfidence: z.number().min(0).max(1).default(0.3),
  includeMetadata: z.boolean().default(true),
  relationshipWeight: z.number().min(0).max(1).default(0.7),
  attributeWeight: z.number().min(0).max(1).default(0.3),
});

/**
 * @route POST /api/context/similarity
 * @desc Find similar entities based on graph connections and attributes
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validationResult = similarityRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: validationResult.error.format(),
      }, { status: 400 });
    }
    
    const {
      entityIds,
      projectId,
      entityTypes,
      maxResults,
      minConfidence,
      includeMetadata,
      relationshipWeight,
      attributeWeight,
    } = validationResult.data;
    
    // Check if any of the entity IDs exist
    const entityCheckSql = `
      SELECT COUNT(*) as count 
      FROM entities 
      WHERE id IN (${entityIds.map(() => '?').join(',')})
    `;
    
    const entityCheckResult = await query(entityCheckSql, entityIds);
    const entityCount = entityCheckResult[0]?.count || 0;
    
    if (entityCount === 0) {
      return NextResponse.json({ 
        error: 'None of the provided entities exist',
      }, { status: 404 });
    }
    
    // Build the SQL query conditions
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Don't include the source entities in results
    conditions.push(`e.id NOT IN (${entityIds.map(() => '?').join(',')})`);
    params.push(...entityIds);
    
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
    
    // Build the WHERE clause
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // Two-part similarity score:
    // 1. Graph-based similarity: entities that share relationships with the same entities as our sources
    // 2. Attribute-based similarity: entities with similar metadata attributes
    
    // First get the relationships of our source entities
    const sourceRelationsSql = `
      WITH source_relations AS (
        SELECT 
          CASE
            WHEN r.from_entity_id IN (${entityIds.map(() => '?').join(',')}) THEN r.to_entity_id
            ELSE r.from_entity_id
          END as related_id,
          r.relation_type,
          COUNT(*) as weight
        FROM relationships r
        WHERE r.from_entity_id IN (${entityIds.map(() => '?').join(',')})
           OR r.to_entity_id IN (${entityIds.map(() => '?').join(',')})
        GROUP BY related_id, r.relation_type
      )
      SELECT * FROM source_relations
      WHERE related_id NOT IN (${entityIds.map(() => '?').join(',')})
    `;
    
    // Add params for the source relations query (4 times because we reference the entityIds array 4 times)
    const sourceRelationsParams = [...entityIds, ...entityIds, ...entityIds, ...entityIds];
    const sourceRelations = await query(sourceRelationsSql, sourceRelationsParams);
    
    // Extract the related entity IDs
    const relatedIds = [...new Set(sourceRelations.map((rel: any) => rel.related_id))];
    
    if (relatedIds.length === 0) {
      return NextResponse.json({
        similarEntities: [],
        total: 0,
        message: 'No connected entities found for similarity calculation',
      });
    }
    
    // Now find other entities that share these same relationships
    const similaritySql = `
      WITH 
        -- Get relationships of potential similar entities
        target_relations AS (
          SELECT 
            CASE
              WHEN r.from_entity_id IN (${relatedIds.map(() => '?').join(',')}) THEN r.to_entity_id
              ELSE r.from_entity_id
            END as entity_id,
            r.relation_type,
            COUNT(*) as connection_strength
          FROM relationships r
          WHERE (r.from_entity_id IN (${relatedIds.map(() => '?').join(',')}) 
             OR r.to_entity_id IN (${relatedIds.map(() => '?').join(',')}))
            AND r.from_entity_id NOT IN (${entityIds.map(() => '?').join(',')})
            AND r.to_entity_id NOT IN (${entityIds.map(() => '?').join(',')})
          GROUP BY entity_id, r.relation_type
        ),
        -- Calculate similarity scores
        similarity_scores AS (
          SELECT 
            tr.entity_id,
            SUM(tr.connection_strength) as connection_score,
            COUNT(DISTINCT tr.relation_type) as relation_diversity
          FROM target_relations tr
          GROUP BY tr.entity_id
        )
      SELECT 
        e.id,
        e.name,
        e.entity_type AS entityType,
        e.confidence,
        e.metadata,
        e.project_id AS projectId,
        p.name AS projectName,
        e.created_at AS createdAt,
        e.updated_at AS updatedAt,
        ss.connection_score,
        ss.relation_diversity,
        (
          SELECT COUNT(*) 
          FROM relationships r 
          WHERE r.from_entity_id = e.id OR r.to_entity_id = e.id
        ) AS connectionCount,
        (ss.connection_score * ss.relation_diversity * ?) AS similarityScore
      FROM entities e
      JOIN similarity_scores ss ON e.id = ss.entity_id
      JOIN projects p ON e.project_id = p.id
      ${whereClause}
      ORDER BY similarityScore DESC, e.confidence DESC
      LIMIT ?
    `;
    
    // Add parameters for the similarity query
    // First add all relatedIds 3 times for the subqueries
    const similarityParams = [
      ...relatedIds, ...relatedIds, ...relatedIds,
      ...entityIds, ...entityIds, // For the NOT IN conditions
      relationshipWeight, // For the similarity score calculation
      ...params, // For the WHERE clause conditions
      maxResults // For the LIMIT
    ];
    
    // Execute the similarity query
    const results = await query(similaritySql, similarityParams);
    
    // Process the results
    const processedResults = results.map((entity: any) => {
      // Parse metadata if includeMetadata is true
      const metadata = includeMetadata && entity.metadata 
        ? JSON.parse(entity.metadata) 
        : null;
      
      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        similarityScore: entity.similarityScore,
        connectionScore: entity.connection_score,
        relationDiversity: entity.relation_diversity,
        projectId: entity.projectId,
        projectName: entity.projectName,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        connectionCount: entity.connectionCount,
        metadata: includeMetadata ? metadata : undefined,
      };
    });
    
    // Get the source entities for reference
    const sourceEntitiesSql = `
      SELECT 
        e.id,
        e.name,
        e.entity_type AS entityType, 
        e.confidence,
        e.metadata
      FROM entities e
      WHERE e.id IN (${entityIds.map(() => '?').join(',')})
    `;
    
    const sourceEntities = await query(sourceEntitiesSql, entityIds);
    
    // Process source entities
    const processedSourceEntities = sourceEntities.map((entity: any) => {
      const metadata = includeMetadata && entity.metadata 
        ? JSON.parse(entity.metadata) 
        : null;
      
      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        metadata: includeMetadata ? metadata : undefined,
      };
    });
    
    return NextResponse.json({
      sourceEntities: processedSourceEntities,
      similarEntities: processedResults,
      total: processedResults.length,
      filters: {
        projectId: projectId || 'all',
        entityTypes: entityTypes || 'all',
        minConfidence,
        relationshipWeight,
        attributeWeight,
      }
    });
  } catch (error) {
    console.error('Error finding similar entities:', error);
    return NextResponse.json(
      { error: 'Failed to find similar entities', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 