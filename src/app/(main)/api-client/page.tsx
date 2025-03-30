"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Metadata } from "next";

// Define metadata for the page
export const metadata: Metadata = {
  title: "API Client | Knowledge Graph MCP",
  description: "Test the Knowledge Graph API for AI agent integration",
};

export default function ApiClientPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [maxResults, setMaxResults] = useState(10);
  const [minConfidence, setMinConfidence] = useState(0);
  
  // Fetch projects and entity types for filters
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch projects
        const projectsRes = await fetch('/api/projects');
        if (!projectsRes.ok) throw new Error("Failed to fetch projects");
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
        
        // Fetch entity types (using a sample of entities to extract types)
        const entitiesRes = await fetch('/api/entities?limit=100');
        if (!entitiesRes.ok) throw new Error("Failed to fetch entities");
        const entitiesData = await entitiesRes.json();
        
        // Extract unique entity types with proper typing
        const entityTypeSet = new Set<string>();
        entitiesData.forEach((entity: any) => {
          if (typeof entity.entity_type === 'string') {
            entityTypeSet.add(entity.entity_type);
          }
        });
        
        setEntityTypes(Array.from(entityTypeSet));
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load filter options");
      }
    }

    fetchData();
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }
    
    setLoading(true);
    setResults(null);
    
    try {
      const payload = {
        query,
        projectId: projectId !== "all" ? projectId : undefined,
        entityTypes: selectedEntityTypes.length > 0 ? selectedEntityTypes : undefined,
        maxResults,
        confidence: minConfidence > 0 ? minConfidence : undefined
      };
      
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to query context");
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to query context");
      console.error("Error querying context:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle entity type selection
  const toggleEntityType = (type: string) => {
    setSelectedEntityTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };
  
  // Format JSON for display
  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Knowledge Graph API Client</h1>
      <p className="text-muted-foreground mb-8">
        Test the Context API endpoint for AI agent integration
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Query Parameters</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="query" className="block text-sm font-medium">
                  Search Query *
                </label>
                <input
                  id="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                  placeholder="Enter search terms"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="projectId" className="block text-sm font-medium">
                  Project
                </label>
                <select
                  id="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Projects</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Entity Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {entityTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleEntityType(type)}
                      className={`px-3 py-1 text-sm rounded-full ${
                        selectedEntityTypes.includes(type)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="maxResults" className="block text-sm font-medium">
                  Max Results: {maxResults}
                </label>
                <input
                  id="maxResults"
                  type="range"
                  min="1"
                  max="50"
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="minConfidence" className="block text-sm font-medium">
                  Min Confidence: {minConfidence.toFixed(1)}
                </label>
                <input
                  id="minConfidence"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Querying..." : "Run Query"}
              </button>
            </form>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">API Endpoint</h3>
              <div className="bg-muted p-3 rounded-md">
                <code>POST /api/context</code>
              </div>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Example Request</h3>
              <pre className="bg-muted p-3 rounded-md overflow-auto text-xs">
                {formatJson({
                  query: "authentication",
                  projectId: "project-123",
                  entityTypes: ["Component", "Feature"],
                  maxResults: 10,
                  confidence: 0.5
                })}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-2">
          <div className="bg-card p-6 rounded-lg shadow h-full">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4">Querying knowledge graph...</p>
                </div>
              </div>
            ) : results ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">
                    Found {results.total} {results.total === 1 ? "result" : "results"}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    Query: "{results.query}"
                  </span>
                </div>
                
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <pre className="bg-muted p-4 rounded-md text-xs">
                    {formatJson(results)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-64 border-2 border-dashed rounded-md">
                <div className="text-center text-muted-foreground">
                  <p>Run a query to see results</p>
                  <p className="text-sm mt-2">
                    Results will appear here in JSON format
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 