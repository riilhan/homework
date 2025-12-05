import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './app.css';
import Sidebar from '../components/Sidebar';

// 是否显示测试模式按钮
const IS_TEST_MODE_AVAILABLE = true;

interface Message {
  id: string;
  content: string;
  reasoning?: string;
  evaluation?: string;
  imageUrls?: string[];
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
    testMode: "测试模式",
    webSearch: "联网搜索",
    searching: "正在联网搜索...",
    thinking: "正在深度思考...",
    evaluating: "正在评估回答准确性...",
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
    requestProcessError: "请求流程出错",
    imageSelect: "选择图片",
    maxImageWarning: "一次最多只能上传 4 张图片",
    evaluationTitle: "模型回答评估 (Doubao)"
  },
  en: {
    greet: "Hello, welcome to AI Task Assistant",
    placeholder: "Type a message...",
    deepThink: "Deep Think",
    testMode: "Test Mode",
    webSearch: "Web Search",
    searching: "Searching the web...",
    thinking: "Thinking deeply...",
    evaluating: "Evaluating answer accuracy...",
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
    requestProcessError: "Request process error",
    imageSelect: "Select Image",
    maxImageWarning: "Max 4 images allowed at once",
    evaluationTitle: "Answer Evaluation (Doubao)"
  }
};

// SVG 图标
const ImageIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>);
const CloseIcon = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const FlaskIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 2v7.31"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>);

