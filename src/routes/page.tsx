import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './app.css';
import Sidebar from '../components/Sidebar';

interface Message {
  id: string;
  content: string;
  reasoning?: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

interface ChatSession {
  _id: string;
  title: string;
  updatedAt: string;
}

// --- 国际化资源 ---
const locales = {
  zh: {
    greet: "你好，欢迎使用任务助手",
    placeholder: "请输入消息...",
    deepThink: "深度思考",
    webSearch: "联网搜索",
    searching: "正在联网搜索...",
    thinking: "正在深度思考...",
    error: "出错了",
    deleteFail: "删除失败，请稍后重试",
    renameFail: "重命名失败",
    networkError: "网络请求异常，请检查连接或重试。",
    aiNoResponse: "AI 未返回任何内容",
    serverError: "服务器响应错误",
    loadListFailed: "加载会话列表失败",
    loadDetailFailed: "加载会话详情失败",
    emptyResponseBody: "响应体为空",
    saveMessageFailed: "后台保存消息失败",
    requestProcessError: "请求流程出错"
  },
  en: {
    greet: "Hello, welcome to AI Task Assistant",
    placeholder: "Type a message...",
    deepThink: "Deep Think",
    webSearch: "Web Search",
    searching: "Searching the web...",
    thinking: "Thinking deeply...",
    error: "Error",
    deleteFail: "Delete failed, please try again",
    renameFail: "Rename failed",
    networkError: "Network error, please check connection.",
    aiNoResponse: "AI did not return any content",
    serverError: "Server response error",
    loadListFailed: "Failed to load session list",
    loadDetailFailed: "Failed to load session details",
    emptyResponseBody: "Response body is empty",
    saveMessageFailed: "Failed to save message in background",
    requestProcessError: "Request process error"
  }
};

const Index = () => {
  const [hasMessage, setHasMessage] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);

