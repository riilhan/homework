// 豆包 API 配置
const DOUBAO_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = '';

// Tavily API 配置
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = '';

// 系统提示词
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

/**
 * 封装 Tavily 搜索工具
 */
async function searchWeb(query: string) {
    try {
        const response = await fetch(TAVILY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic", // 或 "advanced"
                include_answer: false,
                max_results: 5
            })
        });

        if (!response.ok) {
            console.error('Tavily 搜索请求失败');
            return '';
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) return '';

        // 格式化搜索结果
        const formattedResults = results.map((item: any, index: number) =>
            `[${index + 1}] 标题: ${item.title}\n内容: ${item.content}\n链接: ${item.url}`
        ).join('\n\n');

        return formattedResults;
    } catch (error) {
        console.error('Tavily 搜索出错:', error);
        return '';
    }
}

export const post = async ({ data }: { data: { message: string, useSearch?: boolean } }) => {
    try {
        let finalSystemPrompt = SYSTEM_PROMPT;

        // 如果开启了联网搜索，先搜索
        if (data.useSearch) {
            const searchResults = await searchWeb(data.message);

            if (searchResults) {
                finalSystemPrompt += `\n\n## 联网搜索参考资料:\n以下是根据用户问题获取的最新网络信息，请参考这些信息进行回答：\n\n${searchResults}`;
            }
        }

        const response = await fetch(DOUBAO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DOUBAO_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'doubao-seed-1-6-lite-251015',
                messages: [
                {
                    role: 'system',
                    content: [
                    {
                        type: 'text',
                        text: finalSystemPrompt
                    }
                    ]
                },
                {
                    role: 'user',
                    content: [
                    {
                        type: 'text',
                        text: data.message
                    }
                    ]
                }
                ],
                stream: true
            }),
        });

        if (!response.ok) {
            throw new Error(`豆包API请求失败: ${response.status}`);
        }

        // 返回流式响应
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

                        // 将接收到的数据转发给前端
                        controller.enqueue(value);
                        }
                    } catch (error) {
                        console.error('流式读取错误:', error);
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
                },
            }
        );
    } catch (error) {
        console.error('BFF接口错误:', error);
        return {
            code: 500,
            data: {
                reply: '服务暂时不可用，请稍后重试。'
            }
        };
    }
};