const Index = () => {
  const [hasMessage, setHasMessage] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);

  // 功能开关状态
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  // 测试模式状态
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(false);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [messages, waitingForAI, selectedImages]);

  const t = locales[language];

  const handleLanguageChange = (lang: string) => {
    const newLang = lang === 'English' || lang === 'en' ? 'en' : 'zh';
    setLanguage(newLang);
  };

  const fetchChatList = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getHistory' })
      });
      const data = await res.json();
      if (data.code === 200) setChatList(data.data);
    } catch (e) { console.error(t.loadListFailed, e); }
  };

  useEffect(() => { fetchChatList(); }, [language]);

  const handleDeleteSession = async (chatId: string) => {
      try {
          const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteSession', chatId }) });
          if (res.ok) { if (chatId === activeChatId) handleNewSession(); fetchChatList(); }
      } catch (e) { alert(t.deleteFail); }
  };

  const handleRenameSession = async (chatId: string, newTitle: string) => {
      try {
          const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'renameSession', chatId, title: newTitle }) });
          if (res.ok) fetchChatList();
      } catch (e) { console.error(t.renameFail); }
  };

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
          reasoning: msg.reasoning,
          // [新增] 加载历史评估
          evaluation: msg.evaluation,
          imageUrls: msg.imageUrls ? msg.imageUrls : (msg.imageUrl ? [msg.imageUrl] : []),
          role: msg.role,
          timestamp: msg.timestamp
        }));
        setMessages(historyMessages);
        setHasMessage(historyMessages.length > 0);
        setActiveChatId(chatId);
        setInputText('');
        setSelectedImages([]);
        setStreamingMessageId(null);
      }
    } catch (e) { console.error(t.loadDetailFailed, e); } finally { setLoading(false); }
  };

  const handleNewSession = () => {
    setMessages([]);
    setHasMessage(false);
    setInputText('');
    setSelectedImages([]);
    setWaitingForAI(false);
    setStreamingMessageId(null);
    setIsSearchEnabled(false);
    setIsThinkingEnabled(false);
    setIsTestModeEnabled(false);
    setActiveChatId(null);
  };

  const appendErrorMessage = (text: string) => {
      setMessages(prev => [ ...prev, { id: `error-${Date.now()}`, content: `⚠️ **${t.error}**: ${text}`, role: 'assistant', timestamp: Date.now() } ]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedImages.length + files.length > 4) { alert(t.maxImageWarning); return; }
    files.forEach(file => {
      if (!['image/jpeg', 'image/png'].includes(file.type)) return;
      const reader = new FileReader();
      reader.onload = (e) => { const result = e.target?.result as string; if (result) setSelectedImages(prev => [...prev, result]); };
      reader.readAsDataURL(file);
    });
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (indexToRemove: number) => { setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove)); };

  const sendToLLM = async() => {
    if(loading || (!inputText.trim() && selectedImages.length === 0)) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      imageUrls: selectedImages.length > 0 ? [...selectedImages] : undefined,
      role: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setHasMessage(true);

    const messageToSend = inputText;
    const imagesToSend = selectedImages;
    const useSearch = isSearchEnabled;
    const useThinking = isThinkingEnabled;
    const useTestMode = isTestModeEnabled;
    const currentChatId = activeChatId;
    const currentLang = language;

    setInputText('');
    setSelectedImages([]);
    setLoading(true);
    setWaitingForAI(true);
    setStreamingMessageId(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          images: imagesToSend,
          useSearch: useSearch,
          enableThinking: useThinking,
          enableTestMode: useTestMode,
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
      let fullEvaluation = '';
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
              const evaluationChunk = delta?.evaluation_content || '';

              if (contentChunk || reasoningChunk || evaluationChunk) {
                fullContent += contentChunk;
                fullReasoning += reasoningChunk;
                fullEvaluation += evaluationChunk;

                if (!tempStreamingId) {
                  const aiMessage: Message = {
                    id: `streaming-${Date.now()}`,
                    content: fullContent,
                    reasoning: fullReasoning,
                    evaluation: fullEvaluation, // [新增]
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
                        ? { ...msg, content: fullContent, reasoning: fullReasoning, evaluation: fullEvaluation } // [新增] 更新 evaluation
                        : msg
                  ));
                }
              }
            } catch (e) { /* 忽略 */ }
          }
        }
      }

      if (!fullContent && !tempStreamingId) throw new Error(t.aiNoResponse);

      const finalChatId = newChatId || activeChatId;
      if (finalChatId && fullContent) {
        // [TODO] 如果后端支持存 evaluation，也应该发过去。目前后端 saveAiMessage 只存 content。
        // 这里只是 UI 上的展示。
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
                    {message.role === 'user' && message.imageUrls && message.imageUrls.length > 0 && (
                      <div className="message-images-grid">
                        {message.imageUrls.map((imgUrl, index) => (
                          <img key={index} src={imgUrl} alt={`Upload ${index}`} className="message-image" />
                        ))}
                      </div>
                    )}

                    {message.role === 'assistant' ? (
                        <div>
                          {/* 深度思考区块 */}
                          {message.reasoning && (
                            <div className="reasoning-block">
                                <div className="reasoning-header">
                                    <span className="reasoning-icon">💭</span>{t.deepThink}...
                                </div>
                                <div className="reasoning-content">
                                    <ReactMarkdown>{message.reasoning}</ReactMarkdown>
                                </div>
                            </div>
                          )}

                          {/* 正文回复 */}
                          <div className="main-response">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>

                          {/* 评估区块 */}
                          {message.evaluation && (
                            <div className="evaluation-block">
                                <div className="evaluation-header">
                                    <span className="reasoning-icon">⚖️</span>
                                    {t.evaluationTitle}
                                </div>
                                <div className="evaluation-content">
                                    <ReactMarkdown>{message.evaluation}</ReactMarkdown>
                                </div>
                            </div>
                          )}
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
                    <div style={{fontSize: '12px', color: '#999', marginTop: '5px'}}>
                        {/* 状态提示优先级 */}
                        {isThinkingEnabled ? t.thinking : (isTestModeEnabled ? t.evaluating : (isSearchEnabled ? t.searching : ""))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {!hasMessage && <p className='greet-text'>{t.greet}</p>}

          <div className='input-container'>
            {selectedImages.length > 0 && (
              <div className="image-preview-container">
                {selectedImages.map((img, index) => (
                  <div key={index} className="preview-wrapper">
                    <img src={img} alt={`Preview ${index}`} className="preview-image" />
                    <button className="close-preview-btn" onClick={() => removeImage(index)}><CloseIcon /></button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              className={`text-section ${selectedImages.length > 0 ? 'has-image' : ''}`}
              placeholder={t.placeholder}
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToLLM(); } }}
            />
            <div className='button-items'>
              <div className="feature-buttons">
                  <button type="button" className={`deepthink-button ${isThinkingEnabled ? 'active' : ''}`} onClick={() => setIsThinkingEnabled(!isThinkingEnabled)} disabled={loading} title={isThinkingEnabled ? "点击关闭" : "点击开启"}>{t.deepThink}</button>
                  <button type="button" className={`deepthink-button ${isSearchEnabled ? 'active' : ''}`} onClick={() => setIsSearchEnabled(!isSearchEnabled)} disabled={loading}>{t.webSearch}</button>

                  {/* 图片按钮 */}
                  <input type="file" accept=".jpg,.jpeg,.png" ref={fileInputRef} style={{display: 'none'}} onChange={handleImageSelect} multiple />
                  <button type="button" className="deepthink-button image-upload-button" onClick={() => fileInputRef.current?.click()} disabled={loading} title={t.imageSelect}><ImageIcon /></button>

                  {/* 测试模式按钮 (仅当代码常量开启时显示) */}
                  {IS_TEST_MODE_AVAILABLE && (
                      <button
                        type="button"
                        className={`deepthink-button image-upload-button ${isTestModeEnabled ? 'active' : ''}`}
                        onClick={() => setIsTestModeEnabled(!isTestModeEnabled)}
                        disabled={loading}
                        title={t.testMode}
                        style={{ marginLeft: '4px' }}
                      >
                        <FlaskIcon />
                      </button>
                  )}
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
