"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { EntityTypes } from "@/lib/types";

interface EntityFormData {
  name: string;
  entityType: string;
  confidence: number;
  description?: string;
}

export default function NewEntityPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<EntityFormData>({
    name: "",
    entityType: "Component",
    confidence: 0.7,
    description: "",
  });

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${params.projectId}`);
        if (!res.ok) {
          if (res.status === 404) {
            router.push("/projects");
            toast.error("Project not found");
            return;
          }
          throw new Error("Failed to fetch project");
        }
        const data = await res.json();
        setProject(data);
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [params.projectId, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "confidence" ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Entity name is required");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          projectId: params.projectId,
          metadata: { description: formData.description },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create entity");
      }
      
      const entity = await response.json();
      toast.success("Entity created successfully");
      router.push(`/projects/${params.projectId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create entity");
      console.error("Error creating entity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Add Entity to {project.name}</h1>
        <p className="text-muted-foreground mt-2">
          Create a new entity in your knowledge graph
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium">
            Entity Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary"
            placeholder="Enter entity name"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="entityType" className="block text-sm font-medium">
            Entity Type *
          </label>
          <select
            id="entityType"
            name="entityType"
            value={formData.entityType}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary"
          >
            {EntityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="confidence" className="block text-sm font-medium">
            Confidence ({formData.confidence})
          </label>
          <input
            id="confidence"
            name="confidence"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={formData.confidence}
            onChange={handleChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low (0.1)</span>
            <span>Medium (0.5)</span>
            <span>High (1.0)</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary"
            placeholder="Enter entity description"
          />
        </div>
        
        <div className="flex gap-4 pt-4">
          <Link
            href={`/projects/${params.projectId}`}
            className="px-4 py-2 border rounded-md hover:bg-secondary/80"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Entity"}
          </button>
        </div>
      </form>
    </div>
  );
} 