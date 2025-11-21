import { useState, useEffect, useRef } from 'react';
import './Sidebar.css';
import avatar from '../assets/img/avatar.png';
import avatarLight from '../assets/img/avatar-light.png'
import arrowRight from '../assets/img/rightarrow.png';
import newSession from '../assets/img/newsession.png';
import newSessionLight from '../assets/img/newsession-light.png';
import shiftLanguage from '../assets/img/shiftlanguage.png';
import shiftLanguageLight from '../assets/img/shiftlanguage-light.png';

interface ChatSession {
    _id: string;
    title: string;
    updatedAt: string;
}

interface SidebarProps {
  onNewSession: () => void;
  onLanguageChange: (language: string) => void;
  chatList: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;

  onDeleteSession: (chatId: string) => void;
  onRenameSession: (chatId: string, newTitle: string) => void;
}

// SVG 图标组件
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);

const ConfirmIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const Sidebar = ({
    onNewSession,
    onLanguageChange,
    chatList,
    activeChatId,

    onSelectChat,
    onDeleteSession,
    onRenameSession
}: SidebarProps) => {
    const [isClosed, setIsClosed] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isHovered, setIsHovered] = useState<string | null> (null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const handleToggle = () => setIsClosed(!isClosed);
    const handleModeSwitch = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark');
  };

  // 本地图标
  const getIconSrc = (iconName: string) => {
    const isDarkOrHover = isDarkMode || isHovered === iconName;
    switch(iconName) {
      case 'avatar': return isDarkOrHover ? avatarLight : avatar;
      case 'arrow': return arrowRight;
      case 'newSession': return isDarkOrHover ? newSessionLight : newSession;
      case 'shiftLanguage': return isDarkOrHover ? shiftLanguageLight : shiftLanguage;
      default: return '';
    }
  }

  // 开始重命名
  const startEditing = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat._id);
    setEditTitle(chat.title);
  };

  // 提交重命名
  const submitRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editTitle.trim()) {
        onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  // 自动聚焦输入框
  useEffect(() => {
      if (editingId && inputRef.current) {
          inputRef.current.focus();
      }
  }, [editingId]);

  return (
    <nav className={`shell ${isClosed ? 'close' : ''} ${isDarkMode ? 'dark' : ''}`}>
      <header>
        <div className="image-text">
          <span className="image"><img src={getIconSrc('avatar')} alt="头像" /></span>
          <div className="text logo-text">
            <span className="name">任务助手</span>
            <span className="software">AI Assistant</span>
          </div>
        </div>
        <span className="iconfont icon-rightarrow toggle" onClick={handleToggle}>
          <img src={arrowRight} alt="" className="toggle-arrow" />
        </span>
      </header>

      <div className="menu-bar">
        <div className="menu menu-actions">
          <ul className="menu-links">
            <li className="nav-link" onMouseEnter={() => setIsHovered('newSession')} onMouseLeave={() => setIsHovered(null)}>
              <a href="#" onClick={(e) => { e.preventDefault(); onNewSession(); }}>
                <img src={getIconSrc('newSession')} alt="" className="iconfont icon-new icon" />
                <span className="text nac-text">创建新会话</span>
              </a>
            </li>
            <li className="nav-link" onMouseEnter={() => setIsHovered('shiftLanguage')} onMouseLeave={() => setIsHovered(null)}>
              <a href="#" onClick={(e) => { e.preventDefault(); onLanguageChange('en'); }}>
                <img src={getIconSrc('shiftLanguage')} alt="" className="iconfont icon-langugage icon" />
                <span className="text nac-text">切换语言</span>
              </a>
            </li>
          </ul>
        </div>

        {/* 历史记录列表 */}
        <div className="chat-history" style={{ flexGrow: 1, overflowY: 'auto', marginTop: '10px' }}>
            {!isClosed && chatList.length > 0 && <div className="history-header" style={{padding: '0 14px', fontSize: '12px', opacity: 0.6, marginBottom: '8px'}}>历史记录</div>}
            <ul className="menu-links">
                {chatList.map((chat) => (
                    <li key={chat._id} className={`nav-link chat-item ${activeChatId === chat._id ? 'active' : ''} ${editingId === chat._id ? 'editing' : ''}`}>
                        <a href="#" onClick={(e) => { e.preventDefault(); onSelectChat(chat._id); }}>
                            <span className="icon">💬</span>

                            {/* 标题显示逻辑：编辑模式 vs 普通模式 */}
                            {editingId === chat._id && !isClosed ? (
                                <input
                                    ref={inputRef}
                                    className="rename-input"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submitRename();
                                        if (e.key === 'Escape') setEditingId(null);
                                    }}
                                    onBlur={() => submitRename()}
                                />
                            ) : (
                                <span className="text">{chat.title}</span>
                            )}

                            {/* 操作按钮：仅在展开且非编辑状态(或正在编辑当前项)显示 */}
                            {!isClosed && (
                                <div className="chat-actions">
                                    {editingId === chat._id ? (
                                        <button className="action-btn" onClick={submitRename} title="确认">
                                            <ConfirmIcon />
                                        </button>
                                    ) : (
                                        <>
                                            <button className="action-btn" onClick={(e) => startEditing(e, chat)} title="重命名">
                                                <EditIcon />
                                            </button>
                                            <button className="action-btn" onClick={(e) => {
                                                e.stopPropagation();
                                                if(window.confirm('确定要删除此会话吗？')) onDeleteSession(chat._id);
                                            }} title="删除">
                                                <DeleteIcon />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
        </div>

        <div className="bottom-content">
          <li className="mode">
            <div className="sun-moon">
              {!isClosed && <i className="iconfont icon-day icon sun">☀️</i>}
              {!isClosed && <i className="iconfont icon-night icon moon">🌙</i>}
            </div>
            <span className="mode-text text">{isDarkMode ? '白日模式' : '夜间模式'}</span>
            <div className="toggle-switch" onClick={handleModeSwitch}><span className="switch"></span></div>
          </li>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
