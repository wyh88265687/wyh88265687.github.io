/**
 * @config
 * timeout: 30
 * blockImages: true
 * returnType: dom
 * keyword: Checking your browser|Just a moment|请稍候
 */
/**
 * 糖豆舞蹈 (tangdou.wv.js) — WvSpider v2.0 (fetch 模式)
 * 移植自 aidaox.jar 中 com.github.catvod.spider.WexTangDou
 * 站点: https://www.tangdou.com (糖豆广场舞)
 * 数据源: 纯 API 站点，无 CF 盾、无需登录 → 纯 fetch 模式，routes 全部返回 false
 * 三个无鉴权 GET 接口:
 *   1) https://aa.tangdou.com:12308/tv_api.php?mod=tv&ac={index|mp4}&uuid=...&version=7.1.2&client=3&channel_id=16&time={ms}
 *   2) https://api-h5.tangdou.com/sample/share/main?vid={id}          (详情)
 *   3) https://api-h5.tangdou.com/sample/share/recommend?page_num={1-3}&vid={vid} (推荐扩充)
 * 注: 搜索为伪搜索 —— 固定取"广场舞"分类首页 + recommend 扩充后按标题本地 contains 过滤，最多 40 条(与原版一致)
 */
const baseUrl = 'https://aa.tangdou.com:12308';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 7.1.2; ASUS_I003DD) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.tangdoucdn.com/'
};
var UUID = '62689604d8ca446c83b4540d6119c8b2';
var H5_BASE = 'https://api-h5.tangdou.com';
var IMG_BASE = 'http://bimg.tangdou.com';
var PAGE_SIZE = 40;
var MAX_ITEMS = 100;

// ============ 静态配置（原 WexTangDou <clinit> + homeContent） ============
// 首页 6 分类
var CLASS_LIST = [
    { type_id: '1471610743', type_name: '广场舞+舞蹈' },
    { type_id: '11', type_name: '名师' },
    { type_id: '2', type_name: '健身' },
    { type_id: '20', type_name: '乐艺厅' },
    { type_id: '18', type_name: '热榜' },
    { type_id: '5', type_name: '女神必备' }
];
// cateId 筛选项（8 个舞蹈分类，原版仅 1471610743 挂载此筛选）
var CATE_VALUES = [
    { n: '全部', v: '' },
    { n: '广场舞', v: '1471610743' },
    { n: '步子舞', v: '1471610739' },
    { n: '双人舞', v: '1471610742' },
    { n: '健身舞', v: '1471610738' },
    { n: '流行舞', v: '1471610748' },
    { n: '鬼步舞', v: '1471610757' },
    { n: '水兵舞', v: '1471610758' },
    { n: '民族风', v: '1471610746' }
];
var COMMON_FILTERS = [{ key: 'cateId', name: '类型', value: CATE_VALUES }];
var EMPTY_FILTERS = [];

// 分类全量列表缓存（模拟原版静态 HashMap a，WebView 生命周期内有效）
var _catCache = {};

// ============ 辅助函数 ============
// 对应原 g()：构造 tv_api 请求 URL（GET + 固定参数 + 动态参数）
function buildApiUrl(ac, params) {
    var url = baseUrl + '/tv_api.php?mod=tv&ac=' + ac +
        '&uuid=' + UUID +
        '&version=7.1.2' +
        '&client=3' +
        '&channel_id=16' +
        '&time=' + Date.now();
    if (params) {
        for (var k in params) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
                url += '&' + k + '=' + encodeURIComponent(String(params[k]));
            }
        }
    }
    return url;
}

// 对应原 g() 的 fetch 封装：GET + 请求头，解析 JSON，失败返回 null
async function getJson(url) {
    try {
        var res = await fetch(url, { headers: headers });
        if (res.error) return null;
        if (typeof res.json === 'function') {
            try { return await res.json(); } catch (e) {}
        }
        if (res.body) return JSON.parse(res.body);
        return null;
    } catch (e) {
        return null;
    }
}

// 对应原 e()：封面提取 —— 依次 big_pic/pic/cover/thumbnail/image
// 修复说明: 原版对非 http 相对路径无条件追加 !s640, 若原串已含图片处理参数(!)会产生
// "!sp640webp!s640" 重复参数导致 404; 此处对已含 ! 的相对路径不再追加 !s640 (实测修复后 200)
function pic(item) {
    if (!item) return '';
    var keys = ['big_pic', 'pic', 'cover', 'thumbnail', 'image'];
    var url = '';
    for (var i = 0; i < keys.length; i++) {
        var v = item[keys[i]];
        if (v) { url = v; break; }
    }
    if (!url) return '';
    if (url.indexOf('http') === 0) {
        if (url.indexOf('!') >= 0) return url;
        return url + '!s640';
    }
    if (url.indexOf('!') >= 0) return IMG_BASE + url;
    return IMG_BASE + url + '!s640';
}

