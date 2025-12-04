import connectToDatabase from '../../../src/lib/db';
import Conversation from '../../../src/models/conversation';

// ==================================================================================
// 豆包 API 配置
// ==================================================================================
// const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// const DOUBAO_API_KEY = 'YOUR_DOUBAO_KEY';

// ==================================================================================
// 阿里云 Qwen (DashScope) 配置
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
- **[新增能力] 视觉分析**：你可以接收用户上传的图片（可能有多张），识别图片内容并结合用户问题进行分析回答。

## 工作流程:
1. **理解用户输入**：
    - 分析用户输入的文本和图片内容。
    - 识别主要需求和目标。
2. **设定方案目标**：
    - 根据用户兴趣，提供可操作性强、具体且符合用户背景的目标设定。
3. **回答用户问题**：
    - 结合图片和文本提供针对性回答。
4. **持续调整与优化**：
    - 提供鼓励和指导，帮助用户保持动力。

## 约束:
- 回答必须简单且可行。
- 目标设定需具体且具有可衡量性。

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
- **[New Skill] Vision Analysis**: You can accept multiple images uploaded by users, recognize the content, and answer based on the images.

## Constraints:
- Answers must be simple and feasible.

## Output Format:
- **Tone**: Friendly, encouraging, clear.`;

// 生成会话列表标题
function generateTitle(message: string) {
    if (message && message.trim()) {
        return message.slice(0, 15) + (message.length > 15 ? '...' : '');
    }
    return '[图片会话]';
}

// 搜索工具
async function searchWeb(query: string) {
    if (!query) return '';
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
        if (!response.ok) return '';
        const data = await response.json();
        return (data.results || []).map((item: any, i: number) =>
            `[${i+1}] ${item.title}: ${item.content}`
        ).join('\n\n');
    } catch (error) {
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

    // 2. 处理不同 Action
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
        } catch (e) { return { code: 500, error: 'Save failed' }; }
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
        // 接收 images 数组，默认为空
        const { message, useSearch, chatId, language = 'zh', enableThinking = false, images = [] } = data;

        let currentConversation;
        let finalSystemPrompt = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;

        // --- 数据库操作：保存用户消息 ---
        // 为了在历史记录中区分，如果有多张图片，存一个简单的标记
        const userContentToSave = (images.length > 0)
            ? `${message || ''} [发送了 ${images.length} 张图片]`
            : message;

        if (chatId) {
            currentConversation = await Conversation.findById(chatId);
            if (currentConversation) {
                currentConversation.messages.push({
                    role: 'user',
                    content: userContentToSave,
                    timestamp: Date.now()
                });
                currentConversation.updatedAt = new Date();
                await currentConversation.save();
            }
        }

        if (!currentConversation) {
            currentConversation = await Conversation.create({
                userId: 'user-1',
                title: generateTitle(message),
                messages: [{ role: 'user', content: userContentToSave, timestamp: Date.now() }]
            });
        }

        // 联网搜索逻辑 (仅当有文本时搜索)
        if (useSearch && message) {
            const searchResults = await searchWeb(message);
            if (searchResults) {
                const searchPrompt = language === 'en'
                    ? `\n\nWeb Search Results:\n${searchResults}`
                    : `\n\n联网搜索资料:\n${searchResults}`;
                finalSystemPrompt += searchPrompt;
            }
        }

        // ==================================================================================
        // Qwen (DashScope) API 调用
        // ==================================================================================
        console.log(`请求 DashScope (Model: qwen3-vl-plus, Thinking: ${enableThinking}, Images Count: ${images.length})...`);

        const userContent: any[] = [];

        // 遍历图片数组，构造多个 image_url 对象
        // 注意：qwen3-vl-plus 支持多图输入
        if (images && images.length > 0) {
            images.forEach((imgBase64: string) => {
                userContent.push({
                    type: "image_url",
                    image_url: { url: imgBase64 }
                });
            });
        }

        // 添加文本
        if (message) {
            userContent.push({ type: "text", text: message });
        } else if (images.length > 0 && userContent.length === images.length) {
            // 如果只有图片没有文字，给一个默认提示，防止 API 报错
            userContent.push({ type: "text", text: language === 'en' ? "Please analyze these images." : "请分析这些图片的内容。" });
        }

        const messagesPayload = [
            {
                role: 'system',
                content: finalSystemPrompt
            },
            {
                role: 'user',
                content: userContent
            }
        ];

        // 构造请求体
        const requestBody: any = {
            model: "qwen3-vl-plus",
            messages: messagesPayload,
            stream: true
        };

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
