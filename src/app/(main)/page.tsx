import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Network, GitBranch, BarChart, ExternalLink, FileText, Users, Layers } from "lucide-react";

export default function Home() {
  // Add error handling for project fetching
  const fetchProjects = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
      const response = await fetch(`${baseUrl}/api/projects`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to fetch projects: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error loading projects:", error);
      throw error;
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-12 px-4 md:px-6">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Knowledge Graph MCP</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          A powerful solution for managing and visualizing knowledge graphs. Create entities, build relationships, and explore your data with ease.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-12">
        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Project Management</CardTitle>
            <CardDescription>
              Create and manage projects to organize your knowledge graph data
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Projects help you organize entities and relationships into logical groups. 
              Create multiple projects for different domains or use cases.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/projects">
                View Projects
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Entity Management</CardTitle>
            <CardDescription>
              Create, edit, and organize entities within your knowledge graph
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Entities represent the nodes in your knowledge graph. Define entities with 
              custom properties, link them with relationships, and organize them by type.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/entities">
                Manage Entities
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Network className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Graph Visualization</CardTitle>
            <CardDescription>
              Visualize and explore your knowledge graph with an interactive interface
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              See how your entities and relationships connect in an interactive graph. 
              Explore connections, filter by entity type, and navigate your data visually.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/graph">
                Explore Graph
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="mb-12">
        <CardHeader>
          <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Follow these steps to start building your knowledge graph
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-4 text-sm">
            <li className="pl-2">
              <span className="font-medium">Create a Project</span> - Start by creating a project to organize your knowledge graph
            </li>
            <li className="pl-2">
              <span className="font-medium">Define Entity Types</span> - Create entity types to categorize your data points
            </li>
            <li className="pl-2">
              <span className="font-medium">Add Entities</span> - Create entities with properties and metadata
            </li>
            <li className="pl-2">
              <span className="font-medium">Create Relationships</span> - Connect entities with meaningful relationships
            </li>
            <li className="pl-2">
              <span className="font-medium">Visualize Your Graph</span> - Explore your knowledge graph through the visual interface
            </li>
          </ol>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/projects/new">
              Create Your First Project
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Learn how to use and extend the Knowledge Graph MCP
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Explore our comprehensive documentation to understand the capabilities 
              and features of the Knowledge Graph MCP.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/docs">
                <ExternalLink className="mr-2 h-4 w-4" />
                Read Docs
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>API Explorer</CardTitle>
            <CardDescription>
              Test and explore the Knowledge Graph API endpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Use our API explorer to test API endpoints, see request and response 
              formats, and integrate with your applications.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/api-explorer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open API Explorer
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col h-full transition-all hover:shadow-lg">
          <CardHeader>
            <div className="mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Community</CardTitle>
            <CardDescription>
              Join our community of knowledge graph enthusiasts
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">
              Connect with other users, share your experiences, ask questions, 
              and learn from others in our community forums.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="https://github.com/your-repo/knowledge-graph-mcp">
                <ExternalLink className="mr-2 h-4 w-4" />
                Join Community
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 