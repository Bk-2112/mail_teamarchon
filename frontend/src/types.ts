export interface UserRecord {
  id: string
  discordId?: string
  discordUsername?: string
  discordAvatar?: string
  displayName?: string
  email: string
  roles: string[]
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

export type User = UserRecord

export interface MailboxRecord {
  id: string
  email: string
  displayName?: string
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  isActive: boolean
}

export type Mailbox = MailboxRecord

export interface GroupRecord {
  id: string
  name: string
  description?: string
  memberCount: number
  mailboxCount: number
  createdAt: string
}

export interface GroupDetail {
  group: GroupRecord
  members: UserRecord[]
  mailboxes: MailboxRecord[]
}

export interface EmailAttachment {
  fileName: string
  contentType: string
  size: number
  partSpecifier: string
}

export interface EmailSummary {
  id: string
  uid: number
  subject: string
  from: string
  fromName: string
  to: string
  date: string
  isRead: boolean
  isStarred: boolean
  hasAttachments: boolean
  snippet: string
}

export interface EmailDetail extends EmailSummary {
  htmlBody?: string
  textBody?: string
  attachments: EmailAttachment[]
}

export interface SendEmailPayload {
  mailboxId: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  bodyHtml: string
  bodyText?: string
}
