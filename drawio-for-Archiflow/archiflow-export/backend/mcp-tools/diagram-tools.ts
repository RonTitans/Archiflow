import { z } from "zod";
import { CallToolResult, ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Context } from "../types.js";
import { default_tool } from "../tool.js";
import { DiagramStorage } from "../archiflow/database/storage.js";

const storage = new DiagramStorage();

// Schema for save-diagram tool
export const saveDiagramSchema = z.object({
  id: z.string().optional().describe("Diagram ID (optional for new diagrams)"),
  name: z.string().describe("Name of the diagram"),
  description: z.string().optional().describe("Description of the diagram"),
  tags: z.array(z.string()).optional().describe("Tags for categorizing the diagram"),
  created_by: z.string().optional().describe("User who created/modified the diagram").default("admin")
});

// Schema for load-diagram tool
export const loadDiagramSchema = z.object({
  id: z.string().describe("ID of the diagram to load"),
  version: z.number().optional().describe("Specific version to load (optional, defaults to latest)")
});

// Schema for list-diagrams tool
export const listDiagramsSchema = z.object({
  tag: z.string().optional().describe("Filter diagrams by tag"),
  status: z.string().optional().describe("Filter by status (active, archived, template)")
});

// Schema for export-diagram tool
export const exportDiagramSchema = z.object({
  format: z.enum(["png", "svg", "xml", "pdf"]).describe("Export format"),
  quality: z.number().min(0).max(100).optional().describe("Quality for PNG export (0-100)").default(90),
  background: z.boolean().optional().describe("Include background in export").default(true)
});

// Schema for get-diagram-xml tool
export const getDiagramXmlSchema = z.object({});

type ToolFn<T> = (
  args: T,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<CallToolResult>;

export function createSaveDiagramTool(context: Context): ToolFn<z.infer<typeof saveDiagramSchema>> {
  return async (args, extra) => {
    try {
      // For now, we'll use a simpler approach - get XML through the existing tool
      const getXmlTool = default_tool("get-diagram-xml", context);
      const xmlResult = await getXmlTool({}, extra);
      
      // Extract XML from the result
      let xml = "";
      if (xmlResult.content && xmlResult.content[0]) {
        const content = xmlResult.content[0];
        if (content.type === "text") {
          try {
            const parsed = JSON.parse(content.text);
            xml = parsed.xml || parsed.data || "";
          } catch {
            xml = content.text;
          }
        }
      }
      
      // Save to storage with the provided metadata
      const savedDiagram = await storage.saveDiagram({
        ...args,
        xml: xml
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            diagram: savedDiagram,
            message: `Diagram '${savedDiagram.name}' saved successfully (version ${savedDiagram.version})`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to save diagram: ${error}`
          })
        }]
      };
    }
  };
}

export function createLoadDiagramTool(context: Context): ToolFn<z.infer<typeof loadDiagramSchema>> {
  return async (args, extra) => {
    try {
      let diagramData;
      
      if (args.version) {
        // Load specific version
        const version = await storage.loadDiagramVersion(args.id, args.version);
        if (!version) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Version ${args.version} not found for diagram ${args.id}`
              })
            }]
          };
        }
        diagramData = version;
      } else {
        // Load latest version
        const diagram = await storage.loadDiagram(args.id);
        if (!diagram) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Diagram ${args.id} not found`
              })
            }]
          };
        }
        diagramData = diagram;
      }
      
      // Send XML to Draw.io via the load-diagram event
      const loadTool = default_tool("load-diagram", context);
      await loadTool({ xml: diagramData.xml }, extra);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Diagram loaded successfully`,
            diagram: diagramData
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to load diagram: ${error}`
          })
        }]
      };
    }
  };
}

export function createListDiagramsTool(context: Context): ToolFn<z.infer<typeof listDiagramsSchema>> {
  return async (args, extra) => {
    try {
      let diagrams = await storage.listDiagrams();
      
      // Apply filters if provided
      if (args.tag) {
        diagrams = diagrams.filter(d => d.tags?.includes(args.tag!));
      }
      if (args.status) {
        diagrams = diagrams.filter(d => d.status === args.status);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            count: diagrams.length,
            diagrams: diagrams.map(d => ({
              id: d.id,
              name: d.name,
              description: d.description,
              version: d.version,
              status: d.status,
              tags: d.tags,
              created_at: d.created_at,
              updated_at: d.updated_at,
              created_by: d.created_by
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to list diagrams: ${error}`
          })
        }]
      };
    }
  };
}

export function createExportDiagramTool(context: Context): ToolFn<z.infer<typeof exportDiagramSchema>> {
  return default_tool("export-diagram", context);
}

export function createGetDiagramXmlTool(context: Context): ToolFn<z.infer<typeof getDiagramXmlSchema>> {
  return default_tool("get-diagram-xml", context);
}