// Test script to apply a template and generate XML
import { TemplateStorage } from './build/archiflow/templates/template-storage.js';
import { TemplateEngine } from './build/archiflow/templates/template-engine.js';

const templateStorage = new TemplateStorage('./data');
const templateEngine = new TemplateEngine();

async function applyBranchOfficeTemplate() {
  // Get the branch office template
  const template = await templateStorage.getTemplate('tpl_branch_office_001');
  
  if (!template) {
    console.error('Template not found');
    return;
  }

  // Apply with NYC values
  const variables = {
    site_code: 'NYC',
    vlan_it: 15,
    vlan_sales: 25,
    subnet_it: '10.200.15.0/24',
    subnet_sales: '10.200.25.0/24'
  };

  console.log('Applying template with variables:', variables);
  
  const result = templateEngine.applyTemplate(template, variables);
  
  if (result.errors) {
    console.error('Validation errors:', result.errors);
    return;
  }

  // Save the generated XML to a file
  const fs = await import('fs/promises');
  await fs.writeFile('generated-branch-nyc.xml', result.xml, 'utf-8');
  
  console.log('Generated XML saved to: generated-branch-nyc.xml');
  console.log('\nYou can now:');
  console.log('1. Open Draw.io');
  console.log('2. Go to File → Import from → Device');
  console.log('3. Select generated-branch-nyc.xml');
  console.log('\nThe diagram will show:');
  console.log('- Firewall: FW-NYC-01');
  console.log('- Router: RTR-NYC-01');
  console.log('- Switch: SW-NYC-CORE-01');
  console.log('- IT VLAN: 15 (10.200.15.0/24)');
  console.log('- Sales VLAN: 25 (10.200.25.0/24)');
}

applyBranchOfficeTemplate().catch(console.error);