import {
  bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const roleEnum = pgEnum("organization_role", ["OWNER", "ADMIN", "USER"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["TRIAL", "INCOMPLETE", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"]);
export const orderStatusEnum = pgEnum("order_status", ["DRAFT", "OPEN", "IN_PROGRESS", "READY_FOR_INVOICE", "INVOICED", "CLOSED", "CANCELLED"]);
export const billingStatusEnum = pgEnum("billing_status", ["UNBILLED", "INVOICED", "NON_BILLABLE"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "FINALIZED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CREDITED", "VOID"]);
export const imageCategoryEnum = pgEnum("image_category", ["BEFORE", "ISSUE", "DURING", "AFTER", "OTHER"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  organizationNumber: varchar("organization_number", { length: 20 }),
  email: varchar("email", { length: 320 }),
  bankAccount: varchar("bank_account", { length: 32 }),
  vatRegistered: boolean("vat_registered").notNull().default(false),
  defaultPaymentTermsDays: integer("default_payment_terms_days").notNull().default(14),
  defaultVatBasisPoints: integer("default_vat_basis_points").notNull().default(2500),
  defaultHourlyRateOre: bigint("default_hourly_rate_ore", { mode: "number" }),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const organizationMembers = pgTable("organization_members", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("USER"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.userId] }),
  index("organization_members_user_idx").on(table.userId),
]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash), index("auth_sessions_user_idx").on(table.userId)]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 40 }),
  providerCustomerId: varchar("provider_customer_id", { length: 180 }),
  providerSubscriptionId: varchar("provider_subscription_id", { length: 180 }),
  planCode: varchar("plan_code", { length: 80 }).notNull().default("BASIC"),
  priceAmountOre: bigint("price_amount_ore", { mode: "number" }),
  currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
  status: subscriptionStatusEnum("status").notNull().default("TRIAL"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("subscriptions_org_unique").on(table.organizationId),
  uniqueIndex("subscriptions_provider_id_unique").on(table.provider, table.providerSubscriptionId),
]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 16 }).notNull().default("COMPANY"),
  name: varchar("name", { length: 200 }).notNull(),
  organizationNumber: varchar("organization_number", { length: 20 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  postalCode: varchar("postal_code", { length: 16 }),
  city: varchar("city", { length: 120 }),
  notes: text("notes"),
  paymentTermsOverride: integer("payment_terms_override"),
  ...timestamps,
}, (table) => [index("customers_org_name_idx").on(table.organizationId, table.name), index("customers_org_created_idx").on(table.organizationId, table.createdAt)]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 30 }).notNull(),
  defaultPriceOre: bigint("default_price_ore", { mode: "number" }).notNull(),
  vatBasisPoints: integer("vat_basis_points").notNull(),
  productCode: varchar("product_code", { length: 80 }),
  category: varchar("category", { length: 80 }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [index("products_org_active_idx").on(table.organizationId, table.active), uniqueIndex("products_org_code_unique").on(table.organizationId, table.productCode)]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderNumber: integer("order_number").notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: orderStatusEnum("status").notNull().default("DRAFT"),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  workAddress: text("work_address"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  readyForInvoiceAt: timestamp("ready_for_invoice_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("orders_org_number_unique").on(table.organizationId, table.orderNumber),
  index("orders_org_status_idx").on(table.organizationId, table.status),
  index("orders_org_customer_idx").on(table.organizationId, table.customerId),
  index("orders_org_updated_idx").on(table.organizationId, table.updatedAt),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  nameSnapshot: varchar("name_snapshot", { length: 240 }).notNull(),
  descriptionSnapshot: text("description_snapshot"),
  unitSnapshot: varchar("unit_snapshot", { length: 30 }).notNull(),
  unitPriceOre: bigint("unit_price_ore", { mode: "number" }).notNull(),
  quantityThousandths: integer("quantity_thousandths").notNull(),
  vatBasisPoints: integer("vat_basis_points").notNull(),
  billingStatus: billingStatusEnum("billing_status").notNull().default("UNBILLED"),
  invoiceLineId: uuid("invoice_line_id"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [index("order_items_org_order_idx").on(table.organizationId, table.orderId), index("order_items_unbilled_idx").on(table.organizationId, table.orderId, table.billingStatus)]);

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  workDate: timestamp("work_date", { withTimezone: true }).notNull(),
  minutes: integer("minutes").notNull(),
  ratePerHourOre: bigint("rate_per_hour_ore", { mode: "number" }).notNull(),
  description: text("description"),
  billingStatus: billingStatusEnum("billing_status").notNull().default("UNBILLED"),
  invoiceLineId: uuid("invoice_line_id"),
  ...timestamps,
}, (table) => [index("time_entries_org_order_idx").on(table.organizationId, table.orderId), index("time_entries_unbilled_idx").on(table.organizationId, table.orderId, table.billingStatus)]);

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  storageProvider: varchar("storage_provider", { length: 40 }).notNull(),
  storageKey: text("storage_key").notNull(),
  originalFileName: varchar("original_file_name", { length: 300 }).notNull(),
  mimeType: varchar("mime_type", { length: 160 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("attachments_org_storage_unique").on(table.organizationId, table.storageKey), index("attachments_org_created_idx").on(table.organizationId, table.createdAt)]);

export const documentationItems = pgTable("documentation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  attachmentId: uuid("attachment_id").notNull().references(() => attachments.id),
  category: imageCategoryEnum("category").notNull().default("OTHER"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  annotatedAttachmentId: uuid("annotated_attachment_id").references(() => attachments.id),
  ...timestamps,
}, (table) => [index("documentation_org_order_idx").on(table.organizationId, table.orderId, table.sortOrder)]);

export const invoiceSequences = pgTable("invoice_sequences", {
  organizationId: uuid("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1001),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sourceOrderId: uuid("source_order_id").notNull().references(() => orders.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  invoiceNumber: integer("invoice_number"),
  status: invoiceStatusEnum("status").notNull().default("DRAFT"),
  issueDate: timestamp("issue_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
  subtotalOre: bigint("subtotal_ore", { mode: "number" }).notNull().default(0),
  vatAmountOre: bigint("vat_amount_ore", { mode: "number" }).notNull().default(0),
  totalOre: bigint("total_ore", { mode: "number" }).notNull().default(0),
  paidAmountOre: bigint("paid_amount_ore", { mode: "number" }).notNull().default(0),
  remainingAmountOre: bigint("remaining_amount_ore", { mode: "number" }).notNull().default(0),
  kid: varchar("kid", { length: 32 }),
  organizationSnapshot: jsonb("organization_snapshot"),
  customerSnapshot: jsonb("customer_snapshot"),
  bankAccountSnapshot: varchar("bank_account_snapshot", { length: 32 }),
  idempotencyKey: uuid("idempotency_key").notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("invoices_org_number_unique").on(table.organizationId, table.invoiceNumber),
  uniqueIndex("invoices_org_idempotency_unique").on(table.organizationId, table.idempotencyKey),
  index("invoices_org_status_idx").on(table.organizationId, table.status),
  index("invoices_org_customer_idx").on(table.organizationId, table.customerId),
  index("invoices_org_due_idx").on(table.organizationId, table.dueDate),
]);

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  sourceType: varchar("source_type", { length: 40 }),
  sourceId: uuid("source_id"),
  lineType: varchar("line_type", { length: 40 }).notNull(),
  description: text("description").notNull(),
  quantityThousandths: integer("quantity_thousandths").notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  unitPriceOre: bigint("unit_price_ore", { mode: "number" }).notNull(),
  vatBasisPoints: integer("vat_basis_points").notNull(),
  subtotalOre: bigint("subtotal_ore", { mode: "number" }).notNull(),
  vatAmountOre: bigint("vat_amount_ore", { mode: "number" }).notNull(),
  totalOre: bigint("total_ore", { mode: "number" }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("invoice_lines_org_invoice_idx").on(table.organizationId, table.invoiceId, table.sortOrder),
  uniqueIndex("invoice_lines_billed_source_unique").on(table.organizationId, table.sourceType, table.sourceId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt), index("audit_logs_org_entity_idx").on(table.organizationId, table.entityType, table.entityId)]);
