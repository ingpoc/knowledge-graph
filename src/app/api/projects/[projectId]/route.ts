import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ProjectSchema } from '@/lib/types';
import { ZodError } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const id = params.projectId;
    
    // Get project
    const projects = await query('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Parse JSON metadata
    const project = projects[0];
    if (project.metadata) {
      project.metadata = JSON.parse(project.metadata);
    }
    
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const id = params.projectId;
    const body = await request.json();
    
    // Check if project exists
    const projects = await query('SELECT id FROM projects WHERE id = ?', [id]);
    
    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Validate request body
    const validatedData = ProjectSchema.parse({
      ...body,
      id,
      updatedAt: new Date()
    });
    
    // Update project
    await query(
      `UPDATE projects 
       SET name = ?, description = ?, metadata = ?, updated_at = ?
       WHERE id = ?`,
      [
        validatedData.name,
        validatedData.description || null,
        JSON.stringify(validatedData.metadata || {}),
        validatedData.updatedAt.toISOString(),
        id
      ]
    );
    
    return NextResponse.json(validatedData);
  } catch (error: unknown) {
    console.error('Error updating project:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid project data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const id = params.projectId;
    
    // Check if project exists
    const projects = await query('SELECT id FROM projects WHERE id = ?', [id]);
    
    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Delete project
    // Note: In a production environment, you might want to implement cascade deletion
    // or check for dependencies before deleting.
    await query('DELETE FROM projects WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
} 