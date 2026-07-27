import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const domainStatusEnum = pgEnum('domain_status', [
  'pending',      // subdomein aangemaakt, DNS nog niet geverifieerd
  'verifying',    // records staan klaar, Resend valideert
  'verified',     // klaar om mee te versturen
  'failed',       // verificatie mislukt
])

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
])

export const recipientStatusEnum = pgEnum('recipient_status', [
  'pending',
  'sent',
  'failed',
])

export const userRoleEnum = pgEnum('user_role', ['owner', 'member', 'admin'])

// ---------------------------------------------------------------------------
// Tenants — één rij per MKB-klant
// ---------------------------------------------------------------------------

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Bedrijfsgegevens
    businessName: text('business_name').notNull(),
    googleReviewLink: text('google_review_link').notNull(),

    // Verzendconfiguratie. Elke tenant krijgt een eigen subdomein onder het
    // platformdomein, zodat e-mailreputatie per klant geïsoleerd is.
    subdomain: text('subdomain').notNull(),           // bv. "kvik-maastricht"
    sendingDomain: text('sending_domain').notNull(),  // bv. "kvik-maastricht.example.nl"
    resendDomainId: text('resend_domain_id'),         // id uit de Resend API
    domainStatus: domainStatusEnum('domain_status').notNull().default('pending'),
    domainVerifiedAt: timestamp('domain_verified_at', { withTimezone: true }),

    fromName: text('from_name').notNull(),
    replyTo: text('reply_to').notNull(),

    // Limieten — per tenant instelbaar, met een veilige standaard
    monthlyEmailLimit: integer('monthly_email_limit').notNull().default(2000),

    active: boolean('active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subdomainIdx: uniqueIndex('tenants_subdomain_idx').on(t.subdomain),
    sendingDomainIdx: uniqueIndex('tenants_sending_domain_idx').on(t.sendingDomain),
  })
)

// ---------------------------------------------------------------------------
// Users — inloggen, gekoppeld aan één tenant
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('owner'),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    tenantIdx: index('users_tenant_idx').on(t.tenantId),
  })
)

// ---------------------------------------------------------------------------
// Send jobs — één upload/verzendopdracht
// ---------------------------------------------------------------------------

export const sendJobs = pgTable(
  'send_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    status: jobStatusEnum('status').notNull().default('queued'),

    totalRecipients: integer('total_recipients').notNull(),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),

    // Snapshot van de config op moment van verzenden, zodat een latere
    // wijziging aan de tenant de historie niet herschrijft.
    fromAddress: text('from_address').notNull(),
    reviewLink: text('review_link').notNull(),

    error: text('error'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index('send_jobs_tenant_idx').on(t.tenantId),
    statusIdx: index('send_jobs_status_idx').on(t.status),
    createdAtIdx: index('send_jobs_created_at_idx').on(t.createdAt),
  })
)

// ---------------------------------------------------------------------------
// Recipients
//
// Let op: dit is de enige plek waar persoonsgegevens van eindklanten landen.
// De POC was volledig stateless; voor een queue is dat niet houdbaar, want de
// worker moet weten wie er nog moet krijgen. We bewaren daarom zo min mogelijk
// en ruimen op na verwerking (zie lib/db/retention.ts).
// ---------------------------------------------------------------------------

export const sendJobRecipients = pgTable(
  'send_job_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => sendJobs.id, { onDelete: 'cascade' }),

    email: text('email').notNull(),
    name: text('name'),

    status: recipientStatusEnum('status').notNull().default('pending'),
    resendMessageId: text('resend_message_id'),
    error: text('error'),

    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    jobIdx: index('send_job_recipients_job_idx').on(t.jobId),
    // Idempotentie: eenzelfde adres kan binnen één job maar één keer bestaan,
    // zodat een QStash-retry geen dubbele mail veroorzaakt.
    jobEmailIdx: uniqueIndex('send_job_recipients_job_email_idx').on(t.jobId, t.email),
    statusIdx: index('send_job_recipients_status_idx').on(t.status),
  })
)

// ---------------------------------------------------------------------------
// Suppressions — per tenant, gevoed door uitschrijvingen en harde bounces
// ---------------------------------------------------------------------------

export const suppressions = pgTable(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Gehasht opgeslagen (SHA-256 van het genormaliseerde adres): we hoeven
    // het adres nooit terug te lezen, alleen te toetsen of het voorkomt.
    emailHash: text('email_hash').notNull(),
    reason: text('reason').notNull(), // 'unsubscribe' | 'bounce' | 'complaint'

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantHashIdx: uniqueIndex('suppressions_tenant_hash_idx').on(t.tenantId, t.emailHash),
  })
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  sendJobs: many(sendJobs),
  suppressions: many(suppressions),
}))

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
}))

export const sendJobsRelations = relations(sendJobs, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sendJobs.tenantId], references: [tenants.id] }),
  recipients: many(sendJobRecipients),
}))

export const sendJobRecipientsRelations = relations(sendJobRecipients, ({ one }) => ({
  job: one(sendJobs, { fields: [sendJobRecipients.jobId], references: [sendJobs.id] }),
}))

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type SendJob = typeof sendJobs.$inferSelect
export type SendJobRecipient = typeof sendJobRecipients.$inferSelect
