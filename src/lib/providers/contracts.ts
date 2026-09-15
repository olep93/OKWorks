export type StoredObject = Readonly<{ key: string; checksum: string; size: number; mimeType: string }>;

export interface StorageProvider {
  putPrivate(input: { organizationId: string; name: string; mimeType: string; bytes: Uint8Array }): Promise<StoredObject>;
  getAuthorizedUrl(input: { organizationId: string; key: string; expiresInSeconds: number }): Promise<string>;
  delete(input: { organizationId: string; key: string }): Promise<void>;
}

export interface PdfProvider<TSnapshot = unknown> {
  renderInvoice(snapshot: TSnapshot): Promise<Uint8Array>;
  renderDocumentation(input: { organizationId: string; orderId: string }): Promise<Uint8Array>;
}

export interface EmailProvider {
  send(input: { organizationId: string; to: string; subject: string; text: string; attachments: Array<{ name: string; bytes: Uint8Array }>; idempotencyKey: string }): Promise<{ providerMessageId: string }>;
}

export interface RoutesProvider {
  calculate(input: { origin: string; destination: string; roundTrip: boolean }): Promise<{ distanceMeters: number; durationSeconds: number; estimatedTollsOre?: number }>;
}

export interface OcrProvider { extractReceipt(bytes: Uint8Array): Promise<{ raw: unknown; confidence: number }>; }
export interface SubscriptionProvider { getEntitlements(organizationId: string): Promise<ReadonlySet<string>>; }
export interface BankProvider { syncTransactions(connectionId: string): Promise<{ imported: number }>; }
export interface AiProvider { suggestWorkReport(input: { notes: string }): Promise<{ suggestion: string }>; }
