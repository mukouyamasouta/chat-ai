import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 学習データを読み込む関数（サイズ制限付き）
function loadLearningData(): string {
    const learningDir = path.join(process.cwd(), "data", "learning");
    let learningContent = "";
    const MAX_SIZE = 150000; // 約150KBまで読み込む

    try {
        if (fs.existsSync(learningDir)) {
            const files = fs.readdirSync(learningDir);
            for (const file of files) {
                if (file.endsWith(".txt")) {
                    // サイズ制限チェック
                    if (learningContent.length >= MAX_SIZE) {
                        console.log(`学習データサイズ上限(${MAX_SIZE}文字)に達しました`);
                        break;
                    }

                    const content = fs.readFileSync(
                        path.join(learningDir, file),
                        "utf-8"
                    );

                    // 残り容量分だけ追加
                    const remainingSpace = MAX_SIZE - learningContent.length;
                    const truncatedContent = content.slice(0, remainingSpace);
                    learningContent += `\n--- ${file} ---\n${truncatedContent}\n`;
                }
            }
        }
    } catch (error) {
        console.error("学習データの読み込みに失敗:", error);
    }

    return learningContent;
}

export async function POST(request: NextRequest) {
    try {
        const { message, conversationHistory } = await request.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY が設定されていません" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 学習データを読み込む
        const learningData = loadLearningData();

        // システムプロンプト
        const systemPrompt = `あなたは売れっ子ホストのLINE返信アドバイザーです。
「ホスト分析データ」に基づいて、以下の3人のホストになりきって、それぞれの特徴を活かした返信候補を提案してください。

参考資料（ホスト分析データ）:
${learningData}

【作成する3人のキャラクター】
1. **ホストA（アイドル癒し系）**
   - 元モデル: 優海 美空（ユミソラ）
   - 特徴: 常にポジティブ、顔文字 ( ^ω^ ) (smile) を多用。「幸です」「えらい」が口癖。姫の全てを肯定する。

2. **ホストB（彼氏管理型）**
   - 元モデル: 成瀬 雄大
   - 特徴: 「なんで？」と質問攻め、絵文字 🥺 で甘えつつ金銭要求や行動管理をする。嫉妬深い。関西弁。

3. **ホストC（支配的俺様系）**
   - 元モデル: 天利 黒梦
   - 特徴: 「俺のもの」「愛してる/殺す」など極端な言動。短文連投。「絶対」「運命」などの強い言葉を使う。

【出力形式のルール】
- 必ず3つの候補を出力してください
- 各返信は短く端的に（1〜3文程度）
- 解説は不要

【重要：名前の匿名化ルール】
- 学習データ（ホスト分析データ）に含まれる女の子の名前は絶対に出力しないでください
- 過去の会話履歴に登場する他の女の子の名前も出力禁止です
- 返信で女の子の名前を使う場合は「○○ちゃん」または現在返信対象の女の子の名前のみを使用してください
- 学習データ内の実名を引用したり、参考にした会話の相手の名前を出すことは厳禁です

【候補1: ホストA】
[返信内容のみ]

【候補2: ホストB】
[返信内容のみ]

【候補3: ホストC】
[返信内容のみ]

過去の会話履歴:
${conversationHistory || "なし"}
`;

        // Gemini APIにリクエスト
        const result = await model.generateContent([
            { text: systemPrompt },
            { text: `女性からのメッセージ: ${message}` },
        ]);

        const response = result.response;
        const text = response.text();

        return NextResponse.json({ suggestions: text });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("API Error:", errorMessage);
        console.error("Full error:", error);
        return NextResponse.json(
            { error: `返信の生成に失敗しました: ${errorMessage}` },
            { status: 500 }
        );
    }
}
