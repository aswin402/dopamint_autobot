# Object File Storage with S3 & Cloudflare R2 🪣

This backend template utilizes the official **AWS SDK v3 S3 client** (`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`) to connect to object storage buckets. This architecture is fully compatible with standard AWS S3, Cloudflare R2, MinIO, or DigitalOcean Spaces.

## 🛠️ Usage Guide

### 1. Direct Server-Side Upload
Upload files directly from your server actions or API routes:

```typescript
import { uploadToS3 } from '@/lib/s3';

const fileBuffer = Buffer.from('Hello File Storage');

await uploadToS3({
  key: 'uploads/docs/hello-world.txt',
  body: fileBuffer,
  contentType: 'text/plain',
});
```

---

### 2. Client-Side Uploads via Presigned URLs (Best Practice)
For optimal speed, large file uploads should bypass the Next.js server limits and be uploaded directly from the browser to the bucket using a secure, pre-signed upload URL.

#### Step A: Generate URL in Route Handler / Server Action
```typescript
import { getPresignedUploadUrl } from '@/lib/s3';

// Generate a URL valid for 10 minutes (600 seconds)
const uploadUrl = await getPresignedUploadUrl('user-avatars/user_1.png', 'image/png', 600);
```

#### Step B: Send file directly from Client Component
```typescript
const file = event.target.files[0];

await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type,
  },
});
```

---

## 🎛️ Configurations

Adjust the environment variables in `.env`:
```env
S3_REGION="us-east-1"
S3_BUCKET="my-app-bucket"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"

# Optional: Add custom endpoints for MinIO / Cloudflare R2 / DigitalOcean Spaces
S3_ENDPOINT="https://xxxxxx.r2.cloudflarestorage.com"
```
