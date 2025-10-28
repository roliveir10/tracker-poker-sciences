-- Add metadata and optional blob storage for imports to ensure persistence without S3.
ALTER TABLE "Import"
ADD COLUMN "originalName" TEXT,
ADD COLUMN "contentType" TEXT,
ADD COLUMN "size" INTEGER,
ADD COLUMN "fileBlob" BYTEA;
