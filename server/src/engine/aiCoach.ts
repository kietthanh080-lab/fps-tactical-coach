import axios from 'axios';
import { AnalyzedRound } from './tacticalRules';

export interface MatchCoachReport {
  overallScore: number;
  strengthsSummary: string[];
  weaknessesSummary: string[];
  recommendedDrills: string[];
  coachCommentary: string;
}

export async function generateMatchReport(
  gameType: 'VALORANT' | 'PUBG',
  mapName: string,
  rounds: AnalyzedRound[]
): Promise<MatchCoachReport> {
  const totalKills = rounds.reduce((sum, r) => sum + r.kills, 0);
  const totalDeaths = rounds.reduce((sum, r) => sum + r.deaths, 0);
  const totalDamage = rounds.reduce((sum, r) => sum + r.damageDealt, 0);
  const kdRatio = totalDeaths > 0 ? Number((totalKills / totalDeaths).toFixed(2)) : totalKills;

  const allStrengths = rounds.flatMap((r) => r.strengths);
  const allMistakes = rounds.flatMap((r) => r.mistakes);

  // Tính điểm hiệu suất cơ bản (5.0 -> 10.0)
  const rawScore = 6.0 + kdRatio * 1.4 + allStrengths.length * 0.25 - allMistakes.length * 0.3;
  const overallScore = Number(Math.min(9.8, Math.max(3.5, rawScore)).toFixed(1));

  // Fallback mặc định nếu chưa có hoặc hết quota Gemini API
  const fallbackReport: MatchCoachReport = {
    overallScore,
    strengthsSummary:
      allStrengths.length > 0
        ? Array.from(new Set(allStrengths)).slice(0, 3)
        : [`Duy trì chỉ số K/D ${kdRatio} với ${totalDamage} tổng sát thương trên bản đồ ${mapName}.`],
    weaknessesSummary:
      allMistakes.length > 0
        ? Array.from(new Set(allMistakes)).slice(0, 3)
        : ['Cần chủ động phối hợp giao tranh cùng đồng đội nhiều hơn ở các round bản lề.'],
    recommendedDrills:
      gameType === 'VALORANT'
        ? [
            'Luyện kê tâm ngang tầm đầu (Crosshair Placement) 10 phút trong Deathmatch trước khi vào xếp hạng.',
            'Giữ khoảng cách đi cùng đồng đội (1-2 giây di chuyển) để luôn có thể trade kill.',
          ]
        : [
            'Luyện kiểm soát độ giật súng AR ở cự ly 50-100m trong Training Mode.',
            'Luôn mang theo tối thiểu 3-4 quả Smoke để tạo vật cản khi di chuyển ở các vòng bo cuối.',
          ],
    coachCommentary: `Trận đấu trên bản đồ ${mapName} ghi nhận ${totalKills} hạ gục / ${totalDeaths} lần bị hạ gục (K/D ${kdRatio}). Tập trung khắc phục ${allMistakes.length} tình huống lỗi vị trí sẽ giúp cải thiện rõ rệt tỷ lệ thắng.`,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return fallbackReport;
  }

  try {
    const prompt = `Bạn là huấn luyện viên chuyên nghiệp tựa game ${gameType}. Hãy phân tích ngắn gọn, thực tế bằng tiếng Việt cho trận đấu trên bản đồ ${mapName}:
- Tổng số round/phase: ${rounds.length}
- K/D: ${totalKills}/${totalDeaths} (${kdRatio}), Tổng sát thương: ${totalDamage}
- Các điểm mạnh ghi nhận: ${JSON.stringify(allStrengths.slice(0, 6))}
- Các lỗi chiến thuật ghi nhận: ${JSON.stringify(allMistakes.slice(0, 6))}

Trả về duy nhất 1 object JSON hợp lệ (không bọc markdown) theo đúng cấu trúc:
{
  "strengthsSummary": ["điểm mạnh 1", "điểm mạnh 2"],
  "weaknessesSummary": ["điểm yếu 1", "điểm yếu 2"],
  "recommendedDrills": ["bài tập 1", "bài tập 2"],
  "coachCommentary": "Nhận xét tổng kết 2-3 câu sắc bén"
}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      },
      { timeout: 12000 }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallbackReport;

    const parsed = JSON.parse(rawText);
    return {
      overallScore,
      strengthsSummary: parsed.strengthsSummary || fallbackReport.strengthsSummary,
      weaknessesSummary: parsed.weaknessesSummary || fallbackReport.weaknessesSummary,
      recommendedDrills: parsed.recommendedDrills || fallbackReport.recommendedDrills,
      coachCommentary: parsed.coachCommentary || fallbackReport.coachCommentary,
    };
  } catch (error) {
    console.error('Gemini AI Coach fallback activated:', error);
    return fallbackReport;
  }
}