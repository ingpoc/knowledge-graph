/**
 * Agent Client Library for Knowledge Graph MCP
 * 
 * This library provides a client for AI agents to interact with the Knowledge Graph
 * Model Context Protocol (MCP) server. It handles storing, retrieving, and managing
 * knowledge across multiple sessions.
 */

import { 
  AgentKnowledgeUpdate, 
  AgentKnowledgeInvalidation,
  AgentConfidenceUpdate,
  EntityType, 
  RelationshipType 
} from './types';

interface AgentClientOptions {
  baseUrl?: string;
  defaultProjectId?: string;
  defaultProjectName?: string;
  defaultConfidence?: number;
}

export class AgentClient {
  private baseUrl: string;
  private defaultProjectId: string;
  private defaultProjectName: string;
  private defaultConfidence: number;
  
  constructor(options: AgentClientOptions = {}) {
    this.baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    this.defaultProjectId = options.defaultProjectId || 'default';
    this.defaultProjectName = options.defaultProjectName || 'Default Project';
    this.defaultConfidence = options.defaultConfidence || 0.5;
  }
  
  /**
   * Get available projects
   */
  async getProjects() {
    try {
      const response = await fetch(`${this.baseUrl}/api/projects`);
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }
  
  /**
   * Find or create a project for a given name
   */
  async findOrCreateProject(name: string, description?: string) {
    try {
      // First try to find project with this name
      const projects = await this.getProjects();
      const existingProject = projects.find((p: any) => p.name === name);
      
      if (existingProject) {
        return existingProject;
      }
      
      // Create the project if it doesn't exist
      const projectId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const response = await fetch(`${this.baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: projectId,
          name,
          description: description || `Project for ${name}`,
          metadata: {},
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error finding or creating project:', error);
      throw error;
    }
  }
  
  /**
   * Query context from the knowledge graph
   */
  async queryContext(query: string, options: {
    projectId?: string;
    entityTypes?: string[];
    maxResults?: number;
    confidence?: number;
  } = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          projectId: options.projectId,
          entityTypes: options.entityTypes,
          maxResults: options.maxResults || 10,
          confidence: options.confidence,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to query context: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error querying context:', error);
      throw error;
    }
  }
  
  /**
   * Update knowledge from a conversation
   */
  async updateKnowledge(update: Partial<AgentKnowledgeUpdate>) {
    try {
      // Ensure required fields are present
      const fullUpdate: AgentKnowledgeUpdate = {
        projectId: update.projectId || this.defaultProjectId,
        projectName: update.projectName || this.defaultProjectName,
        conversationId: update.conversationId || `session-${Date.now()}`,
        entities: update.entities || [],
        relationships: update.relationships || [],
      };
      
      const response = await fetch(`${this.baseUrl}/api/agent/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullUpdate),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update knowledge: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating knowledge:', error);
      throw error;
    }
  }
  
  /**
   * Invalidate outdated knowledge
   */
  async invalidateKnowledge(invalidation: AgentKnowledgeInvalidation) {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidation),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to invalidate knowledge: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error invalidating knowledge:', error);
      throw error;
    }
  }
  
  /**
   * Update confidence scores
   */
  async updateConfidence(updates: AgentConfidenceUpdate) {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent/confidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update confidence: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating confidence:', error);
      throw error;
    }
  }
  
  /**
   * Get metadata about the knowledge graph
   */
  async getMetadata(options: {
    projectId?: string;
    includeStats?: boolean;
    includeEntityTypes?: boolean;
    includeRelationshipTypes?: boolean;
  } = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.projectId) {
        params.append('projectId', options.projectId);
      }
      
      if (options.includeStats !== undefined) {
        params.append('includeStats', options.includeStats.toString());
      }
      
      if (options.includeEntityTypes !== undefined) {
        params.append('includeEntityTypes', options.includeEntityTypes.toString());
      }
      
      if (options.includeRelationshipTypes !== undefined) {
        params.append('includeRelationshipTypes', options.includeRelationshipTypes.toString());
      }
      
      const response = await fetch(`${this.baseUrl}/api/agent/meta?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get metadata: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting metadata:', error);
      throw error;
    }
  }
  
  /**
   * Helper to extract context based on code file path
   */
  async getContextForFile(filePath: string, projectId?: string) {
    return this.queryContext(filePath, {
      projectId: projectId || this.defaultProjectId
    });
  }
  
  /**
   * Helper to create knowledge from code analysis
   */
  async createKnowledgeFromCodeAnalysis(
    projectId: string,
    conversationId: string,
    entities: Array<{
      name: string,
      entityType: EntityType | string,
      description?: string,
      filePath?: string
    }>,
    relationships: Array<{
      fromEntityName: string,
      toEntityName: string,
      relationType: RelationshipType | string
    }> = []
  ) {
    // Prepare the knowledge update
    const update: AgentKnowledgeUpdate = {
      projectId,
      conversationId,
      entities: entities.map(entity => ({
        name: entity.name,
        entityType: entity.entityType,
        metadata: {
          filePath: entity.filePath,
          description: entity.description
        },
        confidence: this.defaultConfidence,
        observations: entity.description ? [entity.description] : []
      })),
      relationships: relationships.map(rel => ({
        fromEntityName: rel.fromEntityName,
        toEntityName: rel.toEntityName,
        relationType: rel.relationType,
        strength: this.defaultConfidence
      }))
    };
    
    return this.updateKnowledge(update);
  }
} 