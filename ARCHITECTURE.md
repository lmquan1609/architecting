# Application Architecture

## Overview
Modular multi-feature application designed for AWS capability testing with easy extensibility.

## Current Features
1. **Provider Management** - PostgreSQL CRUD operations
2. **Image Upload** - EBS volume storage with file management

## Architecture Design

### Backend Structure
```
server.js
├── Database Connection (PostgreSQL)
├── File Storage Configuration (Multer + EBS)
├── API Routes
│   ├── /api/providers (GET, POST, DELETE)
│   └── /api/images (GET, POST, DELETE)
└── Static File Serving
```

### Frontend Structure
```
index.html
├── Tab Navigation System
├── Feature Modules
│   ├── Providers Tab
│   └── Images Tab
└── Responsive Design
```

## Adding New Features

### 1. Backend (server.js)
Add new API endpoints following the pattern:

```javascript
// New Feature API
app.get('/api/feature', async (req, res) => {
  // Implementation
});

app.post('/api/feature', async (req, res) => {
  // Implementation
});

app.delete('/api/feature/:id', async (req, res) => {
  // Implementation
});
```

### 2. Frontend (index.html)
Add new tab and content section:

```html
<!-- Add tab button -->
<button class="tab" onclick="switchTab('feature')">Feature Name</button>

<!-- Add content section -->
<div id="feature" class="content">
  <div class="form">
    <!-- Form inputs -->
    <button onclick="addFeature()">Add</button>
  </div>
  <div class="items" id="featureList"></div>
</div>
```

Add JavaScript functions:

```javascript
async function loadFeature() {
  const res = await fetch('/api/feature');
  const items = await res.json();
  // Render items
}

async function addFeature() {
  // Implementation
}

async function deleteFeature(id) {
  // Implementation
}
```

### 3. Update switchTab function
```javascript
if (tab === 'feature') loadFeature();
```

## Storage Architecture

### Database (PostgreSQL on EC2)
- Location: Private subnet
- Connection: Via private IP
- Tables: `providers` (extensible for more tables)

### File Storage (EBS Volume)
- Mount: `/var/images`
- Access: Via `/uploads` endpoint
- Permissions: `ec2-user:ec2-user` with `755`

## Future Enhancement Ideas

### AWS Service Integration
- **S3 Storage** - Replace EBS with S3 for images
- **DynamoDB** - NoSQL data storage testing
- **SQS/SNS** - Message queue testing
- **Lambda** - Serverless function integration
- **CloudFront** - CDN for static assets
- **ElastiCache** - Redis/Memcached caching
- **RDS** - Managed database migration

### Application Features
- **User Authentication** - Cognito integration
- **File Processing** - Image resize/thumbnail generation
- **Analytics Dashboard** - CloudWatch metrics visualization
- **Logging System** - CloudWatch Logs integration
- **API Gateway** - RESTful API management
- **WebSocket** - Real-time features with API Gateway

## API Endpoints

### Providers
- `GET /api/providers` - List all providers
- `POST /api/providers` - Create provider
  - Body: `{ provider_id, provider_name, provider_city }`
- `DELETE /api/providers/:id` - Delete provider

### Images
- `GET /api/images` - List all images with metadata
- `POST /api/images` - Upload image (multipart/form-data)
  - Field: `image` (file)
- `DELETE /api/images/:name` - Delete image
- `GET /uploads/:filename` - Serve image file

## Environment Variables
```
DB_HOST=<database-host>
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=<password>
PORT=3001
UPLOAD_DIR=/var/images
```

## Security Considerations
- Database in private subnet
- Security groups restrict access
- File upload size limited to 10MB
- Image file type validation
- SQL injection protection via parameterized queries

## Deployment Checklist
- [ ] PostgreSQL database configured
- [ ] Upload directory created with correct permissions
- [ ] Environment variables set
- [ ] Dependencies installed (`npm install`)
- [ ] Systemd service configured
- [ ] Security groups allow required ports
- [ ] IAM roles attached to EC2 instances
