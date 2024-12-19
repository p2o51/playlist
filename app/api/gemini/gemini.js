import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

class GeminiHelper {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * 将图像文件转换为 Gemini API 可接受的 base64 格式
     * @param {string} filePath - 图像文件路径
     * @param {string} [mimeType] - 图像 MIME 类型，可选
     * @returns {Object} Gemini API 兼容的图像数据对象
     */
    fileToGenerativePart(filePath, mimeType) {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`Image file not found: ${filePath}`);
        }

        // 自动检测 MIME 类型
        if (!mimeType) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            mimeType = mimeTypes[ext] || 'application/octet-stream';
        }

        return {
            inlineData: {
                data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
                mimeType,
            },
        };
    }

    /**
     * 批量转换多个图像文件
     * @param {string[]} filePaths - 图像文件路径数组
     * @returns {Object[]} Gemini API 兼容的图像数据对象数组
     */
    multipleFilesToGenerativeParts(filePaths) {
        return filePaths.map(filePath => this.fileToGenerativePart(filePath));
    }

    /**
     * 使用 Gemini 模型生成内容
     * @param {string} prompt - 文本提示
     * @param {string|string[]} [imagePaths] - 可选的图像路径
     * @param {string} [model='gemini-1.5-flash'] - 使用的模型
     * @returns {Promise<string>} 生成的内容
     */
    async generateContent(prompt, imagePaths, model = 'gemini-1.5-flash') {
        const generativeModel = this.genAI.getGenerativeModel({ model });

        // 准备输入内容
        const inputs = [prompt];
        
        // 如果提供了图像，转换并添加
        if (imagePaths) {
            const imageParts = Array.isArray(imagePaths)
                ? this.multipleFilesToGenerativeParts(imagePaths)
                : [this.fileToGenerativePart(imagePaths)];
            
            inputs.push(...imageParts);
        }

        try {
            const result = await generativeModel.generateContent(inputs);
            return result.response.text();
        } catch (error) {
            console.error("Error generating content:", error);
            throw error;
        }
    }
}

export default GeminiHelper;