import connectToDatabase from '../../../src/lib/db';
import Conversation from '../../../src/models/conversation';

// ==================================================================================
// [恢复] 豆包 API 配置 (用于 Critic/评估模型)
// ==================================================================================
const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = '';
const DOUBAO_MODEL = 'doubao-seed-1-6-lite-251015';

// ==================================================================================
// 阿里云 Qwen (DashScope) 配置 (用于 Actor/生成模型)
// ==================================================================================
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


// 评估专用的 System Prompt
const CRITIC_PROMPT_ZH = `# 角色:
你是一名严谨的“事实核查员”和“逻辑校验官”。

## 任务:
你的任务是评估另一个AI模型对用户问题的回答是否准确、逻辑是否自洽。

## 输入格式:
用户问题: [Question]
模型回答: [Answer]

## 要求:
1. **准确性核查**: 检查回答中是否有明显的事实错误。
2. **逻辑性核查**: 检查推导过程是否合理。
3. **输出风格**: 直接给出简短的评语。如果是正确的，给予肯定；如果有错误，请指出具体错误点。不要重新回答问题，只做点评。
4. **格式**: 开头先给出一个评分(0-10分)，然后进行简评。`;

const CRITIC_PROMPT_EN = `# Role:
You are a strict "Fact Checker" and "Logic Validator".

## Task:
Evaluate the accuracy and logical consistency of another AI model's answer to a user's question.

## Requirements:
1. Check for factual errors.
2. Check for logical fallacies.
3. Provide a concise critique. Start with a score (0-10), then explain. Do not re-answer the question, just critique.`;

