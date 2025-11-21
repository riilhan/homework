import { useState } from 'react';
import './Sidebar.css';
import avatar from '../assets/img/avatar.png';
import avatarLight from '../assets/img/avatar-light.png'
import arrowRight from '../assets/img/rightarrow.png';
// import arrowRightLight from '../assets/img/rightarrow-light.png';
import newSession from '../assets/img/newsession.png';
import newSessionLight from '../assets/img/newsession-light.png';
import shiftLanguage from '../assets/img/shiftlanguage.png';
import shiftLanguageLight from '../assets/img/shiftlanguage-light.png';

interface SidebarProps {
  onNewSession: () => void;
  onLanguageChange: (language: string) => void;
}

const Sidebar = ({ onNewSession, onLanguageChange }: SidebarProps) => {
  const [isClosed, setIsClosed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('中文');
  const [isHovered, setIsHovered] = useState<string | null> (null);

  const handleToggle = () => {
    setIsClosed(!isClosed);
  };

  const handleModeSwitch = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark');
  };

  const handleLanguageChange = () => {
    const newLanguage = currentLanguage === '中文' ? 'English' : '中文';
    setCurrentLanguage(newLanguage);
    onLanguageChange(newLanguage);
  };

  const getIconSrc = (iconNmae: string) => {
    if(isDarkMode || isHovered === iconNmae) {
      switch(iconNmae) {
        case 'avatar': return avatarLight;
        case 'arrow': return arrowRight;
        case 'newSession': return newSessionLight;
        case 'shiftLanguage': return shiftLanguageLight;
        default: return '';
      }
    } else {
      switch(iconNmae) {
        case 'avatar': return avatar;
        case 'arrow': return arrowRight;
        case 'newSession': return newSession;
        case 'shiftLanguage': return shiftLanguage;
        default: return '';
      }
    }
  }

  return (
    <nav className={`shell ${isClosed ? 'close' : ''} ${isDarkMode ? 'dark' : ''}`}>
      <header>
        <div className="image-text">
          <span className="image">
            <img src={getIconSrc('avatar')} alt="头像" />
          </span>
          <div className="text logo-text">
            <span className="name">任务助手</span>
            <span className="software">AI Assistant</span>
          </div>
        </div>
        <span
          className="iconfont icon-rightarrow toggle"
          onClick={handleToggle}
        >
          <img src={arrowRight} alt="" className="toggle-arrow" />
        </span>
      </header>

      <div className="menu-bar">
        <div className="menu">
          <ul className="menu-links">
            {/* 创建新会话 */}
            <li
              className="nav-link"
              onMouseEnter={() => setIsHovered('newSession')}
              onMouseLeave={() => setIsHovered(null)}
            >
              <a href="#" onClick={(e) => { e.preventDefault(); onNewSession(); }}>
                <img src={getIconSrc('newSession')} alt="" className="iconfont icon-new icon" />
                {!isClosed && <span className="text nac-text">创建新会话</span>}
              </a>
            </li>

            {/* 切换语言 */}
            <li
              className="nav-link"
              onMouseEnter={() => setIsHovered('shiftLanguage')}
              onMouseLeave={() => setIsHovered(null)}
            >
              <a href="#" onClick={(e) => { e.preventDefault(); handleLanguageChange(); }}>
                <img src={getIconSrc('shiftLanguage')} alt="" className="iconfont icon-langugage icon" />
                {!isClosed && <span className="text nac-text">切换语言</span>}
              </a>
            </li>
          </ul>
        </div>

        <div className="bottom-content">
          <li className="mode">
            <div className="sun-moon">
              {!isClosed && <i className="iconfont icon-day icon sun">☀️</i>}
              {!isClosed && <i className="iconfont icon-night icon moon">🌙</i>}
            </div>
            <span className="mode-text text">
              {isDarkMode ? '白日模式' : '夜间模式'}
            </span>
            <div className="toggle-switch" onClick={handleModeSwitch}>
              <span className="switch"></span>
            </div>
          </li>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
