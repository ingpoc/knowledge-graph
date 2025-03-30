import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';
import { ProjectSchema } from '@/lib/types';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters - fix URL parsing
    const requestUrl = request.url;
    const url = new URL(requestUrl);
    const name = url.searchParams.get('name');
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 100;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

    // Build query
    let sql = 'SELECT * FROM projects';
    const params: any[] = [];

    if (name) {
      sql += ' WHERE name LIKE ?';
      params.push(`%${name}%`);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const projects = await query(sql, params);

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = ProjectSchema.parse({
      ...body,
      id: body.id || uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Insert project
    await query(
      `INSERT INTO projects (id, name, description, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        validatedData.id,
        validatedData.name,
        validatedData.description || null,
        JSON.stringify(validatedData.metadata || {}),
        validatedData.createdAt.toISOString(),
        validatedData.updatedAt.toISOString()
      ]
    );

    return NextResponse.json(validatedData, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating project:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid project data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 