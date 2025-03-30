import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { RelationshipSchema } from '@/lib/types';
import { ZodError } from 'zod';

/**
 * @route GET /api/relationships
 * @desc Get relationships with optional filtering
 * @access Public
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const fromEntityId = searchParams.get('fromEntityId');
    const toEntityId = searchParams.get('toEntityId');
    const relationType = searchParams.get('relationType');
    const projectId = searchParams.get('projectId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query
    let sql = `
      SELECT r.*, 
             fe.name as from_entity_name, 
             fe.entity_type as from_entity_type,
             te.name as to_entity_name, 
             te.entity_type as to_entity_type
      FROM relationships r
      JOIN entities fe ON r.from_entity_id = fe.id
      JOIN entities te ON r.to_entity_id = te.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (fromEntityId) {
      conditions.push('r.from_entity_id = ?');
      params.push(fromEntityId);
    }

    if (toEntityId) {
      conditions.push('r.to_entity_id = ?');
      params.push(toEntityId);
    }

    if (relationType) {
      conditions.push('r.relation_type = ?');
      params.push(relationType);
    }

    if (projectId) {
      conditions.push('(fe.project_id = ? OR te.project_id = ?)');
      params.push(projectId, projectId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY r.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const relationships = await query(sql, params);

    // Parse JSON metadata
    const parsedRelationships = relationships.map((rel: any) => ({
      ...rel,
      metadata: rel.metadata ? JSON.parse(rel.metadata) : {}
    }));

    return NextResponse.json(parsedRelationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/relationships
 * @desc Create a new relationship
 * @access Public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = RelationshipSchema.parse({
      ...body,
      id: body.id || uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Check if from_entity exists
    const fromEntity = await query('SELECT id FROM entities WHERE id = ?', [validatedData.fromEntityId]);
    if (fromEntity.length === 0) {
      return NextResponse.json(
        { error: 'From entity not found' },
        { status: 404 }
      );
    }

    // Check if to_entity exists
    const toEntity = await query('SELECT id FROM entities WHERE id = ?', [validatedData.toEntityId]);
    if (toEntity.length === 0) {
      return NextResponse.json(
        { error: 'To entity not found' },
        { status: 404 }
      );
    }

    // Insert relationship
    await query(
      `INSERT INTO relationships 
          (id, from_entity_id, to_entity_id, relation_type, strength, metadata, created_at, updated_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedData.id,
        validatedData.fromEntityId,
        validatedData.toEntityId,
        validatedData.relationType,
        validatedData.strength,
        JSON.stringify(validatedData.metadata || {}),
        validatedData.createdAt.toISOString(),
        validatedData.updatedAt.toISOString(),
        validatedData.source || null
      ]
    );

    return NextResponse.json(validatedData, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating relationship:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid relationship data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
} 