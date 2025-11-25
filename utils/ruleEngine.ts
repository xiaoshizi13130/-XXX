
import { AuditResult, AuditRule, ReceiptData, RuleType } from "../types";

// 定义不同规则类型的风险权重
// 分值越高，风险越大
const RULE_WEIGHTS: Record<RuleType, number> = {
  [RuleType.FORBIDDEN_CATEGORY]: 100, // 严重违规：直接拉满风险值
  [RuleType.MAX_AMOUNT]: 60,          // 高风险：预算超支
  [RuleType.WEEKEND_BAN]: 30,         // 中风险：非工作时间支出
  [RuleType.REQUIRED_FIELD]: 20,      // 低风险：信息缺失
};

/**
 * 评估单据是否符合规则
 * @param data 单据数据
 * @param rules 规则列表
 * @param activeRuleIds 当前申请类型激活的规则 ID 列表。如果未提供(undefined)，默认应用所有 enabled 规则(兼容旧逻辑)。
 */
export const evaluateRules = (data: ReceiptData, rules: AuditRule[], activeRuleIds?: string[]): AuditResult => {
  const triggeredRules: string[] = [];
  let totalRiskScore = 0;

  const activeRules = rules.filter(r => r.enabled);

  for (const rule of activeRules) {
    // 1. 检查规则是否被当前申请类型激活
    // 如果提供了 activeRuleIds 列表，严格检查规则 ID 是否在列表中
    if (activeRuleIds && !activeRuleIds.includes(rule.id)) {
        continue;
    }

    // 2. 检查规则是否适用于当前单据类型 (OCR Type)
    // 这是一个规则本身的属性，与申请类型无关
    if (rule.receiptType && rule.receiptType !== 'ALL') {
        const currentType = data.type || '';
        if (!currentType.includes(rule.receiptType)) {
            continue;
        }
    }

    let violation = false;

    switch (rule.type) {
      case RuleType.MAX_AMOUNT:
        if (data.totalAmount > Number(rule.value)) {
          violation = true;
        }
        break;

      case RuleType.FORBIDDEN_CATEGORY:
        // Case insensitive check
        if (data.category && data.category.toLowerCase().includes(String(rule.value).toLowerCase())) {
          violation = true;
        }
        break;
      
      case RuleType.WEEKEND_BAN:
        if (data.date) {
          const date = new Date(data.date);
          // 确保日期有效
          if (!isNaN(date.getTime())) {
            const day = date.getDay();
            // 0 is Sunday, 6 is Saturday
            if (day === 0 || day === 6) {
              violation = true;
            }
          }
        }
        break;
        
      case RuleType.REQUIRED_FIELD:
          // e.g., check if merchant name is missing or generic
          if (rule.value === 'Merchant' && (!data.merchantName || data.merchantName === 'Unknown' || data.merchantName === '未知')) {
              violation = true;
          }
          break;
    }

    if (violation) {
      triggeredRules.push(rule.id);
      // 累加风险分数
      const weight = RULE_WEIGHTS[rule.type] || 10;
      totalRiskScore += weight;
    }
  }

  // 确保分数在 0-100 之间
  const finalScore = Math.min(Math.max(totalRiskScore, 0), 100);

  return {
    passed: triggeredRules.length === 0,
    triggeredRules,
    score: finalScore, 
  };
};
