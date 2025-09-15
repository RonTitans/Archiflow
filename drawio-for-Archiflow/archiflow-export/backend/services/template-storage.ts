import { promises as fs } from 'fs';
import path from 'path';

export interface TemplateVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'ip' | 'subnet' | 'vlan';
}

export interface NetworkTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  xml: string;
  variables: TemplateVariable[];
  metadata: {
    created_at: string;
    updated_at: string;
    created_by?: string;
    version: string;
    tags?: string[];
  };
  preview?: {
    thumbnail?: string;
    deviceCount?: number;
    connectionCount?: number;
  };
}

export class TemplateStorage {
  private templatesPath: string;

  constructor(basePath: string = './data') {
    this.templatesPath = path.join(basePath, 'templates.json');
  }

  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.templatesPath);
    } catch {
      const dir = path.dirname(this.templatesPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.templatesPath, JSON.stringify([], null, 2));
    }
  }

  async createTemplate(template: Omit<NetworkTemplate, 'id' | 'metadata'>): Promise<NetworkTemplate> {
    await this.ensureFile();
    
    const templates = await this.listTemplates();
    
    const newTemplate: NetworkTemplate = {
      ...template,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '1.0.0',
        tags: []
      }
    };

    templates.push(newTemplate);
    await fs.writeFile(this.templatesPath, JSON.stringify(templates, null, 2));
    
    return newTemplate;
  }

  async getTemplate(templateId: string): Promise<NetworkTemplate | null> {
    await this.ensureFile();
    const templates = await this.listTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  async listTemplates(category?: string): Promise<NetworkTemplate[]> {
    await this.ensureFile();
    const content = await fs.readFile(this.templatesPath, 'utf-8');
    const templates: NetworkTemplate[] = JSON.parse(content);
    
    if (category) {
      return templates.filter(t => t.category === category);
    }
    
    return templates;
  }

  async updateTemplate(templateId: string, updates: Partial<NetworkTemplate>): Promise<NetworkTemplate | null> {
    await this.ensureFile();
    const templates = await this.listTemplates();
    const index = templates.findIndex(t => t.id === templateId);
    
    if (index === -1) {
      return null;
    }

    templates[index] = {
      ...templates[index],
      ...updates,
      id: templateId,
      metadata: {
        ...templates[index].metadata,
        updated_at: new Date().toISOString()
      }
    };

    await fs.writeFile(this.templatesPath, JSON.stringify(templates, null, 2));
    return templates[index];
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    await this.ensureFile();
    const templates = await this.listTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    
    if (filtered.length === templates.length) {
      return false;
    }

    await fs.writeFile(this.templatesPath, JSON.stringify(filtered, null, 2));
    return true;
  }

  extractVariables(xml: string): TemplateVariable[] {
    const variablePattern = /\{\{(\w+)(?::([^}]+))?\}\}/g;
    const variables: Map<string, TemplateVariable> = new Map();
    
    let match;
    while ((match = variablePattern.exec(xml)) !== null) {
      const name = match[1];
      const hint = match[2];
      
      if (!variables.has(name)) {
        const variable: TemplateVariable = {
          name,
          required: true
        };

        if (hint) {
          if (hint.includes('ip')) variable.type = 'ip';
          else if (hint.includes('subnet')) variable.type = 'subnet';
          else if (hint.includes('vlan')) variable.type = 'vlan';
          else if (hint.includes('number')) variable.type = 'number';
          
          if (hint.includes('=')) {
            const defaultMatch = hint.match(/default=([^,]+)/);
            if (defaultMatch) {
              variable.defaultValue = defaultMatch[1];
              variable.required = false;
            }
          }
        }
        
        variables.set(name, variable);
      }
    }
    
    return Array.from(variables.values());
  }
}