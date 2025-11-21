import { useEffect, useState } from 'react';
import './app.css';
import { timeStamp } from 'console';

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

  // 保存历史消息到 sessionStorage
  const saveMessage = (newMessages: Message[]) => {
    setMessages(newMessages);
    sessionStorage.setItem('chatMessages', JSON.stringify(newMessages));
  }

  // 从 sessionStorage 加载历史消息
  useEffect(() => {
    const savedMessages =  sessionStorage.getItem("chatMessages");
    if(savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      setMessages(parsedMessages);
      setHasMessage(parsedMessages.length > 0);
    }
  })

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
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend
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

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: Date.now()
      };

      const messageWithAI = [...updatedMessages, aiMessage];
      saveMessage(messageWithAI);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码数据块
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 'data: ' 前缀

            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';

              if (content) {
                fullContent += content;

                const updatedAIMessages = [...updatedMessages, {
                  ...aiMessage,
                  content: fullContent
                }];
                saveMessage(updatedAIMessages);
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一个数据块
            }
          }
        }
      }
      console.log('完整回复:', fullContent);

    } catch (error) {
      console.error('请求错误:', error);

      const errorMessages = [...messages, userMessage, {
        id: (Date.now() + 1).toString(),
        content: '请求失败，请稍后重试',
        role: 'assistant',
        timestamp: Date.now()
      }];
    } finally {
      setLoading(false);
    }
  }


  return(
      <div className="container">
        <div className='sidebar-container'>

        </div>
        <div className={hasMessage ? 'has-message' : 'no-message'}>
          {hasMessage && (
            <div className="messages-container">
              {
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.role}-message`}
                  >
                    <div className="message-content">
                      {message.content.split('\n').map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          )}



          {!hasMessage && (
            <p className='greet-text'>你好，欢迎使用任务助手</p>
          )}
          <div className='input-container'>
            <textarea
              className= 'text-section'
              placeholder="请输入消息"
              value={inputText}
              disabled={loading}
              onChange={(e) => setInputText(e.target.value)}
            >
            </textarea>
            <div className='button-items'>
              <button className='deepthink-button'>深度思考</button>
              <button
                className='send-button'
                onClick={sendToLLM}
                disabled={loading || !inputText.trim()}
              >
                {loading ? '发送中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>
  )

};

export default Index;
