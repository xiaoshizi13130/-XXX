
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for structured output
const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchantName: { type: Type.STRING, description: "商店或商家名称" },
    date: { type: Type.STRING, description: "购买日期，格式 YYYY-MM-DD。如果未找到，请使用今天的日期。" },
    totalAmount: { type: Type.NUMBER, description: "支付总金额" },
    currency: { type: Type.STRING, description: "货币代码 (使用 ISO 4217 标准，例如: CNY, USD, EUR, GBP, JPY)" },
    category: { 
      type: Type.STRING, 
      description: "费用类别 (例如: 餐饮, 交通, 住宿, 办公, 娱乐, 其他)" 
    },
    type: {
      type: Type.STRING,
      description: "单据类型 (例如: 发票, 收据, 火车票, 飞机票, 出租车票, 合同, 行程单, 其他)"
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "商品描述" },
          amount: { type: Type.NUMBER, description: "商品金额" }
        }
      }
    },
    confidence: { type: Type.NUMBER, description: "提取置信度 0.0 到 1.0" }
  },
  required: ["merchantName", "totalAmount", "date", "category", "type"],
};

export const extractReceiptData = async (fileDataUrl: string): Promise<ReceiptData> => {
  try {
    // Extract mimeType and base64 data from Data URL
    // Format: data:[<mediatype>][;base64],<data>
    let mimeType = "image/jpeg";
    let base64Data = fileDataUrl;

    if (fileDataUrl.startsWith("data:")) {
        const matches = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        } else {
            // Fallback if regex fails but starts with data:
            const parts = fileDataUrl.split(',');
            if (parts.length > 1) {
                base64Data = parts[1];
                // Try to extract mime from first part
                const mimeMatch = parts[0].match(/:(.*?);/);
                if (mimeMatch) {
                    mimeType = mimeMatch[1];
                }
            }
        }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: "作为专业的财务数据提取助手，请分析这张收据（图片或PDF）。\n\n关键要求：\n1. **单据类型识别**：请准确识别单据的物理/法律属性。将其归类为以下之一：'发票' (Invoice), '收据' (Receipt), '火车票' (Train Ticket), '飞机票' (Plane Ticket), '出租车票' (Taxi Ticket), '合同' (Contract), '行程单' (Itinerary) 或 '其他'。\n2. **货币识别**：这是最重要的。请优先将货币符号转换为标准的 ISO 4217 代码。例如：看到 '¥'、'元'、'CNY' 必须识别为 'CNY'；看到 '$' 识别为 'USD'。\n3. **金额与日期**：精确提取总金额（totalAmount）。日期必须标准化为 YYYY-MM-DD 格式。\n4. **明细**：尽可能提取单项商品明细。\n\n请以纯 JSON 格式输出。"
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const text = response.text;
    if (!text) throw new Error("Gemini 未返回响应");

    const data = JSON.parse(text) as ReceiptData;
    return data;

  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("无法处理收据文件，请确保文件清晰并重试。");
  }
};
