
import React, { useState, useRef } from 'react';
import { ReimbursementRequest, AuditRule, RequestStatus, User, UserRole, RuleType, RequestType } from '../types';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle, Tag, Ban, Undo2, ExternalLink, ZoomIn, ZoomOut, RotateCcw, History, RefreshCw, Receipt, Plane, Car, FileSignature, Map, HelpCircle, Train, Brain, ShieldAlert, Briefcase, Link2 } from 'lucide-react';

interface RequestDetailProps {
  request: ReimbursementRequest;
  rules: AuditRule[];
  requestTypes: RequestType[];
  currentUser: User;
  onBack: () => void;
  onStatusUpdate: (id: string, status: RequestStatus) => void;
  onViewRule?: (ruleId: string) => void;
}

const RequestDetail: React.FC<RequestDetailProps> = ({ request, rules, requestTypes, currentUser, onBack, onStatusUpdate, onViewRule }) => {
  const { data, auditResult, status } = request;
  const isPdf = request.receiptImage.startsWith('data:application/pdf') || request.receiptImage.includes('base64,JVBER'); 

  const isAuditorOrAdmin = currentUser.role === UserRole.AUDITOR || currentUser.role === UserRole.ADMIN;
  // Critical: Cannot approve own requests
  const canApprove = isAuditorOrAdmin && request.employeeId !== currentUser.id;
  const isPending = status === RequestStatus.PENDING || status === RequestStatus.NEEDS_REVIEW;
  const isMyRequest = request.employeeId === currentUser.id;

  // Image Viewer State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);
  
  const [imgError, setImgError] = useState(false);
  const [imgKey, setImgKey] = useState(0); // Key to force re-render on reload

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.APPROVED:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800"><CheckCircle className="w-4 h-4"/> 已批准</span>;
      case RequestStatus.REJECTED:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800"><XCircle className="w-4 h-4"/> 已拒绝</span>;
      case RequestStatus.NEEDS_REVIEW:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800"><AlertTriangle className="w-4 h-4"/> 待复核</span>;
      case RequestStatus.WITHDRAWN:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-slate-200 text-slate-600"><Ban className="w-4 h-4"/> 已撤回</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">处理中</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    if (!type) return <HelpCircle className="w-4 h-4" />;
    if (type.includes('发票')) return <FileText className="w-4 h-4" />;
    if (type.includes('收据')) return <Receipt className="w-4 h-4" />;
    if (type.includes('火车')) return <Train className="w-4 h-4" />;
    if (type.includes('飞机')) return <Plane className="w-4 h-4" />;
    if (type.includes('出租') || type.includes('车')) return <Car className="w-4 h-4" />;
    if (type.includes('合同')) return <FileSignature className="w-4 h-4" />;
    if (type.includes('行程')) return <Map className="w-4 h-4" />;
    return <HelpCircle className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'bg-green-500';
    if (score < 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceInfo = (confidence: number = 0) => {
      const percentage = Math.round(confidence * 100);
      if (confidence >= 0.8) {
          return { label: '识别准确', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle };
      } else if (confidence >= 0.5) {
          return { label: '可信度一般', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle };
      } else {
          return { label: '识别存疑', color: 'text-red-600', bg: 'bg-red-50', icon: ShieldAlert };
      }
  };

  const handleOpenOriginal = () => {
      const win = window.open();
      if (win) {
          const content = isPdf 
            ? `<iframe src="${request.receiptImage}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
            : `<img src="${request.receiptImage}" style="max-width:100%; margin: 0 auto; display: block;">`;
          
          win.document.write(`
            <html>
              <head><title>原始凭证 - ${request.id}</title></head>
              <body style="margin:0; background-color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
                ${content}
              </body>
            </html>
          `);
      }
  };

  const handleReloadImage = () => {
      setImgError(false);
      setImgKey(prev => prev + 1);
  };

  // --- Helper for field highlighting based on historical audit result ---
  const getFieldAlert = (field: 'merchantName' | 'totalAmount' | 'date' | 'category') => {
      const triggeredIds = request.auditResult.triggeredRules;
      const relevantRuleId = triggeredIds.find(id => {
          const rule = rules.find(r => r.id === id);
          if (!rule) return false;
          if (field === 'totalAmount' && rule.type === RuleType.MAX_AMOUNT) return true;
          if (field === 'category' && rule.type === RuleType.FORBIDDEN_CATEGORY) return true;
          if (field === 'date' && rule.type === RuleType.WEEKEND_BAN) return true;
          if (field === 'merchantName' && rule.type === RuleType.REQUIRED_FIELD) return true;
          return false;
      });
      
      if (relevantRuleId) {
           const rule = rules.find(r => r.id === relevantRuleId);
           return rule?.name || '规则警告';
      }
      return null;
  };

  // --- Image Zoom/Pan Handlers ---
  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5));
  const handleZoomOut = () => {
    setScale(s => {
      const newScale = Math.max(s - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 }); // Reset position if zoomed out completely
      return newScale;
    });
  };
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.preventDefault(); // Prevent image dragging behavior
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const onMouseUp = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return; // Let browser handle default pinch zoom if needed
    // Simple wheel zoom
    if (e.deltaY < 0) {
        handleZoomIn();
    } else {
        handleZoomOut();
    }
  };

  const getHistoryIcon = (status: RequestStatus, action: string) => {
      if (action.includes("提交")) return <FileText className="w-4 h-4 text-blue-600" />;
      if (status === RequestStatus.APPROVED) return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      if (status === RequestStatus.REJECTED) return <XCircle className="w-4 h-4 text-red-600" />;
      if (status === RequestStatus.WITHDRAWN) return <Undo2 className="w-4 h-4 text-slate-500" />;
      return <History className="w-4 h-4 text-amber-600" />;
  }

  // Field Alerts
  const merchantAlert = getFieldAlert('merchantName');
  const amountAlert = getFieldAlert('totalAmount');
  const dateAlert = getFieldAlert('date');
  const categoryAlert = getFieldAlert('category');
  
  const confidenceInfo = getConfidenceInfo(data.confidence);
  const ConfidenceIcon = confidenceInfo.icon;

  // Determine which rule is linked to the current request type
  const currentRequestTypeObj = requestTypes.find(rt => rt.name === request.requestType);
  const checkRuleLinked = (ruleId: string) => {
      if (!currentRequestTypeObj) return false;
      return currentRequestTypeObj.linkedRuleIds?.includes(ruleId);
  }

  return (
    <div className="animate-in slide-in-from-right-4 fade-in duration-300 h-full flex flex-col">
      {/* Header / Navigation */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">报销单详情 <span className="text-slate-400 font-normal text-base">#{request.id.slice(-6)}</span></h2>
                <div className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {request.requestType || '日常报销'}
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
               <span>申请日期: {new Date(request.submissionDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
            {getStatusBadge(status)}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
         {/* Left Column: Image Viewer */}
         <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl flex flex-col relative group border border-slate-700 h-[calc(100vh-180px)] lg:h-auto">
             {/* Toolbar */}
             <div className="absolute top-4 right-4 z-10 flex gap-2 bg-slate-800/80 backdrop-blur p-1.5 rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isPdf && (
                    <>
                        <button onClick={handleZoomOut} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4"/></button>
                        <span className="text-xs text-slate-400 py-1.5 min-w-[30px] text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={handleZoomIn} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4"/></button>
                        <div className="w-px bg-slate-600 mx-1"></div>
                        <button onClick={handleResetZoom} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="重置"><RotateCcw className="w-4 h-4"/></button>
                    </>
                )}
                <button onClick={handleOpenOriginal} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="新窗口打开"><ExternalLink className="w-4 h-4"/></button>
             </div>

             {/* Viewport */}
             <div 
                ref={imgContainerRef}
                className={`flex-1 overflow-hidden relative flex items-center justify-center bg-slate-900 select-none ${!isPdf ? 'cursor-grab' : 'cursor-auto'}`}
                onMouseDown={!isPdf ? onMouseDown : undefined}
                onMouseMove={!isPdf ? onMouseMove : undefined}
                onMouseUp={!isPdf ? onMouseUp : undefined}
                onMouseLeave={!isPdf ? onMouseLeave : undefined}
                onWheel={!isPdf ? onWheel : undefined}
                style={{ cursor: !isPdf && scale > 1 ? 'grab' : undefined }}
             >
                 {isPdf ? (
                      <iframe 
                          src={request.receiptImage} 
                          className="w-full h-full" 
                          frameBorder="0"
                          title="PDF Preview"
                      />
                 ) : imgError ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <AlertTriangle className="w-12 h-12 mb-3 text-amber-500/50" />
                        <p className="text-sm font-medium mb-4">图片加载失败</p>
                        <button 
                            onClick={handleReloadImage}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors shadow-lg"
                        >
                            <RefreshCw className="w-4 h-4" />
                            重新加载
                        </button>
                    </div>
                 ) : (
                     <img 
                        key={imgKey}
                        src={request.receiptImage} 
                        alt="Receipt"
                        className="max-w-full max-h-full object-contain transition-transform duration-100 will-change-transform"
                        style={{ 
                            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`
                        }}
                        onError={() => setImgError(true)}
                        draggable={false}
                     />
                 )}
             </div>
             
             {/* Hint */}
             {!isPdf && !imgError && (
                 <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                     <span className="px-3 py-1 bg-black/50 backdrop-blur text-white text-xs rounded-full">
                        {scale > 1 ? '拖拽移动视图' : '滚动缩放'}
                     </span>
                 </div>
             )}
         </div>

         {/* Right Column: Details & Actions */}
         <div className="flex flex-col h-[calc(100vh-180px)] lg:h-auto overflow-hidden">
             <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6">
                 
                 {/* Audit Score Card */}
                 <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                     <div className="flex items-center justify-between mb-4">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <AlertTriangle className="w-5 h-5 text-slate-400" />
                             智能审核报告
                         </h3>
                         <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-500 font-medium uppercase">风险评分</span>
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getScoreColor(auditResult.score)}`}>
                                 {auditResult.score}
                             </div>
                         </div>
                     </div>
                     
                     {auditResult.passed ? (
                         <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                             <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                             <div>
                                 <p className="text-sm font-bold text-green-800">规则校验通过</p>
                                 <p className="text-xs text-green-600 mt-1">未发现违反预设规则的项目，但仍建议人工复核。</p>
                             </div>
                         </div>
                     ) : (
                         <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                             <div className="flex items-center gap-2 mb-2">
                                 <AlertTriangle className="w-5 h-5 text-amber-600" />
                                 <p className="text-sm font-bold text-amber-800">发现 {auditResult.triggeredRules.length} 项潜在风险</p>
                             </div>
                             <ul className="space-y-1 pl-7 text-xs text-amber-800 list-disc">
                                 {auditResult.triggeredRules.map(ruleId => {
                                     const rule = rules.find(r => r.id === ruleId);
                                     const isSevere = rule && (rule.type === RuleType.FORBIDDEN_CATEGORY || rule.type === RuleType.MAX_AMOUNT);
                                     const isLinked = checkRuleLinked(ruleId);
                                     const isClickable = isLinked && isAuditorOrAdmin;

                                     return (
                                        <li key={ruleId}>
                                            {isClickable ? (
                                               <button 
                                                 onClick={() => onViewRule && onViewRule(ruleId)}
                                                 className="text-left hover:text-blue-700 hover:underline decoration-blue-400/50 underline-offset-2 transition-colors group flex items-start gap-1"
                                                 title="点击跳转至规则配置"
                                               >
                                                   <span className="font-semibold flex items-center gap-1">
                                                       {rule ? rule.name : ruleId}
                                                       <Link2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                   </span>: 
                                                   <span className={isSevere ? "text-red-600 font-bold ml-1" : "ml-1"}>{rule ? rule.description : ''}</span>
                                               </button>
                                           ) : (
                                               <span>
                                                   <span className="font-semibold">{rule ? rule.name : ruleId}</span>
                                                   {rule && (
                                                       <>: <span className={isSevere ? "text-red-600 font-bold ml-1" : "ml-1"}>{rule.description}</span></>
                                                   )}
                                               </span>
                                           )}
                                        </li>
                                     );
                                 })}
                             </ul>
                         </div>
                     )}
                 </div>

                 {/* Receipt Details */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <FileText className="w-4 h-4 text-blue-500" />
                             单据详情
                         </h3>
                         <span className="text-xs font-mono text-slate-400">{data.date}</span>
                     </div>
                     <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-4">
                         <div className={merchantAlert ? "p-2 bg-red-50 rounded-lg border border-red-100 -m-2" : ""}>
                             <label className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${merchantAlert ? "text-red-500" : "text-slate-400"}`}>
                                商家 {merchantAlert && `(${merchantAlert})`}
                             </label>
                             <p className={`font-medium ${merchantAlert ? "text-red-900" : "text-slate-900"}`}>{data.merchantName}</p>
                         </div>
                         <div className={amountAlert ? "p-2 bg-red-50 rounded-lg border border-red-100 -m-2" : ""}>
                             <label className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${amountAlert ? "text-red-500" : "text-slate-400"}`}>
                                总金额 {amountAlert && `(${amountAlert})`}
                             </label>
                             <p className={`font-bold text-xl ${amountAlert ? "text-red-900" : "text-slate-900"}`}>{data.currency} {data.totalAmount.toFixed(2)}</p>
                         </div>
                         <div className={categoryAlert ? "p-2 bg-red-50 rounded-lg border border-red-100 -m-2" : ""}>
                             <label className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${categoryAlert ? "text-red-500" : "text-slate-400"}`}>
                                类别 {categoryAlert && `(${categoryAlert})`}
                             </label>
                             <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-sm font-medium ${categoryAlert ? "bg-red-200 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                                 <Tag className="w-3 h-3" /> {data.category}
                             </span>
                         </div>
                         <div className={dateAlert ? "p-2 bg-red-50 rounded-lg border border-red-100 -m-2" : ""}>
                             <label className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${dateAlert ? "text-red-500" : "text-slate-400"}`}>
                                申请人 {dateAlert && `(${dateAlert})`}
                             </label>
                             <div className="flex items-center gap-2">
                                 <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold">
                                     {request.employeeName.slice(0,1)}
                                 </div>
                                 <p className={`text-sm ${dateAlert ? "text-red-900" : "text-slate-700"}`}>{request.employeeName}</p>
                             </div>
                         </div>
                         
                         <div className="col-span-2 pt-3 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex-1">
                                {data.type ? (
                                    <>
                                        <label className="text-xs font-semibold uppercase tracking-wider block mb-1 text-slate-400">
                                            单据性质
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                                                {getTypeIcon(data.type)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{data.type}</span>
                                            {data.type.includes('发票') && (
                                                <div className="ml-2 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-100">
                                                    合规
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center text-slate-400 text-xs italic">
                                        未分类
                                    </div>
                                )}
                            </div>
                            
                            {/* Confidence Score Display */}
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${confidenceInfo.bg} ${confidenceInfo.color} border-transparent`}>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase opacity-80 leading-tight">OCR 置信度</p>
                                    <p className="text-sm font-bold leading-tight">{Math.round((data.confidence || 0) * 100)}%</p>
                                </div>
                                <div className="flex items-center justify-center">
                                     <ConfidenceIcon className="w-5 h-5" />
                                     {/* <Brain className="w-5 h-5 opacity-50" /> */}
                                </div>
                            </div>
                         </div>
                     </div>
                     
                     {/* Items List */}
                     <div className="border-t border-slate-100">
                         <div className="bg-slate-50/50 px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">消费明细</div>
                         {data.items && data.items.length > 0 ? (
                             <table className="w-full text-sm text-left">
                                 <tbody className="divide-y divide-slate-50">
                                     {data.items.map((item, idx) => (
                                         <tr key={idx} className="hover:bg-slate-50/80">
                                             <td className="px-5 py-3 text-slate-600">{item.description}</td>
                                             <td className="px-5 py-3 text-right font-mono text-slate-900">{item.amount.toFixed(2)}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         ) : (
                            <div className="px-5 py-4 text-sm text-slate-400 italic text-center">未提取到详细商品列表</div>
                         )}
                     </div>
                 </div>

                 {/* History Log */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                         <History className="w-4 h-4 text-slate-400" />
                         处理记录
                     </h3>
                     <div className="relative pl-6 border-l-2 border-slate-100 space-y-8">
                         {request.history?.map((entry, idx) => (
                             <div key={idx} className="relative">
                                 {/* Status Icon with improved positioning */}
                                 <div className={`absolute -left-[37px] top-0 w-6 h-6 rounded-full border-2 border-white shadow-sm bg-white flex items-center justify-center z-10`}>
                                     {getHistoryIcon(entry.status, entry.action)}
                                 </div>
                                 <div className="mt-0.5">
                                     <div className="flex items-center justify-between mb-1">
                                         <p className="text-sm font-bold text-slate-700">{entry.action}</p>
                                         <span className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString()}</span>
                                     </div>
                                     <p className="text-xs text-slate-500 mb-1">
                                         操作人: <span className="font-medium text-slate-700">{entry.actorName}</span>
                                     </p>
                                     {entry.note && (
                                         <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600 italic">
                                             "{entry.note}"
                                         </div>
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Actions Footer */}
                 <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 -mx-5 -mb-5 flex justify-end gap-3 mt-auto">
                    {canApprove && isPending ? (
                        <>
                            <button 
                                onClick={() => onStatusUpdate(request.id, RequestStatus.REJECTED)}
                                className="px-4 py-2 border border-red-200 text-red-700 font-bold rounded-lg hover:bg-red-50 transition-colors"
                            >
                                拒绝申请
                            </button>
                            <button 
                                onClick={() => onStatusUpdate(request.id, RequestStatus.APPROVED)}
                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-200 transition-all"
                            >
                                批准申请
                            </button>
                        </>
                    ) : isMyRequest && isPending ? (
                         <button 
                            onClick={() => onStatusUpdate(request.id, RequestStatus.WITHDRAWN)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            撤回申请
                        </button>
                    ) : (
                        <button onClick={onBack} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors">
                            返回列表
                        </button>
                    )}
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default RequestDetail;
