import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { AgentKnowledgeUpdateSchema } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route POST /api/agent/update
 * @desc Process batch updates of knowledge from AI agents
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = AgentKnowledgeUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { projectId, projectName, conversationId, entities, relationships } = validation.data;
    
    // Check if the project exists, if not, create it
    let projectExists = false;
    
    try {
      const existingProjects = await query(`SELECT COUNT(*) as count FROM projects WHERE id = ?`, [projectId]);
      projectExists = existingProjects[0].count > 0;
    } catch (error) {
      console.error('Error checking project existence:', error);
      return NextResponse.json(
        { error: 'Error checking project existence' },
        { status: 500 }
      );
    }
    
    // Create project if it doesn't exist
    if (!projectExists && projectName) {
      try {
        await query(
          `INSERT INTO projects (id, name, description, metadata, created_at, updated_at)
           VALUES (?, ?, ?, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [projectId, projectName, `Project created by AI agent from conversation ${conversationId}`]
        );
      } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json(
          { error: 'Error creating project' },
          { status: 500 }
        );
      }
    } else if (!projectExists) {
      return NextResponse.json(
        { error: 'Project does not exist and no project name provided for creation' },
        { status: 400 }
      );
    }
    
    // Process entities
    const createdEntityIds = new Map<string, string>();
    
    if (entities && entities.length > 0) {
      for (const entity of entities) {
        const { name, entityType, metadata, confidence, observations } = entity;
        
        // Check if entity already exists
        let entityId;
        try {
          const existingEntities = await query(
            `SELECT id FROM entities WHERE name = ? AND project_id = ?`,
            [name, projectId]
          );
          
          if (existingEntities.length > 0) {
            // Update existing entity
            entityId = existingEntities[0].id;
            
            await query(
              `UPDATE entities 
               SET entity_type = ?,
                   metadata = CASE WHEN ? IS NOT NULL THEN ? ELSE metadata END,
                   confidence = CASE WHEN ? IS NOT NULL THEN ? ELSE confidence END,
                   updated_at = CURRENT_TIMESTAMP,
                   source = ?
               WHERE id = ?`,
              [
                entityType,
                metadata ? JSON.stringify(metadata) : null,
                metadata ? JSON.stringify(metadata) : null,
                confidence !== undefined ? confidence : null,
                confidence !== undefined ? confidence : null,
                conversationId,
                entityId
              ]
            );
          } else {
            // Create new entity
            entityId = uuidv4();
            
            await query(
              `INSERT INTO entities (id, name, entity_type, project_id, metadata, confidence, created_at, updated_at, source)
               VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
              [
                entityId,
                name,
                entityType,
                projectId,
                metadata ? JSON.stringify(metadata) : '{}',
                confidence || 0.5,
                conversationId
              ]
            );
          }
          
          createdEntityIds.set(name, entityId);
          
          // Add observations if provided
          if (observations && observations.length > 0) {
            for (const content of observations) {
              // Check for existing observation
              const existingObservations = await query(
                `SELECT id, content, version FROM observations WHERE entity_id = ? AND content = ?`,
                [entityId, content]
              );
              
              if (existingObservations.length === 0) {
                // Create new observation
                const observationId = uuidv4();
                await query(
                  `INSERT INTO observations (id, entity_id, content, confidence, version, is_valid, created_at, updated_at, source)
                   VALUES (?, ?, ?, ?, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
                  [
                    observationId,
                    entityId,
                    content,
                    confidence || 0.5,
                    conversationId
                  ]
                );
              }
            }
          }
        } catch (error) {
          console.error(`Error processing entity ${name}:`, error);
          // Continue with other entities
        }
      }
    }
    
    // Process relationships if entities were created successfully
    const createdRelationships = [];
    
    if (relationships && relationships.length > 0) {
      for (const relationship of relationships) {
        const { fromEntityName, toEntityName, relationType, strength, metadata } = relationship;
        
        // Get entity IDs from names
        const fromEntityId = createdEntityIds.get(fromEntityName);
        const toEntityId = createdEntityIds.get(toEntityName);
        
        if (!fromEntityId || !toEntityId) {
          console.warn(`Skipping relationship as entity not found: ${fromEntityName} -> ${toEntityName}`);
          continue;
        }
        
        try {
          // Check if relationship already exists
          const existingRelationships = await query(
            `SELECT id FROM relationships 
             WHERE from_entity_id = ? AND to_entity_id = ? AND relation_type = ?`,
            [fromEntityId, toEntityId, relationType]
          );
          
          let relationshipId;
          
          if (existingRelationships.length > 0) {
            // Update existing relationship
            relationshipId = existingRelationships[0].id;
            
            await query(
              `UPDATE relationships
               SET strength = CASE WHEN ? IS NOT NULL THEN ? ELSE strength END,
                   metadata = CASE WHEN ? IS NOT NULL THEN ? ELSE metadata END,
                   updated_at = CURRENT_TIMESTAMP,
                   source = ?
               WHERE id = ?`,
              [
                strength !== undefined ? strength : null,
                strength !== undefined ? strength : null,
                metadata ? JSON.stringify(metadata) : null,
                metadata ? JSON.stringify(metadata) : null,
                conversationId,
                relationshipId
              ]
            );
          } else {
            // Create new relationship
            relationshipId = uuidv4();
            
            await query(
              `INSERT INTO relationships (id, from_entity_id, to_entity_id, relation_type, strength, metadata, created_at, updated_at, source)
               VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
              [
                relationshipId,
                fromEntityId,
                toEntityId,
                relationType,
                strength || 0.5,
                metadata ? JSON.stringify(metadata) : '{}',
                conversationId
              ]
            );
          }
          
          createdRelationships.push({
            id: relationshipId,
            fromEntityId,
            fromEntityName,
            toEntityId,
            toEntityName,
            relationType
          });
        } catch (error) {
          console.error(`Error processing relationship ${fromEntityName} -> ${toEntityName}:`, error);
          // Continue with other relationships
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      projectId,
      entitiesProcessed: entities?.length || 0,
      relationshipsProcessed: createdRelationships.length,
      entities: Array.from(createdEntityIds.entries()).map(([name, id]) => ({ name, id })),
      relationships: createdRelationships
    }, { status: 200 });
  } catch (error) {
    console.error('Error processing agent update:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error processing agent update' },
      { status: 500 }
    );
  }
} 