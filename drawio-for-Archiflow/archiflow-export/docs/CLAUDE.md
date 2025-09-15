# Claude Development Instructions for ArchiFlow Manual Diagrams Module

## IMPORTANT: Development Workflow

### Before Starting ANY Task:

1. **ALWAYS READ THE PRD FIRST**
   - Read the Product Requirements Document at: `F:\drawio-mcp-server-main\PRD_ArchiFlow Manual Diagrams Module.md`
   - Understand the requirements for the current sprint/feature
   - Ensure alignment with the overall ArchiFlow goals

2. **CHECK THE TASKS FILE**
   - Review current progress at: `F:\drawio-mcp-server-main\TASKS.md`
   - Identify which task to work on next
   - Check task dependencies and status

### During Development:

1. **Follow the PRD specifications exactly**
   - Each feature must match the PRD requirements
   - Do not add features not specified in the PRD
   - If clarification is needed, refer back to the PRD

2. **Test as you develop**
   - Test each new MCP tool with Draw.io
   - Verify WebSocket communication is working
   - Ensure no breaking changes to existing tools

### After EVERY Development Task:

1. **UPDATE THE TASKS.MD FILE**
   - Mark completed tasks with [x]
   - Update progress percentages
   - Add any new subtasks discovered
   - Update the "Last Updated" date
   - Note any blockers or issues

2. **Commit Pattern**
   - Only commit when explicitly asked
   - Include clear commit messages referencing the sprint/task

## Development Standards

### Code Organization
- All ArchiFlow code goes in `src/archiflow/`
- New MCP tools go in `src/tools/`
- Keep each module focused and single-purpose
- Use TypeScript for all new code

### Testing Requirements
- Test each tool manually before marking complete
- Create unit tests for critical functions
- Document test cases in the code

### Documentation
- Comment complex logic
- Update tool descriptions in index.ts
- Keep this CLAUDE.md file updated with any new instructions

## File Locations Reference

### Key Files:
- **PRD**: `F:\drawio-mcp-server-main\PRD_ArchiFlow Manual Diagrams Module.md`
- **Tasks**: `F:\drawio-mcp-server-main\TASKS.md`
- **Main Server**: `src/index.ts`
- **Tool Builder**: `src/tool.ts`
- **Types**: `src/types.ts`

### ArchiFlow Modules:
- **Devices**: `src/archiflow/devices/`
- **IPAM**: `src/archiflow/ipam/`
- **Templates**: `src/archiflow/templates/`
- **Database**: `src/archiflow/database/`
- **Versioning**: `src/archiflow/versioning/`
- **Alerts**: `src/archiflow/alerts/`

## Build & Run Commands

```bash
# Build the TypeScript code
npm run build

# Run in development mode (auto-rebuild)
npm run dev

# Run tests
npm test

# Check for TypeScript errors
npm run lint
```

## Sprint Workflow

1. **Start of Sprint**:
   - Read PRD for sprint goals
   - Review TASKS.md for sprint tasks
   - Create necessary folders/files

2. **During Sprint**:
   - Implement one feature at a time
   - Test with Draw.io after each feature
   - Update TASKS.md after each completion

3. **End of Sprint**:
   - Verify all sprint tasks completed
   - Update TASKS.md progress tracking
   - Prepare for next sprint

## Critical Reminders

⚠️ **ALWAYS**:
- Read PRD before starting
- Update TASKS.md after changes
- Test with Draw.io connection
- Build before testing (`npm run build`)

❌ **NEVER**:
- Skip reading the PRD
- Forget to update TASKS.md
- Commit without being asked
- Add features not in PRD

## Current Focus

**Active Sprint**: Sprint 1 - Basic Embed & Save
**Priority**: Implement save/load functionality for diagrams

---

*This file should be read at the start of every Claude session working on the ArchiFlow project.*