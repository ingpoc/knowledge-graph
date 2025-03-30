import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { EntitySchema } from '@/lib/types';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const entityType = searchParams.get('entityType');
    const projectId = searchParams.get('projectId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query
    let sql = 'SELECT * FROM entities';
    const params: any[] = [];
    const conditions: string[] = [];

    if (name) {
      conditions.push('name LIKE ?');
      params.push(`%${name}%`);
    }

    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }

    if (projectId) {
      conditions.push('project_id = ?');
      params.push(projectId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const entities = await query(sql, params);

    // Parse JSON metadata
    const parsedEntities = entities.map((entity: any) => ({
      ...entity,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : {}
    }));

    return NextResponse.json(parsedEntities);
  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = EntitySchema.parse({
      ...body,
      id: body.id || uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Check if project exists
    const project = await query('SELECT id FROM projects WHERE id = ?', [validatedData.projectId]);
    if (project.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Insert entity
    await query(
      `INSERT INTO entities (id, name, entity_type, project_id, metadata, confidence, created_at, updated_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validatedData.id,
        validatedData.name,
        validatedData.entityType,
        validatedData.projectId,
        JSON.stringify(validatedData.metadata || {}),
        validatedData.confidence,
        validatedData.createdAt.toISOString(),
        validatedData.updatedAt.toISOString(),
        validatedData.source || null
      ]
    );

    return NextResponse.json(validatedData, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating entity:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid entity data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
} 