  // 功能开关状态
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, waitingForAI]);

  // 获取当前语言的字典
  const t = locales[language];

  // 切换语言的处理函数
  const handleLanguageChange = (lang: string) => {
    const newLang = lang === 'English' || lang === 'en' ? 'en' : 'zh';
    setLanguage(newLang);
  };

  // 获取列表
  const fetchChatList = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getHistory' })
      });
      const data = await res.json();
      if (data.code === 200) setChatList(data.data);
    } catch (e) {
      console.error(t.loadListFailed, e);
    }
  };

  useEffect(() => { fetchChatList(); }, [language]);

  // 删除会话
  const handleDeleteSession = async (chatId: string) => {
      try {
          const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'deleteSession', chatId })
          });
          if (res.ok) {
              if (chatId === activeChatId) handleNewSession();
              fetchChatList();
          }
      } catch (e) {
          alert(t.deleteFail);
      }
  };

  // 重命名会话
  const handleRenameSession = async (chatId: string, newTitle: string) => {
      try {
          const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'renameSession', chatId, title: newTitle })
          });
          if (res.ok) fetchChatList();
      } catch (e) {
          console.error(t.renameFail);
      }
  };

  // 加载会话详情
  const loadChatSession = async (chatId: string) => {
    if (chatId === activeChatId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConversation', chatId })
      });
      const data = await res.json();
      if (data.code === 200 && data.data) {
        const historyMessages: Message[] = data.data.messages.map((msg: any) => ({
          id: msg._id || `msg-${msg.timestamp}`,
          content: msg.content,
          reasoning: msg.reasoning, // 如果数据库未来支持存思考过程，这里可以加载
          role: msg.role,
          timestamp: msg.timestamp
        }));
        setMessages(historyMessages);
        setHasMessage(historyMessages.length > 0);
        setActiveChatId(chatId);
        setInputText('');
        setStreamingMessageId(null);
      }
    } catch (e) {
      console.error(t.loadDetailFailed, e);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setHasMessage(false);
    setInputText('');
    setWaitingForAI(false);
    setStreamingMessageId(null);
    setIsSearchEnabled(false);
    setIsThinkingEnabled(false);
    setActiveChatId(null);
  };

  // 添加错误消息
  const appendErrorMessage = (text: string) => {
      setMessages(prev => [
          ...prev,
          {
              id: `error-${Date.now()}`,
              content: `⚠️ **${t.error}**: ${text}`,
              role: 'assistant',
              timestamp: Date.now(),
          }
      ]);
  };

  // 发送消息
  const sendToLLM = async() => {
    if(loading || !inputText.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setHasMessage(true);

    const messageToSend = inputText;
    const useSearch = isSearchEnabled;
    const useThinking = isThinkingEnabled;
    const currentChatId = activeChatId;
    const currentLang = language;

    setInputText('');
    setLoading(true);
    setWaitingForAI(true);
    setStreamingMessageId(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          useSearch: useSearch,
          enableThinking: useThinking,
          chatId: currentChatId,
          language: currentLang
        }),
      });

      if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`${t.serverError} (${response.status}): ${errorText}`);
      }

      const newChatId = response.headers.get('x-chat-id');
      if (newChatId && newChatId !== activeChatId) {
        setActiveChatId(newChatId);
        setTimeout(() => fetchChatList(), 500);
      }

      if (!response.body) throw new Error(t.emptyResponseBody);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let fullContent = '';
      let fullReasoning = '';
      let tempStreamingId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              const contentChunk = delta?.content || '';
              const reasoningChunk = delta?.reasoning_content || '';

              if (contentChunk || reasoningChunk) {
                fullContent += contentChunk;
                fullReasoning += reasoningChunk;

                if (!tempStreamingId) {
                  const aiMessage: Message = {
                    id: `streaming-${Date.now()}`,
                    content: fullContent,
                    reasoning: fullReasoning,
                    role: 'assistant',
                    timestamp: Date.now()
                  };
                  tempStreamingId = aiMessage.id;
                  setStreamingMessageId(tempStreamingId);
                  setWaitingForAI(false);
                  setMessages(prev => [...prev, aiMessage]);
                } else {
                  setMessages(prev => prev.map(msg =>
                    msg.id === tempStreamingId
                        ? { ...msg, content: fullContent, reasoning: fullReasoning }
                        : msg
                  ));
                }
              }
            } catch (e) { /* 忽略解析错误 */ }
          }
        }
      }

      if (!fullContent && !tempStreamingId) {
        throw new Error(t.aiNoResponse);
      }

      const finalChatId = newChatId || activeChatId;
      if (finalChatId && fullContent) {
        // 目前仅保存最终回复内容，若需保存思考过程需修改数据库Schema
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'saveAiMessage', chatId: finalChatId, content: fullContent })
        }).catch(e => console.warn(t.saveMessageFailed, e));
      }

    } catch (error: any) {
      console.error(t.requestProcessError, error);
      appendErrorMessage(error.message || t.networkError);
    } finally {
      setLoading(false);
      setWaitingForAI(false);
      setStreamingMessageId(null);
    }
  }

  return(
    <div className="container">
      <div className='sidebar-container'>
        <Sidebar
          onNewSession={handleNewSession}
          onLanguageChange={handleLanguageChange}
          chatList={chatList}
          activeChatId={activeChatId}
          onSelectChat={loadChatSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          currentLanguage={language}
        />
      </div>

      <div className="main-content">
        <div className={hasMessage ? 'has-message' : 'no-message'}>
          {hasMessage && (
            <div className="messages-container">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.role}-message`}>
                  <div className="message-content">
                    {message.role === 'assistant' ? (
                        <div>
                          {/* 如果有思考过程，渲染思考区块 */}
                          {message.reasoning && (
                            <div className="reasoning-block">
                                <div className="reasoning-header">
                                    <span className="reasoning-icon">💭</span>
                                    {t.deepThink}...
                                </div>
                                <div className="reasoning-content">
                                    <ReactMarkdown>{message.reasoning}</ReactMarkdown>
                                </div>
                            </div>
                          )}

                          {/* 渲染正文回复 */}
                          <div className="main-response">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </div>
                    ) : (
                      message.content.split('\n').map((line, index) => <p key={`${message.id}-${index}`}>{line}</p>)
                    )}
                  </div>
                </div>
              ))}

              {waitingForAI && !streamingMessageId && (
                <div className="message assistant-message">
                  <div className="message-content">
                    <div className="typing-animation"><span></span><span></span><span></span></div>
                    {/* 根据状态显示不同的提示语 */}
                    <div style={{fontSize: '12px', color: '#999', marginTop: '5px'}}>
                        {isThinkingEnabled ? t.thinking : (isSearchEnabled ? t.searching : "")}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {!hasMessage && <p className='greet-text'>{t.greet}</p>}

          <div className='input-container'>
            <textarea
              className='text-section'
              placeholder={t.placeholder}
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToLLM(); } }}
            />
            <div className='button-items'>
              <div className="feature-buttons">
                  {/* 深度思考按钮 */}
                  <button
                    type="button"
                    className={`deepthink-button ${isThinkingEnabled ? 'active' : ''}`}
                    onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                    disabled={loading}
                    title={isThinkingEnabled ? "点击关闭深度思考" : "点击开启深度思考"}
                  >
                    {t.deepThink}
                  </button>

                  {/* 联网搜索按钮 */}
                  <button
                    type="button"
                    className={`deepthink-button ${isSearchEnabled ? 'active' : ''}`}
                    onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                    disabled={loading}
                  >
                    {t.webSearch}
                  </button>
              </div>
              <button type="button" className='send-button' onClick={sendToLLM} disabled={loading}></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};

export default Index;
