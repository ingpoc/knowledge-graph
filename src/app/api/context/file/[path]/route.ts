import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import path from 'path';

/**
 * @route GET /api/context/file/{path}
 * @desc Get context for a specific file path
 * @access Public
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string } }
) {
  try {
    // Decode the file path
    let filePath = decodeURIComponent(params.path || '');
    
    // If path is empty, return an error
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }
    
    // Extract URL parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const confidenceThreshold = parseFloat(searchParams.get('confidence') || '0.3');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Build base query conditions
    const conditions: string[] = [];
    const queryParams: any[] = [];
    
    // Add file path matching condition with wildcard support
    // We look for the file path in metadata and name for maximum recall
    conditions.push(`(
      LOWER(COALESCE(e.metadata->>'filePath', '')) LIKE ? 
      OR LOWER(COALESCE(e.metadata->>'path', '')) LIKE ?
      OR LOWER(e.name) LIKE ?
    )`);
    
    // Get filename and directory parts for improved matching
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    
    // Add wildcards for fuzzy matching
    const filePathLike = `%${filePath.toLowerCase()}%`;
    const fileNameLike = `%${fileName.toLowerCase()}%`;
    
    queryParams.push(filePathLike, filePathLike, fileNameLike);
    
    // Add project filter if specified
    if (projectId) {
      conditions.push('e.project_id = ?');
      queryParams.push(projectId);
    }
    
    // Add confidence threshold
    conditions.push('e.confidence >= ?');
    queryParams.push(confidenceThreshold);
    
    // Build the relevance scoring expression
    // Score is higher for:
    // 1. Exact file path matches
    // 2. Higher confidence values
    // 3. More recent updates
    const relevanceScoring = `
      (CASE 
        WHEN LOWER(COALESCE(e.metadata->>'filePath', '')) = ? THEN 100
        WHEN LOWER(COALESCE(e.metadata->>'path', '')) = ? THEN 100
        WHEN LOWER(e.name) = ? THEN 50
        WHEN LOWER(COALESCE(e.metadata->>'filePath', '')) LIKE ? THEN 30
        WHEN LOWER(COALESCE(e.metadata->>'path', '')) LIKE ? THEN 30
        WHEN LOWER(e.name) LIKE ? THEN 15
        ELSE 0
      END) +
      (e.confidence * 20) +
      (CASE WHEN julianday('now') - julianday(e.updated_at) < 30 THEN 10 ELSE 0 END)
      AS relevance_score
    `;
    
    // Add exact match parameters for relevance scoring
    const exactPathMatch = filePath.toLowerCase();
    const exactFileInPath = `%/${fileName.toLowerCase()}`;
    queryParams.push(
      exactPathMatch, 
      exactPathMatch,
      exactPathMatch,
      exactFileInPath,
      exactFileInPath,
      fileNameLike
    );
    
    // Build the full query
    let sql = `
      SELECT 
        e.id,
        e.name,
        e.entity_type as entityType,
        e.confidence,
        e.metadata,
        e.project_id as projectId,
        e.source,
        e.updated_at as updatedAt,
        p.name as projectName,
        ${relevanceScoring},
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
          AND (? IS NULL OR te.project_id = ? OR e.project_id = ?)
        ) as outgoingRelationships,
        (
          SELECT json_group_array(json_object(
            'id', o.id,
            'content', o.content,
            'confidence', o.confidence,
            'isValid', o.is_valid,
            'version', o.version,
            'updatedAt', o.updated_at
          ))
          FROM observations o
          WHERE o.entity_id = e.id
          AND o.is_valid = true
          ORDER BY o.confidence DESC, o.updated_at DESC
          LIMIT 5
        ) as observations
      FROM entities e
      JOIN projects p ON e.project_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY relevance_score DESC
      LIMIT ?
    `;
    
    // Add project parameters for relationship filtering
    queryParams.push(
      projectId, 
      projectId || '', 
      projectId || ''
    );
    
    // Add limit parameter
    queryParams.push(limit);
    
    // Execute the query
    const results = await query(sql, queryParams);
    
    // Process results to parse JSON strings and clean up data
    const processedResults = results.map((entity: any) => {
      // Parse metadata JSON
      const metadata = entity.metadata ? JSON.parse(entity.metadata) : {};
      
      // Parse relationship arrays
      let outgoing = [];
      try {
        if (entity.outgoingRelationships && entity.outgoingRelationships !== 'null') {
          outgoing = JSON.parse(entity.outgoingRelationships);
        }
      } catch (e) {
        console.error('Error parsing outgoing relationships:', e);
      }
      
      // Parse observations
      let observations = [];
      try {
        if (entity.observations && entity.observations !== 'null') {
          observations = JSON.parse(entity.observations);
        }
      } catch (e) {
        console.error('Error parsing observations:', e);
      }
      
      return {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        confidence: entity.confidence,
        metadata,
        projectId: entity.projectId,
        projectName: entity.projectName,
        source: entity.source,
        updatedAt: entity.updatedAt,
        relevanceScore: entity.relevance_score,
        relationships: {
          outgoing: Array.isArray(outgoing) ? outgoing : []
        },
        observations: Array.isArray(observations) ? observations : []
      };
    });
    
    return NextResponse.json({
      filePath,
      results: processedResults,
      total: processedResults.length,
      metadata: {
        fileName,
        dirName,
        projectId: projectId || 'all',
        confidenceThreshold
      }
    });
  } catch (error) {
    console.error('Error querying file context:', error);
    return NextResponse.json(
      { error: 'Failed to query file context', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 