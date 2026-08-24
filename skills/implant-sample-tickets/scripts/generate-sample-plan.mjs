#!/usr/bin/env node

function parseArgs(argv) {
  const result = { pastCount: 5, futureCount: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key.startsWith("--")) result[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  result.pastCount = Number(result.pastCount);
  result.futureCount = Number(result.futureCount);
  if (!Number.isInteger(result.pastCount) || !Number.isInteger(result.futureCount) || result.pastCount < 0 || result.futureCount < 0 || result.pastCount + result.futureCount < 1) {
    throw new Error("过去与未来数量必须是非负整数，且总数至少为 1。");
  }
  return result;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFactory(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

const pastPool = [
  ["海边的生日", "2022.08.07", "镰仓海边", "海风、蛋糕、沿海电车、落日"],
  ["雨后回家", "2024.06.18", "家附近的旧街", "雨伞、便利店、湿润街道、暖灯"],
  ["第一次看雪", "2023·冬", "东京街头", "初雪、围巾、街灯、脚印"],
  ["清晨的车站", "2021.04", "春日月台", "列车、晨雾、花瓣、行李箱"],
  ["屋顶看晚霞", "2020·夏", "旧屋天台", "晚霞、汽水、晾衣绳、飞鸟"],
  ["山里的午后", "2019.10.12", "长野山间", "木屋、红叶、热茶、山路"],
  ["深夜的拉面", "2023.11.03", "巷口小店", "蒸汽、木柜台、雨夜、灯笼"],
  ["花火散场后", "2022.07", "河岸堤坝", "烟花余光、浴衣、纸扇、河风"],
  ["旧书店重逢", "2024·春", "神保町书店", "旧书、木梯、窗光、纸页"],
  ["海岛骑行日", "2021.09.15", "濑户内海", "单车、海桥、白云、柠檬树"],
  ["厨房的冬至", "2020.12.21", "家中厨房", "汤圆、瓷碗、窗霜、围裙"],
  ["毕业那场风", "2018.06", "校园礼堂", "学位帽、树影、花束、长廊"]
];

const futurePool = [
  ["住进海风里", "宇宙时区", "一座靠海的小城", "海景窗、白衬衫、植物、远山"],
  ["月光下见面", "最佳时机", "京都鸭川河畔", "月亮、围巾、热饮、河岸灯火"],
  ["写完一本书", "最佳时机", "安静的临窗书桌", "手稿、钢笔、晨光、咖啡"],
  ["拥有森林小屋", "宇宙时区", "北方森林", "木屋、壁炉、松树、雪"],
  ["远方开一间店", "最佳时机", "有石板路的小镇", "木门、花束、招牌、晨雾"],
  ["看极光升起", "宇宙时区", "冰岛旷野", "极光、雪原、帐篷、星空"],
  ["在巴黎过春天", "最佳时机", "塞纳河左岸", "花树、旧桥、自行车、书摊"],
  ["庭院里喝早茶", "宇宙时区", "有桂树的院子", "茶盏、桂花、竹椅、晨鸟"],
  ["乘船穿过群岛", "最佳时机", "爱琴海群岛", "白帆、蓝窗、海鸟、石阶"],
  ["办一场小展览", "宇宙时区", "采光明亮的画廊", "画框、花束、来客、天窗"],
  ["拥有自己的光", "最佳时机", "城市顶层工作室", "落地窗、画桌、夜景、植物"],
  ["慢慢环游世界", "宇宙时区", "通往远方的车站", "地图、行李、车票、晨光"]
];

function makeItems(kind, count, pool, random) {
  const order = shuffled(pool, random);
  return Array.from({ length: count }, (_, index) => {
    const [baseTitle, time, place, elements] = order[index % order.length];
    const cycle = Math.floor(index / order.length);
    const title = cycle ? `${baseTitle.slice(0, 8)}续${cycle + 1}` : baseTitle;
    return {
      kind,
      title,
      time,
      place,
      scene: `${place}中的“${title}”虚构演示场景`,
      visualElements: elements.split("、"),
      fictionalSample: true
    };
  });
}

try {
  const args = parseArgs(process.argv.slice(2));
  const seedValue = args.seed || `${Date.now()}-${Math.random()}`;
  const random = randomFactory(hashSeed(seedValue));
  const items = [
    ...makeItems("past", args.pastCount, pastPool, random),
    ...makeItems("universe", args.futureCount, futurePool, random)
  ];
  console.log(JSON.stringify({ seed: String(seedValue), pastCount: args.pastCount, futureCount: args.futureCount, items }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
