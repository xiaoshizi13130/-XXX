
import React, { useState, useRef, useEffect } from 'react';
import { AuditRule, RuleType, RECEIPT_TYPES, RequestType } from '../types';
import { Plus, Trash2, AlertTriangle, Ban, Calendar, DollarSign, Lock, Sparkles, Zap, Download, Upload, Filter, Briefcase, Settings2, ListChecks, CheckCheck, Pencil, Save, X, CheckSquare, Square, Search } from 'lucide-react';

interface RuleConfigProps {
  rules: AuditRule[];
  setRules: React.Dispatch<React.SetStateAction<AuditRule[]>>;
  requestTypes: RequestType[];
  setRequestTypes: React.Dispatch<React.SetStateAction<RequestType[]>>;
  readOnly?: boolean;
  highlightedRuleId?: string | null;
}

// 预设规则模板
const PRESET_RULES: Partial<AuditRule>[] = [
  { 
    name: '大额消费预警', 
    type: RuleType.MAX_AMOUNT, 
    value: 2000, 
    description: '单笔超过 2000 元需重点审核',
    receiptType: 'ALL'
  },
  { 
    name: '禁止娱乐报销', 
    type: RuleType.FORBIDDEN_CATEGORY, 
    value: '娱乐', 
    description: '公司规定禁止报销KTV、洗浴等娱乐费用',
    receiptType: 'ALL'
  },
  { 
    name: '周末支出检查', 
    type: RuleType.WEEKEND_BAN, 
    value: 'All', 
    description: '非工作日产生的费用需说明原因',
    receiptType: 'ALL'
  },
  { 
    name: '必填商户名称', 
    type: RuleType.REQUIRED_FIELD, 
    value: 'Merchant', 
    description: '拦截未识别出商户名称的收据',
    receiptType: 'ALL'
  },
  { 
    name: '出租车票限额', 
    type: RuleType.MAX_AMOUNT, 
    value: 200, 
    description: '单张出租车票不得超过 200 元',
    receiptType: '出租车票'
  }
];

