import { z } from 'zod';

// Entity schema definition
export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  entityType: z.string(), // Component, Feature, Concept, etc.
  projectId: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  confidence: z.number().min(0).max(1), // 0.0 to 1.0
  createdAt: z.date(),
  updatedAt: z.date(),
  source: z.string().optional(), // Conversation ID or other source
});

export type Entity = z.infer<typeof EntitySchema>;

// Relationship schema definition
export const RelationshipSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  relationType: z.string(), // DependsOn, Contains, Implements, etc.
  strength: z.number().min(0).max(1), // 0.0 to 1.0
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: z.string().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// Observation schema definition
export const ObservationSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1), // 0.0 to 1.0
  version: z.number().int().positive(),
  isValid: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: z.string().optional(),
});

export type Observation = z.infer<typeof ObservationSchema>;

// Project schema definition
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Project = z.infer<typeof ProjectSchema>;

// Entity Types
export const EntityTypes = [
  'Component',
  'Feature',
  'Concept',
  'Technology',
  'Process',
] as const;

export type EntityType = typeof EntityTypes[number];

// Relationship Types
export const RelationshipTypes = [
  'DependsOn',
  'Contains',
  'Implements',
  'Uses',
  'Extends',
] as const;

export type RelationshipType = typeof RelationshipTypes[number];

// Context Query Parameters
export const ContextQuerySchema = z.object({
  filePath: z.string().optional(),
  entityName: z.string().optional(),
  entityType: z.string().optional(),
  projectId: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;

// Agent Knowledge Update Schema
export const AgentKnowledgeUpdateSchema = z.object({
  projectId: z.string(),
  projectName: z.string().optional(),
  conversationId: z.string(),
  entities: z.array(
    z.object({
      name: z.string(),
      entityType: z.string(),
      metadata: z.record(z.string(), z.any()).optional(),
      confidence: z.number().min(0).max(1).optional(),
      observations: z.array(z.string()).optional(),
    })
  ),
  relationships: z.array(
    z.object({
      fromEntityName: z.string(),
      toEntityName: z.string(),
      relationType: z.string(),
      strength: z.number().min(0).max(1).optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    })
  ).optional(),
});

export type AgentKnowledgeUpdate = z.infer<typeof AgentKnowledgeUpdateSchema>;

// Agent Knowledge Invalidation Schema
export const AgentKnowledgeInvalidationSchema = z.object({
  entityIds: z.array(z.string()).optional(),
  entityNames: z.array(z.string()).optional(),
  relationshipIds: z.array(z.string()).optional(),
  observationIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

export type AgentKnowledgeInvalidation = z.infer<typeof AgentKnowledgeInvalidationSchema>;

// Agent Confidence Update Schema
export const AgentConfidenceUpdateSchema = z.object({
  updates: z.array(
    z.object({
      entityId: z.string().optional(),
      entityName: z.string().optional(),
      relationshipId: z.string().optional(),
      observationId: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export type AgentConfidenceUpdate = z.infer<typeof AgentConfidenceUpdateSchema>;

// Agent Metadata Request Schema
export const AgentMetadataRequestSchema = z.object({
  projectId: z.string().optional(),
  includeStats: z.boolean().optional(),
  includeEntityTypes: z.boolean().optional(),
  includeRelationshipTypes: z.boolean().optional(),
});

export type AgentMetadataRequest = z.infer<typeof AgentMetadataRequestSchema>; 