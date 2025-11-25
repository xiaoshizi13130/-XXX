import React, { useState, useEffect } from 'react';
import { Database, Trash2, RefreshCcw, Save, AlertTriangle, HardDrive, Download, Terminal, Play } from 'lucide-react';
import { db } from '../services/db';
import { ReimbursementRequest, AuditRule } from '../types';

interface DatabaseManagerProps {
  requests: ReimbursementRequest[];
  rules: AuditRule[];
  onReset: () => void;
}

const DatabaseManager: React.FC<DatabaseManagerProps> = ({ requests, rules, onReset }) => {
  const [usage, setUsage] = useState<string>('0');
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM requests');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  
  useEffect(() => {
      setUsage(db.getUsage());
  }, [requests, rules]);

  const handleClearData = async () => {
      if (window.confirm("确定要清空所有单据记录吗？此操作无法撤销！\n(规则配置将被保留)")) {
          await onReset();
          alert("数据库已重置为初始状态。");
      }
  };

  const handleExport = () => {
      const data = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          rules,
          requests
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const executeSql = async () => {
      setSqlError(null);
      setSqlResult(null);
      try {
          // 简单的安全检查（在实际后端中会更严格）
          const res = await db.executeSQL(sqlQuery);
          setSqlResult(Array.isArray(res) ? res : [res]);
      } catch (e) {
          setSqlError(e instanceof Error ? e.message : 'SQL 执行错误');
      }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
           <Database className="w-8 h-8 text-slate-700" />
           数据库管理
        </h2>
        <p className="text-slate-500 mt-2">管理本地 SQL 数据库 (AlaSQL powered)。</p>
      </div>

      {/* SQL Console */}
      <div className="mb-8 bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
          <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
                  <Terminal className="w-4 h-4" />
                  <span>SQL 控制台</span>
              </div>
              <button 
                onClick={executeSql}
                className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
              >
                  <Play className="w-3 h-3" /> 运行
              </button>
          </div>
          <div className="p-4">
              <textarea 
                  value={sqlQuery} 
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-24 bg-transparent text-green-400 font-mono text-sm outline-none resize-none placeholder-slate-600"
                  placeholder="输入 SQL 查询语句..."
              />
          </div>
          {sqlError && (
              <div className="px-4 py-2 bg-red-900/50 text-red-300 text-xs font-mono border-t border-red-800">
                  Error: {sqlError}
              </div>
          )}
          {sqlResult && (
              <div className="border-t border-slate-700 max-h-60 overflow-auto">
                  {sqlResult.length === 0 ? (
                      <div className="p-4 text-slate-500 text-xs italic">查询成功，无结果返回。</div>
                  ) : (
                      <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-800 sticky top-0">
                              <tr>
                                  {Object.keys(sqlResult[0]).map(key => (
                                      <th key={key} className="px-4 py-2 font-mono border-r border-slate-700 last:border-0">{key}</th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                              {sqlResult.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-800">
                                      {Object.values(row).map((val: any, j) => (
                                          <td key={j} className="px-4 py-2 border-r border-slate-700 last:border-0 truncate max-w-[200px]" title={String(val)}>
                                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                          </td>
                                      ))}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <HardDrive className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-700">存储占用</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{usage} <span className="text-sm text-slate-500 font-normal">KB</span></p>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(parseFloat(usage) / 5000 * 100, 100)}%` }}></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Local Storage Backend</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Save className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-700">记录统计</h3>
              </div>
              <div className="space-y-2 mt-2">
                  <div className="flex justify-between text-sm">
                      <span className="text-slate-500">报销单据</span>
                      <span className="font-bold text-slate-900">{requests.length} 条</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-slate-500">审核规则</span>
                      <span className="font-bold text-slate-900">{rules.length} 条</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 font-bold text-slate-700">
              <RefreshCcw className="w-4 h-4" /> 操作面板
          </div>
          <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 text-green-600 rounded-full">
                          <Download className="w-6 h-6" />
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800">导出数据备份</h4>
                          <p className="text-sm text-slate-500">将所有规则和单据导出为 JSON 文件。</p>
                      </div>
                  </div>
                  <button 
                    onClick={handleExport}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
                  >
                      导出数据
                  </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-red-100 bg-red-50/30 rounded-lg">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-red-100 text-red-600 rounded-full">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                          <h4 className="font-bold text-red-900">恢复出厂设置</h4>
                          <p className="text-sm text-red-700/70">清除所有本地数据，恢复默认规则。此操作<span className="font-bold">无法撤销</span>。</p>
                      </div>
                  </div>
                  <button 
                    onClick={handleClearData}
                    className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                  >
                      清除并重置
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default DatabaseManager;