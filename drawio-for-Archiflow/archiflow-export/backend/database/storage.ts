import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Diagram {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  status: string;
  tags?: string[];
  xml: string | null;
  devices?: string[];
}

export interface DiagramVersion {
  diagramId: string;
  version: number;
  created_at: string;
  created_by: string;
  changes: string;
  xml: string | null;
}

export class DiagramStorage {
  private dataPath: string;
  private diagramsFile: string;
  private versionsFile: string;

  constructor() {
    this.dataPath = path.join(__dirname, '..', 'mock-data');
    this.diagramsFile = path.join(this.dataPath, 'diagrams.json');
    this.versionsFile = path.join(this.dataPath, 'diagram-versions.json');
  }

  private async readDiagrams(): Promise<{ diagrams: Diagram[], versions: DiagramVersion[] }> {
    try {
      const data = await fs.readFile(this.diagramsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading diagrams file:', error);
      return { diagrams: [], versions: [] };
    }
  }

  private async writeDiagrams(data: { diagrams: Diagram[], versions: DiagramVersion[] }): Promise<void> {
    await fs.writeFile(this.diagramsFile, JSON.stringify(data, null, 2));
  }

  async saveDiagram(diagram: Partial<Diagram> & { xml: string }): Promise<Diagram> {
    const data = await this.readDiagrams();
    
    const now = new Date().toISOString();
    let savedDiagram: Diagram;
    let version: DiagramVersion;

    if (diagram.id && data.diagrams.find(d => d.id === diagram.id)) {
      // Update existing diagram
      const existingIndex = data.diagrams.findIndex(d => d.id === diagram.id);
      const existing = data.diagrams[existingIndex];
      
      savedDiagram = {
        ...existing,
        ...diagram,
        updated_at: now,
        version: existing.version + 1
      };
      
      data.diagrams[existingIndex] = savedDiagram;
      
      // Create version record
      version = {
        diagramId: savedDiagram.id,
        version: savedDiagram.version,
        created_at: now,
        created_by: diagram.created_by || 'admin',
        changes: `Updated diagram: ${diagram.name || existing.name}`,
        xml: diagram.xml
      };
    } else {
      // Create new diagram
      savedDiagram = {
        id: diagram.id || `DIAG-${Date.now()}`,
        name: diagram.name || 'Untitled Diagram',
        description: diagram.description || '',
        created_by: diagram.created_by || 'admin',
        created_at: now,
        updated_at: now,
        version: 1,
        status: 'active',
        tags: diagram.tags || [],
        xml: diagram.xml,
        devices: diagram.devices || []
      };
      
      data.diagrams.push(savedDiagram);
      
      // Create initial version
      version = {
        diagramId: savedDiagram.id,
        version: 1,
        created_at: now,
        created_by: savedDiagram.created_by,
        changes: 'Initial creation',
        xml: diagram.xml
      };
    }
    
    data.versions.push(version);
    await this.writeDiagrams(data);
    
    return savedDiagram;
  }

  async loadDiagram(diagramId: string): Promise<Diagram | null> {
    const data = await this.readDiagrams();
    return data.diagrams.find(d => d.id === diagramId) || null;
  }

  async loadDiagramVersion(diagramId: string, version?: number): Promise<DiagramVersion | null> {
    const data = await this.readDiagrams();
    const versions = data.versions.filter(v => v.diagramId === diagramId);
    
    if (version) {
      return versions.find(v => v.version === version) || null;
    }
    
    // Return latest version
    return versions.sort((a, b) => b.version - a.version)[0] || null;
  }

  async listDiagrams(): Promise<Diagram[]> {
    const data = await this.readDiagrams();
    return data.diagrams;
  }

  async deleteDiagram(diagramId: string): Promise<boolean> {
    const data = await this.readDiagrams();
    const index = data.diagrams.findIndex(d => d.id === diagramId);
    
    if (index === -1) return false;
    
    data.diagrams.splice(index, 1);
    // Also remove versions
    data.versions = data.versions.filter(v => v.diagramId !== diagramId);
    
    await this.writeDiagrams(data);
    return true;
  }

  async getVersionHistory(diagramId: string): Promise<DiagramVersion[]> {
    const data = await this.readDiagrams();
    return data.versions.filter(v => v.diagramId === diagramId)
      .sort((a, b) => b.version - a.version);
  }
}