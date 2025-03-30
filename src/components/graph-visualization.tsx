"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  name: string;
  entityType: string;
  group?: number;
  radius?: number;
}

interface Link {
  source: string;
  target: string;
  value: number;
  relationType: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface GraphVisualizationProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export function GraphVisualization({
  data,
  width = 800,
  height = 600,
  onNodeClick,
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Create the graph
  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    // Initialize SVG container
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    // Add zoom functionality
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create a group for all elements
    const g = svg.append("g");

    // Add zoom controls
    svg
      .append("rect")
      .attr("x", -width / 2 + 10)
      .attr("y", -height / 2 + 10)
      .attr("width", 30)
      .attr("height", 30)
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", "rgba(255, 255, 255, 0.8)")
      .attr("stroke", "#ccc")
      .style("cursor", "pointer")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.scaleBy as any, 1.3);
      })
      .append("title")
      .text("Zoom in");

    svg
      .append("text")
      .attr("x", -width / 2 + 25)
      .attr("y", -height / 2 + 25)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("+")
      .style("font-size", "18px")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.scaleBy as any, 1.3);
      });

    svg
      .append("rect")
      .attr("x", -width / 2 + 10)
      .attr("y", -height / 2 + 50)
      .attr("width", 30)
      .attr("height", 30)
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", "rgba(255, 255, 255, 0.8)")
      .attr("stroke", "#ccc")
      .style("cursor", "pointer")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.scaleBy as any, 0.7);
      })
      .append("title")
      .text("Zoom out");

    svg
      .append("text")
      .attr("x", -width / 2 + 25)
      .attr("y", -height / 2 + 65)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("-")
      .style("font-size", "18px")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.scaleBy as any, 0.7);
      });

    svg
      .append("rect")
      .attr("x", -width / 2 + 10)
      .attr("y", -height / 2 + 90)
      .attr("width", 30)
      .attr("height", 30)
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", "rgba(255, 255, 255, 0.8)")
      .attr("stroke", "#ccc")
      .style("cursor", "pointer")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.transform as any, d3.zoomIdentity);
      })
      .append("title")
      .text("Reset zoom");

    svg
      .append("text")
      .attr("x", -width / 2 + 25)
      .attr("y", -height / 2 + 105)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("R")
      .style("font-size", "14px")
      .style("cursor", "pointer")
      .style("user-select", "none")
      .on("click", () => {
        svg
          .transition()
          .duration(500)
          .call(zoom.transform as any, d3.zoomIdentity);
      });

    // Define color scale for node types
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Define node size based on connections
    const nodeLinkCount = new Map();
    data.links.forEach(link => {
      nodeLinkCount.set(link.source, (nodeLinkCount.get(link.source) || 0) + 1);
      nodeLinkCount.set(link.target, (nodeLinkCount.get(link.target) || 0) + 1);
    });

    // Convert data to the format D3 expects
    const nodesWithRadii = data.nodes.map(node => ({
      ...node,
      radius: Math.max(5, Math.min(15, (nodeLinkCount.get(node.id) || 0) * 2 + 5))
    }));

    const nodeById = new Map(nodesWithRadii.map(node => [node.id, node]));
    
    const links = data.links.map(link => ({
      source: nodeById.get(link.source) || link.source,
      target: nodeById.get(link.target) || link.target,
      value: link.value,
      relationType: link.relationType
    }));

    // Create simulation
    const simulation = d3
      .forceSimulation(nodesWithRadii as any)
      .force("charge", d3.forceManyBody().strength(-300))
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("center", d3.forceCenter(0, 0))
      .force("collision", d3.forceCollide().radius((d: any) => d.radius + 10));

    // Create links
    const link = g
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.sqrt(d.value) * 2)
      .attr("marker-end", "url(#arrow)");

    // Add arrowhead marker definition
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 27)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    // Add relationship type labels to links
    const linkText = g
      .append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("dy", -5)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .style("font-size", "8px")
      .style("pointer-events", "none")
      .text((d: any) => d.relationType);

    // Create nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodesWithRadii)
      .join("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => color(d.entityType))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", (_, d: any) => {
        if (onNodeClick) onNodeClick(d.id);
      })
      .on("mouseover", (_, d: any) => {
        setHoveredNode(d);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      })
      .call(
        d3.drag<SVGCircleElement, Node>()
          .on("start", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Add node labels
    const nodeLabels = g
      .append("g")
      .selectAll("text")
      .data(nodesWithRadii)
      .join("text")
      .attr("dy", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text((d: any) => d.name);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      nodeLabels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);

      linkText
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);
    });

    // Clean up on component unmount
    return () => {
      simulation.stop();
    };
  }, [data, width, height, onNodeClick]);

  return (
    <div className="relative">
      <svg ref={svgRef} className="border rounded-lg bg-card/50 cursor-grab active:cursor-grabbing" />
      
      {hoveredNode && (
        <div
          className="absolute p-2 bg-card border rounded shadow-md z-10"
          style={{
            top: (height / 2) + (hoveredNode as any).y + 10,
            left: (width / 2) + (hoveredNode as any).x + 10,
          }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          <div className="text-xs text-muted-foreground">{hoveredNode.entityType}</div>
        </div>
      )}
    </div>
  );
} 