// 生成标题
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

    // 1. DB 连接
    try { await connectToDatabase(); } catch (e) { return { code: 500, error: "Database connection failed" }; }

    // 2. CRUD Actions
    if (data.action === 'getHistory') { /*...*/ const list = await Conversation.find({ userId: 'user-1' }).sort({ updatedAt: -1 }).select('title updatedAt'); return { code: 200, data: list }; }
    if (data.action === 'getConversation') { /*...*/ const conv = await Conversation.findById(data.chatId); return { code: 200, data: conv }; }
    if (data.action === 'deleteSession') { /*...*/ await Conversation.findByIdAndDelete(data.chatId); return { code: 200, msg: 'Deleted' }; }
    if (data.action === 'renameSession') { /*...*/ await Conversation.findByIdAndUpdate(data.chatId, { title: data.title }); return { code: 200, msg: 'Renamed' }; }
    if (data.action === 'saveAiMessage') {
        try {
            await Conversation.findByIdAndUpdate(data.chatId, {
                $push: {
                    messages: {
                        role: 'assistant',
                        content: data.content,
                        reasoning: data.reasoning || '',
                        evaluation: data.evaluation || '',
                        timestamp: Date.now()
                    }
                }
            });
            return { code: 200, msg: 'Saved' };
        } catch (e) { return { code: 500, error: 'Save failed' }; }
    }

    // 3. 核心聊天逻辑
    try {
        const { message, useSearch, chatId, language = 'zh', enableThinking = false, images = [], enableTestMode = false } = data;

        let currentConversation;
        let finalSystemPrompt = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;

        // 数据库操作：保存用户消息 (包含图片)
        const userMessagePayload = {
            role: 'user',
            content: message || (images.length > 0 ? '[图片]' : ''), // 确保 content 不为空
            imageUrls: images,
            timestamp: Date.now()
        };

        if (chatId) {
            currentConversation = await Conversation.findById(chatId);
            if (currentConversation) {
                currentConversation.messages.push(userMessagePayload);
                currentConversation.updatedAt = new Date();
                await currentConversation.save();
            }
        }

        if (!currentConversation) {
            currentConversation = await Conversation.create({
                userId: 'user-1',
                title: generateTitle(message),
                messages: [userMessagePayload]
            });
        }

        // 联网搜索
        if (useSearch && message) {
            const searchResults = await searchWeb(message);
            if (searchResults) {
                finalSystemPrompt += (language === 'en' ? `\n\nWeb Search Results:\n${searchResults}` : `\n\n联网搜索资料:\n${searchResults}`);
            }
        }

        // 构造 DashScope (Qwen) 请求
        console.log(`Step 1: 请求 Qwen (Thinking: ${enableThinking}, TestMode: ${enableTestMode})...`);

        const userContent: any[] = [];
        if (images && images.length > 0) {
            images.forEach((img: string) => userContent.push({ type: "image_url", image_url: { url: img } }));
        }
        if (message) {
            userContent.push({ type: "text", text: message });
        } else if (images.length > 0) {
            userContent.push({ type: "text", text: language === 'en' ? "Analyze images" : "请分析图片" });
        }

        const requestBody: any = {
            model: "qwen3-vl-plus",
            messages: [
                { role: 'system', content: finalSystemPrompt },
                { role: 'user', content: userContent }
            ],
            stream: true
        };

        if (enableThinking) {
            requestBody['enable_thinking'] = true;
            requestBody['thinking_budget'] = 16384;
        }

        const qwenResponse = await fetch(DASHSCOPE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DASHSCOPE_API_KEY}` },
            body: JSON.stringify(requestBody),
        });

        if (!qwenResponse.ok) throw new Error(`Qwen API Error: ${qwenResponse.status}`);

        // 流式编排
        return new Response(
            new ReadableStream({
                async start(controller) {
                    const reader = qwenResponse.body?.getReader();
                    const decoder = new TextDecoder();
                    let fullAnswerContent = ""; // 用于缓存千问的完整回答

                    if (!reader) { controller.close(); return; }

                    try {
                        // 1. 处理千问流
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            // 转发给前端
                            controller.enqueue(value);

                            // 如果开启了测试模式，需要在后端累积回答内容
                            if (enableTestMode) {
                                const chunkStr = decoder.decode(value, { stream: true });
                                const lines = chunkStr.split('\n');
                                for (const line of lines) {
                                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                        try {
                                            const json = JSON.parse(line.slice(6));
                                            const content = json.choices[0]?.delta?.content || "";
                                            fullAnswerContent += content;
                                        } catch (e) { }
                                    }
                                }
                            }
                        }

                        // 2. 如果开启测试模式，调用豆包进行评估
                        if (enableTestMode && fullAnswerContent.trim()) {
                            console.log("Step 2: Qwen 完成，请求豆包评估...");

                            const criticPrompt = language === 'en' ? CRITIC_PROMPT_EN : CRITIC_PROMPT_ZH;
                            const userQueryText = message || "[图片分析]";
                            const evalInput = `用户问题: ${userQueryText}\n模型回答: ${fullAnswerContent}`;

                            const doubaoResponse = await fetch(DOUBAO_API_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${DOUBAO_API_KEY}`,
                                },
                                body: JSON.stringify({
                                    model: DOUBAO_MODEL,
                                    messages: [
                                        { role: 'system', content: criticPrompt },
                                        { role: 'user', content: evalInput }
                                    ],
                                    stream: true
                                }),
                            });

                            if (doubaoResponse.ok && doubaoResponse.body) {
                                const dbReader = doubaoResponse.body.getReader();
                                const dbDecoder = new TextDecoder();

                                while (true) {
                                    const { done, value } = await dbReader.read();
                                    if (done) break;

                                    const chunkStr = dbDecoder.decode(value, { stream: true });
                                    const lines = chunkStr.split('\n');

                                    for (const line of lines) {
                                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                            try {
                                                const json = JSON.parse(line.slice(6));
                                                const content = json.choices[0]?.delta?.content || "";
                                                if (content) {
                                                    // 构造伪造的 SSE 数据包，使用 evaluation_content 字段
                                                    // 前端会监听这个字段并渲染到评估区域
                                                    const customPacket = {
                                                        choices: [{
                                                            delta: { evaluation_content: content }
                                                        }]
                                                    };
                                                    const sseString = `data: ${JSON.stringify(customPacket)}\n\n`;
                                                    controller.enqueue(new TextEncoder().encode(sseString));
                                                }
                                            } catch (e) { }
                                        }
                                    }
                                }
                            } else {
                                console.error("Doubao API Error");
                            }
                        }

                        // 结束流
                        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));

                    } catch (error) {
                        console.error('Stream Error:', error);
                    } finally {
                        controller.close();
                        reader.releaseLock();
                    }
                }
            }),
            {
                headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked', 'x-chat-id': currentConversation._id.toString() },
            }
        );

    } catch (error: any) {
        console.error('❌ Global Error:', error);
        return { code: 500, data: { reply: `Server Error: ${error.message}` } };
    }
};
