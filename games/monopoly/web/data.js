import {cash} from './economy.js';
// Original Chinese place names; classic US board prices and rent progression.
export const GROUPS = [
  {name:'旧城',color:'#94684b'}, {name:'海湾',color:'#8bc4cf'},
  {name:'花园',color:'#c77ba6'}, {name:'日落',color:'#df9c50'},
  {name:'中央',color:'#c3655b'}, {name:'金叶',color:'#d9bd53'},
  {name:'翡翠',color:'#6c9b80'}, {name:'星港',color:'#607cab'},
];
const street=(name,group,price,rent,build)=>({name,type:'street',group,price,rent,build,mortgage:price/2});
const rail=name=>({name,type:'rail',price:200,mortgage:100});
const utility=name=>({name,type:'utility',price:150,mortgage:75});
export const BOARD = [
  {name:'起点',type:'go'},street('梧桐巷',0,60,[2,10,30,90,160,250],50),{name:'公共基金',type:'chest'},street('钟楼街',0,60,[4,20,60,180,320,450],50),{name:'所得税',type:'tax',amount:200},rail('南站'),
  street('帆船路',1,100,[6,30,90,270,400,550],50),{name:'机会',type:'chance'},street('灯塔路',1,100,[6,30,90,270,400,550],50),street('海风大道',1,120,[8,40,100,300,450,600],50),{name:'监狱 / 探访',type:'jail'},
  street('紫藤路',2,140,[10,50,150,450,625,750],100),utility('电力公司'),street('玫瑰路',2,140,[10,50,150,450,625,750],100),street('花园广场',2,160,[12,60,180,500,700,900],100),rail('西站'),
  street('落霞路',3,180,[14,70,200,550,750,950],100),{name:'公共基金',type:'chest'},street('琥珀路',3,180,[14,70,200,550,750,950],100),street('日落大道',3,200,[16,80,220,600,800,1000],100),{name:'免费停车',type:'parking'},
  street('剧院路',4,220,[18,90,250,700,875,1050],150),{name:'机会',type:'chance'},street('博物馆路',4,220,[18,90,250,700,875,1050],150),street('中央广场',4,240,[20,100,300,750,925,1100],150),rail('北站'),
  street('银杏路',5,260,[22,110,330,800,975,1150],150),street('金叶路',5,260,[22,110,330,800,975,1150],150),utility('自来水厂'),street('秋日大道',5,280,[24,120,360,850,1025,1200],150),{name:'前往监狱',type:'goJail'},
  street('松林路',6,300,[26,130,390,900,1100,1275],200),street('翡翠路',6,300,[26,130,390,900,1100,1275],200),{name:'公共基金',type:'chest'},street('绿洲大道',6,320,[28,150,450,1000,1200,1400],200),rail('东站'),
  {name:'机会',type:'chance'},street('星光路',7,350,[35,175,500,1100,1300,1500],200),{name:'奢侈税',type:'tax',amount:100},street('星港大道',7,400,[50,200,600,1400,1700,2000],200),
].map((p,id)=>{
  const scaled={...p,id};
  for(const key of ['price','mortgage','build','amount'])if(key in p)scaled[key]=cash(p[key]);
  if(p.rent)scaled.rent=p.rent.map(cash);
  return scaled;
});
// Original event descriptions with a fixed, documented deck. No scanned cards/assets.
const BASE_CARDS = {
  chance:[
    {text:'新一轮旅程：前进至起点。',kind:'move',to:0},
    {text:'参加开幕礼：前进至中央广场。',kind:'move',to:24},
    {text:'花园邀约：前进至紫藤路。',kind:'move',to:11},
    {text:'城市巡检：前进至最近的公用事业，若有其他业主，另掷骰支付十倍点数。',kind:'nearest',type:'utility'},
    {text:'特快班车：前进至最近的车站，向其他业主支付双倍租金。',kind:'nearest',type:'rail'},
    {text:'夜间列车：前进至最近的车站，向其他业主支付双倍租金。',kind:'nearest',type:'rail'},
    {text:'收到分红 50。',kind:'gain',amount:50},
    {text:'获得一张保留的出狱卡。',kind:'jailFree'},
    {text:'道路施工：后退三格。',kind:'back',steps:3},
    {text:'收到传票：直接入狱，不领取起点收入。',kind:'jail'},
    {text:'建筑维修：每间房屋支付 25，每座酒店支付 100。',kind:'repairs',house:25,hotel:100},
    {text:'违规停车：支付 15。',kind:'pay',amount:15},
    {text:'搭乘首班车：前进至南站。',kind:'move',to:5},
    {text:'海港晚宴：前进至星港大道。',kind:'move',to:39},
    {text:'社区赞助：向每位其他玩家支付 50。',kind:'payEach',amount:50},
    {text:'投资到期：领取 150。',kind:'gain',amount:150},
  ],
  chest:[
    {text:'回到起点，开启新旅程。',kind:'move',to:0},
    {text:'银行核对退款：领取 200。',kind:'gain',amount:200},
    {text:'健康检查：支付 50。',kind:'pay',amount:50},
    {text:'旧物售出：领取 50。',kind:'gain',amount:50},
    {text:'获得一张保留的出狱卡。',kind:'jailFree'},
    {text:'接受调查：直接入狱。',kind:'jail'},
    {text:'储蓄返还：领取 100。',kind:'gain',amount:100},
    {text:'退税：领取 20。',kind:'gain',amount:20},
    {text:'生日聚会：向每位其他玩家收取 10。',kind:'collectEach',amount:10},
    {text:'保险到期：领取 100。',kind:'gain',amount:100},
    {text:'医院账单：支付 100。',kind:'pay',amount:100},
    {text:'进修课程：支付 50。',kind:'pay',amount:50},
    {text:'顾问报酬：领取 25。',kind:'gain',amount:25},
    {text:'街区翻修：每间房屋支付 40，每座酒店支付 115。',kind:'repairs',house:40,hotel:115},
    {text:'园艺奖：领取 10。',kind:'gain',amount:10},
    {text:'遗产到账：领取 100。',kind:'gain',amount:100},
  ],
};
export const CARDS=Object.fromEntries(Object.entries(BASE_CARDS).map(([deck,cards])=>[deck,cards.map(card=>{
  const scaled={...card};
  for(const key of ['amount','house','hotel'])if(key in card)scaled[key]=cash(card[key]);
  // Numeric literals in event descriptions are monetary; movement is spelled out.
  scaled.text=card.text.replace(/\d+/g,n=>String(cash(Number(n))));
  if(card.kind==='nearest'&&card.type==='utility')scaled.text='城市巡检：前进至最近的公用事业，若有其他业主，按本回合骰子点数的 100 倍付租。';
  return scaled;
})]));
export const TOKENS=['♟','◆','●','▲','✦','■'];
export const COLORS=['#b96046','#4f8490','#8e799f','#6f8c61','#ba983b','#707989'];
export const BOT_NAMES=['林间客','海风','紫罗兰','橄榄','金叶','夜航'];
