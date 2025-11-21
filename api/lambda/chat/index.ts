import connectToDatabase from '../../../src/lib/db';
import Conversation from '../../../src/models/conversation';

// 豆包 API 配置
const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = '';

// Tavily API 配置
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = '';

const SYSTEM_PROMPT = `# 角色:
你是一名专业的教练，擅长根据用户的兴趣设定目标并提供指导。

## 目标:
- 根据用户输入的兴趣，帮助用户设定清晰且可行的方案目标。
- 在用户日常对话或提问时，提供简单且切实可行的回答。
- 如果提供了联网搜索结果，请优先参考搜索结果中的信息来回答，确保时效性和准确性。

## 技能:
- 分析用户兴趣并提取关键点。
- 制定适合用户需求的方案目标。
- 提供清晰、简洁且实用的建议。
- 可以使用联网搜索工具，获取更多的信息。

## 工作流程:
1. **理解用户兴趣**：
    - 分析用户输入的兴趣点，识别主要需求和目标。
    - 根据用户兴趣的范围和深度，确定适合的目标类型。
2. **设定方案目标**：
    - 根据用户兴趣，提供可操作性强、具体且符合用户背景的目标设定。
    - 确保目标具有明确的时间框架和可衡量的标准。
3. **回答用户问题**：
    - 在日常对话或用户提问时，提供针对性强的回答。
    - 回答需简单明了，并且能切实帮助用户实现目标。
4. **持续调整与优化**：
    - 根据用户的反馈，调整目标和建议以更好地满足用户需求。
    - 提供鼓励和指导，帮助用户保持动力。

## 约束:
- 必须根据用户输入的兴趣设定目标，不能随意设定与用户兴趣无关的目标。
- 回答必须简单且可行，不能提供复杂或难以执行的建议。
- 目标设定需具体且具有可衡量性，避免模糊不清。

## 输出格式:
- **目标设定**：以清晰的文字描述用户的方案目标，包含时间框架和衡量标准。
- **回答**：针对用户的具体问题，提供简洁实用的建议。
- **文字风格**：友好、鼓励、清晰。`;

// 生成会话列表标题
function generateTitle(message: string) {
    return message.slice(0, 15) + (message.length > 15 ? '...' : '');
}

// 搜索工具
async function searchWeb(query: string) {
    console.log(`正在执行搜索: ${query}`);
    try {
        const response = await fetch(TAVILY_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: false,
                max_results: 5
            })
        });
        if (!response.ok) {
            console.error(`搜索API响应错误: ${response.status}`);
            return '';
        }
        const data = await response.json();
        console.log(`搜索成功，结果数量: ${data.results?.length || 0}`);
        return (data.results || []).map((item: any, i: number) =>
            `[${i+1}] ${item.title}: ${item.content}`
        ).join('\n\n');
    } catch (error) {
        console.error('搜索抛出异常:', error);
        return '';
    }
}

