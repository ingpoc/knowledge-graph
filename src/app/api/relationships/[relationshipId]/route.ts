import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { RelationshipSchema } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route GET /api/relationships/:relationshipId
 * @desc Get a single relationship by ID
 * @access Public
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { relationshipId: string } }
) {
  try {
    const id = params.relationshipId;
    
    // Get relationship with entity names
    const sql = `
      SELECT r.*, 
             fe.name as from_entity_name, 
             fe.entity_type as from_entity_type,
             te.name as to_entity_name, 
             te.entity_type as to_entity_type
      FROM relationships r
      JOIN entities fe ON r.from_entity_id = fe.id
      JOIN entities te ON r.to_entity_id = te.id
      WHERE r.id = ?
    `;
    
    const relationships = await query(sql, [id]);
    
    if (relationships.length === 0) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }
    
    // Parse JSON metadata
    const relationship = relationships[0];
    if (relationship.metadata) {
      relationship.metadata = JSON.parse(relationship.metadata);
    }
    
    return NextResponse.json(relationship);
  } catch (error) {
    console.error('Error fetching relationship:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relationship' },
      { status: 500 }
    );
  }
}

/**
 * @route PUT /api/relationships/:relationshipId
 * @desc Update a relationship
 * @access Public
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { relationshipId: string } }
) {
  try {
    const id = params.relationshipId;
    const body = await request.json();
    
    // Check if relationship exists
    const relationships = await query('SELECT id FROM relationships WHERE id = ?', [id]);
    
    if (relationships.length === 0) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }
    
    // Validate request body
    const validatedData = RelationshipSchema.parse({
      ...body,
      id,
      updatedAt: new Date()
    });
    
    // Check if entities exist
    const fromEntity = await query('SELECT id FROM entities WHERE id = ?', [validatedData.fromEntityId]);
    if (fromEntity.length === 0) {
      return NextResponse.json(
        { error: 'From entity not found' },
        { status: 404 }
      );
    }

    const toEntity = await query('SELECT id FROM entities WHERE id = ?', [validatedData.toEntityId]);
    if (toEntity.length === 0) {
      return NextResponse.json(
        { error: 'To entity not found' },
        { status: 404 }
      );
    }
    
    // Update relationship
    await query(
      `UPDATE relationships 
       SET from_entity_id = ?, 
           to_entity_id = ?, 
           relation_type = ?, 
           strength = ?, 
           metadata = ?, 
           updated_at = ?,
           source = ?
       WHERE id = ?`,
      [
        validatedData.fromEntityId,
        validatedData.toEntityId,
        validatedData.relationType,
        validatedData.strength,
        JSON.stringify(validatedData.metadata || {}),
        validatedData.updatedAt.toISOString(),
        validatedData.source || null,
        id
      ]
    );
    
    return NextResponse.json(validatedData);
  } catch (error: unknown) {
    console.error('Error updating relationship:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid relationship data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update relationship' },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/relationships/:relationshipId
 * @desc Delete a relationship
 * @access Public
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { relationshipId: string } }
) {
  try {
    const id = params.relationshipId;
    
    // Check if relationship exists
    const relationships = await query('SELECT id FROM relationships WHERE id = ?', [id]);
    
    if (relationships.length === 0) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }
    
    // Delete relationship
    await query('DELETE FROM relationships WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
} 