const RuleConfig: React.FC<RuleConfigProps> = ({ rules, setRules, requestTypes, setRequestTypes, readOnly = false, highlightedRuleId }) => {
  // 默认显示 'types' (报销申请类型)，除非指定了高亮规则
  const [activeTab, setActiveTab] = useState<'rules' | 'types'>(highlightedRuleId ? 'rules' : 'types');
  
  // 如果从外部传入了高亮规则ID，自动切换到规则Tab
  useEffect(() => {
    if (highlightedRuleId) {
        setActiveTab('rules');
    }
  }, [highlightedRuleId]);
  
  // Rule State
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<AuditRule>>({
    type: RuleType.MAX_AMOUNT,
    enabled: true,
    name: '',
    value: '',
    description: '',
    receiptType: 'ALL'
  });

  // Request Type State
  const [newRequestType, setNewRequestType] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  // Temp state for editing linked rules
  const [editTypeRules, setEditTypeRules] = useState<string[]>([]);
  const [ruleSearchTerm, setRuleSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Rule Logic ---

  const handleToggle = (id: string) => {
    if (readOnly) return;
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDeleteRule = (id: string) => {
    if (readOnly) return;
    if (confirm('确定要删除此规则吗？')) {
        setRules(prev => prev.filter(r => r.id !== id));
        if (editingRuleId === id) {
            setIsAddingRule(false);
            setEditingRuleId(null);
        }
        // Also remove from request types
        setRequestTypes(prev => prev.map(rt => ({
            ...rt,
            linkedRuleIds: rt.linkedRuleIds?.filter(rid => rid !== id) || []
        })));
    }
  };

  const handleEditRule = (rule: AuditRule) => {
      if (readOnly) return;
      setNewRule({ ...rule });
      setEditingRuleId(rule.id);
      setIsAddingRule(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveRule = () => {
    if (readOnly) return;
    // Allow value to be 0
    if (!newRule.name || newRule.value === '' || newRule.value === undefined) return;

    if (editingRuleId) {
        // Update existing
        setRules(prev => prev.map(r => r.id === editingRuleId ? {
            ...r,
            name: newRule.name!,
            type: newRule.type!,
            value: newRule.value!,
            description: newRule.description!,
            receiptType: newRule.receiptType || 'ALL',
        } : r));
        setEditingRuleId(null);
    } else {
        // Create new
        const newId = Date.now().toString();
        const rule: AuditRule = {
            id: newId,
            name: newRule.name!,
            type: newRule.type || RuleType.MAX_AMOUNT,
            value: newRule.value!,
            enabled: true,
            description: newRule.description || '自定义规则',
            receiptType: newRule.receiptType || 'ALL',
        };
        setRules([...rules, rule]);
        
        // Auto-link to all request types by default for convenience
        setRequestTypes(prev => prev.map(rt => ({
             ...rt,
             linkedRuleIds: [...(rt.linkedRuleIds || []), newId]
        })));
    }
    
    setIsAddingRule(false);
    setNewRule({ type: RuleType.MAX_AMOUNT, enabled: true, name: '', value: '', description: '', receiptType: 'ALL' });
  };

  const handleCancelRuleEdit = () => {
      setIsAddingRule(false);
      setEditingRuleId(null);
      setNewRule({ type: RuleType.MAX_AMOUNT, enabled: true, name: '', value: '', description: '', receiptType: 'ALL' });
  };

  const handleAddPreset = (preset: Partial<AuditRule>) => {
    if (readOnly) return;
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const rule: AuditRule = {
      id: newId,
      name: preset.name!,
      type: preset.type!,
      value: preset.value!,
      enabled: true,
      description: preset.description!,
      receiptType: preset.receiptType || 'ALL'
    };
    setRules([...rules, rule]);
    
    // Auto add to all request types
    setRequestTypes(prev => prev.map(rt => ({
         ...rt,
         linkedRuleIds: [...(rt.linkedRuleIds || []), newId]
    })));

    setIsAddingRule(false);
  };

  // --- Request Type Logic ---

  const handleAddRequestType = () => {
      if (readOnly || !newRequestType.trim()) return;
      if (requestTypes.some(rt => rt.name === newRequestType.trim())) {
          alert("该类型已存在");
          return;
      }
      const newType: RequestType = {
          id: `rt_${Date.now()}`,
          name: newRequestType.trim(),
          linkedRuleIds: rules.map(r => r.id) // Default all rules enabled
      };
      setRequestTypes([...requestTypes, newType]);
      setNewRequestType('');
  };

  const handleDeleteRequestType = (id: string) => {
      if (readOnly) return;
      if (confirm('确定要删除此申请类型吗？历史单据可能显示异常。')) {
          setRequestTypes(prev => prev.filter(t => t.id !== id));
      }
  };

  const startEditType = (type: RequestType) => {
      if (readOnly) return;
      setEditingTypeId(type.id);
      setEditTypeName(type.name);
      setEditTypeRules(type.linkedRuleIds || []);
      setRuleSearchTerm('');
  };

  const toggleTypeRule = (ruleId: string) => {
      setEditTypeRules(prev => {
          if (prev.includes(ruleId)) return prev.filter(id => id !== ruleId);
          return [...prev, ruleId];
      });
  };

  const toggleAllVisibleRules = () => {
      const visibleRuleIds = rules
        .filter(r => r.name.toLowerCase().includes(ruleSearchTerm.toLowerCase()))
        .map(r => r.id);
      
      const allVisibleSelected = visibleRuleIds.every(id => editTypeRules.includes(id));
      
      if (allVisibleSelected) {
          // Deselect all visible
          setEditTypeRules(prev => prev.filter(id => !visibleRuleIds.includes(id)));
      } else {
          // Select all visible (preserving already selected ones that are hidden)
          setEditTypeRules(prev => {
              const newSet = new Set(prev);
              visibleRuleIds.forEach(id => newSet.add(id));
              return Array.from(newSet);
          });
      }
  };

  const saveEditType = (id: string) => {
      if (!editTypeName.trim()) return;
      // Check for duplicates (excluding self)
      if (requestTypes.some(rt => rt.name === editTypeName.trim() && rt.id !== id)) {
          alert("该类型名称已存在");
          return;
      }
      setRequestTypes(prev => prev.map(t => t.id === id ? { 
          ...t, 
          name: editTypeName.trim(),
          linkedRuleIds: editTypeRules
      } : t));
      setEditingTypeId(null);
      setEditTypeName('');
      setEditTypeRules([]);
  };

  // --- Import/Export ---

  const handleExport = () => {
    const data = JSON.stringify(rules, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rules_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedRules = JSON.parse(content);
        if (Array.isArray(importedRules)) {
            // Basic validation
            const isValid = importedRules.every(r => r.id && r.type && r.name);
            if (isValid) {
                if (window.confirm(`确认导入 ${importedRules.length} 条规则？这将覆盖当前所有规则配置。`)) {
                    setRules(importedRules);
                }
            } else {
                alert('文件格式错误：规则数据结构不完整');
            }
        } else {
            alert('文件格式错误：必须是规则数组 JSON');
        }
      } catch (err) {
        console.error(err);
        alert('解析 JSON 失败');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getIcon = (type: RuleType) => {
    switch (type) {
      case RuleType.MAX_AMOUNT: return <DollarSign className="w-4 h-4 text-amber-500" />;
      case RuleType.FORBIDDEN_CATEGORY: return <Ban className="w-4 h-4 text-red-500" />;
      case RuleType.WEEKEND_BAN: return <Calendar className="w-4 h-4 text-blue-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRuleTypeLabel = (type: RuleType) => {
      switch(type) {
          case RuleType.MAX_AMOUNT: return '金额上限';
          case RuleType.FORBIDDEN_CATEGORY: return '违禁类别';
          case RuleType.WEEKEND_BAN: return '周末限制';
          case RuleType.REQUIRED_FIELD: return '必填字段';
          default: return type;
      }
  }

  // Filter for Request Type Rule Selector
  const visibleRules = rules.filter(r => 
      r.name.toLowerCase().includes(ruleSearchTerm.toLowerCase()) || 
      r.description.toLowerCase().includes(ruleSearchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             系统配置
             {readOnly && <span className="text-xs font-normal px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 flex items-center gap-1"><Lock className="w-3 h-3" /> 仅查看</span>}
          </h2>
          <p className="text-slate-500">管理审核规则和系统基础选项。</p>
        </div>
        {!readOnly && activeTab === 'rules' && (
          <div className="flex gap-3">
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleImport} 
             />
             <button
               onClick={() => fileInputRef.current?.click()}
               className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm transition-colors text-sm font-medium"
               title="导入规则配置"
             >
               <Upload className="w-4 h-4" /> 导入
             </button>
             <button
               onClick={handleExport}
               className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm transition-colors text-sm font-medium"
               title="导出规则配置"
             >
               <Download className="w-4 h-4" /> 导出
             </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button 
             onClick={() => setActiveTab('types')}
             className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'types' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <ListChecks className="w-4 h-4" /> 报销申请类型
          </button>
          <button 
             onClick={() => setActiveTab('rules')}
             className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <Settings2 className="w-4 h-4" /> 自动审核规则
          </button>
      </div>

      {activeTab === 'rules' && (
      <>
        <div className="flex justify-end mb-4">
             {!readOnly && !isAddingRule && (
                 <button
                   onClick={() => setIsAddingRule(true)}
                   className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
                 >
                   <Plus className="w-4 h-4" /> 添加规则
                 </button>
             )}
        </div>

        {isAddingRule && !readOnly && (
            <div className="mb-8 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
            {!editingRuleId && (
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2 uppercase tracking-wider mb-3">
                    <Sparkles className="w-4 h-4" /> 常用预设 (一键添加)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {PRESET_RULES.map((preset, idx) => (
                        <button 
                            key={idx}
                            onClick={() => handleAddPreset(preset)}
                            className="flex items-start gap-3 p-3 bg-white border border-blue-100 hover:border-blue-300 hover:shadow-md rounded-lg transition-all text-left group"
                        >
                            <div className="mt-0.5 p-1.5 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                                {getIcon(preset.type!)}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{preset.name}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{preset.description}</p>
                                {preset.receiptType && preset.receiptType !== 'ALL' && (
                                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 mt-1 inline-block">仅限 {preset.receiptType}</span>
                                )}
                            </div>
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto mt-0.5" />
                        </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-6">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider mb-4">
                    <Zap className="w-4 h-4" /> {editingRuleId ? '编辑规则' : '自定义规则'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">规则名称</label>
                    <input
                    type="text"
                    value={newRule.name}
                    onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="例如：午餐限额"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">规则类型</label>
                    <select
                    value={newRule.type}
                    onChange={e => setNewRule({ ...newRule, type: e.target.value as RuleType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                    <option value={RuleType.MAX_AMOUNT}>金额上限</option>
                    <option value={RuleType.FORBIDDEN_CATEGORY}>违禁类别</option>
                    <option value={RuleType.WEEKEND_BAN}>周末限制</option>
                    <option value={RuleType.REQUIRED_FIELD}>必填字段</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">阈值 / 内容</label>
                    <input
                    type="text"
                    value={newRule.value}
                    onChange={e => setNewRule({ ...newRule, value: e.target.value })}
                    placeholder={newRule.type === RuleType.MAX_AMOUNT ? "1000" : "烟酒"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">适用 OCR 单据类型</label>
                    <select
                    value={newRule.receiptType || 'ALL'}
                    onChange={e => setNewRule({ ...newRule, receiptType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                    <option value="ALL">所有 OCR 类型</option>
                    {RECEIPT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                    <input
                    type="text"
                    value={newRule.description}
                    onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="给用户的解释说明"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-4 flex items-start gap-2">
                     <Settings2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                     <p>提示：规则创建后，请在“报销申请类型”标签页中将其关联到特定的报销类型。</p>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-50">
                <button onClick={handleCancelRuleEdit} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2">
                    <X className="w-4 h-4" /> 取消
                </button>
                <button onClick={handleSaveRule} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2">
                    <Save className="w-4 h-4" /> {editingRuleId ? '保存修改' : '保存规则'}
                </button>
                </div>
            </div>
            </div>
        )}

        <div className="space-y-3">
            {rules.map((rule) => {
            const isHighlighted = rule.id === highlightedRuleId;
            const isSpecificOcrType = rule.receiptType && rule.receiptType !== 'ALL';
            
            // Count usage
            const usedInCount = requestTypes.filter(rt => rt.linkedRuleIds?.includes(rule.id)).length;

            return (
                <div 
                key={rule.id} 
                ref={isHighlighted ? (el) => {
                    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                } : null}
                className={`flex items-center justify-between p-4 bg-white border rounded-xl transition-all ${
                    isHighlighted 
                        ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg bg-blue-50/50' 
                        : (rule.enabled ? 'border-slate-200 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-70')
                }`}
                >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-slate-100' : 'bg-slate-200'}`}>
                    {getIcon(rule.type)}
                    </div>
                    <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-semibold ${rule.enabled ? 'text-slate-900' : 'text-slate-500'}`}>{rule.name}</h4>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">{getRuleTypeLabel(rule.type)}</span>
                        
                        {isSpecificOcrType ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600 font-medium border border-indigo-100 flex items-center gap-1">
                                <Filter className="w-3 h-3" />
                                仅限 OCR: {rule.receiptType}
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-400 font-medium border border-slate-200 flex items-center gap-1">
                                <Filter className="w-3 h-3" />
                                任意单据
                            </span>
                        )}
                        
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100 flex items-center gap-1">
                             <Briefcase className="w-3 h-3" />
                             应用: {usedInCount} 个类型
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {rule.description} — <span className="font-mono font-medium text-slate-700">{rule.value}</span>
                    </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <label 
                    className={`relative inline-flex items-center mr-2 ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    title={readOnly ? '您没有权限修改此规则' : ''}
                    >
                    <input 
                        type="checkbox" 
                        checked={rule.enabled} 
                        onChange={() => handleToggle(rule.id)} 
                        disabled={readOnly}
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                    </label>
                    
                    {!readOnly && (
                        <>
                        <button 
                            onClick={() => handleEditRule(rule)} 
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑规则"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => handleDeleteRule(rule.id)} 
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除规则"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                        </>
                    )}
                </div>
                </div>
            );
            })}
        </div>
      </>
      )}

      {activeTab === 'types' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 mb-4">报销申请类别管理</h3>
                  <div className="flex gap-3">
                      <div className="flex-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                             <Briefcase className="w-4 h-4" />
                          </div>
                          <input 
                              type="text" 
                              value={newRequestType}
                              onChange={(e) => setNewRequestType(e.target.value)}
                              placeholder="输入新类别名称，例如：季度团建"
                              disabled={readOnly}
                              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              onKeyDown={(e) => e.key === 'Enter' && handleAddRequestType()}
                          />
                      </div>
                      <button 
                        onClick={handleAddRequestType}
                        disabled={readOnly || !newRequestType.trim()}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                          <Plus className="w-4 h-4" /> 添加
                      </button>
                  </div>
              </div>
              <div className="divide-y divide-slate-100">
                  {requestTypes.map(rt => (
                      <div key={rt.id} className="p-4 hover:bg-slate-50 transition-colors">
                          {editingTypeId === rt.id ? (
                                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                                     <div className="flex items-center gap-3 mb-4">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></div>
                                        <input 
                                            type="text"
                                            value={editTypeName}
                                            onChange={(e) => setEditTypeName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold"
                                            autoFocus
                                        />
                                     </div>
                                     
                                     <div className="mb-4">
                                         <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                <ListChecks className="w-3 h-3" /> 关联审核规则 ({editTypeRules.length})
                                            </h4>
                                         </div>
                                         
                                         {/* Filter Input */}
                                         <div className="mb-2 relative">
                                            <input 
                                                type="text"
                                                value={ruleSearchTerm}
                                                onChange={(e) => setRuleSearchTerm(e.target.value)}
                                                placeholder="搜索规则..."
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-300 outline-none"
                                            />
                                            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                                            <button 
                                                onClick={toggleAllVisibleRules} 
                                                className="absolute right-2 top-1.5 text-xs text-blue-600 hover:underline"
                                            >
                                                {visibleRules.every(r => editTypeRules.includes(r.id)) ? '取消全选' : '全选当前'}
                                            </button>
                                         </div>

                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-slate-100 rounded-lg bg-slate-50/30">
                                             {visibleRules.map(rule => (
                                                 <label key={rule.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${editTypeRules.includes(rule.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                     <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${editTypeRules.includes(rule.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                         {editTypeRules.includes(rule.id) && <CheckCheck className="w-3 h-3 text-white" />}
                                                     </div>
                                                     <input 
                                                        type="checkbox" 
                                                        className="hidden" 
                                                        checked={editTypeRules.includes(rule.id)}
                                                        onChange={() => toggleTypeRule(rule.id)}
                                                     />
                                                     <div className="flex-1 min-w-0">
                                                         <div className={`text-sm font-medium truncate ${editTypeRules.includes(rule.id) ? 'text-blue-700' : 'text-slate-700'}`}>{rule.name}</div>
                                                         <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                                                            {rule.receiptType !== 'ALL' && <span className="bg-slate-100 px-1 rounded text-[10px]">{rule.receiptType}</span>}
                                                            {rule.description}
                                                         </div>
                                                     </div>
                                                 </label>
                                             ))}
                                             {visibleRules.length === 0 && (
                                                <div className="col-span-full p-4 text-center text-xs text-slate-400">未找到匹配的规则</div>
                                             )}
                                         </div>
                                     </div>

                                     <div className="flex justify-end gap-2">
                                          <button onClick={() => setEditingTypeId(null)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm">取消</button>
                                          <button onClick={() => saveEditType(rt.id)} className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded text-sm font-medium flex items-center gap-1">
                                              <Save className="w-3 h-3" /> 保存
                                          </button>
                                     </div>
                                </div>
                          ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700">{rt.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">ID: {rt.id.split('_')[1] || rt.id}</span>
                                                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-blue-100">
                                                    <ListChecks className="w-3 h-3" />
                                                    已启用 {rt.linkedRuleIds?.length || 0} 条规则
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!readOnly && (
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => startEditType(rt)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="配置名称与规则"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteRequestType(rt.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                title="删除此类型"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                          )}
                      </div>
                  ))}
                  {requestTypes.length === 0 && (
                      <div className="p-8 text-center text-slate-400 italic">暂无自定义类型</div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default RuleConfig;
