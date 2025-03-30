import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * @route GET /api/graph
 * @desc Get graph data for visualization with optional filtering
 * @access Public
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const entityId = searchParams.get("entityId");
    const entityTypes = searchParams.get("entityTypes")?.split(",") || [];
    const relationshipTypes = searchParams.get("relationshipTypes")?.split(",") || [];
    
    // Base query conditions
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Add projectId filter if specified
    if (projectId && projectId !== "all") {
      conditions.push("e.project_id = ?");
      params.push(projectId);
    }
    
    // Add entityType filter if specified
    if (entityTypes.length > 0) {
      conditions.push(`e.entity_type IN (${entityTypes.map(() => '?').join(', ')})`);
      params.push(...entityTypes);
    }
    
    let links: Array<{source: string, target: string, value: number, relationType: string}> = [];
    let nodes: Array<{id: string, name: string, entityType: string, group: number}> = [];
    let entityTypesSet = new Set<string>();
    
    // If an entity ID is provided, fetch the graph centered on that entity
    if (entityId) {
      // Get the central entity
      const entityResult = await query(
        `SELECT id, name, entity_type, metadata FROM entities WHERE id = ?`,
        [entityId]
      );
      
      if (entityResult.length === 0) {
        return NextResponse.json(
          { error: `Entity with ID ${entityId} not found` },
          { status: 404 }
        );
      }
      
      // Add the central entity to nodes
      const centralEntity = entityResult[0];
      nodes.push({
        id: centralEntity.id,
        name: centralEntity.name,
        entityType: centralEntity.entity_type,
        group: 1
      });
      
      entityTypesSet.add(centralEntity.entity_type);
      
      // Get relationships where this entity is the source
      const outgoingRelationshipsResult = await query(
        `SELECT 
          r.id as relationship_id, 
          r.relation_type, 
          r.strength,
          r.to_entity_id as target_id,
          e.id as entity_id,
          e.name as entity_name,
          e.entity_type
         FROM relationships r
         JOIN entities e ON r.to_entity_id = e.id
         WHERE r.from_entity_id = ?
         ${relationshipTypes.length > 0 ? 
           `AND r.relation_type IN (${relationshipTypes.map(() => '?').join(', ')})` : 
           ''}`,
        relationshipTypes.length > 0 ? 
          [entityId, ...relationshipTypes] : 
          [entityId]
      );
      
      // Get relationships where this entity is the target
      const incomingRelationshipsResult = await query(
        `SELECT 
          r.id as relationship_id, 
          r.relation_type, 
          r.strength,
          r.from_entity_id as source_id,
          e.id as entity_id,
          e.name as entity_name,
          e.entity_type
         FROM relationships r
         JOIN entities e ON r.from_entity_id = e.id
         WHERE r.to_entity_id = ?
         ${relationshipTypes.length > 0 ? 
           `AND r.relation_type IN (${relationshipTypes.map(() => '?').join(', ')})` : 
           ''}`,
        relationshipTypes.length > 0 ? 
          [entityId, ...relationshipTypes] : 
          [entityId]
      );
      
      // Add nodes and links from outgoing relationships
      for (const rel of outgoingRelationshipsResult) {
        // Only add nodes that aren't already in the collection
        if (!nodes.some(n => n.id === rel.entity_id)) {
          nodes.push({
            id: rel.entity_id,
            name: rel.entity_name,
            entityType: rel.entity_type,
            group: 2
          });
          entityTypesSet.add(rel.entity_type);
        }
        
        links.push({
          source: entityId,
          target: rel.target_id,
          value: rel.strength || 1,
          relationType: rel.relation_type
        });
      }
      
      // Add nodes and links from incoming relationships
      for (const rel of incomingRelationshipsResult) {
        // Only add nodes that aren't already in the collection
        if (!nodes.some(n => n.id === rel.entity_id)) {
          nodes.push({
            id: rel.entity_id,
            name: rel.entity_name,
            entityType: rel.entity_type,
            group: 3
          });
          entityTypesSet.add(rel.entity_type);
        }
        
        links.push({
          source: rel.source_id,
          target: entityId,
          value: rel.strength || 1,
          relationType: rel.relation_type
        });
      }
    } else {
      // Get all entities based on filters
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      
      const entitiesResult = await query(
        `SELECT id, name, entity_type FROM entities ${whereClause} LIMIT 100`,
        params
      );
      
      // Add all entities to nodes
      for (const entity of entitiesResult) {
        nodes.push({
          id: entity.id,
          name: entity.name,
          entityType: entity.entity_type,
          group: 1
        });
        entityTypesSet.add(entity.entity_type);
      }
      
      // Get relationships between these entities
      const entityIds = entitiesResult.map(e => e.id);
      if (entityIds.length > 0) {
        // Create placeholders for IN clause
        const placeholders = entityIds.map(() => "?").join(", ");
        
        // Add relationship type filter if specified
        let relationshipFilter = "";
        let relationshipParams: string[] = [];
        if (relationshipTypes.length > 0) {
          relationshipFilter = `AND r.relation_type IN (${relationshipTypes.map(() => '?').join(', ')})`;
          relationshipParams = [...relationshipTypes];
        }
        
        const relationshipsResult = await query(
          `SELECT 
            r.id, 
            r.from_entity_id, 
            r.to_entity_id, 
            r.relation_type, 
            r.strength
           FROM relationships r
           WHERE r.from_entity_id IN (${placeholders})
           AND r.to_entity_id IN (${placeholders})
           ${relationshipFilter}`,
          [...entityIds, ...entityIds, ...relationshipParams]
        );
        
        // Add relationships to links
        for (const rel of relationshipsResult) {
          links.push({
            source: rel.from_entity_id,
            target: rel.to_entity_id,
            value: rel.strength || 1,
            relationType: rel.relation_type
          });
        }
      }
    }
    
    return NextResponse.json({
      nodes,
      links,
      entityTypes: Array.from(entityTypesSet)
    });
  } catch (error) {
    console.error("Error fetching graph data:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
} 