import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './app.css';
import Sidebar from '../components/Sidebar';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

const Index = () => {
  const [hasMessage, setHasMessage] = useState(false)
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [language, setLanguage] = useState('中文')
  const [waitingForAI, setWaitingForAI] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [isSearchEnabled, setIsSearchEnabled] = useState(false)

  // 保存历史消息到 sessionStorage
  const saveMessage = (newMessages: Message[]) => {
    setMessages(newMessages);
    sessionStorage.setItem('chatMessages', JSON.stringify(newMessages));
  }

  // 从 sessionStorage 加载历史消息
  useEffect(() => {
    const savedMessages = sessionStorage.getItem("chatMessages");
    if(savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      setMessages(parsedMessages);
      setHasMessage(parsedMessages.length > 0);
    }
  }, [])

  // 创建新会话
  const handleNewSession = () => {
    setMessages([]);
    setHasMessage(false);
    setInputText('');
    setWaitingForAI(false);
    setStreamingMessageId(null);
    setIsSearchEnabled(false);
    sessionStorage.removeItem('chatMessages');
  }

  // 切换语言
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    console.log('切换到语言:', newLanguage);
    // 还没写完
  }

  const sendToLLM = async() => {
    if(!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    saveMessage(updatedMessages);
    setHasMessage(true);

    const messageToSend = inputText;
    // 捕获发送时的搜索状态，防止发送后用户点击开关导致逻辑混乱
    const useSearch = isSearchEnabled;

    setInputText('');
    setLoading(true);
    setWaitingForAI(true);
    setStreamingMessageId(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          useSearch: useSearch // 传递搜索标志给后端
        }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('响应体不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';

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

                // 如果是第一次收到内容，创建AI消息并停止等待动画
                if (fullContent && !streamingMessageId) {
                  const aiMessage: Message = {
                    id: `streaming-${Date.now()}`,
                    content: fullContent,
                    role: 'assistant',
                    timestamp: Date.now()
                  };
                  setStreamingMessageId(aiMessage.id);
                  setWaitingForAI(false);
                  const messageWithAI = [...updatedMessages, aiMessage];
                  saveMessage(messageWithAI);
                } else if (streamingMessageId) {
                  // 更新现有的流式消息
                  const updatedAIMessages = updatedMessages.map(msg =>
                    msg.id === streamingMessageId
                      ? { ...msg, content: fullContent }
                      : msg
                  );
                  saveMessage(updatedAIMessages);
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      console.log('完整回复:', fullContent);

    } catch (error) {
      console.error('请求错误:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '请求失败，请稍后重试',
        role: 'assistant',
        timestamp: Date.now()
      };
      saveMessage([...updatedMessages, errorMessage]);
      setWaitingForAI(false);
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
    }
  }

  return(
    <div className="container">
      <div className='sidebar-container'>
        <Sidebar
          onNewSession={handleNewSession}
          onLanguageChange={handleLanguageChange}
        />
      </div>

      <div className="main-content">
        <div className={hasMessage ? 'has-message' : 'no-message'}>
          {hasMessage && (
            <div className="messages-container">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.role}-message`}
                >
                  <div className="message-content">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      message.content.split('\n').map((line, index) => (
                        <p key={`${message.id}-${index}`}>{line}</p>
                      ))
                    )}
                  </div>
                </div>
              ))}

              {waitingForAI && !streamingMessageId && (
                <div className="message assistant-message">
                  <div className="message-content">
                    <div className="typing-animation">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    {isSearchEnabled && <div style={{fontSize: '12px', color: '#999', marginTop: '5px'}}>正在联网搜索...</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasMessage && (
            <p className='greet-text'>你好，欢迎使用任务助手</p>
          )}
          <div className='input-container'>
            <textarea
              className='text-section'
              placeholder="请输入消息"
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className='button-items'>
              <div className="feature-buttons">
                  <button type="button" className='deepthink-button'>深度思考</button>
                  <button
                    type="button"
                    className={`deepthink-button ${isSearchEnabled ? 'active' : ''}`}
                    onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                  >
                    联网搜索
                  </button>
              </div>
              <button
                type="button"
                className='send-button'
                onClick={sendToLLM}
                disabled={loading}
              >
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};

export default Index;
