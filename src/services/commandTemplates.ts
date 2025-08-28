import { invoke } from '@tauri-apps/api/core';

export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  parameters: TemplateParameter[];
  category: 'git' | 'docker' | 'file-ops' | 'dev' | 'system' | 'network' | 'custom';
  tags: string[];
  usage: {
    count: number;
    lastUsed: Date;
    averageExecutionTime: number;
  };
  author?: string;
  version: string;
  isPublic: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateParameter {
  name: string;
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'path' | 'url' | 'enum' | 'multi-enum';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  placeholder?: string;
  helpText?: string;
  dependsOn?: string; // Name of another parameter this depends on
  showIf?: string; // Condition for when to show this parameter
}

export interface TemplateExecution {
  id: string;
  templateId: string;
  command: string;
  parameters: Record<string, string>;
  executionTime: number;
  exitCode: number;
  output: string;
  error?: string;
  timestamp: Date;
  context: {
    workingDirectory: string;
    environment: Record<string, string>;
  };
}

export interface TemplateCollection {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
  tags: string[];
  isPublic: boolean;
  author?: string;
  createdAt: Date;
}

export class CommandTemplateService {
  private templates = new Map<string, CommandTemplate>();
  private collections = new Map<string, TemplateCollection>();
  private executionHistory: TemplateExecution[] = [];
  private parameterCache = new Map<string, Record<string, string>>();
  
