
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Sidebar from './components/Sidebar';
import RuleConfig from './components/RuleConfig';
import UploadReceipt from './components/UploadReceipt';
import ReimbursementList from './components/ReimbursementList';
import DatabaseManager from './components/DatabaseManager';
import { AuditRule, ReimbursementRequest, RequestStatus, RuleType, User, UserRole, RequestHistoryEntry, RequestType } from './types';
import { CheckCircle, AlertTriangle, DollarSign, FileText, Users, Loader2 } from 'lucide-react';
import { db } from './services/db';

// Mock Users for Demo
const MOCK_USERS: User[] = [
  { id: 'u1', name: '张三', role: UserRole.EMPLOYEE, avatar: 'ZS' },
  { id: 'u2', name: '李四 (财务)', role: UserRole.AUDITOR, avatar: 'LS' },
  { id: 'u3', name: '王五 (管理员)', role: UserRole.ADMIN, avatar: 'WW' },
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State loaded from DB
  const [rules, setRules] = useState<AuditRule[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requests, setRequests] = useState<ReimbursementRequest[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);
  
  // State to handle linking from Request Detail to Rule Config
  const [highlightedRuleId, setHighlightedRuleId] = useState<string | null>(null);

  // Initialize Database and Load Data
  useEffect(() => {
    const initData = async () => {
        try {
            await db.init();
            const loadedRules = await db.getRules();
            const loadedRequests = await db.getRequests();
            const loadedRequestTypes = await db.getRequestTypes();
            
            setRules(loadedRules);
            setRequests(loadedRequests);
            setRequestTypes(loadedRequestTypes);
            setIsDbReady(true);
        } catch (e) {
            console.error("Failed to load data from DB", e);
        }
    };
    initData();
  }, []);

  // Sync Rules to DB when changed (only if DB is ready)
  useEffect(() => {
    if (isDbReady && rules.length > 0) {
       db.saveRules(rules).catch(err => console.error("Auto-save rules failed", err));
    }
  }, [rules, isDbReady]);

  // Sync Request Types to DB when changed
  useEffect(() => {
    if (isDbReady && requestTypes.length > 0) {
        db.saveRequestTypes(requestTypes).catch(err => console.error("Auto-save request types failed", err));
    }
  }, [requestTypes, isDbReady]);

  // Reset tab when user changes
  const handleUserSwitch = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleRequestCreated = async (req: ReimbursementRequest) => {
    // Optimistic update
    const newRequests = [req, ...requests];
    setRequests(newRequests);
    
    // Async DB save
    await db.addRequest(req);
    
    setActiveTab('requests');
  };

  const handleViewRule = (ruleId: string) => {
    setHighlightedRuleId(ruleId);
    setActiveTab('rules');
  };

  const handleDbReset = async () => {
      setIsDbReady(false);
      await db.resetDB(); // This will re-seed defaults
      const loadedRules = await db.getRules();
      const loadedRequests = await db.getRequests();
      const loadedTypes = await db.getRequestTypes();
      
      setRules(loadedRules);
      setRequests(loadedRequests);
      setRequestTypes(loadedTypes);
      setIsDbReady(true);
      setActiveTab('dashboard');
  };

  const handleStatusUpdate = async (id: string, newStatus: RequestStatus) => {
    // Find request and create updated version
    const req = requests.find(r => r.id === id);
    if (!req) return;

    let actionText = "更新状态";
    if (newStatus === RequestStatus.APPROVED) actionText = "批准申请";
    else if (newStatus === RequestStatus.REJECTED) actionText = "拒绝申请";
    else if (newStatus === RequestStatus.WITHDRAWN) actionText = "撤回申请";

    // Auto comment logic
    let note = '';
    if ((currentUser.role === UserRole.AUDITOR || currentUser.role === UserRole.ADMIN) && 
        req.auditResult.score > 50 && 
        (newStatus === RequestStatus.APPROVED || newStatus === RequestStatus.REJECTED)) {
        note = "高风险申请已人工复核处理";
    }

    const historyEntry: RequestHistoryEntry = {
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      action: actionText,
      status: newStatus,
      note: note || undefined
    };

    const updatedReq = { 
      ...req, 
      status: newStatus,
      processedBy: currentUser.name,
      processedAt: new Date().toISOString(),
      history: [...(req.history || []), historyEntry]
    };

    if (note) {
        updatedReq.comments = req.comments ? `${req.comments}\n${note}` : note;
    }

    // Update DB
    await db.updateRequest(updatedReq);

    // Update UI
    setRequests(prev => prev.map(r => r.id === id ? updatedReq : r));
  };

  // Filter requests based on role
  const visibleRequests = useMemo(() => {
    if (currentUser.role === UserRole.EMPLOYEE) {
      return requests.filter(r => r.employeeId === currentUser.id);
    }
    // Auditors and Admins see all
    return requests;
  }, [requests, currentUser]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = visibleRequests.length;
    const pending = visibleRequests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.NEEDS_REVIEW).length;
    const approved = visibleRequests.filter(r => r.status === RequestStatus.APPROVED).length;
    const totalAmount = visibleRequests.reduce((acc, curr) => acc + curr.data.totalAmount, 0);
    
    return { total, pending, approved, totalAmount };
  }, [visibleRequests]);

  // Chart Data
  const chartData = useMemo(() => {
     const data = visibleRequests.map(r => ({
        name: r.data.category,
        amount: r.data.totalAmount
     }));
     const result: Record<string, number> = {};
     data.forEach(d => {
         result[d.name] = (result[d.name] || 0) + d.amount;
     });
     return Object.keys(result).map(key => ({ name: key, amount: result[key] }));
  }, [visibleRequests]);

  if (!isDbReady) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 flex-col gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-800">正在连接数据库...</h3>
                  <p className="text-sm">Initializing Local SQL Engine</p>
              </div>
          </div>
      );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
             <div className="mb-8 flex justify-between items-end">
               <div>
                 <h2 className="text-3xl font-bold text-slate-900">
                    {currentUser.role === UserRole.EMPLOYEE ? '我的仪表盘' : '财务概览'}
                 </h2>
                 <p className="text-slate-500 mt-1">
                    欢迎回来, {currentUser.name}。
                    {currentUser.role === UserRole.AUDITOR && ' 您有待审核的申请。'}
                 </p>
               </div>
               <div className="flex gap-2">
                  {MOCK_USERS.map(u => (
                      <button 
                        key={u.id}
                        onClick={() => handleUserSwitch(u)}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${currentUser.id === u.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                        模拟: {u.role}
                      </button>
                  ))}
               </div>
             </div>

             {/* Stats Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">总支出 (可见)</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">¥{stats.totalAmount.toFixed(2)}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">
                            {currentUser.role === UserRole.AUDITOR ? '待审核' : '审核中'}
                        </p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.pending}</h3>
                    </div>
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">已批准</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.approved}</h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">总申请数</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                        <FileText className="w-5 h-5" />
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">支出类别分布</h3>
                    <div className="h-64 w-full">
                        {chartData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={chartData}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                               <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                               <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                               <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                 {chartData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"][index % 4]} />
                                 ))}
                               </Bar>
                             </BarChart>
                           </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                暂无数据
                            </div>
                        )}
                    </div>
                </div>

                {/* Role Info / Active Rules */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">当前身份: {currentUser.role === UserRole.EMPLOYEE ? '普通员工' : currentUser.role === UserRole.AUDITOR ? '财务审核' : '系统管理员'}</h3>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-6">
                         <p className="text-sm text-slate-600">
                            {currentUser.role === UserRole.EMPLOYEE && "您可以上传收据并查看自己的报销进度。"}
                            {currentUser.role === UserRole.AUDITOR && "您可以查看所有员工的申请，并进行批准或驳回操作。"}
                            {currentUser.role === UserRole.ADMIN && "您可以配置系统的审核规则，管理风险控制策略，或管理后台数据库。"}
                         </p>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-800 text-sm">生效规则预览</h4>
                        {currentUser.role === UserRole.ADMIN && (
                            <button onClick={() => setActiveTab('rules')} className="text-xs text-blue-600 hover:underline">配置</button>
                        )}
                        {currentUser.role === UserRole.AUDITOR && (
                            <button onClick={() => setActiveTab('rules')} className="text-xs text-blue-600 hover:underline">查看全部</button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {rules.filter(r => r.enabled).slice(0, 3).map(rule => (
                            <div key={rule.id} className="flex items-center gap-2 text-sm text-slate-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                <span className="truncate">{rule.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        );
      case 'upload':
         // Only Employees (and maybe Admins/Auditors if they want to test) can upload
        return <UploadReceipt currentUser={currentUser} rules={rules} onRequestCreated={handleRequestCreated} availableRequestTypes={requestTypes} />;
      case 'requests':
        return <ReimbursementList 
            requests={visibleRequests} 
            rules={rules}
            requestTypes={requestTypes} 
            currentUser={currentUser}
            onStatusUpdate={handleStatusUpdate}
            onViewRule={handleViewRule}
        />;
      case 'rules':
        // Auditor can see, but Admin can edit
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.AUDITOR) return <div className="p-8 text-center text-slate-500">无权访问此页面</div>;
        return <RuleConfig 
          rules={rules} 
          setRules={setRules} 
          requestTypes={requestTypes}
          setRequestTypes={setRequestTypes}
          readOnly={currentUser.role !== UserRole.ADMIN} 
          highlightedRuleId={highlightedRuleId}
        />;
      case 'database':
        if (currentUser.role !== UserRole.ADMIN) return <div className="p-8 text-center text-slate-500">权限不足</div>;
        return <DatabaseManager requests={requests} rules={rules} onReset={handleDbReset} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
        availableUsers={MOCK_USERS}
        onSwitchUser={handleUserSwitch}
      />
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
