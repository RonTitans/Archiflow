# Sprint 3: Device Images
**Duration:** Week 5
**Status:** 🔴 Not Started

## Overview
Add support for device photos and enhanced visualization.

## Tasks

### 1. Database Schema (2 hours)
```sql
CREATE TABLE device_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100),
    device_name VARCHAR(255),
    site_id INTEGER,
    image_data TEXT,  -- Base64 or URL
    image_type VARCHAR(50),  -- photo, icon, schematic
    thumbnail TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    uploaded_by VARCHAR(100)
);

CREATE INDEX idx_device_images_device ON device_images(device_id);
CREATE INDEX idx_device_images_site ON device_images(site_id);
```

### 2. Upload Handler (4 hours)
```javascript
// Backend: websocket-server.js
const imageHandlers = {
    'device.uploadImage': async (params) => {
        const { device_id, image_data, image_type, user_id } = params;
        
        // Generate thumbnail
        const thumbnail = await generateThumbnail(image_data);
        
        // Store in database
        const result = await db.query(`
            INSERT INTO device_images 
            (device_id, image_data, thumbnail, image_type, uploaded_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [device_id, image_data, thumbnail, image_type, user_id]);
        
        return { image_id: result.rows[0].id };
    },
    
    'device.getImages': async (params) => {
        const { device_id } = params;
        const result = await db.query(
            'SELECT * FROM device_images WHERE device_id = $1 ORDER BY uploaded_at DESC',
            [device_id]
        );
        return { images: result.rows };
    }
};
```

### 3. Frontend Upload Component (4 hours)
```javascript
// Image upload dialog
ArchiFlow.ImageUploader = {
    show: function(deviceId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const base64 = await this.toBase64(file);
                this.upload(deviceId, base64);
            }
        };
        input.click();
    },
    
    toBase64: function(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    },
    
    upload: async function(deviceId, base64) {
        ArchiFlow.ws.send(JSON.stringify({
            method: 'device.uploadImage',
            params: {
                device_id: deviceId,
                image_data: base64,
                image_type: 'photo'
            }
        }));
    }
};
```

### 4. Shape Enhancement (3 hours)
```javascript
// Apply image to Draw.io shape
ArchiFlow.applyImage = function(cell, imageUrl) {
    const graph = ui.editor.graph;
    
    // Create composite shape with image
    const style = 'shape=image;image=' + imageUrl + ';' +
                  'verticalLabelPosition=bottom;verticalAlign=top;' +
                  'imageBackground=white;imageBorder=gray;';
    
    graph.model.setStyle(cell, style);
    
    // Store image reference
    if (!cell.archiflow) cell.archiflow = {};
    cell.archiflow.image = imageUrl;
    
    graph.refresh(cell);
};
```

### 5. Image Gallery (3 hours)
```javascript
ArchiFlow.ImageGallery = {
    show: async function(deviceId) {
        const response = await this.getImages(deviceId);
        const images = response.images;
        
        const gallery = document.createElement('div');
        gallery.className = 'image-gallery';
        gallery.innerHTML = `
            <h3>Device Images</h3>
            <div class="gallery-grid">
                ${images.map(img => `
                    <div class="gallery-item" onclick="ArchiFlow.selectImage('${img.id}')">
                        <img src="${img.thumbnail}" />
                        <span>${img.image_type}</span>
                    </div>
                `).join('')}
            </div>
            <button onclick="ArchiFlow.ImageUploader.show('${deviceId}')">+ Add Image</button>
        `;
        
        ArchiFlow.UI.showPanel(gallery);
    }
};
```

### 6. Thumbnail Generation (2 hours)
```javascript
// Server-side thumbnail generation
const sharp = require('sharp');

async function generateThumbnail(base64Image) {
    const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
    
    const thumbnail = await sharp(buffer)
        .resize(150, 150, { fit: 'contain' })
        .toBuffer();
    
    return 'data:image/jpeg;base64,' + thumbnail.toString('base64');
}
```

## Testing Checklist
- [ ] Images upload successfully
- [ ] Thumbnails generate correctly
- [ ] Shapes display images
- [ ] Gallery shows all device images
- [ ] Large images handled (>5MB)
- [ ] Multiple formats supported (JPG, PNG, GIF)
- [ ] Image deletion works

## Performance Considerations
- Lazy load images in gallery
- Cache thumbnails client-side
- Compress images before storage
- Limit image size to 10MB
- Use CDN for production

## Next Steps
- Consider S3 storage for scalability
- Add image editing capabilities
- Support PDF/document attachments