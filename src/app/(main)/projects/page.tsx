import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderPlus, ExternalLink, CalendarClock } from "lucide-react";

export const metadata: Metadata = {
  title: "Projects | Knowledge Graph MCP",
  description: "Manage knowledge graph projects",
};

async function getProjects() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    
    const res = await fetch(`${baseUrl}/api/projects`, {
      cache: 'no-store',
    });
    
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="flex flex-col gap-2 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Projects</h1>
          <Button asChild>
            <Link href="/projects/new">
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Project
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Manage your knowledge graph projects and organize entities
        </p>
      </header>

      {projects.length === 0 ? (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No projects found</CardTitle>
            <CardDescription>Create your first project to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-12">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <FolderPlus className="h-12 w-12 text-primary" />
            </div>
            <p className="text-center max-w-md">
              Projects help you organize your knowledge graph data into logical groups.
              Create your first project to start building your knowledge base.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/projects/new">
                Create Your First Project
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: any) => (
            <Card key={project.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle>{project.name}</CardTitle>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Last updated: {new Date(project.updated_at).toLocaleDateString()}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/50 pt-3 flex gap-3 justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${project.id}/entities`}>
                    Entities
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/projects/${project.id}`}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 