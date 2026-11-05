import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/* --- Better Auth tables (fields match the better-auth drizzle adapter defaults) --- */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

/* --- App tables --- */

export const brands = pgTable('brands', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  data: jsonb('data').notNull(),
  createdAt: text('created_at').notNull(),
});

export const artifacts = pgTable('artifacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  brandId: text('brand_id'),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  currentVersion: integer('current_version').notNull(),
  createdAt: text('created_at').notNull(),
});

export const versions = pgTable('versions', {
  id: text('id').primaryKey(), // `${artifactId}:${version}`
  artifactId: text('artifact_id').notNull(),
  version: integer('version').notNull(),
  doc: jsonb('doc').notNull(),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
});

export const renders = pgTable('renders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  artifactId: text('artifact_id').notNull(),
  version: integer('version').notNull(),
  aspect: text('aspect').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  remoteId: text('remote_id'),
  bucketName: text('bucket_name'),
  functionName: text('function_name'),
  region: text('region'),
  url: text('url'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
});

export const credits = pgTable('credits', {
  userId: text('user_id').primaryKey(),
  total: integer('total').notNull(),
  used: integer('used').notNull(),
});
