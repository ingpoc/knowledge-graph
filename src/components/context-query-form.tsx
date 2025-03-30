import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Search, Filter, RefreshCw, X } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface ContextQueryFormProps {
  projects: Project[];
  onSearch: (params: any) => void;
  isLoading?: boolean;
  defaultQuery?: string;
  defaultProjectId?: string;
}

export function ContextQueryForm({
  projects,
  onSearch,
  isLoading = false,
  defaultQuery = '',
  defaultProjectId = '',
}: ContextQueryFormProps) {
  // Basic search params
  const [query, setQuery] = useState(defaultQuery);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Advanced search params
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0.3);
  const [maxResults, setMaxResults] = useState(20);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeRelationships, setIncludeRelationships] = useState(false);
  const [relationshipDepth, setRelationshipDepth] = useState(1);
  const [sortBy, setSortBy] = useState('relevance');
  const [fuzzyMatch, setFuzzyMatch] = useState(true);
  
  // Semantic search params
  const [semanticMode, setSemanticMode] = useState('text');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticFile, setSemanticFile] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Applied filters for display
  const [activeFilters, setActiveFilters] = useState<{[key: string]: any}>({});
  
  // Entity type options
  const entityTypeOptions = [
    { value: 'function', label: 'Function' },
    { value: 'class', label: 'Class' },
    { value: 'variable', label: 'Variable' },
    { value: 'file', label: 'File' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'comment', label: 'Comment' },
    { value: 'import', label: 'Import' },
    { value: 'export', label: 'Export' },
    { value: 'concept', label: 'Concept' }
  ];
  
  // Update active filters when form values change
  useEffect(() => {
    const filters: {[key: string]: any} = {};
    
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      filters.project = project ? project.name : projectId;
    }
    
    if (entityTypes.length > 0) {
      filters.entityTypes = entityTypes;
    }
    
    if (confidence !== 0.3) {
      filters.confidence = confidence;
    }
    
    if (maxResults !== 20) {
      filters.maxResults = maxResults;
    }
    
    if (sortBy !== 'relevance') {
      filters.sortBy = sortBy;
    }
    
    if (!fuzzyMatch) {
      filters.exactMatch = true;
    }
    
    if (includeRelationships) {
      filters.includeRelationships = true;
      filters.relationshipDepth = relationshipDepth;
    }
    
    setActiveFilters(filters);
  }, [projectId, entityTypes, confidence, maxResults, sortBy, fuzzyMatch, includeRelationships, relationshipDepth, projects]);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build search params based on active tab
    let searchParams: any = {};
    
    if (activeTab === 'basic' || activeTab === 'advanced') {
      searchParams = {
        query,
        projectId: projectId || undefined,
        entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
        maxResults,
        minConfidence: confidence,
        includeMetadata,
        includeRelationships,
        maxRelationshipDepth: relationshipDepth,
        fuzzyMatch,
        sortBy,
      };
    } else if (activeTab === 'semantic') {
      // Handle semantic search differently based on mode
      if (semanticMode === 'text') {
        searchParams = {
          semanticQuery: semanticQuery,
          projectId: projectId || undefined,
          entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
          maxResults,
          minConfidence: confidence,
        };
      } else if (semanticMode === 'file') {
        searchParams = {
          filePath: semanticFile,
          projectId: projectId || undefined,
          maxResults,
          minConfidence: confidence,
        };
      }
    }
    
    onSearch(searchParams);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setEntityTypes([]);
    setConfidence(0.3);
    setMaxResults(20);
    setIncludeMetadata(true);
    setIncludeRelationships(false);
    setRelationshipDepth(1);
    setSortBy('relevance');
    setFuzzyMatch(true);
    setSemanticMode('text');
    setSemanticQuery('');
    setSemanticFile('');
    setShowAdvancedOptions(false);
  };
  
  // Remove a specific filter
  const removeFilter = (key: string) => {
    switch (key) {
      case 'project':
        setProjectId('');
        break;
      case 'entityTypes':
        setEntityTypes([]);
        break;
      case 'confidence':
        setConfidence(0.3);
        break;
      case 'maxResults':
        setMaxResults(20);
        break;
      case 'sortBy':
        setSortBy('relevance');
        break;
      case 'exactMatch':
        setFuzzyMatch(true);
        break;
      case 'includeRelationships':
        setIncludeRelationships(false);
        setRelationshipDepth(1);
        break;
      default:
        break;
    }
  };
  
  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <CardTitle>Knowledge Graph Query</CardTitle>
        <CardDescription>Search and explore code context from the knowledge graph</CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Search</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
            <TabsTrigger value="semantic">Semantic Search</TabsTrigger>
          </TabsList>
        </div>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6">
            <TabsContent value="basic" className="mt-0">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="basic-query">Search Query</Label>
                    <div className="relative">
                      <Input
                        id="basic-query"
                        placeholder="Enter search terms..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pr-10"
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="w-1/3">
                    <Label htmlFor="basic-project">Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger id="basic-project">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="advanced" className="mt-0">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="advanced-query">Search Query</Label>
                    <Input
                      id="advanced-query"
                      placeholder="Enter search terms..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="w-1/3">
                    <Label htmlFor="advanced-project">Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger id="advanced-project">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label>Entity Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {entityTypeOptions.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`entity-type-${type.value}`}
                          checked={entityTypes.includes(type.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEntityTypes([...entityTypes, type.value]);
                            } else {
                              setEntityTypes(entityTypes.filter(t => t !== type.value));
                            }
                          }}
                        />
                        <Label htmlFor={`entity-type-${type.value}`} className="text-sm">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="p-0 flex items-center justify-between w-full">
                      <span className="font-semibold">Advanced Options</span>
                      {showAdvancedOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="confidence" className="mb-2 block">
                          Minimum Confidence: {confidence.toFixed(2)}
                        </Label>
                        <Slider
                          id="confidence"
                          min={0}
                          max={1}
                          step={0.05}
                          value={[confidence]}
                          onValueChange={(values) => setConfidence(values[0])}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="max-results" className="mb-2 block">
                          Maximum Results: {maxResults}
                        </Label>
                        <Slider
                          id="max-results"
                          min={5}
                          max={100}
                          step={5}
                          value={[maxResults]}
                          onValueChange={(values) => setMaxResults(values[0])}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sort-by">Sort By</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger id="sort-by">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relevance">Relevance</SelectItem>
                            <SelectItem value="confidence">Confidence</SelectItem>
                            <SelectItem value="updated">Last Updated</SelectItem>
                            <SelectItem value="created">Creation Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="fuzzy-match"
                            checked={fuzzyMatch}
                            onCheckedChange={(checked) => setFuzzyMatch(!!checked)}
                          />
                          <Label htmlFor="fuzzy-match">Fuzzy Matching</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="include-metadata"
                            checked={includeMetadata}
                            onCheckedChange={(checked) => setIncludeMetadata(!!checked)}
                          />
                          <Label htmlFor="include-metadata">Include Metadata</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="include-relationships"
                            checked={includeRelationships}
                            onCheckedChange={(checked) => setIncludeRelationships(!!checked)}
                          />
                          <Label htmlFor="include-relationships">Include Relationships</Label>
                        </div>
                      </div>
                    </div>
                    
                    {includeRelationships && (
                      <div>
                        <Label htmlFor="relationship-depth" className="mb-2 block">
                          Relationship Depth: {relationshipDepth}
                        </Label>
                        <Slider
                          id="relationship-depth"
                          min={1}
                          max={3}
                          step={1}
                          value={[relationshipDepth]}
                          onValueChange={(values) => setRelationshipDepth(values[0])}
                        />
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </TabsContent>
            
            <TabsContent value="semantic" className="mt-0">
              <div className="flex flex-col gap-4">
                <div className="mb-4">
                  <div className="flex space-x-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="semantic-text"
                        name="semantic-mode"
                        value="text"
                        checked={semanticMode === 'text'}
                        onChange={() => setSemanticMode('text')}
                      />
                      <Label htmlFor="semantic-text">Text Query</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="semantic-file"
                        name="semantic-mode"
                        value="file"
                        checked={semanticMode === 'file'}
                        onChange={() => setSemanticMode('file')}
                      />
                      <Label htmlFor="semantic-file">File Path</Label>
                    </div>
                  </div>
                  
                  {semanticMode === 'text' ? (
                    <div>
                      <Label htmlFor="semantic-query" className="mb-2 block">Semantic Query</Label>
                      <Textarea
                        id="semantic-query"
                        placeholder="Describe what you're looking for in natural language..."
                        value={semanticQuery}
                        onChange={(e) => setSemanticQuery(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="semantic-file" className="mb-2 block">File Path</Label>
                      <Input
                        id="semantic-file"
                        placeholder="Enter file path to find related code..."
                        value={semanticFile}
                        onChange={(e) => setSemanticFile(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <Label htmlFor="semantic-project">Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger id="semantic-project">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="w-1/2">
                    <Label htmlFor="semantic-max-results" className="mb-2 block">
                      Maximum Results: {maxResults}
                    </Label>
                    <Slider
                      id="semantic-max-results"
                      min={5}
                      max={100}
                      step={5}
                      value={[maxResults]}
                      onValueChange={(values) => setMaxResults(values[0])}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Active Filters */}
            {Object.keys(activeFilters).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(activeFilters).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1">
                    <span>{key}: {Array.isArray(value) ? value.join(', ') : value}</span>
                    <X 
                      size={14} 
                      className="ml-1 cursor-pointer"
                      onClick={() => removeFilter(key)} 
                    />
                  </Badge>
                ))}
                
                {Object.keys(activeFilters).length > 0 && (
                  <Button
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={resetFilters}
                    className="h-6 flex items-center gap-1 text-xs"
                  >
                    <RefreshCw size={12} />
                    Reset All
                  </Button>
                )}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={resetFilters}>
              Reset
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Tabs>
    </Card>
  );
} 