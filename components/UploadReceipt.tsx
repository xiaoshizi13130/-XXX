
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Loader2, CheckCircle, AlertCircle, ArrowLeft, AlertTriangle, ChevronRight, ChevronDown, Plus, XCircle, Trash2, List, FileText, Tag, Receipt, Plane, Car, FileSignature, Map, HelpCircle, Train, Briefcase, ShieldAlert, Save } from 'lucide-react';
import { extractReceiptData } from '../services/geminiService';
import { evaluateRules } from '../utils/ruleEngine';
import { AuditRule, ReceiptData, ReimbursementRequest, RequestStatus, User, RuleType, RECEIPT_TYPES, RequestType } from '../types';
// @ts-ignore
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// LocalStorage Key
const STORAGE_KEY = 'receipt_drafts_v1';

// --- Main Component ---

interface UploadReceiptProps {
  rules: AuditRule[];
  onRequestCreated: (req: ReimbursementRequest) => void;
  currentUser: User;
  availableRequestTypes: RequestType[];
}

interface QueueItem {
  id: string;
  file?: File; // Optional because it cannot be persisted in localStorage
  preview: string;
  status: 'pending' | 'analyzing' | 'reviewing' | 'completed' | 'error';
  data?: ReceiptData;
  requestType: string; // Defaults to "日常报销" (Name string)
  auditViolations?: string[];
  error?: string;
}

const DEFAULT_CATEGORIES = ["餐饮", "交通", "住宿", "办公", "娱乐", "其他"];

