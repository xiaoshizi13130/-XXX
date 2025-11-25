
import { AuditRule, ReimbursementRequest, RuleType, RequestType, DEFAULT_REQUEST_TYPES_LIST } from '../types';

declare global {
  interface Window {
    alasql: any;
  }
}

const DB_NAME = 'expense_system_db';

// 默认初始规则
export const DEFAULT_RULES: AuditRule[] = [
  { 
    id: '1', 
    name: '大额消费预警', 
    type: RuleType.MAX_AMOUNT, 
    value: 2000, 
    enabled: true, 
    description: '单笔超过 2000 元需重点审核',
    receiptType: 'ALL',
    linkedRequestType: 'ALL'
  },
  { 
    id: '2', 
    name: '禁止娱乐报销', 
    type: RuleType.FORBIDDEN_CATEGORY, 
    value: '娱乐', 
    enabled: true, 
    description: '公司规定禁止报销KTV、洗浴等娱乐费用',
    receiptType: 'ALL',
    linkedRequestType: 'ALL'
  },
  { 
    id: '3', 
    name: '周末支出检查', 
    type: RuleType.WEEKEND_BAN, 
    value: 'All', 
    enabled: false, 
    description: '非工作日产生的费用需人工审核',
    receiptType: 'ALL',
    linkedRequestType: 'ALL'
  },
  { 
    id: '4', 
    name: '必填商户名称', 
    type: RuleType.REQUIRED_FIELD, 
    value: 'Merchant', 
    enabled: true, 
    description: '拦截未识别出商户名称的收据',
    receiptType: 'ALL',
    linkedRequestType: 'ALL'
  },
  { 
    id: '5', 
    name: '烟酒类限制', 
    type: RuleType.FORBIDDEN_CATEGORY, 
    value: '烟酒', 
    enabled: true, 
    description: '禁止报销烟草及酒精类商品',
    receiptType: 'ALL',
    linkedRequestType: 'ALL'
  },
  {
    id: '6',
    name: '打车票限额',
    type: RuleType.MAX_AMOUNT,
    value: 200,
    enabled: true, 
    description: '单张出租车票不得超过 200 元',
    receiptType: '出租车票',
    linkedRequestType: 'ALL'
  }
];