// 对应原 d()：index 接口 datas 数组解析 → {vid, name, pic}（跳过无 vid 条目）
function parseDatas(arr) {
    var list = [];
    if (!arr) return list;
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        if (!item) continue;
        var vid = item['vid'] || item['id'];
        if (!vid) continue;
        var name = item['name'] || item['title'] || '';
        list.push({ vid: String(vid), name: name, pic: pic(item) });
    }
    return list;
}

// 对应原 c()：recommend 接口 data 数组解析 → {vid, name, pic}
function parseRecommends(arr) {
    var list = [];
    if (!arr) return list;
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        if (!item) continue;
        var vid = item['vid'];
        if (!vid || vid === 0) vid = item['id'];
        if (!vid) continue;
        list.push({ vid: String(vid), name: item['title'] || '', pic: pic(item) });
    }
    return list;
}

// 按 vid 去重
function dedup(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var k = list[i].vid;
        if (seen[k]) continue;
        seen[k] = 1;
        out.push(list[i]);
    }
    return out;
}

// 拉取分类全量列表：index 首页 + recommend 扩充至 ≥100 条（对应原 categoryContent 首次填充逻辑）
async function fetchCategoryList(tid) {
    var cache = _catCache[tid];
    if (cache && cache.length > 0) return cache;
    var list = [];
    var j = await getJson(buildApiUrl('index', { pid: tid, page: '1' }));
    if (j && j['datas']) {
        list = parseDatas(j['datas']);
        for (var i = 0; i < list.length && list.length < MAX_ITEMS; i++) {
            for (var pn = 1; pn <= 3 && list.length < MAX_ITEMS; pn++) {
                var rec = await getJson(H5_BASE + '/sample/share/recommend?page_num=' + pn + '&vid=' + list[i].vid);
                if (rec && rec['data']) {
                    list = dedup(list.concat(parseRecommends(rec['data'])));
                }
            }
        }
    }
    if (list.length > 0) _catCache[tid] = list;
    return list;
}

// 对应原 a()：从 datas 按 key(hd/sd) 解析播放地址 → {names, urls}
function parsePlayKey(datas, key) {
    var names = [];
    var urls = [];
    if (!datas) return { names: names, urls: urls };
    var arr = datas[key];
    if (!arr || !arr.length) return { names: names, urls: urls };
    for (var i = 0; i < arr.length; i++) {
        var it = arr[i] || {};
        var u = it['url'] || '';
        if (!u) continue;
        var cdn = it['cdn_source'] || key;
        if (String(it['define']) === '3') cdn = cdn + '1080';
        names.push(cdn);
        urls.push(u);
    }
    return { names: names, urls: urls };
}

// 对应原 f()：按 prefix→hd→sd 顺序取第一个非空播放地址
function pickUrl(datas, prefix) {
    if (!datas) return '';
    var keys = [prefix, 'hd', 'sd'];
    for (var i = 0; i < keys.length; i++) {
        var arr = datas[keys[i]];
        if (arr && arr.length && arr[0] && arr[0]['url']) return arr[0]['url'];
    }
    return '';
}

// ============ 六接口 ============
async function homeContent(filter) {
    return {
        class: CLASS_LIST,
        filters: {
            '1471610743': COMMON_FILTERS,
            '11': EMPTY_FILTERS,
            '2': EMPTY_FILTERS,
            '20': EMPTY_FILTERS,
            '18': EMPTY_FILTERS,
            '5': EMPTY_FILTERS
        }
    };
}

async function homeVideoContent() {
    var j = await getJson(buildApiUrl('index', { pid: '1471610743', page: '1' }));
    if (!j || !j['datas']) return Result.error('首页数据获取失败');
    var list = parseDatas(j['datas']);
    var out = [];
    for (var i = 0; i < list.length; i++) {
        out.push({
            vod_id: list[i].vid,
            vod_name: list[i].name,
            vod_pic: list[i].pic,
            vod_remarks: ''
        });
    }
    return { list: out };
}