const UploadReceipt: React.FC<UploadReceiptProps> = ({ rules, onRequestCreated, currentUser, availableRequestTypes }) => {
  // Load initial state from LocalStorage if available
  const [items, setItems] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Failed to restore drafts:", e);
      return [];
    }
  });

  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
    if (items.length === 0) return null;
    const candidate = items.find(i => i.status === 'reviewing' || i.status === 'pending') || items[0];
    return candidate ? candidate.id : null;
  });

  const [step, setStep] = useState<'upload' | 'review'>(() => {
    return items.length > 0 ? 'review' : 'upload';
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  
  // Category dropdown state
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Receipt Type dropdown state
  const [typeOptions, setTypeOptions] = useState(RECEIPT_TYPES);
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  // Global Request Type for this batch
  const defaultType = availableRequestTypes.length > 0 ? availableRequestTypes[0].name : "日常报销";
  const [defaultRequestType, setDefaultRequestType] = useState(defaultType);

  // Update default when available types load/change
  useEffect(() => {
      if (availableRequestTypes.length > 0 && !availableRequestTypes.find(t => t.name === defaultRequestType)) {
          setDefaultRequestType(availableRequestTypes[0].name);
      }
  }, [availableRequestTypes]);

  // Reset category dropdown state when switching active items
  useEffect(() => {
    setIsCategoryOpen(false);
    setCategorySearch("");
  }, [activeItemId]);

  // Auto-Save Effect
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      try {
        if (items.length > 0) {
          // Serialize items excluding the File object (which can't be stringified)
          const drafts = items.map(({ file, ...rest }) => rest);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.error("Auto-save failed (likely quota exceeded):", e);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(saveTimer);
  }, [items]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current active item
  const activeItem = items.find(i => i.id === activeItemId) || items[0];

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

  const processFiles = async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setIsParsingFiles(true);
      const newItems: QueueItem[] = [];

      for (const file of files) {
          if (file.type === 'application/pdf') {
              try {
                  const arrayBuffer = await file.arrayBuffer();
                  const loadingTask = getDocument({ 
                      data: arrayBuffer,
                      cMapUrl: 'https://esm.sh/pdfjs-dist@4.0.379/cmaps/',
                      cMapPacked: true
                  });
                  const pdf = await loadingTask.promise;

                  for (let i = 1; i <= pdf.numPages; i++) {
                      const page = await pdf.getPage(i);
                      const viewport = page.getViewport({ scale: 2.0 }); // High quality for OCR
                      const canvas = document.createElement('canvas');
                      const context = canvas.getContext('2d');
                      
                      if (context) {
                          canvas.height = viewport.height;
                          canvas.width = viewport.width;
                          await page.render({ canvasContext: context, viewport }).promise;
                          
                          const jpegUrl = canvas.toDataURL('image/jpeg', 0.8);
                          
                          // Convert Data URL back to Blob/File for consistency
                          const res = await fetch(jpegUrl);
                          const blob = await res.blob();
                          const pageFile = new File([blob], `${file.name}_page_${i}.jpg`, { type: 'image/jpeg' });

                          newItems.push({
                              id: Math.random().toString(36).substr(2, 9),
                              file: pageFile,
                              preview: jpegUrl,
                              status: 'pending',
                              requestType: defaultRequestType
                          });
                      }
                  }
              } catch (err) {
                  console.error("PDF Parsing Error", err);
                  alert(`无法解析 PDF: ${file.name}. 请确保文件未加密。`);
              }
          } else {
              // Handle regular images
              const preview = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string);
                  reader.readAsDataURL(file);
              });

              newItems.push({
                  id: Math.random().toString(36).substr(2, 9),
                  file: file,
                  preview: preview,
                  status: 'pending',
                  requestType: defaultRequestType
              });
          }
      }

      setItems(prev => [...prev, ...newItems]);
      setIsParsingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
    }
  };

  // Helper to find linked active rules for a Request Type
  const getActiveRulesForType = (typeName: string): string[] | undefined => {
      const type = availableRequestTypes.find(rt => rt.name === typeName);
      return type?.linkedRuleIds;
  }

  const processQueue = async () => {
    setIsProcessing(true);
    const itemsToProcess = items.filter(i => i.status === 'pending' || i.status === 'error');

    for (const item of itemsToProcess) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing', error: undefined } : i));

        try {
            const data = await extractReceiptData(item.preview);
            
            // Resolve Rules for this Request Type
            const activeRuleIds = getActiveRulesForType(item.requestType);
            const result = evaluateRules(data, rules, activeRuleIds);

            setItems(prev => prev.map(i => i.id === item.id ? { 
                ...i, 
                status: 'reviewing', 
                data: data,
                auditViolations: result.triggeredRules
            } : i));

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "分析失败";
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMessage } : i));
        }
    }

    setIsProcessing(false);
    
    setStep('review');
    setItems(prev => {
        const firstReview = prev.find(i => i.status === 'reviewing');
        if (firstReview && !activeItemId) {
            setActiveItemId(firstReview.id);
        }
        return prev;
    });
  };

  const handleDataChange = (field: keyof ReceiptData, value: string | number) => {
    if (!activeItem || !activeItem.data) return;

    const updatedData = { ...activeItem.data, [field]: value };
    
    // Re-evaluate rules with active rule list for this request type
    const activeRuleIds = getActiveRulesForType(activeItem.requestType);
    const result = evaluateRules(updatedData, rules, activeRuleIds);

    setItems(prev => prev.map(i => i.id === activeItem.id ? {
        ...i,
        data: updatedData,
        auditViolations: result.triggeredRules
    } : i));
  };

  const handleRequestTypeChange = (value: string) => {
     if (!activeItem) return;

     let updatedViolations = activeItem.auditViolations;

     if (activeItem.data) {
         // Re-evaluate rules considering:
         // 1. The new Request Type (activeRuleIds) - Only rules linked to this type are candidates.
         // 2. The existing OCR Data Type (data.type vs rule.receiptType) - Rules are filtered if they don't apply to this receipt type.
         const activeRuleIds = getActiveRulesForType(value);
         
         // evaluateRules encapsulates both logic checks above
         const result = evaluateRules(activeItem.data, rules, activeRuleIds);
         updatedViolations = result.triggeredRules;
     }

     setItems(prev => prev.map(i => i.id === activeItem.id ? { 
         ...i, 
         requestType: value,
         auditViolations: updatedViolations
     } : i));
  };

  const handleSubmitCurrent = () => {
    if (!activeItem || !activeItem.data || !activeItem.preview) return;
    
    // Final check
    const activeRuleIds = getActiveRulesForType(activeItem.requestType);
    const result = evaluateRules(activeItem.data, rules, activeRuleIds);

    const newRequest: ReimbursementRequest = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      submissionDate: new Date().toISOString(),
      receiptImage: activeItem.preview,
      data: activeItem.data,
      requestType: activeItem.requestType,
      status: RequestStatus.PENDING,
      auditResult: {
        passed: result.passed,
        triggeredRules: result.triggeredRules,
        score: result.score
      },
      history: [{
        timestamp: new Date().toISOString(),
        actorName: currentUser.name,
        action: "提交申请",
        status: RequestStatus.PENDING
      }]
    };

    onRequestCreated(newRequest);

    // Mark as completed
    setItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'completed' } : i));
    
    // Auto switch to next reviewing item
    const nextItem = items.find(i => i.id !== activeItem.id && (i.status === 'reviewing' || i.status === 'pending'));
    if (nextItem) {
        setActiveItemId(nextItem.id);
    }
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setItems(prev => prev.filter(i => i.id !== id));
      if (activeItemId === id) {
          setActiveItemId(null);
      }
  };

  // Helper to identify field-specific errors for ACTIVE item
  const getFieldValidation = (field: 'merchantName' | 'totalAmount' | 'date' | 'category') => {
      if (!activeItem || !activeItem.auditViolations) return { isError: false, message: null };

      const violationRuleId = activeItem.auditViolations.find(id => {
          const rule = rules.find(r => r.id === id);
          if (!rule) return false;
          if (field === 'totalAmount' && rule.type === RuleType.MAX_AMOUNT) return true;
          if (field === 'category' && rule.type === RuleType.FORBIDDEN_CATEGORY) return true;
          if (field === 'date' && rule.type === RuleType.WEEKEND_BAN) return true;
          if (field === 'merchantName' && rule.type === RuleType.REQUIRED_FIELD) return true;
          return false;
      });
      
      if (violationRuleId) {
          const rule = rules.find(r => r.id === violationRuleId);
          return { isError: true, message: rule?.name };
      }
      return { isError: false, message: null };
  };

  // Helper for Confidence Display
  const getConfidenceDisplay = (score: number = 0) => {
      const percentage = Math.round(score * 100);
      if (score >= 0.8) return { 
          color: 'text-emerald-600', 
          bg: 'bg-emerald-50', 
          border: 'border-emerald-200', 
          icon: CheckCircle, 
          text: '识别准确度高',
          level: 'high' 
      };
      if (score >= 0.6) return { 
          color: 'text-amber-600', 
          bg: 'bg-amber-50', 
          border: 'border-amber-200', 
          icon: AlertTriangle, 
          text: '识别准确度一般',
          level: 'medium'
      };
      return { 
          color: 'text-red-600', 
          bg: 'bg-red-50', 
          border: 'border-red-200', 
          icon: ShieldAlert, 
          text: '识别准确度低 - 请仔细核对',
          level: 'low'
      };
  };

  const filteredCategories = categoryOptions.filter(c => 
    c.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleCategoryCommit = () => {
    if (categorySearch && !categoryOptions.some(c => c === categorySearch)) {
        setCategoryOptions(prev => [...prev, categorySearch]);
    }
    setIsCategoryOpen(false);
  };

  // UPLOAD STEP
  if (step === 'upload') {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-slate-900">批量上传收据</h2>
          <p className="text-slate-500 mt-2">支持多图选择与 PDF 自动拆分。AI 将逐张识别单据内容。</p>
        </div>

        {/* Global Request Type Selector */}
        <div className="max-w-md mx-auto mb-8 bg-white p-5 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center">
             <label className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                请选择本次报销的申请类型
             </label>
             <div className="w-full relative max-w-xs">
                 <select
                    value={defaultRequestType}
                    onChange={(e) => setDefaultRequestType(e.target.value)}
                    className="w-full appearance-none bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-medium text-sm shadow-sm"
                 >
                     {availableRequestTypes.map(type => (
                         <option key={type.id} value={type.name}>{type.name}</option>
                     ))}
                     {availableRequestTypes.length === 0 && <option value="">无可用类型</option>}
                 </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                 </div>
             </div>
             <p className="text-xs text-slate-400 mt-2.5 text-center">
                 此类型将应用于本批次上传的所有单据
             </p>
        </div>

        <div 
          className={`bg-white border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            items.length > 0 ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*,.pdf"
            multiple
            onChange={handleFileChange}
          />

          {items.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
               <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  {isParsingFiles ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
               </div>
               <p className="text-lg font-medium text-slate-700">
                   {isParsingFiles ? '正在处理文件...' : '点击选择图片/PDF 或拖拽至此'}
               </p>
               <p className="text-sm text-slate-400 mt-1">
                   支持批量上传。多页 PDF 将自动拆分为单张图片。
               </p>
               <button className="mt-6 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 font-medium">
                  <Camera className="w-4 h-4" /> 拍照/选择文件
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {items.map((item, idx) => (
                    <div key={item.id} className="relative group aspect-[3/4] bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="absolute top-2 right-2 z-10">
                            <button 
                                onClick={(e) => handleDeleteItem(item.id, e)}
                                className="p-1 bg-white/80 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-full backdrop-blur transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Request Type Badge */}
                        <div className="absolute top-2 left-2 z-10">
                             <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur text-white text-[10px] rounded font-medium shadow-sm">
                                 {item.requestType}
                             </span>
                        </div>

                        {/* Status Overlay */}
                        <div className="absolute inset-0 z-0">
                            <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                        </div>

                        {/* Processing / Result Overlay */}
                        <div className={`absolute inset-0 z-0 flex items-center justify-center transition-all pointer-events-none`}>
                            {item.status === 'analyzing' && (
                                <div className="absolute inset-0 bg-blue-900/20 backdrop-blur-[1px] overflow-hidden flex flex-col items-center justify-center rounded-lg">
                                     <div className="w-full h-2 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-0 animate-[scan_1.5s_ease-in-out_infinite] shadow-[0_0_15px_rgba(96,165,250,0.8)]"></div>
                                     <Loader2 className="w-8 h-8 text-white animate-spin drop-shadow-md" />
                                     <span className="text-xs text-white font-bold mt-2 drop-shadow-md">分析中...</span>
                                </div>
                            )}
                            {item.status === 'reviewing' && (
                                <div className="absolute bottom-0 inset-x-0 bg-emerald-600/90 py-1 flex items-center justify-center gap-1 text-white">
                                    <CheckCircle className="w-3 h-3" />
                                    <span className="text-xs font-bold">已完成</span>
                                </div>
                            )}
                            {item.status === 'error' && (
                                <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center text-white p-2 text-center">
                                    <AlertCircle className="w-8 h-8 mb-1" />
                                    <span className="text-xs font-bold">{item.error || '失败'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {isParsingFiles ? (
                     <div className="aspect-[3/4] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                        <span className="text-xs text-slate-500">正在处理 PDF...</span>
                     </div>
                ) : (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[3/4] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-400 hover:text-blue-500"
                    >
                        <Plus className="w-8 h-8 mb-2" />
                        <span className="text-xs font-medium">添加更多</span>
                    </div>
                )}
            </div>
          )}

          {items.length > 0 && (
             <div className="flex gap-4 justify-center">
                 <button 
                   onClick={() => { 
                       setItems([]); 
                       localStorage.removeItem(STORAGE_KEY);
                       setStep('upload'); 
                   }}
                   disabled={isProcessing || isParsingFiles}
                   className="px-6 py-3 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
                 >
                    清空列表
                 </button>
                 <button
                   onClick={processQueue}
                   disabled={isProcessing || isParsingFiles || items.filter(i => i.status === 'pending').length === 0}
                   className={`px-8 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-white shadow-lg transition-all ${
                     isProcessing 
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:scale-[1.01]'
                   }`}
                 >
                   {isProcessing ? (
                     <>
                       <Loader2 className="w-5 h-5 animate-spin" />
                       正在逐个分析 ({items.filter(i => i.status === 'analyzing' || i.status === 'completed' || i.status === 'reviewing').length}/{items.length})...
                     </>
                   ) : (
                     <>
                       {items.some(i => i.status === 'reviewing') ? '继续审核' : '开始批量识别'}
                       <ChevronRight className="w-5 h-5" />
                     </>
                   )}
                 </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  // REVIEW STEP - SPLIT VIEW
  const pendingCount = items.filter(i => i.status === 'reviewing' || i.status === 'pending').length;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-4">
                <button onClick={() => setStep('upload')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">批量审核</h2>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">
                            待处理: {pendingCount} | 已提交: {items.filter(i => i.status === 'completed').length}
                        </p>
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200">
                            <Save className="w-3 h-3" /> 自动保存开启
                        </span>
                    </div>
                </div>
            </div>
            {items.every(i => i.status === 'completed') && (
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> 全部完成
                </div>
            )}
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left: Queue Sidebar */}
            <div className="w-48 flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-y-auto flex flex-col">
                <div className="p-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <List className="w-3 h-3" /> 任务列表
                </div>
                <div className="p-2 space-y-2">
                    {items.map((item, idx) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveItemId(item.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left relative overflow-hidden ${
                                activeItemId === item.id 
                                ? 'bg-blue-50 ring-1 ring-blue-200 shadow-sm' 
                                : 'hover:bg-slate-50 text-slate-500'
                            } ${item.status === 'completed' ? 'opacity-50' : ''}`}
                        >
                            <div className="w-10 h-10 rounded bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200 relative">
                                <img src={item.preview} className="w-full h-full object-cover" alt="" />
                                
                                {/* Confidence Indicator */}
                                {item.data?.confidence !== undefined && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50">
                                        <div 
                                            className={`h-full transition-all duration-300 ${
                                                item.data.confidence >= 0.8 ? 'bg-emerald-500' : 
                                                item.data.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                            }`} 
                                            style={{ width: `${item.data.confidence * 100}%` }}
                                            title={`OCR置信度: ${Math.round(item.data.confidence * 100)}%`}
                                        />
                                    </div>
                                )}

                                {/* Mini Status Icon */}
                                <div className="absolute bottom-0 right-0 p-0.5 bg-white/90 rounded-tl z-10">
                                    {item.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
                                    {item.status === 'reviewing' && <AlertCircle className="w-3 h-3 text-blue-500" />}
                                    {item.status === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                                    {item.status === 'analyzing' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${activeItemId === item.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {item.data?.merchantName || `收据 ${idx + 1}`}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                    {item.data?.type || (item.status === 'completed' ? '已提交' : item.status === 'reviewing' ? '待确认' : item.status === 'pending' ? '等待中' : '处理中')}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Middle: Active Item Preview & Form */}
            {activeItem ? (
                <div className="flex-1 flex gap-4 min-w-0">
                    {/* Image Viewer */}
                    <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center relative border border-slate-800">
                        <img src={activeItem.preview} alt="Receipt" className="max-w-full max-h-full object-contain" />
                        
                        {/* Scanning Animation */}
                         {activeItem.status === 'analyzing' && (
                              <div className="absolute inset-0 z-10 bg-blue-900/20 backdrop-blur-[1px] flex items-center justify-center overflow-hidden">
                                   <div className="w-full h-2 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-0 shadow-[0_0_20px_rgba(96,165,250,0.8)] animate-[scan_1.5s_ease-in-out_infinite]"></div>
                                   <div className="bg-white/90 px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
                                       <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                       <span className="text-xs font-bold text-blue-800">正在分析此图...</span>
                                   </div>
                              </div>
                         )}
                    </div>

                    {/* Form */}
                    <div className="w-[400px] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                         {activeItem.status === 'completed' ? (
                             <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                     <CheckCircle className="w-8 h-8" />
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800">已提交</h3>
                                 <p className="text-slate-500 text-sm mt-2 mb-6">此单据已成功创建报销申请。</p>
                                 <button 
                                    onClick={() => {
                                        // Find next
                                        const next = items.find(i => i.status === 'reviewing');
                                        if (next) setActiveItemId(next.id);
                                    }}
                                    disabled={!items.some(i => i.status === 'reviewing')}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50"
                                 >
                                     查看下一个待办
                                 </button>
                             </div>
                         ) : activeItem.status === 'error' ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                    <AlertCircle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">识别失败</h3>
                                <p className="text-red-500 text-sm mt-2 mb-6">{activeItem.error}</p>
                                <button onClick={processQueue} className="px-4 py-2 bg-blue-600 text-white rounded-lg">重试</button>
                            </div>
                         ) : activeItem.status === 'pending' || activeItem.status === 'analyzing' ? (
                             <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
                                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                                 <p>等待处理...</p>
                             </div>
                         ) : (
                             // REVIEW FORM
                             (() => {
                                const conf = activeItem.data?.confidence || 0;
                                const confDisplay = getConfidenceDisplay(conf);
                                const ConfIcon = confDisplay.icon;
                                
                                return (
                                <div className="flex-1 overflow-y-auto p-6">
                                    {/* Audit Banner */}
                                    {activeItem.auditViolations && activeItem.auditViolations.length > 0 ? (
                                        <div className="mb-4 bg-red-50 border border-red-100 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <h3 className="font-bold text-sm text-red-800">存在 {activeItem.auditViolations.length} 项风险</h3>
                                                    <div className="mt-2 space-y-1">
                                                        {activeItem.auditViolations.map(id => {
                                                            const rule = rules.find(r => r.id === id);
                                                            return <div key={id} className="text-xs text-red-600 flex gap-1"><span>•</span><span>{rule?.name}</span></div>
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                                             <CheckCircle className="w-5 h-5 text-emerald-600" />
                                             <span className="text-sm font-bold text-emerald-800">智能审核通过</span>
                                        </div>
                                    )}

                                    {/* Confidence Score Banner */}
                                    <div className={`flex items-center justify-between p-3 rounded-lg border mb-6 ${confDisplay.bg} ${confDisplay.border}`}>
                                         <div className="flex items-center gap-2">
                                             <ConfIcon className={`w-4 h-4 ${confDisplay.color}`} />
                                             <span className={`text-xs font-bold ${confDisplay.color}`}>
                                                {confDisplay.text} ({Math.round(conf * 100)}%)
                                             </span>
                                         </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Request Type Selector (Per Item Override) */}
                                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
