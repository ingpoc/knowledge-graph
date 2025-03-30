import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AgentMetadataRequestSchema } from '@/lib/types';
import { EntityTypes, RelationshipTypes } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route GET /api/agent/meta
 * @desc Get metadata about the knowledge graph for agent consumption
 * @access Public
 */
export async function GET(request: NextRequest) {
  try {
    // Parse URL parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || undefined;
    const includeStats = searchParams.get('includeStats') === 'true';
    const includeEntityTypes = searchParams.get('includeEntityTypes') === 'true';
    const includeRelationshipTypes = searchParams.get('includeRelationshipTypes') === 'true';
    
    // Validate parameters
    const validation = AgentMetadataRequestSchema.safeParse({
      projectId,
      includeStats,
      includeEntityTypes,
      includeRelationshipTypes
    });
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const response: any = {
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Get projects
    try {
      const projects = await query(
        `SELECT id, name, description FROM projects ${projectId ? 'WHERE id = ?' : ''} ORDER BY name`,
        projectId ? [projectId] : []
      );
      
      response.projects = projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      response.projects = [];
    }
    
    // Include entity types
    if (includeEntityTypes) {
      response.entityTypes = EntityTypes;
      
      // Get custom entity types from the database
      try {
        const customTypes = await query(`
          SELECT DISTINCT entity_type 
          FROM entities 
          WHERE entity_type NOT IN (${EntityTypes.map(() => '?').join(',')})
          ${projectId ? 'AND project_id = ?' : ''}
        `, [...EntityTypes, ...(projectId ? [projectId] : [])]);
        
        if (customTypes.length > 0) {
          const customEntityTypes = customTypes.map((t: any) => t.entity_type);
          response.entityTypes = [...EntityTypes, ...customEntityTypes];
        }
      } catch (error) {
        console.error('Error fetching custom entity types:', error);
      }
    }
    
    // Include relationship types
    if (includeRelationshipTypes) {
      response.relationshipTypes = RelationshipTypes;
      
      // Get custom relationship types from the database
      try {
        const customTypes = await query(`
          SELECT DISTINCT relation_type 
          FROM relationships r
          JOIN entities e1 ON r.from_entity_id = e1.id
          ${projectId ? 'WHERE e1.project_id = ?' : ''}
          AND relation_type NOT IN (${RelationshipTypes.map(() => '?').join(',')})
        `, [...(projectId ? [projectId] : []), ...RelationshipTypes]);
        
        if (customTypes.length > 0) {
          const customRelationshipTypes = customTypes.map((t: any) => t.relation_type);
          response.relationshipTypes = [...RelationshipTypes, ...customRelationshipTypes];
        }
      } catch (error) {
        console.error('Error fetching custom relationship types:', error);
      }
    }
    
    // Include stats if requested
    if (includeStats) {
      try {
        // Get entity counts
        const entityCounts = await query(`
          SELECT COUNT(*) as count, entity_type 
          FROM entities
          ${projectId ? 'WHERE project_id = ?' : ''}
          GROUP BY entity_type
        `, projectId ? [projectId] : []);
        
        // Get relationship counts
        const relationshipCounts = await query(`
          SELECT COUNT(*) as count, relation_type
          FROM relationships r
          JOIN entities e1 ON r.from_entity_id = e1.id
          ${projectId ? 'WHERE e1.project_id = ?' : ''}
          GROUP BY relation_type
        `, projectId ? [projectId] : []);
        
        // Get total counts
        const totalCounts = await query(`
          SELECT
            (SELECT COUNT(*) FROM entities ${projectId ? 'WHERE project_id = ?' : ''}) as entityCount,
            (SELECT COUNT(*) FROM relationships) as relationshipCount,
            (SELECT COUNT(*) FROM observations) as observationCount
        `, projectId ? [projectId] : []);
        
        response.stats = {
          entities: {
            total: totalCounts[0].entityCount,
            byType: Object.fromEntries(entityCounts.map((row: any) => [row.entity_type, row.count]))
          },
          relationships: {
            total: totalCounts[0].relationshipCount,
            byType: Object.fromEntries(relationshipCounts.map((row: any) => [row.relation_type, row.count]))
          },
          observations: {
            total: totalCounts[0].observationCount
          }
        };
      } catch (error) {
        console.error('Error fetching stats:', error);
        response.stats = { error: 'Failed to retrieve statistics' };
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing metadata request:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error retrieving metadata' },
      { status: 500 }
    );
  }
} 