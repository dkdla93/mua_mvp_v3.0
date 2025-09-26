# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean interior construction document automation system (착공도서 자동생성 시스템) that automatically generates PowerPoint construction documents from Excel material lists and images. The application is designed for Korean interior designers and construction site managers.

## Architecture

**Frontend-Only SPA (No Backend)**
- Pure client-side processing with no server dependencies
- All file processing occurs in the browser (Excel parsing, image handling, PPT generation)
- Static deployment on Vercel
- Session-based data storage (memory only, no persistence)

## Technology Stack & Constraints

- **Core:** HTML5, CSS3, JavaScript (ES5 compatible for IE11+ support)
- **Libraries:**
  - SheetJS (xlsx.full.min.js) for Excel parsing
  - PptxGenJS for PowerPoint generation
- **APIs:** Canvas API, File API, Drag and Drop API
- **Browser Support:** IE11+, Chrome 60+, Firefox 55+, Safari 12+

## File Structure

Expected structure based on specification:
```
public/
├── index.html          # Main UI
├── app.js             # Core application logic
├── styles.css         # Styling
├── vercel.json        # Deployment configuration
└── package.json       # Project metadata
```

## Core Application Flow

**4-Step Workflow:**
1. **File Upload:** Excel material lists (.xlsx/.xls), minimap image, scene images
2. **Process Management:** Create construction phases (공정) with scene selection
3. **Material Mapping:** Drag-and-drop material placement on scene images with auto-numbered badges
4. **PPT Generation:** Generate PowerPoint with process-separated sections

## Key Data Structures

**Global State (appState):**
- `processes[]` - Construction phases with independent scene selections
- `sceneMaterialMapping{}` - Process-specific material-scene relationships
- `sceneMaterialPositions{}` - Drag-drop material placement coordinates
- `materials[]` - Parsed Excel material data with Korean field names
- `minimapBoxes{}` - Scene location boxes on minimap

## Development Considerations

**Korean Language Context:**
- All UI text and user-facing content should be in Korean
- Excel parsing expects Korean column headers (MATERIAL, AREA, ITEM, etc.)
- Error messages and user guidance in Korean

**Technical Challenges:**
- Browser memory management for large Excel files and multiple images
- Flexible Excel parsing for various Korean material list formats
- Canvas-based image composition for PowerPoint generation
- Coordinate normalization for responsive drag-and-drop positioning

**Performance Requirements:**
- Excel parsing: 5 seconds max for 10MB files
- PPT generation: 30 seconds max for 20 scenes
- Memory usage: Under 500MB browser memory

## Development Phases

Based on PRD, implement in this order:
1. **Phase 1:** Basic file upload and Excel parsing
2. **Phase 2:** Process management and drag-and-drop material placement
3. **Phase 3:** PowerPoint generation and minimap positioning
4. **Phase 4:** Testing, optimization, and deployment

## Domain-Specific Notes

This system handles Korean construction industry workflows:
- Material specifications (자재 스펙)
- Construction phases (공정)
- Site location mapping (현장 위치)
- Document standardization for Korean construction practices