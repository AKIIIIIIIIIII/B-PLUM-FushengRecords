#!/usr/bin/env node

function parseArgs(argv) {
  const result = { pastCount: 5, futureCount: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key.startsWith("--")) result[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  result.pastCount = Number(result.pastCount);
  result.futureCount = Number(result.futureCount);
  if (!Number.isInteger(result.pastCount) || !Number.isInteger(result.futureCount) || result.pastCount < 0 || result.futureCount < 0 || result.pastCount + result.futureCount < 1) throw new Error("过去与未来数量必须是非负整数，且总数至少为 1。");
  return result;
}

function hashSeed(value) { let hash = 2166136261; for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function randomFactory(seed) { let state = seed || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
function shuffled(values, random) { const copy = [...values]; for (let index = copy.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [copy[index], copy[target]] = [copy[target], copy[index]]; } return copy; }
function choose(values, random) { return values[Math.floor(random() * values.length)]; }

const pastPool = [
  ["海边的生日", ["exact", "2022.08.07"], "镰仓海边", "海风吹熄蜡烛前，沿海电车正从身后经过。", ["温暖", "轻快"], "海风、蛋糕、沿海电车、落日"],
  ["雨后回家", ["exact", "2024.06.18"], "家附近的旧街", "便利店的暖灯落在湿漉漉的路面上。", ["安定", "松弛"], "雨伞、便利店、湿润街道、暖灯"],
  ["第一次看雪", ["season", "2023·冬"], "东京街头", "雪落下来时，街道忽然变得很安静。", ["惊喜", "安静"], "初雪、围巾、街灯、脚印"],
  ["清晨的车站", ["month", "2021.04"], "春日月台", "晨雾散开，列车和新的行李一起出发。", ["期待", "清醒"], "列车、晨雾、花瓣、行李箱"],
  ["屋顶看晚霞", ["season", "2020·夏"], "旧屋天台", "汽水的气泡升到最后一片晚霞里。", ["自由", "惬意"], "晚霞、汽水、晾衣绳、飞鸟"],
  ["山里的午后", ["exact", "2019.10.12"], "长野山间", "热茶在木屋里冒着白气，山路铺满红叶。", ["宁静", "满足"], "木屋、红叶、热茶、山路"],
  ["深夜的拉面", ["exact", "2023.11.03"], "巷口小店", "雨夜的蒸汽把小店的灯笼照得很亮。", ["慰藉", "温热"], "蒸汽、木柜台、雨夜、灯笼"],
  ["花火散场后", ["month", "2022.07"], "河岸堤坝", "烟花熄灭后，河风还在轻轻吹着纸扇。", ["留恋", "浪漫"], "烟花余光、浴衣、纸扇、河风"],
  ["旧书店重逢", ["season", "2024·春"], "神保町书店", "木梯旁翻开的旧书，刚好停在熟悉的一页。", ["惊喜", "怀旧"], "旧书、木梯、窗光、纸页"],
  ["海岛骑行日", ["exact", "2021.09.15"], "濑户内海", "单车越过海桥，柠檬树在风里摇晃。", ["明朗", "畅快"], "单车、海桥、白云、柠檬树"],
  ["厨房的冬至", ["exact", "2020.12.21"], "家中厨房", "瓷碗盛着热汤圆，窗上结了一层薄霜。", ["团圆", "安心"], "汤圆、瓷碗、窗霜、围裙"],
  ["毕业那场风", ["month", "2018.06"], "校园礼堂", "学位帽飞起来时，长廊外的树影正摇动。", ["释然", "昂扬"], "学位帽、树影、花束、长廊"]
];
const futurePool = [
  ["住进海风里", ["cosmic", "宇宙时区"], "一座靠海的小城", "在有海景窗的房间里，把日子过得明亮又缓慢。", ["松弛", "开阔"], "海景窗、白衬衫、植物、远山"],
  ["月光下见面", ["best", "最佳时机"], "京都鸭川河畔", "在月亮正好的晚上，和重要的人慢慢散步。", ["温柔", "笃定"], "月亮、围巾、热饮、河岸灯火"],
  ["写完一本书", ["best", "最佳时机"], "安静的临窗书桌", "让最后一页手稿在晨光里安静落定。", ["专注", "喜悦"], "手稿、钢笔、晨光、咖啡"],
  ["拥有森林小屋", ["cosmic", "宇宙时区"], "北方森林", "在壁炉和松树之间，拥有一个可以慢下来的家。", ["安宁", "踏实"], "木屋、壁炉、松树、雪"],
  ["远方开一间店", ["best", "最佳时机"], "有石板路的小镇", "推开木门，把花束和好心情摆在每天的门口。", ["期待", "创造"], "木门、花束、招牌、晨雾"],
  ["看极光升起", ["cosmic", "宇宙时区"], "冰岛旷野", "在雪原和星空之间，等一场绿色的光慢慢升起。", ["震撼", "自由"], "极光、雪原、帐篷、星空"],
  ["在巴黎过春天", ["best", "最佳时机"], "塞纳河左岸", "沿着花树和旧桥骑车，把春天收进行李。", ["浪漫", "轻盈"], "花树、旧桥、自行车、书摊"],
  ["庭院里喝早茶", ["cosmic", "宇宙时区"], "有桂树的院子", "让晨鸟、桂花和一盏热茶一起开启早晨。", ["从容", "清新"], "茶盏、桂花、竹椅、晨鸟"],
  ["乘船穿过群岛", ["best", "最佳时机"], "爱琴海群岛", "跟着白帆穿过蓝窗和石阶之间的海。", ["冒险", "明朗"], "白帆、蓝窗、海鸟、石阶"],
  ["办一场小展览", ["cosmic", "宇宙时区"], "采光明亮的画廊", "让画框、花束和来客共同见证一段创作。", ["勇气", "分享"], "画框、花束、来客、天窗"],
  ["拥有自己的光", ["best", "最佳时机"], "城市顶层工作室", "在落地窗前做喜欢的事，看夜景一盏盏亮起。", ["自信", "丰盛"], "落地窗、画桌、夜景、植物"],
  ["慢慢环游世界", ["cosmic", "宇宙时区"], "通往远方的车站", "带着地图和行李，在每一站多停留一点。", ["自在", "好奇"], "地图、行李、车票、晨光"]
];

function makeItems(kind, count, pool, random) {
  const order = shuffled(pool, random);
  return Array.from({ length: count }, (_, index) => {
    const [baseTitle, [timeMode, timeValue], place, note, emotion, elementText] = order[index % order.length];
    const cycle = Math.floor(index / order.length);
    const title = cycle ? `${baseTitle.slice(0, 8)}续${cycle + 1}` : baseTitle;
    const visualElements = elementText.split("、");
    const shapeStyle = choose(kind === "past" ? ["intermission-stub", "film-edge"] : ["intermission-stub", "film-edge", "chapter-pass"], random);
    const layoutStyle = shapeStyle === "chapter-pass" ? "chapter-poster" : "stage-triptych";
    const concept = `${place}中“${title}”的虚构演示场景：${visualElements.slice(0, 3).join("、")}；情绪为${emotion.join("、")}。`;
    return { fictionalSample: true, ticketType: kind === "past" ? "往昔纪念票" : "宇宙订单票", kind, status: kind === "past" ? "ended" : "ordered", title, scene: `${place}中的“${title}”虚构演示场景。${note}`, time: { mode: timeMode, raw: timeValue, display: timeValue }, place, note, emotion, visualElements, image: { source: "generated", concept, prompt: null, referenceUsed: false }, design: { shapeStyle, layoutStyle, stampStyle: choose(["floral-slip", "negative-square", "broken-ring"], random), eventDoodle: { keyword: choose(visualElements, random), style: "broken-ink-doodle", placement: layoutStyle === "chapter-poster" ? "place-side" : "place-record-side", status: "generated" }, imageStyle: "symbolic-card-illustration", finishStyle: "modern-vintage-editorial", typographyStyle: "qiji-source-han" } };
  });
}

try {
  const args = parseArgs(process.argv.slice(2));
  const seedValue = args.seed || `${Date.now()}-${Math.random()}`;
  const random = randomFactory(hashSeed(seedValue));
  const items = [...makeItems("past", args.pastCount, pastPool, random), ...makeItems("universe", args.futureCount, futurePool, random)];
  console.log(JSON.stringify({ seed: String(seedValue), pastCount: args.pastCount, futureCount: args.futureCount, items }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(2); }