  /**
   * Create a new template
   */
  createTemplate(
    name: string,
    description: string,
    template: string,
    parameters: TemplateParameter[],
    options: {
      category?: CommandTemplate['category'];
      tags?: string[];
      author?: string;
      isPublic?: boolean;
    } = {}
  ): string {
    const templateId = this.generateTemplateId();
    
    const commandTemplate: CommandTemplate = {
      id: templateId,
      name,
      description,
      template,
      parameters,
      category: options.category || 'custom',
      tags: options.tags || [],
      usage: {
        count: 0,
        lastUsed: new Date(),
        averageExecutionTime: 0
      },
      author: options.author,
      version: '1.0.0',
      isPublic: options.isPublic || false,
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.templates.set(templateId, commandTemplate);
    return templateId;
  }
  
  /**
   * Update existing template
   */
  updateTemplate(templateId: string, updates: Partial<CommandTemplate>): void {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('Template not found');
    
    Object.assign(template, updates);
    template.updatedAt = new Date();
    
    // Increment version for template changes
    if (updates.template || updates.parameters) {
      const [major, minor, patch] = template.version.split('.').map(Number);
      template.version = `${major}.${minor}.${patch + 1}`;
    }
    
    this.templates.set(templateId, template);
  }
  
  /**
   * Delete template
   */
  deleteTemplate(templateId: string): void {
    this.templates.delete(templateId);
    
    // Remove from collections
    for (const collection of this.collections.values()) {
      collection.templateIds = collection.templateIds.filter(id => id !== templateId);
    }
  }
  
  /**
   * Get template by ID
   */
  getTemplate(templateId: string): CommandTemplate | null {
    return this.templates.get(templateId) || null;
  }
  
  /**
   * Search templates
   */
  searchTemplates(query: string, options: {
    category?: string;
    tags?: string[];
    includePublic?: boolean;
    sortBy?: 'name' | 'usage' | 'created' | 'updated';
  } = {}): CommandTemplate[] {
    const templates = Array.from(this.templates.values());
    
    let filtered = templates.filter(template => {
      // Text search
      const searchText = `${template.name} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
      const queryMatch = query.toLowerCase().split(' ').every(term => searchText.includes(term));
      
      if (!queryMatch) return false;
      
      // Category filter
      if (options.category && template.category !== options.category) return false;
      
      // Tags filter
      if (options.tags && !options.tags.some(tag => template.tags.includes(tag))) return false;
      
      // Public filter
      if (options.includePublic === false && template.isPublic) return false;
      
      return true;
    });
    
    // Sort results
    if (options.sortBy) {
      filtered.sort((a, b) => {
        switch (options.sortBy) {
          case 'name': return a.name.localeCompare(b.name);
          case 'usage': return b.usage.count - a.usage.count;
          case 'created': return b.createdAt.getTime() - a.createdAt.getTime();
          case 'updated': return b.updatedAt.getTime() - a.updatedAt.getTime();
          default: return 0;
        }
      });
    }
    
    return filtered;
  }
  
  /**
   * Execute template with parameters
   */
  async executeTemplate(
    templateId: string, 
    parameters: Record<string, string>,
    options: {
      dryRun?: boolean;
      saveExecution?: boolean;
      workingDirectory?: string;
    } = {}
  ): Promise<TemplateExecutionResult> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error('Template not found');
    
    // Validate parameters
    const validation = this.validateParameters(template.parameters, parameters);
    if (!validation.valid) {
      throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Build command from template
    const command = this.buildCommand(template.template, parameters);
    
    if (options.dryRun) {
      return {
        command,
        parameters,
        dryRun: true
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Execute command
      const result = await invoke<{output: string; exitCode: number}>('execute_template_command', {
        command,
        workingDirectory: options.workingDirectory
      });
      
      const executionTime = Date.now() - startTime;
      
      // Update template usage
      template.usage.count++;
      template.usage.lastUsed = new Date();
      template.usage.averageExecutionTime = 
        (template.usage.averageExecutionTime + executionTime) / 2;
      
      // Save execution history
      if (options.saveExecution !== false) {
        const execution: TemplateExecution = {
          id: this.generateExecutionId(),
          templateId,
          command,
          parameters,
          executionTime,
          exitCode: result.exitCode,
          output: result.output,
          timestamp: new Date(),
          context: {
            workingDirectory: options.workingDirectory || process.cwd(),
            environment: process.env as Record<string, string>
          }
        };
        
        this.executionHistory.push(execution);
        if (this.executionHistory.length > 1000) {
          this.executionHistory.shift();
        }
      }
      
      // Cache parameters for future use
      this.parameterCache.set(templateId, parameters);
      
      return {
        command,
        parameters,
        output: result.output,
        exitCode: result.exitCode,
        executionTime,
        dryRun: false
      };
    } catch (error) {
      throw new Error(`Template execution failed: ${error}`);
    }
  }
  
  /**
   * Get parameter suggestions based on history
   */
  getParameterSuggestions(templateId: string): Record<string, string[]> {
    const suggestions: Record<string, string[]> = {};
    
    // Get suggestions from execution history
    const executions = this.executionHistory
      .filter(e => e.templateId === templateId)
      .slice(-50); // Recent 50 executions
    
    for (const execution of executions) {
      for (const [param, value] of Object.entries(execution.parameters)) {
        if (!suggestions[param]) suggestions[param] = [];
        if (!suggestions[param].includes(value)) {
          suggestions[param].push(value);
        }
      }
    }
    
    // Limit suggestions per parameter
    for (const param in suggestions) {
      suggestions[param] = suggestions[param].slice(0, 10);
    }
    
    return suggestions;
  }
  
  private validateParameters(
    templateParams: TemplateParameter[], 
    providedParams: Record<string, string>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const param of templateParams) {
      const value = providedParams[param.name];
      
      // Check required parameters
      if (param.required && !value) {
        errors.push(`Required parameter '${param.name}' is missing`);
        continue;
      }
      
      if (!value) continue;
      
      // Type validation
      if (param.type === 'number' && isNaN(Number(value))) {
        errors.push(`Parameter '${param.name}' must be a number`);
      }
      
      if (param.type === 'boolean' && !['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        errors.push(`Parameter '${param.name}' must be a boolean`);
      }
      
      if (param.type === 'url') {
        try {
          new URL(value);
        } catch {
          errors.push(`Parameter '${param.name}' must be a valid URL`);
        }
      }
      
      if (param.type === 'enum' && param.options && !param.options.includes(value)) {
        errors.push(`Parameter '${param.name}' must be one of: ${param.options.join(', ')}`);
      }
      
      // Validation rules
      if (param.validation) {
        const val = param.validation;
        
        if (val.pattern) {
          try {
            const regex = new RegExp(val.pattern);
            if (!regex.test(value)) {
              errors.push(`Parameter '${param.name}' doesn't match required pattern`);
            }
          } catch {
            errors.push(`Invalid pattern for parameter '${param.name}'`);
          }
        }
        
        if (val.minLength && value.length < val.minLength) {
          errors.push(`Parameter '${param.name}' must be at least ${val.minLength} characters`);
        }
        
        if (val.maxLength && value.length > val.maxLength) {
          errors.push(`Parameter '${param.name}' must be at most ${val.maxLength} characters`);
        }
        
        if (param.type === 'number') {
          const numValue = Number(value);
          if (val.min !== undefined && numValue < val.min) {
            errors.push(`Parameter '${param.name}' must be at least ${val.min}`);
          }
          if (val.max !== undefined && numValue > val.max) {
            errors.push(`Parameter '${param.name}' must be at most ${val.max}`);
          }
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private buildCommand(template: string, parameters: Record<string, string>): string {
    let command = template;
    
    // Replace parameter placeholders
    for (const [name, value] of Object.entries(parameters)) {
      const placeholderRegex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      command = command.replace(placeholderRegex, value);
    }
    
    // Check for unreplaced placeholders
    const unreplacedMatches = command.match(/\{\{[^}]+\}\}/g);
    if (unreplacedMatches) {
      console.warn('Unreplaced placeholders found:', unreplacedMatches);
    }
    
    return command;
  }
  
  /**
   * Create template collection
   */
  createCollection(name: string, description: string, templateIds: string[] = []): string {
    const collectionId = this.generateCollectionId();
    
    const collection: TemplateCollection = {
      id: collectionId,
      name,
      description,
      templateIds,
      tags: [],
      isPublic: false,
      createdAt: new Date()
    };
    
    this.collections.set(collectionId, collection);
    return collectionId;
  }
  
  /**
   * Get predefined templates
   */
  createPredefinedTemplates(): void {
    // Git templates
    this.createTemplate(
      'Git Commit with Message',
      'Stage all changes and commit with message',
      'git add . && git commit -m "{{message}}"',
      [
        {
          name: 'message',
          displayName: 'Commit Message',
          description: 'Description of the changes',
          type: 'string',
          required: true,
          placeholder: 'Brief description of changes',
          validation: { minLength: 3, maxLength: 72 }
        }
      ],
      { category: 'git', tags: ['git', 'commit'] }
    );
    
    this.createTemplate(
      'Create Feature Branch',
      'Create and checkout a new feature branch',
      'git checkout -b feature/{{feature-name}}',
      [
        {
          name: 'feature-name',
          displayName: 'Feature Name',
          description: 'Name of the feature (kebab-case)',
          type: 'string',
          required: true,
          placeholder: 'user-authentication',
          validation: { pattern: '^[a-z0-9-]+$' }
        }
      ],\n      { category: 'git', tags: ['git', 'branch'] }\n    );\n    \n    // Docker templates\n    this.createTemplate(\n      'Run Docker Container',\n      'Run a Docker container with port mapping',\n      'docker run {{detached}} {{port-mapping}} {{image}} {{command}}',\n      [\n        {\n          name: 'image',\n          displayName: 'Docker Image',\n          description: 'Docker image name',\n          type: 'string',\n          required: true,\n          placeholder: 'nginx:latest'\n        },\n        {\n          name: 'port-mapping',\n          displayName: 'Port Mapping',\n          description: 'Port mapping (host:container)',\n          type: 'string',\n          required: false,\n          placeholder: '-p 8080:80',\n          defaultValue: ''\n        },\n        {\n          name: 'detached',\n          displayName: 'Run Detached',\n          description: 'Run container in background',\n          type: 'boolean',\n          required: false,\n          defaultValue: 'true'\n        },\n        {\n          name: 'command',\n          displayName: 'Command',\n          description: 'Command to run in container',\n          type: 'string',\n          required: false,\n          defaultValue: ''\n        }\n      ],\n      { category: 'docker', tags: ['docker', 'container'] }\n    );\n    \n    // File operations\n    this.createTemplate(\n      'Find and Replace in Files',\n      'Find and replace text in files using sed',\n      'find {{directory}} -name \"{{file-pattern}}\" -type f -exec sed -i \"s/{{search}}/{{replace}}/g\" {} +',\n      [\n        {\n          name: 'directory',\n          displayName: 'Directory',\n          description: 'Directory to search in',\n          type: 'path',\n          required: true,\n          defaultValue: '.'\n        },\n        {\n          name: 'file-pattern',\n          displayName: 'File Pattern',\n          description: 'File name pattern to match',\n          type: 'string',\n          required: true,\n          placeholder: '*.txt'\n        },\n        {\n          name: 'search',\n          displayName: 'Search Text',\n          description: 'Text to find',\n          type: 'string',\n          required: true\n        },\n        {\n          name: 'replace',\n          displayName: 'Replace Text',\n          description: 'Replacement text',\n          type: 'string',\n          required: true\n        }\n      ],\n      { category: 'file-ops', tags: ['find', 'replace', 'sed'] }\n    );\n    \n    // System administration\n    this.createTemplate(\n      'Create System User',\n      'Create a new system user with home directory',\n      'sudo useradd {{options}} {{username}} && sudo passwd {{username}}',\n      [\n        {\n          name: 'username',\n          displayName: 'Username',\n          description: 'Name for the new user',\n          type: 'string',\n          required: true,\n          validation: { pattern: '^[a-z][a-z0-9_-]*$', minLength: 2, maxLength: 32 }\n        },\n        {\n          name: 'options',\n          displayName: 'User Options',\n          description: 'Additional useradd options',\n          type: 'enum',\n          required: false,\n          options: ['-m', '-m -s /bin/bash', '-m -g users', '-m -s /bin/bash -g users'],\n          defaultValue: '-m -s /bin/bash'\n        }\n      ],\n      { category: 'system', tags: ['user', 'admin'] }\n    );\n    \n    // Development templates\n    this.createTemplate(\n      'NPM Project Setup',\n      'Initialize new NPM project with common configuration',\n      'npm init -y && npm install {{dependencies}} && npm install --save-dev {{dev-dependencies}}',\n      [\n        {\n          name: 'dependencies',\n          displayName: 'Dependencies',\n          description: 'Production dependencies to install',\n          type: 'string',\n          required: false,\n          placeholder: 'express react lodash',\n          defaultValue: ''\n        },\n        {\n          name: 'dev-dependencies',\n          displayName: 'Dev Dependencies',\n          description: 'Development dependencies to install',\n          type: 'string',\n          required: false,\n          placeholder: 'typescript @types/node jest',\n          defaultValue: ''\n        }\n      ],\n      { category: 'dev', tags: ['npm', 'nodejs', 'setup'] }\n    );\n    \n    // Network templates\n    this.createTemplate(\n      'Download and Extract Archive',\n      'Download archive file and extract to directory',\n      'curl -L \"{{url}}\" -o \"{{filename}}\" && {{extract-command}} \"{{filename}}\" {{extract-options}}',\n      [\n        {\n          name: 'url',\n          displayName: 'Download URL',\n          description: 'URL of the archive to download',\n          type: 'url',\n          required: true\n        },\n        {\n          name: 'filename',\n          displayName: 'Local Filename',\n          description: 'Name for the downloaded file',\n          type: 'string',\n          required: true,\n          placeholder: 'archive.tar.gz'\n        },\n        {\n          name: 'extract-command',\n          displayName: 'Extract Command',\n          description: 'Command to extract the archive',\n          type: 'enum',\n          required: true,\n          options: ['tar -xzf', 'tar -xjf', 'unzip', 'tar -xf'],\n          defaultValue: 'tar -xzf'\n        },\n        {\n          name: 'extract-options',\n          displayName: 'Extract Options',\n          description: 'Additional extraction options',\n          type: 'string',\n          required: false,\n          defaultValue: '-C .'\n        }\n      ],\n      { category: 'network', tags: ['download', 'extract', 'curl'] }\n    );\n  }\n  \n  /**\n   * Import templates from file\n   */\n  async importTemplates(filePath: string): Promise<number> {\n    try {\n      const templates = await invoke<CommandTemplate[]>('import_templates', { filePath });\n      \n      for (const template of templates) {\n        this.templates.set(template.id, template);\n      }\n      \n      return templates.length;\n    } catch (error) {\n      throw new Error(`Failed to import templates: ${error}`);\n    }\n  }\n  \n  /**\n   * Export templates to file\n   */\n  async exportTemplates(filePath: string, templateIds?: string[]): Promise<void> {\n    const templatesToExport = templateIds ?\n      templateIds.map(id => this.templates.get(id)).filter(Boolean) :\n      Array.from(this.templates.values());\n    \n    try {\n      await invoke('export_templates', { templates: templatesToExport, filePath });\n    } catch (error) {\n      throw new Error(`Failed to export templates: ${error}`);\n    }\n  }\n  \n  /**\n   * Get cached parameters for template\n   */\n  getCachedParameters(templateId: string): Record<string, string> {\n    return this.parameterCache.get(templateId) || {};\n  }\n  \n  /**\n   * Get execution history\n   */\n  getExecutionHistory(templateId?: string, limit: number = 100): TemplateExecution[] {\n    let history = this.executionHistory;\n    \n    if (templateId) {\n      history = history.filter(e => e.templateId === templateId);\n    }\n    \n    return history.slice(-limit);\n  }\n  \n  /**\n   * Get template analytics\n   */\n  getTemplateAnalytics(): TemplateAnalytics {\n    const templates = Array.from(this.templates.values());\n    \n    return {\n      totalTemplates: templates.length,\n      totalExecutions: this.executionHistory.length,\n      mostUsedTemplates: templates\n        .sort((a, b) => b.usage.count - a.usage.count)\n        .slice(0, 10)\n        .map(t => ({ id: t.id, name: t.name, usageCount: t.usage.count })),\n      categoryDistribution: this.getCategoryDistribution(),\n      averageParametersPerTemplate: templates.length > 0 ?\n        templates.reduce((sum, t) => sum + t.parameters.length, 0) / templates.length : 0,\n      recentActivity: this.executionHistory.slice(-10).map(e => ({\n        templateName: this.templates.get(e.templateId)?.name || 'Unknown',\n        timestamp: e.timestamp,\n        successful: e.exitCode === 0\n      }))\n    };\n  }\n  \n  private getCategoryDistribution(): Record<string, number> {\n    const distribution: Record<string, number> = {};\n    \n    for (const template of this.templates.values()) {\n      distribution[template.category] = (distribution[template.category] || 0) + 1;\n    }\n    \n    return distribution;\n  }\n  \n  private generateTemplateId(): string {\n    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n  \n  private generateCollectionId(): string {\n    return `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n  \n  private generateExecutionId(): string {\n    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n}\n\nexport interface TemplateExecutionResult {\n  command: string;\n  parameters: Record<string, string>;\n  output?: string;\n  exitCode?: number;\n  executionTime?: number;\n  dryRun: boolean;\n}\n\nexport interface TemplateAnalytics {\n  totalTemplates: number;\n  totalExecutions: number;\n  mostUsedTemplates: Array<{ id: string; name: string; usageCount: number }>;\n  categoryDistribution: Record<string, number>;\n  averageParametersPerTemplate: number;\n  recentActivity: Array<{ templateName: string; timestamp: Date; successful: boolean }>;\n}\n\nexport const commandTemplateService = new CommandTemplateService();\n"}}
</function_results>

<function_calls>
<invoke name="mark_todo_as_done">
<parameter name="todo_ids">["cc9b2e6d-4cb5-454e-bf4b-99d4897051cf"]
