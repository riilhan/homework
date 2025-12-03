import connectToDatabase from '../../../src/lib/db';
import Conversation from '../../../src/models/conversation';

// ==================================================================================
// [旧配置] 豆包 API 配置 (已注释保留)
// ==================================================================================
// const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// const DOUBAO_API_KEY = 'YOUR_DOUBAO_KEY';

// ==================================================================================
// [新配置] 阿里云 Qwen (DashScope) 配置
// ==================================================================================
// 使用 OpenAI 兼容接口地址
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASHSCOPE_API_KEY = '';

// Tavily API 配置
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = '';

const SYSTEM_PROMPT_ZH = `# 角色:
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

// --- 英文提示词 ---
const SYSTEM_PROMPT_EN = `# Role:
You are a professional coach, skilled in setting goals based on user interests and providing guidance.

## Goals:
- Help users set clear and feasible plan goals based on their interests.
- Provide simple and practical answers during daily conversations or questions.
- If web search results are provided, prioritize referencing them to ensure timeliness and accuracy.
- **Please answer in English.**

## Skills:
- Analyze user interests and extract key points.
- Formulate plan goals suitable for user needs.
- Provide clear, concise, and practical advice.
- Use web search tools to obtain more information.

## Constraints:
- Must set goals based on user input; do not set unrelated goals.
- Answers must be simple and feasible.
- Goals must be specific and measurable.

## Output Format:
- **Goal Setting**: Describe the user's plan goal clearly, including timeframes and metrics.
- **Answer**: Provide concise and practical advice for specific questions.
- **Tone**: Friendly, encouraging, clear.`;

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

    // 1. 尝试连接数据库
    try {
        await connectToDatabase();
    } catch (e) {
        console.error("❌ 数据库连接失败:", e);
        return { code: 500, error: "Database connection failed" };
    }

    // 2. 处理不同 Action (CRUD 保持不变)
    if (data.action === 'getHistory') {
        try {
            const list = await Conversation.find({ userId: 'user-1' }).sort({ updatedAt: -1 }).select('title updatedAt');
            return { code: 200, data: list };
        } catch (e) { return { code: 500, error: 'Get history failed' }; }
    }

    if (data.action === 'getConversation') {
        try {
            const conv = await Conversation.findById(data.chatId);
            return { code: 200, data: conv };
        } catch (e) { return { code: 500, error: 'Get conversation failed' }; }
    }

    if (data.action === 'saveAiMessage') {
        try {
            await Conversation.findByIdAndUpdate(data.chatId, {
                $push: { messages: { role: 'assistant', content: data.content, timestamp: Date.now() } }
            });
            console.log('AI消息保存成功');
            return { code: 200, msg: 'Saved' };
        } catch (e) {
            console.error('保存AI消息失败:', e);
            return { code: 500, error: 'Save failed' };
        }
    }

    if (data.action === 'deleteSession') {
        try {
            await Conversation.findByIdAndDelete(data.chatId);
            return { code: 200, msg: 'Deleted' };
        } catch (e) { return { code: 500, error: '删除失败' }; }
    }

    if (data.action === 'renameSession') {
        try {
            await Conversation.findByIdAndUpdate(data.chatId, { title: data.title });
            return { code: 200, msg: 'Renamed' };
        } catch (e) { return { code: 500, error: '重命名失败' }; }
    }

    // 3. 核心聊天逻辑
    try {
        console.log('进入聊天逻辑...');
        const { message, useSearch, chatId, language = 'zh', enableThinking = false } = data;

        let currentConversation;
        let finalSystemPrompt = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;

        // --- 数据库操作：保存用户消息 ---
        if (chatId) {
            currentConversation = await Conversation.findById(chatId);
            if (currentConversation) {
                currentConversation.messages.push({ role: 'user', content: message, timestamp: Date.now() });
                currentConversation.updatedAt = new Date();
                await currentConversation.save();
            }
        }

        if (!currentConversation) {
            currentConversation = await Conversation.create({
                userId: 'user-1',
                title: generateTitle(message),
                messages: [{ role: 'user', content: message, timestamp: Date.now() }]
            });
        }

        // 联网搜索逻辑
        if (useSearch) {
            const searchResults = await searchWeb(message);
            if (searchResults) {
                const searchPrompt = language === 'en'
                    ? `\n\nWeb Search Results:\n${searchResults}`
                    : `\n\n联网搜索资料:\n${searchResults}`;
                finalSystemPrompt += searchPrompt;
            }
        }

        // ==================================================================================
        // 豆包 API 调用
        // ==================================================================================
        /*
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
        */

        // ==================================================================================
        // Qwen (DashScope) API 调用
        // ==================================================================================
        console.log(`请求 DashScope (Model: qwen3-vl-plus, Thinking: ${enableThinking})...`);

        const messagesPayload = [
            {
                role: 'system',
                content: finalSystemPrompt
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: message }
                    // 未来如果支持图片，可以在这里 push { type: 'image_url', ... }
                ]
            }
        ];

        // 构造请求体
        const requestBody: any = {
            model: "qwen3-vl-plus", // 指定 VL 模型
            messages: messagesPayload,
            stream: true
        };

        // 开启深度思考参数
        if (enableThinking) {
            requestBody['enable_thinking'] = true;
            requestBody['thinking_budget'] = 16384;
        }

        const response = await fetch(DASHSCOPE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`DashScope API错误: ${response.status} - ${errText}`);
            throw new Error(`API请求失败: ${response.status}`);
        }

        console.log('API请求成功，开始流式传输...');

        // 返回流
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
