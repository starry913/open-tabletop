export const DEFAULT_NICKNAMES=Object.freeze(['雨蒙','伦敦雨夜的麦眠','忧郁小麦','小麦争连冠','3冠王小麦','如烈火如止水','似清风似惊雷','绝境最后一舞','巅峰造极境','春风澈如水','我要零失误','在枯萎雨季','我心本无泪','我非生而伶仃','往昔之局未尽','因果尽加吾身']);
export function randomNickname(){return DEFAULT_NICKNAMES[Math.floor(Math.random()*DEFAULT_NICKNAMES.length)];}
