import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AgentConfidenceUpdateSchema } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route POST /api/agent/confidence
 * @desc Update confidence scores for entities, relationships, or observations
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = AgentConfidenceUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { updates } = validation.data;
    
    if (!updates || updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }
    
    const results = {
      entitiesUpdated: 0,
      relationshipsUpdated: 0,
      observationsUpdated: 0,
      entitiesByNameUpdated: 0,
      failed: 0
    };
    
    // Process each confidence update
    for (const update of updates) {
      try {
        const { entityId, entityName, relationshipId, observationId, confidence } = update;
        
        // Update entity by ID
        if (entityId) {
          await query(
            `UPDATE entities SET confidence = ? WHERE id = ?`,
            [confidence, entityId]
          );
          results.entitiesUpdated++;
        }
        
        // Update entity by name
        else if (entityName) {
          await query(
            `UPDATE entities SET confidence = ? WHERE name = ?`,
            [confidence, entityName]
          );
          results.entitiesByNameUpdated++;
        }
        
        // Update relationship
        else if (relationshipId) {
          await query(
            `UPDATE relationships SET strength = ? WHERE id = ?`,
            [confidence, relationshipId]
          );
          results.relationshipsUpdated++;
        }
        
        // Update observation
        else if (observationId) {
          await query(
            `UPDATE observations SET confidence = ? WHERE id = ?`,
            [confidence, observationId]
          );
          results.observationsUpdated++;
        }
        else {
          results.failed++;
        }
      } catch (error) {
        console.error('Error updating confidence:', error);
        results.failed++;
      }
    }
    
    return NextResponse.json({
      success: true,
      ...results,
      totalProcessed: updates.length
    });
  } catch (error) {
    console.error('Error processing confidence updates:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error processing confidence updates' },
      { status: 500 }
    );
  }
} 