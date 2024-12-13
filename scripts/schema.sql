-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  embedding BLOB NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_content TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Add any indexes you need
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id); 