async function categoryContent(tid, pg, filter, extend) {
    var page = parseInt(pg) || 1;
    var tid2 = tid;
    // 对应原版：extend 携带 cateId 时以 cateId 覆盖 pid
    if (extend && extend['cateId']) tid2 = String(extend['cateId']);
    var full = await fetchCategoryList(tid2);
    if (full.length === 0) return Result.error('分类数据获取失败');
    var total = full.length;
    var pagecount = Math.ceil(total / PAGE_SIZE);
    var start = (page - 1) * PAGE_SIZE;
    var slice = full.slice(start, start + PAGE_SIZE);
    var list = [];
    for (var i = 0; i < slice.length; i++) {
        list.push({
            vod_id: slice[i].vid,
            vod_name: slice[i].name,
            vod_pic: slice[i].pic,
            vod_remarks: ''
        });
    }
    return { page: page, pagecount: pagecount, list: list, limit: slice.length, total: total };
}

async function detailContent(ids) {
    var id = Array.isArray(ids) ? ids[0] : ids;
    if (!id) return Result.error('缺少 vid');
    var vod = { vod_id: id, vod_name: id, vod_pic: '', vod_content: '', vod_play_from: '', vod_play_url: '' };
    // 详情 H5 接口
    var main = await getJson(H5_BASE + '/sample/share/main?vid=' + encodeURIComponent(id));
    var data = main && main['data'] ? main['data'] : null;
    if (data) {
        vod.vod_name = data['title'] || id;
        vod.vod_pic = pic(data);
        vod.vod_content = data['title'] || '';
    }
    // mp4 接口取 hd/sd 双路播放地址
    var mp4 = await getJson(buildApiUrl('mp4', { vid: id }));
    var datas = mp4 && mp4['datas'] ? mp4['datas'] : null;
    var names = [];
    var urls = [];
    if (datas) {
        var hd = parsePlayKey(datas, 'hd');
        var sd = parsePlayKey(datas, 'sd');
        names = hd.names.concat(sd.names);
        urls = hd.urls.concat(sd.urls);
    }
    // 兜底：hd/sd 均空时用"分享"线路
    if (urls.length === 0 && data) {
        var pu = data['play_url'] || data['video_url'] || '';
        if (pu) { names.push('分享'); urls.push(pu); }
    }
    vod.vod_play_from = names.join('$$$');
    vod.vod_play_url = urls.join('$$$');
    return { list: [vod] };
}

async function searchContent(key, quick, pg) {
    var wd = String(key || '');
    // 伪搜索：固定取"广场舞"分类首页 + recommend 扩充（与原版一致）
    var j = await getJson(buildApiUrl('index', { pid: '1471610743', page: '1' }));
    if (!j || !j['datas']) return Result.error('搜索数据获取失败');
    var list = parseDatas(j['datas']);
    for (var i = 0; i < list.length && list.length < MAX_ITEMS; i++) {
        for (var pn = 1; pn <= 3 && list.length < MAX_ITEMS; pn++) {
            var rec = await getJson(H5_BASE + '/sample/share/recommend?page_num=' + pn + '&vid=' + list[i].vid);
            if (rec && rec['data']) {
                list = dedup(list.concat(parseRecommends(rec['data'])));
            }
        }
    }
    // 本地标题 contains 过滤 + 最多 40 条
    var filtered = [];
    for (var i2 = 0; i2 < list.length && filtered.length < 40; i2++) {
        if (wd === '' || (list[i2].name && list[i2].name.indexOf(wd) >= 0)) {
            filtered.push(list[i2]);
        }
    }
    var out = [];
    for (var i3 = 0; i3 < filtered.length; i3++) {
        out.push({
            vod_id: filtered[i3].vid,
            vod_name: filtered[i3].name,
            vod_pic: filtered[i3].pic,
            vod_remarks: ''
        });
    }
    return { list: out };
}

async function playerContent(flag, id, vipFlags) {
    var url = String(id);
    // 直链直接透传（parse:0）
    if (url.indexOf('http') === 0) {
        return { parse: 0, url: url, header: { 'User-Agent': headers['User-Agent'] } };
    }
    // 否则 mp4 接口按 flag→hd→sd 取址
    var mp4 = await getJson(buildApiUrl('mp4', { vid: id }));
    var datas = mp4 && mp4['datas'] ? mp4['datas'] : null;
    var pUrl = pickUrl(datas, flag || '');
    if (!pUrl) return Result.error('未获取到播放地址');
    return { parse: 0, url: pUrl, header: { 'User-Agent': headers['User-Agent'] } };
}

var routes = {
    homeVideoContent: function () { return false; },
    categoryContent: function () { return false; },
    detailContent: function () { return false; },
    searchContent: function () { return false; }
};