export const post = async ({ data }: { data: any }) => {
    console.log('==========收到请求 ==========');
    console.log('请求参数:', JSON.stringify(data, null, 2));

    // 1. 尝试连接数据库
    try {
        console.log('正在连接数据库...');
        await connectToDatabase();
        console.log('数据库连接成功');
    } catch (e) {
        console.error("❌ 数据库连接失败:", e);
        return { code: 500, error: "Database connection failed" };
    }

    try {
        await connectToDatabase();
    } catch (e) {
        return { code: 500, error: "Database connection failed" };
    }
    // 2. 处理不同 Action
    // A. 获取历史列表
    if (data.action === 'getHistory') {
        console.log('Action: getHistory');
        const list = await Conversation.find({ userId: 'user-1' }).sort({ updatedAt: -1 }).select('title updatedAt');
        console.log(`找到 ${list.length} 条历史会话`);
        return { code: 200, data: list };
    }

    // B. 获取详情
    if (data.action === 'getConversation') {
        console.log(`[Backend] Action: getConversation, ID: ${data.chatId}`);
        const conv = await Conversation.findById(data.chatId);
        return { code: 200, data: conv };
    }

    // C. 保存 AI 消息
    if (data.action === 'saveAiMessage') {
        console.log(`[Backend] Action: saveAiMessage, ID: ${data.chatId}`);
        try {
            await Conversation.findByIdAndUpdate(data.chatId, {
                $push: { messages: { role: 'assistant', content: data.content, timestamp: Date.now() } }
            });
            console.log('[Backend] AI消息保存成功');
            return { code: 200, msg: 'Saved' };
        } catch (e) {
            console.error('[Backend] 保存AI消息失败:', e);
            return { code: 500, error: 'Save failed' };
        }
    }

        // === 新增: 删除会话 ===
    if (data.action === 'deleteSession') {
        try {
            await Conversation.findByIdAndDelete(data.chatId);
            return { code: 200, msg: 'Deleted' };
        } catch (e) {
            return { code: 500, error: '删除失败' };
        }
    }

    // === 新增: 重命名会话 ===
    if (data.action === 'renameSession') {
        try {
            await Conversation.findByIdAndUpdate(data.chatId, { title: data.title });
            return { code: 200, msg: 'Renamed' };
        } catch (e) {
            return { code: 500, error: '重命名失败' };
        }
    }

    // 3. 核心聊天逻辑
    try {
        console.log('进入聊天逻辑...');
        const { message, useSearch, chatId } = data;
        let currentConversation;
        let finalSystemPrompt = SYSTEM_PROMPT;

        // --- 数据库操作：保存用户消息 ---
        if (chatId) {
            console.log(`更新已有会话: ${chatId}`);
            currentConversation = await Conversation.findById(chatId);
            if (currentConversation) {
                currentConversation.messages.push({ role: 'user', content: message, timestamp: Date.now() });
                currentConversation.updatedAt = new Date();
                await currentConversation.save();
                console.log('用户消息已追加');
            } else {
                console.warn('未找到指定ID的会话，将新建');
            }
        }

        if (!currentConversation) {
            console.log('创建新会话');
            currentConversation = await Conversation.create({
                userId: 'user-1',
                title: generateTitle(message),
                messages: [{ role: 'user', content: message, timestamp: Date.now() }]
            });
            console.log(`新会话创建成功 ID: ${currentConversation._id}`);
        }

        // --- 联网搜索 ---
        if (useSearch) {
            const searchResults = await searchWeb(message);
            if (searchResults) {
                finalSystemPrompt += `\n\n联网搜索资料:\n${searchResults}`;
            }
        }

        // --- 调用 LLM ---
        console.log('正在请求豆包 API...');
        const response = await fetch(DOUBAO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DOUBAO_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'doubao-seed-1-6-lite-251015',
                messages: [
                    { role: 'system', content: [{ type: 'text', text: finalSystemPrompt }] },
                    { role: 'user', content: [{ type: 'text', text: message }] }
                ],
                stream: true
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`豆包API错误: ${response.status} - ${errText}`);
            throw new Error(`豆包API请求失败: ${response.status}`);
        }

        console.log('豆包API请求成功，准备流式返回');

        // --- 返回流 ---
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const reader = response.body?.getReader();
                    if (!reader) {
                        controller.close();
                        return;
                    }
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            controller.enqueue(value);
                        }
                        console.log('流传输完成');
                    } catch (error) {
                        console.error('流读取错误:', error);
                    } finally {
                        controller.close();
                        reader.releaseLock();
                    }
                }
            }),
            {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked',
                    'x-chat-id': currentConversation._id.toString()
                },
            }
        );

    } catch (error: any) {
        console.error('❌ 全局错误捕获:', error);
        return {
            code: 500,
            data: { reply: `服务端错误: ${error.message}` }
        };
    }
};
