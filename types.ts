
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  WITHDRAWN = 'WITHDRAWN',
}

export enum RuleType {
  MAX_AMOUNT = 'MAX_AMOUNT',
  FORBIDDEN_CATEGORY = 'FORBIDDEN_CATEGORY',
  WEEKEND_BAN = 'WEEKEND_BAN',
  REQUIRED_FIELD = 'REQUIRED_FIELD',
}

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  AUDITOR = 'AUDITOR',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface RequestType {
  id: string;
  name: string;
  linkedRuleIds?: string[]; // IDs of AuditRules that apply to this request type
}

export interface AuditRule {
  id: string;
  name: string;
  type: RuleType;
  value: string | number; // e.g., 500 for MAX_AMOUNT, "Alcohol" for FORBIDDEN_CATEGORY
  enabled: boolean;
  description: string;
  receiptType?: string; // 'ALL' or specific OCR type like '发票', '火车票'
  linkedRequestType?: string; // Deprecated: Logic moved to RequestType.linkedRuleIds
}

export interface ReceiptItem {
  description: string;
  amount: number;
}

export interface ReceiptData {
  merchantName: string;
  date: string; // YYYY-MM-DD
  totalAmount: number;
  currency: string;
  category: string; // Food, Transport, Accommodation, Office, Other
  type?: string; // Invoice, Receipt, Train Ticket, Contract, etc.
  items: ReceiptItem[];
  confidence: number; // 0-1
}

export interface AuditResult {
  passed: boolean;
  triggeredRules: string[]; // IDs of rules that failed
  score: number; // 0-100 risk score (0 = safe, 100 = risky)
}

export interface RequestHistoryEntry {
  timestamp: string;
  actorName: string;
  action: string; // e.g. "提交申请", "批准", "拒绝"
  status: RequestStatus;
  note?: string;
}

export interface ReimbursementRequest {
  id: string;
  employeeId: string; // Link to User.id
  employeeName: string;
  submissionDate: string;
  receiptImage: string; // Base64
  data: ReceiptData;
  requestType: string; // Name of the request type
  status: RequestStatus;
  auditResult: AuditResult;
  comments?: string;
  processedBy?: string; // Name of the auditor/admin who processed the request
  processedAt?: string; // ISO Date string of when it was processed
  history?: RequestHistoryEntry[];
}

export const RECEIPT_TYPES = ["发票", "收据", "火车票", "飞机票", "出租车票", "合同", "行程单", "其他"];

export const DEFAULT_REQUEST_TYPES_LIST = ["日常报销", "差旅报销", "小额采购", "业务招待", "团建费用", "培训会议", "其他"];
