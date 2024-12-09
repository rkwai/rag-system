import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').references(() => documents.id),
  content: text('content').notNull(),
  embedding: text('embedding').notNull(),
  position: integer('position').notNull()
});

export const evaluationMetrics = sqliteTable('evaluation_metrics', {
  id: text('id').primaryKey(),
  documentId: text('document_id').references(() => documents.id),
  retrievalQuality: integer('retrieval_quality').notNull(),
  generationQuality: integer('generation_quality').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull()
}); 