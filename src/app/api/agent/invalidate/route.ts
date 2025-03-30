import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AgentKnowledgeInvalidationSchema } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route POST /api/agent/invalidate
 * @desc Invalidate knowledge entities, relationships, or observations
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = AgentKnowledgeInvalidationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { entityIds, entityNames, relationshipIds, observationIds, reason } = validation.data;
    
    // Ensure at least one invalidation target is provided
    if (
      (!entityIds || entityIds.length === 0) &&
      (!entityNames || entityNames.length === 0) &&
      (!relationshipIds || relationshipIds.length === 0) &&
      (!observationIds || observationIds.length === 0)
    ) {
      return NextResponse.json(
        { error: 'No invalidation targets provided' },
        { status: 400 }
      );
    }
    
    const invalidationResults = {
      entitiesInvalidated: 0,
      relationshipsInvalidated: 0,
      observationsInvalidated: 0,
      entitiesByName: 0,
    };
    
    const timestamp = new Date().toISOString();
    const metadata = JSON.stringify({
      invalidatedAt: timestamp,
      reason: reason || 'Invalidated by agent request',
    });
    
    // Invalidate entities by ID
    if (entityIds && entityIds.length > 0) {
      try {
        // Mark entities as low confidence
        const result = await query(
          `UPDATE entities 
           SET confidence = 0.1, 
               metadata = JSON_PATCH(metadata, ?) 
           WHERE id IN (${entityIds.map(() => '?').join(',')})`,
          [metadata, ...entityIds]
        );
        
        invalidationResults.entitiesInvalidated = entityIds.length;
        
        // Also mark related observations as invalid
        await query(
          `UPDATE observations 
           SET is_valid = false 
           WHERE entity_id IN (${entityIds.map(() => '?').join(',')})`,
          [...entityIds]
        );
      } catch (error) {
        console.error('Error invalidating entities by ID:', error);
      }
    }
    
    // Invalidate entities by name
    if (entityNames && entityNames.length > 0) {
      try {
        // First get the IDs of entities matching the names
        const foundEntities = await query(
          `SELECT id FROM entities WHERE name IN (${entityNames.map(() => '?').join(',')})`,
          [...entityNames]
        );
        
        if (foundEntities.length > 0) {
          const foundIds = foundEntities.map((entity: any) => entity.id);
          
          // Mark entities as low confidence
          await query(
            `UPDATE entities 
             SET confidence = 0.1, 
                 metadata = JSON_PATCH(metadata, ?) 
             WHERE id IN (${foundIds.map(() => '?').join(',')})`,
            [metadata, ...foundIds]
          );
          
          invalidationResults.entitiesByName = foundIds.length;
          
          // Also mark related observations as invalid
          await query(
            `UPDATE observations 
             SET is_valid = false 
             WHERE entity_id IN (${foundIds.map(() => '?').join(',')})`,
            [...foundIds]
          );
        }
      } catch (error) {
        console.error('Error invalidating entities by name:', error);
      }
    }
    
    // Invalidate relationships
    if (relationshipIds && relationshipIds.length > 0) {
      try {
        // Mark relationships as low confidence
        const result = await query(
          `UPDATE relationships 
           SET strength = 0.1, 
               metadata = JSON_PATCH(metadata, ?) 
           WHERE id IN (${relationshipIds.map(() => '?').join(',')})`,
          [metadata, ...relationshipIds]
        );
        
        invalidationResults.relationshipsInvalidated = relationshipIds.length;
      } catch (error) {
        console.error('Error invalidating relationships:', error);
      }
    }
    
    // Invalidate observations
    if (observationIds && observationIds.length > 0) {
      try {
        // Mark observations as invalid
        const result = await query(
          `UPDATE observations 
           SET is_valid = false 
           WHERE id IN (${observationIds.map(() => '?').join(',')})`,
          [...observationIds]
        );
        
        invalidationResults.observationsInvalidated = observationIds.length;
      } catch (error) {
        console.error('Error invalidating observations:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      ...invalidationResults,
      timestamp
    });
  } catch (error) {
    console.error('Error processing invalidation request:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error processing invalidation request' },
      { status: 500 }
    );
  }
} 