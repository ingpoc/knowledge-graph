# Knowledge Graph MCP

A knowledge graph management system built with Next.js that enables the creation, visualization, and querying of knowledge graphs for AI agent integration.

## Features

- **Project Management**: Create and manage knowledge graph projects
- **Entity Management**: Add, edit, and delete entities with confidence scoring
- **Relationship Management**: Create connections between entities with relationship types
- **Graph Visualization**: Interactive D3.js visualization of knowledge graphs
- **Context API**: AI agent integration via API endpoints
- **Dark/Light Mode**: Full theme support
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI, Radix UI
- **Data Visualization**: D3.js
- **Database**: DuckDB (embedded SQL database)
- **Validation**: Zod schema validation
- **Styling**: Tailwind CSS with dark mode support

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/knowledge-graph-mcp.git
cd knowledge-graph-mcp
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Run the development server

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application

## Usage

### Creating a Project

1. Navigate to the Projects page
2. Click "New Project"
3. Enter project details and save

### Adding Entities

1. Navigate to a project
2. Click "Add Entity"
3. Fill in entity details (name, type, confidence, description)
4. Save the entity

### Creating Relationships

1. Navigate to an entity page
2. Click "Add Relationship"
3. Select the target entity and relationship type
4. Set relationship strength and save

### Visualizing the Knowledge Graph

1. Navigate to the Graph page
2. Use filters to display specific projects or entity types
3. Click on nodes to explore connections
4. Zoom and pan to navigate the graph

## API Documentation

### Graph API

**Endpoint**: `GET /api/graph`

Query parameters:
- `projectId`: Filter by project ID
- `entityId`: Show only relationships connected to this entity
- `entityTypes`: Filter by entity types (comma-separated)
- `relationshipTypes`: Filter by relationship types (comma-separated)

Example response:
```json
{
  "nodes": [
    {
      "id": "entity-1",
      "name": "Authentication",
      "entityType": "Component",
      "group": 1
    }
  ],
  "links": [
    {
      "source": "entity-1",
      "target": "entity-2",
      "value": 2,
      "relationType": "DependsOn"
    }
  ],
  "entityTypes": ["Component", "Feature"]
}
```

### Context API

**Endpoint**: `POST /api/context`

Request body:
```json
{
  "query": "authentication",
  "projectId": "project-123",
  "entityTypes": ["Component", "Feature"],
  "maxResults": 10,
  "confidence": 0.5
}
```

Response:
```json
{
  "query": "authentication",
  "results": [
    {
      "id": "entity-1",
      "name": "Authentication",
      "entityType": "Component",
      "confidence": 0.9,
      "metadata": {
        "description": "User authentication system"
      },
      "projectId": "project-123",
      "projectName": "Web Application",
      "relationships": {
        "outgoing": [],
        "incoming": []
      }
    }
  ],
  "total": 1
}
```

## Project Structure

```
/src
  /app                   # Next.js App Router
    /(main)              # Main application routes
      /api-client        # API testing client
      /graph             # Graph visualization
      /projects          # Project management
    /api                 # API routes
  /components            # React components
  /lib                   # Utilities and shared code
  /styles                # Global styles
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
