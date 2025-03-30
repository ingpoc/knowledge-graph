"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RelationshipTypes } from "@/lib/types";

interface CreateRelationshipButtonProps {
  entityId: string;
  projectId: string;
}

export function CreateRelationshipButton({ entityId, projectId }: CreateRelationshipButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [targetEntity, setTargetEntity] = useState("");
  const [relationType, setRelationType] = useState(RelationshipTypes[0]);
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [entities, setEntities] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const openModal = async () => {
    setIsOpen(true);
    try {
      // Fetch entities excluding the current one
      const res = await fetch(`/api/entities?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch entities");
      const data = await res.json();
      setEntities(data.filter((e: any) => e.id !== entityId));
    } catch (error) {
      console.error("Error loading entities:", error);
      toast.error("Failed to load entities");
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setTargetEntity("");
    setRelationType(RelationshipTypes[0]);
    setDirection("outgoing");
    setSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEntity) {
      toast.error("Please select a target entity");
      return;
    }

    setIsLoading(true);
    try {
      const relationshipData = {
        fromEntityId: direction === "outgoing" ? entityId : targetEntity,
        toEntityId: direction === "outgoing" ? targetEntity : entityId,
        relationType: relationType,
        strength: 0.8,
        metadata: {}
      };

      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(relationshipData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create relationship");
      }

      toast.success("Relationship created successfully");
      router.refresh();
      closeModal();
    } catch (error: any) {
      toast.error(error.message || "Failed to create relationship");
      console.error("Error creating relationship:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntities = entities.filter(entity => 
    entity.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        onClick={openModal}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Add Relationship
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Create Relationship</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Direction</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={direction === "outgoing"}
                        onChange={() => setDirection("outgoing")}
                        className="mr-2"
                      />
                      Outgoing
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={direction === "incoming"}
                        onChange={() => setDirection("incoming")}
                        className="mr-2"
                      />
                      Incoming
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Relationship Type</label>
                  <select
                    value={relationType}
                    onChange={(e) => setRelationType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary"
                  >
                    {RelationshipTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Target Entity</label>
                  <input
                    type="text"
                    placeholder="Search entities..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary mb-2"
                  />
                  
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredEntities.length === 0 ? (
                      <p className="p-3 text-muted-foreground text-center">No entities found</p>
                    ) : (
                      filteredEntities.map(entity => (
                        <label
                          key={entity.id}
                          className={`flex items-center p-2 hover:bg-secondary/50 cursor-pointer ${
                            targetEntity === entity.id ? "bg-secondary" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="targetEntity"
                            value={entity.id}
                            checked={targetEntity === entity.id}
                            onChange={() => setTargetEntity(entity.id)}
                            className="mr-2"
                          />
                          <div>
                            <div>{entity.name}</div>
                            <div className="text-xs text-muted-foreground">{entity.entity_type}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-md hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !targetEntity}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 