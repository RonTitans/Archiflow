import { NetworkTemplate, TemplateVariable } from './template-storage.js';

export interface TemplateVariableValues {
  [key: string]: string | number;
}

export interface ValidationError {
  variable: string;
  message: string;
}

export class TemplateEngine {
  
  validateVariables(
    template: NetworkTemplate,
    values: TemplateVariableValues
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const variable of template.variables) {
      const value = values[variable.name];

      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push({
          variable: variable.name,
          message: `Variable '${variable.name}' is required`
        });
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        const stringValue = String(value);

        switch (variable.type) {
          case 'ip':
            if (!this.isValidIP(stringValue)) {
              errors.push({
                variable: variable.name,
                message: `Variable '${variable.name}' must be a valid IP address`
              });
            }
            break;

          case 'subnet':
            if (!this.isValidSubnet(stringValue)) {
              errors.push({
                variable: variable.name,
                message: `Variable '${variable.name}' must be a valid subnet (e.g., 192.168.1.0/24)`
              });
            }
            break;

          case 'vlan':
            const vlanNum = Number(stringValue);
            if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
              errors.push({
                variable: variable.name,
                message: `Variable '${variable.name}' must be a valid VLAN ID (1-4094)`
              });
            }
            break;

          case 'number':
            if (isNaN(Number(stringValue))) {
              errors.push({
                variable: variable.name,
                message: `Variable '${variable.name}' must be a number`
              });
            }
            break;
        }
      }
    }

    return errors;
  }

  applyTemplate(
    template: NetworkTemplate,
    values: TemplateVariableValues
  ): { xml: string; errors?: ValidationError[] } {
    const errors = this.validateVariables(template, values);
    
    if (errors.length > 0) {
      return { xml: '', errors };
    }

    const finalValues: TemplateVariableValues = {};
    
    for (const variable of template.variables) {
      if (values[variable.name] !== undefined) {
        finalValues[variable.name] = values[variable.name];
      } else if (variable.defaultValue !== undefined) {
        finalValues[variable.name] = variable.defaultValue;
      }
    }

    let xml = template.xml;
    
    for (const [key, value] of Object.entries(finalValues)) {
      const pattern = new RegExp(`\\{\\{${key}(?::[^}]+)?\\}\\}`, 'g');
      xml = xml.replace(pattern, String(value));
    }

    xml = this.processCalculatedValues(xml, finalValues);
    
    return { xml };
  }

  private processCalculatedValues(xml: string, values: TemplateVariableValues): string {
    const calcPattern = /\{\{calc:([^}]+)\}\}/g;
    
    return xml.replace(calcPattern, (match, expression) => {
      try {
        const sanitizedExpr = expression
          .replace(/[^0-9+\-*/().\s]/g, '')
          .trim();
        
        if (sanitizedExpr) {
          const result = Function(`"use strict"; return (${sanitizedExpr})`)();
          return String(result);
        }
      } catch (e) {
        console.error(`Failed to evaluate expression: ${expression}`);
      }
      return match;
    });
  }

  private isValidIP(ip: string): boolean {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  }

  private isValidSubnet(subnet: string): boolean {
    const subnetPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/;
    return subnetPattern.test(subnet);
  }

  generatePreview(template: NetworkTemplate): string {
    const exampleValues: TemplateVariableValues = {};
    
    for (const variable of template.variables) {
      if (variable.defaultValue) {
        exampleValues[variable.name] = variable.defaultValue;
      } else {
        switch (variable.type) {
          case 'ip':
            exampleValues[variable.name] = '192.168.1.1';
            break;
          case 'subnet':
            exampleValues[variable.name] = '192.168.1.0/24';
            break;
          case 'vlan':
            exampleValues[variable.name] = '100';
            break;
          case 'number':
            exampleValues[variable.name] = '1';
            break;
          default:
            exampleValues[variable.name] = `[${variable.name}]`;
        }
      }
    }

    const result = this.applyTemplate(template, exampleValues);
    return result.xml;
  }
}