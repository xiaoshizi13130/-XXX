
import React from 'react';
import { LayoutDashboard, PlusCircle, Settings, FileText, PieChart, Users, LogOut, User, Database } from 'lucide-react';
import { User as UserType, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserType;
  availableUsers: UserType[];
  onSwitchUser: (user: UserType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentUser, availableUsers, onSwitchUser }) => {
  
  // Define menu items with access control
  const allMenuItems = [
    { 
      id: 'dashboard', 
      label: '仪表盘', 
      icon: LayoutDashboard, 
      roles: [UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.ADMIN] 
    },
    { 
      id: 'upload', 
      label: '新建申请', 
      icon: PlusCircle, 
      roles: [UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.ADMIN] // All users can submit expenses
    },
    { 
      id: 'requests', 
      label: '单据列表', 
      icon: FileText, 
      roles: [UserRole.EMPLOYEE, UserRole.AUDITOR, UserRole.ADMIN] 
    },
    { 
      id: 'rules', 
      label: '系统配置', 
      icon: Settings, 
      roles: [UserRole.ADMIN, UserRole.AUDITOR] // Auditor can view, Admin can edit
    },
    {
      id: 'database',
      label: '数据库管理',
      icon: Database,
      roles: [UserRole.ADMIN] // Only Admin manages DB
    }
  ];

  const visibleItems = allMenuItems.filter(item => item.roles.includes(currentUser.role));

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.ADMIN: return '系统管理员';
          case UserRole.AUDITOR: return '财务审核';
          case UserRole.EMPLOYEE: return '普通员工';
          default: return '访客';
      }
  }

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col p-4 shadow-xl flex-shrink-0 transition-all">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="p-2 bg-blue-600 rounded-lg">
          <PieChart className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight">财务 AI</h1>
          <p className="text-xs text-slate-400">智能报销系统</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-800 pt-4">
         <div className="px-2 mb-4">
            <p className="text-xs text-slate-500 uppercase font-bold mb-2">切换角色 (演示用)</p>
            <div className="space-y-1">
                {availableUsers.filter(u => u.id !== currentUser.id).map(u => (
                    <button 
                        key={u.id}
                        onClick={() => onSwitchUser(u)}
                        className="w-full text-left px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded flex items-center gap-2"
                    >
                        <Users className="w-3 h-3" />
                        {u.name} - {getRoleBadge(u.role)}
                    </button>
                ))}
            </div>
         </div>

        <div className="flex items-center gap-3 px-2 pt-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-700 overflow-hidden ${
              currentUser.role === UserRole.ADMIN ? 'bg-purple-900 text-purple-200' : 
              currentUser.role === UserRole.AUDITOR ? 'bg-amber-900 text-amber-200' : 'bg-slate-700'
          }`}>
            {currentUser.avatar ? currentUser.avatar : <User className="w-5 h-5" />}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <p className="text-xs text-slate-500 truncate">{getRoleBadge(currentUser.role)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
