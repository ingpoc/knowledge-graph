"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraphVisualization } from "@/components/graph-visualization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network, FileBarChart, Filter, RefreshCw } from "lucide-react";

interface GraphData {
  nodes: {
    id: string;
    name: string;
    entityType: string;
    group?: number;
  }[];
  links: {
    source: string;
    target: string;
    value: number;
    relationType: string;
  }[];
}

export default function GraphPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const entityId = searchParams.get("entityId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [projects, setProjects] = useState<any[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [filter, setFilter] = useState({
    projectId: projectId || "all",
    entityTypes: [] as string[],
    relationshipTypes: [] as string[],
  });

  // Fetch available projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/projects`);
        if (!res.ok) throw new Error("Failed to fetch projects");
        const data = await res.json();
        setProjects(data);
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    }

    fetchProjects();
  }, []);

  // Fetch graph data based on filters
  useEffect(() => {
    async function fetchGraphData() {
      setLoading(true);
      setError(null);
      
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        
        // Build the API endpoint with filters
        let endpoint = `${baseUrl}/api/graph`;
        const params = new URLSearchParams();
        
        if (filter.projectId && filter.projectId !== "all") {
          params.append("projectId", filter.projectId);
        }

        if (entityId) {
          params.append("entityId", entityId);
        }

        if (filter.entityTypes.length > 0) {
          params.append("entityTypes", filter.entityTypes.join(","));
        }

        if (filter.relationshipTypes.length > 0) {
          params.append("relationshipTypes", filter.relationshipTypes.join(","));
        }

        const queryString = params.toString();
        if (queryString) {
          endpoint += `?${queryString}`;
        }

        const res = await fetch(endpoint);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch graph data: ${res.status}`);
        }
        
        const data = await res.json();
        setGraphData(data);
        
        // Extract all entity types for filtering
        if (data.entityTypes) {
          setEntityTypes(data.entityTypes);
        }
      } catch (err: any) {
        console.error("Error fetching graph data:", err);
        setError(err.message || "Failed to load graph data. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchGraphData();
  }, [filter, entityId]);

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    router.push(`/graph?entityId=${nodeId}`);
  };
  
  // Handle entity type filter toggle
  const toggleEntityTypeFilter = (entityType: string) => {
    setFilter(prev => {
      const currentTypes = [...prev.entityTypes];
      const index = currentTypes.indexOf(entityType);
      
      if (index === -1) {
        currentTypes.push(entityType);
      } else {
        currentTypes.splice(index, 1);
      }
      
      return { ...prev, entityTypes: currentTypes };
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Knowledge Graph</h1>
        </div>
        <p className="text-muted-foreground">
          Visualize and explore relationships between entities in your knowledge graph
        </p>
      </header>
      
      {loading ? (
        <Card className="w-full h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading graph data...</p>
          </div>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Error Loading Graph
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive/90">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  Graph Filters
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setFilter({
                    projectId: "all",
                    entityTypes: [],
                    relationshipTypes: []
                  })}
                  className="h-8"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Reset Filters
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="w-full md:w-64">
                  <label className="text-sm font-medium block mb-1.5">Project</label>
                  <select
                    value={filter.projectId}
                    onChange={(e) => setFilter({ ...filter, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {entityTypes.length > 0 && (
                  <div className="w-full">
                    <label className="text-sm font-medium block mb-1.5">Entity Types</label>
                    <div className="flex flex-wrap gap-2">
                      {entityTypes.map((type) => (
                        <Button
                          key={type}
                          onClick={() => toggleEntityTypeFilter(type)}
                          variant={filter.entityTypes.includes(type) ? "default" : "outline"}
                          size="sm"
                          className="h-8"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Graph Visualization
              </CardTitle>
              <CardDescription>
                {entityId 
                  ? `Showing connections for entity: ${graphData.nodes.find(node => node.id === entityId)?.name || entityId}`
                  : `Showing ${graphData.nodes.length} entities and ${graphData.links.length} relationships`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex justify-center">
                {graphData.nodes.length === 0 ? (
                  <div className="py-24 text-center">
                    <p className="text-muted-foreground">No graph data available with the current filters.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setFilter({
                        projectId: "all",
                        entityTypes: [],
                        relationshipTypes: []
                      })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset Filters
                    </Button>
                  </div>
                ) : (
                  <div className="max-w-full overflow-auto">
                    <GraphVisualization
                      data={graphData}
                      width={1000}
                      height={600}
                      onNodeClick={handleNodeClick}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {graphData.nodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-primary" />
                  Graph Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-muted/40 p-4 rounded-lg">
                    <p className="text-muted-foreground text-sm font-medium">Nodes</p>
                    <p className="text-3xl font-bold mt-1">{graphData.nodes.length}</p>
                  </div>
                  <div className="bg-muted/40 p-4 rounded-lg">
                    <p className="text-muted-foreground text-sm font-medium">Relationships</p>
                    <p className="text-3xl font-bold mt-1">{graphData.links.length}</p>
                  </div>
                  <div className="bg-muted/40 p-4 rounded-lg">
                    <p className="text-muted-foreground text-sm font-medium">Entity Types</p>
                    <p className="text-3xl font-bold mt-1">{entityTypes.length}</p>
                  </div>
                  {entityId && (
                    <div className="bg-muted/40 p-4 rounded-lg">
                      <p className="text-muted-foreground text-sm font-medium">Focused On</p>
                      <p className="text-xl font-semibold mt-1 truncate">
                        {graphData.nodes.find(node => node.id === entityId)?.name || entityId}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
} 