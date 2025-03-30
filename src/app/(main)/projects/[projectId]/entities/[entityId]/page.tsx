import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateRelationshipButton } from "./create-relationship-button";

interface PageProps {
  params: {
    projectId: string;
    entityId: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const entity = await getEntity(params.entityId);
  
  if (!entity) {
    return {
      title: "Entity Not Found | Knowledge Graph MCP",
    };
  }
  
  return {
    title: `${entity.name} | Knowledge Graph MCP`,
    description: entity.metadata?.description || `Details for entity ${entity.name}`,
  };
}

async function getEntity(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/entities/${id}`, {
      cache: "no-store",
    });
    
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to fetch entity");
    }
    
    return res.json();
  } catch (error) {
    console.error("Error loading entity:", error);
    return null;
  }
}

async function getRelationships(entityId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/relationships?fromEntityId=${entityId}`,
      { cache: "no-store" }
    );
    
    if (!res.ok) throw new Error("Failed to fetch outgoing relationships");
    
    const outgoingRelationships = await res.json();
    
    const incomingRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/relationships?toEntityId=${entityId}`,
      { cache: "no-store" }
    );
    
    if (!incomingRes.ok) throw new Error("Failed to fetch incoming relationships");
    
    const incomingRelationships = await incomingRes.json();
    
    return {
      outgoing: outgoingRelationships,
      incoming: incomingRelationships
    };
  } catch (error) {
    console.error("Error loading relationships:", error);
    return { outgoing: [], incoming: [] };
  }
}

export default async function EntityPage({ params }: PageProps) {
  const entity = await getEntity(params.entityId);
  
  if (!entity) {
    notFound();
  }
  
  const { outgoing, incoming } = await getRelationships(params.entityId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            {entity.name}
            <span className="ml-3 text-sm px-2 py-1 bg-secondary text-secondary-foreground rounded-md">
              {entity.entity_type}
            </span>
          </h1>
          {entity.metadata?.description && (
            <p className="mt-2 text-muted-foreground">
              {entity.metadata.description}
            </p>
          )}
        </div>
        <div className="flex gap-4">
          <CreateRelationshipButton 
            entityId={params.entityId} 
            projectId={params.projectId}
          />
          <Link
            href={`/projects/${params.projectId}/entities/${params.entityId}/edit`}
            className="px-4 py-2 border rounded-md hover:bg-secondary/80"
          >
            Edit Entity
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-6">
            <div className="bg-card rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Outgoing Relationships</h2>
              
              {outgoing.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No outgoing relationships found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {outgoing.map((rel: any) => (
                    <div
                      key={rel.id}
                      className="p-4 border rounded-md hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <span className="font-medium">{entity.name}</span>
                            <span className="mx-2 text-muted-foreground">→</span>
                            <span className="font-medium">{rel.to_entity_name}</span>
                          </div>
                          <p className="text-sm text-primary mt-1">
                            <span className="px-2 py-0.5 bg-primary/10 rounded">
                              {rel.relation_type}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={`/projects/${params.projectId}/entities/${rel.to_entity_id}`}
                          className="text-primary text-sm hover:underline"
                        >
                          View Target
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Incoming Relationships</h2>
              
              {incoming.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No incoming relationships found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incoming.map((rel: any) => (
                    <div
                      key={rel.id}
                      className="p-4 border rounded-md hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <span className="font-medium">{rel.from_entity_name}</span>
                            <span className="mx-2 text-muted-foreground">→</span>
                            <span className="font-medium">{entity.name}</span>
                          </div>
                          <p className="text-sm text-primary mt-1">
                            <span className="px-2 py-0.5 bg-primary/10 rounded">
                              {rel.relation_type}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={`/projects/${params.projectId}/entities/${rel.from_entity_id}`}
                          className="text-primary text-sm hover:underline"
                        >
                          View Source
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-card rounded-lg shadow p-6 sticky top-20">
            <h2 className="text-xl font-semibold mb-4">Entity Info</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p>
                  <Link 
                    href={`/projects/${entity.project_id}`}
                    className="hover:underline text-primary"
                  >
                    {entity.project_id}
                  </Link>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p>{entity.entity_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confidence</p>
                <div className="w-full bg-secondary h-2 rounded-full mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${entity.confidence * 100}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs mt-1">{(entity.confidence * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p>{formatDate(entity.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p>{formatDate(entity.updated_at)}</p>
              </div>
              {entity.source && (
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="break-all">{entity.source}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <Link
                href={`/graph?entityId=${entity.id}`}
                className="block w-full text-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
              >
                View in Graph
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 