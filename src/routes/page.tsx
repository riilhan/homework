import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './app.css';
import Sidebar from '../components/Sidebar';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

interface ChatSession {
  _id: string;
  title: string;
  updatedAt: string;
}

const Index = () => {
  const [hasMessage, setHasMessage] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatList, setChatList] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, waitingForAI]);

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
      console.error("加载列表失败", e);
    }
  };

  useEffect(() => { fetchChatList(); }, []);

  // 删除会话
  const handleDeleteSession = async (chatId: string) => {
      try {
          const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'deleteSession', chatId })
          });
          if (res.ok) {
              // 如果删除的是当前会话，重置界面
              if (chatId === activeChatId) handleNewSession();
              fetchChatList(); // 刷新列表
          }
      } catch (e) {
          alert('删除失败，请稍后重试');
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
          console.error('重命名失败');
      }
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
      console.error("加载详情失败", e);
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
    setActiveChatId(null);
  };

  // 添加错误消息
  const appendErrorMessage = (text: string) => {
      setMessages(prev => [
          ...prev,
          {
              id: `error-${Date.now()}`,
              content: `⚠️ **出错了**: ${text}`,
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
    const currentChatId = activeChatId;

    setInputText('');
    setLoading(true);
    setWaitingForAI(true); // 开启等待动画
    setStreamingMessageId(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          useSearch: useSearch,
          chatId: currentChatId
        }),
      });

      if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`服务器响应错误 (${response.status}): ${errorText}`);
      }

      const newChatId = response.headers.get('x-chat-id');
      if (newChatId && newChatId !== activeChatId) {
        setActiveChatId(newChatId);
        setTimeout(() => fetchChatList(), 500);
      }

      if (!response.body) throw new Error('响应体为空');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
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
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                if (!tempStreamingId) {
                  const aiMessage: Message = {
                    id: `streaming-${Date.now()}`,
                    content: fullContent,
                    role: 'assistant',
                    timestamp: Date.now()
                  };
                  tempStreamingId = aiMessage.id;
                  setStreamingMessageId(tempStreamingId);
                  setWaitingForAI(false); // 收到第一个字，关闭等待动画
                  setMessages(prev => [...prev, aiMessage]);
                } else {
                  setMessages(prev => prev.map(msg => msg.id === tempStreamingId ? { ...msg, content: fullContent } : msg));
                }
              }
            } catch (e) { /* 忽略解析错误 */ }
          }
        }
      }

      // 错误处理：如果流结束了还是没有任何内容
      if (!fullContent && !tempStreamingId) {
        throw new Error("AI 未返回任何内容");
      }

      const finalChatId = newChatId || activeChatId;
      if (finalChatId && fullContent) {
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'saveAiMessage', chatId: finalChatId, content: fullContent })
        }).catch(e => console.warn("后台保存消息失败", e)); // 保存失败不弹窗，静默处理
      }

    } catch (error: any) {
      console.error('请求流程出错:', error);
      // 立即在界面显示错误
      appendErrorMessage(error.message || "网络请求异常，请检查连接或重试。");
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
          onLanguageChange={() => {}}
          chatList={chatList}
          activeChatId={activeChatId}
          onSelectChat={loadChatSession}
          onDeleteSession={handleDeleteSession} // 传递删除
          onRenameSession={handleRenameSession} // 传递重命名
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
                          <ReactMarkdown>{message.content}</ReactMarkdown>
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
                    {isSearchEnabled && <div style={{fontSize: '12px', color: '#999', marginTop: '5px'}}>正在联网搜索...</div>}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {!hasMessage && <p className='greet-text'>你好，欢迎使用任务助手</p>}

          <div className='input-container'>
            <textarea
              className='text-section'
              placeholder="请输入消息..."
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToLLM(); } }}
            />
            <div className='button-items'>
              <div className="feature-buttons">
                  <button type="button" className='deepthink-button'>深度思考</button>
                  <button
                    type="button"
                    className={`deepthink-button ${isSearchEnabled ? 'active' : ''}`}
                    onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                  >联网搜索</button>
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