export const db = {
  initialized: false,

  // 初始化数据库连接
  init: async () => {
    if (db.initialized) return;
    const alasql = window.alasql;
    if (!alasql) {
        console.error("Database Engine (AlaSQL) not loaded");
        return;
    }

    try {
        // 创建持久化 LocalStorage 数据库
        await alasql.promise(`CREATE LOCALSTORAGE DATABASE IF NOT EXISTS ${DB_NAME}`);
        await alasql.promise(`ATTACH LOCALSTORAGE DATABASE ${DB_NAME}`);
        await alasql.promise(`USE ${DB_NAME}`);

        // 创建数据表
        await alasql.promise(`CREATE TABLE IF NOT EXISTS rules (
            id STRING, 
            name STRING, 
            type STRING, 
            [value] STRING, 
            enabled BOOLEAN, 
            description STRING,
            receiptType STRING,
            linkedRequestType STRING
        )`);
        
        await alasql.promise(`CREATE TABLE IF NOT EXISTS requests (
            id STRING, 
            employeeId STRING, 
            employeeName STRING,
            submissionDate STRING, 
            receiptImage STRING, 
            data JSON, 
            requestType STRING,
            status STRING, 
            auditResult JSON, 
            history JSON,
            processedBy STRING,
            processedAt STRING,
            comments STRING
        )`);

        await alasql.promise(`CREATE TABLE IF NOT EXISTS request_types (
            id STRING,
            name STRING,
            linkedRuleIds JSON
        )`);

        // 初始化默认规则
        const ruleCount = await alasql.promise("SELECT VALUE COUNT(*) FROM rules");
        if (ruleCount === 0) {
            console.log("Seeding default rules...");
            await alasql.promise("INSERT INTO rules SELECT * FROM ?", [DEFAULT_RULES]);
        } else {
            // Migration: Check for new columns
            const rules = await alasql.promise("SELECT * FROM rules");
            if (rules.length > 0) {
                if (rules[0].receiptType === undefined) {
                    await alasql.promise("UPDATE rules SET receiptType = 'ALL' WHERE receiptType IS NULL");
                }
                if (rules[0].linkedRequestType === undefined) {
                    await alasql.promise("UPDATE rules SET linkedRequestType = 'ALL' WHERE linkedRequestType IS NULL");
                }
            }
        }
        
        // Seed Request Types
        let rtCount = await alasql.promise("SELECT VALUE COUNT(*) FROM request_types");
        if (rtCount === 0) {
            console.log("Seeding default request types...");
            // Use existing rules to populate initial links
            const rules = await alasql.promise("SELECT * FROM rules");
            const allRuleIds = rules.map((r: any) => r.id);
            
            const seeds = DEFAULT_REQUEST_TYPES_LIST.map((name, idx) => ({ 
                id: `rt_${Date.now()}_${idx}`, 
                name,
                linkedRuleIds: allRuleIds // Default to all rules for fresh install
            }));
            await alasql.promise("INSERT INTO request_types SELECT * FROM ?", [seeds]);
        } 
        
        // Migration: Ensure request_types have linkedRuleIds
        const requestTypes = await alasql.promise("SELECT * FROM request_types");
        if (requestTypes.length > 0 && requestTypes[0].linkedRuleIds === undefined) {
            console.log("Migrating request_types schema (linkedRuleIds)...");
            const rules = await alasql.promise("SELECT * FROM rules");
            
            // Re-map based on old 'linkedRequestType' if it exists, otherwise default to all
            const updatedTypes = requestTypes.map((rt: any) => {
                const matchingRules = rules.filter((r: any) => 
                    !r.linkedRequestType || 
                    r.linkedRequestType === 'ALL' || 
                    r.linkedRequestType === rt.id
                );
                return { 
                    ...rt, 
                    linkedRuleIds: matchingRules.map((r: any) => r.id) 
                };
            });
            
            await alasql.promise("DELETE FROM request_types");
            await alasql.promise("INSERT INTO request_types SELECT * FROM ?", [updatedTypes]);
        }

        db.initialized = true;
        console.log("Local SQL Database Initialized");
    } catch (e) {
        console.error("DB Init Error:", e);
    }
  },

  // 获取所有规则
  getRules: async (): Promise<AuditRule[]> => {
    if (!db.initialized) await db.init();
    return window.alasql.promise("SELECT * FROM rules");
  },

  // 保存规则 (全量更新)
  saveRules: async (rules: AuditRule[]) => {
     if (!db.initialized) await db.init();
     await window.alasql.promise("DELETE FROM rules");
     if (rules.length > 0) {
        await window.alasql.promise("INSERT INTO rules SELECT * FROM ?", [rules]);
     }
  },

  // 获取申请类型
  getRequestTypes: async (): Promise<RequestType[]> => {
      if (!db.initialized) await db.init();
      return window.alasql.promise("SELECT * FROM request_types");
  },

  // 保存申请类型
  saveRequestTypes: async (types: RequestType[]) => {
      if (!db.initialized) await db.init();
      await window.alasql.promise("DELETE FROM request_types");
      if (types.length > 0) {
          await window.alasql.promise("INSERT INTO request_types SELECT * FROM ?", [types]);
      }
  },

  // 获取所有申请
  getRequests: async (): Promise<ReimbursementRequest[]> => {
    if (!db.initialized) await db.init();
    return window.alasql.promise("SELECT * FROM requests ORDER BY submissionDate DESC");
  },

  // 添加新申请
  addRequest: async (req: ReimbursementRequest) => {
    if (!db.initialized) await db.init();
    await window.alasql.promise("INSERT INTO requests SELECT * FROM ?", [[req]]);
  },

  // 更新申请
  updateRequest: async (req: ReimbursementRequest) => {
    if (!db.initialized) await db.init();
    await window.alasql.promise("DELETE FROM requests WHERE id = ?", [req.id]);
    await window.alasql.promise("INSERT INTO requests SELECT * FROM ?", [[req]]);
  },

  // 执行原始 SQL (供后台管理使用)
  executeSQL: async (sql: string) => {
      if (!db.initialized) await db.init();
      return window.alasql.promise(sql);
  },

  // 重置数据库
  resetDB: async () => {
      if (!db.initialized) await db.init();
      await window.alasql.promise(`DROP TABLE IF EXISTS rules`);
      await window.alasql.promise(`DROP TABLE IF EXISTS requests`);
      await window.alasql.promise(`DROP TABLE IF EXISTS request_types`);
      // 重新初始化
      db.initialized = false;
      await db.init();
  },

  // 获取存储占用
  getUsage: () => {
      let total = 0;
      for (let key in localStorage) {
          if (key.startsWith('ls' + DB_NAME) || key === DB_NAME) {
              total += localStorage.getItem(key)?.length || 0;
          }
      }
      return (total / 1024).toFixed(2);
  }
};
