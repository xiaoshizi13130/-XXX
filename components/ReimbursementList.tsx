
import React, { useState } from 'react';
import { ReimbursementRequest, RequestStatus, AuditRule, User, UserRole, RequestType } from '../types';
import { CheckCircle, XCircle, AlertTriangle, Clock, ChevronRight, DollarSign, Calendar, User as UserIcon, Ban, Undo2, X, ZoomIn, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import RequestDetail from './RequestDetail';

interface ReimbursementListProps {
  requests: ReimbursementRequest[];
  rules: AuditRule[];
  requestTypes: RequestType[];
  currentUser: User;
  onStatusUpdate: (id: string, status: RequestStatus) => void;
  onViewRule?: (ruleId: string) => void;
}

const ReimbursementList: React.FC<ReimbursementListProps> = ({ requests, rules, requestTypes, currentUser, onStatusUpdate, onViewRule }) => {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  
  // View Mode: 'audit' (All requests not mine) | 'my' (My requests)
  // Only applicable for ADMIN/AUDITOR
  const [viewMode, setViewMode] = useState<'audit' | 'my'>('audit');
  
  // State for confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: RequestStatus } | null>(null);

  const isPrivileged = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.AUDITOR;

  // Filter requests based on role and view mode
  const displayedRequests = requests.filter(req => {
      if (!isPrivileged) {
          // Regular employees only see their own
          return req.employeeId === currentUser.id;
      }
      
      if (viewMode === 'my') {
          return req.employeeId === currentUser.id;
      } else {
          // Audit mode: Show requests from OTHERS
          return req.employeeId !== currentUser.id;
      }
  });

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.APPROVED:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3"/> 已批准</span>;
      case RequestStatus.REJECTED:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3"/> 已拒绝</span>;
      case RequestStatus.NEEDS_REVIEW:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3"/> 待复核</span>;
      case RequestStatus.WITHDRAWN:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600"><Ban className="w-3 h-3"/> 已撤回</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Clock className="w-3 h-3"/> 处理中</span>;
    }
  };

  const selectedRequest = requests.find(r => r.id === selectedRequestId);

  // If a request is selected, show the detail view instead of the list
  if (selectedRequest) {
      return (
          <RequestDetail 
            request={selectedRequest}
            rules={rules}
            requestTypes={requestTypes}
            currentUser={currentUser}
            onBack={() => setSelectedRequestId(null)}
            onStatusUpdate={(id, status) => {
                onStatusUpdate(id, status);
                // Keep detail view open to show updated status, or close:
                // setSelectedRequestId(null); 
            }}
            onViewRule={onViewRule}
          />
      );
  }

  // Logic to determine if current user can approve a specific request
  const canApproveRequest = (req: ReimbursementRequest) => {
      const isNotOwnRequest = req.employeeId !== currentUser.id;
      return isPrivileged && isNotOwnRequest;
  };

  // Handle initiate action (opens modal)
  const handleInitiateAction = (e: React.MouseEvent, id: string, status: RequestStatus) => {
      e.stopPropagation(); // Prevent row click
      setConfirmAction({ id, status });
  };

  // Handle confirm action (executes update)
  const handleConfirmAction = () => {
      if (confirmAction) {
          onStatusUpdate(confirmAction.id, confirmAction.status);
          setConfirmAction(null);
      }
  };

  const handleCancelAction = () => {
      setConfirmAction(null);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">
                {isPrivileged && viewMode === 'audit' ? '待审核列表' : '我的申请记录'}
            </h2>
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-full border border-slate-200">
                 <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-100 overflow-hidden">
                    {currentUser.avatar ? currentUser.avatar : <UserIcon className="w-3 h-3" />}
                 </div>
                 <span className="text-xs font-medium text-slate-600">{currentUser.name}</span>
            </div>
          </div>
          <p className="text-slate-500">
            {isPrivileged && viewMode === 'audit' 
                ? '集中处理员工提交的报销申请。' 
                : '查看您个人提交的所有报销进度。'}
          </p>
        </div>
        
        {isPrivileged && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('audit')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ShieldCheck className="w-4 h-4" /> 待我审核
                </button>
                <button 
                    onClick={() => setViewMode('my')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <UserCheck className="w-4 h-4" /> 我的申请
                </button>
            </div>
        )}

        {!isPrivileged && (
             <div className="text-sm text-slate-500">
                共计: {displayedRequests.length} 个申请
            </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">申请人 / 商家</th>
                <th className="px-6 py-4">申请类型</th>
                <th className="px-6 py-4">日期</th>
                <th className="px-6 py-4">金额</th>
                <th className="px-6 py-4">审核状态</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRequests.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        {viewMode === 'audit' ? '太好了，所有审核工作已完成！' : '暂无申请记录。'}
                    </td>
                </tr>
              ) : displayedRequests.map((req) => {
                const isPending = req.status === RequestStatus.PENDING || req.status === RequestStatus.NEEDS_REVIEW;
                const isPdf = req.receiptImage?.startsWith('data:application/pdf') || req.receiptImage?.includes('base64,JVBER');
                
                return (
                <tr 
                    key={req.id} 
                    onClick={() => setSelectedRequestId(req.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 shadow-sm group/thumb">
                          {isPdf ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                                  <FileText className="w-5 h-5" />
                                  <span className="text-[8px] font-bold uppercase mt-0.5 text-slate-500">PDF</span>
                              </div>
                          ) : (
                              <img src={req.receiptImage} alt="" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200">
                              <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
                          </div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 line-clamp-1 max-w-[180px]" title={req.data.merchantName}>{req.data.merchantName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <UserIcon className="w-3 h-3" /> {req.employeeName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {req.requestType || '日常报销'}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {req.data.date}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {req.data.currency} {req.data.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(req.status)}
                    {req.auditResult.score > 50 && req.status === RequestStatus.PENDING && (
                        <div className="mt-1 text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> 高风险 ({req.auditResult.score})
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {canApproveRequest(req) && isPending ? (
                            <>
                                <button 
                                    onClick={(e) => handleInitiateAction(e, req.id, RequestStatus.REJECTED)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="拒绝"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={(e) => handleInitiateAction(e, req.id, RequestStatus.APPROVED)}
                                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                    title="批准"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                </button>
                            </>
                        ) : (
                             <button className="text-slate-400 hover:text-blue-600 transition-colors">
                                <ChevronRight className="w-5 h-5" />
                             </button>
                        )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReimbursementList;
