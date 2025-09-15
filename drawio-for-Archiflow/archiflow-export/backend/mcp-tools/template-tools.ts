import { z } from 'zod';
import { Context } from '../types.js';
import { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { TemplateStorage, NetworkTemplate } from '../archiflow/templates/template-storage.js';
import { TemplateEngine, TemplateVariableValues } from '../archiflow/templates/template-engine.js';

const templateStorage = new TemplateStorage('./data');
const templateEngine = new TemplateEngine();

// Schema definitions
export const createTemplateSchema = z.object({
  name: z.string().describe('Name of the template'),
  description: z.string().optional().describe('Description of what this template creates'),
  category: z.string().optional().describe('Category for organizing templates (e.g., "branch-office", "datacenter", "campus")'),
  xml: z.string().describe('Draw.io XML content with variable placeholders like {{site_name}}'),
  tags: z.array(z.string()).optional().describe('Tags for searching and filtering templates')
});

export const listTemplatesSchema = z.object({
  category: z.string().optional().describe('Filter templates by category')
});

export const applyTemplateSchema = z.object({
  templateId: z.string().describe('ID of the template to apply'),
  variables: z.record(z.union([z.string(), z.number()])).describe('Variable values to substitute in the template')
});

export const getTemplateSchema = z.object({
  templateId: z.string().describe('ID of the template to retrieve')
});

export const deleteTemplateSchema = z.object({
  templateId: z.string().describe('ID of the template to delete')
});

// Tool implementations
type ToolFn<T> = (
  args: T,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<CallToolResult>;

export function createCreateTemplateTool(context: Context): ToolFn<z.infer<typeof createTemplateSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[create-template] Creating new template', args);

      // Extract variables from the XML
      const variables = templateStorage.extractVariables(args.xml);

      // Create the template
      const template = await templateStorage.createTemplate({
        name: args.name,
        description: args.description,
        category: args.category,
        xml: args.xml,
        variables,
        preview: {
          deviceCount: (args.xml.match(/mxCell.*vertex/g) || []).length,
          connectionCount: (args.xml.match(/mxCell.*edge/g) || []).length
        }
      });

      if (args.tags) {
        template.metadata.tags = args.tags;
        await templateStorage.updateTemplate(template.id, template);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            template: {
              id: template.id,
              name: template.name,
              description: template.description,
              category: template.category,
              variableCount: variables.length,
              variables: variables.map(v => ({
                name: v.name,
                type: v.type || 'string',
                required: v.required !== false,
                defaultValue: v.defaultValue
              })),
              metadata: template.metadata
            },
            message: `Template '${template.name}' created successfully with ${variables.length} variables`
          }, null, 2)
        }]
      };
    } catch (error: any) {
      context.log.debug('[create-template] Error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to create template'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}

export function createListTemplatesTool(context: Context): ToolFn<z.infer<typeof listTemplatesSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[list-templates] Listing templates', args);

      const templates = await templateStorage.listTemplates(args.category);

      const templateSummaries = templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        variableCount: t.variables.length,
        deviceCount: t.preview?.deviceCount || 0,
        connectionCount: t.preview?.connectionCount || 0,
        created_at: t.metadata.created_at,
        tags: t.metadata.tags || []
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            templates: templateSummaries,
            count: templates.length,
            message: `Found ${templates.length} template(s)${args.category ? ` in category '${args.category}'` : ''}`
          }, null, 2)
        }]
      };
    } catch (error: any) {
      context.log.debug('[list-templates] Error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to list templates'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}

export function createApplyTemplateTool(context: Context): ToolFn<z.infer<typeof applyTemplateSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[apply-template] Applying template', args);

      // Get the template
      const template = await templateStorage.getTemplate(args.templateId);
      if (!template) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Template with ID '${args.templateId}' not found`
            }, null, 2)
          }],
          isError: true
        };
      }

      // Apply the template with variables
      const result = templateEngine.applyTemplate(template, args.variables);

      if (result.errors && result.errors.length > 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: 'Validation errors occurred',
              validationErrors: result.errors
            }, null, 2)
          }],
          isError: true
        };
      }

      // Send the XML to Draw.io
      const drawioRequest = {
        action: 'load-xml',
        xml: result.xml
      };

      // Note: The actual sending to Draw.io would require browser extension update
      // For now, we'll just return the processed XML
      context.log.debug('[apply-template] Would send to Draw.io:', drawioRequest);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Template '${template.name}' applied successfully`,
            appliedVariables: Object.keys(args.variables),
            template: {
              id: template.id,
              name: template.name,
              description: template.description
            },
            processedXml: result.xml
          }, null, 2)
        }]
      };
    } catch (error: any) {
      context.log.debug('[apply-template] Error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to apply template'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}

export function createGetTemplateTool(context: Context): ToolFn<z.infer<typeof getTemplateSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[get-template] Getting template', args);

      const template = await templateStorage.getTemplate(args.templateId);
      
      if (!template) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Template with ID '${args.templateId}' not found`
            }, null, 2)
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            template: {
              id: template.id,
              name: template.name,
              description: template.description,
              category: template.category,
              variables: template.variables,
              metadata: template.metadata,
              preview: template.preview
            }
          }, null, 2)
        }]
      };
    } catch (error: any) {
      context.log.debug('[get-template] Error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to get template'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}

export function createDeleteTemplateTool(context: Context): ToolFn<z.infer<typeof deleteTemplateSchema>> {
  return async (args, extra) => {
    try {
      context.log.debug('[delete-template] Deleting template', args);

      const template = await templateStorage.getTemplate(args.templateId);
      if (!template) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Template with ID '${args.templateId}' not found`
            }, null, 2)
          }],
          isError: true
        };
      }

      const deleted = await templateStorage.deleteTemplate(args.templateId);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: deleted,
            message: deleted ? `Template '${template.name}' deleted successfully` : 'Failed to delete template'
          }, null, 2)
        }]
      };
    } catch (error: any) {
      context.log.debug('[delete-template] Error:', error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to delete template'
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}