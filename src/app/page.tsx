import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-6">Knowledge Graph MCP</h1>
        <div className="flex flex-row space-x-4">
          <Link 
            href="/projects"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            View Projects
          </Link>
          <Link 
            href="/graph"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            Explore Graph
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="p-6 bg-card text-card-foreground rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Project Management</h2>
          <p className="text-muted-foreground">Create and manage projects to organize your knowledge graph.</p>
        </div>
        <div className="p-6 bg-card text-card-foreground rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Entity Management</h2>
          <p className="text-muted-foreground">Add and manage entities in your knowledge graph system.</p>
        </div>
        <div className="p-6 bg-card text-card-foreground rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Relationship Visualization</h2>
          <p className="text-muted-foreground">Visualize connections between entities across projects.</p>
        </div>
      </div>
    </main>
  );
} 